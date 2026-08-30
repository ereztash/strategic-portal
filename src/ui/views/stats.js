/**
 * Analytics. Everything is local, which the copy says out loud, because a
 * usage dashboard in a prompt tool otherwise reads like telemetry.
 */

import { h, svg } from '../dom.js';
import { icon } from '../icons.js';
import { t } from '../../core/i18n.js';
import { getCategory } from '../../data/categories.js';
import { sortByCount } from '../../core/utils.js';
import { confirmDialog } from '../modal.js';
import { emptyState, sectionHead } from '../components.js';

const ACTIVITY_DAYS = 30;

/** Inline SVG sparkline. No chart library for one line. */
function sparkline(points) {
  const width = 600;
  const height = 80;
  const max = Math.max(1, ...points);
  const step = points.length > 1 ? width / (points.length - 1) : width;
  const coords = points.map((value, index) => [index * step, height - (value / max) * (height - 8) - 4]);
  const line = coords.map(([x, y], index) => `${index === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const area = `${line} L${width},${height} L0,${height} Z`;

  return svg(
    'svg',
    { class: 'sparkline', viewBox: `0 0 ${width} ${height}`, preserveAspectRatio: 'none', 'aria-hidden': 'true' },
    svg('path', { class: 'area', d: area }),
    svg('path', { d: line }),
    svg('line', { class: 'baseline', x1: 0, y1: height, x2: width, y2: height }),
  );
}

function statTile(label, value, hint, accent) {
  return h(
    'div',
    { class: 'stat', dataset: { accent } },
    h('span', { class: 'stat-label' }, label),
    h('span', { class: 'stat-value' }, String(value)),
    hint ? h('span', { class: 'stat-hint' }, hint) : null,
  );
}

function barRow(label, value, max, suffix) {
  return h(
    'div',
    { class: 'bar-row' },
    h('span', { style: { fontWeight: '700' } }, label),
    h('span', { class: 'bar-track' }, h('span', { class: 'bar-fill', style: { width: `${max > 0 ? (value / max) * 100 : 0}%` } })),
    h('span', { class: 'bar-value' }, suffix ?? String(value)),
  );
}

export function renderStats({ app, router }) {
  const stats = app.stats();
  const engineEntries = Object.entries(stats.engines).filter(([, data]) => data.generated > 0 || data.copied > 0);

  if (engineEntries.length === 0 && stats.totalGenerated === 0) {
    return h(
      'div',
      { class: 'view view-enter' },
      h(
        'div',
        { class: 'page-head' },
        h(
          'div',
          null,
          h('h1', { class: 'page-title' }, icon('barChart', { size: 22 }), t('stats.title')),
          h('p', { class: 'page-lead' }, t('stats.lead')),
        ),
      ),
      emptyState({
        iconName: 'barChart',
        title: t('stats.empty'),
        action: h('button', { class: 'btn btn-primary', type: 'button', onClick: () => router.go('home') }, t('home.startHere')),
      }),
    );
  }

  const followThrough = stats.totalGenerated > 0 ? Math.round((stats.totalCopied / stats.totalGenerated) * 100) : 0;

  // Activity: fill every day in the window so gaps read as zeros, not as a gap.
  const days = [];
  for (let offset = ACTIVITY_DAYS - 1; offset >= 0; offset -= 1) {
    const date = new Date();
    date.setDate(date.getDate() - offset);
    const key = date.toISOString().slice(0, 10);
    days.push(stats.daily[key]?.generated ?? 0);
  }

  const ranked = sortByCount(engineEntries, ([, data]) => data.generated, ([id]) => id);
  const topGenerated = Math.max(1, ...ranked.map(([, data]) => data.generated));

  const byCategory = new Map();
  for (const [engineId, data] of engineEntries) {
    const engine = app.registry.get(engineId);
    const categoryId = engine?.categoryId ?? 'custom';
    byCategory.set(categoryId, (byCategory.get(categoryId) ?? 0) + data.generated);
  }
  const categoryRows = sortByCount([...byCategory.entries()], ([, count]) => count, ([id]) => id);
  const topCategory = Math.max(1, ...categoryRows.map(([, count]) => count));

  return h(
    'div',
    { class: 'view view-enter' },
    h(
      'div',
      { class: 'page-head' },
      h(
        'div',
        null,
        h('h1', { class: 'page-title' }, icon('barChart', { size: 22 }), t('stats.title')),
        h('p', { class: 'page-lead' }, t('stats.lead')),
      ),
      h(
        'button',
        {
          class: 'btn btn-sm btn-danger',
          type: 'button',
          onClick: async () => {
            const ok = await confirmDialog({
              title: t('stats.reset'),
              message: t('stats.confirmReset'),
              confirmLabel: t('common.delete'),
              danger: true,
            });
            if (!ok) return;
            app.resetStats();
            router.go('stats');
            window.location.reload();
          },
        },
        icon('refresh', { size: 14 }),
        t('stats.reset'),
      ),
    ),

    h(
      'div',
      { class: 'stat-grid' },
      statTile(t('stats.generated'), stats.totalGenerated, null, 'blue'),
      statTile(t('stats.copied'), stats.totalCopied, null, 'emerald'),
      statTile(t('stats.saved'), stats.totalSaved, null, 'violet'),
      statTile(t('stats.successRate'), `${followThrough}%`, t('stats.successHint'), 'amber'),
    ),

    h('section', { class: 'panel' }, sectionHead(t('stats.activity')), sparkline(days)),

    h(
      'section',
      { class: 'panel' },
      sectionHead(t('stats.leaderboard'), { count: ranked.length }),
      h(
        'div',
        { class: 'form-stack' },
        ...ranked.slice(0, 10).map(([engineId, data]) => {
          const engine = app.registry.get(engineId);
          const rate = data.generated > 0 ? Math.round((data.copied / data.generated) * 100) : 0;
          return barRow(engine?.title ?? engineId, data.generated, topGenerated, `${data.generated} · ${rate}%`);
        }),
      ),
    ),

    categoryRows.length
      ? h(
          'section',
          { class: 'panel' },
          sectionHead(t('stats.byCategory')),
          h(
            'div',
            { class: 'form-stack' },
            ...categoryRows.map(([categoryId, count]) => barRow(getCategory(categoryId)?.title ?? categoryId, count, topCategory)),
          ),
        )
      : null,
  );
}
