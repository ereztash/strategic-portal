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
};

/**
 * Minimal stand-in for the Vercel Node runtime, so `/api/*` functions can be
 * exercised locally with `npm run serve` instead of needing the Vercel CLI.
 */
async function serveFunction(request, response, name) {
  let handler;
  try {
    ({ default: handler } = await import(new URL(`../api/${name}.js`, import.meta.url).href));
  } catch {
    response.writeHead(404).end('No such function');
    return;
  }
  response.status = (code) => {
    response.statusCode = code;
    return response;
  };
  response.json = (body) => {
    response.setHeader('content-type', 'application/json; charset=utf-8');
    response.end(JSON.stringify(body));
  };
  await handler(request, response);
}

createServer(async (request, response) => {
  const url = new URL(request.url, `http://localhost:${PORT}`);

  const apiMatch = url.pathname.match(/^\/api\/([A-Za-z0-9_-]+)\/?$/);
  if (apiMatch) {
    await serveFunction(request, response, apiMatch[1]);
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
