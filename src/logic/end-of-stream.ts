/**
 * BUG-20260919-627 — the rule that tells a stall at the tail apart from a
 * stall in the middle of the film.
 *
 * The Collaps CDN can withhold the manifest's last segment (BUG-20260918-617's
 * rationing family), and when it does, `currentTime` stops advancing short of
 * `duration` and the element's `ended` never fires — there is no event left
 * to arm the end screen with. This is the one place that decides when a stall
 * has gone on long enough, this close to the end, to be treated as the end
 * anyway.
 */

/** How close to `duration` a stall counts as the tail rather than mid-film buffering. */
export const END_TAIL_SECONDS = 5;

/** How long the playhead must sit still, inside the tail, before it counts. */
export const STALL_AT_TAIL_MS = 3000;

export type EndOfStreamState = 'ended' | 'stalled-at-tail' | 'playing';

export interface EndOfStreamInput {
  /** The element's own `ended` — always wins, whatever the rest of the input says. */
  ended: boolean;
  /** A stall with a reported cause is the error handler's job, not this rule's. */
  hasError: boolean;
  /** `HTMLMediaElement.readyState`; 0 (`HAVE_NOTHING`) is not playback stalling — there is no source loaded yet. */
  readyState: number;
  currentTime: number;
  /** The known duration, or a value that is not yet known. */
  duration: number | null | undefined;
  /** Milliseconds since `currentTime` last advanced (reset by a seek). */
  stalledForMs: number;
}

export function endOfStream({
  ended,
  hasError,
  readyState,
  currentTime,
  duration,
  stalledForMs,
}: EndOfStreamInput): EndOfStreamState {
  if (ended) return 'ended';
  if (hasError) return 'playing';
  if (readyState === 0) return 'playing';
  if (!duration || duration <= 0) return 'playing';
  if (duration - currentTime > END_TAIL_SECONDS) return 'playing';
  if (stalledForMs < STALL_AT_TAIL_MS) return 'playing';
  return 'stalled-at-tail';
}
