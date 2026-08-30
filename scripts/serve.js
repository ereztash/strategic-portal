#!/usr/bin/env node
/** Minimal static server for local development: `npm run serve`. */

import { createServer } from 'node:http';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const PORT = Number(process.env.PORT ?? 4173);

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.woff2': 'font/woff2',
};

createServer(async (request, response) => {
  const url = new URL(request.url, `http://localhost:${PORT}`);

  // The host redirects `/index.html` to `/`, and that is not cosmetic: it is
  // why the precached copy of index.html carries a redirect flag, which a
  // navigation may not be served. Testing offline against a server that
  // answers /index.html directly hides the failure entirely, so this one
  // redirects too.
  if (url.pathname === '/index.html') {
    response.writeHead(308, { location: './', 'content-type': 'text/plain' }).end('Redirecting...');
    return;
  }

  // normalize + prefix check keeps `../` traversal out of the served tree.
  const target = normalize(join(ROOT, decodeURIComponent(url.pathname)));
  if (!target.startsWith(ROOT)) {
    response.writeHead(403).end('Forbidden');
    return;
  }

  let file = target;
  try {
    const info = await stat(file);
    if (info.isDirectory()) file = join(file, 'index.html');
  } catch {
    file = join(ROOT, 'index.html');
  }

  try {
    await stat(file);
  } catch {
    response.writeHead(404).end('Not found');
    return;
  }

  response.writeHead(200, {
    'content-type': TYPES[extname(file)] ?? 'application/octet-stream',
    'cache-control': 'no-store',
  });
  createReadStream(file).pipe(response);
}).listen(PORT, () => console.log(`http://localhost:${PORT}`));
