'use client';

import { useCallback, useRef, useState } from 'react';
import type { EpisodeRange } from '../logic/episode-range';
import { formatTime } from '../logic/format-time';
import { useLabels } from '../labels';
import {
  type PlayheadSnapshot,
  type PlayheadStore,
  usePlayhead,
} from './playhead-store';
import {
  type ArrowHold,
  arrowSeek,
  bubbleLeft,
  thumbLeft,
} from '../logic/seek-geometry';
import { useHoverTime } from './use-hover-time';

interface Props {
  /** FEAT-20260914-584 (#1053) — the position and the buffered percent, subscribed to here. */
  playhead: PlayheadStore;
  duration: number;
  introRange: EpisodeRange | undefined;
  outroRange: EpisodeRange | undefined;
  onSeek: (time: number) => void;
}

const selectBuffered = (snapshot: PlayheadSnapshot): number =>
  snapshot.buffered;

/**
 * FEAT-20260828-464 — the progress bar, out of the player.
 *
 * FEAT-20260830-489 — and made into a control. It was a `div` with an
 * `onClick`, which meant three things a scrubber has to do it could not do at
 * all: it was not reachable by Tab, it announced nothing to a screen reader,
 * and it could not be dragged — a click jumped the film to wherever the pointer
 * happened to land, with no way to look before committing. On a television it
 * was worse than that: the only input is a remote, and there was no way to
 * reach the bar at all.
 *
 * It is now `role="slider"` with the three ARIA values a slider owes, it takes
 * focus, and the arrows move it — which is why `arrowOwnerHasFocus()` in
 * `player-keys.ts` lists `[role="slider"]`: while the bar has focus the arrows
 * are its own, and the player's ±10s handler must stand down or a single press
 * would seek twice.
 *
 * Dragging is Pointer Events rather than mouse and touch pairs: one set of
 * handlers for a finger, a pen and a mouse, and `setPointerCapture` means a
 * drag that wanders off the bar — or off the window — still ends up here
 * instead of being lost.
 */
export function SeekBar({
  playhead,
  duration,
  introRange,
  outroRange,
  onSeek,
}: Props) {
  const labels = useLabels();
  const trackRef = useRef<HTMLDivElement>(null);
  // The one component that draws every tick: the thumb has to move.
  const currentTime = usePlayhead(playhead);
  const buffered = usePlayhead(playhead, selectBuffered);

  /**
   * Where the pointer is, while it is down.
   *
   * While a drag is running this is what the bar draws, not `currentTime`.
   * Without it the thumb is dragged back under the finger three times a second
   * by the element's own `timeupdate` — the same fight `remote-panel.tsx`
   * settles with its `dragging` ref, for the same reason.
   */
  const [dragTime, setDragTime] = useState<number | null>(null);
  /** FEAT-20260923-661 Q-01 — the arrows' hold and their own target; see `arrowSeek`. */
  const arrowHold = useRef<ArrowHold | null>(null);

  const shown = dragTime ?? currentTime;
  const progress = duration ? Math.min(100, (shown / duration) * 100) : 0;

  /** Where along the film a client x lands, in seconds. */
  const timeAt = useCallback(
    (clientX: number): number | null => {
      const track = trackRef.current;
      if (!track || !duration) return null;
      const rect = track.getBoundingClientRect();
      if (rect.width === 0) return null;
      const ratio = (clientX - rect.left) / rect.width;
      return Math.max(0, Math.min(1, ratio)) * duration;
    },
    [duration],
  );
  const { hoverTime, onHoverMove, onHoverLeave } = useHoverTime(timeAt);

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!duration) return;
    // A secondary button is a context menu, not a seek.
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    e.preventDefault();
    e.currentTarget.focus();
    e.currentTarget.setPointerCapture(e.pointerId);
    const at = timeAt(e.clientX);
    if (at !== null) setDragTime(at);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (dragTime === null) {
      onHoverMove(e);
      return;
    }
    const at = timeAt(e.clientX);
    if (at !== null) setDragTime(at);
  };

  const endDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    if (dragTime === null) return;
    const at = timeAt(e.clientX) ?? dragTime;
    setDragTime(null);
    if (e.currentTarget.hasPointerCapture(e.pointerId))
      e.currentTarget.releasePointerCapture(e.pointerId);
    onSeek(at);
  };

  // Not `stopPropagation` anywhere below: the player's window handler stands
  // down on its own because this element answers `[role="slider"]`, and
  // stopping the event here would also rob the auto-hide timer of its reason
  // to restart.
  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (!duration) return;
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      e.preventDefault();
      const next = arrowSeek(arrowHold.current, {
        now: e.timeStamp,
        repeat: e.repeat,
        direction: e.key === 'ArrowRight' ? 1 : -1,
        coarse: e.shiftKey,
        playhead: playhead.get().time,
        duration,
      });
      arrowHold.current = next.hold;
      if (next.seekTo !== null) onSeek(next.seekTo);
      return;
    }
    if (e.key !== 'Home' && e.key !== 'End') return;
    e.preventDefault();
    arrowHold.current = null;
    onSeek(e.key === 'Home' ? 0 : duration);
  };

  const dragging = dragTime !== null;
  // FEAT-20260924-679 — the drag's time wins over the hover's: while a button
  // is down the pointer is dragging, and the two would name the same place.
  const bubbleTime = dragTime ?? hoverTime;

  return (
    <div className="group relative -my-3 py-3">
      {/* The time under the thumb while a pointer drags it, and under the
          mouse while it rests on the bar (FEAT-20260924-679). Absent otherwise:
          a tooltip pinned to a bar nobody is touching is furniture. */}
      {bubbleTime !== null && duration > 0 && (
        <div
          className="glass-clear pointer-events-none absolute bottom-full mb-2 -translate-x-1/2 rounded-control px-2 py-1 text-xs text-ink tabular"
          style={{ left: bubbleLeft((bubbleTime / duration) * 100) }}
        >
          {formatTime(bubbleTime)}
        </div>
      )}

      <div
        ref={trackRef}
        role="slider"
        tabIndex={0}
        aria-label={labels.ariaSeek}
        aria-valuemin={0}
        aria-valuemax={Math.floor(duration) || 0}
        aria-valuenow={Math.floor(shown)}
        aria-valuetext={labels.seekPosition(formatTime(shown), formatTime(duration))}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onPointerLeave={onHoverLeave}
        onKeyDown={onKeyDown}
        // `touch-none` stops the browser claiming a horizontal drag for a
        // scroll before `pointermove` ever reaches this handler.
        className="relative h-2 cursor-pointer touch-none rounded-full bg-line-strong transition-transform duration-(--dur-fast) group-hover:scale-y-150"
        style={{ transform: dragging ? 'scaleY(1.5)' : undefined }}
      >
        {/* Intro zone marker */}
        {introRange && duration > 0 && (
          <div
            className="pointer-events-none absolute inset-y-0 rounded-full bg-warn/50"
            style={{
              left: `${(introRange.start / duration) * 100}%`,
              width: `${((introRange.stop - introRange.start) / duration) * 100}%`,
            }}
          />
        )}
        {/* Outro zone marker */}
        {outroRange && duration > 0 && (
          <div
            className="pointer-events-none absolute inset-y-0 rounded-full bg-warn/50"
            style={{
              left: `${(outroRange.start / duration) * 100}%`,
              width: `${((outroRange.stop - outroRange.start) / duration) * 100}%`,
            }}
          />
        )}
        {/* FEAT-20260924-679 — three layers, three steps of one ink: the
            rest at `line-strong`, buffered at `ink-3`, played at `ink`. They
            used to be white at 30 % with white at 40 % stacked on it, two
            greys nobody could tell apart. The ends are the glass-ui slider's
            own track and fill. */}
        <div
          className="pointer-events-none absolute inset-y-0 left-0 rounded-full bg-ink-3"
          style={{ width: `${buffered}%` }}
        />
        <div
          className="pointer-events-none absolute inset-y-0 left-0 rounded-full bg-ink"
          style={{ width: `${progress}%` }}
        />
      </div>
      {/* The thumb. Hidden until the bar is hovered, focused or dragged on a
          pointer device — and always visible where there is no pointer to
          hover with, which is the television this feature is for.

          BUG-20260831-502 — `thumbLeft` rather than `calc(P% - 0.5rem)`: the
          old offset put half the thumb outside the track at 0% and at 100%,
          which is 8px into a control bar that only has 12px of horizontal
          padding to give. See `seek-geometry.ts`.

          FEAT-20260924-679 — beside the track rather than inside it. The track
          scales to 1.5× on hover, and a child of it was stretched with it into
          an oval. The wrapper is the track's width and its vertical centre is
          the track's, so the geometry is unchanged. The rim is the glass-ui
          slider's (`slider.css`): it keeps a white thumb legible at the end of
          a white fill. */}
      <div
        className={`pointer-events-none absolute top-1/2 size-4 -translate-y-1/2 rounded-full bg-ink shadow-[0_0_0_1px_var(--color-line),0_2px_8px_var(--glass-shadow)] transition-opacity duration-(--dur-fast) group-hover:opacity-100 group-focus-within:opacity-100 [@media(hover:none)]:opacity-100 ${
          dragging ? 'opacity-100' : 'opacity-0'
        }`}
        style={{ left: thumbLeft(progress) }}
      />
    </div>
  );
}
