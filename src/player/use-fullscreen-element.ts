'use client';

import { useSyncExternalStore } from 'react';
import type { AnyDocument } from '../logic/platform-types';

function subscribe(onChange: () => void) {
  document.addEventListener('fullscreenchange', onChange);
  document.addEventListener('webkitfullscreenchange', onChange);
  return () => {
    document.removeEventListener('fullscreenchange', onChange);
    document.removeEventListener('webkitfullscreenchange', onChange);
  };
}

function getFullscreenElement(): Element | null {
  return document.fullscreenElement ?? (document as AnyDocument).webkitFullscreenElement ?? null;
}

const getServerSnapshot = () => null;

/**
 * BUG-20260925-705 — the element the Fullscreen API is drawing, or `null`.
 *
 * Only the real element fullscreen. `useFullscreen`'s `fullscreenActive` also
 * counts the viewport-filling fallback (FEAT-20260824-377) and the system
 * player on an iPhone, and neither of those is a place where only one element
 * is drawn — which is the one fact a portal target cares about.
 */
export function useFullscreenElement(): Element | null {
  return useSyncExternalStore(subscribe, getFullscreenElement, getServerSnapshot);
}
