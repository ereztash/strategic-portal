/** Keyboard shortcuts: the global handler and the help dialog. */

import { h } from './dom.js';
import { t } from '../core/i18n.js';
import { openModal, isModalOpen } from './modal.js';

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform ?? '');
const MOD = isMac ? '⌘' : 'Ctrl';

export const SHORTCUTS = [
  { keys: [MOD, 'K'], labelKey: 'shortcuts.palette' },
  { keys: ['/'], labelKey: 'shortcuts.search' },
  { keys: [MOD, 'Enter'], labelKey: 'shortcuts.generate' },
  { keys: [MOD, 'Shift', 'C'], labelKey: 'shortcuts.copy' },
  { keys: [MOD, 'S'], labelKey: 'shortcuts.save' },
  { keys: ['G', 'H'], labelKey: 'shortcuts.home' },
  { keys: ['?'], labelKey: 'shortcuts.help' },
  { keys: ['Esc'], labelKey: 'shortcuts.close' },
];

export function openShortcutsDialog() {
  return openModal({
    title: t('shortcuts.title'),
    body: SHORTCUTS.map((shortcut) =>
      h(
        'div',
        { class: 'shortcut-row' },
        h('span', null, t(shortcut.labelKey)),
        h('span', { style: { display: 'flex', gap: '4px' } }, ...shortcut.keys.map((key) => h('kbd', null, key))),
      ),
    ),
  });
}

/** True when the event came from somewhere typing should win. */
function isTypingTarget(target) {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
}

/**
 * Install the global handler.
 * @param {{ onPalette: Function, onSearch: Function, onHome: Function, onGenerate: Function, onCopy: Function, onSave: Function }} handlers
 */
export function installShortcuts(handlers) {
  let awaitingG = false;

  function onKeyDown(event) {
    const mod = event.metaKey || event.ctrlKey;
    const typing = isTypingTarget(event.target);

    if (mod && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      handlers.onPalette?.();
      return;
    }

    if (isModalOpen()) return;

    if (mod && event.key === 'Enter') {
      event.preventDefault();
      handlers.onGenerate?.();
      return;
    }
    if (mod && event.shiftKey && event.key.toLowerCase() === 'c') {
      event.preventDefault();
      handlers.onCopy?.();
      return;
    }
    if (mod && event.key.toLowerCase() === 's') {
      event.preventDefault();
      handlers.onSave?.();
      return;
    }

    if (typing || mod || event.altKey) return;

    if (event.key === '/') {
      event.preventDefault();
      handlers.onSearch?.();
      return;
    }
    if (event.key === '?') {
      event.preventDefault();
      openShortcutsDialog();
      return;
    }
    // Two-key sequence: "g" then "h" goes home, the convention people already
    // know from GitHub and Linear.
    if (event.key.toLowerCase() === 'g') {
      awaitingG = true;
      setTimeout(() => {
        awaitingG = false;
      }, 900);
      return;
    }
    if (awaitingG && event.key.toLowerCase() === 'h') {
      awaitingG = false;
      handlers.onHome?.();
    }
  }

  document.addEventListener('keydown', onKeyDown);
  return () => document.removeEventListener('keydown', onKeyDown);
}
