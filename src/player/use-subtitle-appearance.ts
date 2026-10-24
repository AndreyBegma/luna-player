'use client';

import { useSyncExternalStore } from 'react';
import {
  canLiftCueContainer,
  cuePlacement,
  defaultAppearance,
  type SubtitleAppearance,
  type SubtitlePosition,
  subtitleAppearance,
} from '../logic/subtitle-appearance';

const SERVER = defaultAppearance(false);

/**
 * FEAT-20260923-647 — this device's subtitle appearance, live.
 *
 * Read where it is drawn — the `<video>` and the learning cue layer — and
 * written by the subtitle menu, all through the one store, so none of it has
 * to pass through the player hub.
 */
export function useSubtitleAppearance(): SubtitleAppearance {
  return useSyncExternalStore(
    subtitleAppearance.subscribe,
    subtitleAppearance.get,
    () => SERVER,
  );
}

const noSubscribe = () => () => {};

/**
 * BUG-20260924-687 — the viewer's position, split into what the `<video>`
 * attribute says and what the cues' own lines say, for this engine. The
 * server cannot ask the engine and answers "lines"; the first client render
 * after hydration corrects it, and `applyCuePosition` gives back any line it
 * raised in between.
 */
export function useCuePlacement(): {
  container: SubtitlePosition;
  lines: SubtitlePosition;
} {
  const { position } = useSubtitleAppearance();
  const liftable = useSyncExternalStore(
    noSubscribe,
    canLiftCueContainer,
    () => false,
  );
  return cuePlacement(position, liftable);
}
