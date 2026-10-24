'use client';

import { type RefObject, useCallback, useEffect, useRef, useState } from 'react';
import { nextSpeed, savedRate, SPEEDS, stepSpeed } from '../logic/playback-rate';
import type { PlayerStorage } from './storage/player-storage';

interface Options {
  videoRef: RefObject<HTMLVideoElement | null>;
  /**
   * FEAT-20260925-718 S4 — the rung the Slow toggle drops to, or `null` for
   * no Slow toggle (`slow` is then never true and `toggleSlow` does nothing).
   * Luna passes learning mode's `SLOW_RATE`; it is already one of `SPEEDS`,
   * so the speed cycle and the toggle still edit one value.
   */
  slowRate?: number | null;
  /**
   * FEAT-20260925-718 S4 — the rungs the speed button cycles through and
   * `<` / `>` step along; `SPEEDS` unless the player is given its own.
   */
  rates?: readonly number[];
  /**
   * FEAT-20260925-718 L2 — where the rate is kept (`'speed'`); absent or
   * `null` keeps nothing.
   *
   * A device preference, not an account one — the same on every profile of
   * one television, like `use-video-fit.ts`'s key — so it is not scoped
   * through `watch-storage.ts`.
   */
  storage?: PlayerStorage | null;
}

interface PlaybackRate {
  rate: number;
  /** FEAT-20260902-541 — the film is at the slow rung, however it got there. */
  slow: boolean;
  /** The speed button: the next rung, wrapping. */
  cycle: () => void;
  /**
   * FEAT-20260919-619 — `<` / `>`: one rung down or up, stopping at the ends.
   * FEAT-20260923-633 — answers the rate it landed on, for the picture's pill.
   */
  step: (direction: 1 | -1) => number;
  toggleSlow: () => void;
  /**
   * Put the remembered rate back on the element once it has media —
   * `loadedmetadata` — because a fresh source comes in at 1×.
   */
  restore: () => void;
}

/**
 * FEAT-20260914-584 — the playback rate, out of the player.
 *
 * FEAT-20260902-541 — one door for the rate, because there are two controls
 * behind it: the speed cycle on the bar and the Slow toggle in the subtitle
 * menu. Both write `luna:speed`, so whichever was used last is the one this
 * device comes back on.
 */
export function usePlaybackRate({
  videoRef,
  slowRate = null,
  rates = SPEEDS,
  storage = null,
}: Options): PlaybackRate {
  const [rate, setRate] = useState(1);

  // biome-ignore lint/correctness/useExhaustiveDependencies: the stored rate is read once, at mount, as before the seam
  useEffect(() => {
    const saved = savedRate(readStored(storage), rates);
    if (saved !== null) setRate(saved);
  }, []);

  const applyRate = useCallback(
    (next: number) => {
      const v = videoRef.current;
      if (!v) return;
      v.playbackRate = next;
      setRate(next);
      writeStored(storage, next);
    },
    [videoRef, storage],
  );

  const cycle = useCallback(() => {
    applyRate(nextSpeed(rate, rates));
  }, [applyRate, rate, rates]);

  const step = useCallback(
    (direction: 1 | -1) => {
      const next = stepSpeed(rate, direction, rates);
      applyRate(next);
      return next;
    },
    [applyRate, rate, rates],
  );

  /**
   * FEAT-20260902-541 — Slow is `rate` at 0.75 and nothing else.
   *
   * Derived rather than stored, which is what the plan's "the existing SPEEDS
   * cycle still works and turning it changes the toggle to match" asks for:
   * there is one value, both controls edit it, and they cannot disagree about
   * whether the film is slowed. Turning it off restores the rate the viewer
   * was watching at, which is not always 1× — somebody who watches at 1.25×
   * and slows one line back is owed their own speed, not ours.
   */
  const rateBeforeSlow = useRef(1);
  const slow = slowRate !== null && rate === slowRate;

  const toggleSlow = useCallback(() => {
    if (slowRate === null) return;
    if (slow) {
      applyRate(rateBeforeSlow.current);
      return;
    }
    rateBeforeSlow.current = rate;
    applyRate(slowRate);
  }, [applyRate, slow, slowRate, rate]);

  const restore = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    if (rate !== 1) v.playbackRate = rate;
  }, [videoRef, rate]);

  return { rate, slow, cycle, step, toggleSlow, restore };
}

/**
 * FEAT-20260923-661 Q-02 — storage behind a `try`, as `use-volume.ts` and
 * `use-video-fit.ts` hold theirs: a browser that refuses site storage throws
 * on the first touch, and from the mount effect that took the whole app down
 * to `global-error`. The rate still applies; it is just not remembered.
 */
function readStored(storage: PlayerStorage | null): string | null {
  try {
    return storage?.get('speed') ?? null;
  } catch {
    return null;
  }
}

function writeStored(storage: PlayerStorage | null, rate: number): void {
  try {
    storage?.set('speed', String(rate));
  } catch {
    // Not remembered on this device; the film is unaffected.
  }
}
