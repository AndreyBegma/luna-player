'use client';

import { Pause, Play, RotateCcw, RotateCw } from 'lucide-react';
import type { CentreTransport as CentreTransportMode } from '../logic/centre-transport-visibility';
import { useLabels } from '../labels';

interface Props {
  mode: CentreTransportMode;
  /** Whether there is media yet; the idle disc hides below `sm` once there is. */
  mediaReady: boolean;
  playing: boolean;
  title: string;
  onPlay: () => void;
  /** ±10 s, the same step the bar, the keys and the double-tap use. */
  onSeekBy: (seconds: number) => void;
}

/**
 * The centre of the picture.
 *
 * FEAT-20260828-464 / FEAT-20260823-365 — the idle disc: while nothing is
 * attached this is the only control on screen, the whole of the idle
 * player's interface. `glass-clear` (FEAT-20260919-618) because these are
 * icon-only chrome directly over the picture, the rung the material cut for
 * exactly this control; no local focus ring because `globals.css` owns it.
 *
 * FEAT-20260824-377 — on a phone the disc goes away the moment there is a
 * transport to replace it (`hidden sm:flex`): a 210 px player has no room
 * for both.
 *
 * FEAT-20260914-579 — on a touch device with room — and, since
 * FEAT-20260919-619, on any device without a fine pointer, which is every
 * television — the disc gains a
 * smaller seek disc on each side while the controls are up: the
 * ten-second step every touch player puts under the thumb, beside the one
 * control a finger reaches for most. The cluster follows the controls, so a
 * playing film with the controls hidden stays a clean picture. The frame's
 * own tap handler ignores clicks on buttons, so a disc never doubles as a
 * frame tap.
 */
export function CentreTransport({ mode, mediaReady, playing, title, onPlay, onSeekBy }: Props) {
  const labels = useLabels();
  if (mode === 'none') return null;

  if (mode === 'idle') {
    if (playing) return null;
    return (
      <div
        className={`absolute inset-0 items-center justify-center pointer-events-none ${mediaReady ? 'hidden sm:flex' : 'flex'}`}
      >
        <button type="button" onClick={onPlay} aria-label={title} className={disc('p-6')}>
          <Play size={56} className="ml-2 text-ink" fill="currentColor" />
        </button>
      </div>
    );
  }

  return (
    <div
      /* FEAT-20260919-619 — a remote's Up from the bar lands on the play disc
         and Left/Right walk the three (`transport-focus.ts`); the frame's tap
         model never counts a press on one of them as a tap on the picture. */
      data-centre-transport
      data-player-control
      className="absolute inset-0 flex items-center justify-center gap-6 sm:gap-10 pointer-events-none"
    >
      <button type="button" onClick={() => onSeekBy(-10)} aria-label={labels.ariaBack10} className={disc('p-4')}>
        <SeekGlyph icon={RotateCcw} />
      </button>
      <button
        type="button"
        data-centre-transport-primary
        onClick={onPlay}
        aria-label={playing ? labels.ariaPause : labels.ariaPlay}
        className={disc('p-6')}
      >
        {playing ? (
          <Pause size={56} className="text-ink" fill="currentColor" />
        ) : (
          <Play size={56} className="ml-2 text-ink" fill="currentColor" />
        )}
      </button>
      <button type="button" onClick={() => onSeekBy(10)} aria-label={labels.ariaForward10} className={disc('p-4')}>
        <SeekGlyph icon={RotateCw} />
      </button>
    </div>
  );
}

function disc(pad: string): string {
  return `glass-clear lit pointer-events-auto cursor-pointer rounded-full ${pad} transition-transform duration-(--dur-fast) hover:scale-105 active:scale-95`;
}

/** The circular arrow with the step written inside it, the way every touch player draws it. */
function SeekGlyph({ icon: Icon }: { icon: typeof RotateCcw }) {
  return (
    <span className="relative flex items-center justify-center text-ink">
      <Icon size={32} strokeWidth={1.75} aria-hidden="true" />
      <span className="absolute text-[10px] font-bold leading-none" aria-hidden="true">
        10
      </span>
    </span>
  );
}
