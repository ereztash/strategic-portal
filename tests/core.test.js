import test from 'node:test';
import assert from 'node:assert/strict';

import { diffLines, diffStats } from '../src/core/diff.js';
import { countWords, estimateTokens, measure } from '../src/core/tokens.js';
import { dictionaryKeys, getLocale, localeMeta, setLocale, t } from '../src/core/i18n.js';
import { MODIFIERS, MODIFIER_GROUPS, modifierTechniques, modifierTexts, toggleModifier } from '../src/core/modifiers.js';
import { TECHNIQUES, resolveTechniques, techniqueUsage } from '../src/core/techniques.js';
import { buildTargetUrl, getTarget } from '../src/core/targets.js';
import { validateCustomEngine } from '../src/core/registry.js';
import { escapeHtml, formatRelative, normalizeText, slugify, tokenize } from '../src/core/utils.js';

test.after(() => setLocale('he'));

test('diff marks removals from the left and additions from the right', () => {
  const diff = diffLines('a\nb\nc', 'a\nx\nc');
  assert.deepEqual(diff.map((row) => row.type), ['equal', 'removed', 'added', 'equal']);
  assert.deepEqual(diffStats(diff), { added: 1, removed: 1, equal: 2 });
});

test('an empty side yields no phantom blank row', () => {
  assert.deepEqual(diffStats(diffLines('', 'a\nb')), { added: 2, removed: 0, equal: 0 });
  assert.deepEqual(diffStats(diffLines('a\nb', '')), { added: 0, removed: 2, equal: 0 });
  assert.deepEqual(diffLines('', ''), []);
});

test('token estimate charges Hebrew more per character than English', () => {
  const hebrew = 'א'.repeat(100);
  const latin = 'a'.repeat(100);
  assert.ok(estimateTokens(hebrew) > estimateTokens(latin) * 1.5);
  assert.equal(estimateTokens(''), 0);
});

test('measure reports characters, words, lines and tokens together', () => {
  const stats = measure('שורה אחת\nשורה שתיים');
  assert.equal(stats.lines, 2);
  assert.equal(stats.words, 4);
  assert.equal(stats.characters, 19);
  assert.ok(stats.tokens > 0);
  assert.equal(countWords('   '), 0);
});

test('the he and en dictionaries stay in sync', () => {
  const he = new Set(dictionaryKeys('he'));
  const en = new Set(dictionaryKeys('en'));
  assert.deepEqual([...he].filter((key) => !en.has(key)), [], 'keys missing from the English dictionary');
  assert.deepEqual([...en].filter((key) => !he.has(key)), [], 'keys missing from the Hebrew dictionary');
});

test('translation interpolates and switching locale flips direction', () => {
  setLocale('he');
  assert.equal(getLocale(), 'he');
  assert.equal(localeMeta().dir, 'rtl');
  assert.equal(t('home.engineCount', { count: 3 }), '3 מנועים');
  setLocale('en');
  assert.equal(localeMeta().dir, 'ltr');
  assert.equal(t('home.engineCount', { count: 3 }), '3 engines');
  setLocale('he');
});

test('an unknown key returns itself rather than blanking the UI', () => {
  assert.equal(t('does.not.exist'), 'does.not.exist');
});

test('an unknown locale is ignored', () => {
  setLocale('he');
  setLocale('klingon');
  assert.equal(getLocale(), 'he');
});

test('modifiers in an exclusive group replace each other', () => {
  let active = [];
  active = toggleModifier(active, 'fmt-table');
  active = toggleModifier(active, 'fmt-json');
  assert.deepEqual(active, ['fmt-json']);
});

test('modifiers in a non-exclusive group stack', () => {
  let active = toggleModifier([], 'no-fluff');
  active = toggleModifier(active, 'self-check');
  assert.equal(active.length, 2);
});

test('toggling the same modifier twice turns it off', () => {
  assert.deepEqual(toggleModifier(toggleModifier([], 'cot'), 'cot'), []);
});

test('active modifiers keep declaration order so prompts are deterministic', () => {
  const forward = toggleModifier(toggleModifier([], 'cot'), 'no-fluff');
  const reverse = toggleModifier(toggleModifier([], 'no-fluff'), 'cot');
  assert.deepEqual(forward, reverse);
});

test('an unknown modifier id is a no-op', () => {
  assert.deepEqual(toggleModifier(['cot'], 'nope'), ['cot']);
});

test('every modifier belongs to a declared group and carries text', () => {
  const groups = new Set(MODIFIER_GROUPS.map((group) => group.id));
  const ids = new Set();
  for (const modifier of MODIFIERS) {
    assert.ok(groups.has(modifier.group), `modifier "${modifier.id}" has unknown group`);
    assert.ok(modifier.text.trim().length > 20, `modifier "${modifier.id}" has no instruction text`);
    assert.ok(!ids.has(modifier.id), `modifier "${modifier.id}" is duplicated`);
    ids.add(modifier.id);
    if (modifier.technique) {
      assert.ok(TECHNIQUES[modifier.technique], `modifier "${modifier.id}" references unknown technique`);
    }
  }
});

test('modifier texts and techniques resolve from ids', () => {
  const active = ['cot', 'no-fluff'];
  assert.equal(modifierTexts(active).length, 2);
  assert.deepEqual(modifierTechniques(active).sort(), ['chainOfThought', 'negativeConstraints'].sort());
  assert.deepEqual(modifierTexts(['nope']), []);
});

test('technique helpers drop ids that no longer exist', () => {
  assert.equal(resolveTechniques(['role', 'ghost']).length, 1);
  const usage = techniqueUsage([{ techniques: ['role'] }, { techniques: ['role', 'fewShot'] }]);
  assert.equal(usage.get('role'), 2);
  assert.equal(usage.get('fewShot'), 1);
});

test('a short prompt is prefilled into the target url', () => {
  const { url, prefilled } = buildTargetUrl('chatgpt', 'שלום');
  assert.equal(prefilled, true);
  assert.match(url, /chatgpt\.com/);
  assert.ok(url.includes(encodeURIComponent('שלום')));
});

test('an oversized prompt falls back to a bare tab so nothing is truncated', () => {
  const { url, prefilled } = buildTargetUrl('chatgpt', 'x'.repeat(5000));
  assert.equal(prefilled, false);
  assert.equal(url, getTarget('chatgpt').url);
});

test('a target with no query parameter never claims to be prefilled', () => {
  assert.equal(buildTargetUrl('gemini', 'שלום').prefilled, false);
});

test('an unknown target falls back to the first one', () => {
  assert.equal(getTarget('nope').id, 'chatgpt');
});

test('custom engine validation catches missing pieces before saving', () => {
  const empty = validateCustomEngine({ title: '', template: '' });
  assert.equal(empty.valid, false);
  assert.deepEqual(empty.errors, ['title', 'template']);

  const duplicated = validateCustomEngine({
    title: 'x',
    template: '{{a}}',
    fields: [{ id: 'a' }, { id: 'a' }],
  });
  assert.ok(duplicated.errors.includes('duplicateFields'));
});

test('custom engine validation warns about mismatched variables without blocking', () => {
  const result = validateCustomEngine({
    title: 'x',
    template: 'כתוב על {{topic}}',
    fields: [{ id: 'subject' }],
  });
  assert.equal(result.valid, true, 'warnings must not block saving');
  const types = result.warnings.map((warning) => warning.type);
  assert.ok(types.includes('unknownVariables'));
  assert.ok(types.includes('unusedFields'));
});

test('html escaping covers every character that could break out of markup', () => {
  assert.equal(escapeHtml('<img src=x onerror="a">'), '&lt;img src=x onerror=&quot;a&quot;&gt;');
  assert.equal(escapeHtml("it's & that"), 'it&#39;s &amp; that');
  assert.equal(escapeHtml(null), '');
});

test('text helpers keep Hebrew intact', () => {
  assert.equal(slugify('שלום Hello World!'), 'שלום-hello-world');
  assert.deepEqual(tokenize('שָׁלוֹם World 42'), ['שלום', 'world', '42']);
  assert.equal(normalizeText('"ציטוט"'), 'ציטוט');
});

test('relative time picks the right bucket', () => {
  const strings = {
    justNow: 'now',
    minutesAgo: (n) => `${n}m`,
    hoursAgo: (n) => `${n}h`,
    daysAgo: (n) => `${n}d`,
  };
  const minute = 60_000;
  assert.equal(formatRelative(Date.now(), strings), 'now');
  assert.equal(formatRelative(Date.now() - 5 * minute, strings), '5m');
  assert.equal(formatRelative(Date.now() - 3 * 60 * minute, strings), '3h');
  assert.equal(formatRelative(Date.now() - 4 * 24 * 60 * minute, strings), '4d');
});
