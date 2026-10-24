'use client';

import type {
  HlsAudioTracksUpdatedLike,
  HlsConstructorLike,
  HlsErrorDataLike,
  HlsLevelSwitchedLike,
  HlsLoader,
} from './hls-types';
import { cancelResumeSeek, resumeSeek } from './resume-seek';
import {
  type RefObject,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import type { AudioTrack, QualityLevel } from './tracks/types';
import { audioTrackLabels } from '../logic/audio-track-labels';
import type { SourceRefs } from './source-refs';
import type { HlsLoading } from './types';
import { activeBaseUrl, type ServerSeek } from './source-url';

/**
 * BUG-20260820-213 — how many fatal hls.js errors in a row we try to recover
 * from before telling the user. Counted consecutively: a successfully buffered
 * fragment resets it, so a two-hour film that hiccups every twenty minutes is
 * not spending a single lifetime allowance. Without a bound a permanently dead
 * stream would hammer the API proxy — and on the NAS that proxy is the thing
 * serving every byte of video.
 */
const HLS_RECOVERY_ATTEMPTS = 3;

/**
 * BUG-20260918-617 — hls.js's fragment policy with a longer wait for the
 * first byte, and nothing else changed: the retry counts and delays are the
 * library's own, read from its defaults rather than copied. The total load
 * time grows by the same amount, or a held segment that then arrives slowly
 * would be cut off by the bound it used to fit inside.
 */
function segmentLoadPolicy(hls: HlsConstructorLike, firstByteMs: number) {
  const policy = hls.DefaultConfig.fragLoadPolicy;
  return {
    ...policy,
    default: {
      ...policy.default,
      maxTimeToFirstByteMs: firstByteMs,
      maxLoadTimeMs: policy.default.maxLoadTimeMs + firstByteMs,
    },
  };
}

interface Options {
  videoRef: RefObject<HTMLVideoElement | null>;
  src: string;
  fallbackSrc: string | undefined;
  hlsSrc: string | undefined;
  /** BUG-20260918-617 — see `VideoPlayerProps.hlsLoading`. */
  hlsLoading: HlsLoading | undefined;
  /**
   * FEAT-20260925-718 L2 — where hls.js comes from, or none: without a
   * loader an `hlsSrc` is not driven by script, and the element plays `src`
   * the way it does where hls.js is unsupported.
   */
  loadHls: HlsLoader | undefined;
  /** FEAT-20260925-718 S4 — the server-seek protocol, or none. */
  serverSeek: ServerSeek | undefined;
  locale: string;
  onPlaybackExpired: (() => Promise<unknown>) | undefined;
  refs: SourceRefs;
  /** FEAT-20260821-261 — true only while the branded clip is on screen. */
  introActiveRef: RefObject<boolean>;
  /** FEAT-20260821-261 — true until the clip has played, or been ruled out. */
  introPendingRef: RefObject<boolean>;
  setIsBuffering: (buffering: boolean) => void;
  /** The manifest's dubs, handed to whoever owns the audio menu. */
  setHlsAudioTracks: (tracks: AudioTrack[]) => void;
  setSelectedAudioTrack: (index: number) => void;
}

/**
 * FEAT-20260828-464 — the hls.js engine, out of the player: the one engine
 * decision per device, the manifest's levels and dubs, the bounded recovery
 * and the fallback chain, and the quality menu that reads the levels.
 */
export function useHlsEngine({
  videoRef,
  src,
  fallbackSrc,
  hlsSrc,
  hlsLoading,
  loadHls,
  serverSeek,
  locale,
  onPlaybackExpired,
  refs,
  introActiveRef,
  introPendingRef,
  setIsBuffering,
  setHlsAudioTracks,
  setSelectedAudioTrack,
}: Options) {
  // FEAT-20260821-254 — one refresh per stall, not per mount. See the ERROR
  // handler, and FRAG_BUFFERED for when it is re-armed.
  const refreshedUrls = useRef(false);
  const hlsRecoveries = useRef(0);
  /**
   * FEAT-20260923-661 Q-01 — which attach is current. `detach` moves it on,
   * and an attach whose `import('hls.js')` resolves after that — the player
   * unmounted, or the stream was swapped, while the chunk was on its way —
   * builds nothing. Without it the late attach put a live instance on a
   * detached element that nothing would ever destroy, or attached the old
   * dub over the new one.
   */
  const generation = useRef(0);
  /**
   * FEAT-20260923-661 Q-02 — a 401 handed the source to `onPlaybackExpired`,
   * and the next source to arrive is its answer. The online pages re-attach
   * it themselves through `reloadAt`; the local pages and the party only set
   * the new URL, so the engine attaches it when it lands.
   */
  const awaitingRefresh = useRef(false);

  // BUG-20260819-207 — quality and audio for HLS streams come from the
  // manifest, not from the API: an online stream has no file on disk for
  // ffprobe to inspect.
  const [levels, setLevels] = useState<QualityLevel[]>([]);
  const [selectedLevel, setSelectedLevel] = useState(-1);
  const [activeLevelHeight, setActiveLevelHeight] = useState<number | null>(
    null,
  );
  const [showQualityMenu, setShowQualityMenu] = useState(false);
  // BUG-20260820-213 — set once hls.js has given up, so the frozen frame gets
  // an explanation and a retry instead of silence.
  const [playbackFailed, setPlaybackFailed] = useState(false);

  /**
   * FEAT-20260923-661 Q-05 — let go of the element: the one place that knows
   * everything an attached instance has claimed. It used to be four copies of
   * the same four lines, and every flag added since would have been a fifth
   * thing each copy had to remember.
   */
  const detach = useCallback(() => {
    generation.current += 1;
    refs.hls.current?.destroy();
    refs.hls.current = null;
    refs.hlsActive.current = false;
    refs.srcLoaded.current = false;
    // BUG-20260930-719 — a resume held for this stream goes with it.
    cancelResumeSeek(videoRef.current);
    // Q-03 — the levels belonged to that instance's manifest.
    setLevels([]);
    setActiveLevelHeight(null);
  }, [refs, videoRef]);

  const initHls = useCallback(
    (autoplay: boolean) => {
      /**
       * FEAT-20260821-261 — hls.js may not touch the element until the clip
       * has had its turn.
       *
       * Attaching replaces the element's source with hls.js's own
       * MediaSource, so an attach that lands while the clip is on screen
       * takes it off mid-frame — and one that landed just before leaves the
       * player believing a stream is attached that the clip has since
       * displaced. The pointer crossing the player is enough to get here, so
       * neither is theoretical: the prefetch on hover is what found this.
       *
       * Both are refused by waiting for the clip to be done rather than for
       * it to be off screen. The stream is warmed by a plain request for the
       * manifest instead, which is what costs the time on the NAS anyway.
       */
      if (introPendingRef.current || introActiveRef.current) return;
      if (refs.hlsActive.current || !hlsSrc) return;
      const v = videoRef.current;
      if (!v) return;
      const attempt = generation.current;
      // FEAT-20260925-718 L2 — no loader is no engine: settled on the same
      // tick a loaded chunk would be, so every guard below still applies.
      const loading = loadHls ? loadHls() : Promise.resolve(null);
      loading.then((loaded) => {
        const Hls = loaded?.default;
        if (attempt !== generation.current) return;
        // FEAT-20260821-261 — the guard above ran before this import
        // resolved, and the viewer may have started the clip in between.
        if (introPendingRef.current || introActiveRef.current) return;
        if (refs.hlsActive.current) return;
        /**
         * FEAT-20260824-377 — the one engine decision, for every device.
         *
         * `Hls.isSupported()` answers it: Media Source on desktop and
         * Android, and Managed Media Source on iOS 17.1+, which is the only
         * thing on an iPhone that exposes the manifest's levels and audio
         * alternates to a script at all. An iPhone older than that lands
         * here instead and plays the manifest natively — auto quality only,
         * with the audio menu fed from `video.audioTracks` by the audio hook.
         */
        if (!Hls?.isSupported()) {
          if (!refs.srcLoaded.current) {
            v.src = src;
            v.load();
            refs.srcLoaded.current = true;
          }
          if (autoplay && v.paused) v.play().catch(() => {});
          return;
        }
        setPlaybackFailed(false);
        hlsRecoveries.current = 0;
        /**
         * FEAT-20260823-374 — do not "optimise" this branch onto native HLS.
         *
         * Desktop Safari can play HLS itself, and `hlsNative` above already
         * knows it, so attaching hls.js here looks like waste: more
         * JavaScript, software demuxing, a MediaSource where the platform has
         * a decoder. Switching it would be a regression, and not an obvious
         * one.
         *
         * With MSE the element has no URL. AirPlay therefore cannot hand a
         * receiver an address to fetch from — it either streams from this
         * machine or reports no route — and the television needs to reach
         * nothing. On a native `src` the platform hands over the URL instead,
         * which works at home and fails at somebody else's house, where a
         * LAN or tailnet address means nothing. That case is the reason this
         * feature exists.
         */
        const instance = new Hls({
          maxBufferLength: hlsLoading?.forwardBufferSeconds ?? 60,
          maxMaxBufferLength: 600,
          maxBufferSize: 60 * 1024 * 1024,
          startLevel: -1,
          // BUG-20260930-719 — load from the resume position rather than from
          // segment 0, and let hls.js seek there once it has data.
          startPosition: refs.pendingSeek.current ?? -1,
          enableWorker: true,
          ...(hlsLoading
            ? { fragLoadPolicy: segmentLoadPolicy(Hls, hlsLoading.firstByteTimeoutMs) }
            : {}),
        });
        instance.loadSource(hlsSrc);
        instance.attachMedia(v);
        instance.on(Hls.Events.MANIFEST_PARSED, () => {
          // Q-03 — a new instance starts on auto (`startLevel: -1`), so that
          // is what the menu says, whatever was picked on the last manifest.
          setSelectedLevel(-1);
          setLevels(
            instance.levels
              .map((level, index) => ({ index, height: level.height }))
              .filter((level) => level.height > 0)
              // Highest first, the order every other player lists them in.
              .sort((a, b) => b.height - a.height),
          );
          if (refs.pendingSeek.current !== null) {
            // BUG-20260930-719 — the element is still `HAVE_NOTHING` here, a
            // write iOS drops; `resumeSeek` holds it until it lands.
            resumeSeek(v, refs.pendingSeek.current);
            refs.pendingSeek.current = null;
          }
          if (autoplay && v.paused) v.play().catch(() => {});
        });

        // Audio tracks arrive on their own event, not with the manifest:
        // reading instance.audioTracks in MANIFEST_PARSED gives an empty list
        // and silently hides the menu on streams that do have alternates.
        instance.on(Hls.Events.AUDIO_TRACKS_UPDATED, (_, data: HlsAudioTracksUpdatedLike) => {
          const labels = audioTrackLabels(data.audioTracks, locale);
          setHlsAudioTracks(
            data.audioTracks.map((track, index) => ({
              index,
              language: track.lang ?? null,
              title: labels[index],
              channels: 0,
            })),
          );
          setSelectedAudioTrack(instance.audioTrack);
        });

        // Keeps the "Auto" row showing what auto actually settled on.
        instance.on(Hls.Events.LEVEL_SWITCHED, (_, data: HlsLevelSwitchedLike) => {
          setActiveLevelHeight(instance.levels[data.level]?.height ?? null);
        });

        /**
         * BUG-20260820-213 — this path had no ERROR handler at all, and after
         * a fatal error hls.js stops loading for good. That is what the user
         * sees as a film freezing half-way through: the element is fine, the
         * buffer behind it simply stops being fed, so seeking lands in a range
         * nothing is loading and only a reload brings the stream back.
         *
         * Recovery is the one hls.js documents — reload on a network error,
         * flush and recover on a media error — bounded so a genuinely dead
         * stream cannot retry forever.
         */
        instance.on(Hls.Events.ERROR, (_, data: HlsErrorDataLike) => {
          if (!data.fatal) return;

          /**
           * FEAT-20260821-254 — an expired capability is not a broken stream.
           *
           * The same URL works again once it is signed afresh, so this is
           * tried before the fallback chain rather than after it: falling
           * back to a transcode because a token aged out would spend the
           * NAS's four cores on a problem a refresh solves.
           *
           * Narrow on purpose — only 401 and 403, and only once until a
           * fragment has played again. A broader rule would turn a genuinely
           * dead stream into a refresh loop, and the viewer would sit
           * watching a spinner instead of an error they can act on.
           */
          const status = data.response?.code;
          if (
            (status === 401 || status === 403) &&
            onPlaybackExpired &&
            !refreshedUrls.current
          ) {
            refreshedUrls.current = true;
            const stoppedAt = v.currentTime + refs.seekOffset.current;
            if (stoppedAt > 5) refs.pendingSeek.current = stoppedAt;
            detach();
            awaitingRefresh.current = true;
            void onPlaybackExpired();
            return;
          }

          if (hlsRecoveries.current < HLS_RECOVERY_ATTEMPTS) {
            hlsRecoveries.current += 1;
            if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
              instance.startLoad();
              return;
            }
            if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
              instance.recoverMediaError();
              return;
            }
          }

          // Out of attempts, or an error type hls.js has no recovery for.
          const stalledAt = v.currentTime + refs.seekOffset.current;
          detach();
          setIsBuffering(false);

          // Fall back the way the source controller does — but only to a URL
          // the element can actually play. In online mode `src` is the same
          // m3u8 as `hlsSrc`, and a desktop browser handed that just fails
          // again, silently, which is no better than the freeze.
          // BUG-20260820-215 — resume where it died. A fallback that starts
          // at zero throws away however far the viewer had got, which on a
          // long film is worse than the stall it is recovering from.
          //
          // Two ways to carry a position, and the stream decides which: a
          // server-seeking one takes it in the URL, because the transcode
          // begins at the offset it is asked for and cannot be sought
          // afterwards. Anything else seeks in the element, which the
          // existing onLoadedMetadata handler already does for pendingSeek.
          const resumeAt = stalledAt > 5 ? stalledAt : null;
          const applyResume = (base: string) => {
            if (resumeAt === null) return base;
            // FEAT-20260925-718 S4 — the primary's own flag, as before the
            // seam: a fallback-only seam leaves this on `pendingSeek`.
            if (serverSeek && !serverSeek.fallbackOnly) {
              refs.seekOffset.current = resumeAt;
              return serverSeek.buildUrl(
                activeBaseUrl(src, fallbackSrc, refs.usingFallbackSrc.current),
                { time: resumeAt, audio: refs.audioIndex.current },
              );
            }
            refs.pendingSeek.current = resumeAt;
            return base;
          };

          if (fallbackSrc && !refs.usedFallback.current) {
            refs.usedFallback.current = true;
            refs.usingFallbackSrc.current = true;
            v.src = applyResume(fallbackSrc);
            v.load();
            refs.srcLoaded.current = true;
            v.play().catch(() => {});
            return;
          }
          if (src !== hlsSrc) {
            v.src = applyResume(src);
            v.load();
            refs.srcLoaded.current = true;
            v.play().catch(() => {});
            return;
          }

          // Nothing left to try. Say so, and remember where it died so the
          // retry button can pick playback up there.
          refs.pendingSeek.current = stalledAt > 0 ? stalledAt : null;
          setPlaybackFailed(true);
        });

        // A fragment reaching the buffer means the stream is alive again, so
        // the budget above is per stall rather than per playback.
        instance.on(Hls.Events.FRAG_BUFFERED, () => {
          hlsRecoveries.current = 0;
          // BUG-20260924-665 — and the refreshed URLs work, so the next expiry
          // may be refreshed too. Once per mount stopped a film at its second
          // one: an online grant goes with every restart of the API, and a
          // long pause outlives a capability. A URL that 401s straight after
          // a refresh never buffers a fragment, so this cannot loop.
          refreshedUrls.current = false;
        });

        refs.hls.current = instance;
        refs.hlsActive.current = true;
        refs.srcLoaded.current = true;
      });
    },
    [
      hlsSrc,
      hlsLoading,
      loadHls,
      src,
      locale,
      fallbackSrc,
      serverSeek,
      onPlaybackExpired,
      videoRef,
      refs,
      introActiveRef,
      introPendingRef,
      detach,
      setIsBuffering,
      setHlsAudioTracks,
      setSelectedAudioTrack,
    ],
  );

  /**
   * BUG-20260820-213 — drop whatever is left of the dead instance so that the
   * next play starts a fresh one. The position the picture froze at is in
   * `pendingSeek`, set when we gave up.
   */
  const reset = useCallback(() => {
    detach();
    // Whoever resets now owns the next attach (`reloadAt`, Retry).
    awaitingRefresh.current = false;
    hlsRecoveries.current = 0;
    setPlaybackFailed(false);
  }, [detach]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: destroy hls instance when src/hlsSrc change to force reinit on next play
  useEffect(() => {
    // BUG-20260820-213 — new content, clean slate: a notice left over from the
    // previous episode would otherwise sit on top of a stream that is fine.
    setPlaybackFailed(false);
    hlsRecoveries.current = 0;
    // Q-02 — the refreshed URL has arrived; pick the film up where it
    // stopped (`pendingSeek`, set by the 401 path).
    if (awaitingRefresh.current) {
      awaitingRefresh.current = false;
      initHls(true);
    }
    return detach;
  }, [hlsSrc, src]);

  /**
   * BUG-20260905-571 — dismissal is Radix's, and nothing else may hold a
   * `document` listener for it.
   *
   * There was one here: a `click` handler that closed the menu unless the
   * target sat inside `[data-quality-menu]`. That marker was on the
   * hand-rolled wrapper FEAT-20260830-489 deleted when the gear moved onto
   * `glass-ui/menu`, and it exists nowhere in the app now — so the predicate
   * was false for every target and the handler closed the menu on any click at
   * all. Radix opens on `pointerdown` and the `click` of the same press
   * arrived a moment later, which is why the settings menu could be read only
   * while the mouse button was held down.
   *
   * `MenuContent` is a `DismissableLayer`: outside pointer-downs, Escape and
   * focus leaving the menu already close it, and they know what "outside"
   * means because the layer measures its own subtree rather than looking for
   * an attribute somebody has to remember to keep.
   */

  const switchQuality = useCallback(
    (index: number) => {
      setSelectedLevel(index);
      setShowQualityMenu(false);
      if (refs.hls.current) refs.hls.current.currentLevel = index;
    },
    [refs],
  );

  return {
    initHls,
    reset,
    playbackFailed,
    levels,
    selectedLevel,
    activeLevelHeight,
    showQualityMenu,
    setShowQualityMenu,
    switchQuality,
  };
}
