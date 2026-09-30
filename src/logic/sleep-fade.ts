/**
 * FEAT-20260923-652 increment 3 — the last-thirty-second volume ramp, as pure
 * arithmetic, and the flag that keeps it out of the remembered volume.
 *
 * The ramp changes the element's own `.volume`, the same property the slider
 * and the keyboard change, so `use-volume.ts`'s `volumechange` handler cannot
 * tell the ramp's writes from a viewer's from the event alone. `sleepFadeActive`
 * is what it asks instead — a shared singleton for state one player mount
 * does not own alone, the same shape `sleep-timer.ts` and `still-watching.ts`
 * already use.
 */
export const SLEEP_FADE_MS = 30_000;

export const sleepFadeActive = { value: false };

/** `base` ramped linearly to 0 over the last `SLEEP_FADE_MS` before the deadline. */
export function sleepFadeVolume(base: number, msLeft: number): number {
  if (msLeft >= SLEEP_FADE_MS) return base;
  if (msLeft <= 0) return 0;
  return base * (msLeft / SLEEP_FADE_MS);
}
