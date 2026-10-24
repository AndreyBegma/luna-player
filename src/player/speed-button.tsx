'use client';

import { Badge } from '@andrewbehma/glass-ui/badge';
import { Gauge } from 'lucide-react';
import { BarTooltip } from './bar-tooltip';
import { useLabels } from '../labels';

interface Props {
  rate: number;
  onCycle: () => void;
  portalHost: HTMLElement | null;
}

/**
 * FEAT-20260924-679 — playback speed, as an icon among icons.
 *
 * It was the text "1×" in `text-sm`, dimmer and smaller than every control
 * around it, and it read as a label rather than something to press. Now it is
 * a `Gauge` at its neighbours' size and colour. The rate is only shown when it
 * is not the ordinary one, as a badge on the icon's corner: at 1× there is
 * nothing to say.
 *
 * FEAT-20260824-377 — still `hidden sm:block`. It is the control the phone row
 * gave up so the rest would fit.
 */
export function SpeedButton({ rate, onCycle, portalHost }: Props) {
  const labels = useLabels();
  const label = labels.ariaPlaybackSpeed(rate);
  return (
    <BarTooltip label={label} portalHost={portalHost}>
      <button
        type="button"
        onClick={onCycle}
        aria-label={label}
        className="relative hidden sm:block text-ink-2 hover:text-ink rounded-lg p-2 transition-colors"
      >
        <Gauge className="size-6 sm:size-7" />
        {rate !== 1 && (
          <Badge
            tone="ink"
            label={`${rate}×`}
            aria-hidden="true"
            className="pointer-events-none absolute -top-0.5 -right-1.5"
          />
        )}
      </button>
    </BarTooltip>
  );
}
