import test from 'node:test';
import assert from 'node:assert/strict';

import { buildIndex, highlightSegments, isSubsequence, search } from '../src/core/search.js';
import { BUILTIN_ENGINES } from '../src/data/engines/index.js';
import { getCategory } from '../src/data/categories.js';

const index = buildIndex(
  BUILTIN_ENGINES.map((engine) => ({ ...engine, categoryTitle: getCategory(engine.categoryId)?.title ?? '' })),
);

function topId(query) {
  return search(index, query)[0]?.engine.id ?? null;
}

test('finds the engine by the words in its symptom, not only its title', () => {
  assert.equal(topId('הכתיבה נשמעת פלסטית וקלישאתית'), 'anti-robot');
  assert.equal(topId('ה-AI ממציא עובדות'), 'hallucination-guard');
  assert.equal(topId('דוחה משימה גדולה'), 'micro-tasker');
});

test('finds engines by title', () => {
  assert.equal(topId('מחסל הבולשיט'), 'anti-robot');
  assert.equal(topId('הצוות האדום'), 'red-team');
});

test('finds engines by tag', () => {
  assert.ok(search(index, 'דחיינות').some((hit) => hit.engine.id === 'micro-tasker'));
  assert.ok(search(index, 'sql').some((hit) => hit.engine.id === 'sql-helper'));
});

test('returns nothing for a query with no relationship to the library', () => {
  assert.deepEqual(search(index, 'זברה קוואנטית פינגווין'), []);
});

test('an empty query returns nothing rather than everything', () => {
  assert.deepEqual(search(index, ''), []);
  assert.deepEqual(search(index, '   '), []);
});

test('results come back ordered by score', () => {
  const results = search(index, 'פרומפט');
  assert.ok(results.length > 1);
  for (let i = 1; i < results.length; i += 1) {
    assert.ok(results[i - 1].score >= results[i].score);
  }
});

test('the limit option is honoured', () => {
  assert.ok(search(index, 'לקוח', { limit: 3 }).length <= 3);
});

test('tolerates a partial word', () => {
  assert.ok(search(index, 'קליש').some((hit) => hit.engine.id === 'anti-robot'));
});

test('subsequence matching underpins the typo tolerance', () => {
  assert.equal(isSubsequence('abc', 'aXbXc'), true);
  assert.equal(isSubsequence('acb', 'abc'), false);
  assert.equal(isSubsequence('', 'anything'), true);
});

test('highlight splits text into hit and non-hit segments', () => {
  const segments = highlightSegments('הכתיבה מרגישה פלסטית', 'פלסטית');
  assert.deepEqual(segments, [
    { text: 'הכתיבה מרגישה ', hit: false },
    { text: 'פלסטית', hit: true },
  ]);
});

test('highlight returns the original text when nothing matches', () => {
  assert.deepEqual(highlightSegments('שלום עולם', 'קוואנטי'), [{ text: 'שלום עולם', hit: false }]);
});

test('highlight merges overlapping matches instead of nesting them', () => {
  const segments = highlightSegments('אבגד', 'אבג אב');
  assert.equal(segments.filter((segment) => segment.hit).length, 1);
});
