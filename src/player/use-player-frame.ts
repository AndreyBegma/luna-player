'use client';

import { type RefObject, useEffect, useState } from 'react';

const FINE_POINTER = '(pointer: fine)';

interface Options {
  containerRef: RefObject<HTMLDivElement | null>;
}

interface PlayerFrame {
  /**
   * FEAT-20260830-489 — the element the player's own menus portal into.
   *
   * State rather than the ref itself, because a ref does not re-render: the
   * control bar mounts on `loadedmetadata`, and a menu that read
   * `containerRef.current` during a render where it was still `null` would
   * portal to the body and stay there. This is set once on mount, which is
   * before there is any media, so by the time a menu can be opened it holds
   * the real element.
   */
  portalHost: HTMLDivElement | null;
  isTouchDevice: boolean;
  /**
   * FEAT-20260919-619 — `(pointer: fine)`: a mouse or a trackpad is driving
   * this page. The rule for what a click on the picture means, and for whether
   * the centre cluster is drawn, is decided on the pointer class rather than
   * on the device: a television without a mouse reports no fine pointer and
   * gets the tap model and the discs; a laptop with a touchscreen and a
   * trackpad reports one and keeps click-to-toggle. `isTouchDevice` stays the
   * touch signal — long-press and rotation are a finger's, not a remote's.
   * Live, because a mouse plugged into a tablet flips it.
   */
  finePointer: boolean;
  /** False during server rendering and the first client render. */
  hasMounted: boolean;
  /**
   * FEAT-20260914-579 — the centre cluster needs room above the bar; the
   * height is measured rather than inferred from a breakpoint because a
   * portrait phone in fullscreen is narrow and tall at once.
   */
  containerHeight: number;
  /**
   * BUG-20260919-629 — root `font-size` ÷ 16: `tv.css` raises it from
   * 1920px wide, and `xray-visibility.ts` needs the same ratio the browser
   * is already scaling the strip's `rem`s by. Read at render time rather
   * than through its own effect: `containerHeight` above already re-renders
   * the player on a real resize (its `ResizeObserver` fires), so a second
   * listener for the same event would be redundant, and the player does not
   * re-render on every frame — the playhead lives outside React state
   * precisely so it wouldn't. (Moved here from the hub, FEAT-20260923-633.)
   */
  remScale: number;
}

/**
 * FEAT-20260914-584 — what the player learns about its own box and the
 * device once it is on screen, out of the player.
 */
export function usePlayerFrame({ containerRef }: Options): PlayerFrame {
  const [portalHost, setPortalHost] = useState<HTMLDivElement | null>(null);
  const [isTouchDevice, setIsTouchDevice] = useState(false);
  const [finePointer, setFinePointer] = useState(false);
  const [hasMounted, setHasMounted] = useState(false);
  const [containerHeight, setContainerHeight] = useState(0);

  useEffect(() => {
    setPortalHost(containerRef.current);
    setIsTouchDevice(navigator.maxTouchPoints > 0);
    setHasMounted(true);
  }, [containerRef]);

  useEffect(() => {
    const media = window.matchMedia(FINE_POINTER);
    const update = () => setFinePointer(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    const node = containerRef.current;
    if (!node || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver((entries) => {
      const height = entries[0]?.contentRect.height ?? 0;
      setContainerHeight(Math.round(height));
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [containerRef]);

  return {
    portalHost,
    isTouchDevice,
    finePointer,
    hasMounted,
    containerHeight,
    remScale: readRemScale(),
  };
}

function readRemScale(): number {
  if (typeof document === 'undefined') return 1;
  const rootFontPx = Number.parseFloat(getComputedStyle(document.documentElement).fontSize);
  return Number.isFinite(rootFontPx) && rootFontPx > 0 ? rootFontPx / 16 : 1;
}
