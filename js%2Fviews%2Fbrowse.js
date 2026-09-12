// Browse / dashboard / search / favorites / library / settings / group detail / review entry.
import { Store, WORD_MEANINGS } from '../core/store.js';
import { Audio } from '../core/audio.js';
import { esc, STATUS_LABEL, STATUS_COLOR, optionList, debounce } from '../core/util.js';

const TYPE_LABEL = { synonym: '近义词', hyponym: '上下义', multi: '多划线' };

function progressBar(pct, color = '#16a34a') {
  return `<div class="bar"><div class="bar-fill" style="width:${pct}%;background:${color}"></div></div>`;
}

function statCounts(module) {
  const s = Store.getModuleStats(module);
  return s;
}

// ---------------- HOME ----------------
export function initHome() {
  const app = document.getElementById('app');
  const syn = statCounts('synonym');
  const hyp = statCounts('hyponym');
  const today = new Date();
  const tk = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(
    today.getDate()
  ).padStart(2, '0')}`;
  const todayCount = (Store.state.stats.daily[tk] || 0);
  const streak = Store.state.stats.checkInStreak || 0;

  app.innerHTML = `
    <div class="home">
      <div class="hero card">
        <h1>雅思同义替换训练</h1>
        <p class="muted">以语义场为核心，匹配真题改写逻辑。全部数据保存在本地浏览器。</p>
        <div class="hero-stats">
          <div class="hs"><b>${todayCount}</b><span>今日已练</span></div>
          <div class="hs"><b>${streak}</b><span>连续打卡</span></div>
          <div class="hs"><b>${Store.getFavorites().length}</b><span>收藏单词</span></div>
        </div>
      </div>

      ${moduleCard('synonym', '近义词替换', syn)}
      ${moduleCard('hyponym', '上下义替换', hyp)}

      <div class="card warn">
        ⚠️ 自定义数据保存在本地浏览器，清理缓存会丢失，建议定期在「词库」中备份。
      </div>
    </div>`;
}

function moduleCard(module, title, s) {
  const color = module === 'synonym' ? '#2563eb' : '#7c3aed';
  return `
    <div class="card module-card" style="border-left:4px solid ${color}">
      <div class="mc-head">
        <h2>${title}</h2>
        <span class="badge">掌握 ${s.masteryPct}%</span>
      </div>
      ${progressBar(s.masteryPct, color)}
      <div class="mc-counts">
        <span>总 ${s.total}</span>
        <span style="color:${STATUS_COLOR.mastered}">已掌握 ${s.mastered}</span>
        <span style="color:${STATUS_COLOR.beginner}">初学 ${s.beginner}</span>
        <span style="color:${STATUS_COLOR.intermediate}">进阶 ${s.intermediate}</span>
        <span style="color:${STATUS_COLOR.unlearned}">未学 ${s.unlearned}</span>
        <span style="color:${STATUS_COLOR.weak}">薄弱 ${s.weak}</span>
      </div>
      <p class="muted">总正确率 ${s.accuracy}%</p>
      <div class="actions">
        <a class="btn primary" href="#/module/${module}">进入练习</a>
        <a class="btn" href="#/review/${module}">复习队列</a>
      </div>
    </div>`;
}

// ---------------- MODULE (topics) ----------------
export function initModule(params) {
  const app = document.getElementById('app');
  const module = params.module;
  const title = module === 'synonym' ? '近义词替换' : '上下义替换';
  let filter = 'all';

  function render() {
    const topics = Store.getTopics(module);
    const counts = { all: topics.length, unstarted: 0, ongoing: 0, mastered: 0 };
    const cards = topics
      .map((t) => {
        const st = Store.getTopicStats(module, t.topic);
        let cat = 'ongoing';
        if (st.unlearned === st.total) cat = 'unstarted';
        else if (st.mastered === st.total) cat = 'mastered';
        counts[cat]++;
        if (filter !== 'all' && filter !== cat) return '';
        return `
        <a class="card topic-card" href="#/practice/${module}/${encodeURIComponent(t.topic)}">
          <div class="tc-head"><b>${esc(t.topic)}</b><span class="muted">${st.mastered}/${st.total}</span></div>
          ${progressBar(st.pct)}
          <div class="tc-foot muted">${st.weak ? `薄弱 ${st.weak} ｜ ` : ''}点击开始专项练习</div>
        </a>`;
      })
      .join('');

    app.innerHTML = `
      <div class="module-page">
        <div class="page-head">
          <a class="btn ghost" href="#/home">← 首页</a>
          <h2>${title}</h2>
          <a class="btn" href="#/review/${module}">复习</a>
        </div>
        <div class="filter-chips">
          <button class="chip ${filter === 'all' ? 'on' : ''}" data-filter="all">全部 ${counts.all}</button>
          <button class="chip ${filter === 'unstarted' ? 'on' : ''}" data-filter="unstarted">未开始 ${counts.unstarted}</button>
          <button class="chip ${filter === 'ongoing' ? 'on' : ''}" data-filter="ongoing">进行中 ${counts.ongoing}</button>
          <button class="chip ${filter === 'mastered' ? 'on' : ''}" data-filter="mastered">已掌握 ${counts.mastered}</button>
        </div>
        <div class="topic-grid">${cards || '<p class="muted">该筛选下暂无话题。</p>'}</div>
      </div>`;

    app.querySelectorAll('[data-filter]').forEach((b) =>
      b.addEventListener('click', () => {
        filter = b.dataset.filter;
        render();
      })
    );
  }
  render();
}

// ---------------- SEARCH ----------------
let searchIndex = null;
function buildSearchIndex() {
  if (searchIndex) return searchIndex;
  searchIndex = [];
  for (const module of ['synonym', 'hyponym']) {
    for (const g of Store.getGroups(module)) {
      const ng = Store.normalize(module, g);
      if (!ng.core) continue;
      const words = [
        { w: ng.core, m: ng.coreMeaning, isCore: true },
        ...(ng.repObjs || []).map((r) => ({ w: r.w, m: r.m, isCore: false })),
      ];
      for (const wd of words) {
        searchIndex.push({
          word: wd.w,
          meaning: wd.m,
          isCore: wd.isCore,
          groupId: ng.id,
          topic: ng.topic,
          type: ng.type,
          module,
          core: ng.core,
          coreMeaning: ng.coreMeaning,
          replacements: ng.repObjs.map((r) => r.w),
        });
      }
    }
  }
  return searchIndex;
}

export function initSearch() {
  const app = document.getElementById('app');
  app.innerHTML = `
    <div class="search-page">
      <div class="page-head">
        <a class="btn ghost" href="#/home">← 首页</a>
        <h2>全局搜索</h2><span></span>
      </div>
      <input class="search-input" id="q" placeholder="输入英文单词模糊搜索…" autofocus />
      <div id="results"></div>
    </div>`;
  const q = app.querySelector('#q');
  let initial = '';
  try {
    initial = sessionStorage.getItem('ielts-gq') || '';
    sessionStorage.removeItem('ielts-gq');
  } catch (e) {}
  if (initial) q.value = initial;
  q.addEventListener('input', debounce(() => runSearch(q.value.trim()), 150));
  runSearch(initial);
}

function runSearch(query) {
  const app = document.getElementById('app');
  const resultsEl = app.querySelector('#results');
  const idx = buildSearchIndex();
  const q = query.toLowerCase();
  let hits = q
    ? idx.filter((x) => x.word.toLowerCase().includes(q))
    : [];
  // dedupe by group+word keep first
  const seen = new Set();
  hits = hits.filter((h) => {
    const k = h.groupId + h.word.toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });

  if (!query) {
    resultsEl.innerHTML = `<p class="muted">输入单词开始搜索（覆盖内置 + 自定义词库）。</p>`;
    return;
  }
  if (hits.length === 0) {
    resultsEl.innerHTML = `
      <div class="card">
        <p>未收录「${esc(query)}」，可快速新增：</p>
        ${quickAddForm(query)}
      </div>`;
    bindQuickAdd(resultsEl, query);
    return;
  }

  const group = (h) => {
    const p = Store.getProgress(h.module, h.groupId);
    const fav = Store.isFavorite(h.word, h.groupId);
    return `
    <div class="card search-hit" data-group="${esc(h.groupId)}" data-module="${h.module}">
      <div class="sh-top">
        <span class="sh-word" data-speak="${esc(h.word)}">${esc(h.word)}</span>
        <button class="opt-tr" data-sh-tr>译</button>
        <button class="opt-fav ${fav ? 'on' : ''}" data-sh-fav>${
      fav ? '★' : '☆'
    }</button>
        <span class="sh-meaning" hidden>${esc(h.meaning)}</span>
        <span class="tag type">${TYPE_LABEL[h.type] || h.type}</span>
        <span class="tag src">${h.isCore ? '核心词' : '替换词'}</span>
        <span class="tag status" style="color:${STATUS_COLOR[p.status]}">${
      STATUS_LABEL[p.status]
    }</span>
      </div>
      <p class="muted">所属词组：${esc(h.core)}（${esc(h.coreMeaning)}）｜ 话题：${esc(
      h.topic
    )}</p>
      <p class="muted">全部替换词：${h.replacements.map(esc).join(' / ')}</p>
      <div class="actions">
        <button class="btn small" data-sh-review>加入复习</button>
        <button class="btn small" data-sh-add>添加替换词</button>
      </div>
    </div>`;
  };

  resultsEl.innerHTML = hits.slice(0, 60).map(group).join('');

  resultsEl.querySelectorAll('.search-hit').forEach((card) => {
    const gid = card.dataset.group;
    const mod = card.dataset.module;
    card.querySelector('[data-sh-tr]').addEventListener('click', () => {
      const m = card.querySelector('.sh-meaning');
      m.hasAttribute('hidden') ? m.removeAttribute('hidden') : m.setAttribute('hidden', '');
    });
    card.querySelector('[data-sh-fav]').addEventListener('click', (e) => {
      const f = Store.toggleFavorite(
        card.querySelector('.sh-word').textContent,
        card.querySelector('.sh-meaning').textContent,
        gid,
        Store.getGroup(mod, gid)?.topic || '',
        Store.getGroup(mod, gid)?.type || mod
      );
      e.target.textContent = f ? '★' : '☆';
      e.target.classList.toggle('on', f);
    });
    card.querySelector('[data-sh-review]').addEventListener('click', () => {
      Store.addToReview(mod, gid);
      window.toast('已加入今日复习');
    });
    card.querySelector('[data-sh-add]').addEventListener('click', () => {
      const val = prompt('输入新替换词 + 释义（用空格分隔，如：boost 提升）');
      if (!val) return;
      const [w, ...rest] = val.split(/\s+/);
      const m = rest.join(' ') || WORD_MEANINGS[w.toLowerCase()] || '';
      const ok = Store.addReplacement(mod, gid, w, m);
      window.toast(ok ? '已追加到本组出题池' : '该词已在本组中');
      runSearch(query);
    });
    card.addEventListener('click', (e) => {
      if (e.target.closest('[data-sh-tr],[data-sh-fav],[data-sh-review],[data-sh-add]'))
        return;
      location.hash = `#/group/${mod}/${encodeURIComponent(gid)}`;
    });
  });
}

function quickAddForm(query) {
  return `
    <div class="quick-add">
      <input id="qa-core" value="${esc(query)}" placeholder="核心词" />
      <input id="qa-mean" placeholder="中文释义（必填）" />
      <input id="qa-reps" placeholder="替换词 + 释义（多个用空格，如 boost 提升）" />
      <div class="row">
        <select id="qa-type">
          <option value="synonym">归入近义词库</option>
          <option value="hyponym">归入上下义库</option>
        </select>
        <input id="qa-topic" placeholder="所属话题（必填）" value="自定义" />
      </div>
      <button class="btn primary" id="qa-save">保存并可用</button>
    </div>`;
}
function bindQuickAdd(scope, query) {
  const btn = scope.querySelector('#qa-save');
  if (!btn) return;
  btn.addEventListener('click', () => {
    const core = scope.querySelector('#qa-core').value.trim();
    const mean = scope.querySelector('#qa-mean').value.trim();
    const repsRaw = scope.querySelector('#qa-reps').value.trim();
    const type = scope.querySelector('#qa-type').value;
    const topic = scope.querySelector('#qa-topic').value.trim() || '自定义';
    if (!core || !mean) return window.toast('核心词与释义必填');
    // check exists
    const existing = Store.getGroups(type).find(
      (g) => g.core.toLowerCase() === core.toLowerCase()
    );
    if (existing) {
      const add = prompt(`已有相关词组，是否追加替换词？输入新词+释义（如 boost 提升）`);
      if (add) {
        const [w, ...r] = add.split(/\s+/);
        Store.addReplacement(type, existing.id, w, r.join(' ') || '');
        window.toast('已追加替换词');
      }
      return;
    }
    const reps = repsRaw
      ? repsRaw.split(/\s+/).reduce((acc, tok, i, arr) => {
          if (i % 2 === 0) acc.push({ w: tok, m: arr[i + 1] || '' });
          return acc;
        }, [])
      : [];
    const id = Store.addCustomGroup(type, {
      topic,
      core,
      coreMeaning: mean,
      replacements: type === 'hyponym' ? reps : reps.map((r) => r.w),
      sentence: '',
      note: '',
      errorTip: '',
    });
    window.toast('已保存到自定义词库');
    location.hash = `#/group/${type}/${encodeURIComponent(id)}`;
  });
}

// ---------------- FAVORITES ----------------
export function initFavorites() {
  const app = document.getElementById('app');
  let typeFilter = 'all';
  let topicFilter = 'all';
  let q = '';

  const favs = Store.getFavorites();
  const topics = [...new Set(favs.map((f) => f.topic))];

  function render() {
    const filtered = favs.filter(
      (f) =>
        (typeFilter === 'all' || f.type === typeFilter) &&
        (topicFilter === 'all' || f.topic === topicFilter) &&
        (!q || f.word.toLowerCase().includes(q.toLowerCase()))
    );
    app.innerHTML = `
      <div class="fav-page">
        <div class="page-head">
          <a class="btn ghost" href="#/home">← 首页</a>
          <h2>收藏夹（${favs.length}）</h2><span></span>
        </div>
        <div class="row">
          <select id="f-type">
            <option value="all">全部类型</option>
            <option value="synonym">近义词</option>
            <option value="hyponym">上下义</option>
          </select>
          <select id="f-topic">
            <option value="all">全部话题</option>
            ${optionList(topics.map((t) => ({ value: t, label: t })), topicFilter)}
          </select>
          <input id="f-q" placeholder="搜索单词" value="${esc(q)}" />
        </div>
        <div class="actions">
          <button class="btn small" id="f-all-review">全部加入今日复习</button>
          <button class="btn small danger" id="f-clear">清空全部</button>
        </div>
        <div class="fav-list">
          ${
            filtered.length
              ? filtered
                  .map(
                    (f) => `
            <div class="card fav-item" data-group="${esc(f.groupId)}" data-module="${esc(
                      f.type === 'hyponym' ? 'hyponym' : 'synonym'
                    )}" data-word="${esc(f.word)}">
              <div class="fi-main">
                <span class="fi-word" data-speak="${esc(f.word)}">${esc(f.word)}</span>
                <span class="fi-mean">${esc(f.meaning)}</span>
              </div>
              <button class="opt-fav on" data-fi-fav>★</button>
              <div class="fi-foot muted">${esc(f.type === 'hyponym' ? '上下义' : '近义词')} ｜ ${
                      f.topic
                    }</div>
            </div>`
                  )
                  .join('')
              : '<p class="muted">暂无收藏。</p>'
          }
        </div>
      </div>`;

    app.querySelector('#f-type').addEventListener('change', (e) => {
      typeFilter = e.target.value;
      render();
    });
    app.querySelector('#f-topic').addEventListener('change', (e) => {
      topicFilter = e.target.value;
      render();
    });
    app.querySelector('#f-q').addEventListener('input', (e) => {
      q = e.target.value;
      render();
    });
    app.querySelector('#f-all-review').addEventListener('click', () => {
      filtered.forEach((f) =>
        Store.addToReview(f.type === 'hyponym' ? 'hyponym' : 'synonym', f.groupId)
      );
      window.toast('已加入今日复习');
    });
    app.querySelector('#f-clear').addEventListener('click', () => {
      if (!confirm('确定清空全部收藏？')) return;
      [...Store.getFavorites()].forEach((f) => Store.removeFavorite(f.word, f.groupId));
      render();
    });

    app.querySelectorAll('.fav-item').forEach((card) => {
      const gid = card.dataset.group;
      const mod = card.dataset.module;
      const word = card.dataset.word;
      card.querySelector('[data-fi-fav]').addEventListener('click', (e) => {
        e.stopPropagation();
        Store.removeFavorite(word, gid);
        render();
      });
      card.addEventListener('click', () => {
        location.hash = `#/group/${mod}/${encodeURIComponent(gid)}`;
      });
    });
  }
  render();
}

// ---------------- LIBRARY ----------------
export function initLibrary() {
  const app = document.getElementById('app');
  let tab = 'builtin';
  let module = 'synonym';
  let topic = Store.getTopics('synonym')[0]?.topic || '';

  function render() {
    app.innerHTML = `
      <div class="lib-page">
        <div class="page-head">
          <a class="btn ghost" href="#/home">← 首页</a>
          <h2>词库管理</h2><span></span>
        </div>
        <div class="tabs">
          <button class="tab ${tab === 'builtin' ? 'on' : ''}" data-tab="builtin">内置词库</button>
          <button class="tab ${tab === 'custom' ? 'on' : ''}" data-tab="custom">自定义词库</button>
          <button class="tab ${tab === 'backup' ? 'on' : ''}" data-tab="backup">数据备份</button>
        </div>
        <div id="tab-body"></div>
      </div>`;
    app.querySelectorAll('[data-tab]').forEach((b) =>
      b.addEventListener('click', () => {
        tab = b.dataset.tab;
        render();
      })
    );
    const body = app.querySelector('#tab-body');
    if (tab === 'builtin') renderBuiltin(body);
    else if (tab === 'custom') renderCustom(body);
    else renderBackup(body);
  }

  function renderBuiltin(body) {
    const topics = Store.getTopics(module);
    body.innerHTML = `
      <div class="row">
        <select id="lb-mod">
          <option value="synonym">近义词库</option>
          <option value="hyponym">上下义库</option>
        </select>
        <select id="lb-topic">${optionList(
          topics.map((t) => ({ value: t.topic, label: `${t.topic} (${t.count})` })),
          topic
        )}</select>
      </div>
      <p class="muted">内置词库仅可浏览，不可编辑。</p>
      <div class="group-list">${groupsOf(module, topic)}</div>`;
    body.querySelector('#lb-mod').addEventListener('change', (e) => {
      module = e.target.value;
      topic = Store.getTopics(module)[0]?.topic || '';
      render();
    });
    body.querySelector('#lb-topic').addEventListener('change', (e) => {
      topic = e.target.value;
      render();
    });
    bindGroupLinks(body);
  }

  function groupsOf(mod, top) {
    const gs = Store.getTopicGroups(mod, top);
    return gs
      .map((g) => {
        const p = Store.getProgress(mod, g.id);
        return `<a class="card group-row" href="#/group/${mod}/${encodeURIComponent(g.id)}">
          <div><b>${esc(g.core)}</b> <span class="muted">${esc(g.coreMeaning)}</span></div>
          <div class="muted">${g.repObjs.map((r) => esc(r.w)).join(' / ')}</div>
          <span class="tag status" style="color:${STATUS_COLOR[p.status]}">${
          STATUS_LABEL[p.status]
        }</span>
        </a>`;
      })
      .join('');
  }

  function bindGroupLinks(scope) {
    scope.querySelectorAll('a.group-row').forEach((a) =>
      a.addEventListener('click', () => {
        /* default anchor nav */
      })
    );
  }

  function renderCustom(body) {
    const groups = Store.state.custom[module] || [];
    body.innerHTML = `
      <div class="row">
        <select id="lc-mod">
          <option value="synonym">近义词库</option>
          <option value="hyponym">上下义库</option>
        </select>
        <button class="btn small" id="lc-add">+ 新增词组</button>
        <button class="btn small" id="lc-import">批量导入</button>
      </div>
      <div id="lc-forms"></div>
      <div class="group-list">
        ${
          groups.length
            ? groups
                .map(
                  (g) => `<div class="card group-row custom" data-id="${esc(g.id)}">
            <div><b>${esc(g.core)}</b> <span class="muted">${esc(g.coreMeaning)}</span></div>
            <div class="muted">${(g.replacements || [])
              .map((r) => (typeof r === 'string' ? r : r.w))
              .join(' / ')}</div>
            <div class="actions">
              <button class="btn small" data-edit>编辑</button>
              <button class="btn small danger" data-del>删除</button>
            </div>
          </div>`
                )
                .join('')
            : '<p class="muted">暂无自定义词组。</p>'
        }
      </div>`;
    body.querySelector('#lc-mod').addEventListener('change', (e) => {
      module = e.target.value;
      render();
    });
    body.querySelector('#lc-add').addEventListener('click', () =>
      showCustomForm(body, module, null)
    );
    body.querySelector('#lc-import').addEventListener('click', () => showImportForm(body, module));
    body.querySelectorAll('.custom').forEach((card) => {
      const id = card.dataset.id;
      card.querySelector('[data-edit]').addEventListener('click', () =>
        showCustomForm(body, module, id)
      );
      card.querySelector('[data-del]').addEventListener('click', () => {
        if (confirm('删除该自定义词组？')) {
          Store.deleteCustomGroup(module, id);
          render();
        }
      });
    });
  }

  function showCustomForm(body, mod, id) {
    const g = id ? Store.state.custom[mod].find((x) => x.id === id) : null;
    const forms = body.querySelector('#lc-forms');
    forms.innerHTML = `
      <div class="card">
        <h3>${g ? '编辑词组' : '新增词组'}</h3>
        <input id="cf-core" value="${g ? esc(g.core) : ''}" placeholder="核心词" />
        <input id="cf-mean" value="${g ? esc(g.coreMeaning) : ''}" placeholder="中文释义" />
        <input id="cf-reps" value="${
          g ? (g.replacements || []).map((r) => (typeof r === 'string' ? r : r.w)).join(' | ') : ''
        }" placeholder="替换词（用 | 分隔）" />
        <input id="cf-topic" value="${g ? esc(g.topic) : '自定义'}" placeholder="话题" />
        <input id="cf-sent" value="${g ? esc(g.sentence || '') : ''}" placeholder="真题原句（选填）" />
        <input id="cf-note" value="${g ? esc(g.note || '') : ''}" placeholder="考点备注（选填）" />
        <div class="actions">
          <button class="btn primary" id="cf-save">保存</button>
          <button class="btn" id="cf-cancel">取消</button>
        </div>
      </div>`;
    forms.querySelector('#cf-save').addEventListener('click', () => {
      const core = forms.querySelector('#cf-core').value.trim();
      const mean = forms.querySelector('#cf-mean').value.trim();
      const reps = forms.querySelector('#cf-reps').value.split('|').map((s) => s.trim()).filter(Boolean);
      const top = forms.querySelector('#cf-topic').value.trim() || '自定义';
      const sent = forms.querySelector('#cf-sent').value.trim();
      const note = forms.querySelector('#cf-note').value.trim();
      if (!core || !mean) return window.toast('核心词与释义必填');
      const obj = {
        topic: top,
        core,
        coreMeaning: mean,
        replacements: mod === 'hyponym' ? reps.map((w) => ({ w, m: '' })) : reps,
        sentence: sent,
        note,
        errorTip: '',
      };
      if (id) Store.updateCustomGroup(mod, id, obj);
      else Store.addCustomGroup(mod, obj);
      window.toast('已保存');
      render();
    });
    forms.querySelector('#cf-cancel').addEventListener('click', () => (forms.innerHTML = ''));
  }

  function showImportForm(body, mod) {
    const forms = body.querySelector('#lc-forms');
    forms.innerHTML = `
      <div class="card">
        <h3>批量导入</h3>
        <p class="muted">每行格式：核心词 | 中文释义 | 替换词1 | 替换词2 …</p>
        <textarea id="ci-text" rows="6" placeholder="increase | 增加 | rise | raise"></textarea>
        <input id="ci-topic" placeholder="导入话题（默认：自定义导入）" value="自定义导入" />
        <div class="actions">
          <button class="btn primary" id="ci-do">导入</button>
          <button class="btn" id="ci-cancel">取消</button>
        </div>
      </div>`;
    forms.querySelector('#ci-do').addEventListener('click', () => {
      const text = forms.querySelector('#ci-text').value;
      const top = forms.querySelector('#ci-topic').value.trim();
      const n = Store.importCustom(mod, text, top);
      window.toast(`已导入 ${n} 组`);
      render();
    });
    forms.querySelector('#ci-cancel').addEventListener('click', () => (forms.innerHTML = ''));
  }

  function renderBackup(body) {
    body.innerHTML = `
      <div class="card">
        <h3>导出</h3>
        <div class="actions">
          <button class="btn" id="bk-custom">导出自定义词库（文本）</button>
          <button class="btn" id="bk-all">导出全部数据（JSON）</button>
        </div>
        <h3>导入</h3>
        <p class="muted">粘贴此前导出的全部数据 JSON 以恢复。</p>
        <textarea id="bk-in" rows="5" placeholder='{"v":1,...}'></textarea>
        <div class="actions">
          <button class="btn primary" id="bk-restore">恢复数据</button>
        </div>
        <h3>危险操作</h3>
        <button class="btn danger" id="bk-reset">清空全部数据</button>
      </div>`;
    body.querySelector('#bk-custom').addEventListener('click', () => {
      const txt = Store.exportCustom('synonym') + '\n' + Store.exportCustom('hyponym');
      download('ielts-custom.txt', txt);
      window.toast('已导出自定义词库');
    });
    body.querySelector('#bk-all').addEventListener('click', () => {
      download('ielts-backup.json', Store.exportAll());
      window.toast('已导出全部数据');
    });
    body.querySelector('#bk-restore').addEventListener('click', () => {
      try {
        Store.importAll(body.querySelector('#bk-in').value);
        window.toast('数据已恢复');
        render();
      } catch (e) {
        window.toast('JSON 解析失败');
      }
    });
    body.querySelector('#bk-reset').addEventListener('click', () => {
      if (confirm('确定清空全部学习数据与收藏？此操作不可恢复。')) {
        Store.resetAll();
        window.toast('已清空');
        render();
      }
    });
  }

  render();
}

function download(name, text) {
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
}

// ---------------- SETTINGS ----------------
export function initSettings() {
  const app = document.getElementById('app');
  const s = Store.getSettings();
  const toggle = (key, label, desc) => `
    <div class="setting-row">
      <div><b>${label}</b><p class="muted">${desc}</p></div>
      <label class="switch">
        <input type="checkbox" data-set="${key}" ${s[key] ? 'checked' : ''}/>
        <span class="slider"></span>
      </label>
    </div>`;
  app.innerHTML = `
    <div class="settings-page">
      <div class="page-head">
        <a class="btn ghost" href="#/home">← 首页</a>
        <h2>设置</h2><span></span>
      </div>
      <div class="card">
        ${toggle('wordAudio', '单词发音', '点击单词播放标准英式发音')}
        ${toggle('sfx', '操作音效', '选中 / 答对 / 答错提示音')}
        ${toggle('vibrate', '答错震动', '移动端答错时震动（仅移动端）')}
        ${toggle('multiUnderline', '启用多划线模式', '同一句子多组核心词同时划线作答')}
        ${toggle('autoShowAnalysis', '自动显示答案解析', '提交后展示详细解析')}
        ${toggle('defaultShowMeaning', '默认显示单词释义', '关闭则需点击「译」显示')}
      </div>
      <div class="card warn">⚠️ 数据仅存于本机浏览器，清理缓存会丢失。</div>
    </div>`;
  app.querySelectorAll('[data-set]').forEach((cb) =>
    cb.addEventListener('change', () => Store.setSetting(cb.dataset.set, cb.checked))
  );
}

// ---------------- GROUP DETAIL ----------------
export function initGroup(params) {
  const app = document.getElementById('app');
  const module = params.module;
  const id = decodeURIComponent(params.id);
  const g = Store.getGroup(module, id);
  if (!g) {
    app.innerHTML = `<div class="card center"><p>未找到该词组。</p><a class="btn" href="#/home">返回</a></div>`;
    return;
  }
  const p = Store.getProgress(module, id);
  const settings = Store.getSettings();
  app.innerHTML = `
    <div class="group-page">
      <div class="page-head">
        <a class="btn ghost" href="#/home">← 首页</a>
        <h2>词组详情</h2>
        <a class="btn" href="#/library">词库</a>
      </div>
      <div class="card">
        <div class="gh-head">
          <span class="tag topic">${esc(g.topic)}</span>
          <span class="tag type">${TYPE_LABEL[g.type] || g.type}</span>
          <span class="tag src">${esc(g.source)}</span>
          <span class="tag status" style="color:${STATUS_COLOR[p.status]}">${
    STATUS_LABEL[p.status]
  }</span>
        </div>
        <h3 class="gh-core">${esc(g.core)} <span class="muted">${esc(g.coreMeaning)}</span></h3>
        <div class="gh-sentence">${esc(g.sentence)}</div>
        <p><b>全部替换词：</b></p>
        <div class="gh-reps">
          ${g.repObjs
            .map(
              (r) => `<span class="rep-chip" data-speak="${esc(r.w)}">${esc(r.w)} <i class="muted">${
                settings.defaultShowMeaning ? esc(r.m) : ''
              }</i></span>`
            )
            .join('')}
        </div>
        ${g.note ? `<p><b>考点：</b>${esc(g.note)}</p>` : ''}
        ${g.errorTip ? `<p><b>易错提醒：</b>${esc(g.errorTip)}</p>` : ''}
        <p class="muted">连对 ${p.streak}/3 ｜ 正确率 ${
    p.attempts ? Math.round((p.correct / p.attempts) * 100) : 0
  }%</p>
        <div class="actions">
          <a class="btn primary" href="#/practice/${module}/${encodeURIComponent(g.topic)}">开始练习本题</a>
          <button class="btn" id="g-review">加入复习</button>
        </div>
      </div>
    </div>`;
  app.querySelector('#g-review').addEventListener('click', () => {
    Store.addToReview(module, id);
    window.toast('已加入复习');
  });
}

// ---------------- REVIEW ENTRY ----------------
export function initReview(params) {
  const app = document.getElementById('app');
  const module = params.module;
  const list = Store.getReviewList(module);
  const title = module === 'synonym' ? '近义词替换' : '上下义替换';
  if (list.length === 0) {
    app.innerHTML = `<div class="card center">
      <h2>复习队列为空</h2>
      <p class="muted">练习后薄弱词组与到期词组会出现在这里。</p>
      <a class="btn primary" href="#/module/${module}">去练习</a></div>`;
    return;
  }
  const reasonCount = list.filter((r) => r.reason === '错题').length;
  app.innerHTML = `
    <div class="review-page">
      <div class="page-head">
        <a class="btn ghost" href="#/home">← 首页</a>
        <h2>${title} · 今日待复习</h2><span></span>
      </div>
      <div class="card">
        <p>待复习 <b>${list.length}</b> 组 ｜ 其中错题 <b style="color:${
          STATUS_COLOR.weak
        }">${reasonCount}</b></p>
        ${progressBar(Math.round((reasonCount / list.length) * 100), STATUS_COLOR.weak)}
        <div class="actions">
          <button class="btn primary" id="start-review">一键开始今日复习</button>
        </div>
      </div>
      <div class="group-list">
        ${list
          .map(
            (r) => `<a class="card group-row" href="#/group/${module}/${encodeURIComponent(
              r.groupId
            )}">
          <div><b>${esc(r.topic)}</b></div>
          <div class="tag status">${esc(r.reason)}</div>
        </a>`
          )
          .join('')}
      </div>
    </div>`;
  app.querySelector('#start-review').addEventListener('click', () => {
    location.hash = `#/practice/${module}/__review__`;
    // review mode handled by router
  });
}
