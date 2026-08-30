import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

/*
 * The worker is a classic script, not a module, so it cannot be imported. It
 * is instead run against a minimal stub of the service worker global scope,
 * which is enough to capture its listeners and drive them directly. That is
 * worth the setup: the navigation fallback is the one path that only misbehaves
 * on a real host, and the browser suite exercises it warm, where the bug hides.
 */
async function loadWorker({ caches, fetchImpl }) {
  const source = await readFile(new URL('../sw.js', import.meta.url), 'utf8');
  const listeners = {};
  const self = {
    addEventListener: (type, fn) => { listeners[type] = fn; },
    skipWaiting: () => Promise.resolve(),
    clients: { claim: () => Promise.resolve() },
    location: { origin: 'https://example.test' },
  };
  const context = {
    self, caches, URL, Promise, console,
    fetch: fetchImpl,
    Response: { error: () => ({ isError: true }) },
  };
  vm.createContext(context);
  vm.runInContext(source, context);
  return listeners;
}

/** A cache stub whose entries carry the `redirected` flag verbatim. */
function cacheStub(entries) {
  return {
    match: async (key) => entries[key],
    open: async () => ({ put: async () => {}, add: async () => {}, keys: async () => [] }),
    keys: async () => [],
    delete: async () => true,
  };
}

const navigation = { method: 'GET', url: 'https://example.test/', mode: 'navigate' };

function drive(listener, request) {
  return new Promise((resolve) => {
    listener({ request, respondWith: (value) => resolve(value) });
  });
}

test('an offline navigation is never answered with a redirected response', async () => {
  // A host that redirects /index.html to / - which this one does - makes the
  // precached copy a redirected response. Serving one to a navigation is
  // rejected by the browser, so the page fails to load instead of falling back.
  const caches = cacheStub({
    './': { body: 'shell', redirected: false },
    './index.html': { body: 'shell', redirected: true },
  });
  const listeners = await loadWorker({ caches, fetchImpl: () => Promise.reject(new Error('offline')) });

  const response = await drive(listeners.fetch, navigation);
  assert.equal(response.redirected, false, 'served a redirected response to a navigation');
  assert.equal(response.body, 'shell');
});

test('an offline navigation fails cleanly when only a redirected shell is cached', async () => {
  const caches = cacheStub({ './index.html': { body: 'shell', redirected: true } });
  const listeners = await loadWorker({ caches, fetchImpl: () => Promise.reject(new Error('offline')) });

  const response = await drive(listeners.fetch, navigation);
  assert.ok(response.isError, 'a redirected shell must be refused, not served');
});

test('an offline navigation still serves a clean cached shell', async () => {
  const caches = cacheStub({ './': { body: 'shell', redirected: false } });
  const listeners = await loadWorker({ caches, fetchImpl: () => Promise.reject(new Error('offline')) });

  const response = await drive(listeners.fetch, navigation);
  assert.equal(response.body, 'shell');
});
