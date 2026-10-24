import { useCallback, useState } from 'react';

/**
 * FEAT-20260924-679 — the time under a mouse resting on the seek bar.
 *
 * Mouse only. A finger or a pen has no hover: it touches and drags, and the
 * drag already draws its own time. A television has no pointer at all. So this
 * never runs where frame rate matters most.
 *
 * `timeAt` is the bar's own mapping from a client x to seconds; `null` (no
 * duration yet, a track with no width) clears the bubble rather than
 * guessing.
 */
export function useHoverTime(timeAt: (clientX: number) => number | null) {
  const [hoverTime, setHoverTime] = useState<number | null>(null);

  const onHoverMove = useCallback(
    (e: React.PointerEvent<HTMLElement>) => {
      if (e.pointerType !== 'mouse') return;
      setHoverTime(timeAt(e.clientX));
    },
    [timeAt],
  );

  const onHoverLeave = useCallback(() => setHoverTime(null), []);

  return { hoverTime, onHoverMove, onHoverLeave };
}
