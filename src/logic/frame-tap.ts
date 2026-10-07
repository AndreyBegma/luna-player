/**
 * FEAT-20260830-489 — what a tap on the picture means, on a coarse pointer.
 *
 * It used to mean one thing — toggle playback — which is wrong for a phone
 * in two ways. The controls auto-hide, so the tap that a viewer makes to
 * *look* at where they are in the film paused it instead; and there was no
 * gesture for the thing a touch player is reached for most, seeking, so a
 * ten-second step meant finding a 2mm-tall bar with a finger.
 *
 * FEAT-20260919-619 — a tap never plays or pauses. The middle third used to
 * toggle once the controls were up, while a play/pause disc sat in that same
 * third: two ways to do one thing, one of them by accident. Now a tap with
 * the controls down brings them up and a tap with the controls up takes them
 * down, whatever the film is doing. Play and pause come from the centre
 * disc, the bar, the space bar or the remote.
 *
 * The outer thirds are still the double-tap seek every touch player has
 * taught people, ∓10s on the left and ±10s on the right — and the taps now
 * accumulate: the third tap is another ten, the fourth another, with one
 * counter on the picture reading the run's total. YouTube's rule: n taps on
 * one third are (n−1) × 10 s.
 *
 * The 250ms deferral applies only to the outer thirds, because only they
 * can become a double tap. The hide in the middle stays instant, which is
 * where the delay would actually be felt.
 *
 * FEAT-20260914-584 — the decision is pure and lives here, where
 * `frame-tap.test.ts` can hold it to its cases; `use-frame-tap.ts` owns the
 * timers and the pending tap around it.
 */

/** Two taps closer than this on the same outer third are one double tap. */
export const DOUBLE_TAP_MS = 250;
/**
 * Once a run has started — the counter is on the picture — the next tap has
 * this long. A viewer who has seen `+10 s` appear taps at leisure, and 250 ms
 * makes four taps a trick rather than a gesture.
 */
export const TAP_RUN_MS = 500;
/** How far each tap of a run moves the film. */
export const TAP_SEEK_SECONDS = 10;

export type Third = 'left' | 'centre' | 'right';

/**
 * An outer-third tap waiting to learn whether it is the first of two, or a
 * run of seeks waiting for its next tap. `seeks` is how many the run has
 * applied so far: 0 while it is still a single tap that may yet hide the
 * controls.
 */
export interface PendingTap {
  at: number;
  third: 'left' | 'right';
  seeks: number;
}

export type FrameTapAction =
  /** The controls were down; this tap only brought them back. */
  | { kind: 'reveal'; pending: PendingTap | null }
  /** The middle third with the controls up: take them down, now. */
  | { kind: 'hide' }
  /**
   * The next tap of a run on an outer third: seek by `by` seconds. `total`
   * is the run's sum for the counter; `pending` keeps the run open.
   */
  | { kind: 'seek'; by: number; total: number; pending: PendingTap }
  /** An outer-third tap that may yet become a double: wait, then hide. */
  | { kind: 'defer'; pending: PendingTap };

/** Which third of the frame `clientX` fell in; the centre when it has no width. */
export function tapThird(
  clientX: number,
  rect: { left: number; width: number },
): Third {
  const ratio = rect.width > 0 ? (clientX - rect.left) / rect.width : 0.5;
  return ratio < 1 / 3 ? 'left' : ratio > 2 / 3 ? 'right' : 'centre';
}

/** Is this tap the next of the pending pair or run, on the same third? */
function continues(
  previous: PendingTap | null,
  third: Third,
  now: number,
): previous is PendingTap {
  if (!previous || previous.third !== third) return false;
  const window = previous.seeks === 0 ? DOUBLE_TAP_MS : TAP_RUN_MS;
  return now - previous.at < window;
}

export function resolveFrameTap(input: {
  controlsVisible: boolean;
  third: Third;
  previous: PendingTap | null;
  now: number;
}): FrameTapAction {
  const { third, previous, now } = input;

  // A run in progress carries on whether or not the controls are up: the
  // second tap of a pair is what the first one was for.
  if (third !== 'centre' && continues(previous, third, now)) {
    const seeks = previous.seeks + 1;
    return {
      kind: 'seek',
      by: third === 'right' ? TAP_SEEK_SECONDS : -TAP_SEEK_SECONDS,
      total: seeks * TAP_SEEK_SECONDS,
      pending: { at: now, third, seeks },
    };
  }

  // The first tap with the controls down buys a look at them and nothing
  // else — but an outer-third tap is remembered, so a double tap from a
  // clean picture still seeks on its second tap rather than its third.
  if (!input.controlsVisible) {
    return {
      kind: 'reveal',
      pending: third === 'centre' ? null : { at: now, third, seeks: 0 },
    };
  }

  if (third === 'centre') return { kind: 'hide' };

  return { kind: 'defer', pending: { at: now, third, seeks: 0 } };
}
