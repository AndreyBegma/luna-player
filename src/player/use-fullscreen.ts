'use client';

import { type RefObject, useCallback, useEffect, useRef, useState } from 'react';
import { COMPACT } from '../platform/media-query';
import type { AnyDocument, AnyVideo } from '../logic/platform-types';
import { rotationAction } from './rotation-fullscreen';

interface Options {
  containerRef: RefObject<HTMLDivElement | null>;
  videoRef: RefObject<HTMLVideoElement | null>;
  isTouchDevice: boolean;
  /** FEAT-20260919-619 — a rotation enters fullscreen only once there is a film to fill it. */
  mediaReady: boolean;
}

const LANDSCAPE = '(orientation: landscape)';

/**
 * FEAT-20260828-464 — fullscreen in its three flavours, out of the player.
 *
 * FEAT-20260824-377 — filling the screen without the Fullscreen API.
 *
 * An iPhone has no `Element.requestFullscreen` — the only fullscreen it
 * offers a web page is `webkitEnterFullscreen`, which hands the element to
 * the system player, where nothing of Luna's is on screen. That is exactly
 * where the language and quality menus would be unreachable, and it is
 * where phone viewing actually happens, so on a device without the real
 * API the player fills the viewport itself and keeps its own controls.
 *
 * Deliberately not the default anywhere the real API exists: it leaves the
 * browser's own chrome on screen, and Android and the desktop have no need
 * of it.
 */
export function useFullscreen({ containerRef, videoRef, isTouchDevice, mediaReady }: Options) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [pseudoFullscreen, setPseudoFullscreen] = useState(false);
  const fullscreenActive = isFullscreen || pseudoFullscreen;
  /**
   * FEAT-20260919-619 — who entered the fullscreen on screen, and when the
   * viewer last left one by hand. Refs, because the rotation listener reads
   * them from an event and a rotation must not re-bind it.
   */
  const enteredByRotation = useRef(false);
  const exitingByRotation = useRef(false);
  const manualExitAt = useRef<number | null>(null);

  useEffect(() => {
    const onFsChange = () => {
      const v = videoRef.current as AnyVideo | null;
      const fsEl =
        document.fullscreenElement ??
        (document as AnyDocument).webkitFullscreenElement;
      const iosFs = v ? !!v.webkitDisplayingFullscreen : false;
      setIsFullscreen(!!fsEl || iosFs);
    };
    document.addEventListener('fullscreenchange', onFsChange);
    document.addEventListener('webkitfullscreenchange', onFsChange);
    videoRef.current?.addEventListener('webkitbeginfullscreen', onFsChange);
    videoRef.current?.addEventListener('webkitendfullscreen', onFsChange);
    return () => {
      document.removeEventListener('fullscreenchange', onFsChange);
      document.removeEventListener('webkitfullscreenchange', onFsChange);
    };
  }, [videoRef]);

  // The page behind a viewport-filling player must not scroll under it.
  useEffect(() => {
    if (!pseudoFullscreen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [pseudoFullscreen]);

  /**
   * FEAT-20260824-377 — go fullscreen the best way this device allows.
   *
   * Ordered by how much of Luna survives, not by platform: the real API
   * keeps the whole player, the viewport-filling fallback keeps it too, and
   * the system player — which keeps none of it — is the last resort for a
   * browser that offers neither.
   *
   * Feature-detected rather than sniffed. Which iOS version gained what is
   * not something this file should be encoding, and `fullscreenEnabled` is
   * false on an iPhone whether or not `requestFullscreen` exists on the
   * prototype.
   */
  const enter = useCallback(() => {
    const v = videoRef.current as AnyVideo | null;
    const el = containerRef.current;
    if (!el) return;
    if (document.fullscreenEnabled && el.requestFullscreen) {
      el.requestFullscreen().catch(() => {
        // Refused — fill the viewport instead rather than losing the
        // controls to the system player.
        setPseudoFullscreen(true);
      });
      return;
    }
    if (isTouchDevice) {
      setPseudoFullscreen(true);
      return;
    }
    v?.webkitEnterFullscreen?.();
  }, [containerRef, videoRef, isTouchDevice]);

  const exit = useCallback(() => {
    const v = videoRef.current as AnyVideo | null;
    const doc = document as AnyDocument;
    // The button, Escape, the system gesture: a choice, and the rotation
    // listener below respects it for a while. A rotation's own exit is not.
    if (!exitingByRotation.current) manualExitAt.current = Date.now();
    exitingByRotation.current = false;
    enteredByRotation.current = false;
    setPseudoFullscreen(false);
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
      return;
    }
    if (doc.webkitFullscreenElement) {
      doc.webkitExitFullscreen?.();
      return;
    }
    if (v?.webkitDisplayingFullscreen) v.webkitExitFullscreen?.();
  }, [videoRef]);

  // A fullscreen the viewer chose is theirs, whichever way it was entered.
  const enterByHand = useCallback(() => {
    enteredByRotation.current = false;
    enter();
  }, [enter]);

  const toggle = useCallback(() => {
    if (fullscreenActive) exit();
    else enterByHand();
  }, [fullscreenActive, enterByHand, exit]);

  /**
   * FEAT-20260919-619 — landscape on a phone enters fullscreen; portrait
   * leaves the one a rotation entered. The rule is `rotation-fullscreen.ts`.
   * `(orientation: landscape)` rather than `screen.orientation`, because it is
   * what Safari has and the change event fires once per turn. Gated on a
   * finger and a compact viewport at the moment of the turn — a tablet on a
   * stand and a desktop window being resized both flip the query and are not
   * phones. The browser's own exit (`fullscreenchange` without our `exit`)
   * is not a manual exit here: on the pseudo path there is none.
   */
  const latest = useRef({ fullscreenActive, mediaReady, isTouchDevice, enter, exit });
  latest.current = { fullscreenActive, mediaReady, isTouchDevice, enter, exit };

  useEffect(() => {
    const landscape = window.matchMedia(LANDSCAPE);
    const onTurn = () => {
      const current = latest.current;
      const action = rotationAction({
        landscape: landscape.matches,
        phone: current.isTouchDevice && window.matchMedia(COMPACT).matches,
        mediaReady: current.mediaReady,
        fullscreenActive: current.fullscreenActive,
        enteredByRotation: enteredByRotation.current,
        manualExitAt: manualExitAt.current,
        now: Date.now(),
      });
      if (action === 'enter') {
        enteredByRotation.current = true;
        current.enter();
      } else if (action === 'exit') {
        exitingByRotation.current = true;
        current.exit();
      }
    };
    landscape.addEventListener('change', onTurn);
    return () => landscape.removeEventListener('change', onTurn);
  }, []);

  return { pseudoFullscreen, fullscreenActive, enter: enterByHand, exit, toggle };
}
