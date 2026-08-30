/**
 * Minimal line-level diff (LCS) used by the generator's comparison tab.
 *
 * Showing the naive prompt next to the engineered one is the portal's teaching
 * moment; the diff makes the added structure impossible to miss.
 */

/** Split into lines, treating an empty string as no lines at all. */
function toLines(value) {
  const text = String(value ?? '');
  return text === '' ? [] : text.split('\n');
}

/** Longest-common-subsequence table over two arrays of lines. */
function lcsTable(a, b) {
  const table = Array.from({ length: a.length + 1 }, () => new Uint32Array(b.length + 1));
  for (let i = a.length - 1; i >= 0; i -= 1) {
    for (let j = b.length - 1; j >= 0; j -= 1) {
      table[i][j] = a[i] === b[j] ? table[i + 1][j + 1] + 1 : Math.max(table[i + 1][j], table[i][j + 1]);
    }
  }
  return table;
}

/**
 * @returns {Array<{ type: 'equal'|'added'|'removed', text: string }>}
 * `removed` lines come from `before`, `added` lines from `after`.
 */
export function diffLines(before, after) {
  // An empty side is zero lines, not one blank line - otherwise the view shows
  // a phantom "removed" row above every diff against an empty prompt.
  const a = toLines(before);
  const b = toLines(after);
  const table = lcsTable(a, b);
  const result = [];
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      result.push({ type: 'equal', text: a[i] });
      i += 1;
      j += 1;
    } else if (table[i + 1][j] >= table[i][j + 1]) {
      result.push({ type: 'removed', text: a[i] });
      i += 1;
    } else {
      result.push({ type: 'added', text: b[j] });
      j += 1;
    }
  }
  while (i < a.length) {
    result.push({ type: 'removed', text: a[i] });
    i += 1;
  }
  while (j < b.length) {
    result.push({ type: 'added', text: b[j] });
    j += 1;
  }
  return result;
}

/** Counts for the summary line above the diff. */
export function diffStats(diff) {
  return diff.reduce(
    (acc, row) => {
      if (row.type === 'added') acc.added += 1;
      else if (row.type === 'removed') acc.removed += 1;
      else acc.equal += 1;
      return acc;
    },
    { added: 0, removed: 0, equal: 0 },
  );
}
