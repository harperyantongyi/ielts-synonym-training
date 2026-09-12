// App bootstrap: hash router, bottom navigation, global audio + toast.
import { Store } from './core/store.js';
import { Audio } from './core/audio.js';
import { initHome, initModule, initSearch, initFavorites, initLibrary, initSettings, initGroup, initReview } from './views/browse.js';
import { init as initPractice } from './views/practice.js';

const routes = [
  { re: /^#?\/?$/, fn: () => initHome(), nav: 'home' },
  { re: /^#\/home$/, fn: () => initHome(), nav: 'home' },
  { re: /^#\/module\/(\w+)$/, fn: (m) => initModule({ module: m[1] }), nav: 'library' },
  { re: /^#\/practice\/(\w+)\/(.+)$/, fn: (m) => initPractice({ module: m[1], topic: m[2] }), nav: '' },
  { re: /^#\/review\/(\w+)$/, fn: (m) => initReview({ module: m[1] }), nav: 'library' },
  { re: /^#\/search$/, fn: () => initSearch(), nav: 'search' },
  { re: /^#\/favorites$/, fn: () => initFavorites(), nav: 'favorites' },
  { re: /^#\/library$/, fn: () => initLibrary(), nav: 'library' },
  { re: /^#\/settings$/, fn: () => initSettings(), nav: 'settings' },
  { re: /^#\/group\/(\w+)\/(.+)$/, fn: (m) => initGroup({ module: m[1], id: m[2] }), nav: 'library' },
];

function router() {
  const hash = location.hash || '#/home';
  const favCount = document.getElementById('fav-count');
  if (favCount) favCount.textContent = String(Store.getFavorites().length);
  for (const r of routes) {
    const m = hash.match(r.re);
    if (m) {
      try {
        r.fn(m);
      } catch (e) {
        console.error('View error:', e);
        document.getElementById('app').innerHTML =
          `<div class="card center"><h2>出错了</h2><p class="muted">${String(
            e && e.message
          )}</p><a class="btn" href="#/home">返回首页</a></div>`;
      }
      setActiveNav(r.nav);
      window.scrollTo(0, 0);
      return;
    }
  }
  initHome();
  setActiveNav('home');
}

// Global search box -> jump to search page (carry query)
const gSearch = document.getElementById('global-search');
if (gSearch) {
  gSearch.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      const q = gSearch.value.trim();
      try {
        sessionStorage.setItem('ielts-gq', q);
      } catch (err) {}
      location.hash = '#/search';
    }
  });
}

function setActiveNav(nav) {
  document.querySelectorAll('.nav-btn').forEach((b) => {
    b.classList.toggle('active', b.dataset.nav === nav);
  });
}

// Global: navigation via [data-link] buttons (used by practice completion cards, etc.)
document.addEventListener('click', (e) => {
  const link = e.target.closest('[data-link]');
  if (link) {
    e.preventDefault();
    location.hash = link.getAttribute('data-link');
    return;
  }
});

// Global: pronunciation for any [data-speak] not handled locally by practice options.
document.addEventListener('click', (e) => {
  const sp = e.target.closest('[data-speak]');
  if (sp && !e.target.closest('.opt')) {
    Audio.speak(sp.getAttribute('data-speak'));
  }
});

// Toast
window.toast = function (msg) {
  let t = document.getElementById('toast');
  if (!t) {
    t = document.createElement('div');
    t.id = 'toast';
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.remove('show'), 1800);
};

// Boot
Audio.preload();
window.Store = Store; // exposed for debugging / automated smoke tests
window.addEventListener('hashchange', router);
router();
