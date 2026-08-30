import test from 'node:test';
import assert from 'node:assert/strict';

import {
  analyzeTemplate,
  composePrompt,
  extractFragments,
  extractVariables,
  isBlank,
  render,
  stringifyValue,
  tidy,
} from '../src/core/template.js';

test('interpolates values and reports what was used', () => {
  const result = render('שלום {{name}}, בן {{age}}', { name: 'ארז', age: 40 });
  assert.equal(result.text, 'שלום ארז, בן 40');
  assert.deepEqual(result.used, ['name', 'age']);
  assert.deepEqual(result.missing, []);
});

test('reports missing variables and renders them as empty', () => {
  const result = render('שלום {{name}}!', {});
  assert.equal(result.text, 'שלום !');
  assert.deepEqual(result.missing, ['name']);
});

test('keepMissing leaves the placeholder in place for previews', () => {
  const result = render('שלום {{name}}', {}, { keepMissing: true });
  assert.equal(result.text, 'שלום {{name}}');
});

test('falls back to the literal default when a value is empty', () => {
  assert.equal(render('טון: {{tone ?? ניטרלי}}', {}).text, 'טון: ניטרלי');
  assert.equal(render('טון: {{tone ?? ניטרלי}}', { tone: 'חד' }).text, 'טון: חד');
});

test('drops optional blocks whose variables are all empty', () => {
  const template = 'בסיס.[[ תוספת: {{extra}}.]] סוף.';
  assert.equal(render(template, {}).text, 'בסיס. סוף.');
  assert.equal(render(template, { extra: 'כן' }).text, 'בסיס. תוספת: כן. סוף.');
});

test('keeps an optional block when at least one variable is filled', () => {
  const template = '[[א: {{a}} ב: {{b}}]]';
  assert.equal(render(template, { b: '2' }).text, 'א:  ב: 2');
});

test('resolves nested optional blocks from the inside out', () => {
  const template = '[[חיצוני {{a}}[[ פנימי {{b}}]]]]';
  assert.equal(render(template, { a: '1' }).text, 'חיצוני 1');
  assert.equal(render(template, { a: '1', b: '2' }).text, 'חיצוני 1 פנימי 2');
  assert.equal(render(template, {}).text, '');
});

test('an optional block with no variables is always kept', () => {
  assert.equal(render('[[קבוע]]', {}).text, 'קבוע');
});

test('expands fragments and tolerates unknown keys', () => {
  const result = render('בסיס <<cot>> <<unknown>>', {}, { fragments: { cot: 'חשוב שלב-שלב' } });
  assert.equal(result.text, 'בסיס חשוב שלב-שלב <<unknown>>');
});

test('fragment expansion stops instead of looping forever', () => {
  const result = render('<<a>>', {}, { fragments: { a: '<<b>>', b: '<<a>>' } });
  assert.equal(typeof result.text, 'string');
});

test('stringifies arrays, booleans and numbers predictably', () => {
  assert.equal(stringifyValue(['א', 'ב']), 'א, ב');
  assert.equal(stringifyValue(['א', '', 'ב']), 'א, ב');
  assert.equal(stringifyValue(true), 'כן');
  assert.equal(stringifyValue(false), '');
  assert.equal(stringifyValue(0), '0');
});

test('blankness matches what the renderer treats as empty', () => {
  assert.equal(isBlank(''), true);
  assert.equal(isBlank('   '), true);
  assert.equal(isBlank([]), true);
  assert.equal(isBlank(false), true);
  assert.equal(isBlank(0), false);
  assert.equal(isBlank('0'), false);
});

test('extracts variables and fragments in first-appearance order', () => {
  assert.deepEqual(extractVariables('{{b}} {{a}} {{b}}'), ['b', 'a']);
  assert.deepEqual(extractFragments('<<x>> <<y>> <<x>>'), ['x', 'y']);
});

test('analyzeTemplate reports unknown variables and unused fields', () => {
  const analysis = analyzeTemplate('{{a}} {{b}}', ['a', 'c']);
  assert.deepEqual(analysis.unknownVariables, ['b']);
  assert.deepEqual(analysis.unusedFields, ['c']);
});

test('tidy collapses the gaps that removed blocks leave behind', () => {
  assert.equal(tidy('  שורה  \n\n\n\nשורה שנייה  '), 'שורה\n\nשורה שנייה');
});

test('composePrompt appends modifiers as a numbered block', () => {
  assert.equal(composePrompt('בסיס', []), 'בסיס');
  const composed = composePrompt('בסיס', ['אחד', 'שתיים']);
  assert.match(composed, /1\. אחד/);
  assert.match(composed, /2\. שתיים/);
});
