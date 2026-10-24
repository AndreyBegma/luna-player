/**
 * FEAT-20260919-619 — a phone turned on its side wants the film to fill it.
 *
 * The decision is here so `rotation-fullscreen.test.ts` can hold it;
 * `use-fullscreen.ts` listens for the turn and remembers who entered.
 */

/**
 * A viewer who has just left fullscreen by hand — the button, Escape, the
 * system gesture — is not turned straight back into it by the phone settling
 * in their lap. Five seconds is long enough to put the phone down.
 */
export const ROTATE_GRACE_MS = 5_000;

export type RotationAction = 'enter' | 'exit' | 'none';

export function rotationAction(input: {
  landscape: boolean;
  /** A phone: a finger, and a compact viewport. */
  phone: boolean;
  mediaReady: boolean;
  fullscreenActive: boolean;
  /** The fullscreen on screen is one a rotation entered. */
  enteredByRotation: boolean;
  /** When the viewer last left fullscreen by hand, or `null`. */
  manualExitAt: number | null;
  now: number;
}): RotationAction {
  if (!input.phone || !input.mediaReady) return 'none';
  if (input.landscape) {
    if (input.fullscreenActive) return 'none';
    if (input.manualExitAt !== null && input.now - input.manualExitAt < ROTATE_GRACE_MS)
      return 'none';
    return 'enter';
  }
  // Portrait again: only the fullscreen a rotation entered is a rotation's
  // to leave. One the viewer chose stays theirs.
  return input.fullscreenActive && input.enteredByRotation ? 'exit' : 'none';
}
