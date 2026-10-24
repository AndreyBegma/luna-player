'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { FEEDBACK_HOLD_MS, type PictureFeedback } from './picture-feedback';

interface KeyFeedback {
  feedback: PictureFeedback | null;
  /** Put `next` on the picture, and take it off `FEEDBACK_HOLD_MS` after the last one. */
  flash: (next: PictureFeedback) => void;
}

/**
 * FEAT-20260923-633 — what a key changed, said back on the picture.
 *
 * With the controls down, ↑ / ↓, M, `<` and `>` changed something the viewer
 * had no way to see. A run of presses keeps one pill up and updates it;
 * the pill fades the same way a tap run's does.
 */
export function useKeyFeedback(): KeyFeedback {
  const [feedback, setFeedback] = useState<PictureFeedback | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const flash = useCallback((next: PictureFeedback) => {
    setFeedback(next);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setFeedback(null), FEEDBACK_HOLD_MS);
  }, []);

  return { feedback, flash };
}
