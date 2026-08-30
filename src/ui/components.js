/** Shared building blocks used across views. */

import { h, highlighted } from './dom.js';
import { icon } from './icons.js';
import { t } from '../core/i18n.js';
import { resolveTechniques } from '../core/techniques.js';
import { highlightSegments } from '../core/search.js';

/** Section heading with an optional count and trailing actions. */
export function sectionHead(title, { count, actions } = {}) {
  return h(
    'div',
    { class: 'section-head' },
    h('h2', { class: 'section-title' }, title, count !== undefined ? h('span', { class: 'count' }, count) : null),
    actions ? h('div', { class: 'btn-row' }, actions) : null,
  );
}

/** Consistent empty state: icon, headline, explanation, optional action. */
export function emptyState({ iconName = 'inbox', title, message, action }) {
  return h(
    'div',
    { class: 'empty' },
    icon(iconName, { size: 40 }),
    title ? h('h3', null, title) : null,
    message ? h('p', null, message) : null,
    action ?? null,
  );
}

export function levelChip(level) {
  const tone = { basic: 'chip-success', intermediate: 'chip-warning', advanced: 'chip-danger' }[level] ?? '';
  return h('span', { class: `chip ${tone}` }, t(`engine.difficulty.${level}`));
}

/** Technique badges with the taxonomy summary as a tooltip. */
export function techniqueChips(ids, { limit } = {}) {
  const techniques = resolveTechniques(ids);
  const shown = limit ? techniques.slice(0, limit) : techniques;
  const hidden = techniques.length - shown.length;
  return h(
    'div',
    { class: 'chip-row' },
    ...shown.map((technique) => h('span', { class: 'chip', title: technique.summary }, technique.label)),
    hidden > 0 ? h('span', { class: 'chip' }, `+${hidden}`) : null,
  );
}

/** Star button. `onToggle` receives the new state. */
export function favoriteButton(app, engineId, onToggle) {
  const button = h('button', {
    class: 'fav-toggle',
    type: 'button',
    'aria-pressed': String(app.isFavorite(engineId)),
    'aria-label': app.isFavorite(engineId) ? t('engine.unfavorite') : t('engine.favorite'),
    onClick: (event) => {
      event.preventDefault();
      event.stopPropagation();
      const now = app.toggleFavorite(engineId);
      button.setAttribute('aria-pressed', String(now));
      button.setAttribute('aria-label', now ? t('engine.unfavorite') : t('engine.favorite'));
      button.replaceChildren(icon('star', { size: 17, filled: now }));
      onToggle?.(now);
    },
  });
  button.append(icon('star', { size: 17, filled: app.isFavorite(engineId) }));
  return button;
}

/** Category tile for the home grid. */
export function categoryCard(category, onOpen) {
  return h(
    'button',
    {
      class: 'card',
      type: 'button',
      dataset: { accent: category.accent },
      onClick: () => onOpen(category.id),
    },
    h('span', { class: 'card-icon' }, icon(category.icon, { size: 22 })),
    h('span', { class: 'card-title' }, category.title),
    h('span', { class: 'card-desc' }, category.desc),
    h(
      'span',
      { class: 'card-foot' },
      h('span', null, t('home.engineCount', { count: category.count })),
      icon('chevronLeft', { size: 16, className: 'crumb-chevron' }),
    ),
  );
}

/**
 * Engine card. Leads with the symptom rather than the tool name, because the
 * portal's whole premise is that people arrive knowing the pain, not the fix.
 */
export function engineCard(engine, { app, onOpen, query = '' } = {}) {
  const segments = (text) => (query ? highlighted(highlightSegments(text, query)) : text);

  return h(
    'div',
    { class: 'card engine-card', dataset: { accent: engine.categoryAccent } },
    app ? favoriteButton(app, engine.id) : null,
    h(
      'button',
      { class: 'engine-card-head', type: 'button', onClick: () => onOpen(engine.id) },
      h('span', { class: 'card-icon' }, icon(engine.symptomIcon, { size: 19 })),
      h(
        'span',
        null,
        h('span', { class: 'card-title' }, segments(engine.title)),
        h('span', { class: 'card-desc' }, segments(engine.shortDesc)),
      ),
    ),
    // A custom engine may have no symptom; an empty quote box reads as a bug.
    engine.symptom ? h('p', { class: 'engine-symptom' }, '"', segments(engine.symptom), '"') : null,
    h(
      'div',
      { class: 'engine-card-meta' },
      levelChip(engine.level),
      engine.custom ? h('span', { class: 'chip chip-accent' }, t('engine.custom')) : null,
      h('span', { class: 'chip' }, engine.categoryTitle),
    ),
  );
}

/**
 * Render one form control from a field definition.
 * Returns the wrapper plus a `read()` that pulls the current value.
 */
export function fieldControl(field, value, onInput) {
  const controlId = `f-${field.id}`;
  let control;
  let read;

  if (field.type === 'textarea') {
    control = h('textarea', {
      id: controlId,
      class: 'textarea',
      rows: String(field.rows ?? 3),
      placeholder: field.placeholder ?? '',
      onInput: () => onInput?.(read()),
    });
    control.value = value ?? '';
    read = () => control.value;
  } else if (field.type === 'select') {
    control = h(
      'select',
      { id: controlId, class: 'select', onChange: () => onInput?.(read()) },
      ...(field.options ?? []).map((option) => h('option', { value: option }, option)),
    );
    control.value = value ?? field.default ?? field.options?.[0] ?? '';
    read = () => control.value;
  } else if (field.type === 'multiselect') {
    const selected = new Set(Array.isArray(value) ? value : []);
    const buttons = (field.options ?? []).map((option) =>
      h(
        'button',
        {
          class: 'chip',
          type: 'button',
          'aria-pressed': String(selected.has(option)),
          onClick: (event) => {
            const button = event.currentTarget;
            if (selected.has(option)) selected.delete(option);
            else selected.add(option);
            button.setAttribute('aria-pressed', String(selected.has(option)));
            onInput?.(read());
          },
        },
        option,
      ),
    );
    control = h('div', { class: 'chip-row', id: controlId, role: 'group' }, ...buttons);
    read = () => (field.options ?? []).filter((option) => selected.has(option));
  } else if (field.type === 'toggle') {
    const input = h('input', { type: 'checkbox', onChange: () => onInput?.(read()) });
    input.checked = Boolean(value);
    control = h('label', { class: 'switch' }, h('span', null, field.placeholder ?? ''), input, h('span', { class: 'switch-track' }));
    read = () => input.checked;
  } else {
    control = h('input', {
      id: controlId,
      class: 'input',
      type: field.type === 'number' ? 'number' : 'text',
      placeholder: field.placeholder ?? '',
      onInput: () => onInput?.(read()),
    });
    control.value = value ?? '';
    read = () => control.value;
  }

  const error = h('p', { class: 'field-error', hidden: true });
  const wrapper = h(
    'div',
    { class: 'field', dataset: { field: field.id } },
    h(
      'label',
      { class: 'field-label', for: controlId },
      field.label,
      field.required ? h('span', { class: 'field-req', title: t('gen.required') }, '*') : null,
    ),
    control,
    error,
  );

  return {
    element: wrapper,
    read,
    focus: () => control.focus?.(),
    setInvalid(message) {
      wrapper.dataset.invalid = message ? 'true' : 'false';
      error.textContent = message ?? '';
      error.hidden = !message;
    },
  };
}
