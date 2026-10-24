'use client';

import { type RefObject, useEffect } from 'react';
import { backHidesControls, bindingFor, playerInUse } from '../logic/player-keys';

interface Options {
  containerRef: RefObject<HTMLDivElement | null>;
  introActiveRef: RefObject<boolean>;
  fullscreenActive: boolean;
  finePointer: boolean;
  showControls: boolean;
  menuOpen: boolean;
  sheetOpen: boolean;
  hideControls: () => void;
}

/**
 * FEAT-20260919-619 — Back, in the capture phase.
 *
 * `lib/tv/use-tv-input.ts` is mounted at the root and registered first, so
 * in the bubble phase it sees Back before the player's own handler does and
 * leaves the page. Listening in the capture phase puts the player first, for
 * this one key and only when `backHidesControls` says the press is ours; the
 * root then sees `defaultPrevented` and stands down. Everything else about
 * Back — Escape leaving pseudo fullscreen, a menu closing — is untouched.
 *
 * FEAT-20260923-633 — moved out of `use-player-keys.ts` unchanged, to keep
 * that file under the ceiling.
 */
export function useBackCapture({
  containerRef,
  introActiveRef,
  fullscreenActive,
  finePointer,
  showControls,
  menuOpen,
  sheetOpen,
  hideControls,
}: Options): void {
  useEffect(() => {
    const onBackCapture = (e: KeyboardEvent) => {
      if (introActiveRef.current) return;
      if (bindingFor(e)?.id !== 'back') return;
      if (
        !backHidesControls({
          televisionClass: !finePointer,
          inUse: playerInUse(containerRef.current, fullscreenActive),
          showControls,
          menuOpen,
          sheetOpen,
        })
      )
        return;
      e.preventDefault();
      hideControls();
    };
    window.addEventListener('keydown', onBackCapture, true);
    return () => window.removeEventListener('keydown', onBackCapture, true);
  }, [
    introActiveRef,
    containerRef,
    fullscreenActive,
    finePointer,
    showControls,
    menuOpen,
    sheetOpen,
    hideControls,
  ]);
}
