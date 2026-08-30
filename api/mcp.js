/**
 * MCP endpoint (Streamable HTTP, stateless).
 *
 * A serverless function on Vercel. Everything it does is delegated to
 * `src/mcp/server.js`, which is pure and unit-tested; this file only owns HTTP
 * concerns: method routing, CORS, header validation, and the status codes the
 * transport spec requires.
 *
 * Stateless by design - no `Mcp-Session-Id` is issued, so there is nothing to
 * keep between invocations. The spec permits this: session IDs are a MAY, and a
 * server offering no server-initiated stream answers GET with 405.
 *
 * Connect it from Claude with:
 *   claude mcp add --transport http strategic-portal https://<host>/api/mcp
 * or as a custom connector in the Claude web app.
 */

import { handleMessage, SUPPORTED_PROTOCOL_VERSIONS } from '../src/mcp/server.js';

/** Absent header means an older client; the spec says assume 2025-03-26. */
const ASSUMED_PROTOCOL_VERSION = '2025-03-26';

const CORS_HEADERS = {
  // Every route here is public, read-only prompt content: no credentials, no
  // per-user state, nothing private to reach. The transport spec's Origin rule
  // exists to stop DNS rebinding against *local* servers, where an attacker
  // would gain access to the user's machine. There is no such asset behind this
  // endpoint, so a wildcard is the correct answer rather than an allowlist that
  // would silently break legitimate clients.
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, GET, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, MCP-Protocol-Version, Mcp-Session-Id, Authorization',
  'Access-Control-Max-Age': '86400',
};

function applyHeaders(response) {
  for (const [key, value] of Object.entries(CORS_HEADERS)) response.setHeader(key, value);
  response.setHeader('Cache-Control', 'no-store');
}

/** Vercel parses JSON bodies, but be tolerant of a raw string or stream. */
async function readBody(request) {
  if (request.body !== undefined && request.body !== null && request.body !== '') {
    if (typeof request.body === 'string') return JSON.parse(request.body);
    if (Buffer.isBuffer(request.body)) return JSON.parse(request.body.toString('utf8'));
    return request.body;
  }
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString('utf8');
  return raw ? JSON.parse(raw) : null;
}

export default async function handler(request, response) {
  applyHeaders(response);

  if (request.method === 'OPTIONS') {
    response.status(204).end();
    return;
  }

  // No server-initiated stream is offered, so GET and DELETE are 405 - which
  // the spec names explicitly as the correct answer for both.
  if (request.method === 'GET' || request.method === 'DELETE') {
    response.setHeader('Allow', 'POST, OPTIONS');
    response.status(405).json({
      jsonrpc: '2.0',
      id: null,
      error: { code: -32601, message: 'This MCP endpoint is stateless and accepts POST only.' },
    });
    return;
  }

  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST, OPTIONS');
    response.status(405).end();
    return;
  }

  const version = request.headers['mcp-protocol-version'] ?? ASSUMED_PROTOCOL_VERSION;
  if (!SUPPORTED_PROTOCOL_VERSIONS.includes(version)) {
    response.status(400).json({
      jsonrpc: '2.0',
      id: null,
      error: {
        code: -32600,
        message: `Unsupported MCP-Protocol-Version: ${version}`,
        data: { supported: SUPPORTED_PROTOCOL_VERSIONS },
      },
    });
    return;
  }

  let body;
  try {
    body = await readBody(request);
  } catch {
    response.status(400).json({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } });
    return;
  }

  // Batching was dropped in 2025-06-18 but older clients may still send an
  // array, so handle both shapes.
  const messages = Array.isArray(body) ? body : [body];
  const replies = messages.map(handleMessage).filter((reply) => reply !== null);

  // A body of only notifications or responses owes no reply: 202, no content.
  if (replies.length === 0) {
    response.status(202).end();
    return;
  }

  response.status(200).json(Array.isArray(body) ? replies : replies[0]);
}
