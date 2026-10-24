'use client';

import { Maximize, Minimize, Pause, Play } from 'lucide-react';
import { memo, useRef } from 'react';
import { BarTooltip, BarVisibleContext } from './bar-tooltip';
import type { EpisodeRange } from '../logic/episode-range';
import { useLabels } from '../labels';
import { PlayheadClock } from './playhead-clock';
import type { PlayheadStore } from './playhead-store';
import './player-motion.css';
import { SeekBar } from './seek-bar';
import { SpeedButton } from './speed-button';
import { useBarClearance } from './use-bar-clearance';
import { VolumeControl } from './volume-control';

/**
 * FEAT-20260925-718 L3 — luna-watch's `control-bar.tsx`, stripped to the
 * first `<Player>` slice: play/pause, the seek bar, the clock, volume, speed
 * and fullscreen, with their markup, classes and `aria-label`s as they are
 * there. The audio, fit, quality and subtitle menus, now-playing, the
 * episode steps, the sleep timer, sound modes, learning's repeat-line,
 * play-on-TV and picture-in-picture are later slices; their props are gone,
 * not optional. Where now-playing sat, an empty `flex-1` keeps the row's
 * right-hand controls where they were.
 */
export interface ControlBarProps {
  /**
   * FEAT-20260830-489 — the player's own container, for the three menus that
   * open inside it. In element fullscreen nothing outside that container is
   * drawn, so a menu portalled to the body would be invisible exactly where a
   * remote is the only input.
   */
  portalHost: HTMLElement | null;
  /**
   * FEAT-20260914-584 (#1053) — the playhead, as a store rather than a
   * number. The scrubber and the clock subscribe to it; the two step
   * buttons read it when pressed; nothing here re-renders on a tick.
   */
  playhead: PlayheadStore;
  duration: number;
  playing: boolean;
  muted: boolean;
  volume: number;
  playbackRate: number;
  isTouchDevice: boolean;
  fullscreenActive: boolean;
  introRange: EpisodeRange | undefined;
  outroRange: EpisodeRange | undefined;
  onSeek: (time: number) => void;
  onPlayPause: () => void;
  onToggleMute: () => void;
  onVolumeChange: (volume: number) => void;
  onCycleSpeed: () => void;
  onToggleFullscreen: () => void;
  /**
   * FEAT-20260916-600 — whether the bar should be on screen right now.
   * `ControlBar` stays mounted for the whole of `mediaReady`; this is what
   * drives the entrance/exit shell (`player-motion.css`), the same boolean
   * the overlay's own opacity fade already reads.
   */
  visible: boolean;
}

/**
 * FEAT-20260828-464 — the bottom controls, out of the player.
 *
 * FEAT-20260823-364 — the fourth capsule surface, and the one where the
 * material has the most to work with: there is always a moving picture
 * behind it. It used to be a row of controls sitting directly on the frame,
 * legible only because of the black gradient painted up from the bottom edge
 * — which is the same trick the site header used before it became glass, and
 * the same reason to stop: the gradient darkens the film to protect the
 * controls, and the material does not have to.
 *
 * FEAT-20260823-365 — and none of it renders until there is something to
 * control. A scrubber that seeks nothing, a `0:00 / 0:00` read off an
 * element in `NETWORK_EMPTY`, a volume slider, a speed control and a
 * picture-in-picture button for a picture that does not exist: that whole
 * row was a claim the player could not back. The player mounts this on
 * `loadedmetadata`.
 *
 * FEAT-20260914-584 (#1053) — `memo`: every prop is either a primitive, a
 * `useCallback` from the player, one of the model's memoised objects or the
 * playhead store itself, so the bar renders when something it shows changes
 * and not when the film moves on.
 */
export const ControlBar = memo(function ControlBar({
  portalHost,
  playhead,
  duration,
  playing,
  muted,
  volume,
  playbackRate,
  isTouchDevice,
  fullscreenActive,
  introRange,
  outroRange,
  onSeek,
  onPlayPause,
  onToggleMute,
  onVolumeChange,
  onCycleSpeed,
  onToggleFullscreen,
  visible,
}: ControlBarProps) {
  const labels = useLabels();
  // BUG-20260924-687 — how much of the picture this bar covers, for "Raised".
  const rootRef = useRef<HTMLDivElement>(null);
  useBarClearance(rootRef, portalHost);
  const fullscreenLabel = fullscreenActive
    ? labels.ariaExitFullscreen
    : labels.ariaEnterFullscreen;
  return (
    <BarVisibleContext value={visible}>
      <div
        ref={rootRef}
        data-player-control
        data-visible={visible}
        // BUG-20260824-378 — `px-3` below `sm`. A 360px Android is the
        // narrowest width the row has to hold six controls at, and the
        // eight pixels this returns are the difference between fitting
        // and clipping there.
        //
        // FEAT-20260830-489 — a television crops the edges of the picture and a
        // phone puts a home indicator across the bottom of it. `env()` answers
        // the phone; `max()` keeps the inset the design asked for wherever there
        // is no crop to respect.
        //
        // BUG-20260831-502 — and all of it is a class rather than a `style`
        // prop. It used to be three inline declarations, and an inline
        // declaration beats a utility class: `paddingLeft/Right` were bare
        // `env()`, which is `0px` on every television and every phone held in
        // portrait, so `px-3 sm:px-4` never applied and the seek bar ran to the
        // edges of the capsule. `marginBottom` was killing `sm:mb-5` the same
        // way, one line above. Arbitrary values keep the `max()` *and* the
        // breakpoint, which is what the inline style could never do.
        className="control-bar-shell glass mx-3 flex flex-col gap-3 rounded-sheet py-3 sm:mx-5 mb-[max(0.75rem,env(safe-area-inset-bottom))] sm:mb-[max(1.25rem,env(safe-area-inset-bottom))] pl-[max(0.75rem,env(safe-area-inset-left))] pr-[max(0.75rem,env(safe-area-inset-right))] sm:pl-[max(1rem,env(safe-area-inset-left))] sm:pr-[max(1rem,env(safe-area-inset-right))]"
      >
        {/* Progress bar */}
        <SeekBar
          playhead={playhead}
          duration={duration}
          introRange={introRange}
          outroRange={outroRange}
          onSeek={onSeek}
        />

        {/* Mobile: time and fullscreen on the top row.
          BUG-20260924-687 — the space between shrinks, never the clock or
          the button. */}
        <div className="flex items-center justify-between sm:hidden">
          <PlayheadClock
            playhead={playhead}
            duration={duration}
            className="shrink-0 text-ink text-sm tabular"
          />
          <div className="min-w-0 flex-1" />
          <button
            type="button"
            onClick={onToggleFullscreen}
            className="shrink-0 text-ink-2 hover:text-ink rounded-lg p-2 transition-colors"
            aria-label={fullscreenLabel}
          >
            {fullscreenActive ? <Minimize size={24} /> : <Maximize size={24} />}
          </button>
        </div>

        {/* Buttons row.

          FEAT-20260824-377 — the row a phone now reaches, and the
          first breakpoint it has ever had to survive. Seven controls
          at desktop spacing overflow a 375px viewport, so the gap
          tightens and the icons drop a size below `sm` — the same
          `24 → 28` step the transport buttons in here already made. */}
        {/* BUG-20260824-378 — the gap carries the mobile fit. Six
          controls at 252px need every pixel of a 360px Android; the
          buttons keep their own `p-2`, so 2px between them still reads
          as 18px of clear space between icons. */}
        {/* BUG-20260831-502 — `[&>button]:shrink-0` is what keeps the round
          controls round. A button here is sized by its icon plus its padding
          and has no fixed box; flexbox resolves an overflow by compressing
          widths and never heights, and `rounded-full` on a box that is no
          longer square is an oval. The `flex-1` spacer is a `div` and keeps
          growing. */}
        <div className="flex items-center gap-0.5 sm:gap-4 [&>button]:shrink-0">
          <BarTooltip
            label={playing ? labels.ariaPause : labels.ariaPlay}
            portalHost={portalHost}
          >
            <button
              type="button"
              onClick={onPlayPause}
              className="bg-ink text-ground rounded-full p-3 sm:p-4 hover:bg-ink/85 transition-colors"
              aria-label={playing ? labels.ariaPause : labels.ariaPlay}
            >
              {playing ? (
                <Pause size={28} className="sm:w-8 sm:h-8" />
              ) : (
                <Play size={28} className="sm:w-8 sm:h-8" />
              )}
            </button>
          </BarTooltip>

          <PlayheadClock
            playhead={playhead}
            duration={duration}
            className="hidden sm:block shrink-0 text-ink text-lg tabular ml-2"
          />

          <div className="flex-1 min-w-0" />

          {/* BUG-20260831-502 — gated on the input device: a phone has hardware
            volume keys, and `isTouchDevice` is `navigator.maxTouchPoints > 0`
            assigned in a passive effect, so it is `false` for the first
            painted frame on every device and stays `false` on a television.
            The pair itself, and why it hides below `sm`, is
            `volume-control.tsx` (FEAT-20260919-619). */}
          {!isTouchDevice && (
            <VolumeControl
              portalHost={portalHost}
              muted={muted}
              volume={volume}
              onToggleMute={onToggleMute}
              onVolumeChange={onVolumeChange}
            />
          )}

          <SpeedButton
            rate={playbackRate}
            onCycle={onCycleSpeed}
            portalHost={portalHost}
          />

          <BarTooltip label={fullscreenLabel} portalHost={portalHost}>
            <button
              type="button"
              onClick={onToggleFullscreen}
              className="hidden sm:block text-ink-2 hover:text-ink rounded-lg p-2 transition-colors"
              aria-label={fullscreenLabel}
            >
              {fullscreenActive ? (
                <Minimize size={28} />
              ) : (
                <Maximize size={28} />
              )}
            </button>
          </BarTooltip>
        </div>
      </div>
    </BarVisibleContext>
  );
});
