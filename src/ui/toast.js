/** Transient status messages, announced to screen readers via aria-live. */

import { h, replace } from './dom.js';
import { icon } from './icons.js';

const TONE_ICON = { success: 'checkCircle', error: 'alert', info: 'info' };
let region = null;

function ensureRegion() {
  if (region?.isConnected) return region;
  region = h('div', {
    class: 'toast-region',
    role: 'status',
    'aria-live': 'polite',
    'aria-atomic': 'false',
  });
  document.body.append(region);
  return region;
}

/**
 * Show a toast.
 * @param {string} message
 * @param {{ tone?: 'info'|'success'|'error', duration?: number }} options
 */
export function toast(message, options = {}) {
  const { tone = 'info', duration = 2600 } = options;
  const host = ensureRegion();
  const element = h(
    'div',
    { class: 'toast', dataset: { tone } },
    icon(TONE_ICON[tone] ?? 'info', { size: 18 }),
    h('span', null, message),
  );
  host.append(element);

  const remove = () => {
    element.dataset.leaving = 'true';
    setTimeout(() => element.remove(), 200);
  };
  const timer = setTimeout(remove, duration);
  element.addEventListener('click', () => {
    clearTimeout(timer);
    remove();
  });
  return remove;
}

/** Clear every visible toast, e.g. on navigation. */
export function clearToasts() {
  if (region) replace(region);
}
