'use client';

import type { Dispatch, RefObject, SetStateAction } from 'react';
import type { PlayheadStore } from './playhead-store';
import { resumeSeek } from './resume-seek';
import type { SourceRefs } from './source-refs';
import type { PlayerStorage } from './storage/player-storage';

/**
 * The last half-minute counts as watched: no position is kept inside it, and
 * reaching it clears the one kept before.
 */
const WATCHED_TAIL_SECONDS = 30;

interface Options {
  videoRef: RefObject<HTMLVideoElement | null>;
  /** FEAT-20260821-261 — true only while the branded clip is on screen. */
  introActiveRef: RefObject<boolean>;
  refs: SourceRefs;
  playhead: PlayheadStore;
  duration: number;
  knownDuration: number | null | undefined;
  /** The film or episode whose position is saved; `undefined` saves nothing. */
  content: { id: string | undefined; type: 'movie' | 'episode' };
  onCurrentTime: ((time: number) => void) | undefined;
  setDuration: Dispatch<SetStateAction<number>>;
  setMediaReady: (ready: boolean) => void;
  /** Put the remembered speed back once the element has media. */
  restoreRate: () => void;
  /**
   * FEAT-20260925-718 L2 — where the position is kept, as the player is
   * given it; absent or `null` keeps nothing.
   */
  storage?: PlayerStorage | null;
}

interface ElementTimeline {
  /** The pause handler's share: the position, saved for the next visit. */
  savePosition: () => void;
  onTimeUpdate: () => void;
  onLoadedMetadata: () => void;
  onDurationChange: () => void;
}

/**
 * FEAT-20260923-633 — the element's clock, moved out of the hub unchanged:
 * where the film is, how long it is, when it has media, and the position
 * kept for the next visit. Moved to bring `video-player.tsx` under the
 * 800-line ceiling; every handler keeps its comments and its guards.
 */
export function useElementTimeline({
  videoRef,
  introActiveRef,
  refs,
  playhead,
  duration,
  knownDuration,
  content,
  onCurrentTime,
  setDuration,
  setMediaReady,
  restoreRate,
  storage = null,
}: Options): ElementTimeline {
  const inWatchedTail = (absTime: number) =>
    duration > 0 && duration - absTime < WATCHED_TAIL_SECONDS;

  const savePosition = () => {
    // FEAT-20260821-261 — the pause that ends the clip is ours, and its
    // position is not a position in the film.
    if (introActiveRef.current) return;
    const v = videoRef.current;
    const absTime = (v?.currentTime ?? 0) + refs.seekOffset.current;
    // FEAT-20260923-661 Q-09 — nor is the pause an ended element fires: it
    // wrote the end back after `onTimeUpdate` had cleared it, and a finished
    // film then offered to continue from its last minute.
    if (inWatchedTail(absTime)) return;
    if (content.id && v && absTime > 5)
      storage?.set('position', String(absTime), {
        contentId: content.id,
        contentType: content.type,
      });
  };

  const onTimeUpdate = () => {
    const v = videoRef.current;
    if (!v) return;
    // FEAT-20260821-261 — the clip's clock is not the film's; letting it
    // through would drive the progress bar and clear saved positions.
    if (introActiveRef.current) return;
    const absTime = v.currentTime + refs.seekOffset.current;
    const bufferedEnd =
      v.buffered.length > 0 ? v.buffered.end(v.buffered.length - 1) : null;
    playhead.set({
      time: absTime,
      buffered:
        bufferedEnd === null
          ? undefined
          : ((bufferedEnd + refs.seekOffset.current) /
              (duration || v.duration)) *
            100,
    });
    // FEAT-20260901-516 — the same number the seek bar and the cue
    // layer are driven by, published for a transcript that lives
    // outside this component. `seekOffset` is already in it, so it is
    // a position in the film rather than into a served segment.
    onCurrentTime?.(absTime);
    if (content.id && inWatchedTail(absTime))
      storage?.remove('position', {
        contentId: content.id,
        contentType: content.type,
      });
  };

  const onLoadedMetadata = () => {
    const v = videoRef.current;
    if (!v) return;
    // FEAT-20260823-365 — set before the intro guard below, because a
    // clip is still media: the transport belongs on screen from the
    // moment anything at all is attached.
    setMediaReady(true);
    // FEAT-20260821-261 — seven seconds is the clip's duration, not the
    // film's, and a pending resume is not a position inside it.
    if (introActiveRef.current) return;
    restoreRate();
    if (knownDuration && knownDuration > 0) {
      setDuration(knownDuration);
    } else {
      const reported = v.duration;
      if (Number.isFinite(reported) && reported > 0) setDuration(reported);
    }
    if (refs.pendingSeek.current !== null) {
      // BUG-20260930-719 — iOS drops a seek made this early on HLS; the
      // resume is re-applied until `seekable` reaches it.
      resumeSeek(v, refs.pendingSeek.current);
      refs.pendingSeek.current = null;
    }
  };

  const onDurationChange = () => {
    if (introActiveRef.current) return;
    if (knownDuration && knownDuration > 0) return;
    const reported = videoRef.current?.duration ?? 0;
    if (Number.isFinite(reported) && reported > 0) setDuration(reported);
  };

  return { savePosition, onTimeUpdate, onLoadedMetadata, onDurationChange };
}
