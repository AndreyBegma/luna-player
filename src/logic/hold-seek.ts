/**
 * FEAT-20260919-619 — a held arrow accelerates.
 *
 * Each press used to be ten seconds, and a held key repeated it at the
 * keyboard's own rate — three hundred seconds a second on a desk, and a
 * stream restart per repeat on the path that seeks by reloading. Now the
 * hook (`use-hold-seek.ts`) drives the hold from its own clock: one tick
 * every `HOLD_TICK_MS`, the step growing with the time the key has been
 * down, the label on the picture reading the step. The schedule is pure so
 * `hold-seek.test.ts` can hold it: three seconds held is 3 × 10 + 5 × 30 =
 * 180 seconds, and the label reads `+60 s` from then on.
 */

/** One seek per tick while the key is down; the first tick is immediate. */
export const HOLD_TICK_MS = 400;

/** The step a tick applies, by how long the key has been held. Shift is the coarse step from the first tick. */
export function holdStep(heldMs: number, coarse: boolean): number {
  if (coarse) return 60;
  if (heldMs < 1_000) return 10;
  if (heldMs < 3_000) return 30;
  return 60;
}

/**
 * Where the next tick puts the film. The hook keeps its own target rather
 * than re-reading the playhead: two ticks between `timeupdate`s would read
 * the same stale position and lose a step. Clamped to the film, so a key
 * held past the end stops at the end rather than counting on into nothing.
 */
export function holdTarget(input: {
  target: number;
  step: number;
  direction: 1 | -1;
  duration: number;
}): number {
  const next = input.target + input.direction * input.step;
  const end = input.duration > 0 ? input.duration : Number.POSITIVE_INFINITY;
  return Math.max(0, Math.min(next, end));
}
