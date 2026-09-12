// Small DOM / helper utilities shared across views.
export const DAY = 86400000;

export function esc(s) {
  if (s == null) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function pickN(arr, n) {
  return shuffle(arr).slice(0, n);
}

export function uid(prefix = 'id') {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

export function todayKey(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function daysBetween(a, b) {
  return Math.floor((b - a) / DAY);
}

export function debounce(fn, ms = 200) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

export const STATUS_LABEL = {
  unlearned: '未学习',
  beginner: '初学',
  intermediate: '进阶',
  mastered: '掌握',
  weak: '薄弱',
};

export const STATUS_COLOR = {
  unlearned: '#9ca3af',
  beginner: '#3b82f6',
  intermediate: '#8b5cf6',
  mastered: '#16a34a',
  weak: '#ef4444',
};

// Build an <option> set from a list of {value,label}
export function optionList(items, selected) {
  return items
    .map(
      (it) =>
        `<option value="${esc(it.value)}" ${it.value === selected ? 'selected' : ''}>${esc(
          it.label
        )}</option>`
    )
    .join('');
}

// Convert a group's replacements (string[] or {w,m}[]) into {w,m}[]
export function toRepObjs(replacements, fallbackMeaning, meaningMap) {
  if (!replacements) return [];
  return replacements.map((r) => {
    if (typeof r === 'string') {
      return { w: r, m: (meaningMap && meaningMap[r.toLowerCase()]) || fallbackMeaning };
    }
    return { w: r.w, m: r.m || fallbackMeaning };
  });
}
