'use client';

import { Pause, Play } from 'lucide-react';
import './player-motion.css';

interface Props {
  icon: 'play' | 'pause' | null;
  onDone: () => void;
}

/**
 * FEAT-20260916-600 — the one-shot centre confirmation. Renders nothing once
 * `icon` is `null`; `use-play-pause-confirm.ts` owns when that is. The glyph
 * itself never receives pointer events — it sits over the picture and the
 * touch centre transport, and must never intercept a tap meant for either.
 */
export function PlayPauseConfirm({ icon, onDone }: Props) {
  if (icon === null) return null;
  const Icon = icon === 'play' ? Play : Pause;

  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
      <div
        className="play-pause-confirm glass-clear rounded-full p-6"
        onAnimationEnd={onDone}
      >
        <Icon size={48} className="text-ink" fill="currentColor" />
      </div>
    </div>
  );
}
