/**
 * FEAT-20260919-620 — "Still watching?", decided from a run of untouched
 * auto-advances.
 *
 * An auto-advance is the countdown reaching zero by itself. Three of them in
 * a row with nothing pressed, tapped or moved on the player in between is a
 * room that may be empty, and the next end screen asks instead of counting
 * down — so the server is not streaming to nobody all night. Any input
 * resets the run; choosing "Play next" or "Continue" is input and never
 * counts.
 *
 * The count is about a *run* of episodes, and every episode is a new mount
 * of the player, so the counter cannot live in a hook. `stillWatching` is the
 * one instance the player uses; the factory is what the test drives.
 */
export const STILL_WATCHING_AFTER = 3;

export interface StillWatchingCounter {
  /** The countdown reached zero with nothing touched. */
  noteAutoAdvance: () => void;
  /** A key, a tap, a pointer on the player: somebody is there. */
  noteInput: () => void;
  /** Ask rather than count down on the next end screen. */
  shouldAsk: () => boolean;
  /** Untouched auto-advances in the current run. */
  autoAdvances: () => number;
}

export function createStillWatchingCounter(
  threshold = STILL_WATCHING_AFTER,
): StillWatchingCounter {
  let run = 0;
  return {
    noteAutoAdvance: () => {
      run += 1;
    },
    noteInput: () => {
      run = 0;
    },
    shouldAsk: () => run >= threshold,
    autoAdvances: () => run,
  };
}

export const stillWatching = createStillWatchingCounter();
