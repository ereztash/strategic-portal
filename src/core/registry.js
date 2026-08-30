/**
 * The engine registry.
 *
 * Merges the built-in library with the user's own engines, decorates every row
 * with its category, and keeps a search index that is rebuilt whenever custom
 * engines change. Views read from here rather than importing the data directly,
 * so a custom engine behaves exactly like a built-in one everywhere.
 */

import { BUILTIN_ENGINES } from '../data/engines/index.js';
import { CATEGORIES, CUSTOM_CATEGORY, getCategory } from '../data/categories.js';
import { buildIndex, search as runSearch } from './search.js';
import { analyzeTemplate, render } from './template.js';
import { composePrompt } from './template.js';
import { modifierTexts, modifierTechniques } from './modifiers.js';

/** Normalise a stored custom engine into the same shape as a built-in one. */
export function normalizeCustomEngine(raw) {
  return {
    id: raw.id,
    categoryId: CUSTOM_CATEGORY.id,
    title: raw.title ?? 'מנוע אישי',
    shortDesc: raw.shortDesc ?? '',
    symptom: raw.symptom ?? '',
    symptomIcon: raw.icon ?? 'spark',
    strategy: raw.strategy ?? 'מנוע שבניתם בעצמכם.',
    techniques: Array.isArray(raw.techniques) ? raw.techniques : [],
    level: raw.level ?? 'basic',
    tags: Array.isArray(raw.tags) ? raw.tags : [],
    fields: Array.isArray(raw.fields) ? raw.fields : [],
    template: raw.template ?? '',
    generic: null,
    example: raw.example ?? null,
    custom: true,
    createdAt: raw.createdAt ?? null,
    updatedAt: raw.updatedAt ?? null,
  };
}

/** Attach the category title so search and cards do not have to look it up. */
function decorate(engine) {
  const category = getCategory(engine.categoryId);
  return {
    ...engine,
    custom: engine.custom ?? false,
    categoryTitle: category?.title ?? '',
    categoryAccent: category?.accent ?? 'blue',
    categoryIcon: category?.icon ?? 'spark',
  };
}

export function createRegistry(customEngines = []) {
  let engines = [];
  let byId = new Map();
  let index = [];

  function rebuild(custom) {
    const normalized = (custom ?? []).map(normalizeCustomEngine);
    engines = [...BUILTIN_ENGINES, ...normalized].map(decorate);
    byId = new Map(engines.map((engine) => [engine.id, engine]));
    index = buildIndex(engines);
  }

  rebuild(customEngines);

  return {
    /** Rebuild after the user adds, edits or removes a custom engine. */
    refresh(custom) {
      rebuild(custom);
    },
    all() {
      return engines;
    },
    get(id) {
      return byId.get(id) ?? null;
    },
    has(id) {
      return byId.has(id);
    },
    byCategory(categoryId) {
      return engines.filter((engine) => engine.categoryId === categoryId);
    },
    /** Categories that actually have engines, with their counts. */
    categories() {
      const list = [...CATEGORIES];
      const customCount = engines.filter((engine) => engine.custom).length;
      if (customCount > 0) list.push(CUSTOM_CATEGORY);
      return list.map((category) => ({
        ...category,
        count: engines.filter((engine) => engine.categoryId === category.id).length,
      }));
    },
    search(query, options) {
      return runSearch(index, query, options);
    },
  };
}

/**
 * Turn form values plus modifiers into the final prompt pair.
 * Shared by the generator view and the tests, so what is tested is what ships.
 */
export function buildPrompts(engine, values, activeModifiers = []) {
  const strategicBase = render(engine.template, values);
  const strategic = composePrompt(strategicBase.text, modifierTexts(activeModifiers));
  const generic = engine.generic ? render(engine.generic, values).text : '';
  const techniques = [...new Set([...(engine.techniques ?? []), ...modifierTechniques(activeModifiers)])];
  return {
    strategic,
    generic,
    techniques,
    missing: strategicBase.missing,
  };
}

/** Which required fields are still empty. Drives inline validation. */
export function missingRequired(engine, values) {
  return (engine.fields ?? [])
    .filter((field) => field.required)
    .filter((field) => {
      const value = values[field.id];
      if (Array.isArray(value)) return value.length === 0;
      return value === undefined || value === null || String(value).trim() === '';
    })
    .map((field) => field.id);
}

/** Default values for a fresh form: honour `default`, otherwise empty. */
export function defaultValues(engine) {
  const values = {};
  for (const field of engine.fields ?? []) {
    if (field.default !== undefined) values[field.id] = field.default;
    else if (field.type === 'multiselect') values[field.id] = [];
    else if (field.type === 'toggle') values[field.id] = false;
    else values[field.id] = '';
  }
  return values;
}

/** Validation used by the builder before an engine is saved. */
export function validateCustomEngine(engine) {
  const errors = [];
  const warnings = [];
  if (!String(engine.title ?? '').trim()) errors.push('title');
  if (!String(engine.template ?? '').trim()) errors.push('template');

  const ids = (engine.fields ?? []).map((field) => field.id);
  const duplicates = ids.filter((id, position) => ids.indexOf(id) !== position);
  if (duplicates.length) errors.push('duplicateFields');

  const analysis = analyzeTemplate(engine.template ?? '', ids);
  if (analysis.unknownVariables.length) warnings.push({ type: 'unknownVariables', items: analysis.unknownVariables });
  if (analysis.unusedFields.length) warnings.push({ type: 'unusedFields', items: analysis.unusedFields });

  return { valid: errors.length === 0, errors, warnings, analysis };
}
