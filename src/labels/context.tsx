'use client';

import { createContext, type ReactNode, useContext } from 'react';
import type { PlayerLabels } from './types';

const LabelsContext = createContext<PlayerLabels | null>(null);

interface LabelsProviderProps {
  labels: PlayerLabels;
  children: ReactNode;
}

/**
 * FEAT-20260925-718 S2 — what `useLabels()` reads. Luna's root mounts one of
 * these with `useVideoPlayerLabels()`'s output, so every core file below it
 * keeps rendering the exact strings `next-intl` rendered before this seam
 * was cut.
 */
export function LabelsProvider({ labels, children }: LabelsProviderProps) {
  return <LabelsContext.Provider value={labels}>{children}</LabelsContext.Provider>;
}

export function useLabelsContext(): PlayerLabels {
  const labels = useContext(LabelsContext);
  if (!labels) {
    throw new Error('useLabels() was called outside a <LabelsProvider>.');
  }
  return labels;
}
