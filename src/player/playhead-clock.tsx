'use client';

import { useClockMode } from '../logic/clock-mode';
import { formatRemaining, formatTime } from '../logic/format-time';
import { useLabels } from '../labels';
import { type PlayheadStore, usePlayhead } from './playhead-store';

interface Props {
  playhead: PlayheadStore;
  duration: number;
  className: string;
}

const wholeSeconds = (snapshot: { time: number }): number =>
  Math.floor(snapshot.time);

/**
 * FEAT-20260914-584 (#1053) — the transport's `elapsed / total`.
 *
 * Its own component so that it is the subscriber: the bar around it is
 * `memo`'d and never hears about the playhead. Subscribed through whole
 * seconds, because that is the resolution the text has — the element ticks
 * four times a second and three of those ticks would render the same string.
 *
 * FEAT-20260919-619 — a click or a tap on it flips the first number to the
 * time remaining (`−1:39:58`), and the device remembers. A button, so a
 * remote and a screen reader reach it; the `<time>` inside is what the two
 * clocks have always been.
 */
export function PlayheadClock({ playhead, duration, className }: Props) {
  const labels = useLabels();
  const elapsed = usePlayhead(playhead, wholeSeconds);
  const [mode, flip] = useClockMode();
  const first = mode === 'remaining' ? formatRemaining(elapsed, duration) : formatTime(elapsed);
  return (
    <button
      type="button"
      onClick={flip}
      aria-label={mode === 'remaining' ? labels.ariaClockElapsed : labels.ariaClockRemaining}
      className={`${className} rounded-control cursor-pointer`}
    >
      <time>
        {first} / {formatTime(duration)}
      </time>
    </button>
  );
}
