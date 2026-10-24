'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { controlsHideOnPointerLeave, controlsMayHide } from '../logic/controls-hide';
import { controlHasKeyboardFocus } from '../logic/player-keys';

interface Options {
  /**
   * BUG-20260905-571 — one of the player's menus is open. The three menus are
   * separately owned; the controls do not care which of them is up, only that
   * one is.
   */
  menuOpen: boolean;
  playing: boolean;
  fullscreenActive: boolean;
}

interface ControlsVisibility {
  showControls: boolean;
  /** Bring the controls up and leave the timer alone. */
  show: () => void;
  /**
   * FEAT-20260919-619 — take them down now: a tap on the picture with the
   * controls up, or Back on a television. The timer is cleared with them, so
   * a fade armed a second earlier does not fire into a state it already has.
   */
  hide: () => void;
  /** Arm, or re-arm, the fade. */
  scheduleHide: () => void;
  showAndScheduleHide: () => void;
  /** The pointer left the frame. */
  hideOnPointerLeave: () => void;
  /**
   * FEAT-20260901-510 — hold the controls on screen, or release them.
   *
   * The learning word popover is the caller; a release re-arms the fade, so
   * the controls still go the usual few seconds after the popover does.
   */
  suppress: (held: boolean) => void;
  /** The picture is running with nothing over it; the pointer goes too. */
  hidesCursor: boolean;
}

/**
 * FEAT-20260914-584 — when the controls are on screen, out of the player.
 *
 * FEAT-20260830-489 — how long the controls stay, and when they may not go.
 *
 * Five seconds is a pointer's figure: a mouse can bring them back with a
 * millimetre of movement. A remote cannot — every recall costs a button
 * press and a re-hunt for whatever was focused — so a device without a
 * pointer gets eight.
 *
 * And they never hide out from under a control the viewer can see is
 * focused — `controlHasKeyboardFocus`, not merely focused, or a desktop
 * click on play would pin the transport open for the whole film. Hiding
 * sets `opacity-0 pointer-events-none` on the overlay while the button
 * inside it keeps DOM focus, which is precisely the stranded state
 * BUG-20260820-238 was filed about: focus on a control nobody can see, and
 * every press going somewhere invisible.
 *
 * BUG-20260905-571 — nor while a menu is open. That used to be handled by
 * closing the audio menu from in here as the bar went, which answered one
 * of the three and answered it the wrong way round: the viewer opened the
 * menu, so the menu is the thing that stays and the bar waits. The rule
 * lives in `player/controls-hide.ts` with the pointer-leave one, and this
 * timeout re-arms whenever it is refused, so the controls still fade the
 * usual five seconds after the menu is dismissed.
 */
export function useControlsVisibility({
  menuOpen,
  playing,
  fullscreenActive,
}: Options): ControlsVisibility {
  const [showControls, setShowControls] = useState(true);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /**
   * FEAT-20260901-510 — the controls may not go while the word popover is
   * open.
   *
   * A ref rather than state because `scheduleHide` reads it from inside a
   * timeout it armed several seconds earlier, where a captured `false` would
   * be the value from before the popover existed. `controlHasKeyboardFocus`
   * beside it cannot answer this: focus is inside the popover, which is
   * portalled into the player's container and is genuinely a control — but
   * the same is true of the transport, and the transport is allowed to fade.
   */
  const hideSuppressed = useRef(false);
  /**
   * BUG-20260905-571 — whether one of the player's menus is open, where the
   * hide timer can read it.
   *
   * A ref for the reason `hideSuppressed` above is one: `scheduleHide` reads
   * this from inside a timeout armed several seconds earlier, so a captured
   * value would be the one from before the menu was opened. The render path
   * uses `menuOpen` directly instead; this is only the timer's copy.
   */
  const menuOpenRef = useRef(false);
  // `scheduleHide` re-arms itself below; a ref is what lets it do that
  // without naming itself in its own dependency list.
  const scheduleHideRef = useRef<(() => void) | null>(null);

  const scheduleHide = useCallback(() => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
    const coarse =
      typeof window !== 'undefined' &&
      window.matchMedia('(hover: none)').matches;
    hideTimer.current = setTimeout(
      () => {
        if (
          !controlsMayHide({
            menuOpen: menuOpenRef.current,
            suppressed: hideSuppressed.current,
            controlFocused: controlHasKeyboardFocus(coarse),
          })
        ) {
          scheduleHideRef.current?.();
          return;
        }
        setShowControls(false);
      },
      coarse ? 8000 : 5000,
    );
  }, []);
  scheduleHideRef.current = scheduleHide;

  // FEAT-20260914-584 — a timeout armed before navigation used to outlive
  // the player and call `setShowControls` on a component that was gone.
  useEffect(
    () => () => {
      if (hideTimer.current) clearTimeout(hideTimer.current);
    },
    [],
  );

  const show = useCallback(() => setShowControls(true), []);

  const hide = useCallback(() => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
    setShowControls(false);
  }, []);

  const showAndScheduleHide = useCallback(() => {
    setShowControls(true);
    scheduleHide();
  }, [scheduleHide]);

  const suppress = useCallback((held: boolean) => {
    hideSuppressed.current = held;
    if (!held) scheduleHideRef.current?.();
  }, []);

  useEffect(() => {
    menuOpenRef.current = menuOpen;
    // Closing the last menu is what starts the clock again; without this the
    // controls would sit there until the next mouse move.
    if (!menuOpen) scheduleHideRef.current?.();
  }, [menuOpen]);

  // BUG-20260905-571 — `menuOpen` is what keeps this from taking the bar
  // away under an open menu. A menu opens upwards out of a bar at the bottom
  // of the frame, so reaching for one of its rows is one of the ordinary
  // ways the pointer ends up off the player.
  const hideOnPointerLeave = useCallback(() => {
    if (controlsHideOnPointerLeave({ playing, menuOpen })) setShowControls(false);
  }, [playing, menuOpen]);

  const hidesCursor = !showControls && playing;

  useEffect(() => {
    if (fullscreenActive) {
      document.body.style.cursor = hidesCursor ? 'none' : '';
    } else {
      document.body.style.cursor = '';
    }
    return () => {
      document.body.style.cursor = '';
    };
  }, [fullscreenActive, hidesCursor]);

  return {
    showControls,
    show,
    hide,
    scheduleHide,
    showAndScheduleHide,
    hideOnPointerLeave,
    suppress,
    hidesCursor,
  };
}
