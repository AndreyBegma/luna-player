/**
 * BUG-20260831-502 — when "Continue from 6:28?" is a question worth asking.
 *
 * Three separate places used to decide this and none of them agreed. The load
 * path armed the prompt on `position > 5`. The `watch:progress` socket handler
 * re-armed it from another device on `v.paused` alone. The render guard drew it
 * on `resumeTime !== null && !playing`. Nothing compared the saved position
 * against the playhead, so a pause at 6:28 was answered with an offer to
 * continue from 6:28 — and every pause after the first raised it again.
 *
 * The rule, in one place: **an offer is a position meaningfully ahead of where
 * the player already is.** At a playhead of 0 that reduces exactly to the
 * `position > 5` the load path has always applied, so a title opened cold
 * behaves as it did; anywhere else it is the comparison that was missing.
 *
 * The other half of the fix does not live here, because it is not a predicate:
 * `doPlay` in `video-player.tsx` now clears `resumeTime`, so pressing play by
 * any route — the play button, a tap on the picture, the space bar, a remote
 * OK — answers the question the same way the banner's own buttons do.
 */

/**
 * How far ahead of the playhead a saved position has to be before it is worth
 * offering. Five seconds is the figure `use-watch-progress.ts` already used to
 * decide a position was worth *storing*, and the two should not disagree.
 */
export const RESUME_MIN_SECONDS = 5;

/**
 * Is `position` an offer worth making to a player sitting at `playhead`?
 *
 * Both are absolute seconds into the title — for the element that means
 * `currentTime + seekOffset`, never the raw `video.currentTime`, because a
 * server-side seek leaves the element counting from zero again.
 */
export function isResumeOffer(position: number, playhead: number): boolean {
  if (!Number.isFinite(position) || !Number.isFinite(playhead)) return false;
  return position - playhead > RESUME_MIN_SECONDS;
}

interface BannerState {
  /** The armed position, or `null` once the question has been answered. */
  resumeTime: number | null;
  playing: boolean;
  /** Absolute seconds into the title. */
  playhead: number;
}

/**
 * Whether the resume banner belongs on screen.
 *
 * `IdlePlay` reads the same value inverted, so the player never shows both and
 * never shows neither: a `resumeTime` that is no longer an offer gives the
 * centre play button back rather than leaving an idle player with no control.
 */
export function shouldOfferResume({
  resumeTime,
  playing,
  playhead,
}: BannerState): boolean {
  if (resumeTime === null || playing) return false;
  return isResumeOffer(resumeTime, playhead);
}
