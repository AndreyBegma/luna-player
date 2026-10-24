'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { HOLD_TICK_MS, holdStep, holdTarget } from '../logic/hold-seek';
import type { PictureFeedback } from './picture-feedback';
import type { PlayheadStore } from './playhead-store';

interface Options {
  playhead: PlayheadStore;
  duration: number;
  seekToTime: (time: number) => void;
  /**
   * Whether a seek on this source restarts the stream (`use-source-controller.ts`).
   * Where it does, the hold commits once on release; where it does not, every
   * tick commits and the picture follows the key.
   */
  seekRestartsStream: () => boolean;
}

interface HoldSeek {
  /** A key went down. Called for the repeats too; they are ignored. */
  begin: (direction: 1 | -1, coarse: boolean) => void;
  /** The key came up. */
  end: () => void;
  /** The step the hold is on, while it is on. */
  feedback: PictureFeedback | null;
}

interface Hold {
  direction: 1 | -1;
  coarse: boolean;
  startedAt: number;
  target: number;
  timer: ReturnType<typeof setInterval>;
}

/**
 * FEAT-20260919-619 — the hold's clock, out of the key handler.
 *
 * Driven by its own interval rather than by the keyboard's repeat rate, so a
 * remote that sends one `keydown` and one `keyup` behaves exactly like a
 * keyboard that sends thirty a second. Ended by `keyup` — which the handler
 * relays — and by the window losing focus or the page being hidden, the two
 * ways a `keyup` never arrives.
 */
export function useHoldSeek({
  playhead,
  duration,
  seekToTime,
  seekRestartsStream,
}: Options): HoldSeek {
  const hold = useRef<Hold | null>(null);
  const [feedback, setFeedback] = useState<PictureFeedback | null>(null);
  // The latest of each, so an interval armed on the first tick reads the
  // current film and the current door rather than the ones it was armed with.
  const latest = useRef({ duration, seekToTime, seekRestartsStream });
  latest.current = { duration, seekToTime, seekRestartsStream };

  const end = useCallback(() => {
    const current = hold.current;
    if (!current) return;
    clearInterval(current.timer);
    hold.current = null;
    if (latest.current.seekRestartsStream()) latest.current.seekToTime(current.target);
    setFeedback(null);
  }, []);

  const begin = useCallback<HoldSeek['begin']>(
    (direction, coarse) => {
      const current = hold.current;
      if (current && current.direction === direction) return;
      // FEAT-20260923-661 Q-03 — the other arrow carries on from where the
      // first hold got to: `end()` has only just asked for that seek, and on
      // a stream that commits on release the playhead is still where the
      // first hold began.
      const from = current?.target ?? playhead.get().time;
      end();

      const tick = () => {
        const active = hold.current;
        if (!active) return;
        const step = holdStep(Date.now() - active.startedAt, active.coarse);
        active.target = holdTarget({
          target: active.target,
          step,
          direction: active.direction,
          duration: latest.current.duration,
        });
        setFeedback({ kind: 'seek', seconds: active.direction * step });
        if (!latest.current.seekRestartsStream()) latest.current.seekToTime(active.target);
      };

      hold.current = {
        direction,
        coarse,
        startedAt: Date.now(),
        target: from,
        timer: setInterval(tick, HOLD_TICK_MS),
      };
      tick();
    },
    [end, playhead],
  );

  useEffect(() => {
    const onHidden = () => {
      if (document.visibilityState === 'hidden') end();
    };
    window.addEventListener('blur', end);
    document.addEventListener('visibilitychange', onHidden);
    return () => {
      window.removeEventListener('blur', end);
      document.removeEventListener('visibilitychange', onHidden);
      end();
    };
  }, [end]);

  return { begin, end, feedback };
}
