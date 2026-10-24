'use client';

import { type RefObject, useCallback, useEffect, useRef, useState } from 'react';
import {
  HELD_RATE,
  LONG_PRESS_MS,
  type Press,
  pressDrifted,
  pressMayHold,
} from '../logic/long-press';
import type { PictureFeedback } from './picture-feedback';

interface Options {
  videoRef: RefObject<HTMLVideoElement | null>;
  playing: boolean;
}

interface LongPress {
  onPointerDown: (e: { pointerType: string; clientX: number; clientY: number }) => void;
  onPointerMove: (e: { clientX: number; clientY: number }) => void;
  onPointerUp: () => void;
  onPointerCancel: () => void;
  /**
   * Whether the click that follows the pointer coming up belongs to a hold
   * that just ended. Asked once, by the frame's click handler, and answered
   * once: the flag clears on the asking.
   */
  consumeReleasedClick: () => boolean;
  /** `2×` while the hold is on. */
  feedback: PictureFeedback | null;
}

/**
 * FEAT-20260919-619 — the hold's timer and the rate around it.
 *
 * The rate is written to the element directly and restored from what the
 * element had, never through `use-playback-rate.ts`: a hold is not a choice
 * of speed, so it must not become the remembered one, and a viewer watching
 * at 1.25× is owed 1.25× back — not 1×.
 */
export function useLongPress({ videoRef, playing }: Options): LongPress {
  const press = useRef<Press | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rateBefore = useRef<number | null>(null);
  const released = useRef(false);
  const [held, setHeld] = useState(false);

  const cancel = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    press.current = null;
  }, []);

  const release = useCallback(() => {
    cancel();
    if (rateBefore.current === null) return;
    const v = videoRef.current;
    if (v) v.playbackRate = rateBefore.current;
    rateBefore.current = null;
    released.current = true;
    setHeld(false);
  }, [cancel, videoRef]);

  // A player that goes while a finger is down must put the rate back too.
  useEffect(() => release, [release]);

  const onPointerDown = useCallback<LongPress['onPointerDown']>(
    (e) => {
      // FEAT-20260923-661 Q-04 — before the gate: a hold whose release made
      // no click (a cancel, a finger dragged off) left this up, and the next
      // tap on a paused picture was swallowed as that click.
      released.current = false;
      if (!pressMayHold({ pointerType: e.pointerType, playing })) return;
      cancel();
      press.current = { x: e.clientX, y: e.clientY };
      timer.current = setTimeout(() => {
        const v = videoRef.current;
        if (!v || press.current === null) return;
        // FEAT-20260923-661 Q-02 — a second finger during a hold re-arms
        // this; the rate before is the one the first hold saved, never 2×.
        rateBefore.current ??= v.playbackRate;
        v.playbackRate = HELD_RATE;
        setHeld(true);
      }, LONG_PRESS_MS);
    },
    [cancel, playing, videoRef],
  );

  const onPointerMove = useCallback<LongPress['onPointerMove']>(
    (e) => {
      if (!press.current) return;
      if (pressDrifted(press.current, { x: e.clientX, y: e.clientY })) release();
    },
    [release],
  );

  const consumeReleasedClick = useCallback(() => {
    const was = released.current;
    released.current = false;
    return was;
  }, []);

  return {
    onPointerDown,
    onPointerMove,
    onPointerUp: release,
    onPointerCancel: release,
    consumeReleasedClick,
    feedback: held ? { kind: 'rate', rate: HELD_RATE } : null,
  };
}
