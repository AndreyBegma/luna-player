/**
 * FEAT-20260914-584 — the playback-rate rungs, out of the player.
 *
 * Two rules and one list, pure so `playback-rate.test.ts` can hold them to
 * it: the speed button cycles through `SPEEDS` and wraps, and a rate read
 * back from storage is trusted only when it is one of the rungs — a device
 * that once stored something else must not come back playing at it.
 */

export const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2];

/*
 * FEAT-20260925-718 S4 — each rule also takes the list of rungs, for a player
 * given its own (`rates`; Luna's learning mode adds a slow one). Left out, it
 * is `SPEEDS`, and every rule behaves exactly as before.
 */

/** The rung after `rate`, wrapping from the last back to the first. */
export function nextSpeed(
  rate: number,
  rates: readonly number[] = SPEEDS,
): number {
  const idx = rates.indexOf(rate);
  return rates[(idx + 1) % rates.length];
}

/**
 * The stored rate, or `null` when there is none worth applying.
 *
 * `null` rather than 1 so the caller can leave its state alone: the mount
 * effect that reads this sets nothing when nothing was saved.
 */
export function savedRate(
  raw: string | null,
  rates: readonly number[] = SPEEDS,
): number | null {
  const parsed = Number.parseFloat(raw ?? '');
  return rates.includes(parsed) ? parsed : null;
}

/**
 * FEAT-20260919-619 — `<` and `>`: one rung down or up, and no wrap. A key
 * that goes from 2× back round to 0.5× is a surprise; the ends are the ends.
 */
export function stepSpeed(
  rate: number,
  direction: 1 | -1,
  rates: readonly number[] = SPEEDS,
): number {
  const idx = rates.indexOf(rate);
  const at = idx === -1 ? rates.indexOf(1) : idx;
  return rates[Math.max(0, Math.min(at + direction, rates.length - 1))];
}
