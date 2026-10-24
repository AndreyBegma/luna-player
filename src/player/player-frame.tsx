'use client';

import { type ReactNode, type RefObject, useEffect, useState } from 'react';
import { LaunchFrameProvider } from './launch-veil';
import type { AnyDocument } from '../logic/platform-types';
import type { useFrameGestures } from './use-frame-gestures';

/**
 * FEAT-20260924-680 — whether this frame is the document's fullscreen
 * element. Its own listener rather than `useFullscreen`'s answer: that lives
 * in the hub, and the launch veil only needs to know about this box.
 */
function useFillsScreen(containerRef: RefObject<HTMLDivElement | null>) {
  const [fills, setFills] = useState(false);
  useEffect(() => {
    const onChange = () => {
      const element =
        document.fullscreenElement ??
        (document as AnyDocument).webkitFullscreenElement;
      setFills(!!element && element === containerRef.current);
    };
    document.addEventListener('fullscreenchange', onChange);
    document.addEventListener('webkitfullscreenchange', onChange);
    return () => {
      document.removeEventListener('fullscreenchange', onChange);
      document.removeEventListener('webkitfullscreenchange', onChange);
    };
  }, [containerRef]);
  return fills;
}

/**
 * A click that lands inside one of these is that layer's, never the
 * picture's. BUG-20260820-236 put the rule on markup rather than geometry;
 * FEAT-20260923-661 Q-01 widened it past the controls to the layers that sit
 * over the picture — a link, and any dialog (the end screen, the key sheet) —
 * because a click on the end screen's own surface used to reach `doPlay`,
 * and `play()` on an ended element starts the film again from the top.
 */
const OWNED_BY_A_LAYER =
  'a, button, input, select, textarea, [role="dialog"], [data-player-control]';

function isPictureClick(target: EventTarget | null): boolean {
  return !(target instanceof Element && target.closest(OWNED_BY_A_LAYER));
}

type PointerHandlers = Pick<
  ReturnType<typeof useFrameGestures>,
  'onPointerDown' | 'onPointerMove' | 'onPointerUp' | 'onPointerCancel'
>;

interface Props {
  containerRef: RefObject<HTMLDivElement | null>;
  pseudoFullscreen: boolean;
  finePointer: boolean;
  hidesCursor: boolean;
  /** Only for a click on the picture itself; see `OWNED_BY_A_LAYER`. */
  onPictureClick: (clientX: number, rect: DOMRect) => void;
  onToggleFullscreen: () => void;
  gestures: PointerHandlers;
  /** A mouse moved or a finger landed: the controls come back. */
  onActivity: () => void;
  onMouseEnter: () => void;
  onTouchStart: () => void;
  onPointerLeave: () => void;
  /**
   * FEAT-20260925-718 L3 — the box's shape as a CSS `aspect-ratio`, where
   * luna-watch hard-coded `16/9`. Pseudo-fullscreen still drops it.
   */
  aspectRatio?: string;
  children: ReactNode;
}

/**
 * FEAT-20260923-661 — the player's box and the one rule it owns: which
 * clicks on it are the picture's. Out of the hub, with the markup the
 * comments below explain.
 */
export function PlayerFrame({
  containerRef,
  pseudoFullscreen,
  finePointer,
  hidesCursor,
  onPictureClick,
  onToggleFullscreen,
  gestures,
  onActivity,
  onMouseEnter,
  onTouchStart,
  onPointerLeave,
  aspectRatio = '16/9',
  children,
}: Props) {
  const fillsScreen = useFillsScreen(containerRef);
  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: video player container; mouse/touch events control UI visibility
    // biome-ignore lint/a11y/useKeyWithClickEvents: the keyboard equivalent is the window-level handler in `use-player-keys.ts`, which covers Enter, Space and the media keys for the whole player rather than only while this div happens to hold focus
    <div
      ref={containerRef}
      /* BUG-20260919-628 — not in the tab order (a remote never lands here
         by walking focus), but a valid target for `useStripFocusHandoff`'s
         `.focus()` when the strip that just hid was the last thing to hold
         it and there is no single control to hand focus to instead. */
      tabIndex={-1}
      /* FEAT-20260830-489 — the arrows inside here are the player's: Left and
         Right seek, Up and Down move between the controls or change the
         volume. `lib/tv/use-tv-input.ts` reads this and stands its spatial
         navigation down rather than the two racing over one key event. */
      data-tv-keys="own"
      /* FEAT-20260919-619 — which class of pointer the frame believes it
         has, for the walk on the real television set. */
      data-pointer-class={finePointer ? 'fine' : 'coarse'}
      // FEAT-20260824-377 — `z-overlay` rather than a number: filling the
      // viewport has to beat the site header and the bottom capsule, which
      // are `z-chrome`, and the token layer is where that order is decided.
      // `relative` lives in the else branch rather than in the base, because
      // both it and `fixed` are position utilities and the one that wins is
      // decided by Tailwind's own rule order, not by the order they are
      // written here — with both present `relative` won and the player never
      // left the page flow.
      /* FEAT-20260831-503 — a filled picture is scaled past the edges of
         this box, and the edges are where it has to stop. Radix portals the
         three player menus with `position: fixed`, whose containing block is
         the viewport, so `overflow` does not reach them. */
      className={`bg-black select-none overflow-hidden ${
        pseudoFullscreen
          ? 'fixed inset-0 z-overlay flex h-full w-full items-center justify-center'
          : 'relative w-full'
      }`}
      style={{
        aspectRatio: pseudoFullscreen ? undefined : aspectRatio,
        cursor: hidesCursor ? 'none' : undefined,
      }}
      /**
       * BUG-20260820-236 — click-to-toggle belongs on the frame, not on the
       * <video> box. Two things sat in the way of "click anywhere": the video
       * does not fill a 16:9 container when the source is a different shape,
       * so the letterbox bars were dead, and the controls overlay spans
       * `inset-0` and swallows the picture the moment it is visible. Handling
       * it here catches both, since everything inside bubbles up.
       */
      onClick={(e) => {
        if (!isPictureClick(e.target)) return;
        onPictureClick(e.clientX, e.currentTarget.getBoundingClientRect());
      }}
      /* FEAT-20260923-633 — a double click fills the screen, as in every
         desktop player. Its two clicks have already toggled playback
         twice, which leaves the film where it was; waiting out a
         double-click window instead would make every single click late. */
      onDoubleClick={(e) => {
        if (!finePointer || !isPictureClick(e.target)) return;
        onToggleFullscreen();
      }}
      onPointerDown={gestures.onPointerDown}
      onPointerMove={gestures.onPointerMove}
      onPointerUp={gestures.onPointerUp}
      onPointerCancel={gestures.onPointerCancel}
      onMouseMove={onActivity}
      onMouseEnter={onMouseEnter}
      // FEAT-20260919-619 — only a pointer can leave. Chromium sends the
      // compat `mouseleave` after every touch tap (measured under
      // Playwright's touch emulation: pointerleave, click, then mouseleave),
      // which took the controls straight back down after the tap that had
      // just brought them up.
      onMouseLeave={finePointer ? onPointerLeave : undefined}
      onTouchStart={() => {
        onActivity();
        onTouchStart();
      }}
    >
      <LaunchFrameProvider fullscreen={fillsScreen || pseudoFullscreen}>
        {children}
      </LaunchFrameProvider>
    </div>
  );
}
