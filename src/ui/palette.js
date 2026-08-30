/**
 * Command palette (Ctrl/Cmd+K).
 *
 * Searches engines, categories and actions in one list, with arrow-key
 * navigation. It is the fastest path back to an engine you use weekly, which
 * a three-level click-through never is.
 */

import { h, replace, trapFocus } from './dom.js';
import { icon } from './icons.js';
import { t } from '../core/i18n.js';

const MAX_ENGINES = 7;
const MAX_CATEGORIES = 4;

let openInstance = null;

export function openPalette({ app, router }) {
  if (openInstance) return openInstance;

  const previouslyFocused = document.activeElement;
  let items = [];
  let activeIndex = 0;

  const actions = [
    { id: 'act-home', title: t('nav.home'), icon: 'home', run: () => router.go('home') },
    { id: 'act-vault', title: t('nav.vault'), icon: 'bookmark', run: () => router.go('vault') },
    { id: 'act-builder', title: t('builder.new'), icon: 'hammer', run: () => router.go('builder') },
    { id: 'act-stats', title: t('nav.stats'), icon: 'barChart', run: () => router.go('stats') },
    { id: 'act-settings', title: t('nav.settings'), icon: 'settings', run: () => router.go('settings') },
    { id: 'act-all', title: t('home.allEngines'), icon: 'search', run: () => router.go('search') },
  ];

  const input = h('input', {
    class: 'input',
    type: 'text',
    placeholder: t('palette.placeholder'),
    'aria-label': t('palette.placeholder'),
    autocomplete: 'off',
    onInput: () => paint(input.value.trim()),
  });

  const list = h('div', { class: 'palette-list', role: 'listbox' });

  function row(item, index) {
    return h(
      'button',
      {
        class: 'palette-item',
        type: 'button',
        role: 'option',
        dataset: { active: String(index === activeIndex) },
        'aria-selected': String(index === activeIndex),
        onMouseEnter: () => setActive(index),
        onClick: () => choose(index),
      },
      icon(item.icon, { size: 18 }),
      h(
        'span',
        { class: 'palette-item-body' },
        h('span', { class: 'palette-item-title' }, item.title),
        item.subtitle ? h('span', { class: 'palette-item-sub' }, item.subtitle) : null,
      ),
    );
  }

  function paint(term = '') {
    // With no query the palette shows what you reached for last; a cold start
    // falls back to the head of the library so the list is never empty.
    const engineList = term
      ? app.registry.search(term, { limit: MAX_ENGINES }).map((hit) => hit.engine)
      : (app.recents().length ? app.recents() : app.registry.all()).slice(0, MAX_ENGINES);

    const categories = app.registry
      .categories()
      .filter((category) => !term || category.title.includes(term))
      .slice(0, MAX_CATEGORIES);

    const matchedActions = actions.filter((action) => !term || action.title.includes(term));

    items = [
      ...engineList.map((engine) => ({
        group: t('palette.engines'),
        icon: engine.symptomIcon,
        title: engine.title,
        subtitle: engine.symptom,
        run: () => router.go('engine', { engineId: engine.id }),
      })),
      ...categories.map((category) => ({
        group: t('palette.categories'),
        icon: category.icon,
        title: category.title,
        subtitle: t('home.engineCount', { count: category.count }),
        run: () => router.go('category', { categoryId: category.id }),
      })),
      ...matchedActions.map((action) => ({ group: t('palette.actions'), icon: action.icon, title: action.title, run: action.run })),
    ];

    activeIndex = 0;
    if (items.length === 0) {
      replace(list, h('p', { class: 'palette-group' }, t('palette.empty')));
      return;
    }

    const nodes = [];
    let lastGroup = null;
    items.forEach((item, index) => {
      if (item.group !== lastGroup) {
        lastGroup = item.group;
        nodes.push(h('div', { class: 'palette-group' }, item.group));
      }
      nodes.push(row(item, index));
    });
    replace(list, ...nodes);
  }

  function setActive(index) {
    activeIndex = Math.max(0, Math.min(items.length - 1, index));
    const rows = list.querySelectorAll('.palette-item');
    rows.forEach((element, position) => {
      element.dataset.active = String(position === activeIndex);
      element.setAttribute('aria-selected', String(position === activeIndex));
    });
    rows[activeIndex]?.scrollIntoView({ block: 'nearest' });
  }

  function choose(index) {
    const item = items[index];
    if (!item) return;
    close();
    item.run();
  }

  function onKeyDown(event) {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      close();
    } else if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActive(activeIndex + 1);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActive(activeIndex - 1);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      choose(activeIndex);
    } else {
      trapFocus(panel, event);
    }
  }

  const panel = h(
    'div',
    { class: 'palette', role: 'dialog', 'aria-modal': 'true', 'aria-label': t('nav.palette') },
    h('div', { class: 'palette-input' }, icon('search', { size: 18 }), input),
    list,
    h('div', { class: 'palette-foot' }, t('palette.hint')),
  );

  const overlay = h(
    'div',
    {
      class: 'overlay',
      dataset: { align: 'top' },
      onClick: (event) => {
        if (event.target === overlay) close();
      },
    },
    panel,
  );

  function close() {
    overlay.remove();
    document.removeEventListener('keydown', onKeyDown, true);
    openInstance = null;
    if (previouslyFocused instanceof HTMLElement) previouslyFocused.focus();
  }

  document.addEventListener('keydown', onKeyDown, true);
  document.body.append(overlay);
  paint('');
  input.focus();

  openInstance = { close };
  return openInstance;
}

export function isPaletteOpen() {
  return Boolean(openInstance);
}
