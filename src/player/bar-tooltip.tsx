'use client';

import { Tooltip } from '@andrewbehma/glass-ui/tooltip';
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { TELEVISION } from '../platform/media-query';

/**
 * How long focus has to rest on a control, on the television, before its name
 * appears. A D-pad passing along the row lands on every control on the way,
 * and a name flashing up at each one is noise.
 */
const TV_REST_MS = 600;

/**
 * BUG-20260924-687 — whether the bar these tooltips belong to is on screen.
 * `ControlBar` provides its own `visible`; a tooltip outside a bar is always
 * allowed. Hiding the bar is only opacity and `pointer-events` on its root:
 * the control keeps its focus and the mouse stays where it rested, so nothing
 * would tell Radix to close — this does.
 */
export const BarVisibleContext = createContext(true);

interface Props {
  label: string;
  /** The player's container, for the reason the menus take it: see `ControlBarProps.portalHost`. */
  portalHost: HTMLElement | null;
  /** One element that takes a ref and props: a `button`, or a Radix trigger rendered `asChild`. */
  children: ReactNode;
}

/**
 * FEAT-20260924-679 — the name of a control in the bar, on hover and on focus.
 *
 * glass-ui's `Tooltip`, bound to the player's container so it is drawn in
 * element fullscreen, with one rule of the bar's own: on the television it
 * opens only once focus has rested. Radix opens a tooltip on keyboard focus at
 * once and on hover after its delay, and on a television every open is a
 * focus, so there the open is held back by a timer and cancelled by any close
 * that comes first. Whether this is a television is read when the tooltip asks
 * to open, not subscribed to, because nothing here renders differently for it.
 */
export function BarTooltip({ label, portalHost, children }: Props) {
  const barVisible = useContext(BarVisibleContext);
  const [open, setOpen] = useState(false);
  const rest = useRef<number | undefined>(undefined);
  const barVisibleRef = useRef(barVisible);

  const onOpenChange = useCallback((next: boolean) => {
    window.clearTimeout(rest.current);
    if (next && window.matchMedia(TELEVISION).matches) {
      // Radix's close cannot cancel this: while the open is only pending,
      // `open` is already `false` and a close asks for the value it has, so
      // `onOpenChange` is never called. On the television every open is a
      // focus, so the control focused now is the trigger, and focus still
      // being there when the rest is over is what "rested" means.
      const focused = document.activeElement;
      rest.current = window.setTimeout(() => {
        if (document.activeElement === focused && barVisibleRef.current)
          setOpen(true);
      }, TV_REST_MS);
      return;
    }
    setOpen(next);
  }, []);

  // BUG-20260924-687 — the bar hid (Back on a remote, or the auto-hide under
  // a resting mouse): the name goes with it, and a rest still pending is
  // dropped, so neither comes back on its own when the bar does.
  useEffect(() => {
    barVisibleRef.current = barVisible;
    if (barVisible) return;
    window.clearTimeout(rest.current);
    setOpen(false);
  }, [barVisible]);

  useEffect(() => () => window.clearTimeout(rest.current), []);

  return (
    <Tooltip
      content={label}
      container={portalHost}
      open={open && barVisible}
      onOpenChange={onOpenChange}
    >
      {children}
    </Tooltip>
  );
}
