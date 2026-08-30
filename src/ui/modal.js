/**
 * Accessible dialog helper: focus is moved in, trapped while open, and
 * restored to whatever opened the dialog on close.
 */

import { h, trapFocus } from './dom.js';
import { icon } from './icons.js';
import { t } from '../core/i18n.js';

let openCount = 0;

/**
 * @param {{ title: string, body: Node|Node[], actions?: Node[], onClose?: Function, width?: string }} config
 * @returns {{ close: Function, element: HTMLElement }}
 */
export function openModal(config) {
  const { title, body, actions = [], onClose, dismissible = true } = config;
  const previouslyFocused = document.activeElement;

  const dialog = h(
    'div',
    { class: 'modal', role: 'dialog', 'aria-modal': 'true', 'aria-label': title },
    h(
      'div',
      { class: 'modal-head' },
      h('h2', { class: 'modal-title' }, title),
      dismissible
        ? h('button', { class: 'icon-btn', type: 'button', 'aria-label': t('common.close'), onClick: () => close() }, icon('close', { size: 18 }))
        : null,
    ),
    h('div', { class: 'modal-body' }, body),
    actions.length ? h('div', { class: 'modal-foot' }, actions) : null,
  );

  const overlay = h(
    'div',
    {
      class: 'overlay',
      dataset: { align: 'center' },
      onClick: (event) => {
        if (dismissible && event.target === overlay) close();
      },
    },
    dialog,
  );

  function onKeyDown(event) {
    if (event.key === 'Escape' && dismissible) {
      event.stopPropagation();
      close();
    }
    trapFocus(dialog, event);
  }

  function close() {
    if (!overlay.isConnected) return;
    overlay.remove();
    document.removeEventListener('keydown', onKeyDown, true);
    openCount = Math.max(0, openCount - 1);
    if (openCount === 0) document.body.style.removeProperty('overflow');
    if (previouslyFocused instanceof HTMLElement) previouslyFocused.focus();
    onClose?.();
  }

  document.addEventListener('keydown', onKeyDown, true);
  document.body.append(overlay);
  openCount += 1;
  document.body.style.overflow = 'hidden';

  const target = dialog.querySelector('input, textarea, select, button.btn-primary, button');
  target?.focus();

  return { close, element: dialog };
}

/** Promise-based confirmation. Resolves true when confirmed. */
export function confirmDialog({ title, message, confirmLabel, danger = false }) {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (value) => {
      if (settled) return;
      settled = true;
      resolve(value);
    };

    const modal = openModal({
      title,
      body: h('p', null, message),
      actions: [
        h('button', { class: 'btn', type: 'button', onClick: () => { finish(false); modal.close(); } }, t('common.cancel')),
        h(
          'button',
          {
            class: `btn ${danger ? 'btn-danger' : 'btn-primary'}`,
            type: 'button',
            onClick: () => { finish(true); modal.close(); },
          },
          confirmLabel ?? t('common.confirm'),
        ),
      ],
      onClose: () => finish(false),
    });
  });
}

/** True while any dialog is open, so global shortcuts can stand down. */
export function isModalOpen() {
  return openCount > 0;
}
