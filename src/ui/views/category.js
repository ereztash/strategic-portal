/** One category: its engines, with the symptom leading each card. */

import { h } from '../dom.js';
import { icon } from '../icons.js';
import { t } from '../../core/i18n.js';
import { getCategory } from '../../data/categories.js';
import { emptyState, engineCard } from '../components.js';

export function renderCategory({ app, router, params }) {
  const category = getCategory(params.categoryId);
  if (!category) {
    return h(
      'div',
      { class: 'view view-enter' },
      emptyState({
        iconName: 'help',
        title: t('category.empty'),
        action: h('button', { class: 'btn btn-primary', type: 'button', onClick: () => router.go('home') }, t('category.back')),
      }),
    );
  }

  const engines = app.registry.byCategory(category.id);

  return h(
    'div',
    { class: 'view view-enter', dataset: { accent: category.accent } },
    h(
      'header',
      { class: 'panel', style: { display: 'flex', gap: '16px', alignItems: 'center' } },
      h('span', { class: 'hero-icon' }, icon(category.icon, { size: 26 })),
      h(
        'div',
        null,
        h('h1', { class: 'page-title', style: { marginBottom: '4px' } }, category.title),
        h('p', { class: 'page-lead' }, category.desc),
      ),
    ),
    engines.length
      ? h(
          'div',
          { class: 'grid grid-cards' },
          ...engines.map((engine) => engineCard(engine, { app, onOpen: (id) => router.go('engine', { engineId: id }) })),
        )
      : emptyState({
          iconName: 'hammer',
          title: t('category.empty'),
          action: h('button', { class: 'btn btn-primary', type: 'button', onClick: () => router.go('builder') }, t('builder.new')),
        }),
  );
}
