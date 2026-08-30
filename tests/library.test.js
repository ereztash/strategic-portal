/**
 * Data-integrity tests for the engine library.
 *
 * These run over all 50 built-in engines at once, so a typo in a template
 * variable or a stale technique id fails the build instead of silently
 * rendering an empty placeholder in the browser.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { BUILTIN_ENGINES } from '../src/data/engines/index.js';
import { CATEGORY_IDS } from '../src/data/categories.js';
import { TECHNIQUE_IDS } from '../src/core/techniques.js';
import { extractVariables, render } from '../src/core/template.js';
import { buildPrompts, createRegistry, defaultValues, missingRequired } from '../src/core/registry.js';

const FIELD_TYPES = new Set(['text', 'textarea', 'select', 'multiselect', 'number', 'toggle']);
const LEVELS = new Set(['basic', 'intermediate', 'advanced']);

test('every engine has a unique id', () => {
  const ids = BUILTIN_ENGINES.map((engine) => engine.id);
  assert.equal(new Set(ids).size, ids.length, 'duplicate engine ids found');
});

test('every engine carries the metadata the UI renders', () => {
  for (const engine of BUILTIN_ENGINES) {
    const where = `engine "${engine.id}"`;
    for (const key of ['title', 'shortDesc', 'symptom', 'symptomIcon', 'strategy', 'template']) {
      assert.ok(String(engine[key] ?? '').trim(), `${where} is missing ${key}`);
    }
    assert.ok(CATEGORY_IDS.includes(engine.categoryId), `${where} has unknown category ${engine.categoryId}`);
    assert.ok(LEVELS.has(engine.level), `${where} has unknown level ${engine.level}`);
    assert.ok(Array.isArray(engine.tags) && engine.tags.length >= 2, `${where} needs at least two tags`);
    assert.ok(Array.isArray(engine.fields) && engine.fields.length > 0, `${where} has no fields`);
  }
});

test('every declared technique exists in the taxonomy', () => {
  for (const engine of BUILTIN_ENGINES) {
    assert.ok(engine.techniques?.length, `engine "${engine.id}" declares no techniques`);
    for (const technique of engine.techniques) {
      assert.ok(TECHNIQUE_IDS.includes(technique), `engine "${engine.id}" uses unknown technique "${technique}"`);
    }
  }
});

test('field definitions are well formed and uniquely identified', () => {
  for (const engine of BUILTIN_ENGINES) {
    const seen = new Set();
    for (const field of engine.fields) {
      const where = `engine "${engine.id}" field "${field.id}"`;
      assert.ok(field.id, `${where} has no id`);
      assert.ok(!seen.has(field.id), `${where} is duplicated`);
      seen.add(field.id);
      assert.ok(String(field.label ?? '').trim(), `${where} has no label`);
      assert.ok(FIELD_TYPES.has(field.type), `${where} has unknown type "${field.type}"`);
      if (field.type === 'select' || field.type === 'multiselect') {
        assert.ok(Array.isArray(field.options) && field.options.length > 1, `${where} needs options`);
        const defaults = field.type === 'multiselect' ? (field.default ?? []) : [field.default].filter(Boolean);
        for (const value of defaults) {
          assert.ok(field.options.includes(value), `${where} default "${value}" is not one of its options`);
        }
      }
    }
  }
});

test('every template variable maps to a declared field', () => {
  for (const engine of BUILTIN_ENGINES) {
    const ids = new Set(engine.fields.map((field) => field.id));
    for (const variable of extractVariables(engine.template)) {
      assert.ok(ids.has(variable), `engine "${engine.id}" template uses undeclared variable {{${variable}}}`);
    }
    for (const variable of extractVariables(engine.generic ?? '')) {
      assert.ok(ids.has(variable), `engine "${engine.id}" generic uses undeclared variable {{${variable}}}`);
    }
  }
});

test('every required field is actually used by the template', () => {
  for (const engine of BUILTIN_ENGINES) {
    const used = new Set(extractVariables(engine.template));
    for (const field of engine.fields.filter((item) => item.required)) {
      assert.ok(used.has(field.id), `engine "${engine.id}" requires "${field.id}" but never renders it`);
    }
  }
});

test('every engine ships a naive baseline for the comparison view', () => {
  for (const engine of BUILTIN_ENGINES) {
    assert.ok(String(engine.generic ?? '').trim(), `engine "${engine.id}" has no generic baseline`);
    assert.ok(
      engine.generic.length < engine.template.length,
      `engine "${engine.id}" baseline should be shorter than the engineered prompt`,
    );
  }
});

test('examples fill every required field and render a complete prompt', () => {
  for (const engine of BUILTIN_ENGINES) {
    assert.ok(engine.example, `engine "${engine.id}" has no example`);
    const values = { ...defaultValues(engine), ...engine.example };
    assert.deepEqual(
      missingRequired(engine, values),
      [],
      `engine "${engine.id}" example leaves required fields empty`,
    );
    const { strategic, generic } = buildPrompts(engine, values);
    assert.ok(strategic.length > 200, `engine "${engine.id}" renders a suspiciously short prompt`);
    assert.ok(generic.length > 20, `engine "${engine.id}" renders an empty baseline`);
    assert.ok(!strategic.includes('{{'), `engine "${engine.id}" leaves an unrendered variable`);
    assert.ok(!generic.includes('{{'), `engine "${engine.id}" baseline leaves an unrendered variable`);
    assert.ok(!/\[\[|\]\]/.test(strategic), `engine "${engine.id}" leaves an unresolved optional block`);
  }
});

test('an empty form never leaks placeholder syntax into the prompt', () => {
  for (const engine of BUILTIN_ENGINES) {
    const { strategic } = buildPrompts(engine, defaultValues(engine));
    assert.ok(!/\[\[|\]\]/.test(strategic), `engine "${engine.id}" leaks an optional block when empty`);
    assert.ok(!strategic.includes('{{'), `engine "${engine.id}" leaks a variable when empty`);
  }
});

test('optional blocks disappear when their variables are empty', () => {
  const engine = BUILTIN_ENGINES.find((item) => item.id === 'prompt-fixer');
  const withoutFailure = render(engine.template, { brokenPrompt: 'a', goal: 'b' }).text;
  const withFailure = render(engine.template, { brokenPrompt: 'a', goal: 'b', failure: 'exploded' }).text;
  assert.ok(!withoutFailure.includes('מה שקרה בפועל'));
  assert.ok(withFailure.includes('exploded'));
});

test('the registry exposes every category with a non-zero count', () => {
  const registry = createRegistry([]);
  const categories = registry.categories();
  assert.equal(categories.length, CATEGORY_IDS.length, 'custom category should be hidden when empty');
  for (const category of categories) {
    assert.ok(category.count > 0, `category "${category.id}" has no engines`);
  }
});

test('custom engines join the registry and are searchable', () => {
  const registry = createRegistry([
    { id: 'custom_1', title: 'כותב תיאורי מוצר', template: 'תאר את {{product}}', fields: [{ id: 'product', label: 'מוצר', type: 'text' }] },
  ]);
  assert.ok(registry.has('custom_1'));
  assert.equal(registry.get('custom_1').custom, true);
  assert.ok(registry.categories().some((category) => category.id === 'custom'));
  const hits = registry.search('תיאורי מוצר');
  assert.equal(hits[0].engine.id, 'custom_1');
});
