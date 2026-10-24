'use client';

import { type RefObject, useEffect } from 'react';

interface Options {
  videoRef: RefObject<HTMLVideoElement | null>;
  ensurePlaying: () => void;
  /** FEAT-20260923-633 — to the neighbouring episode; see `use-player-keys.ts`. */
  stepEpisode: (direction: 1 | -1) => boolean;
  hasPrevEpisode: boolean;
  hasNextEpisode: boolean;
}

/**
 * FEAT-20260919-619 — the two platform registrations, moved out of
 * `use-player-keys.ts` unchanged so that file has room for the keys
 * themselves. Called from inside `usePlayerKeys`; the hub does not know it
 * exists.
 */
export function usePlatformMediaKeys({
  videoRef,
  ensurePlaying,
  stepEpisode,
  hasPrevEpisode,
  hasNextEpisode,
}: Options): void {
  /**
   * BUG-20260820-238 — ask Samsung to actually deliver the transport keys.
   *
   * On Tizen a page receives only the keys it has registered for; the media
   * keys are not among the defaults, so before this the events did not merely
   * go unmatched — they never arrived. Nothing else in the fix can help if
   * that is the case, which is why it runs before any of it.
   *
   * Wrapped because touching `tizen.*` anywhere else throws, and inert on
   * every other platform, which delivers these keys without being asked.
   */
  useEffect(() => {
    const tizen = (
      window as unknown as {
        tizen?: { tvinputdevice?: { registerKey?: (name: string) => void } };
      }
    ).tizen;
    const register = tizen?.tvinputdevice?.registerKey;
    if (!register) return;

    for (const name of [
      'MediaPlayPause',
      'MediaPlay',
      'MediaPause',
      'MediaStop',
      // FEAT-20260923-633
      'MediaRewind',
      'MediaFastForward',
      'MediaTrackPrevious',
      'MediaTrackNext',
    ]) {
      try {
        register.call(tizen.tvinputdevice, name);
      } catch {
        // A set that does not know this particular key rejects it by throwing;
        // the rest must still be registered.
      }
    }
  }, []);

  /**
   * BUG-20260820-236 — the transport controls the platform owns.
   *
   * A remote's dedicated play/pause key, the TV's own on-screen controls and
   * the OS media widget all route through here rather than through a key
   * event, which is why none of them did anything before. Guarded because
   * `mediaSession` is still absent on some engines, and each handler is
   * cleared on unmount so a stale player cannot keep answering for a page
   * that has moved on.
   */
  useEffect(() => {
    const ms =
      typeof navigator !== 'undefined' ? navigator.mediaSession : undefined;
    if (!ms?.setActionHandler) return;

    const set = (action: MediaSessionAction, handler: (() => void) | null) => {
      // An engine that knows mediaSession may still not know a given action,
      // and rejects it by throwing rather than by returning anything.
      try {
        ms.setActionHandler(action, handler);
      } catch {
        /* unsupported action on this engine */
      }
    };

    set('play', () => ensurePlaying());
    set('pause', () => videoRef.current?.pause());

    return () => {
      set('play', null);
      set('pause', null);
    };
  }, [ensurePlaying, videoRef]);

  /**
   * FEAT-20260923-633 — the OS widget's, the lock screen's and a Bluetooth
   * headset's next / previous. Registered only while that neighbour exists:
   * a handler is what makes the platform draw the button, and a button that
   * does nothing is worse than none.
   */
  useEffect(() => {
    const ms =
      typeof navigator !== 'undefined' ? navigator.mediaSession : undefined;
    if (!ms?.setActionHandler) return;

    const set = (action: MediaSessionAction, handler: (() => void) | null) => {
      try {
        ms.setActionHandler(action, handler);
      } catch {
        /* unsupported action on this engine */
      }
    };

    set('previoustrack', hasPrevEpisode ? () => stepEpisode(-1) : null);
    set('nexttrack', hasNextEpisode ? () => stepEpisode(1) : null);

    return () => {
      set('previoustrack', null);
      set('nexttrack', null);
    };
  }, [stepEpisode, hasPrevEpisode, hasNextEpisode]);
}
