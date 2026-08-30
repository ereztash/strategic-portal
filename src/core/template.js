/**
 * Prompt template engine.
 *
 * Syntax (deliberately small, and compatible with the `{{var}}` convention used
 * by most prompt libraries so templates stay portable):
 *
 *   {{name}}                 - interpolate a value; empty when missing
 *   {{name ?? fallback}}     - interpolate, or use the literal fallback if empty
 *   [[ ...{{name}}... ]]     - optional block: removed entirely when every
 *                              variable inside it is empty
 *   <<fragmentKey>>          - expand a named fragment (used by the modifiers)
 *
 * Everything in this module is pure so it can be unit tested without a DOM.
 */

const VARIABLE_RE = /\{\{\s*([\p{Letter}\p{Number}_][\p{Letter}\p{Number}_\-.]*)\s*(?:\?\?([^}]*))?\}\}/gu;
const FRAGMENT_RE = /<<\s*([\p{Letter}\p{Number}_][\p{Letter}\p{Number}_\-.]*)\s*>>/gu;
const OPTIONAL_OPEN = '[[';
const OPTIONAL_CLOSE = ']]';
const MAX_FRAGMENT_DEPTH = 5;

/** True when a value contributes nothing to the rendered prompt. */
export function isBlank(value) {
  if (value === null || value === undefined) return true;
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === 'boolean') return value === false;
  return String(value).trim() === '';
}

/** Convert any field value into the string that lands inside the prompt. */
export function stringifyValue(value) {
  if (value === null || value === undefined) return '';
  if (Array.isArray(value)) return value.filter((item) => !isBlank(item)).join(', ');
  if (typeof value === 'boolean') return value ? 'כן' : '';
  return String(value).trim();
}

/** List every variable name referenced by a template, in first-appearance order. */
export function extractVariables(template) {
  const found = [];
  const seen = new Set();
  for (const match of String(template ?? '').matchAll(VARIABLE_RE)) {
    const name = match[1];
    if (!seen.has(name)) {
      seen.add(name);
      found.push(name);
    }
  }
  return found;
}

/** List every fragment key referenced by a template. */
export function extractFragments(template) {
  const found = new Set();
  for (const match of String(template ?? '').matchAll(FRAGMENT_RE)) found.add(match[1]);
  return [...found];
}

/**
 * Resolve `[[optional]]` blocks. Handles nesting by resolving the innermost
 * block first and working outwards.
 */
function resolveOptionalBlocks(template, values) {
  let text = String(template ?? '');
  let guard = 0;
  while (guard < 100) {
    guard += 1;
    const close = text.indexOf(OPTIONAL_CLOSE);
    if (close === -1) break;
    const open = text.lastIndexOf(OPTIONAL_OPEN, close);
    if (open === -1) break;

    const body = text.slice(open + OPTIONAL_OPEN.length, close);
    const names = extractVariables(body);
    // A block with no variables is always kept; otherwise it needs at least one
    // non-empty variable to survive.
    const keep = names.length === 0 || names.some((name) => !isBlank(values[name]));
    text = text.slice(0, open) + (keep ? body : '') + text.slice(close + OPTIONAL_CLOSE.length);
  }
  return text;
}

/** Expand `<<fragment>>` references, guarding against cycles. */
function expandFragments(template, fragments, depth = 0) {
  if (depth >= MAX_FRAGMENT_DEPTH) return String(template ?? '');
  let changed = false;
  const expanded = String(template ?? '').replace(FRAGMENT_RE, (whole, key) => {
    if (!Object.prototype.hasOwnProperty.call(fragments, key)) return whole;
    changed = true;
    return String(fragments[key] ?? '');
  });
  return changed ? expandFragments(expanded, fragments, depth + 1) : expanded;
}

/** Collapse the blank lines that optional blocks tend to leave behind. */
export function tidy(text) {
  return String(text ?? '')
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Render a template.
 * @returns {{ text: string, missing: string[], used: string[] }}
 */
export function render(template, values = {}, options = {}) {
  const { fragments = {}, keepMissing = false } = options;
  const withFragments = expandFragments(template, fragments);
  const withOptional = resolveOptionalBlocks(withFragments, values);

  const missing = [];
  const used = [];
  const text = withOptional.replace(VARIABLE_RE, (whole, name, fallback) => {
    const raw = values[name];
    if (isBlank(raw)) {
      if (fallback !== undefined) return fallback.trim();
      if (!missing.includes(name)) missing.push(name);
      return keepMissing ? whole : '';
    }
    if (!used.includes(name)) used.push(name);
    return stringifyValue(raw);
  });

  return { text: tidy(text), missing, used };
}

/**
 * Static analysis for the no-code builder: which variables have no matching
 * field, and which fields are never referenced.
 */
export function analyzeTemplate(template, fieldIds = []) {
  const variables = extractVariables(template);
  const ids = new Set(fieldIds);
  return {
    variables,
    unknownVariables: variables.filter((name) => !ids.has(name)),
    unusedFields: fieldIds.filter((id) => !variables.includes(id)),
  };
}

/**
 * Compose the final prompt: engine output first, then any enabled modifiers
 * appended as an extra instruction block. Mirrors the "fragment" composition
 * pattern used by CLI prompt libraries, adapted to a single text output.
 */
export function composePrompt(basePrompt, modifiers = [], heading = 'הנחיות נוספות') {
  const extras = modifiers.map((mod) => String(mod ?? '').trim()).filter(Boolean);
  const base = tidy(basePrompt);
  if (extras.length === 0) return base;
  const list = extras.map((line, index) => `${index + 1}. ${line}`).join('\n');
  return `${base}\n\n---\n${heading}:\n${list}`;
}
