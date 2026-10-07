/**
 * FEAT-20260919-619 — a finger held on the picture plays at 2× for as long
 * as it is down, the way every phone player does. The decision is here so
 * `long-press.test.ts` can hold it; `use-long-press.ts` owns the timer, the
 * element's rate before and after, and the click the release must not be.
 */

/** A finger down this long, without moving, is a hold rather than a tap. */
export const LONG_PRESS_MS = 500;
/**
 * A finger that travels further than this is scrolling the page or dragging,
 * not holding. Ten CSS pixels is the slop every touch platform allows a
 * resting finger.
 */
export const LONG_PRESS_SLOP_PX = 10;
/** The rate a hold plays at. */
export const HELD_RATE = 2;

export interface Press {
  x: number;
  y: number;
}

/** Has the finger drifted far enough from where it landed to cancel the hold? */
export function pressDrifted(from: Press, to: Press): boolean {
  return Math.hypot(to.x - from.x, to.y - from.y) > LONG_PRESS_SLOP_PX;
}

/**
 * Whether a press may become a hold at all: a finger, on a film that is
 * playing. A mouse held down is a drag; 2× on a paused picture is nothing.
 */
export function pressMayHold(input: {
  pointerType: string;
  playing: boolean;
}): boolean {
  return input.pointerType === 'touch' && input.playing;
}
