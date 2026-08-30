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
import { buildHash, decodeState, encodeState, parseHash } from '../src/ui/router.js';
import { ICONS, ICON_NAMES } from '../src/ui/icons.js';
import { CATEGORIES, CUSTOM_CATEGORY } from '../src/data/categories.js';
import { BUILTIN_ENGINES } from '../src/data/engines/index.js';
import { buildServiceWorker, isCurrent } from '../scripts/build-sw.js';
import { CONTACT } from '../src/data/contact.js';
import { DISMISS_COOLDOWN_DAYS, MIN_COPIES_BEFORE_ASK, inviteDecision } from '../src/core/invite.js';
import { readFile } from 'node:fs/promises';

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

/* --- routing ------------------------------------------------------------- */

test('hash parsing covers every route and falls through to notFound', () => {
  assert.equal(parseHash('').name, 'home');
  assert.equal(parseHash('#/').name, 'home');
  assert.equal(parseHash('#/vault').name, 'vault');
  assert.equal(parseHash('#/vault/trash').name, 'trash');
  assert.equal(parseHash('#/stats').name, 'stats');
  assert.equal(parseHash('#/settings').name, 'settings');
  assert.equal(parseHash('#/builder').name, 'builder');
  assert.equal(parseHash('#/nowhere').name, 'notFound');
});

test('route params and query strings decode', () => {
  const engine = parseHash('#/e/anti-robot?v=abc');
  assert.equal(engine.name, 'engine');
  assert.equal(engine.params.engineId, 'anti-robot');
  assert.equal(engine.query.v, 'abc');

  const search = parseHash(`#/search?q=${encodeURIComponent('שלום עולם')}`);
  assert.equal(search.query.q, 'שלום עולם');
});

test('buildHash round-trips through parseHash', () => {
  const cases = [
    ['home', {}, {}],
    ['vault', {}, {}],
    ['trash', {}, {}],
    ['category', { categoryId: 'debug' }, {}],
    ['engine', { engineId: 'anti-robot' }, { v: 'xyz' }],
    ['builderEdit', { engineId: 'custom_1' }, {}],
  ];
  for (const [name, params, query] of cases) {
    const parsed = parseHash(buildHash(name, params, query));
    assert.equal(parsed.name, name, `route ${name} did not round-trip`);
    assert.deepEqual(parsed.params, params);
    for (const [key, value] of Object.entries(query)) assert.equal(parsed.query[key], value);
  }
});

test('empty query values are dropped from the hash', () => {
  assert.equal(buildHash('search', {}, { q: '', tech: undefined }), '#/search');
});

test('share state survives an encode/decode round trip, Hebrew included', () => {
  const state = { values: { topic: 'למה עסקים משלמים על פרסום שלא עובד', count: 3 }, mods: ['cot', 'no-fluff'] };
  assert.deepEqual(decodeState(encodeState(state)), state);
});

test('a corrupt share link decodes to null instead of throwing', () => {
  assert.equal(decodeState('not-valid-base64!!'), null);
  assert.equal(decodeState(''), null);
});

/* --- icons --------------------------------------------------------------- */

test('every icon referenced by the library and categories exists', () => {
  const names = new Set(ICON_NAMES);
  for (const category of [...CATEGORIES, CUSTOM_CATEGORY]) {
    assert.ok(names.has(category.icon), `category "${category.id}" uses missing icon "${category.icon}"`);
  }
  for (const engine of BUILTIN_ENGINES) {
    assert.ok(names.has(engine.symptomIcon), `engine "${engine.id}" uses missing icon "${engine.symptomIcon}"`);
  }
});

test('every icon body is drawable markup', () => {
  for (const name of ICON_NAMES) {
    assert.match(ICONS[name], /^<(path|circle|rect|ellipse|line)/, `icon "${name}" is not a shape`);
  }
});

/* --- service worker ------------------------------------------------------ */

test('the service worker precache list matches what is on disk', async () => {
  const { source, next, assets } = await buildServiceWorker();
  // Compared line-ending agnostically: a CRLF checkout on Windows is not drift.
  assert.ok(isCurrent({ source, next }), 'sw.js is stale - run `npm run build:sw`');
  assert.ok(assets.includes('./index.html'));
  assert.ok(assets.includes('./src/main.js'));
  assert.ok(assets.some((asset) => asset.startsWith('./src/data/engines/')));
});

/* --- contact and repo metadata ------------------------------------------- */

test('every contact link is valid and uses an icon that exists', () => {
  const names = new Set(ICON_NAMES);
  assert.ok(CONTACT.links.length >= 4);
  for (const link of CONTACT.links) {
    const url = new URL(link.url);
    assert.ok(['https:', 'tel:'].includes(url.protocol), `${link.id} uses an unexpected scheme`);
    assert.ok(names.has(link.icon), `${link.id} uses missing icon "${link.icon}"`);
    assert.ok(link.label && link.labelEn, `${link.id} needs both locales`);
    assert.ok(link.desc && link.descEn, `${link.id} needs a description in both locales`);
  }
});

test('exactly one contact link is marked primary', () => {
  assert.equal(CONTACT.links.filter((link) => link.primary).length, 1);
});

test('the phone number is consistent across its three representations', () => {
  const { display, tel, whatsapp } = CONTACT.phone;
  const digits = display.replace(/\D/g, '');
  assert.equal(digits, '0524545963');
  assert.equal(tel, `+972${digits.slice(1)}`);
  assert.equal(whatsapp, `https://wa.me/972${digits.slice(1)}`);
});

test('the repo carries the metadata a public project needs', async () => {
  const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
  assert.equal(pkg.license, 'MIT');
  assert.ok(pkg.author && pkg.repository?.url && pkg.description);
  assert.ok(pkg.keywords?.length >= 5);
  const license = await readFile(new URL('../LICENSE', import.meta.url), 'utf8');
  assert.match(license, /MIT License/);
  assert.match(license, /Erez Tal-Shir/);
});

/* --- community invitation timing ----------------------------------------- */

test('the invitation is withheld until value has actually landed', () => {
  assert.equal(inviteDecision({ copies: 0, engagement: {} }).reason, 'not-enough-value-yet');
  assert.equal(inviteDecision({ copies: 1, engagement: {} }).show, false);
  assert.equal(inviteDecision({ copies: MIN_COPIES_BEFORE_ASK, engagement: {} }).show, true);
});

test('a dismissal is honoured, then expires', () => {
  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;
  const justDismissed = inviteDecision({ copies: 9, engagement: { dismissedAt: now - day }, now });
  assert.equal(justDismissed.show, false);
  assert.equal(justDismissed.reason, 'recently-dismissed');

  const longAgo = inviteDecision({
    copies: 9,
    engagement: { dismissedAt: now - (DISMISS_COOLDOWN_DAYS + 1) * day },
    now,
  });
  assert.equal(longAgo.show, true);
});

test('joining stops the asking for good', () => {
  const decision = inviteDecision({ copies: 500, engagement: { joined: true } });
  assert.equal(decision.show, false);
  assert.equal(decision.reason, 'already-joined');
});

test('it never appears twice in a day', () => {
  const now = Date.now();
  assert.equal(inviteDecision({ copies: 9, engagement: { shownAt: now - 60_000 }, now }).reason, 'shown-recently');
  assert.equal(inviteDecision({ copies: 9, engagement: { shownAt: now - 25 * 60 * 60 * 1000 }, now }).show, true);
});

test('a joined visitor is never asked, even after a stale dismissal expires', () => {
  const now = Date.now();
  const decision = inviteDecision({
    copies: 99,
    engagement: { joined: true, dismissedAt: now - 400 * 24 * 60 * 60 * 1000 },
    now,
  });
  assert.equal(decision.show, false);
});

test('exactly one contact link is promoted as the primary action', () => {
  const primary = CONTACT.links.filter((link) => link.primary);
  assert.equal(primary.length, 1, 'more than one primary defeats having a primary');
  assert.match(primary[0].url, /^https:\/\/chat\.whatsapp\.com\//);
});

test('the community count is a real snapshot, with the date it was taken', () => {
  const { members, countedAt } = CONTACT.community;
  assert.ok(Number.isInteger(members) && members > 0, 'members must be a counted integer');
  assert.match(countedAt, /^\d{4}-\d{2}-\d{2}$/, 'a snapshot needs the date it was taken');
  assert.ok(!Number.isNaN(Date.parse(countedAt)), 'countedAt must be a real date');
});
