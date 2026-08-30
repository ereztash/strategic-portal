/**
 * Rough token/length estimation.
 *
 * There is no tokenizer in the bundle on purpose - shipping one would dwarf the
 * rest of the app. This heuristic weights characters by script, because Hebrew
 * costs roughly twice as many tokens per character as English on every current
 * BPE vocabulary. It is a budgeting aid, not an exact count, and the UI labels
 * it as an estimate.
 */

const CHARS_PER_TOKEN = {
  hebrew: 1.8,
  latin: 4.0,
  cjk: 1.0,
  digit: 3.0,
  other: 3.0,
};

export function countByScript(text) {
  const counts = { hebrew: 0, latin: 0, cjk: 0, digit: 0, other: 0, whitespace: 0 };
  for (const char of String(text ?? '')) {
    if (/\s/.test(char)) counts.whitespace += 1;
    else if (/[֐-׿]/.test(char)) counts.hebrew += 1;
    else if (/[一-鿿぀-ヿ]/.test(char)) counts.cjk += 1;
    else if (/[0-9]/.test(char)) counts.digit += 1;
    else if (/[A-Za-z]/.test(char)) counts.latin += 1;
    else counts.other += 1;
  }
  return counts;
}

/** Estimated token count for a prompt. */
export function estimateTokens(text) {
  const counts = countByScript(text);
  const body =
    counts.hebrew / CHARS_PER_TOKEN.hebrew +
    counts.latin / CHARS_PER_TOKEN.latin +
    counts.cjk / CHARS_PER_TOKEN.cjk +
    counts.digit / CHARS_PER_TOKEN.digit +
    counts.other / CHARS_PER_TOKEN.other;
  // Whitespace mostly merges into neighbouring tokens rather than creating new ones.
  return Math.max(0, Math.round(body + counts.whitespace * 0.25));
}

/** Word count that works for Hebrew and Latin alike. */
export function countWords(text) {
  const trimmed = String(text ?? '').trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).length;
}

/** Everything the generator's status bar needs, in one pass. */
export function measure(text) {
  const value = String(text ?? '');
  return {
    characters: value.length,
    words: countWords(value),
    lines: value ? value.split('\n').length : 0,
    tokens: estimateTokens(value),
  };
}
