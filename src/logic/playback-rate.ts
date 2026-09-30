/**
 * FEAT-20260914-584 — the playback-rate rungs, out of the player.
 *
 * Two rules and one list, pure so `playback-rate.test.ts` can hold them to
 * it: the speed button cycles through `SPEEDS` and wraps, and a rate read
 * back from storage is trusted only when it is one of the rungs — a device
 * that once stored something else must not come back playing at it.
 */

export const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2];

/** The rung after `rate`, wrapping from the last back to the first. */
export function nextSpeed(rate: number): number {
  const idx = SPEEDS.indexOf(rate);
  return SPEEDS[(idx + 1) % SPEEDS.length];
}

/**
 * The stored rate, or `null` when there is none worth applying.
 *
 * `null` rather than 1 so the caller can leave its state alone: the mount
 * effect that reads this sets nothing when nothing was saved.
 */
export function savedRate(raw: string | null): number | null {
  const parsed = Number.parseFloat(raw ?? '');
  return SPEEDS.includes(parsed) ? parsed : null;
}

/**
 * FEAT-20260919-619 — `<` and `>`: one rung down or up, and no wrap. A key
 * that goes from 2× back round to 0.5× is a surprise; the ends are the ends.
 */
export function stepSpeed(rate: number, direction: 1 | -1): number {
  const idx = SPEEDS.indexOf(rate);
  const at = idx === -1 ? SPEEDS.indexOf(1) : idx;
  return SPEEDS[Math.max(0, Math.min(at + direction, SPEEDS.length - 1))];
}
