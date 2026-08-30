/**
 * "Open in" deep links.
 *
 * Chat products accept a prefilled prompt in the query string, but every one of
 * them has a URL length ceiling well below what these prompts can reach. So the
 * link is only used when the prompt is short enough; otherwise the caller copies
 * to the clipboard and opens a bare tab, which is the behaviour people expect
 * anyway once a prompt is a few paragraphs long.
 */

export const TARGETS = [
  { id: 'chatgpt', label: 'ChatGPT', url: 'https://chatgpt.com/', param: 'q', maxLength: 3000 },
  { id: 'claude', label: 'Claude', url: 'https://claude.ai/new', param: 'q', maxLength: 3000 },
  { id: 'gemini', label: 'Gemini', url: 'https://gemini.google.com/app', param: null, maxLength: 0 },
  { id: 'perplexity', label: 'Perplexity', url: 'https://www.perplexity.ai/search', param: 'q', maxLength: 2000 },
];

export function getTarget(id) {
  return TARGETS.find((target) => target.id === id) ?? TARGETS[0];
}

/**
 * Build the URL to open for a target.
 * @returns {{ url: string, prefilled: boolean }} `prefilled` is false when the
 * prompt had to be left out, so the caller knows to copy it to the clipboard.
 */
export function buildTargetUrl(targetId, prompt) {
  const target = getTarget(targetId);
  const text = String(prompt ?? '');
  if (!target.param || !text || text.length > target.maxLength) {
    return { url: target.url, prefilled: false };
  }
  const url = new URL(target.url);
  url.searchParams.set(target.param, text);
  return { url: url.toString(), prefilled: true };
}
