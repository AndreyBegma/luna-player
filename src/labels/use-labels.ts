'use client';

import { useLabelsContext } from './context';
import type { PlayerLabels } from './types';

/**
 * FEAT-20260925-718 S2 — the replacement for `useTranslations('VideoPlayer')`
 * inside `core/**`: a plain object instead of a translation function, read
 * from context instead of from `next-intl`.
 */
export function useLabels(): PlayerLabels {
  return useLabelsContext();
}
