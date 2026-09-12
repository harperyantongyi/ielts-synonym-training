// Practice engine: topic-driven sequential training + review mode.
// Handles single & multi-underline questions, judging, analysis, mastery recording.
import { Store } from '../core/store.js';
import { Audio } from '../core/audio.js';
import { esc, STATUS_LABEL, STATUS_COLOR } from '../core/util.js';

const SESSION_KEY = 'ielts-practice-session';
let session = null; // {module, mode, topic, queue, index}

function persistSession() {
  try {
    if (session && session.mode === 'topic')
      localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    else localStorage.removeItem(SESSION_KEY);
  } catch (e) {}
}

function loadSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Underline one or more core words inside the sentence.
function underlineSentence(sentence, cores) {
  if (!sentence) return '';
  const sorted = [...cores].sort((a, b) => b.length - a.length);
  const re = new RegExp(
    sorted.map((c) => escapeRegex(c)).join('|'),
    'gi'
  );
  return esc(sentence).replace(re, (m) => `<u class="ulx">${m}</u>`);
}

function setEquals(a, b) {
  if (a.length !== b.length) return false;
  const sa = new Set(a.map((x) => x.toLowerCase()));
  const sb = new Set(b.map((x) => x.toLowerCase()));
  for (const x of sa) if (!sb.has(x)) return false;
  return true;
}

export function init(params) {
  const app = document.getElementById('app');
  const module = params.module;
  const isReview = params.review || decodeURIComponent(params.topic || '') === '__review__';
  let queue, mode, topic;

  if (isReview) {
    mode = 'review';
    queue = Store.getReviewList(module).map((r) => r.groupId);
    topic = null;
    if (queue.length === 0) {
      app.innerHTML = `<div class="card center"><h2>暂无待复习内容</h2>
        <p class="muted">去练习一些词组，或把薄弱词组加入复习吧。</p>
        <button class="btn primary" data-link="#/module/${module}">返回模块</button></div>`;
      return;
    }
  } else {
    mode = 'topic';
    topic = decodeURIComponent(params.topic);
    queue = Store.getTopicGroups(module, topic).map((g) => g.id);
    const prev = loadSession();
    let index = 0;
    if (prev && prev.module === module && prev.topic === topic && prev.queue.length === queue.length) {
      index = Math.min(prev.index || 0, queue.length - 1);
    }
    session = { module, mode, topic, queue, index };
  }
  if (mode === 'topic') session = { module, mode, topic, queue, index: session ? session.index : 0 };
  if (mode === 'review')
    session = { module, mode, topic: null, queue, index: 0 };

  renderQuestion();
}

function currentGroup() {
  const id = session.queue[session.index];
  if (session.mode === 'review') {
    // review items may reference multi-demo synthetic ids? No, review only real groups.
    return Store.getGroup(session.module, id);
  }
  return Store.getGroup(session.module, id);
}

function renderQuestion() {
  const app = document.getElementById('app');
  const module = session.module;
  const group = currentGroup();
  app.dataset.gid = group.id;
  app.dataset.mod = module;
  if (!group) {
    app.innerHTML = `<div class="card center"><p>没有可练习的内容。</p>
      <button class="btn" data-link="#/module/${module}">返回</button></div>`;
    return;
  }

  // Build question (single or multi)
  const question =
    group.multi
      ? Store.buildMultiQuestion(group)
      : Store.buildQuestion(module, group);

  session._question = question;
  session._group = group;

  const total = session.queue.length;
  const idx = session.index + 1;
  // topic accuracy
  let acc = 0;
  if (session.mode === 'topic') {
    const gs = Store.getTopicGroups(module, session.topic);
    let att = 0,
      cor = 0;
    gs.forEach((g) => {
      const p = Store.getProgress(module, g.id);
      att += p.attempts;
      cor += p.correct;
    });
    acc = att ? Math.round((cor / att) * 100) : 0;
  }

  const title = session.mode === 'review' ? '复习模式' : session.topic;
  const showMeaningDefault = Store.getSettings().defaultShowMeaning;

  // Active underline (for multi, step through)
  const activeIdx = session._activeIdx || 0;
  const ul = question.underlines[activeIdx];

  const optionsHtml = ul.options
    .map((o, i) => optionChip(o, i, showMeaningDefault))
    .join('');

  const showTrans = session._showTrans ? 'show' : '';
  const transText = session._showTrans
    ? `划线词「${esc(ul.core)}」释义：${esc(ul.meaning)}（模拟例句，无官方译文）`
    : '';

  app.innerHTML = `
    <div class="practice">
      <div class="progress-top">
        <div class="pt-left">当前话题：<b>${esc(title)}</b> ｜ 第 ${idx} 组 / 共 ${total} 组</div>
        <div class="pt-right">${
          session.mode === 'topic' ? `本话题正确率 <b>${acc}%</b>` : '复习队列'
        }</div>
      </div>
      <div class="bar"><div class="bar-fill" style="width:${Math.round(
        (idx / total) * 100
      )}%"></div></div>

      <div class="card qtopic">
        <div class="q-head">
          <span class="tag topic">${esc(question.topic)}</span>
          <span class="tag src">来源：${esc(question.source)}</span>
          <span class="spacer"></span>
          <button class="icon-btn" id="speak-sentence" aria-label="播放整句发音">🔊</button>
          <button class="icon-btn" id="toggle-trans" aria-label="显示/隐藏整句译文">译文</button>
        </div>
        <p class="sentence" id="sentence">${underlineSentence(
          question.sentence,
          question.underlines.map((u) => u.core)
        )}</p>
        <div class="trans ${showTrans}" id="trans">${transText}</div>
        ${
          question.multi
            ? `<div class="multi-hint">多划线模式：按顺序作答（${activeIdx + 1}/${
                question.underlines.length
              }）</div>`
            : ''
        }
      </div>

      <div class="options" id="options">${optionsHtml}</div>

      <div class="actions">
        <button class="btn primary" id="submit-btn">提交答案</button>
      </div>

      <div id="analysis"></div>

      <div class="nav-btns">
        <button class="btn" id="prev-btn" ${session.index === 0 ? 'disabled' : ''}>上一组</button>
        <button class="btn" id="next-btn" ${
          session.index >= total - 1 ? 'disabled' : ''
        }>下一组</button>
      </div>
      <p class="hint muted">提示：仅可通过「上一组 / 下一组」按钮切换题目。</p>
    </div>
  `;

  bindQuestionEvents(question, activeIdx);
}

function optionChip(o, i, showMeaning) {
  const fav = Store.isFavorite(o.text, session._group.id);
  return `
    <div class="opt ${showMeaning ? 'meaning-open' : ''}" data-opt="${i}" role="button" tabindex="0" aria-pressed="false">
      <span class="opt-word" data-speak="${esc(o.text)}">${esc(o.text)}</span>
      <button class="opt-tr" data-tr="${i}" aria-label="显示释义">译</button>
      <button class="opt-fav ${fav ? 'on' : ''}" data-fav="${i}" aria-label="收藏">${
    fav ? '★' : '☆'
  }</button>
      <span class="opt-meaning" ${showMeaning ? '' : 'hidden'}>${esc(o.meaning)}</span>
    </div>`;
}

function bindQuestionEvents(question, activeIdx) {
  const app = document.getElementById('app');
  session._selected = session._selected || new Set();

  const optionsEl = app.querySelector('#options');

  optionsEl.addEventListener('click', (e) => {
    const tr = e.target.closest('[data-tr]');
    const fav = e.target.closest('[data-fav]');
    const optEl = e.target.closest('.opt');
    if (!optEl) return;
    const i = Number(optEl.dataset.opt);
    const o = question.underlines[activeIdx].options[i];

    if (tr) {
      const m = optEl.querySelector('.opt-meaning');
      if (m.hasAttribute('hidden')) {
        m.removeAttribute('hidden');
        optEl.classList.add('meaning-open');
      } else {
        m.setAttribute('hidden', '');
        optEl.classList.remove('meaning-open');
      }
      return;
    }
    if (fav) {
      const isFav = Store.toggleFavorite(
        o.text,
        o.meaning,
        session._group.id,
        session._group.topic,
        session._group.type
      );
      fav.textContent = isFav ? '★' : '☆';
      fav.classList.toggle('on', isFav);
      return;
    }
    // main: toggle selection + speak
    if (session._submitted) return;
    const key = o.text;
    if (session._selected.has(key)) session._selected.delete(key);
    else session._selected.add(key);
    optEl.classList.toggle('selected', session._selected.has(key));
    optEl.setAttribute('aria-pressed', session._selected.has(key) ? 'true' : 'false');
    Audio.sfx('click');
    Audio.speak(o.text);
  });

  optionsEl.addEventListener('keydown', (e) => {
    if ((e.key === 'Enter' || e.key === ' ') && e.target.classList.contains('opt')) {
      e.preventDefault();
      e.target.click();
    }
  });

  app.querySelector('#speak-sentence').addEventListener('click', () => {
    Audio.speak(question.sentence.replace(/[".“”]/g, ''));
  });

  app.querySelector('#toggle-trans').addEventListener('click', () => {
    session._showTrans = !session._showTrans;
    const t = app.querySelector('#trans');
    if (session._showTrans) {
      const ul = question.underlines[activeIdx];
      t.textContent = `划线词「${ul.core}」释义：${ul.meaning}（模拟例句，无官方译文）`;
      t.classList.add('show');
    } else {
      t.classList.remove('show');
    }
  });

  app.querySelector('#submit-btn').addEventListener('click', () => submitCurrent(activeIdx));
  app.querySelector('#prev-btn').addEventListener('click', () => {
    if (session.index > 0) {
      session.index--;
      session._selected = new Set();
      session._submitted = false;
      session._activeIdx = 0;
      persistSession();
      renderQuestion();
    }
  });
  app.querySelector('#next-btn').addEventListener('click', () => {
    if (session.index < session.queue.length - 1) {
      session.index++;
      session._selected = new Set();
      session._submitted = false;
      session._activeIdx = 0;
      persistSession();
      renderQuestion();
    }
  });
}

function submitCurrent(activeIdx) {
  const question = session._question;
  const ul = question.underlines[activeIdx];
  const selected = [...session._selected];
  const allCorrect = setEquals(selected, ul.correctWords);

  // Mark options
  const optionsEl = document.getElementById('options');
  ul.options.forEach((o, i) => {
    const el = optionsEl.querySelector(`.opt[data-opt="${i}"]`);
    if (!el) return;
    const isSel = selected.some((s) => s.toLowerCase() === o.text.toLowerCase());
    el.classList.remove('selected');
    if (o.correct) el.classList.add('correct');
    if (isSel && !o.correct) el.classList.add('wrong');
    if (o.correct && !isSel) el.classList.add('missed');
  });

  Audio.sfx(allCorrect ? 'correct' : 'wrong');
  if (allCorrect) {
    // highlight replaceable words next to underline
    const sEl = document.getElementById('sentence');
    sEl.querySelectorAll('.ulx').forEach((u) => {
      if (u.textContent.toLowerCase() === ul.core.toLowerCase())
        u.classList.add('ulx-done');
    });
  }

  session._submitted = true;
  document.getElementById('submit-btn').disabled = true;

  // Record progress (per underline / group)
  const recId =
    question.multi && question.syntheticIds
      ? question.syntheticIds[activeIdx]
      : session._group.id;
  const recModule = question.multi ? 'synonym' : session.module;
  const p = Store.recordAnswer(recModule, recId, allCorrect, {
    fromReview: session.mode === 'review',
  });

  renderAnalysis(question, ul, allCorrect, p, activeIdx);
}

function renderAnalysis(question, ul, allCorrect, p, activeIdx) {
  const app = document.getElementById('app');
  const analysisEl = app.querySelector('#analysis');
  if (!analysisEl) return;

  const optExpl = ul.options
    .map((o) => {
      const cls = o.correct ? 'ok' : 'no';
      const mark = o.correct ? '✅' : '❌';
      const reason = o.correct
        ? `语义场对应：${esc(ul.meaning)}`
        : `不选原因：${reasonFor(o, ul)}`;
      return `<li class="${cls}"><b>${esc(o.text)}</b> <span class="muted">${esc(
        o.meaning
      )}</span> — ${mark} ${reason}</li>`;
    })
    .join('');

  const isLast = !question.multi || activeIdx >= question.underlines.length - 1;
  const nextUnderlineBtn = question.multi && !isLast
    ? `<button class="btn primary" id="next-ul">下一划线（${activeIdx + 2}/${
        question.underlines.length
      }）</button>`
    : '';

  analysisEl.innerHTML = `
    <div class="card analysis">
      <h3 class="${allCorrect ? 'ok' : 'no'}">${
    allCorrect ? '回答正确 🎉' : '回答错误，再接再厉'
  }</h3>
      <p><b>划线词：</b>${esc(ul.core)} ｜ <b>本组全部替换词：</b>${ul.correctWords
        .map((w) => esc(w))
        .join(' / ')}</p>
      <p class="muted">语境提示：本句中常用替换为 ${ul.correctWords
        .map((w) => esc(w))
        .join(' / ')}（仅参考，不影响判定）</p>
      <ul class="opt-expl">${optExpl}</ul>
      ${question.note ? `<p><b>考点：</b>${esc(question.note)}</p>` : ''}
      ${question.errorTip ? `<p><b>易错提醒：</b>${esc(question.errorTip)}</p>` : ''}
      <p><b>本组状态：</b><span style="color:${
        STATUS_COLOR[p.status]
      }">${STATUS_LABEL[p.status]}</span> ｜ 连对 ${p.streak} / 3 ｜ 正确率 ${
    p.attempts ? Math.round((p.correct / p.attempts) * 100) : 0
  }%</p>
      ${nextUnderlineBtn}
    </div>`;

  if (nextUnderlineBtn) {
    analysisEl.querySelector('#next-ul').addEventListener('click', () => {
      session._activeIdx = activeIdx + 1;
      session._selected = new Set();
      session._submitted = false;
      renderQuestion();
    });
  }

  if (isLast) {
    // show topic-complete control when finishing last group
    const isLastGroup = session.index >= session.queue.length - 1;
    if (isLastGroup && session.mode === 'topic') {
      maybeShowTopicComplete();
    } else if (isLastGroup && session.mode === 'review') {
      showReviewComplete();
    }
  }
}

function reasonFor(o, ul) {
  // crude classification of distractor type
  return '跨语义场干扰项';
}

function maybeShowTopicComplete() {
  const module = session.module;
  const topic = session.topic;
  const gs = Store.getTopicGroups(module, topic);
  let mastered = 0;
  gs.forEach((g) => {
    if (Store.getProgress(module, g.id).status === 'mastered') mastered++;
  });
  const acc = (() => {
    let att = 0,
      cor = 0;
    gs.forEach((g) => {
      const p = Store.getProgress(module, g.id);
      att += p.attempts;
      cor += p.correct;
    });
    return att ? Math.round((cor / att) * 100) : 0;
  })();
  Audio.sfx('win');

  const topics = Store.getTopics(module).map((t) => t.topic);
  const curIdx = topics.indexOf(topic);
  const nextTopic = topics[curIdx + 1];

  const app = document.getElementById('app');
  const complete = document.createElement('div');
  complete.id = 'complete-card';
  complete.className = 'card center complete';
  complete.innerHTML = `
    <h2>🎉 话题「${esc(topic)}」完成！</h2>
    <p>已掌握 ${mastered} / ${gs.length} 组 ｜ 本话题正确率 ${acc}%</p>
    <div class="actions">
      ${
        nextTopic
          ? `<button class="btn primary" id="next-topic" data-link="#/practice/${module}/${encodeURIComponent(
              nextTopic
            )}">进入下一话题：${esc(nextTopic)}</button>`
          : ''
      }
      <button class="btn" data-link="#/module/${module}">返回模块</button>
      <button class="btn" data-link="#/review/${module}">去复习</button>
    </div>`;
  app.appendChild(complete);
  localStorage.removeItem(SESSION_KEY);
}

function showReviewComplete() {
  Audio.sfx('win');
  const app = document.getElementById('app');
  const el = document.createElement('div');
  el.id = 'complete-card';
  el.className = 'card center complete';
  el.innerHTML = `<h2>✅ 复习完成！</h2>
    <p class="muted">继续保持，薄弱点已被记录。</p>
    <div class="actions">
      <button class="btn" data-link="#/module/${session.module}">返回模块</button>
      <button class="btn" data-link="#/home">返回首页</button>
    </div>`;
  app.appendChild(el);
}
