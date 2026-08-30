/**
 * MCP protocol handling, as pure functions.
 *
 * Deliberately transport-free: `handleMessage` takes a parsed JSON-RPC message
 * and returns a response object (or `null` for a notification, which the HTTP
 * layer answers with 202). That keeps the whole protocol unit-testable without
 * a server, in the same spirit as the rest of `src/core`.
 *
 * The server is stateless - it issues no `Mcp-Session-Id` and holds nothing
 * between requests - which is what makes it deployable as a serverless
 * function. The spec permits this: session IDs are a MAY, and a server that
 * offers no server-initiated stream answers GET with 405.
 */

import { BUILTIN_ENGINES } from '../data/engines/index.js';
import { CATEGORIES, getCategory } from '../data/categories.js';
import { TECHNIQUES } from '../core/techniques.js';
import { MODIFIERS, MODIFIER_GROUPS } from '../core/modifiers.js';
import { buildIndex, search as runSearch } from '../core/search.js';
import { render } from '../core/template.js';
import {
  buildPromptText,
  engineDetail,
  engineSummary,
  engineToMarkdown,
  engineToPrompt,
  missingArguments,
  promptResult,
  coerceArguments,
} from './adapter.js';

export const SERVER_INFO = {
  name: 'strategic-portal',
  title: 'מ-0 ל-AI · פורטל אסטרטגי',
  version: '2.1.0',
};

/** Newest first. The first entry is what we answer with when we can't agree. */
export const SUPPORTED_PROTOCOL_VERSIONS = ['2025-06-18', '2025-03-26', '2024-11-05'];
export const LATEST_PROTOCOL_VERSION = SUPPORTED_PROTOCOL_VERSIONS[0];

export const ERROR_CODES = {
  parseError: -32700,
  invalidRequest: -32600,
  methodNotFound: -32601,
  invalidParams: -32602,
  internalError: -32603,
};

const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 100;

const INSTRUCTIONS = [
  'ספריית פרומפטים מהונדסים שמאורגנת לפי הכאב, לא לפי שם הכלי.',
  'כל מנוע חושף גם prompt (עם ארגומנטים) וגם ניתן לבנייה דרך הכלי portal_build_prompt.',
  'זרימה מומלצת: portal_search_engines לפי תיאור הבעיה במילים של המשתמש,',
  'ואז portal_get_engine כדי לראות אילו שדות נדרשים, ואז portal_build_prompt.',
  'הפלט של build הוא טקסט פרומפט מוכן - הצג אותו למשתמש או השתמש בו כהוראה.',
].join(' ');

/* ------------------------------------------------------------------------- */
/* Registry                                                                   */
/* ------------------------------------------------------------------------- */

const ENGINES = BUILTIN_ENGINES.map((engine) => ({
  ...engine,
  categoryTitle: getCategory(engine.categoryId)?.title ?? '',
}));
const BY_ID = new Map(ENGINES.map((engine) => [engine.id, engine]));
const INDEX = buildIndex(ENGINES);

export function listEngines() {
  return ENGINES;
}

export function getEngine(id) {
  return BY_ID.get(id) ?? null;
}

/* ------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* ------------------------------------------------------------------------- */

function ok(id, result) {
  return { jsonrpc: '2.0', id, result };
}

function fail(id, code, message, data) {
  const error = { code, message };
  if (data !== undefined) error.data = data;
  return { jsonrpc: '2.0', id, error };
}

/** A tool-level failure: reported in the result so the model can self-correct. */
function toolError(message) {
  return { content: [{ type: 'text', text: message }], isError: true };
}

function toolOk(text, structured) {
  const result = { content: [{ type: 'text', text }] };
  if (structured !== undefined) result.structuredContent = structured;
  return result;
}

function clampLimit(value) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_LIMIT;
  return Math.min(parsed, MAX_LIMIT);
}

function clampOffset(value) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

/** Slice with the pagination envelope the best-practice guide asks for. */
function paginate(items, offset, limit) {
  const page = items.slice(offset, offset + limit);
  const nextOffset = offset + page.length;
  return {
    total: items.length,
    count: page.length,
    offset,
    has_more: nextOffset < items.length,
    next_offset: nextOffset < items.length ? nextOffset : null,
    items: page,
  };
}

/* ------------------------------------------------------------------------- */
/* Tools                                                                      */
/* ------------------------------------------------------------------------- */

const RESPONSE_FORMAT = {
  type: 'string',
  enum: ['markdown', 'json'],
  default: 'markdown',
  description: 'markdown לקריאה אנושית, json לעיבוד תוכנתי.',
};

export const TOOLS = [
  {
    name: 'portal_search_engines',
    title: 'Search prompt engines by symptom',
    description:
      'מחפש מנוע פרומפטים לפי תיאור הבעיה במילים של המשתמש, לא לפי שם הכלי. ' +
      'זו נקודת הכניסה המומלצת: העבירו את התלונה כפי שנאמרה, למשל "הטקסט נשמע רובוטי" או ' +
      '"ה-AI ממציא עובדות". מחזיר מנועים מדורגים לפי התאמה.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'תיאור הבעיה או הכאב, בעברית או באנגלית.' },
        limit: { type: 'integer', minimum: 1, maximum: MAX_LIMIT, default: DEFAULT_LIMIT },
        offset: { type: 'integer', minimum: 0, default: 0 },
        response_format: RESPONSE_FORMAT,
      },
      required: ['query'],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
  {
    name: 'portal_list_engines',
    title: 'Browse prompt engines',
    description:
      'מדפדף בספריית המנועים, עם סינון אופציונלי לפי תחום, טכניקת פרומפטינג או רמה. ' +
      'להשתמש כשאין תלונה ספציפית לחפש לפיה; אחרת portal_search_engines מדויק יותר.',
    inputSchema: {
      type: 'object',
      properties: {
        category_id: { type: 'string', enum: CATEGORIES.map((category) => category.id), description: 'סינון לפי תחום.' },
        technique: { type: 'string', enum: Object.keys(TECHNIQUES), description: 'סינון לפי טכניקת פרומפטינג.' },
        level: { type: 'string', enum: ['basic', 'intermediate', 'advanced'], description: 'סינון לפי רמה.' },
        limit: { type: 'integer', minimum: 1, maximum: MAX_LIMIT, default: DEFAULT_LIMIT },
        offset: { type: 'integer', minimum: 0, default: 0 },
        response_format: RESPONSE_FORMAT,
      },
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
  {
    name: 'portal_get_engine',
    title: 'Get one engine, with its input fields',
    description:
      'מחזיר את המפרט המלא של מנוע: הכאב שהוא פותר, הלוגיקה האסטרטגית, הטכניקות, ' +
      'וחשוב מכל - רשימת השדות שצריך למלא. יש לקרוא לזה לפני portal_build_prompt ' +
      'כדי לדעת אילו מפתחות להעביר ב-inputs.',
    inputSchema: {
      type: 'object',
      properties: {
        engine_id: { type: 'string', description: 'מזהה המנוע, כפי שהוחזר מחיפוש או מדפדוף.' },
        response_format: RESPONSE_FORMAT,
      },
      required: ['engine_id'],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
  {
    name: 'portal_build_prompt',
    title: 'Render an engineered prompt',
    description:
      'מרנדר את הפרומפט המהונדס הסופי ממנוע ומערכי הקלט. ' +
      'המפתחות ב-inputs הם מזהי השדות מ-portal_get_engine. ' +
      'ניתן להוסיף modifiers - שכבות הוראה שמורכבות על כל מנוע. ' +
      'עם include_baseline מוחזרת גם הגרסה הנאיבית, להשוואה חינוכית.',
    inputSchema: {
      type: 'object',
      properties: {
        engine_id: { type: 'string', description: 'מזהה המנוע.' },
        inputs: {
          type: 'object',
          description: 'מיפוי של מזהה שדה לערך. שדות חסרים פשוט יושמטו מהפרומפט.',
          additionalProperties: { type: ['string', 'number', 'boolean', 'array'] },
        },
        modifiers: {
          type: 'array',
          items: { type: 'string', enum: MODIFIERS.map((modifier) => modifier.id) },
          description: 'שכבות הוראה נוספות. ראו portal_list_modifiers.',
        },
        include_baseline: {
          type: 'boolean',
          default: false,
          description: 'להחזיר גם את הניסוח הנאיבי שרוב האנשים היו כותבים, להשוואה.',
        },
      },
      required: ['engine_id'],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
  {
    name: 'portal_list_modifiers',
    title: 'List the composable prompt layers',
    description:
      'מחזיר את שכבות ההוראה שאפשר להרכיב על כל מנוע - עומק חשיבה, פורמט פלט, אורך, שפה ובקרת איכות. ' +
      'שכבות מאותה קבוצה בלעדית דורסות זו את זו.',
    inputSchema: { type: 'object', properties: { response_format: RESPONSE_FORMAT }, additionalProperties: false },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
];

const TOOL_NAMES = new Set(TOOLS.map((tool) => tool.name));

function renderEngineList(payload, format, { detailed = false } = {}) {
  if (format === 'json') {
    return toolOk(JSON.stringify({ ...payload, items: payload.items.map(engineSummary) }, null, 2), {
      ...payload,
      items: payload.items.map(engineSummary),
    });
  }
  const header = `נמצאו ${payload.total} מנועים · מוצגים ${payload.count}${payload.has_more ? ` (יש עוד, offset הבא: ${payload.next_offset})` : ''}`;
  const body = payload.items.map((engine) => engineToMarkdown(engine, { detailed })).join('\n\n');
  return toolOk(payload.count === 0 ? 'לא נמצאו מנועים תואמים.' : `${header}\n\n${body}`);
}

export function callTool(name, args = {}) {
  const format = args.response_format === 'json' ? 'json' : 'markdown';

  if (name === 'portal_search_engines') {
    const query = String(args.query ?? '').trim();
    if (!query) return toolError('חובה להעביר query. תארו את הבעיה במילים של המשתמש.');
    const hits = runSearch(INDEX, query, { limit: MAX_LIMIT }).map((hit) => hit.engine);
    if (hits.length === 0) {
      return toolError(
        `לא נמצא מנוע תואם ל"${query}". נסו לנסח את הבעיה אחרת, או השתמשו ב-portal_list_engines כדי לדפדף לפי תחום.`,
      );
    }
    return renderEngineList(paginate(hits, clampOffset(args.offset), clampLimit(args.limit)), format);
  }

  if (name === 'portal_list_engines') {
    let engines = listEngines();
    if (args.category_id) engines = engines.filter((engine) => engine.categoryId === args.category_id);
    if (args.level) engines = engines.filter((engine) => engine.level === args.level);
    if (args.technique) engines = engines.filter((engine) => (engine.techniques ?? []).includes(args.technique));
    return renderEngineList(paginate(engines, clampOffset(args.offset), clampLimit(args.limit)), format);
  }

  if (name === 'portal_get_engine') {
    const engine = getEngine(String(args.engine_id ?? ''));
    if (!engine) {
      return toolError(
        `אין מנוע בשם "${args.engine_id}". השתמשו ב-portal_search_engines או ב-portal_list_engines כדי למצוא מזהה תקין.`,
      );
    }
    const detail = engineDetail(engine);
    if (format === 'json') return toolOk(JSON.stringify(detail, null, 2), detail);
    return toolOk(engineToMarkdown(engine, { detailed: true }), detail);
  }

  if (name === 'portal_build_prompt') {
    const engine = getEngine(String(args.engine_id ?? ''));
    if (!engine) {
      return toolError(
        `אין מנוע בשם "${args.engine_id}". השתמשו ב-portal_search_engines כדי למצוא מזהה תקין.`,
      );
    }
    const inputs = args.inputs && typeof args.inputs === 'object' ? args.inputs : {};
    const values = coerceArguments(engine, inputs);
    const missing = missingArguments(engine, values);
    if (missing.length) {
      const spec = (engine.fields ?? [])
        .filter((field) => missing.includes(field.id))
        .map((field) => `- ${field.id}: ${field.label}`)
        .join('\n');
      return toolError(`חסרים שדות חובה עבור "${engine.id}":\n${spec}\n\nהעבירו אותם ב-inputs ונסו שוב.`);
    }

    const prompt = buildPromptText(engine, inputs, args.modifiers ?? []);
    const structured = { engine_id: engine.id, engine_title: engine.title, prompt };
    let text = prompt;
    if (args.include_baseline && engine.generic) {
      structured.baseline = render(engine.generic, values).text;
      text = `## הפרומפט המהונדס\n\n${prompt}\n\n---\n\n## הניסוח הנאיבי, להשוואה\n\n${structured.baseline}`;
    }
    return toolOk(text, structured);
  }

  if (name === 'portal_list_modifiers') {
    const groups = MODIFIER_GROUPS.map((group) => ({
      id: group.id,
      label: group.label,
      exclusive: group.exclusive,
      modifiers: MODIFIERS.filter((modifier) => modifier.group === group.id).map((modifier) => ({
        id: modifier.id,
        label: modifier.label,
        hint: modifier.hint,
      })),
    }));
    if (format === 'json') return toolOk(JSON.stringify({ groups }, null, 2), { groups });
    const text = groups
      .map((group) => {
        const head = `### ${group.label}${group.exclusive ? ' (בלעדי - אחד בלבד)' : ''}`;
        const rows = group.modifiers.map((modifier) => `- \`${modifier.id}\` · ${modifier.label} — ${modifier.hint}`);
        return [head, ...rows].join('\n');
      })
      .join('\n\n');
    return toolOk(text, { groups });
  }

  return toolError(`אין כלי בשם "${name}".`);
}

/* ------------------------------------------------------------------------- */
/* Completion                                                                 */
/* ------------------------------------------------------------------------- */

/**
 * Argument autocompletion. MCP prompt arguments carry no enum, so this is how a
 * client can still offer a select field's real options instead of free text.
 */
export function complete(params = {}) {
  const { ref, argument } = params;
  const values = [];

  if (ref?.type === 'ref/prompt') {
    const engine = getEngine(ref.name);
    const field = engine?.fields?.find((item) => item.id === argument?.name);
    if (field?.options) {
      const typed = String(argument?.value ?? '').toLowerCase();
      values.push(...field.options.filter((option) => option.toLowerCase().includes(typed)));
    }
  }

  return { completion: { values: values.slice(0, 100), total: values.length, hasMore: false } };
}

/* ------------------------------------------------------------------------- */
/* Dispatch                                                                   */
/* ------------------------------------------------------------------------- */

function handleInitialize(id, params) {
  const requested = params?.protocolVersion;
  // Spec: echo the client's version when we support it, otherwise answer with
  // our latest and let the client decide whether to continue.
  const protocolVersion = SUPPORTED_PROTOCOL_VERSIONS.includes(requested) ? requested : LATEST_PROTOCOL_VERSION;
  return ok(id, {
    protocolVersion,
    capabilities: { prompts: {}, tools: {}, completions: {} },
    serverInfo: SERVER_INFO,
    instructions: INSTRUCTIONS,
  });
}

function handlePromptsList(id, params) {
  const offset = clampOffset(params?.cursor);
  const page = paginate(listEngines(), offset, DEFAULT_LIMIT);
  const result = { prompts: page.items.map(engineToPrompt) };
  if (page.has_more) result.nextCursor = String(page.next_offset);
  return ok(id, result);
}

function handlePromptsGet(id, params) {
  const engine = getEngine(String(params?.name ?? ''));
  if (!engine) {
    return fail(id, ERROR_CODES.invalidParams, `Unknown prompt: ${params?.name}`, {
      available: listEngines().length,
      hint: 'Call prompts/list to see valid prompt names.',
    });
  }
  const args = params?.arguments ?? {};
  const missing = missingArguments(engine, coerceArguments(engine, args));
  if (missing.length) {
    return fail(id, ERROR_CODES.invalidParams, `Missing required arguments: ${missing.join(', ')}`, { missing });
  }
  return ok(id, promptResult(engine, args, args.__modifiers ?? []));
}

/**
 * Handle one JSON-RPC message.
 * @returns the response object, or `null` for a notification (no reply owed).
 */
export function handleMessage(message) {
  if (!message || typeof message !== 'object' || Array.isArray(message)) {
    return fail(null, ERROR_CODES.invalidRequest, 'Request must be a JSON-RPC object');
  }
  const { id = null, method, params } = message;
  if (typeof method !== 'string') {
    return fail(id, ERROR_CODES.invalidRequest, 'Missing method');
  }

  // Notifications carry no id and get no reply; the transport answers 202.
  const isNotification = message.id === undefined || message.id === null;
  if (method.startsWith('notifications/')) return null;

  try {
    switch (method) {
      case 'initialize':
        return handleInitialize(id, params);
      case 'ping':
        return ok(id, {});
      case 'prompts/list':
        return handlePromptsList(id, params);
      case 'prompts/get':
        return handlePromptsGet(id, params);
      case 'tools/list':
        return ok(id, { tools: TOOLS });
      case 'tools/call': {
        const name = params?.name;
        if (!TOOL_NAMES.has(name)) {
          return fail(id, ERROR_CODES.invalidParams, `Unknown tool: ${name}`, {
            available: [...TOOL_NAMES],
          });
        }
        return ok(id, callTool(name, params?.arguments ?? {}));
      }
      case 'completion/complete':
        return ok(id, complete(params));
      case 'resources/list':
        return ok(id, { resources: [] });
      default:
        if (isNotification) return null;
        return fail(id, ERROR_CODES.methodNotFound, `Method not found: ${method}`);
    }
  } catch (error) {
    return fail(id, ERROR_CODES.internalError, error?.message ?? 'Internal error');
  }
}
