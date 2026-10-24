'use client';

import {
  candidateFor,
  collectFocusable,
  focusAndReveal,
} from '../platform/tv-focusables';
import { nextInDirection } from '../platform/tv-spatial';

/** The centre cluster's wrapper, and the disc a remote lands on when it enters. */
const CLUSTER = '[data-centre-transport]';
const CLUSTER_PRIMARY = '[data-centre-transport-primary]';

function activeInside(container: HTMLElement): HTMLElement | null {
  const active = document.activeElement;
  return active instanceof HTMLElement && container.contains(active)
    ? active
    : null;
}

/**
 * FEAT-20260830-489 — the vertical axis moves between the controls while the
 * transport is on screen. Moved out of `use-player-keys.ts` by
 * FEAT-20260919-619, unchanged but for the cluster rule at the end.
 *
 * Geometry first: it is what carries the real vertical step, from the
 * scrubber down into the button row and back up again. Then DOM order,
 * because the transport is one horizontal row and geometry has nothing to
 * say inside it — every button shares a centre line, so "below the Play
 * button" is genuinely nothing. Left and Right are the axis that would have
 * walked that row, and they are spent on seeking. So the vertical keys step
 * through the controls in order instead: Down to the next, Up to the
 * previous. A remote can then reach the quality menu, the subtitle menu and
 * fullscreen, which is the whole reason this exists.
 *
 * Returns `false` off either end of the transport, so the caller can fall
 * through to volume rather than swallowing the press.
 */
export function moveTransportFocus(
  container: HTMLElement,
  direction: 'up' | 'down',
): boolean {
  const candidates = collectFocusable(container);
  const inside = activeInside(container);

  let next = inside
    ? nextInDirection(candidateFor(inside), candidates, direction)?.ref
    : candidates[0]?.ref;

  if (!next && inside) {
    const order = candidates.map((c) => c.ref);
    const at = order.indexOf(inside);
    if (at !== -1) next = order[at + (direction === 'down' ? 1 : -1)];
  }

  if (!next) return false;

  /**
   * FEAT-20260919-619 — entering the centre cluster lands on play.
   *
   * From the bar's own play button — at the left of its row — geometry
   * scores the *nearest* disc above, which is the −10 one. A television
   * lands on the main action and steps sideways from there, so a move that
   * arrives in the cluster from outside it is redirected to the play disc.
   * Moves that start inside the cluster keep their geometry.
   */
  const cluster = next.closest<HTMLElement>(CLUSTER);
  if (cluster && !inside?.closest(CLUSTER)) {
    next = cluster.querySelector<HTMLElement>(CLUSTER_PRIMARY) ?? next;
  }

  focusAndReveal(next);
  return true;
}

/**
 * BUG-20260919-628 — where focus goes when the pause strip it was inside
 * just went invisible.
 *
 * The strip hides by prop (`xrayWanted` false: the film resumed, the bar's
 * own hide timer ran out, the resume banner arrived), never by unmounting —
 * `aria-hidden` and `tabIndex={-1}` on elements that stay in the DOM, which
 * does not blur whichever one already held focus. Left alone that is the
 * stranded-focus shape `use-controls-visibility.ts` describes for the bar
 * itself (BUG-20260820-238): a control nobody can see, and every press
 * going somewhere invisible.
 *
 * The centre cluster's primary disc is "the player" when a television
 * without a fine pointer put it on screen (FEAT-20260919-619); everywhere
 * else — a mouse, or the controls down too — there is no single control to
 * name, so focus goes to the container itself.
 */
export function focusAwayFromHiddenStrip(container: HTMLElement): void {
  const strip = container.querySelector<HTMLElement>(
    '[data-nav-section="pause-strip"]',
  );
  const active = document.activeElement;
  if (!strip || !(active instanceof HTMLElement) || !strip.contains(active))
    return;
  const target =
    container.querySelector<HTMLElement>(CLUSTER_PRIMARY) ?? container;
  target.focus();
}

/**
 * FEAT-20260919-619 — Left and Right move between the three discs while one
 * of them holds focus. Off either end there is no disc, and the press falls
 * through to seeking — the same rule Up and Down have off the ends of the
 * bar, and what lets "Right onto the +10 disc, then hold Right" be one
 * gesture.
 */
export function moveWithinCluster(direction: 'left' | 'right'): boolean {
  const active = document.activeElement;
  if (!(active instanceof HTMLElement)) return false;
  const cluster = active.closest<HTMLElement>(CLUSTER);
  if (!cluster) return false;
  const discs = collectFocusable(cluster).map((c) => c.ref);
  const at = discs.indexOf(active);
  if (at === -1) return false;
  const next = discs[at + (direction === 'right' ? 1 : -1)];
  if (!next) return false;
  focusAndReveal(next);
  return true;
}
