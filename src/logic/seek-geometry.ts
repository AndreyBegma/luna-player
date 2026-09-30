import { HOLD_TICK_MS, holdStep, holdTarget } from './hold-seek';

/**
 * BUG-20260831-502 — where the seek bar's thumb goes.
 *
 * It used to be `left: calc(<progress>% - 0.5rem)`, which centres the thumb on
 * the position it marks. That is correct everywhere except the two ends, and
 * the two ends are the whole of this bug: at 0 % half the thumb is to the left
 * of the track, at 100 % half of it is to the right, and the control bar's
 * horizontal padding is 0.75rem — so an 8px overhang eats two thirds of the
 * inset that is supposed to keep the row inside the glass capsule.
 *
 * The fix is the standard one for a range input: give the thumb the track's
 * width minus its own to travel in, so it is flush with the left edge at 0 %
 * and flush with the right edge at 100 %, and is still centred on its position
 * everywhere in between. The error at the midpoint is zero and it grows to half
 * a thumb at the extremes, which is the trade every native slider makes.
 */

/**
 * The thumb's diameter. Must match `size-4` on the element in `seek-bar.tsx`.
 *
 * Not exported: nothing outside this module has a use for it, and `knip` fails
 * the build on an export nobody reads.
 */
const THUMB_REM = 1;

/**
 * The `left` offset for a thumb marking `progress` percent of the track.
 *
 * Out-of-range input is clamped rather than trusted: `progress` is computed
 * from a duration the element reports, and a `NaN` duration has reached this
 * player before.
 */
export function thumbLeft(progress: number): string {
  const p = Number.isFinite(progress) ? Math.max(0, Math.min(100, progress)) : 0;
  return `calc(${p}% - ${(p / 100) * THUMB_REM}rem)`;
}

/**
 * FEAT-20260924-679 — how far in from either end the time bubble's centre is
 * held. The bubble is centred on its point, and `0:00:00` at `text-xs` with
 * `px-2` is a little under 4rem wide; 2rem keeps a centred bubble inside the
 * track at 0 % and at 100 %, which is where the control bar's own padding runs
 * out (see `thumbLeft` above).
 */
const BUBBLE_INSET_REM = 2;

/** The `left` of the time bubble marking `percent` of the track, clamped to the track. */
export function bubbleLeft(percent: number): string {
  const p = Number.isFinite(percent) ? Math.max(0, Math.min(100, percent)) : 0;
  return `clamp(${BUBBLE_INSET_REM}rem, ${p}%, calc(100% - ${BUBBLE_INSET_REM}rem))`;
}

/**
 * FEAT-20260923-661 Q-01 — the scrubber's arrow keys, pressed and held.
 *
 * While the bar has focus its arrows are its own (`arrowOwnerHasFocus()` in
 * `player-keys.ts`), so the window handler's hold (FEAT-20260919-619,
 * `hold-seek.ts`) never saw them: a held arrow here seeked once per keyboard
 * repeat, thirty times a second, each from the playhead store. On the element
 * and hls.js paths that store is written by `timeupdate`, which does not come
 * while seeks keep replacing each other, so every repeat seeked to the same
 * place; on the path that seeks by reloading, every repeat restarted the
 * stream. This gives the bar the same schedule as the window: one seek per
 * `HOLD_TICK_MS`, the step growing with the hold, Shift coarse throughout.
 *
 * It also keeps its own target, as the hook does, and builds on it while the
 * last seek has not landed — the store still reads what it read when that
 * seek was sent. Two quick presses are then twenty seconds, not ten.
 */
export interface ArrowHold {
  direction: 1 | -1;
  /** When the key went down, for the step schedule. */
  startedAt: number;
  /** When this hold last seeked; a repeat sooner than a tick after it is dropped. */
  seekedAt: number;
  /** Where that seek sent the film. */
  target: number;
  /** The playhead store's time when it did. */
  playheadAtSeek: number;
}

/**
 * How long an unlanded seek is built on. A seek the player refused (the intro
 * clip, say) never moves the store, and without a bound the next press would
 * carry every refused step with it.
 */
const PENDING_MS = 2_000;

export function arrowSeek(
  hold: ArrowHold | null,
  press: {
    now: number;
    repeat: boolean;
    direction: 1 | -1;
    coarse: boolean;
    playhead: number;
    duration: number;
  },
): { hold: ArrowHold; seekTo: number | null } {
  const continuing =
    hold !== null && press.repeat && hold.direction === press.direction;
  if (continuing && press.now - hold.seekedAt < HOLD_TICK_MS)
    return { hold, seekTo: null };
  const pending =
    hold !== null &&
    hold.playheadAtSeek === press.playhead &&
    press.now - hold.seekedAt < PENDING_MS;
  const startedAt = continuing ? hold.startedAt : press.now;
  const seekTo = holdTarget({
    target: pending ? hold.target : press.playhead,
    step: holdStep(press.now - startedAt, press.coarse),
    direction: press.direction,
    duration: press.duration,
  });
  return {
    hold: {
      direction: press.direction,
      startedAt,
      seekedAt: press.now,
      target: seekTo,
      playheadAtSeek: press.playhead,
    },
    seekTo,
  };
}
