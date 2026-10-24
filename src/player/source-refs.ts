'use client';

import type { HlsLike } from './hls-types';
import { type RefObject, useState } from 'react';

/**
 * FEAT-20260828-464 — the flags the player's source logic reads across almost
 * every function, in one bag so that the hooks the logic was split into can
 * share them without each owning a copy.
 *
 * They are refs and not state on purpose: every one of them is read inside an
 * event handler or an hls.js callback that must see the value *now*, not the
 * value at the render that bound it. The bag itself never changes identity,
 * so listing it as a dependency costs nothing.
 */
export interface SourceRefs {
  /** The film — not the clip — is the element's loaded source. */
  srcLoaded: RefObject<boolean>;
  /** A position to apply once metadata arrives, or after the next attach. */
  pendingSeek: RefObject<number | null>;
  /** Where a server-seeking stream started; added to the element's own clock. */
  seekOffset: RefObject<number>;
  /** The fallback URL has been tried; there is nothing after it. */
  usedFallback: RefObject<boolean>;
  /** The fallback URL is what the element is playing right now. */
  usingFallbackSrc: RefObject<boolean>;
  /** The audio track a server-seeking URL should carry, if one was chosen. */
  audioIndex: RefObject<number | undefined>;
  /** The hls.js instance, while one is attached. */
  hls: RefObject<HlsLike | null>;
  /** hls.js is driving the element, so seeks go to `currentTime`. */
  hlsActive: RefObject<boolean>;
}

export function useSourceRefs(): SourceRefs {
  const [refs] = useState<SourceRefs>(() => ({
    srcLoaded: { current: false },
    pendingSeek: { current: null },
    seekOffset: { current: 0 },
    usedFallback: { current: false },
    usingFallbackSrc: { current: false },
    audioIndex: { current: undefined },
    hls: { current: null },
    hlsActive: { current: false },
  }));
  return refs;
}
