'use client';

import type { MouseEvent, RefObject } from 'react';
import type { SubtitleTrack } from './tracks/types';
import './player-cues.css';
import { LaunchVeil, useLaunch } from './launch-veil';
import {
  useCuePlacement,
  useSubtitleAppearance,
} from './use-subtitle-appearance';

interface Props {
  videoRef: RefObject<HTMLVideoElement | null>;
  objectFit: 'cover' | undefined;
  transform: string | undefined;
  poster: string | undefined;
  onClick: (e: MouseEvent<HTMLVideoElement>) => void;
  onPlay: () => void;
  onPlaying: () => void;
  onWaiting: () => void;
  onEnded: () => void;
  onPause: () => void;
  onTimeUpdate: () => void;
  onLoadedMetadata: () => void;
  onDurationChange: () => void;
  onVolumeChange: () => void;
  onEmptied: () => void;
  onError: () => void;
  subtitleCueUrl: string | null;
  subtitleTrackRef: RefObject<HTMLTrackElement | null>;
  selectedSubtitle: number | null;
  subtitles: SubtitleTrack[] | undefined;
  subtitleLabels: string[];
}

/**
 * FEAT-20260919-622 — the `<video>` element and its own handlers, out of the
 * hub. Every handler is a closure the hub already built — over
 * `introActiveRef`, `refs.seekOffset`, `playhead`, `duration`, the state
 * setters and the rest it needs — so nothing here is rewritten, only
 * relocated to where its markup is.
 */
export function VideoElement({
  videoRef,
  objectFit,
  transform,
  poster,
  onClick,
  onPlay,
  onPlaying,
  onWaiting,
  onEnded,
  onPause,
  onTimeUpdate,
  onLoadedMetadata,
  onDurationChange,
  onVolumeChange,
  onEmptied,
  onError,
  subtitleCueUrl,
  subtitleTrackRef,
  selectedSubtitle,
  subtitles,
  subtitleLabels,
}: Props) {
  const cues = useSubtitleAppearance();
  const placement = useCuePlacement();
  /* FEAT-20260924-680 — the cinematic launch: the veil over the picture and
     the picture's own fade up from black. `launch-veil.tsx` decides whether
     a start is a launch; this element only reports what it plays. */
  const launch = useLaunch(videoRef);
  return (
    <>
      {/* biome-ignore lint/a11y/useMediaCaption: FEAT-20260823-371 adds a caption track when the provider carries one; a local file or a title without them still has none, and there is nothing to invent */}
      <video
        ref={videoRef}
        className={`w-full h-full${launch.video ? ' motion-reduce-keep' : ''}`}
        /* FEAT-20260831-503 — `undefined` in Original, which is the UA's own
         `contain` and byte-for-byte what the player did before this. */
        style={{ objectFit, transform }}
        /* FEAT-20260923-647 — what the `::cue` rules in `globals.css` read. The
         cues are the browser's, not elements, so an attribute on their video
         is the only handle a stylesheet has on them. */
        data-cue-size={cues.size}
        data-cue-background={cues.background}
        /* BUG-20260924-687 — "raised" only where the engine lifts the cue
         container; elsewhere the cues' own lines carry it. */
        data-cue-position={placement.container}
        data-launch={launch.video}
        playsInline
        preload="auto"
        poster={poster}
        /**
         * BUG-20260820-238 — the frame handler alone is not enough in
         * fullscreen. `webkitEnterFullscreen` hands the video to the
         * platform's own player, where the surrounding container is not on
         * screen and a click never reaches it. Handling it here as well
         * covers that path.
         *
         * `stopPropagation` is what keeps the two from fighting: without it a
         * click on the picture would toggle here and again on the frame,
         * which is the double toggle BUG-20260820-236 existed to remove.
         */
        onClick={onClick}
        onPlay={() => {
          launch.onPlay();
          onPlay();
        }}
        onPlaying={() => {
          launch.onPlaying();
          onPlaying();
        }}
        onWaiting={onWaiting}
        onEnded={() => {
          launch.onEnded();
          onEnded();
        }}
        onPause={() => {
          launch.onPause();
          onPause();
        }}
        onLoadStart={launch.onLoadStart}
        onTimeUpdate={onTimeUpdate}
        onLoadedMetadata={onLoadedMetadata}
        onDurationChange={onDurationChange}
        onVolumeChange={onVolumeChange}
        // FEAT-20260823-365 — the element has been emptied: a source was torn
        // out rather than replaced. The transport goes back to its idle form
        // rather than keeping the last film's numbers on screen.
        onEmptied={onEmptied}
        onError={onError}
      >
        {/* FEAT-20260823-371 — one track at a time, from a blob so the
          element stays same-origin. Keyed on the URL so React replaces the
          element outright when the choice changes rather than mutating a
          `src` the browser has already parsed. */}
        {subtitleCueUrl && (
          <track
            key={subtitleCueUrl}
            ref={subtitleTrackRef}
            kind="subtitles"
            src={subtitleCueUrl}
            srcLang={
              (selectedSubtitle !== null &&
                subtitles?.[selectedSubtitle]?.language) ||
              undefined
            }
            label={
              selectedSubtitle !== null
                ? (subtitleLabels[selectedSubtitle] ?? '')
                : ''
            }
            default
          />
        )}
      </video>
      {launch.veil && (
        <LaunchVeil
          state={launch.veil}
          poster={poster}
          onEnd={launch.onVeilEnd}
        />
      )}
    </>
  );
}
