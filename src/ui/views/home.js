/** Home: pick a front, or jump straight back to what you use. */

import { h } from '../dom.js';
import { icon } from '../icons.js';
import { t } from '../../core/i18n.js';
import { categoryCard, emptyState, engineCard, sectionHead } from '../components.js';
import { communityBlock } from '../footer.js';

export function renderHome({ app, router }) {
  const openCategory = (id) => router.go('category', { categoryId: id });
  const openEngine = (id) => router.go('engine', { engineId: id });

  const favorites = app
    .favorites()
    .map((id) => app.registry.get(id))
    .filter(Boolean);
  const recents = app.recents();
  const categories = app.registry.categories();
  const total = app.registry.all().length;

  return h(
    'div',
    { class: 'view view-enter' },

    h(
      'div',
      { class: 'panel', style: { textAlign: 'center', padding: '40px 24px' } },
      h('h1', { style: { fontSize: 'clamp(1.9rem, 5vw, 3rem)', marginBottom: '12px' } }, t('home.heading')),
      h('p', { class: 'page-lead', style: { marginInline: 'auto' } }, t('home.lead')),
      h(
        'div',
        { class: 'chip-row', style: { justifyContent: 'center', marginBlockStart: '20px' } },
        h('span', { class: 'chip chip-accent' }, t('home.engineCount', { count: total })),
        h('span', { class: 'chip' }, `${categories.length} ${t('home.categories')}`),
        h(
          'button',
          { class: 'chip', type: 'button', onClick: () => document.getElementById('global-search')?.focus() },
          icon('search', { size: 14 }),
          t('nav.search'),
        ),
      ),
    ),

    recents.length
      ? h(
          'section',
          null,
          sectionHead(t('home.recents'), { count: recents.length }),
          h('div', { class: 'grid grid-cards' }, ...recents.slice(0, 4).map((engine) => engineCard(engine, { app, onOpen: openEngine }))),
        )
      : null,

    favorites.length
      ? h(
          'section',
          null,
          sectionHead(t('home.favorites'), { count: favorites.length }),
          h('div', { class: 'grid grid-cards' }, ...favorites.map((engine) => engineCard(engine, { app, onOpen: openEngine }))),
        )
      : null,

    h(
      'section',
      null,
      sectionHead(t('home.categories'), { count: categories.length }),
      h('div', { class: 'grid grid-cards' }, ...categories.map((category) => categoryCard(category, openCategory))),
    ),

    !favorites.length && !recents.length
      ? emptyState({
          iconName: 'star',
          message: t('home.noFavorites'),
        })
      : null,

    communityBlock(),
  );
}
