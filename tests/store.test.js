import test from 'node:test';
import assert from 'node:assert/strict';

import { createStore, DEFAULTS, SCHEMA_VERSION, TRASH_RETENTION_DAYS } from '../src/core/store.js';

/** A localStorage stand-in that can also be pre-seeded with legacy v1 keys. */
function fakeStorage(seed = {}) {
  const map = new Map(Object.entries(seed));
  return {
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => void map.set(key, String(value)),
    removeItem: (key) => void map.delete(key),
    _dump: () => Object.fromEntries(map),
  };
}

test('returns defaults for slices that were never written', () => {
  const store = createStore({ storage: fakeStorage() });
  assert.deepEqual(store.get('vault'), []);
  assert.equal(store.get('settings').theme, DEFAULTS.settings.theme);
});

test('merges stored settings over defaults so new keys appear after an upgrade', () => {
  const storage = fakeStorage({ 'sp.v2.settings': JSON.stringify({ theme: 'light' }) });
  const store = createStore({ storage });
  const settings = store.get('settings');
  assert.equal(settings.theme, 'light');
  assert.equal(settings.locale, DEFAULTS.settings.locale);
});

test('set and update persist and notify subscribers', () => {
  const store = createStore({ storage: fakeStorage() });
  const seen = [];
  const off = store.subscribe('vault', (value) => seen.push(value.length));
  store.set('vault', [{ id: '1' }]);
  store.update('vault', (vault) => [...vault, { id: '2' }]);
  off();
  store.set('vault', []);
  assert.deepEqual(seen, [1, 2]);
});

test('the wildcard subscriber sees every slice', () => {
  const store = createStore({ storage: fakeStorage() });
  const slices = [];
  store.subscribe('*', (_value, slice) => slices.push(slice));
  store.set('vault', []);
  store.set('favorites', ['a']);
  assert.deepEqual(slices, ['vault', 'favorites']);
});

test('corrupt JSON falls back to defaults instead of throwing', () => {
  const store = createStore({ storage: fakeStorage({ 'sp.v2.vault': '{not json' }) });
  assert.deepEqual(store.get('vault'), []);
});

test('falls back to memory when storage is blocked outright', () => {
  const blocked = {
    getItem: () => null,
    setItem: () => {
      throw new Error('SecurityError');
    },
    removeItem: () => {},
  };
  const store = createStore({ storage: blocked });
  assert.equal(store.persistent, false, 'the UI needs to know it cannot promise persistence');
  store.set('vault', [{ id: '1' }]);
  assert.equal(store.get('vault').length, 1, 'the session stays usable in memory');
});

test('reports a failed write when the quota fills up mid-session', () => {
  let allowWrites = true;
  const filling = {
    getItem: () => null,
    setItem: () => {
      if (!allowWrites) throw new Error('QuotaExceededError');
    },
    removeItem: () => {},
  };
  const store = createStore({ storage: filling });
  assert.equal(store.persistent, true, 'the probe at startup succeeded');
  allowWrites = false;
  assert.equal(store.set('vault', [{ id: '1' }]), false, 'the caller can surface a warning');
  assert.equal(store.get('vault').length, 1, 'the value is still readable from cache');
});

test('export produces a labelled backup and import restores it', () => {
  const source = createStore({ storage: fakeStorage() });
  source.set('vault', [{ id: 'a' }]);
  source.set('favorites', ['anti-robot']);
  const backup = source.exportAll();
  assert.equal(backup.format, 'strategic-portal-backup');
  assert.equal(backup.schemaVersion, SCHEMA_VERSION);

  const target = createStore({ storage: fakeStorage() });
  target.importAll(backup);
  assert.deepEqual(target.get('vault'), [{ id: 'a' }]);
  assert.deepEqual(target.get('favorites'), ['anti-robot']);
});

test('merge import appends unseen rows and keeps existing ones', () => {
  const store = createStore({ storage: fakeStorage() });
  store.set('vault', [{ id: 'a' }]);
  store.importAll({ data: { vault: [{ id: 'a' }, { id: 'b' }] } }, { merge: true });
  assert.deepEqual(
    store.get('vault').map((row) => row.id),
    ['a', 'b'],
  );
});

test('replace import overwrites', () => {
  const store = createStore({ storage: fakeStorage() });
  store.set('vault', [{ id: 'a' }]);
  store.importAll({ data: { vault: [{ id: 'b' }] } });
  assert.deepEqual(
    store.get('vault').map((row) => row.id),
    ['b'],
  );
});

test('a malformed backup is rejected loudly', () => {
  const store = createStore({ storage: fakeStorage() });
  assert.throws(() => store.importAll(null), /INVALID_BACKUP/);
  assert.throws(() => store.importAll('nope'), /INVALID_BACKUP/);
});

test('reset restores one slice or all of them', () => {
  const store = createStore({ storage: fakeStorage() });
  store.set('vault', [{ id: 'a' }]);
  store.set('favorites', ['x']);
  store.reset('vault');
  assert.deepEqual(store.get('vault'), []);
  assert.deepEqual(store.get('favorites'), ['x']);
  store.reset();
  assert.deepEqual(store.get('favorites'), []);
});

test('trash entries past the retention window are purged on load', () => {
  const day = 24 * 60 * 60 * 1000;
  const now = Date.now();
  const storage = fakeStorage({
    'sp.v2.trash': JSON.stringify([
      { id: 'fresh', deletedAt: now - day },
      { id: 'stale', deletedAt: now - (TRASH_RETENTION_DAYS + 1) * day },
    ]),
  });
  const store = createStore({ storage });
  assert.deepEqual(
    store.get('trash').map((row) => row.id),
    ['fresh'],
  );
});

test('migrates the v1 history, stats and custom engines', () => {
  const storage = fakeStorage({
    zeroToAi_history: JSON.stringify([{ id: 1700000000000, toolTitle: 'מחסל הבולשיט', prompt: 'טקסט ישן' }]),
    zeroToAi_stats: JSON.stringify({ totalGen: 7, totalCopied: 3, tools: { 'anti-robot': { generates: 7, copies: 3 } } }),
    zeroToAi_custom: JSON.stringify([
      { id: 'custom_1', title: 'מנוע ישן', fields: [{ id: 'field_1', label: 'נושא', type: 'text' }], template: 'כתוב על {{field_1}}' },
    ]),
  });
  const store = createStore({ storage });

  assert.equal(store.migrationReport.migrated, true);
  assert.equal(store.get('vault').length, 1);
  assert.equal(store.get('vault')[0].engineTitle, 'מחסל הבולשיט');
  assert.equal(store.get('stats').totalGenerated, 7);
  assert.equal(store.get('stats').engines['anti-robot'].copied, 3);
  assert.equal(store.get('customEngines')[0].title, 'מנוע ישן');
  // The legacy keys stay put so an older cached deploy does not lose data.
  assert.ok(storage._dump().zeroToAi_history);
});

test('migration runs once and does not re-import on the next load', () => {
  const storage = fakeStorage({
    zeroToAi_history: JSON.stringify([{ id: 1, toolTitle: 'x', prompt: 'y' }]),
  });
  createStore({ storage });
  const second = createStore({ storage });
  assert.equal(second.migrationReport.migrated, false);
  assert.equal(second.get('vault').length, 1);
});
