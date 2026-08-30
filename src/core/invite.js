/**
 * When to ask, and when to shut up.
 *
 * The portal's moment of value is unambiguous: the visitor copied a prompt and
 * is about to go use it. That is the only place an invitation earns its
 * interruption - the reciprocity rule is to give first and ask after, and an
 * ask that lands before any value reads as a toll booth.
 *
 * Everything here is pure so the rules can be tested without a DOM or a clock.
 */

/** Value has to land more than once before we treat it as value. */
export const MIN_COPIES_BEFORE_ASK = 2;

/** A dismissal is an answer. Respect it for this long. */
export const DISMISS_COOLDOWN_DAYS = 14;

/** Never twice in a day, even across sessions. */
export const RESHOW_COOLDOWN_HOURS = 24;

const DAY = 24 * 60 * 60 * 1000;
const HOUR = 60 * 60 * 1000;

/**
 * @param {{ copies: number, engagement: object, now?: number }} input
 * @returns {{ show: boolean, reason: string }} the reason is for tests and
 *          debugging - it makes a "why didn't it appear" question answerable.
 */
export function inviteDecision({ copies = 0, engagement = {}, now = Date.now() } = {}) {
  if (engagement.joined) return { show: false, reason: 'already-joined' };
  if (copies < MIN_COPIES_BEFORE_ASK) return { show: false, reason: 'not-enough-value-yet' };

  const dismissedAt = Number(engagement.dismissedAt ?? 0);
  if (dismissedAt && now - dismissedAt < DISMISS_COOLDOWN_DAYS * DAY) {
    return { show: false, reason: 'recently-dismissed' };
  }

  const shownAt = Number(engagement.shownAt ?? 0);
  if (shownAt && now - shownAt < RESHOW_COOLDOWN_HOURS * HOUR) {
    return { show: false, reason: 'shown-recently' };
  }

  return { show: true, reason: 'earned' };
}
