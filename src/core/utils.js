/**
 * Small dependency-free helpers shared across the app.
 * Everything here is pure or side-effect-isolated so it can be unit tested.
 */

/** Escape a string for safe interpolation into HTML text or attributes. */
export function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Escape a string so it can be embedded literally inside a RegExp. */
export function escapeRegExp(value) {
  return String(value ?? '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Monotonic-ish unique id. Stable enough for localStorage keys. */
let idCounter = 0;
export function uid(prefix = 'id') {
  idCounter += 1;
  const random = Math.random().toString(36).slice(2, 8);
  return `${prefix}_${Date.now().toString(36)}${idCounter.toString(36)}${random}`;
}

/** Trailing-edge debounce. */
export function debounce(fn, wait = 200) {
  let timer = null;
  const wrapped = (...args) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      fn(...args);
    }, wait);
  };
  wrapped.cancel = () => {
    if (timer) clearTimeout(timer);
    timer = null;
  };
  return wrapped;
}

/** Clamp a number into [min, max]. */
export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

/** Structured deep clone with a JSON fallback for older runtimes. */
export function deepClone(value) {
  if (typeof structuredClone === 'function') {
    try {
      return structuredClone(value);
    } catch {
      /* fall through to JSON clone for non-cloneable values */
    }
  }
  return JSON.parse(JSON.stringify(value));
}

/**
 * Turn any string into a URL/DOM-safe slug. Keeps Hebrew letters, since the
 * whole library is authored in Hebrew and transliterating would be lossy.
 */
export function slugify(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, '-')
    .replace(/[^\p{Letter}\p{Number}-]/gu, '')
    .replace(/-{2,}/g, '-')
    .replace(/^-|-$/g, '');
}

/** Normalize text for comparison: lowercase, strip Hebrew niqqud and punctuation. */
export function normalizeText(value) {
  return String(value ?? '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[֑-ׇ]/g, '') // Hebrew cantillation + niqqud
    .replace(/[̀-ͯ]/g, '') // Latin combining marks
    .replace(/["'`׳״‘’“”]/g, '')
    .trim();
}

/** Split text into searchable tokens across Hebrew, Latin and digits. */
export function tokenize(value) {
  const normalized = normalizeText(value);
  if (!normalized) return [];
  return normalized.split(/[^\p{Letter}\p{Number}]+/u).filter(Boolean);
}

/** `he` locale date, falling back to ISO when Intl is unavailable. */
export function formatDate(timestamp, locale = 'he-IL') {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return '';
  try {
    return new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(date);
  } catch {
    return date.toISOString().slice(0, 10);
  }
}

/** Human readable "3 days ago" style label. */
export function formatRelative(timestamp, strings) {
  const diff = Date.now() - Number(timestamp);
  const minute = 60_000;
  const hour = 60 * minute;
  const day = 24 * hour;
  if (diff < minute) return strings.justNow;
  if (diff < hour) return strings.minutesAgo(Math.floor(diff / minute));
  if (diff < day) return strings.hoursAgo(Math.floor(diff / hour));
  if (diff < 30 * day) return strings.daysAgo(Math.floor(diff / day));
  return formatDate(timestamp);
}

/** Group an array into a Map keyed by the result of `keyFn`. */
export function groupBy(items, keyFn) {
  const map = new Map();
  for (const item of items) {
    const key = keyFn(item);
    const bucket = map.get(key);
    if (bucket) bucket.push(item);
    else map.set(key, [item]);
  }
  return map;
}

/** Stable sort descending by a numeric selector, tie-broken by a label. */
export function sortByCount(entries, countFn, labelFn = () => '') {
  return [...entries].sort((a, b) => {
    const delta = countFn(b) - countFn(a);
    if (delta !== 0) return delta;
    return String(labelFn(a)).localeCompare(String(labelFn(b)), 'he');
  });
}
