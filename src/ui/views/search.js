/** Search results with technique and level filters. */

import { h, replace } from '../dom.js';
import { icon } from '../icons.js';
import { t } from '../../core/i18n.js';
import { TECHNIQUES, techniqueUsage } from '../../core/techniques.js';
import { emptyState, engineCard, sectionHead } from '../components.js';

const LEVELS = ['basic', 'intermediate', 'advanced'];

export function renderSearch({ app, router, query }) {
  const term = query.q ?? '';
  const activeTechniques = new Set((query.tech ?? '').split(',').filter(Boolean));
  const activeLevels = new Set((query.level ?? '').split(',').filter(Boolean));

  const results = h('div', { class: 'grid grid-cards' });
  const countLabel = h('p', { class: 'page-lead' });

  function currentQuery() {
    return {
      q: term,
      tech: [...activeTechniques].join(','),
      level: [...activeLevels].join(','),
    };
  }

  function matching() {
    const base = term ? app.registry.search(term).map((hit) => hit.engine) : app.registry.all();
    return base.filter((engine) => {
      if (activeLevels.size && !activeLevels.has(engine.level)) return false;
      if (activeTechniques.size && !(engine.techniques ?? []).some((id) => activeTechniques.has(id))) return false;
      return true;
    });
  }

  function paint() {
    const engines = matching();
    countLabel.textContent = t('search.count', { count: engines.length });
    if (engines.length === 0) {
      replace(
        results,
        emptyState({
          iconName: 'search',
          title: t('search.none'),
          message: t('search.noneHint'),
          action: h('button', { class: 'btn', type: 'button', onClick: () => router.go('home') }, t('nav.home')),
        }),
      );
      results.style.display = 'block';
      return;
    }
    results.style.removeProperty('display');
    replace(
      results,
      ...engines.map((engine) =>
        engineCard(engine, { app, query: term, onOpen: (id) => router.go('engine', { engineId: id }) }),
      ),
    );
  }

  function toggleFilter(set, value) {
    if (set.has(value)) set.delete(value);
    else set.add(value);
    router.silent('search', {}, currentQuery());
    paint();
    refreshChips();
  }

  const usage = techniqueUsage(app.registry.all());
  const techniqueChipRow = h('div', { class: 'chip-row' });
  const levelChipRow = h('div', { class: 'chip-row' });

  function refreshChips() {
    replace(
      techniqueChipRow,
      ...Object.values(TECHNIQUES)
        .filter((technique) => usage.get(technique.id))
        .map((technique) =>
          h(
            'button',
            {
              class: 'chip',
              type: 'button',
              title: technique.summary,
              'aria-pressed': String(activeTechniques.has(technique.id)),
              onClick: () => toggleFilter(activeTechniques, technique.id),
            },
            technique.label,
            h('span', { style: { opacity: 0.6 } }, usage.get(technique.id)),
          ),
        ),
    );
    replace(
      levelChipRow,
      ...LEVELS.map((level) =>
        h(
          'button',
          {
            class: 'chip',
            type: 'button',
            'aria-pressed': String(activeLevels.has(level)),
            onClick: () => toggleFilter(activeLevels, level),
          },
          t(`engine.difficulty.${level}`),
        ),
      ),
    );
  }

  refreshChips();
  paint();

  return h(
    'div',
    { class: 'view view-enter' },
    h(
      'header',
      { class: 'page-head' },
      h(
        'div',
        null,
        h('h1', { class: 'page-title' }, icon('search', { size: 22 }), term ? t('search.resultsFor', { query: term }) : t('home.allEngines')),
        countLabel,
      ),
      activeTechniques.size || activeLevels.size
        ? h(
            'button',
            {
              class: 'btn btn-sm',
              type: 'button',
              onClick: () => {
                activeTechniques.clear();
                activeLevels.clear();
                router.silent('search', {}, currentQuery());
                paint();
                refreshChips();
              },
            },
            icon('close', { size: 14 }),
            t('search.clearFilters'),
          )
        : null,
    ),
    h(
      'div',
      { class: 'panel', style: { display: 'flex', flexDirection: 'column', gap: '12px' } },
      h('div', null, sectionHead(t('search.byLevel')), levelChipRow),
      h('div', null, sectionHead(t('search.byTechnique')), techniqueChipRow),
    ),
    results,
  );
}
