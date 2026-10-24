'use client';

import { type RefObject, useEffect } from 'react';

/** Read by `player-cues.css` and `learning-cue-layer.tsx`. */
const BAR_CLEARANCE_VAR = '--player-bar-clearance';

/** Clear space between a raised cue and the top of the bar. */
const GAP_PX = 8;

/**
 * How far above the bottom of the picture a raised cue has to end: the bar's
 * top edge, counted up from the bottom of the box it is laid out in, plus the
 * gap. `offsetTop` is layout, not paint, so the bar's own slide in and out
 * does not move it — "Raised" stays where it is while the bar fades, which is
 * what FEAT-20260923-647 decided.
 */
export function barClearance(boxHeight: number, barTop: number): number {
  return Math.max(0, Math.round(boxHeight - barTop + GAP_PX));
}

/**
 * BUG-20260924-687 — the control bar's height, measured, where the subtitles
 * can read it.
 *
 * A raise counted in cue lines grows with the picture while the bar does not,
 * so it cleared the bar on a large screen and sat under it on a phone. This
 * writes the real figure on the player's container as a custom property,
 * which the native cues (through their container) and the learning layer both
 * inherit. The box is the bar's offset parent — the overlay, which fills the
 * frame the picture fills — and both are observed, because a rotation changes
 * the box and a wrapped row changes the bar.
 */
export function useBarClearance(
  barRef: RefObject<HTMLElement | null>,
  host: HTMLElement | null,
): void {
  useEffect(() => {
    const bar = barRef.current;
    const box = bar?.offsetParent;
    if (!bar || !(box instanceof HTMLElement) || !host) return;
    if (typeof ResizeObserver === 'undefined') return;
    const measure = () =>
      host.style.setProperty(
        BAR_CLEARANCE_VAR,
        `${barClearance(box.clientHeight, bar.offsetTop)}px`,
      );
    const observer = new ResizeObserver(measure);
    observer.observe(bar);
    observer.observe(box);
    measure();
    return () => {
      observer.disconnect();
      host.style.removeProperty(BAR_CLEARANCE_VAR);
    };
  }, [barRef, host]);
}
