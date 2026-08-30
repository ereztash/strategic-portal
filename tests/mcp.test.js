/**
 * MCP protocol tests.
 *
 * The server is a pure function of its input message, so the whole protocol is
 * exercised here without starting an HTTP server.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  ERROR_CODES,
  LATEST_PROTOCOL_VERSION,
  SUPPORTED_PROTOCOL_VERSIONS,
  TOOLS,
  callTool,
  handleMessage,
  listEngines,
} from '../src/mcp/server.js';
import { coerceArguments, engineToPrompt, missingArguments } from '../src/mcp/adapter.js';
import { BUILTIN_ENGINES } from '../src/data/engines/index.js';
import { CONTACT } from '../src/data/contact.js';
import { ICON_NAMES } from '../src/ui/icons.js';
import { readFile } from 'node:fs/promises';

let nextId = 0;
const rpc = (method, params) => handleMessage({ jsonrpc: '2.0', id: ++nextId, method, params });
const tool = (name, args) => rpc('tools/call', { name, arguments: args }).result;

/* --- lifecycle ----------------------------------------------------------- */

test('initialize echoes a supported protocol version', () => {
  for (const version of SUPPORTED_PROTOCOL_VERSIONS) {
    assert.equal(rpc('initialize', { protocolVersion: version }).result.protocolVersion, version);
  }
});

test('initialize falls back to our latest version when the client asks for one we lack', () => {
  const result = rpc('initialize', { protocolVersion: '1999-01-01' }).result;
  assert.equal(result.protocolVersion, LATEST_PROTOCOL_VERSION);
});

test('initialize advertises exactly the capabilities we implement', () => {
  const { capabilities, serverInfo, instructions } = rpc('initialize', {}).result;
  assert.deepEqual(Object.keys(capabilities).sort(), ['completions', 'prompts', 'tools']);
  assert.ok(serverInfo.name && serverInfo.version);
  assert.ok(instructions.length > 40, 'instructions should tell a client how to drive the server');
});

test('notifications get no reply, so the transport can answer 202', () => {
  assert.equal(handleMessage({ jsonrpc: '2.0', method: 'notifications/initialized' }), null);
  assert.equal(handleMessage({ jsonrpc: '2.0', method: 'notifications/cancelled', params: {} }), null);
});

test('ping answers with an empty result', () => {
  assert.deepEqual(rpc('ping').result, {});
});

test('a malformed message is rejected as an invalid request', () => {
  assert.equal(handleMessage(null).error.code, ERROR_CODES.invalidRequest);
  assert.equal(handleMessage([]).error.code, ERROR_CODES.invalidRequest);
  assert.equal(handleMessage({ jsonrpc: '2.0', id: 1 }).error.code, ERROR_CODES.invalidRequest);
});

test('an unknown method is a method-not-found error', () => {
  assert.equal(rpc('does/not/exist').error.code, ERROR_CODES.methodNotFound);
});

/* --- prompts ------------------------------------------------------------- */

test('prompts/list paginates and hands back a usable cursor', () => {
  const first = rpc('prompts/list').result;
  assert.ok(first.prompts.length > 0);
  assert.ok(first.nextCursor, 'a 50-engine library must paginate');

  const second = rpc('prompts/list', { cursor: first.nextCursor }).result;
  const firstNames = new Set(first.prompts.map((prompt) => prompt.name));
  assert.ok(second.prompts.every((prompt) => !firstNames.has(prompt.name)), 'pages must not overlap');

  // Walk every page and confirm the library is fully reachable.
  const seen = new Set(firstNames);
  let cursor = first.nextCursor;
  while (cursor) {
    const page = rpc('prompts/list', { cursor }).result;
    for (const prompt of page.prompts) seen.add(prompt.name);
    cursor = page.nextCursor;
  }
  assert.equal(seen.size, listEngines().length);
});

test('every engine exposes a well-formed prompt descriptor', () => {
  for (const engine of BUILTIN_ENGINES) {
    const prompt = engineToPrompt(engine);
    assert.equal(prompt.name, engine.id);
    assert.ok(prompt.description.includes(engine.symptom), 'the symptom is the searchable part');
    for (const argument of prompt.arguments) {
      assert.ok(argument.name && argument.description, `${engine.id}/${argument.name} is underspecified`);
      assert.equal(typeof argument.required, 'boolean');
    }
    // MCP arguments are strings only - no type or enum is allowed on them.
    const keys = new Set(prompt.arguments.flatMap((argument) => Object.keys(argument)));
    assert.deepEqual([...keys].sort(), ['description', 'name', 'required']);
  }
});

test('a select field folds its options into the argument description', () => {
  const prompt = engineToPrompt(BUILTIN_ENGINES.find((engine) => engine.id === 'anti-robot'));
  const platform = prompt.arguments.find((argument) => argument.name === 'platform');
  assert.match(platform.description, /לינקדאין/);
});

test('prompts/get renders the same text the web app would', () => {
  const engine = BUILTIN_ENGINES.find((item) => item.id === 'anti-robot');
  const result = rpc('prompts/get', { name: engine.id, arguments: engine.example }).result;
  assert.equal(result.messages.length, 1);
  assert.equal(result.messages[0].role, 'user');
  const text = result.messages[0].content.text;
  assert.ok(text.includes(engine.example.topic));
  assert.ok(!text.includes('{{'), 'no unrendered variables');
  assert.ok(!/\[\[|\]\]/.test(text), 'no unresolved optional blocks');
});

test('every engine renders through prompts/get with its example', () => {
  for (const engine of BUILTIN_ENGINES) {
    const response = rpc('prompts/get', { name: engine.id, arguments: engine.example });
    assert.ok(response.result, `prompts/get failed for ${engine.id}: ${JSON.stringify(response.error)}`);
    const text = response.result.messages[0].content.text;
    assert.ok(text.length > 200, `${engine.id} rendered suspiciously short`);
    assert.ok(!text.includes('{{'), `${engine.id} leaked a variable`);
  }
});

test('prompts/get reports missing required arguments instead of rendering a gap', () => {
  const response = rpc('prompts/get', { name: 'anti-robot', arguments: {} });
  assert.equal(response.error.code, ERROR_CODES.invalidParams);
  assert.deepEqual(response.error.data.missing, ['topic', 'audience']);
});

test('prompts/get on an unknown name is actionable', () => {
  const response = rpc('prompts/get', { name: 'no-such-engine' });
  assert.equal(response.error.code, ERROR_CODES.invalidParams);
  assert.match(response.error.data.hint, /prompts\/list/);
});

/* --- tools --------------------------------------------------------------- */

test('every tool is named, described and annotated', () => {
  assert.ok(TOOLS.length >= 5);
  for (const item of TOOLS) {
    assert.match(item.name, /^portal_[a-z_]+$/, 'tools carry a service prefix');
    assert.ok(item.description.length > 60, `${item.name} needs a fuller description`);
    assert.equal(item.inputSchema.type, 'object');
    assert.equal(item.annotations.readOnlyHint, true, 'this server never mutates anything');
    assert.equal(item.annotations.destructiveHint, false);
  }
});

test('search finds an engine from a symptom sentence', () => {
  const result = tool('portal_search_engines', { query: 'הכתיבה נשמעת רובוטית ומלאה קלישאות', response_format: 'json' });
  assert.equal(result.isError, undefined);
  assert.ok(result.structuredContent.items.some((item) => item.id === 'anti-robot'));
});

test('search returns an actionable message when nothing matches', () => {
  const result = tool('portal_search_engines', { query: 'זברה קוואנטית פינגווין' });
  assert.equal(result.isError, true);
  assert.match(result.content[0].text, /portal_list_engines/);
});

test('list filters compose and paginate', () => {
  const all = tool('portal_list_engines', { response_format: 'json' }).structuredContent;
  assert.equal(all.total, listEngines().length);
  assert.ok(all.has_more, '50 engines must not come back in one page by default');
  assert.equal(all.next_offset, all.count);

  const filtered = tool('portal_list_engines', { category_id: 'code', response_format: 'json' }).structuredContent;
  assert.ok(filtered.total > 0 && filtered.total < all.total);
  assert.ok(filtered.items.every((item) => item.category_id === 'code'));

  const advanced = tool('portal_list_engines', { level: 'advanced', response_format: 'json' }).structuredContent;
  assert.ok(advanced.items.every((item) => item.level === 'advanced'));
});

test('the limit is respected and capped', () => {
  assert.equal(tool('portal_list_engines', { limit: 3, response_format: 'json' }).structuredContent.count, 3);
  assert.ok(tool('portal_list_engines', { limit: 9999, response_format: 'json' }).structuredContent.count <= 100);
});

test('get_engine returns the field spec a caller needs to build inputs', () => {
  const detail = tool('portal_get_engine', { engine_id: 'red-team', response_format: 'json' }).structuredContent;
  assert.equal(detail.id, 'red-team');
  assert.ok(detail.strategy.length > 40);
  assert.ok(detail.fields.some((field) => field.required));
  assert.ok(detail.technique_details.every((item) => item.summary));
  assert.ok(detail.example_inputs);
});

test('get_engine on an unknown id points at how to find a real one', () => {
  const result = tool('portal_get_engine', { engine_id: 'nope' });
  assert.equal(result.isError, true);
  assert.match(result.content[0].text, /portal_search_engines/);
});

test('build_prompt renders, and modifiers are appended', () => {
  const plain = tool('portal_build_prompt', {
    engine_id: 'anti-robot',
    inputs: { topic: 'תמחור', audience: 'פרילנסרים' },
  }).structuredContent.prompt;
  const layered = tool('portal_build_prompt', {
    engine_id: 'anti-robot',
    inputs: { topic: 'תמחור', audience: 'פרילנסרים' },
    modifiers: ['cot'],
  }).structuredContent.prompt;
  assert.ok(plain.includes('תמחור'));
  assert.ok(layered.length > plain.length);
  assert.match(layered, /שלבי החשיבה/);
});

test('build_prompt ignores modifier ids it does not know', () => {
  const result = tool('portal_build_prompt', {
    engine_id: 'anti-robot',
    inputs: { topic: 'א', audience: 'ב' },
    modifiers: ['cot', 'not-a-real-modifier'],
  });
  assert.equal(result.isError, undefined);
});

test('build_prompt names the missing required fields', () => {
  const result = tool('portal_build_prompt', { engine_id: 'anti-robot', inputs: {} });
  assert.equal(result.isError, true);
  assert.match(result.content[0].text, /topic/);
  assert.match(result.content[0].text, /audience/);
});

test('build_prompt can return the naive baseline alongside the engineered one', () => {
  const result = tool('portal_build_prompt', {
    engine_id: 'anti-robot',
    inputs: { topic: 'תמחור', audience: 'פרילנסרים' },
    include_baseline: true,
  });
  assert.ok(result.structuredContent.baseline);
  assert.ok(result.structuredContent.baseline.length < result.structuredContent.prompt.length);
  assert.match(result.content[0].text, /הניסוח הנאיבי/);
});

test('list_modifiers marks which groups are mutually exclusive', () => {
  const { groups } = tool('portal_list_modifiers', { response_format: 'json' }).structuredContent;
  assert.ok(groups.length >= 4);
  assert.ok(groups.some((group) => group.exclusive === true));
  assert.ok(groups.every((group) => group.modifiers.length > 0));
});

test('an unknown tool name is a protocol-level error, not a tool result', () => {
  const response = rpc('tools/call', { name: 'portal_nope', arguments: {} });
  assert.equal(response.error.code, ERROR_CODES.invalidParams);
  assert.ok(response.error.data.available.includes('portal_build_prompt'));
});

test('markdown is the default response format', () => {
  const result = tool('portal_get_engine', { engine_id: 'anti-robot' });
  assert.match(result.content[0].text, /^### /);
});

/* --- completion ---------------------------------------------------------- */

test('completion offers a select field its real options', () => {
  const result = rpc('completion/complete', {
    ref: { type: 'ref/prompt', name: 'anti-robot' },
    argument: { name: 'platform', value: '' },
  }).result;
  assert.ok(result.completion.values.includes('לינקדאין'));
});

test('completion filters by what has been typed', () => {
  const result = rpc('completion/complete', {
    ref: { type: 'ref/prompt', name: 'anti-robot' },
    argument: { name: 'platform', value: 'ניוז' },
  }).result;
  assert.deepEqual(result.completion.values, ['ניוזלטר']);
});

test('completion on a free-text field returns nothing rather than failing', () => {
  const result = rpc('completion/complete', {
    ref: { type: 'ref/prompt', name: 'anti-robot' },
    argument: { name: 'topic', value: 'x' },
  }).result;
  assert.deepEqual(result.completion.values, []);
});

/* --- argument coercion --------------------------------------------------- */

test('a multiselect arrives as a string and becomes a list', () => {
  const engine = BUILTIN_ENGINES.find((item) => item.id === 'repurpose');
  const values = coerceArguments(engine, { channels: 'פוסט לינקדאין, ניוזלטר' });
  assert.deepEqual(values.channels, ['פוסט לינקדאין', 'ניוזלטר']);
  assert.deepEqual(coerceArguments(engine, { channels: ['ניוזלטר'] }).channels, ['ניוזלטר']);
});

test('an empty multiselect still counts as a missing required field', () => {
  const engine = BUILTIN_ENGINES.find((item) => item.id === 'repurpose');
  assert.ok(missingArguments(engine, coerceArguments(engine, { channels: '' })).length >= 1);
});

/* --- contact links ------------------------------------------------------- */

test('every contact link is a valid https URL with an icon that exists', () => {
  const names = new Set(ICON_NAMES);
  assert.ok(CONTACT.links.length >= 3);
  for (const link of CONTACT.links) {
    const url = new URL(link.url);
    assert.equal(url.protocol, 'https:', `${link.id} must be https`);
    assert.ok(names.has(link.icon), `${link.id} uses missing icon "${link.icon}"`);
    assert.ok(link.label && link.labelEn, `${link.id} needs both locales`);
    assert.ok(link.desc && link.descEn, `${link.id} needs a description in both locales`);
  }
});

test('exactly one contact link is marked primary', () => {
  assert.equal(CONTACT.links.filter((link) => link.primary).length, 1);
});

test('the version the MCP server reports matches package.json', async () => {
  const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
  const { serverInfo } = rpc('initialize', {}).result;
  assert.equal(serverInfo.version, pkg.version, 'bump both together');
  assert.equal(pkg.license, 'MIT', 'the repo ships under a licence');
});
