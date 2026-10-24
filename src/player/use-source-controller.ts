'use client';

import { type RefObject, useCallback } from 'react';
import type { PlayheadStore } from './playhead-store';
import { cancelResumeSeek, resumeSeek } from './resume-seek';
import type { SourceRefs } from './source-refs';
import { activeBaseUrl, restartsOnServer, type ServerSeek } from './source-url';

interface Options {
  videoRef: RefObject<HTMLVideoElement | null>;
  src: string;
  fallbackSrc: string | undefined;
  hlsSrc: string | undefined;
  /** FEAT-20260925-718 S4 — the server-seek protocol, or none. */
  serverSeek: ServerSeek | undefined;
  duration: number;
  refs: SourceRefs;
  /** FEAT-20260821-261 — true only while the branded clip is on screen. */
  introActiveRef: RefObject<boolean>;
  /** The engine's attach, and its reset for the retry button. */
  initHls: (autoplay: boolean) => void;
  resetEngine: () => void;
  /** `useBrandIntro`'s `run` and `skip`. */
  runIntroClip: (then: () => void) => boolean;
  skipIntro: () => void;
  setIsBuffering: (buffering: boolean) => void;
  /**
   * FEAT-20260914-584 (#1053) — written on a server-side reload so the bar
   * shows the target second while the element counts from zero again.
   */
  playhead: PlayheadStore;
}

/**
 * FEAT-20260828-464 — what attaches a source to the element and moves
 * through it, out of the player: play and pause with the clip in front,
 * the resume position, every seek, and the element's own fallback.
 */
export function useSourceController({
  videoRef,
  src,
  fallbackSrc,
  hlsSrc,
  serverSeek,
  duration,
  refs,
  introActiveRef,
  initHls,
  resetEngine,
  runIntroClip,
  skipIntro,
  setIsBuffering,
  playhead,
}: Options) {
  /**
   * BUG-20260824-402 — the clip takes the element, so the film is no longer
   * the loaded source and `srcLoaded` must stop claiming that it is.
   *
   * `playContent` reads that flag to decide whether to attach the film, and
   * while it said yes over a clip-loaded element the continuation skipped
   * the attach and called `play()` on the clip. The clip then ran from the
   * zero `finish` had just set, reached its own end, and `ended` — by then
   * past the intro guard — banked its seven or fifteen seconds as the film's
   * position *and* as the film's duration. Atlas computes `completed` from
   * the duration it is handed, so a two-hour film came back finished, lost
   * its resume position, and left the account's completion rate wrong. Four
   * production rows read `position 15, duration 15, completed true`.
   *
   * Cleared here rather than inside the hook: `srcLoaded` is the player's own
   * bookkeeping about the player's own source, and the hook has no business
   * knowing it exists. `run` answering true is exactly "the element is mine
   * now", including the touch case where it was already pointed at the clip.
   */
  const runIntro = useCallback(
    (then: () => void) => {
      const took = runIntroClip(then);
      if (took) refs.srcLoaded.current = false;
      return took;
    },
    [runIntroClip, refs],
  );

  /**
   * Attach the film if it is not attached, then play it — or, with `toggle`,
   * pause it if it is already playing. The two callers used to be two
   * functions that differed by exactly that pause.
   */
  const playContent = useCallback(
    (toggle: boolean) => {
      const v = videoRef.current;
      if (!v) return;
      // FEAT-20260821-261 — the clip is consumed by the first content
      // playback whichever route reaches it, so it can never appear part-way
      // through a film.
      skipIntro();
      // FEAT-20260824-377 — one branch for every device. `initHls` decides
      // between hls.js and native playback per engine rather than per input
      // method, so a phone reaches the manifest's levels and dubs the same way
      // a desktop does.
      if (hlsSrc) {
        if (!refs.hlsActive.current) {
          initHls(true);
        } else {
          if (refs.pendingSeek.current !== null) {
            // BUG-20260930-719 — written, then held until it lands.
            resumeSeek(v, refs.pendingSeek.current);
            refs.pendingSeek.current = null;
          }
          if (v.paused) v.play().catch(() => {});
          else if (toggle) v.pause();
        }
        return;
      }
      if (!refs.srcLoaded.current) {
        refs.seekOffset.current = 0;
        v.src = src;
        v.load();
        refs.srcLoaded.current = true;
      }
      if (v.paused) v.play().catch(() => {});
      else if (toggle) v.pause();
    },
    [videoRef, src, hlsSrc, initHls, skipIntro, refs],
  );

  const ensureContentPlaying = useCallback(
    () => playContent(false),
    [playContent],
  );

  /**
   * FEAT-20260821-261 — the two ways playback is asked for, with the clip in
   * front of both.
   *
   * While it is on screen they do nothing at all: there is no skip, and that
   * includes the click on the picture, the space bar and the play/pause key on
   * a remote, all of which arrive here. `runIntro` answers false once the clip
   * has had its turn for this mount, so every later call falls straight
   * through to the content.
   */
  const doPlay = useCallback(() => {
    if (introActiveRef.current) return;
    if (runIntro(ensureContentPlaying)) return;
    playContent(true);
  }, [introActiveRef, playContent, ensureContentPlaying, runIntro]);

  const ensurePlaying = useCallback(() => {
    if (introActiveRef.current) return;
    if (runIntro(ensureContentPlaying)) return;
    ensureContentPlaying();
  }, [introActiveRef, ensureContentPlaying, runIntro]);

  /**
   * BUG-20260820-213 — what the page reload used to be, without the reload:
   * drop whatever is left of the dead instance and start a fresh one at the
   * position the picture froze at (`pendingSeek`, set when we gave up).
   */
  const retryPlayback = useCallback(() => {
    resetEngine();
    ensurePlaying();
  }, [resetEngine, ensurePlaying]);

  const buildServerSrc = useCallback(
    (seek: ServerSeek, t: number, audioIdx?: number) =>
      seek.buildUrl(
        activeBaseUrl(src, fallbackSrc, refs.usingFallbackSrc.current),
        { time: t, audio: audioIdx },
      ),
    [src, fallbackSrc, refs],
  );

  /**
   * FEAT-20260822-289 — start the film, at a saved position or from the top.
   *
   * Lifted out of `startPlayback` so the same code runs whether it is reached
   * directly or as the branded clip's continuation. Before this feature a
   * resume never followed a clip, so the two could afford to be the same
   * lines written twice; now that the clip opens a resume as well, the film
   * has to arrive identically either way — and in particular the position has
   * to be applied by the code that attaches the source, after the clip has
   * given the element back.
   */
  const startContentAt = useCallback(
    (startAt: number | null) => {
      const v = videoRef.current;
      if (!v) return;
      // BUG-20260930-719 — a new start decides the position afresh.
      cancelResumeSeek(v);

      if (startAt === null) {
        ensurePlaying();
        return;
      }

      if (hlsSrc) {
        refs.pendingSeek.current = startAt;
        ensurePlaying();
        return;
      }

      if (restartsOnServer(serverSeek, refs.usingFallbackSrc.current)) {
        const sec = Math.floor(startAt);
        refs.seekOffset.current = sec;
        v.src = buildServerSrc(serverSeek, sec, refs.audioIndex.current);
        v.load();
        setIsBuffering(true);
        playhead.set({ time: sec, buffered: 0 });
        refs.srcLoaded.current = true;
        v.play().catch(() => {});
        return;
      }

      refs.pendingSeek.current = startAt;
      ensurePlaying();
    },
    [
      videoRef,
      buildServerSrc,
      ensurePlaying,
      hlsSrc,
      serverSeek,
      refs,
      setIsBuffering,
      playhead,
    ],
  );

  const seekToTime = useCallback(
    (targetTime: number) => {
      const v = videoRef.current;
      if (!v) return;
      // FEAT-20260821-261 — the single door every seek goes through: the
      // progress bar, the arrow keys, the transport buttons and the phone
      // remote. Closing it here is what makes the clip unskippable rather
      // than merely uncomfortable to skip.
      if (introActiveRef.current) return;
      /**
       * FEAT-20260830-489 — nothing is attached, so there is nothing to seek.
       *
       * `readyState === 0` is `HAVE_NOTHING`: the element has not been asked to
       * load anything, which on a title page is its state until the viewer
       * shows intent. Measured on staging, ArrowRight moved `currentTime` from
       * 0 to 10 on a player holding nothing — the position then read `0:10`
       * against a duration seeded from the episode record, which is the fake
       * success state `glass-material.md` rule 4 exists to forbid.
       *
       * Here rather than in each caller because this is, as above, the single
       * door: the arrow keys, the scrubber, the transport buttons, the media
       * keys and the phone remote all arrive through it.
       */
      if (v.readyState === 0) return;
      // BUG-20260930-719 — the viewer's own seek outranks a held resume.
      cancelResumeSeek(v);
      const clamped = Math.max(0, Math.min(targetTime, duration || Infinity));
      if (refs.hlsActive.current) {
        v.currentTime = clamped;
      } else if (restartsOnServer(serverSeek, refs.usingFallbackSrc.current)) {
        const t = Math.floor(clamped);
        refs.seekOffset.current = t;
        const wasPlaying = !v.paused;
        v.src = buildServerSrc(serverSeek, t, refs.audioIndex.current);
        v.load();
        setIsBuffering(true);
        playhead.set({ time: t, buffered: 0 });
        if (wasPlaying) v.play().catch(() => {});
      } else {
        v.currentTime = clamped;
      }
    },
    [
      videoRef,
      introActiveRef,
      duration,
      serverSeek,
      buildServerSrc,
      refs,
      setIsBuffering,
      playhead,
    ],
  );

  /**
   * The element refused the source (a remux a browser cannot decode, say):
   * hop to the fallback URL once, keeping play state. Audit 453 F-17 notes
   * this hop carries no position; that is a separate item.
   *
   * FEAT-20260923-661 Q-04 — and since it starts at zero, so does the clock:
   * an offset left from a server-side seek put the scrubber and the saved
   * position that far ahead of the picture.
   */
  const fallbackToElementSrc = useCallback(() => {
    const v = videoRef.current;
    if (!v || !fallbackSrc || refs.usedFallback.current) return;
    refs.usedFallback.current = true;
    refs.usingFallbackSrc.current = true;
    refs.seekOffset.current = 0;
    cancelResumeSeek(v);
    const wasPlaying = !v.paused;
    v.src = fallbackSrc;
    v.load();
    if (wasPlaying) v.play().catch(() => {});
  }, [videoRef, fallbackSrc, refs]);

  /**
   * FEAT-20260919-619 — does a seek on this source restart the stream? The
   * same branch `seekToTime` takes, read at the moment it is asked: the HLS
   * engine seeks in place; the server-seek and element-fallback paths rebuild
   * the source and reload. A held arrow commits per tick on the first and
   * once on release on the second (`use-hold-seek.ts`).
   */
  const seekRestartsStream = useCallback(
    () =>
      !refs.hlsActive.current &&
      restartsOnServer(serverSeek, refs.usingFallbackSrc.current),
    [refs, serverSeek],
  );

  return {
    runIntro,
    doPlay,
    ensurePlaying,
    retryPlayback,
    startContentAt,
    seekToTime,
    seekRestartsStream,
    fallbackToElementSrc,
  };
}
