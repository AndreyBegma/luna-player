'use client';

import type { CentreTransport as CentreTransportMode } from '../logic/centre-transport-visibility';
import { CentreTransport } from './centre-transport';
import { ControlBar, type ControlBarProps } from './control-bar';
import { type PictureFeedback, PictureFeedbackPill } from './picture-feedback';
import { PlayPauseConfirm } from './play-pause-confirm';
import { PlaybackErrorNotice } from './playback-error-notice';

interface Props {
  playbackFailed: boolean;
  retryPlayback: () => void;
  isBuffering: boolean;
  playing: boolean;
  showControls: boolean;
  mediaReady: boolean;
  /** `centreTransport()`'s answer, from the player. */
  centreMode: CentreTransportMode;
  /** The idle disc's accessible name. */
  title: string;
  bar: Omit<ControlBarProps, 'visible'>;
  onPlay: () => void;
  onSeekBy: (seconds: number) => void;
  confirmToken: number;
  confirmIcon: 'play' | 'pause' | null;
  onConfirmDone: () => void;
  feedback: PictureFeedback | null;
}

/**
 * FEAT-20260925-718 L3 — everything the first `<Player>` draws inside the
 * frame besides the `<video>`, composed the way luna-watch's
 * `player-overlay.tsx` composes it, with markup and classes as they are
 * there.
 *
 * What that file also drew is a later slice or Luna's own and is not here:
 * the learning layer, the pause strip, the end screen and the cast overlay
 * (`../luna/**`), the resume banner, the skip buttons, the badges, the key
 * sheet, the sleep scrim and the key-debug readout. Without them
 * `player-screen.ts`'s arbitration is one rule: an error owns the frame,
 * and otherwise the controls do.
 */
export function PlayerLayers({
  playbackFailed,
  retryPlayback,
  isBuffering,
  playing,
  showControls,
  mediaReady,
  centreMode,
  title,
  bar,
  onPlay,
  onSeekBy,
  confirmToken,
  confirmIcon,
  onConfirmDone,
  feedback,
}: Props) {
  const overlayBusy = playbackFailed;
  return (
    <>
      {/* BUG-20260820-213 — hls.js gave up; the frozen frame gets an
          explanation and a retry instead of nothing at all. */}
      {playbackFailed && <PlaybackErrorNotice onRetry={retryPlayback} />}

      {/* Buffering spinner — always visible during stalls, independent of controls visibility */}
      {isBuffering && playing && !playbackFailed && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-raised">
          <div className="w-14 h-14 rounded-full border-4 border-white/20 border-t-ink animate-spin" />
        </div>
      )}

      {/* FEAT-20260919-619 — the picture dims under the controls, and the
          glass lifts off the dim: one token over the whole frame, opacity
          only, one composited layer, fading with the controls. Not on the
          idle player, and not while an error owns the frame. */}
      <div
        aria-hidden="true"
        className={`absolute inset-0 pointer-events-none bg-ground/30 transition-opacity motion-safe:duration-(--dur-base) ${
          showControls && mediaReady && !overlayBusy
            ? 'opacity-100'
            : 'opacity-0'
        }`}
      />

      {/* Controls overlay.
          FEAT-20260823-365 — the gradient goes with the controls it protects.
          It is painted up from the bottom edge to keep a transport legible;
          with no transport there it is darkening the poster frame for
          nobody. */}
      <div
        className={`absolute inset-0 flex flex-col justify-end transition-opacity duration-300 ${mediaReady ? 'bg-linear-to-t from-black/55 via-transparent to-transparent' : ''} ${showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
      >
        {/* Bottom controls — none of it until there is something to
            control; it returns in full on `loadedmetadata`. */}
        {mediaReady && <ControlBar {...bar} visible={showControls} />}
      </div>

      {/* Centre transport — the idle player's whole interface before there
          is media; on a touch device with room, play/pause with ±10 s
          beside it while the controls are up (FEAT-20260914-579). */}
      {!overlayBusy && (
        <CentreTransport
          mode={centreMode}
          mediaReady={mediaReady}
          playing={playing}
          title={title}
          onPlay={onPlay}
          onSeekBy={onSeekBy}
        />
      )}

      {!overlayBusy && (
        <PlayPauseConfirm
          key={confirmToken}
          icon={confirmIcon}
          onDone={onConfirmDone}
        />
      )}

      {/* FEAT-20260919-619 — the picture's answer to a gesture in progress:
          a held arrow's step, a tap run's total, a long-press's 2×. */}
      <PictureFeedbackPill feedback={feedback} />
    </>
  );
}
