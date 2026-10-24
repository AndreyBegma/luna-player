'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  DOUBLE_TAP_MS,
  type PendingTap,
  resolveFrameTap,
  TAP_RUN_MS,
  tapThird,
} from '../logic/frame-tap';
import { FEEDBACK_HOLD_MS, type PictureFeedback } from './picture-feedback';
import type { PlayheadStore } from './playhead-store';

interface Options {
  /** The playhead in the film's clock, read at the moment a tap seeks. */
  playhead: PlayheadStore;
  showAndScheduleHide: () => void;
  hideControls: () => void;
  seekToTime: (time: number) => void;
}

interface FrameTap {
  /**
   * `controlsVisible` is the state before the touch that became this tap:
   * the frame's `touchstart` already brought the controls up by the time the
   * click arrives, and a tap judged on that would always find them visible.
   */
  onTap: (clientX: number, rect: DOMRect, controlsVisible: boolean) => void;
  /** The run's counter while it is on the picture. */
  feedback: PictureFeedback | null;
}

/**
 * FEAT-20260914-584 — the touch tap model's timers, out of the player.
 *
 * The decision is `resolveFrameTap` in `frame-tap.ts`; this holds the
 * pending outer-third tap and the 250 ms it waits to learn whether it was
 * the first of two, the half-second a run stays open for its next tap, the
 * counter's fade, and clears all three with the player.
 *
 * FEAT-20260919-619 — a single tap shows or hides; a run of taps seeks and
 * counts. Nothing here can play or pause.
 */
export function useFrameTap({
  playhead,
  showAndScheduleHide,
  hideControls,
  seekToTime,
}: Options): FrameTap {
  const tapRef = useRef<PendingTap | null>(null);
  /**
   * FEAT-20260923-661 Q-01 — where the run started. Each tap seeks to this
   * plus the run's total rather than re-reading the playhead: the store is
   * written on `timeupdate`, which on the HLS path arrives only once a seek
   * has landed, so a quick third tap read the position the second one left
   * and the film moved less than the counter said. `use-hold-seek.ts` keeps
   * its own target for the same reason.
   */
  const runFrom = useRef(0);
  const tapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const feedbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [feedback, setFeedback] = useState<PictureFeedback | null>(null);

  useEffect(
    () => () => {
      if (tapTimer.current) clearTimeout(tapTimer.current);
      if (feedbackTimer.current) clearTimeout(feedbackTimer.current);
    },
    [],
  );

  const onTap = useCallback<FrameTap['onTap']>(
    (clientX, rect, controlsVisible) => {
      const action = resolveFrameTap({
        controlsVisible,
        third: tapThird(clientX, rect),
        previous: tapRef.current,
        now: Date.now(),
      });
      if (tapTimer.current) clearTimeout(tapTimer.current);

      switch (action.kind) {
        case 'reveal':
          showAndScheduleHide();
          tapRef.current = action.pending;
          tapTimer.current = setTimeout(() => {
            tapRef.current = null;
          }, DOUBLE_TAP_MS);
          return;
        case 'hide':
          tapRef.current = null;
          hideControls();
          return;
        case 'defer':
          showAndScheduleHide();
          tapRef.current = action.pending;
          tapTimer.current = setTimeout(() => {
            tapRef.current = null;
            hideControls();
          }, DOUBLE_TAP_MS);
          return;
        case 'seek': {
          showAndScheduleHide();
          tapRef.current = action.pending;
          tapTimer.current = setTimeout(() => {
            tapRef.current = null;
          }, TAP_RUN_MS);
          if (action.pending.seeks === 1) runFrom.current = playhead.get().time;
          const seconds = action.by < 0 ? -action.total : action.total;
          seekToTime(runFrom.current + seconds);
          setFeedback({ kind: 'seek', seconds });
          if (feedbackTimer.current) clearTimeout(feedbackTimer.current);
          feedbackTimer.current = setTimeout(
            () => setFeedback(null),
            FEEDBACK_HOLD_MS,
          );
          return;
        }
      }
    },
    [showAndScheduleHide, hideControls, seekToTime, playhead],
  );

  return { onTap, feedback };
}
