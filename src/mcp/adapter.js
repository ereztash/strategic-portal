/**
 * Engine <-> MCP mapping.
 *
 * The portal's engines already carry everything MCP needs - a name, a
 * description, typed fields and a template - which is the payoff from storing
 * them as data instead of closures. This module is the whole translation layer,
 * and it reuses `render()` so a prompt built here is byte-identical to one built
 * in the web UI.
 */

import { render, composePrompt } from '../core/template.js';
import { MODIFIERS, modifierTexts } from '../core/modifiers.js';
import { resolveTechniques } from '../core/techniques.js';
import { getCategory } from '../data/categories.js';

/**
 * MCP prompt arguments are strings with no type or enum - the spec allows only
 * `name`, `description` and `required`. So a select's allowed values are folded
 * into the description, and offered properly through the completion API instead.
 */
export function fieldToArgument(field) {
  const parts = [field.label];
  if (field.type === 'select' || field.type === 'multiselect') {
    parts.push(`אפשרויות: ${(field.options ?? []).join(' | ')}`);
    if (field.type === 'multiselect') parts.push('ניתן לציין כמה, מופרדים בפסיק');
  } else if (field.type === 'number') {
    parts.push('מספר');
  } else if (field.type === 'textarea') {
    parts.push('טקסט חופשי, יכול להיות ארוך');
  }
  if (field.placeholder) parts.push(`למשל: ${field.placeholder}`);
  return {
    name: field.id,
    description: parts.join('. '),
    required: Boolean(field.required),
  };
}

/** One engine as an MCP prompt descriptor (the `prompts/list` shape). */
export function engineToPrompt(engine) {
  return {
    name: engine.id,
    title: engine.title,
    description: `${engine.shortDesc} · הכאב: ${engine.symptom}`,
    arguments: (engine.fields ?? []).map(fieldToArgument),
  };
}

/**
 * Coerce a string argument coming over the wire back into the shape the
 * template engine expects. Everything arrives as a string from an MCP prompt,
 * but a multiselect has to become an array or it renders as one run-on value.
 */
export function coerceArguments(engine, args = {}) {
  const values = {};
  for (const field of engine.fields ?? []) {
    const raw = args[field.id];
    if (raw === undefined || raw === null) continue;
    if (field.type === 'multiselect') {
      values[field.id] = Array.isArray(raw)
        ? raw
        : String(raw)
            .split(',')
            .map((part) => part.trim())
            .filter(Boolean);
    } else if (field.type === 'toggle') {
      values[field.id] = raw === true || /^(true|yes|כן|1)$/i.test(String(raw).trim());
    } else {
      values[field.id] = raw;
    }
  }
  return values;
}

/** Which required arguments are missing, for a -32602 with an actionable message. */
export function missingArguments(engine, values) {
  return (engine.fields ?? [])
    .filter((field) => field.required)
    .filter((field) => {
      const value = values[field.id];
      if (Array.isArray(value)) return value.length === 0;
      return value === undefined || value === null || String(value).trim() === '';
    })
    .map((field) => field.id);
}

/** Render an engine into the final prompt text, modifiers included. */
export function buildPromptText(engine, args = {}, modifiers = []) {
  const values = coerceArguments(engine, args);
  const known = new Set(MODIFIERS.map((modifier) => modifier.id));
  const active = (modifiers ?? []).filter((id) => known.has(id));
  const base = render(engine.template, values).text;
  return composePrompt(base, modifierTexts(active));
}

/** The `prompts/get` result for one engine. */
export function promptResult(engine, args = {}, modifiers = []) {
  return {
    description: `${engine.title} · ${engine.shortDesc}`,
    messages: [
      {
        role: 'user',
        content: { type: 'text', text: buildPromptText(engine, args, modifiers) },
      },
    ],
  };
}

/** Compact engine summary used by the list and search tools. */
export function engineSummary(engine) {
  return {
    id: engine.id,
    title: engine.title,
    symptom: engine.symptom,
    description: engine.shortDesc,
    category: getCategory(engine.categoryId)?.title ?? engine.categoryId,
    category_id: engine.categoryId,
    level: engine.level,
    techniques: engine.techniques ?? [],
    tags: engine.tags ?? [],
  };
}

/** Full engine detail, including the field spec a caller needs to build inputs. */
export function engineDetail(engine) {
  return {
    ...engineSummary(engine),
    strategy: engine.strategy,
    technique_details: resolveTechniques(engine.techniques ?? []).map((technique) => ({
      id: technique.id,
      label: technique.labelEn,
      summary: technique.summary,
    })),
    fields: (engine.fields ?? []).map((field) => ({
      id: field.id,
      label: field.label,
      type: field.type,
      required: Boolean(field.required),
      options: field.options ?? undefined,
      placeholder: field.placeholder ?? undefined,
    })),
    example_inputs: engine.example ?? null,
  };
}

/** Markdown rendering, for the `response_format: "markdown"` path. */
export function engineToMarkdown(engine, { detailed = false } = {}) {
  const lines = [
    `### ${engine.title}  \`${engine.id}\``,
    `**הכאב:** ${engine.symptom}`,
    `**מה הוא עושה:** ${engine.shortDesc}`,
    `**תחום:** ${getCategory(engine.categoryId)?.title ?? engine.categoryId} · **רמה:** ${engine.level}`,
  ];
  if (detailed) {
    lines.push(`**האסטרטגיה:** ${engine.strategy}`);
    const techniques = resolveTechniques(engine.techniques ?? []);
    if (techniques.length) lines.push(`**טכניקות:** ${techniques.map((item) => item.labelEn).join(', ')}`);
    if (engine.fields?.length) {
      lines.push('**שדות:**');
      for (const field of engine.fields) {
        const bits = [`\`${field.id}\``, field.label, field.type];
        if (field.required) bits.push('חובה');
        if (field.options) bits.push(`[${field.options.join(' | ')}]`);
        lines.push(`- ${bits.join(' · ')}`);
      }
    }
  }
  return lines.join('\n');
}
