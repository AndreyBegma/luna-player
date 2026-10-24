'use client';

import type { PointerEvent as ReactPointerEvent, RefObject } from 'react';
import { useCallback, useRef } from 'react';
import type { PictureFeedback } from './picture-feedback';
import type { PlayheadStore } from './playhead-store';
import { useFrameTap } from './use-frame-tap';
import { useLongPress } from './use-long-press';

interface Options {
  videoRef: RefObject<HTMLVideoElement | null>;
  showControls: boolean;
  playing: boolean;
  playhead: PlayheadStore;
  showAndScheduleHide: () => void;
  hideControls: () => void;
  seekToTime: (time: number) => void;
}

interface FrameGestures {
  /** A tap, given where it landed and the frame it landed in. */
  onTap: (clientX: number, rect: DOMRect) => void;
  onPointerDown: (e: ReactPointerEvent<HTMLElement>) => void;
  onPointerMove: (e: ReactPointerEvent<HTMLElement>) => void;
  onPointerUp: () => void;
  onPointerCancel: () => void;
  /** Whichever gesture has something to say right now; a hold outranks a run. */
  feedback: PictureFeedback | null;
}

/** A press that starts on a control is that control's, never the frame's. */
const CONTROL = 'button, input, select, [data-player-control]';

/**
 * FEAT-20260919-619 — everything a finger does on the picture, as one
 * handler bag for the hub: the tap model (`use-frame-tap.ts`) and the
 * long-press (`use-long-press.ts`), and the one rule that joins them — the
 * release of a hold is not a tap. Both hooks keep their own timers; this
 * only knows that they share a finger.
 */
export function useFrameGestures({
  videoRef,
  showControls,
  playing,
  playhead,
  showAndScheduleHide,
  hideControls,
  seekToTime,
}: Options): FrameGestures {
  const tap = useFrameTap({
    playhead,
    showAndScheduleHide,
    hideControls,
    seekToTime,
  });
  const hold = useLongPress({ videoRef, playing });
  const { consumeReleasedClick, onPointerDown: beginHold } = hold;
  /**
   * Whether the controls were up when the finger landed. `pointerdown` is the
   * first event of a touch, before the frame's `touchstart` brings the
   * controls up; the click that ends the tap arrives after React has already
   * committed that, so the tap is judged on this rather than on the state it
   * sees.
   */
  const visibleAtPress = useRef<boolean | null>(null);

  const onTap = useCallback<FrameGestures['onTap']>(
    (clientX, rect) => {
      const wasVisible = visibleAtPress.current ?? showControls;
      visibleAtPress.current = null;
      if (consumeReleasedClick()) return;
      tap.onTap(clientX, rect, wasVisible);
    },
    [consumeReleasedClick, tap.onTap, showControls],
  );

  const onPointerDown = useCallback<FrameGestures['onPointerDown']>(
    (e) => {
      visibleAtPress.current = showControls;
      if ((e.target as HTMLElement | null)?.closest(CONTROL)) return;
      beginHold(e);
    },
    [beginHold, showControls],
  );

  return {
    onTap,
    onPointerDown,
    onPointerMove: hold.onPointerMove,
    onPointerUp: hold.onPointerUp,
    onPointerCancel: hold.onPointerCancel,
    feedback: hold.feedback ?? tap.feedback,
  };
}
