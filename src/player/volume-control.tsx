'use client';

import { Slider } from '@andrewbehma/glass-ui/slider';
import { Volume2, VolumeX } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { BarTooltip } from './bar-tooltip';
import { useLabels } from '../labels';
import { wheelVolume } from '../logic/volume-wheel';

interface Props {
  /** FEAT-20260924-679 — for the mute button's tooltip; see `BarTooltip`. */
  portalHost: HTMLElement | null;
  muted: boolean;
  volume: number;
  onToggleMute: () => void;
  onVolumeChange: (volume: number) => void;
}

/**
 * FEAT-20260919-619 — the mute button and the slider, out of the bar as one
 * group, because the group is what the wheel acts on.
 *
 * BUG-20260831-502 — `hidden sm:block` as well as the bar's touch gate: below
 * `sm` this pair is 44px of button and 112px of slider added to a row that
 * measured 424px against a bar of 334px at 360px wide, which was the
 * precondition for both the clipping BUG-20260824-378 reported and the ovals
 * 502 did. A phone has hardware volume keys.
 *
 * FEAT-20260830-489 — the slider is the primitive rather than a raw `range`
 * with `accent-white`: `glass-ui/slider` is styled in tokens.
 *
 * The wheel listener is attached by hand and non-passive: React registers
 * `onWheel` passively, and a passive listener cannot keep the page from
 * scrolling under a viewer who is turning the volume.
 */
export function VolumeControl({
  portalHost,
  muted,
  volume,
  onToggleMute,
  onVolumeChange,
}: Props) {
  const labels = useLabels();
  const muteLabel = muted || volume === 0 ? labels.ariaUnmute : labels.ariaMute;
  const groupRef = useRef<HTMLDivElement>(null);
  const latest = useRef({ muted, volume, onVolumeChange });
  latest.current = { muted, volume, onVolumeChange };

  useEffect(() => {
    const node = groupRef.current;
    if (!node) return;
    const onWheel = (e: WheelEvent) => {
      // FEAT-20260923-661 (Q-02) — a sideways swipe is the page's: taken as a
      // "change" to the level it already had, it unmuted, and while muted it
      // left the film at zero and the device remembering nothing.
      if (e.deltaY === 0) return;
      e.preventDefault();
      const { muted, volume, onVolumeChange } = latest.current;
      onVolumeChange(wheelVolume(muted ? 0 : volume, e.deltaY));
    };
    node.addEventListener('wheel', onWheel, { passive: false });
    return () => node.removeEventListener('wheel', onWheel);
  }, []);

  return (
    <div ref={groupRef} className="hidden sm:flex items-center gap-4">
      <BarTooltip label={muteLabel} portalHost={portalHost}>
        <button
          type="button"
          onClick={onToggleMute}
          aria-label={muteLabel}
          className="shrink-0 text-ink-2 hover:text-ink rounded-lg p-2 transition-colors"
        >
          {muted || volume === 0 ? <VolumeX size={28} /> : <Volume2 size={28} />}
        </button>
      </BarTooltip>

      <Slider
        min={0}
        max={1}
        step={0.05}
        value={muted ? 0 : volume}
        aria-label={labels.ariaVolume}
        onChange={(e) => onVolumeChange(Number(e.target.value))}
        className="w-28 shrink-0"
      />
    </div>
  );
}
