'use client';

import {
  type ForwardedRef,
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import { en } from '../labels/en';
import { LabelsProvider } from '../labels';
import { centreTransport } from '../logic/centre-transport-visibility';
import { PlayerFrame } from './player-frame';
import { PlayerLayers } from './player-layers';
import { createPlayheadStore } from './playhead-store';
import { useSourceRefs } from './source-refs';
import { localStoragePlayerStorage } from './storage/local-storage';
import type {
  PlayerAspectRatio,
  PlayerHandle,
  PlayerProps,
} from './types';
import { useControlsVisibility } from './use-controls-visibility';
import { useElementTimeline } from './use-element-timeline';
import { useFrameGestures } from './use-frame-gestures';
import { useFullscreen } from './use-fullscreen';
import { useHlsEngine } from './use-hls-engine';
import { usePlayPauseConfirm } from './use-play-pause-confirm';
import { usePlaybackRate } from './use-playback-rate';
import { usePlayerFrame } from './use-player-frame';
import { usePlayerKeys } from './use-player-keys';
import { useSourceController } from './use-source-controller';
import { useVolume } from './use-volume';
import { VideoElement } from './video-element';

/** `'16:9'` → `'16/9'`, the spelling CSS `aspect-ratio` takes. */
function cssAspectRatio(ratio: PlayerAspectRatio): string {
  return ratio.replace(':', '/');
}

const noop = () => {};
/** Nothing in this slice runs a branded clip (`useBrandIntro`). */
const noIntro = () => false;
/** Nothing in this slice owns an audio menu (`useAudioSelection`). */
const noAudioTracks = () => {};

/**
 * FEAT-20260925-718 L3 — the first `<Player>`: the core half of luna-watch's
 * `components/video-player.tsx`, composed from the lifted hooks.
 *
 * What that file also wires and this does not: the branded intro, the
 * stream warmup on hover, the resume question and the rest of
 * `use-playback-doors.ts`, audio and subtitle selection, video fit, PiP, the
 * sleep timer, and everything of Luna's (watch progress, remotes, cast,
 * learning, the end screen, credits). The doors this slice keeps are the
 * source controller's own, without a resume to answer.
 *
 * A new `src`, `hlsSrc` or `fallbackSrc` remounts the player, as every page
 * in luna-watch does with its `key`: the fallback hop, the error and the
 * once-per-source `onError` all start over with the source.
 */
export const Player = forwardRef<PlayerHandle, PlayerProps>(
  function Player(props, ref) {
    return (
      <PlayerInstance
        key={`${props.src}\n${props.hlsSrc ?? ''}\n${props.fallbackSrc ?? ''}`}
        {...props}
        handleRef={ref}
      />
    );
  },
);

interface InstanceProps extends PlayerProps {
  handleRef: ForwardedRef<PlayerHandle>;
}

function PlayerInstance({
  src,
  fallbackSrc,
  hlsSrc,
  loadHls,
  hlsLoading,
  poster,
  title,
  aspectRatio = '16:9',
  onError,
  autoPlay = false,
  locale = 'en',
  labels: labelOverrides,
  storage: storageProp,
  onVideoElement,
  className,
  handleRef,
}: InstanceProps) {
  const labels = useMemo(
    () => ({ ...en, ...labelOverrides }),
    [labelOverrides],
  );
  // `undefined` is the default adapter; `null` keeps nothing. Made once:
  // the adapter touches storage only when called, never here.
  const [defaultStorage] = useState(() => localStoragePlayerStorage());
  const storage = storageProp === undefined ? defaultStorage : storageProp;

  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const subtitleTrackRef = useRef<HTMLTrackElement>(null);

  /**
   * FEAT-20260823-375 — publish the element to a host that needs to drive
   * it. Handing the node out is all this does.
   */
  useEffect(() => {
    onVideoElement?.(videoRef.current);
    return () => onVideoElement?.(null);
  }, [onVideoElement]);

  /**
   * The element lets go of its source when the player goes, so a range
   * request still in flight is aborted rather than left to finish for a
   * picture nobody will see.
   */
  useEffect(() => {
    const v = videoRef.current;
    return () => {
      if (!v) return;
      v.removeAttribute('src');
      v.load();
    };
  }, []);

  const { portalHost, isTouchDevice, finePointer, containerHeight } =
    usePlayerFrame({ containerRef });
  const refs = useSourceRefs();
  // The intro's two flags, permanently down: no clip ever holds the element.
  const introActiveRef = useRef(false);
  const introPendingRef = useRef(false);

  const [playing, setPlaying] = useState(false);
  const [playhead] = useState(createPlayheadStore);
  const [duration, setDuration] = useState(0);
  const [mediaReady, setMediaReady] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);
  const sound = useVolume({ videoRef, storage });
  const rate = usePlaybackRate({ videoRef, storage });

  const {
    pseudoFullscreen,
    fullscreenActive,
    enter: enterFullscreen,
    exit: exitFullscreen,
    toggle: toggleFullscreen,
  } = useFullscreen({ containerRef, videoRef, isTouchDevice, mediaReady });

  const engine = useHlsEngine({
    videoRef,
    src,
    fallbackSrc,
    hlsSrc,
    hlsLoading,
    loadHls,
    serverSeek: undefined,
    locale,
    onPlaybackExpired: undefined,
    refs,
    introActiveRef,
    introPendingRef,
    setIsBuffering,
    setHlsAudioTracks: noAudioTracks,
    setSelectedAudioTrack: noAudioTracks,
  });

  const source = useSourceController({
    videoRef,
    src,
    fallbackSrc,
    hlsSrc,
    serverSeek: undefined,
    duration,
    refs,
    introActiveRef,
    initHls: engine.initHls,
    resetEngine: engine.reset,
    runIntroClip: noIntro,
    skipIntro: noop,
    setIsBuffering,
    playhead,
  });
  const {
    doPlay,
    ensurePlaying,
    startContentAt,
    seekToTime,
    seekRestartsStream,
    fallbackToElementSrc,
  } = source;

  /**
   * The element refused the source and there was no fallback left to hop
   * to. The engine only raises `playbackFailed` for hls.js; this is the same
   * answer for a progressive source, so both get the notice and `onError`.
   */
  const [elementFailed, setElementFailed] = useState(false);
  const playbackFailed = engine.playbackFailed || elementFailed;
  const retryPlayback = useCallback(() => {
    setElementFailed(false);
    source.retryPlayback();
  }, [source.retryPlayback]);

  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;
  const reported = useRef(false);
  useEffect(() => {
    if (!playbackFailed || reported.current) return;
    reported.current = true;
    onErrorRef.current?.({ kind: 'playback' });
  }, [playbackFailed]);

  const confirm = usePlayPauseConfirm({ playing, doPlay });

  const seekTo = useCallback(
    (seconds: number) => {
      const v = videoRef.current;
      if (!v) return;
      // `seekToTime` refuses an element holding nothing; a seek before the
      // first play starts the film there instead, as `use-playback-doors.ts`
      // does.
      if (v.readyState === 0) {
        startContentAt(Math.max(0, seconds));
        return;
      }
      seekToTime(seconds);
    },
    [seekToTime, startContentAt],
  );

  // FEAT-20260914-584 — the fullscreen call is armed on a timer, and a
  // player unmounted inside those hundred milliseconds must not take the
  // next page fullscreen.
  const fullscreenTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (fullscreenTimer.current) clearTimeout(fullscreenTimer.current);
    },
    [],
  );
  const startFullscreen = useCallback(() => {
    if (!videoRef.current) return;
    startContentAt(null);
    fullscreenTimer.current = setTimeout(enterFullscreen, 100);
  }, [enterFullscreen, startContentAt]);

  useImperativeHandle(
    handleRef,
    () => ({
      play: ensurePlaying,
      pause: () => videoRef.current?.pause(),
      seekTo,
      getTime: () => playhead.get().time,
      startFullscreen,
    }),
    [ensurePlaying, seekTo, playhead, startFullscreen],
  );

  const autoPlayRef = useRef(autoPlay);
  // biome-ignore lint/correctness/useExhaustiveDependencies: once, on mount; a refused `play()` is swallowed where it is called
  useEffect(() => {
    if (autoPlayRef.current) ensurePlaying();
  }, []);

  const controls = useControlsVisibility({
    menuOpen: false,
    playing,
    fullscreenActive,
  });
  const { showControls, scheduleHide, showAndScheduleHide, hide: hideControls } =
    controls;

  const keys = usePlayerKeys({
    videoRef,
    containerRef,
    introActiveRef,
    showControls,
    fullscreenActive,
    pseudoFullscreen,
    finePointer,
    menuOpen: false,
    duration,
    playhead,
    doPlay: confirm.confirmedDoPlay,
    ensurePlaying,
    exitFullscreen,
    toggleFullscreen,
    seekToTime,
    seekRestartsStream,
    showAndScheduleHide,
    hideControls,
    setVolume: sound.setVolume,
    setMuted: sound.setMuted,
    onStepSpeed: rate.step,
    onToggleSubtitles: null,
    onRepeatLine: null,
    onPrevEpisode: undefined,
    onNextEpisode: undefined,
    onEpisodeChange: undefined,
  });
  // `?` opens luna-watch's key sheet, which this slice does not draw; an
  // open sheet nobody can see would leave every other key ignored.
  const { helpOpen, setHelpOpen } = keys;
  useEffect(() => {
    if (helpOpen) setHelpOpen(false);
  }, [helpOpen, setHelpOpen]);

  const gestures = useFrameGestures({
    videoRef,
    showControls,
    playing,
    playhead,
    showAndScheduleHide,
    hideControls,
    seekToTime,
  });

  const timeline = useElementTimeline({
    videoRef,
    introActiveRef,
    refs,
    playhead,
    duration,
    knownDuration: undefined,
    content: { id: undefined, type: 'movie' },
    onCurrentTime: undefined,
    setDuration,
    setMediaReady,
    restoreRate: rate.restore,
    storage,
  });

  /**
   * FEAT-20260830-489 — a finger gets the show/hide/double-tap model; a
   * mouse keeps the single click it has always had, because a mouse can
   * bring the controls back by moving.
   */
  const onPictureClick = (clientX: number, rect: DOMRect) => {
    if (!finePointer) {
      gestures.onTap(clientX, rect);
      return;
    }
    confirm.confirmedDoPlay();
  };

  const bar = useMemo(
    () => ({
      portalHost,
      playhead,
      duration,
      playing,
      muted: sound.muted,
      volume: sound.volume,
      playbackRate: rate.rate,
      isTouchDevice,
      fullscreenActive,
      introRange: undefined,
      outroRange: undefined,
      onSeek: seekToTime,
      onPlayPause: confirm.confirmedDoPlay,
      onToggleMute: sound.toggleMute,
      onVolumeChange: sound.setElementVolume,
      onCycleSpeed: rate.cycle,
      onToggleFullscreen: toggleFullscreen,
    }),
    [
      portalHost,
      playhead,
      duration,
      playing,
      sound.muted,
      sound.volume,
      sound.toggleMute,
      sound.setElementVolume,
      rate.rate,
      rate.cycle,
      isTouchDevice,
      fullscreenActive,
      seekToTime,
      confirm.confirmedDoPlay,
      toggleFullscreen,
    ],
  );

  const frame = (
    <PlayerFrame
      containerRef={containerRef}
      pseudoFullscreen={pseudoFullscreen}
      finePointer={finePointer}
      hidesCursor={controls.hidesCursor}
      onPictureClick={onPictureClick}
      onToggleFullscreen={toggleFullscreen}
      gestures={gestures}
      onActivity={showAndScheduleHide}
      onMouseEnter={noop}
      onTouchStart={noop}
      onPointerLeave={controls.hideOnPointerLeave}
      aspectRatio={cssAspectRatio(aspectRatio)}
    >
      <VideoElement
        videoRef={videoRef}
        objectFit={undefined}
        transform={undefined}
        poster={poster}
        onClick={(e) => {
          e.stopPropagation();
          onPictureClick(
            e.clientX,
            (containerRef.current ?? e.currentTarget).getBoundingClientRect(),
          );
        }}
        onPlay={() => {
          setPlaying(true);
          scheduleHide();
        }}
        onPlaying={() => setIsBuffering(false)}
        onWaiting={() => setIsBuffering(true)}
        onEnded={noop}
        onPause={() => {
          setPlaying(false);
          setIsBuffering(false);
          controls.show();
          timeline.savePosition();
        }}
        onTimeUpdate={timeline.onTimeUpdate}
        onLoadedMetadata={timeline.onLoadedMetadata}
        onDurationChange={timeline.onDurationChange}
        onVolumeChange={sound.onVolumeChange}
        onEmptied={() => setMediaReady(false)}
        onError={() => {
          setIsBuffering(false);
          if (fallbackSrc && !refs.usedFallback.current) {
            fallbackToElementSrc();
            return;
          }
          // Nothing left to hop to. hls.js reports its own failures, after
          // its own recovery; an element error under it is its business.
          if (!refs.hlsActive.current) setElementFailed(true);
        }}
        subtitleCueUrl={null}
        subtitleTrackRef={subtitleTrackRef}
        selectedSubtitle={null}
        subtitles={undefined}
        subtitleLabels={NO_SUBTITLES}
      />

      <PlayerLayers
        playbackFailed={playbackFailed}
        retryPlayback={retryPlayback}
        isBuffering={isBuffering}
        playing={playing}
        showControls={showControls}
        mediaReady={mediaReady}
        centreMode={centreTransport({
          mediaReady,
          finePointer,
          showControls,
          containerHeight,
        })}
        title={title || labels.ariaPlay}
        bar={bar}
        onPlay={doPlay}
        onSeekBy={(seconds) => {
          showAndScheduleHide();
          seekToTime(playhead.get().time + seconds);
        }}
        confirmToken={confirm.token}
        confirmIcon={confirm.icon}
        onConfirmDone={confirm.clear}
        feedback={keys.feedback ?? gestures.feedback}
      />
    </PlayerFrame>
  );

  return (
    <LabelsProvider labels={labels}>
      {className ? <div className={className}>{frame}</div> : frame}
    </LabelsProvider>
  );
}

/** Subtitles stay wired through `VideoElement`, and empty, in this slice. */
const NO_SUBTITLES: string[] = [];
