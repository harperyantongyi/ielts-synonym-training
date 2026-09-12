// Central state store: persistence, progress/mastery, question building,
// favorites, review queue, custom library + backup.
import { SYNONYM_GROUPS, WORD_MEANINGS } from '../data/seed-synonyms.js';
import { HYPO_GROUPS, MULTI_DEMO } from '../data/seed-hyponyms.js';
import { DAY, shuffle, pickN, uid, todayKey, toRepObjs } from './util.js';

const STORAGE_KEY = 'ielts-syn-v1';
const DEFAULT_SETTINGS = {
  wordAudio: true,
  sfx: true,
  vibrate: false,
  multiUnderline: false,
  autoShowAnalysis: true,
  defaultShowMeaning: false,
};

function freshState() {
  return {
    settings: { ...DEFAULT_SETTINGS },
    progress: { synonym: {}, hyponym: {} },
    favorites: [],
    custom: { synonym: [], hyponym: [] },
    overrides: { synonym: {}, hyponym: {} },
    manualReview: { synonym: [], hyponym: [] },
    stats: { daily: {}, lastPracticeDate: '', checkInStreak: 0 },
  };
}

// Merge built-in + custom + multi-demo into the per-module group list.
function baseGroups(module) {
  if (module === 'synonym') {
    return [...SYNONYM_GROUPS, ...MULTI_DEMO.map((m) => ({ ...m, module: 'synonym' }))];
  }
  return [...HYPO_GROUPS];
}

class StoreClass {
  constructor() {
    this.state = freshState();
    this.load();
  }

  load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        this.state = { ...freshState(), ...parsed };
        this.state.settings = { ...DEFAULT_SETTINGS, ...(parsed.settings || {}) };
        this.state.progress = { synonym: {}, hyponym: {}, ...(parsed.progress || {}) };
        this.state.manualReview = { synonym: [], hyponym: [], ...(parsed.manualReview || {}) };
      }
    } catch (e) {
      this.state = freshState();
    }
  }

  save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
    } catch (e) {
      /* quota / private mode: ignore */
    }
  }

  // ---------- Settings ----------
  getSettings() {
    return this.state.settings;
  }
  setSetting(key, value) {
    this.state.settings[key] = value;
    this.save();
  }

  // ---------- Groups ----------
  getGroups(module) {
    const builtin = baseGroups(module);
    const custom = this.state.custom[module] || [];
    return [...builtin, ...custom];
  }

  getGroup(module, id) {
    const all = this.getGroups(module);
    const g = all.find((x) => x.id === id);
    if (!g) return null;
    return this.normalize(module, g);
  }

  normalize(module, g) {
    const override = (this.state.overrides[module] || {})[g.id] || {};
    const repObjs = toRepObjs(
      override.replacements
        ? [...(g.replacements || []), ...override.replacements]
        : g.replacements,
      g.coreMeaning,
      WORD_MEANINGS
    );
    // de-duplicate reps
    const seen = new Set();
    const dedup = repObjs.filter((r) => {
      const k = r.w.toLowerCase();
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
    return {
      id: g.id,
      module,
      type: g.type,
      topic: g.topic,
      core: g.core,
      coreMeaning: g.coreMeaning,
      repObjs: dedup,
      sentence: g.sentence || '',
      source: g.source || '模拟题',
      note: override.note || g.note || '',
      errorTip: override.errorTip || g.errorTip || '',
      multi: g.type === 'multi',
      underlines: g.underlines || null,
    };
  }

  getTopics(module) {
    const map = new Map();
    for (const g of this.getGroups(module)) {
      map.set(g.topic, (map.get(g.topic) || 0) + 1);
    }
    return [...map.entries()].map(([topic, count]) => ({ topic, count }));
  }

  getTopicGroups(module, topic) {
    return this.getGroups(module)
      .filter((g) => g.topic === topic)
      .map((g) => this.normalize(module, g));
  }

  // ---------- Progress ----------
  _ensureProgress(module, id) {
    this.state.progress[module][id] =
      this.state.progress[module][id] || {
        status: 'unlearned',
        streak: 0,
        attempts: 0,
        correct: 0,
        errors: 0,
        lastAnswered: 0,
        nextReview: 0,
        reviewStage: '',
        firstLearnedAt: 0,
        masteredAt: 0,
      };
    return this.state.progress[module][id];
  }

  getProgress(module, id) {
    return (
      this.state.progress[module][id] || {
        status: 'unlearned',
        streak: 0,
        attempts: 0,
        correct: 0,
        errors: 0,
        lastAnswered: 0,
        nextReview: 0,
        reviewStage: '',
        firstLearnedAt: 0,
        masteredAt: 0,
      }
    );
  }

  recordAnswer(module, id, allCorrect, opts = {}) {
    const p = this._ensureProgress(module, id);
    const now = Date.now();
    p.attempts++;
    p.lastAnswered = now;
    if (allCorrect) {
      p.correct++;
      p.streak = (p.streak || 0) + 1;
      if (p.streak >= 3) {
        p.status = 'mastered';
        if (!p.masteredAt) p.masteredAt = now;
        if (p.reviewStage === '' || p.reviewStage === 'b1') {
          p.reviewStage = 'm3';
          p.nextReview = now + 3 * DAY;
        } else if (p.reviewStage === 'm3') {
          p.reviewStage = 'm7';
          p.nextReview = now + 7 * DAY;
        } else if (p.reviewStage === 'm7') {
          p.reviewStage = 'done';
          p.nextReview = Infinity;
        }
      } else if (p.streak === 2) {
        p.status = 'intermediate';
      } else {
        p.status = 'beginner';
        if (!p.firstLearnedAt) {
          p.firstLearnedAt = now;
          p.reviewStage = 'b1';
          p.nextReview = now + 1 * DAY;
        }
      }
    } else {
      p.errors++;
      p.streak = 0;
      p.status = 'weak';
      p.reviewStage = '';
      p.nextReview = now; // prioritised
    }
    if (opts.fromReview) {
      this.state.manualReview[module] = (this.state.manualReview[module] || []).filter(
        (x) => x !== id
      );
    }
    this._bumpDaily();
    this.save();
    return p;
  }

  _bumpDaily() {
    const tk = todayKey();
    const s = this.state.stats;
    s.daily[tk] = (s.daily[tk] || 0) + 1;
    if (s.lastPracticeDate !== tk) {
      const yesterday = todayKey(new Date(Date.now() - DAY));
      if (s.lastPracticeDate === yesterday) s.checkInStreak = (s.checkInStreak || 0) + 1;
      else if (s.lastPracticeDate !== tk) s.checkInStreak = 1;
      s.lastPracticeDate = tk;
    }
  }

  getModuleStats(module) {
    const groups = this.getGroups(module);
    const total = groups.length;
    let mastered = 0,
      beginner = 0,
      intermediate = 0,
      weak = 0,
      unlearned = 0,
      attempts = 0,
      correct = 0;
    for (const g of groups) {
      const p = this.getProgress(module, g.id);
      attempts += p.attempts;
      correct += p.correct;
      if (p.status === 'mastered') mastered++;
      else if (p.status === 'weak') weak++;
      else if (p.status === 'intermediate') intermediate++;
      else if (p.status === 'beginner') beginner++;
      else unlearned++;
    }
    const learned = total - unlearned;
    const accuracy = attempts ? Math.round((correct / attempts) * 100) : 0;
    const masteryPct = total ? Math.round((mastered / total) * 100) : 0;
    return {
      total,
      mastered,
      beginner,
      intermediate,
      weak,
      unlearned,
      learned,
      accuracy,
      masteryPct,
    };
  }

  getTopicStats(module, topic) {
    const groups = this.getTopicGroups(module, topic);
    const total = groups.length;
    let mastered = 0,
      weak = 0,
      unlearned = 0;
    for (const g of groups) {
      const p = this.getProgress(module, g.id);
      if (p.status === 'mastered') mastered++;
      else if (p.status === 'weak') weak++;
      else if (p.status === 'unlearned') unlearned++;
    }
    return { total, mastered, weak, unlearned, pct: total ? Math.round((mastered / total) * 100) : 0 };
  }

  // ---------- Question building ----------
  getDistractors(module, group, n) {
    const ownWords = new Set(
      [group.core, ...(group.repObjs || []).map((r) => r.w)].map((w) => w.toLowerCase())
    );
    let pool = [];
    if (module === 'synonym') {
      for (const g of this.getGroups('synonym')) {
        if (g.topic === group.topic || g.id === group.id) continue;
        const ng = this.normalize('synonym', g);
        if (!ng.core) continue;
        (ng.repObjs || []).forEach((r) => {
          if (!ownWords.has(r.w.toLowerCase())) pool.push({ w: r.w, m: r.m });
        });
        if (!ownWords.has(ng.core.toLowerCase()))
          pool.push({ w: ng.core, m: ng.coreMeaning });
      }
    } else {
      // hyponym: use general terms (cores) from other topics
      for (const g of this.getGroups('hyponym')) {
        if (g.topic === group.topic) continue;
        const ng = this.normalize('hyponym', g);
        if (!ng.core) continue;
        if (!ownWords.has(ng.core.toLowerCase()))
          pool.push({ w: ng.core, m: ng.coreMeaning });
      }
    }
    return pickN(pool, n);
  }

  makeUnderline(module, core, coreMeaning, repObjs, topic) {
    const correctWords = repObjs.map((r) => r.w);
    const distractorCount = poolLarge(module, topic) ? 4 : 3;
    const distractors = this.getDistractors(module, { core, repObjs, topic }, distractorCount);
    const options = shuffle([
      ...repObjs.map((r) => ({ text: r.w, meaning: r.m, correct: true })),
      ...distractors.map((d) => ({ text: d.w, meaning: d.m, correct: false })),
    ]);
    return { core, meaning: coreMeaning, options, correctWords };
  }

  buildQuestion(module, group) {
    const u = this.makeUnderline(
      module,
      group.core,
      group.coreMeaning,
      group.repObjs,
      group.topic
    );
    return {
      module,
      groupId: group.id,
      topic: group.topic,
      source: group.source,
      sentence: group.sentence,
      note: group.note,
      errorTip: group.errorTip,
      underlines: [u],
      multi: false,
    };
  }

  buildMultiQuestion(obj) {
    const underlines = obj.underlines.map((u, i) =>
      this.makeUnderline('hyponym', u.core, u.coreMeaning, u.repObjs, obj.topic)
    );
    return {
      module: 'synonym',
      groupId: obj.id,
      topic: obj.topic,
      source: obj.source,
      sentence: obj.sentence,
      note: '',
      errorTip: '',
      underlines,
      multi: true,
      syntheticIds: obj.underlines.map((u, i) => `${obj.id}#${i}`),
    };
  }

  // ---------- Favorites ----------
  isFavorite(word, groupId) {
    return this.state.favorites.some(
      (f) => f.word.toLowerCase() === word.toLowerCase() && f.groupId === groupId
    );
  }
  toggleFavorite(word, meaning, groupId, topic, type) {
    const idx = this.state.favorites.findIndex(
      (f) => f.word.toLowerCase() === word.toLowerCase() && f.groupId === groupId
    );
    if (idx >= 0) {
      this.state.favorites.splice(idx, 1);
    } else {
      this.state.favorites.unshift({
        word,
        meaning,
        groupId,
        topic,
        type,
        addedAt: Date.now(),
      });
    }
    this.save();
    return !idx >= 0;
  }
  getFavorites() {
    return this.state.favorites;
  }
  removeFavorite(word, groupId) {
    this.state.favorites = this.state.favorites.filter(
      (f) => !(f.word.toLowerCase() === word.toLowerCase() && f.groupId === groupId)
    );
    this.save();
  }

  // ---------- Review queue ----------
  addToReview(module, groupId) {
    const arr = this.state.manualReview[module] || (this.state.manualReview[module] = []);
    if (!arr.includes(groupId)) arr.push(groupId);
    this.save();
  }

  getReviewList(module) {
    const now = Date.now();
    const groups = this.getGroups(module);
    const byId = {};
    for (const g of groups) byId[g.id] = g;
    const map = new Map(); // groupId -> {priority, reason, topic}
    const put = (id, priority, reason, topic) => {
      const cur = map.get(id);
      if (!cur || priority < cur.priority) map.set(id, { priority, reason, topic });
    };
    for (const g of groups) {
      const p = this.getProgress(module, g.id);
      if (p.status === 'weak') put(g.id, 0, '错题', g.topic);
      else if (p.nextReview && p.nextReview <= now && p.status !== 'unlearned') {
        put(g.id, 1, p.status === 'mastered' ? '到期复习' : '初次复习', g.topic);
      }
    }
    for (const id of this.state.manualReview[module] || []) {
      if (byId[id]) put(id, 0.5, '手动加入', byId[id].topic);
    }
    // new groups (unlearned) capped for "巩固复习"
    let added = 0;
    for (const g of groups) {
      if (added >= 15) break;
      if (this.getProgress(module, g.id).status === 'unlearned') {
        put(g.id, 2, '巩固复习', g.topic);
        added++;
      }
    }
    const list = [...map.entries()].map(([groupId, v]) => ({
      groupId,
      reason: v.reason,
      topic: v.topic,
      priority: v.priority,
    }));
    list.sort((a, b) => a.priority - b.priority || a.topic.localeCompare(b.topic));
    return list;
  }

  // ---------- Custom groups + overrides ----------
  addReplacement(module, groupId, word, meaning) {
    if (groupId.startsWith('cus-')) {
      const g = (this.state.custom[module] || []).find((x) => x.id === groupId);
      if (g) {
        g.replacements = g.replacements || [];
        if (g.replacements.some((r) => (typeof r === 'string' ? r : r.w).toLowerCase() === word.toLowerCase()))
          return false;
        g.replacements.push(module === 'hyponym' ? { w: word, m: meaning } : word);
      }
    } else {
      this.state.overrides[module] = this.state.overrides[module] || {};
      const o = (this.state.overrides[module][groupId] =
        this.state.overrides[module][groupId] || {});
      o.replacements = o.replacements || [];
      if (o.replacements.some((r) => r.toLowerCase() === word.toLowerCase())) return false;
      o.replacements.push(word);
    }
    this.save();
    return true;
  }

  addCustomGroup(module, group) {
    group.id = uid('cus');
    group.type = module === 'hyponym' ? 'hyponym' : 'synonym';
    group.source = '自定义';
    this.state.custom[module] = this.state.custom[module] || [];
    this.state.custom[module].push(group);
    this.save();
    return group.id;
  }

  updateCustomGroup(module, id, patch) {
    const g = (this.state.custom[module] || []).find((x) => x.id === id);
    if (!g) return false;
    Object.assign(g, patch);
    this.save();
    return true;
  }

  deleteCustomGroup(module, id) {
    this.state.custom[module] = (this.state.custom[module] || []).filter((x) => x.id !== id);
    this.save();
  }

  importCustom(module, text, topic) {
    const lines = text
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith('//'));
    let count = 0;
    for (const line of lines) {
      const parts = line.split('|').map((s) => s.trim()).filter((s) => s.length);
      if (parts.length < 3) continue;
      const core = parts[0];
      const coreMeaning = parts[1];
      const replacements = parts.slice(2).map((r) =>
        module === 'hyponym' ? { w: r, m: '' } : r
      );
      this.state.custom[module] = this.state.custom[module] || [];
      this.state.custom[module].push({
        id: uid('cus'),
        type: module === 'hyponym' ? 'hyponym' : 'synonym',
        topic: topic || '自定义导入',
        core,
        coreMeaning,
        replacements,
        source: '自定义',
        note: '',
        errorTip: '',
        sentence: '',
      });
      count++;
    }
    this.save();
    return count;
  }

  exportCustom(module) {
    const groups = this.state.custom[module] || [];
    return groups
      .map((g) => {
        const reps = (g.replacements || [])
          .map((r) => (typeof r === 'string' ? r : r.w))
          .join(' | ');
        return `${g.core} | ${g.coreMeaning} | ${reps}`;
      })
      .join('\n');
  }

  // ---------- Backup / restore ----------
  exportAll() {
    return JSON.stringify(
      {
        v: 1,
        custom: this.state.custom,
        favorites: this.state.favorites,
        progress: this.state.progress,
        manualReview: this.state.manualReview,
        overrides: this.state.overrides,
      },
      null,
      2
    );
  }

  importAll(text) {
    const data = JSON.parse(text);
    if (data.custom) this.state.custom = data.custom;
    if (data.favorites) this.state.favorites = data.favorites;
    if (data.progress) this.state.progress = data.progress;
    if (data.manualReview) this.state.manualReview = data.manualReview;
    if (data.overrides) this.state.overrides = data.overrides;
    this.save();
  }

  resetAll() {
    this.state = freshState();
    this.save();
  }
}

function poolLarge(module, topic) {
  // crude heuristic: distractors are plenty for large modules
  return module === 'synonym';
}

export const Store = new StoreClass();
export { WORD_MEANINGS };
