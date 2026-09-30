/**
 * FEAT-20260830-489 — which element the d-pad should move to.
 *
 * A television's only input is four arrows, and the browser's own answer to
 * them is either nothing (a desktop engine, where arrows scroll) or the
 * platform's built-in spatial navigation, which is not something a web page can
 * rely on or tune. So Luna works it out itself.
 *
 * This file is deliberately the geometry alone — rectangles in, a rectangle
 * out, no DOM. The hook in `use-tv-input.ts` does the reading and the focusing;
 * everything that could be wrong about *which* poster the remote lands on is
 * decided here, where `bun test src` can ask it directly. Every other test in
 * this repository is a plain `.ts` unit test for the same reason.
 */

export type Direction = 'up' | 'down' | 'left' | 'right';

/** The part of a `DOMRect` this cares about. Named for `NavCandidate` below
 *  rather than for callers, who pass a `DOMRect` or an object literal. */
interface NavRect {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export interface NavCandidate<T> {
  rect: NavRect;
  /**
   * The `[data-nav-section]` this element sits in, or `null` for one that sits
   * in no section at all. Identity is all that matters — two elements are in
   * the same section when this compares equal.
   */
  section: string | null;
  /** Whatever the caller wants back; the DOM element, in practice. */
  ref: T;
}

/**
 * How much a sideways miss costs relative to a step forward.
 *
 * Distance along the direction of travel is what the viewer asked for;
 * distance across it is a mistake, and a cheap one at 1:1 — pressing Down in a
 * grid would happily land two columns over because that element happened to be
 * a few pixels higher. Weighting the perpendicular axis means the walker
 * prefers the thing that is actually below the thumb, and only drifts sideways
 * when there is nothing better.
 */
const CROSS_AXIS_WEIGHT = 3;

function centreOf(rect: NavRect): { x: number; y: number } {
  return {
    x: (rect.left + rect.right) / 2,
    y: (rect.top + rect.bottom) / 2,
  };
}

/** Do two rectangles share any of the axis perpendicular to the travel? */
function overlaps(a: NavRect, b: NavRect, direction: Direction): boolean {
  if (direction === 'left' || direction === 'right') {
    return a.top < b.bottom && b.top < a.bottom;
  }
  return a.left < b.right && b.left < a.right;
}

/**
 * On a vertical move: does `b` lie wholly below (or above) `a` — the next line
 * of a grid, rather than something drawn inside or across `a`?
 */
function beyond(a: NavRect, b: NavRect, direction: Direction): boolean {
  return direction === 'down' ? b.top >= a.bottom : b.bottom <= a.top;
}

/**
 * The focusable the remote should move to, or `null` when there is nothing that
 * way and focus should stay where it is.
 *
 * Two rules come from the section attribute, and they are the difference
 * between a walker that feels like a television and one that feels like a maze:
 *
 * - **Left and Right stay inside a section.** A poster row is a section, and
 *   running off the end of one must not throw focus at whatever happens to sit
 *   to the right of the row — the header, a button in the next section, the
 *   page's own furniture. It stops at the end, which is what every television
 *   interface does.
 * - **Up and Down leave it.** Within a row there is nothing above or below, so
 *   the vertical axis is how a viewer moves between rows, and staying inside
 *   the section would strand them on the first one. The exception is a
 *   section laid out as a grid (the catalogue, the watchlist): its next line
 *   lies wholly below the origin, and Down steps onto it before leaving.
 *
 * An element in no section is governed by geometry alone, which is the right
 * behaviour for a page of ordinary controls — a form, a settings list, the
 * account menu — and is why the hook works before FEAT-491 adds the attribute
 * anywhere, and gets better once it has.
 */
export function nextInDirection<T>(
  from: NavCandidate<T>,
  candidates: readonly NavCandidate<T>[],
  direction: Direction,
): NavCandidate<T> | null {
  const origin = centreOf(from.rect);
  const horizontal = direction === 'left' || direction === 'right';

  let best: NavCandidate<T> | null = null;
  let bestScore = Number.POSITIVE_INFINITY;

  for (const candidate of candidates) {
    if (candidate === from || candidate.ref === from.ref) continue;

    if (from.section !== null) {
      const same = candidate.section === from.section;
      // Sideways within the row. Vertically out of it — or, in a section laid
      // out as a grid, onto its next line; never onto a control inside the
      // card being left, which shares its section and sits within its box.
      // Those are reached by `nextFocus` in `card-controls.ts` (FEAT-713).
      if (horizontal ? !same : same && !beyond(from.rect, candidate.rect, direction))
        continue;
    }

    const point = centreOf(candidate.rect);
    const dx = point.x - origin.x;
    const dy = point.y - origin.y;

    // Along the direction of travel, and it has to be a real step: a candidate
    // level with the origin is not "to the right" of it however close it sits.
    const along = direction === 'right' ? dx
      : direction === 'left' ? -dx
      : direction === 'down' ? dy
      : -dy;
    if (along <= 0) continue;

    const across = Math.abs(horizontal ? dy : dx);

    // An element that shares the perpendicular axis — the same row, the same
    // column — is what the viewer means, so it is scored before anything that
    // merely lies in the right half-plane. Without this a tall element beside
    // the row wins on raw distance and focus leaves the row sideways.
    const aligned = overlaps(from.rect, candidate.rect, direction);
    const score = along + across * CROSS_AXIS_WEIGHT + (aligned ? 0 : 1e6);

    if (score < bestScore) {
      bestScore = score;
      best = candidate;
    }
  }

  return best;
}
