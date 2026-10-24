'use client';

import { useRef } from 'react';
import { type PlayerLabels, useLabels } from '../labels';
import './player-motion.css';

/**
 * FEAT-20260919-619 — what the picture says back while a gesture is in
 * progress: the step a held arrow is on (`+30 s`), the total of a tap run
 * (`−20 s`), the rate a long-press is holding (`2×`).
 *
 * FEAT-20260923-633 — and what a key changed while the controls were down:
 * the volume (`40 %`, or muted) and the speed a `<` / `>` landed on.
 */
export type PictureFeedback =
  /** A seek in progress, on the side of the picture it moves towards. */
  | { kind: 'seek'; seconds: number }
  /** A playback rate held for as long as the finger is down, or stepped to by a key. */
  | { kind: 'rate'; rate: number }
  /** A volume a key moved to, as a fraction; `muted` wins over the level. */
  | { kind: 'volume'; level: number; muted: boolean };

/** How long a seek's label stays after the last tap or tick before it fades. */
export const FEEDBACK_HOLD_MS = 900;

interface Props {
  feedback: PictureFeedback | null;
}

/**
 * The one on-screen feedback pill. Not a toast: it is drawn by the hub at the
 * third of the picture it belongs to, it carries a number rather than a
 * sentence — so `glass`, with no text gate — and it fades with `--dur-base`
 * through the `data-visible` shell in `player-motion.css`, staying mounted so
 * the exit can be seen. The live region is the always-mounted wrapper, so a
 * screen reader hears the number change rather than an element appear.
 */
export function PictureFeedbackPill({ feedback }: Props) {
  const labels = useLabels();
  // The last thing shown, kept for the fade after `feedback` goes back to null.
  const shown = useRef<PictureFeedback | null>(null);
  if (feedback) shown.current = feedback;
  const current = shown.current;

  const side =
    current?.kind === 'seek'
      ? current.seconds < 0
        ? 'left'
        : 'right'
      : 'centre';

  return (
    <div
      aria-live="polite"
      className="pointer-events-none absolute inset-0 grid"
      data-side={side}
    >
      <div
        className={`picture-feedback glass rounded-full px-4 py-2 text-ink text-lg font-semibold tabular ${PLACEMENT[side]}`}
        data-visible={feedback !== null}
      >
        {current === null ? null : label(current, labels)}
      </div>
    </div>
  );
}

/** Where each kind sits: a seek at the third it moves towards, a rate at the top. */
const PLACEMENT = {
  left: 'self-center justify-self-start ml-[10%]',
  right: 'self-center justify-self-end mr-[10%]',
  centre: 'self-start justify-self-center mt-[8%]',
} as const;

function label(feedback: PictureFeedback, labels: PlayerLabels): string {
  switch (feedback.kind) {
    case 'seek':
      return labels.feedbackSeconds(signed(feedback.seconds));
    case 'rate':
      return labels.feedbackRate(feedback.rate);
    case 'volume':
      return feedback.muted
        ? labels.feedbackMuted
        : labels.feedbackVolume(Math.round(feedback.level * 100));
  }
}

/** `+30`, `−10`: the sign is part of the number, and it is a real minus. */
function signed(seconds: number): string {
  return seconds < 0 ? `−${Math.abs(seconds)}` : `+${seconds}`;
}
