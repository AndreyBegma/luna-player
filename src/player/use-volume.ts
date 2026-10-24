'use client';

import { type RefObject, useCallback, useEffect, useState } from 'react';
import { sleepFadeActive } from '../logic/sleep-fade';
import { savedVolume } from '../logic/saved-volume';
import type { PlayerStorage } from './storage/player-storage';

interface Options {
  videoRef: RefObject<HTMLVideoElement | null>;
  /**
   * FEAT-20260925-718 L2 — where the level is kept (`'volume'`); absent or
   * `null` keeps nothing, and the element starts at its own level.
   */
  storage?: PlayerStorage | null;
}

interface Volume {
  volume: number;
  muted: boolean;
  setVolume: (volume: number) => void;
  setMuted: (muted: boolean) => void;
  toggleMute: () => void;
  /** The slider: a level, and unmuted, because a viewer moving it wants sound. */
  setElementVolume: (value: number) => void;
  /** The element's `volumechange`: the mirror follows the element. */
  onVolumeChange: () => void;
}

/**
 * FEAT-20260914-584 — the element's loudness, mirrored and driven, out of
 * the player. The element is the authority: the two setters are what the
 * keyboard hook writes, and `onVolumeChange` is what keeps the mirror true
 * whichever route changed it.
 *
 * FEAT-20260923-633 — and what the device comes back on: the level is put on
 * the element at mount and written back on every change, whichever route
 * made it. See `saved-volume.ts` for why mute is not.
 */
export function useVolume({ videoRef, storage = null }: Options): Volume {
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);

  // biome-ignore lint/correctness/useExhaustiveDependencies: the saved level is put on once per element, as before the seam
  useEffect(() => {
    const v = videoRef.current;
    const level = savedVolume(readStored(storage));
    // The element's `volumechange` updates the mirror.
    if (v && level !== null) v.volume = level;
  }, [videoRef]);

  const toggleMute = useCallback(() => {
    const v = videoRef.current;
    if (v) {
      v.muted = !v.muted;
      setMuted(v.muted);
    }
  }, [videoRef]);

  const setElementVolume = useCallback(
    (value: number) => {
      const v = videoRef.current;
      if (v) {
        v.volume = value;
        v.muted = false;
      }
    },
    [videoRef],
  );

  const onVolumeChange = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    setVolume(v.volume);
    setMuted(v.muted);
    // FEAT-20260923-652 increment 3 — the sleep timer's fade writes this
    // element's `.volume` too, and its ramp must never be learned as the
    // device's remembered level.
    if (!sleepFadeActive.value) writeStored(storage, v.volume);
  }, [videoRef, storage]);

  return {
    volume,
    muted,
    setVolume,
    setMuted,
    toggleMute,
    setElementVolume,
    onVolumeChange,
  };
}

/** Storage can be refused (a private window, a full quota); the film plays at the element's own level then. */
function readStored(storage: PlayerStorage | null): string | null {
  try {
    return storage?.get('volume') ?? null;
  } catch {
    return null;
  }
}

function writeStored(storage: PlayerStorage | null, level: number): void {
  try {
    storage?.set('volume', String(level));
  } catch {
    // Not remembered on this device; the film is unaffected.
  }
}
