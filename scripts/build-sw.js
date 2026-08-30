#!/usr/bin/env node
/**
 * Regenerates the service worker's precache list from what is actually on disk.
 *
 * The project has no bundler on purpose, so the list of ES modules to cache
 * would otherwise drift every time a view is added. `npm run build:sw` rewrites
 * it, and a test asserts the committed sw.js still matches the tree.
 */

import { readdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const ROOT_FILES = ['index.html', 'styles.css', 'manifest.webmanifest'];
const ASSET_DIRS = ['src', 'assets'];
const MARKER_START = '/* --- precache:start --- */';
const MARKER_END = '/* --- precache:end --- */';

async function walk(dir) {
  const entries = await readdir(join(ROOT, dir), { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...(await walk(path)));
    else if (/\.(js|css|svg|json|webmanifest)$/.test(entry.name)) files.push(path);
  }
  return files;
}

export async function collectAssets() {
  const nested = await Promise.all(ASSET_DIRS.map(walk));
  return ['./', ...ROOT_FILES, ...nested.flat()]
    .map((path) => (path === './' ? './' : `./${relative('.', path).split(sep).join('/')}`))
    .sort();
}

/** A digest of the asset list, used as the cache name so updates take effect. */
export function versionFor(assets) {
  return createHash('sha256').update(assets.join('|')).digest('hex').slice(0, 10);
}

export function renderBlock(assets, version) {
  return [
    MARKER_START,
    `const CACHE_VERSION = '${version}';`,
    'const PRECACHE = [',
    ...assets.map((asset) => `  '${asset}',`),
    '];',
    MARKER_END,
  ].join('\n');
}

export async function buildServiceWorker() {
  const assets = await collectAssets();
  const version = versionFor(assets);
  const source = await readFile(join(ROOT, 'sw.js'), 'utf8');
  const start = source.indexOf(MARKER_START);
  const end = source.indexOf(MARKER_END);
  if (start === -1 || end === -1) throw new Error('sw.js is missing the precache markers');
  const next = source.slice(0, start) + renderBlock(assets, version) + source.slice(end + MARKER_END.length);
  return { source, next, assets, version };
}

/** True when the committed sw.js already matches the tree, ignoring line endings. */
export function isCurrent({ source, next }) {
  return source.replace(/\r\n/g, '\n') === next.replace(/\r\n/g, '\n');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { source, next, assets } = await buildServiceWorker();
  if (isCurrent({ source, next })) {
    console.log(`sw.js already lists ${assets.length} assets`);
  } else {
    await writeFile(join(ROOT, 'sw.js'), next);
    console.log(`sw.js updated with ${assets.length} assets`);
  }
}
