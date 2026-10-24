'use client';

import { useReducedMotion } from 'motion/react';
import { useCallback, useState } from 'react';

interface Options {
  /** The state *before* the toggle — the icon shown is its opposite. */
  playing: boolean;
  /** `use-playback-doors.ts`'s toggle door — the one every non-touch trigger shares. */
  doPlay: () => void;
}

/**
 * FEAT-20260916-600 — the centre confirmation glyph, wired to the one toggle
 * door every keyboard, remote and picture-click trigger already shares
 * (`use-playback-doors.ts`'s `doPlay`). The touch centre transport
 * (`centre-transport.tsx`) calls that same door directly and is never
 * wrapped here — it already draws its own press feedback (FEAT-20260914-579).
 *
 * `token` increments on every trigger so `<PlayPauseConfirm key={token} />`
 * remounts and the CSS animation restarts on a rapid second press, rather
 * than being a no-op because the icon happened not to change.
 *
 * Under `prefers-reduced-motion: reduce` the icon is never set at all — an
 * animation that never starts never fires `animationend`, and the glyph
 * unmounts on that event, so showing it inert would leave it stuck rather
 * than suppressed.
 */
export function usePlayPauseConfirm({ playing, doPlay }: Options) {
  const reducedMotion = useReducedMotion();
  const [icon, setIcon] = useState<'play' | 'pause' | null>(null);
  const [token, setToken] = useState(0);

  const confirmedDoPlay = useCallback(() => {
    if (!reducedMotion) {
      setIcon(playing ? 'pause' : 'play');
      setToken((t) => t + 1);
    }
    doPlay();
  }, [doPlay, playing, reducedMotion]);

  const clear = useCallback(() => setIcon(null), []);

  return { icon, token, confirmedDoPlay, clear };
}
