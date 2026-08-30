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
 * @param {{ tone?: 'info'|'success'|'error', duration?: number,
 *           action?: Function, actionLabel?: string }} options
 *        `action` makes the toast clickable and keeps it on screen until used.
 */
export function toast(message, options = {}) {
  const { tone = 'info', duration = 2600, action, actionLabel } = options;
  const host = ensureRegion();
  const element = h(
    'div',
    { class: 'toast', dataset: { tone, actionable: action ? 'true' : undefined } },
    icon(TONE_ICON[tone] ?? 'info', { size: 18 }),
    h('span', null, message),
    action ? h('span', { class: 'toast-action' }, actionLabel ?? '') : null,
  );
  if (action) {
    element.setAttribute('role', 'button');
    element.setAttribute('tabindex', '0');
  }
  host.append(element);

  const remove = () => {
    element.dataset.leaving = 'true';
    setTimeout(() => element.remove(), 200);
  };
  // An actionable toast stays until it is used - it is the only route to the
  // thing it offers, so timing it out would silently drop the offer.
  const timer = action ? null : setTimeout(remove, duration);
  const activate = () => {
    if (timer) clearTimeout(timer);
    remove();
    action?.();
  };
  element.addEventListener('click', activate);
  element.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      activate();
    }
  });
  return remove;
}

/** Clear every visible toast, e.g. on navigation. */
export function clearToasts() {
  if (region) replace(region);
}
