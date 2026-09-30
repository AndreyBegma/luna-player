/**
 * FEAT-20260923-647 — how subtitles look on this device: their size and what
 * sits behind them.
 *
 * A device preference like `luna:volume`, so not scoped per account: the
 * question it answers is "how far is the sofa from this screen", which is the
 * room's, not the viewer's. Syncing it per profile is a later increment of the
 * plan and needs the Atlas and the API.
 *
 * Two renderers read it — the browser's own `::cue` (`globals.css`) and
 * `learning-cue-layer.tsx` — so it is one store both subscribe to, rather than
 * a prop threaded through the player to each of them.
 */

import type { CSSProperties } from 'react';
import { TELEVISION } from '../platform/media-query';

export const SUBTITLE_SIZES = ['s', 'm', 'l', 'xl'] as const;
export const SUBTITLE_BACKGROUNDS = ['none', 'shadow', 'box'] as const;
export const SUBTITLE_POSITIONS = ['bottom', 'raised'] as const;

type SubtitleSize = (typeof SUBTITLE_SIZES)[number];
type SubtitleBackground = (typeof SUBTITLE_BACKGROUNDS)[number];
export type SubtitlePosition = (typeof SUBTITLE_POSITIONS)[number];

export interface SubtitleAppearance {
  size: SubtitleSize;
  background: SubtitleBackground;
  /** FEAT-20260923-647 increment 2 — bottom, or clear of the control bar. */
  position: SubtitlePosition;
}

const SUBTITLE_APPEARANCE_KEY = 'luna:subtitle-appearance';

/**
 * What each size multiplies the renderer's own size by. `m` is 1, so the
 * default off a television is exactly what the player drew before this.
 */
const SUBTITLE_SCALE: Record<SubtitleSize, number> = {
  s: 0.8,
  m: 1,
  l: 1.25,
  xl: 1.5,
};

/**
 * Read across a room, a television starts at the largest size; everything else
 * starts where the player always was. The shadow is today's look everywhere.
 */
export function defaultAppearance(television: boolean): SubtitleAppearance {
  return {
    size: television ? 'xl' : 'm',
    background: 'shadow',
    position: 'bottom',
  };
}

const CUE_TEXT_OUTLINE = [
  '0 1px 2px var(--color-ground)',
  '0 -1px 2px var(--color-ground)',
  '1px 0 2px var(--color-ground)',
  '-1px 0 2px var(--color-ground)',
].join(', ');

/**
 * FEAT-20260923-647 increment 3 — how a cue drawn as a DOM element, rather
 * than through `::cue`, takes the viewer's size and background. Shared by
 * `learning-cue-layer.tsx` and the `/settings` sample line: `::cue` cannot be
 * reused outside a `<video>`, so this is the one other place the choice has
 * to be recomputed, and it stays here so both draw it identically.
 */
export function cueTextStyle({
  size,
  background,
}: SubtitleAppearance): CSSProperties {
  const scale = SUBTITLE_SCALE[size];
  return {
    fontSize: `clamp(${scale}rem, ${2.4 * scale}vw, ${2 * scale}rem)`,
    lineHeight: 1.35,
    textShadow: background === 'shadow' ? CUE_TEXT_OUTLINE : undefined,
  };
}

/** The box, when the viewer chose one: the ground, behind the line only. */
export function cueBoxClassName({ background }: SubtitleAppearance): string {
  return background === 'box' ? 'rounded-control bg-ground/75 px-2' : '';
}

function isOneOf<T extends string>(
  values: readonly T[],
  value: unknown,
): value is T {
  return (
    typeof value === 'string' && (values as readonly string[]).includes(value)
  );
}

/**
 * The stored appearance over the device's default. Each field stands alone: a
 * value this build does not know — written by a newer one, or by hand — falls
 * back to the default for that field only.
 */
export function parseAppearance(
  raw: string | null,
  fallback: SubtitleAppearance,
): SubtitleAppearance {
  if (!raw) return fallback;
  let stored: unknown;
  try {
    stored = JSON.parse(raw);
  } catch {
    return fallback;
  }
  if (typeof stored !== 'object' || stored === null) return fallback;
  const { size, background, position } = stored as Record<string, unknown>;
  return {
    size: isOneOf(SUBTITLE_SIZES, size) ? size : fallback.size,
    background: isOneOf(SUBTITLE_BACKGROUNDS, background)
      ? background
      : fallback.background,
    position: isOneOf(SUBTITLE_POSITIONS, position)
      ? position
      : fallback.position,
  };
}

/** The value after `current`, wrapping: what one press on a menu row does. */
export function nextOf<T extends string>(values: readonly T[], current: T): T {
  return values[(values.indexOf(current) + 1) % values.length] as T;
}

/**
 * FEAT-20260923-647 increment 2 — where a raised cue sits: counted in lines
 * up from the bottom, the unit `snapToLines` gives a script, so the raise
 * grows with the cue's own line height rather than a pixel guess that would
 * go stale the moment the viewer picks a different size.
 *
 * BUG-20260924-687 — only the fallback now, for an engine that cannot lift
 * the cue container (see `cuePlacement`). Measured in Chromium, a line step
 * is about 6 % of the video's height while the bar is a fixed height, and
 * `-4` pins a cue's top, so a second line grows down into the bar: the cue's
 * bottom sat 54 px above the edge of a 390 × 220 phone picture, under a bar
 * several times that tall.
 */
const RAISED_LINE = -4;

/**
 * BUG-20260924-687 — the browser's box around every native cue. Chromium and
 * WebKit let page CSS style it, and a custom property set on the player
 * inherits into it, so `player-cues.css` lifts it by exactly the measured
 * height of the control bar: every cue keeps its own `auto` line and grows
 * upward from there, whatever its size or line count.
 */
const CUE_CONTAINER = 'video::-webkit-media-text-track-container';

/**
 * Whether this engine can lift the cue container. Samsung's Tizen browsers
 * (Chromium 94–108) can: `selector()` in `CSS.supports` is Chromium 83. An
 * engine that cannot even ask — or Firefox, which has no such box — gets the
 * line fallback.
 */
export function canLiftCueContainer(): boolean {
  return (
    typeof CSS !== 'undefined' &&
    typeof CSS.supports === 'function' &&
    CSS.supports(`selector(${CUE_CONTAINER})`)
  );
}

/**
 * How the viewer's position is carried out on this engine: by the container
 * attribute `player-cues.css` reads, or by the cues' own lines. Exactly one
 * of the two is ever "raised" — both at once would lift a cue twice.
 */
export function cuePlacement(
  position: SubtitlePosition,
  containerLiftable: boolean,
): { container: SubtitlePosition; lines: SubtitlePosition } {
  if (position === 'bottom') return { container: 'bottom', lines: 'bottom' };
  return containerLiftable
    ? { container: 'raised', lines: 'bottom' }
    : { container: 'bottom', lines: 'raised' };
}

/** What `use-subtitle-selection.ts` needs from a `VTTCue` to move it. */
interface PositionableCue {
  line: number | 'auto';
  snapToLines: boolean;
}

/**
 * Cues this module has raised, and what their `line` and `snapToLines` were
 * before — so "bottom" can give a cue back exactly what it had, rather than a
 * blanket `'auto'` that would also erase a line a sidecar file set on purpose.
 * Both, because a sidecar's `line:10%` is `snapToLines: false`, and giving
 * back the 10 without the `false` reads it as the tenth line from the top.
 * Keyed by object identity: a new track (a new episode, a different pick)
 * gets fresh `VTTCue` objects, and this module has never touched them.
 */
const raisedFrom = new WeakMap<PositionableCue, PositionableCue>();

/**
 * Moves every cue in `cues` to where the viewer's position setting puts it.
 * `bottom` never rewrites a cue it has not itself raised before — a cue file
 * that already sets its own `line` keeps it.
 */
export function applyCuePosition<T extends PositionableCue>(
  cues: ArrayLike<T>,
  position: SubtitlePosition,
): void {
  for (let i = 0; i < cues.length; i++) {
    const cue = cues[i];
    if (!cue) continue;
    if (position === 'raised') {
      if (!raisedFrom.has(cue)) {
        raisedFrom.set(cue, { line: cue.line, snapToLines: cue.snapToLines });
      }
      cue.line = RAISED_LINE;
      cue.snapToLines = true;
      continue;
    }
    const original = raisedFrom.get(cue);
    if (original === undefined) continue;
    cue.line = original.line;
    cue.snapToLines = original.snapToLines;
    raisedFrom.delete(cue);
  }
}

export interface SubtitleAppearanceStore {
  /** The same object until something changes: safe for `useSyncExternalStore`. */
  get: () => SubtitleAppearance;
  subscribe: (listener: () => void) => () => void;
  set: (next: SubtitleAppearance) => void;
}

interface StoreEnv {
  read: () => string | null;
  write: (value: string) => void;
  television: () => boolean;
}

/**
 * Read once, lazily — the first `get` is on the client, after hydration's
 * server snapshot — and written through on every change. A refused storage
 * (private mode, a full quota) leaves the choice in force for this page load,
 * which is all it could have had anyway.
 */
export function createSubtitleAppearanceStore(
  env: StoreEnv,
): SubtitleAppearanceStore {
  let state: SubtitleAppearance | null = null;
  const listeners = new Set<() => void>();

  return {
    get: () => {
      state ??= parseAppearance(
        env.read(),
        defaultAppearance(env.television()),
      );
      return state;
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    set: (next) => {
      state = next;
      env.write(JSON.stringify(next));
      for (const listener of listeners) listener();
    },
  };
}

export const subtitleAppearance = createSubtitleAppearanceStore({
  read: () => {
    try {
      return localStorage.getItem(SUBTITLE_APPEARANCE_KEY);
    } catch {
      return null;
    }
  },
  write: (value) => {
    try {
      localStorage.setItem(SUBTITLE_APPEARANCE_KEY, value);
    } catch {
      // Not worth failing a menu press over; see the store's note.
    }
  },
  television: () =>
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia(TELEVISION).matches,
});
