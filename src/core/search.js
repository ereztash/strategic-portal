/**
 * Weighted, typo-tolerant search over the engine library.
 *
 * The portal is symptom-first: people type what hurts ("הכתיבה נשמעת רובוטית"),
 * not the name of a tool. So the symptom text is weighted almost as high as the
 * title, and matching is token-based with a subsequence fallback for typos.
 */

import { normalizeText, tokenize } from './utils.js';

/** Relative importance of each indexed field. */
export const FIELD_WEIGHTS = {
  title: 10,
  symptom: 7,
  tags: 5,
  shortDesc: 4,
  technique: 4,
  category: 3,
  strategy: 2,
  fields: 1,
};

/** Build a searchable document for a single engine. */
function toDocument(engine) {
  return {
    title: engine.title ?? '',
    symptom: engine.symptom ?? '',
    shortDesc: engine.shortDesc ?? '',
    strategy: engine.strategy ?? '',
    tags: (engine.tags ?? []).join(' '),
    technique: (engine.techniques ?? []).join(' '),
    category: engine.categoryTitle ?? '',
    fields: (engine.fields ?? []).map((field) => field.label ?? '').join(' '),
  };
}

/** Pre-tokenize every engine once; call again whenever custom engines change. */
export function buildIndex(engines) {
  return engines.map((engine) => {
    const doc = toDocument(engine);
    const tokens = {};
    for (const key of Object.keys(FIELD_WEIGHTS)) tokens[key] = tokenize(doc[key]);
    return { engine, doc, tokens, haystack: normalizeText(Object.values(doc).join(' ')) };
  });
}

/** True when every character of `needle` appears in order inside `haystack`. */
export function isSubsequence(needle, haystack) {
  if (!needle) return true;
  let cursor = 0;
  for (const char of haystack) {
    if (char === needle[cursor]) cursor += 1;
    if (cursor === needle.length) return true;
  }
  return false;
}

/**
 * True when one edit (insert, delete or substitute) turns `a` into `b`.
 * Cheap enough to run per token pair, and catches the typos people actually
 * make without pulling in a full edit-distance matrix.
 */
export function withinOneEdit(a, b) {
  if (a === b) return true;
  const [short, long] = a.length <= b.length ? [a, b] : [b, a];
  if (long.length - short.length > 1) return false;
  let i = 0;
  let j = 0;
  let edited = false;
  while (i < short.length && j < long.length) {
    if (short[i] === long[j]) {
      i += 1;
      j += 1;
      continue;
    }
    if (edited) return false;
    edited = true;
    if (short.length === long.length) i += 1;
    j += 1;
  }
  return true;
}

/**
 * Hebrew glues its conjunctions, articles and prepositions onto the next word,
 * so "וקלישאות" and "קלישאות" are the same search term to a person. Strip a
 * single leading particle when what remains is still a real word length.
 */
const HEBREW_PREFIXES = ['ו', 'ה', 'ב', 'ל', 'מ', 'כ', 'ש'];
export function stripHebrewPrefix(token) {
  if (token.length < 4) return token;
  return HEBREW_PREFIXES.includes(token[0]) ? token.slice(1) : token;
}

/** Best score of one query token against one field's tokens. 0 means no match. */
function scoreToken(queryToken, fieldTokens) {
  const stripped = stripHebrewPrefix(queryToken);
  let best = 0;
  for (const raw of fieldTokens) {
    for (const token of raw === stripHebrewPrefix(raw) ? [raw] : [raw, stripHebrewPrefix(raw)]) {
      for (const query of stripped === queryToken ? [queryToken] : [queryToken, stripped]) {
        if (token === query) return 1;
        if (token.startsWith(query) || query.startsWith(token)) best = Math.max(best, 0.8);
        else if (token.includes(query)) best = Math.max(best, 0.6);
        else if (query.length >= 4 && withinOneEdit(query, token)) best = Math.max(best, 0.6);
        else if (query.length >= 3 && isSubsequence(query, token)) best = Math.max(best, 0.3);
      }
    }
  }
  return best;
}

/** A match strong enough to stand on its own, as opposed to a fuzzy near-miss. */
const STRONG_MATCH = 0.6;

/**
 * Rank engines against a free-text query.
 * @returns {Array<{ engine: object, score: number, matchedFields: string[] }>}
 */
export function search(index, query, options = {}) {
  const { limit = 60, minScore = 0.5 } = options;
  const allTokens = tokenize(query);
  // Single Hebrew letters are articles and conjunctions, never search terms.
  const queryTokens = allTokens.filter((token) => token.length > 1);
  if (queryTokens.length === 0) return [];

  const normalizedQuery = normalizeText(query);
  const results = [];

  for (const entry of index) {
    let total = 0;
    let matchedTokens = 0;
    let strongTokens = 0;
    const matchedFields = new Set();

    for (const queryToken of queryTokens) {
      let tokenBest = 0;
      let rawBest = 0;
      for (const [field, weight] of Object.entries(FIELD_WEIGHTS)) {
        const fieldScore = scoreToken(queryToken, entry.tokens[field]);
        if (fieldScore > 0) {
          matchedFields.add(field);
          rawBest = Math.max(rawBest, fieldScore);
          tokenBest = Math.max(tokenBest, fieldScore * weight);
        }
      }
      if (tokenBest > 0) matchedTokens += 1;
      if (rawBest >= STRONG_MATCH) strongTokens += 1;
      total += tokenBest;
    }

    // People type sentences, not keywords ("הכתיבה נשמעת פלסטית וקלישאתית").
    // Demanding that most words match would reject exactly those queries, so
    // the gate is on strong matches instead, and coverage only scales the score.
    const coverage = matchedTokens / queryTokens.length;
    if (strongTokens === 0) continue;
    if (strongTokens < 2 && coverage < 0.5) continue;

    // Whole-phrase hits are the strongest signal a person can give us.
    if (normalizedQuery.length > 2 && entry.haystack.includes(normalizedQuery)) total += 12;
    if (normalizeText(entry.doc.title).startsWith(normalizedQuery)) total += 8;

    const score = total * coverage;
    if (score >= minScore) results.push({ engine: entry.engine, score, matchedFields: [...matchedFields] });
  }

  results.sort((a, b) => b.score - a.score || String(a.engine.title).localeCompare(String(b.engine.title), 'he'));
  return results.slice(0, limit);
}

/**
 * Split text into `{ text, hit }` segments for highlighted rendering.
 * Returns plain segments so the UI can build DOM nodes instead of HTML strings.
 */
export function highlightSegments(text, query) {
  const source = String(text ?? '');
  const terms = tokenize(query).filter((token) => token.length >= 2);
  if (terms.length === 0) return [{ text: source, hit: false }];

  const normalizedSource = normalizeText(source);
  const ranges = [];
  for (const term of terms) {
    let from = 0;
    while (from < normalizedSource.length) {
      const at = normalizedSource.indexOf(term, from);
      if (at === -1) break;
      ranges.push([at, at + term.length]);
      from = at + term.length;
    }
  }
  if (ranges.length === 0) return [{ text: source, hit: false }];

  ranges.sort((a, b) => a[0] - b[0]);
  const merged = [ranges[0]];
  for (const [start, end] of ranges.slice(1)) {
    const last = merged[merged.length - 1];
    if (start <= last[1]) last[1] = Math.max(last[1], end);
    else merged.push([start, end]);
  }

  const segments = [];
  let cursor = 0;
  for (const [start, end] of merged) {
    // normalizeText preserves length for our inputs, so offsets stay aligned.
    if (start > cursor) segments.push({ text: source.slice(cursor, start), hit: false });
    segments.push({ text: source.slice(start, end), hit: true });
    cursor = end;
  }
  if (cursor < source.length) segments.push({ text: source.slice(cursor), hit: false });
  return segments;
}
