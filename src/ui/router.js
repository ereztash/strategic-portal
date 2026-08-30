/**
 * Hash router.
 *
 * Deep links matter here for two reasons: a generated prompt is worth sharing,
 * and a bookmark to a specific engine is how people come back to one they use
 * weekly. v1 kept the whole view in memory, so a refresh dropped you home.
 *
 * Routes:
 *   #/                     home
 *   #/c/:categoryId        category
 *   #/e/:engineId          generator (accepts ?v=<encoded inputs>)
 *   #/vault                saved prompts
 *   #/builder[/:id]        custom engine builder
 *   #/stats, #/settings
 *   #/search?q=...
 */

const ROUTES = [
  { name: 'home', pattern: /^\/?$/ },
  { name: 'category', pattern: /^\/c\/([^/?]+)$/, keys: ['categoryId'] },
  { name: 'engine', pattern: /^\/e\/([^/?]+)$/, keys: ['engineId'] },
  { name: 'vault', pattern: /^\/vault$/ },
  { name: 'trash', pattern: /^\/vault\/trash$/ },
  { name: 'builder', pattern: /^\/builder$/ },
  { name: 'builderEdit', pattern: /^\/builder\/([^/?]+)$/, keys: ['engineId'] },
  { name: 'stats', pattern: /^\/stats$/ },
  { name: 'settings', pattern: /^\/settings$/ },
  { name: 'search', pattern: /^\/search$/ },
];

/** Parse a hash string into `{ name, params, query }`. */
export function parseHash(hash) {
  const raw = String(hash ?? '').replace(/^#/, '') || '/';
  const [pathPart, queryPart = ''] = raw.split('?');
  const path = decodeURI(pathPart) || '/';
  const query = Object.fromEntries(new URLSearchParams(queryPart));

  for (const route of ROUTES) {
    const match = path.match(route.pattern);
    if (!match) continue;
    const params = {};
    (route.keys ?? []).forEach((key, position) => {
      params[key] = decodeURIComponent(match[position + 1]);
    });
    return { name: route.name, params, query, path };
  }
  return { name: 'notFound', params: {}, query, path };
}

/** Build a hash for a route. `buildHash('engine', { engineId: 'x' })`. */
export function buildHash(name, params = {}, query = {}) {
  let path = '/';
  if (name === 'category') path = `/c/${encodeURIComponent(params.categoryId)}`;
  else if (name === 'engine') path = `/e/${encodeURIComponent(params.engineId)}`;
  else if (name === 'builderEdit') path = `/builder/${encodeURIComponent(params.engineId)}`;
  else if (name !== 'home') path = `/${name === 'trash' ? 'vault/trash' : name}`;

  const search = new URLSearchParams(
    Object.entries(query).filter(([, value]) => value !== undefined && value !== null && value !== ''),
  ).toString();
  return `#${path}${search ? `?${search}` : ''}`;
}

export function createRouter(onChange) {
  let current = null;

  function handle() {
    current = parseHash(window.location.hash);
    onChange(current);
  }

  return {
    start() {
      window.addEventListener('hashchange', handle);
      handle();
    },
    current() {
      return current;
    },
    /** Navigate, pushing a history entry. */
    go(name, params, query) {
      window.location.hash = buildHash(name, params, query);
    },
    /**
     * Change the URL without re-rendering, so the generator can keep the share
     * link in step with the form. `replaceState` deliberately does not fire
     * `hashchange`, which is exactly why no re-render happens here - and why
     * this must never try to suppress the next one.
     */
    silent(name, params, query) {
      const next = buildHash(name, params, query);
      if (next === window.location.hash) return;
      window.history.replaceState(null, '', next);
      current = parseHash(next);
    },
    back() {
      window.history.back();
    },
  };
}

/**
 * Encode form values into a share link. Base64 of JSON, made URL-safe.
 * Unicode-aware, because every value in this app is Hebrew.
 */
export function encodeState(value) {
  const json = JSON.stringify(value);
  const bytes = new TextEncoder().encode(json);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function decodeState(encoded) {
  try {
    const padded = String(encoded).replace(/-/g, '+').replace(/_/g, '/');
    const binary = atob(padded + '='.repeat((4 - (padded.length % 4)) % 4));
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    return null;
  }
}
