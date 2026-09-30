'use client';

import type { NavCandidate } from './tv-spatial';

/**
 * FEAT-20260830-489 — reading the page's focusable elements, once.
 *
 * Split out of `use-tv-input.ts` because the player needs the same reading for
 * a different root: the hook walks the document, and `use-player-keys.ts` walks
 * the player's own container to move between the transport's controls. Two
 * copies of a selector this fiddly would drift the first time either changed.
 *
 * `spatial.ts` stays free of the DOM on purpose — it is the part with the
 * arithmetic worth testing. This is the part that has to be looked at in a
 * browser either way.
 */
/** Module-local: `collectFocusable` below is the only thing that needs it, and
 *  an export nothing imports is what `knip` exists to catch. */
const FOCUSABLE = [
  'a[href]',
  'button:not(:disabled)',
  'input:not(:disabled)',
  'select:not(:disabled)',
  'textarea:not(:disabled)',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

/** On screen, and worth moving focus to. */
function isVisible(el: Element, rect: DOMRect): boolean {
  if (rect.width === 0 || rect.height === 0) return false;
  const style = window.getComputedStyle(el);
  return style.visibility !== 'hidden' && style.opacity !== '0';
}

export function candidateFor(el: HTMLElement): NavCandidate<HTMLElement> {
  return {
    ref: el,
    rect: el.getBoundingClientRect(),
    section:
      el.closest('[data-nav-section]')?.getAttribute('data-nav-section') ?? null,
  };
}

/**
 * Every focusable inside `root` that a remote could actually land on.
 *
 * `inert` and `aria-hidden` subtrees are skipped because that is exactly what
 * Radix marks the rest of the page with while a modal is up — without this,
 * one press of an arrow walks focus straight out of an open dialog and into the
 * page behind it.
 */
export function collectFocusable(root: ParentNode): NavCandidate<HTMLElement>[] {
  const found: NavCandidate<HTMLElement>[] = [];
  for (const el of root.querySelectorAll<HTMLElement>(FOCUSABLE)) {
    if (el.closest('[inert], [aria-hidden="true"]')) continue;
    const rect = el.getBoundingClientRect();
    if (!isVisible(el, rect)) continue;
    found.push({
      ref: el,
      rect,
      section:
        el.closest('[data-nav-section]')?.getAttribute('data-nav-section') ?? null,
    });
  }
  return found;
}

/**
 * Move focus, without an animation.
 *
 * `auto`, not `smooth`: a remote sends presses faster than a scroll animation
 * finishes and each one interrupts the last, so focus visibly trails the thumb.
 * `tv.css` turns the page's own smooth scrolling off under the same query.
 */
export function focusAndReveal(el: HTMLElement): void {
  el.focus();
  el.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'auto' });
}
