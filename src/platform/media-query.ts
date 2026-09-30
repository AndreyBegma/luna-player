import { useEffect, useState } from 'react';

/**
 * FEAT-20260830-493 — one media query, as a boolean, for a component that must
 * *choose* a structure rather than restyle one.
 *
 * `useWideLayout()` already does this for the one line the whole app splits on;
 * this is the general form, for the two questions the party room has to ask
 * that Tailwind cannot answer with a class:
 *
 * - **is this a television** — `(hover: none) and (min-width: 1280px)`. Width
 *   alone would call a 1440px laptop a television and take its chat away;
 *   `hover: none` alone would call a phone one. A large screen with no pointer
 *   is a set across a room, and that is a different room from a desk.
 * - **is this a phone** — the same `lg` line the rest of the app uses, asked
 *   directly because the answer decides whether a `<video>` element exists at
 *   all, and a `lg:hidden` player is still a player that has been created,
 *   handed a source and asked to buffer.
 *
 * ## `false` until it is known, deliberately
 *
 * The server has no viewport, so the first render has to guess, and the guess
 * shows before the effect corrects it. Every query returning `false` means the
 * first paint is the **desktop** form: a phone draws it for one frame, which
 * costs nothing because the player fetches nothing until intent, and a desktop
 * never draws anything else. Defaulting the other way — `isPhone = !wide`,
 * which is what "not the wide layout" reads as — inverts that, and every
 * desktop room would paint the phone layout first and then remount the player.
 *
 * The listener is `change` on the `MediaQueryList` rather than a `resize`
 * handler: the browser evaluates the query itself and calls back only when the
 * answer actually flips, so rotating a tablet costs one render rather than one
 * per frame of the rotation.
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const media = window.matchMedia(query);
    const update = () => setMatches(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, [query]);

  return matches;
}

/** A large screen with no pointer: a television across a room. */
export const TELEVISION = '(hover: none) and (min-width: 1280px)';

/**
 * Below the `lg` line every other part of the app splits on — expressed as a
 * `max-width` so it is the same boundary read from the other side, and in `rem`
 * so it follows the root size the television scales.
 */
export const COMPACT = '(max-width: 63.9375rem)';
