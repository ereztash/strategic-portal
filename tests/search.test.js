import test from 'node:test';
import assert from 'node:assert/strict';

import { SYNONYM_GROUPS, buildIndex, highlightSegments, isSubsequence, search, synonymsFor } from '../src/core/search.js';
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

/* --- synonyms ------------------------------------------------------------ */

test('a query finds engines written with a different spelling of the same word', () => {
  // The library only ever writes "מייל"; "אימייל" is the standard form of the
  // same word, and before the synonym layer it returned nothing at all.
  const spelled = search(index, 'אימייל');
  const colloquial = search(index, 'מייל');

  assert.ok(spelled.length > 0, '"אימייל" found nothing');
  assert.equal(spelled[0].engine.id, colloquial[0].engine.id, 'the two spellings disagree on the best match');
});

test('every synonym group resolves against the library', () => {
  // A group whose words all miss is dead weight, and one added for a word the
  // library does not cover would quietly widen every query it appears in.
  for (const group of SYNONYM_GROUPS) {
    const reachable = group.filter((word) => search(index, word).length > 0);
    assert.ok(reachable.length > 0, `no word in [${group.join(', ')}] matches anything`);
  }
});

test('the wording the library uses outranks a synonym for it', () => {
  const direct = search(index, 'מייל');
  const viaSynonym = search(index, 'אימייל');
  const sameEngine = viaSynonym.find((hit) => hit.engine.id === direct[0].engine.id);

  assert.ok(sameEngine, 'the synonym did not reach the engine the direct term found');
  assert.ok(
    sameEngine.score < direct[0].score,
    `a synonym scored ${sameEngine.score}, no lower than the direct hit's ${direct[0].score}`,
  );
});

test('synonym lookup tolerates a glued Hebrew prefix', () => {
  // "והאימייל" is one word to Hebrew and two ideas to a matcher.
  assert.ok(synonymsFor('אימייל').length > 0);
  assert.deepEqual(synonymsFor('המצגת'), synonymsFor('מצגת'));
});

test('a nonsense query still returns nothing', () => {
  // The synonym layer must not turn every query into a match.
  assert.equal(search(index, 'זכוכית מגדלת סגולה').length, 0);
  assert.equal(search(index, 'qqqq zzzz').length, 0);
});
