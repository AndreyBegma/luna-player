/**
 * FEAT-20260925-718 L2 — the slice of luna-watch's `video-player-props.ts`
 * the lifted hooks read, and the seams' own types, in the place §7.1 of the
 * feature plan puts `types.ts`. Names follow §9.2.
 *
 * Internal until the `<Player>` slice: nothing here is in `exports` yet, and
 * that slice grows `PlayerProps` / `PlayerHandle` around these.
 */

import type { PlayerLabels } from '../labels/types';
import type { HlsLoader } from './hls-types';
import type { PlayerStorage } from './storage/player-storage';

export type { HlsConstructorLike, HlsLike, HlsLoader } from './hls-types';
export type {
  PlayerPreference,
  PlayerScope,
  PlayerStorage,
} from './storage/player-storage';

/**
 * BUG-20260918-617 — how patient hls.js is with a slow first byte, and how
 * far ahead it buffers. Absent, hls.js keeps its own defaults.
 */
export interface HlsLoading {
  firstByteTimeoutMs: number;
  forwardBufferSeconds: number;
}

/**
 * An episode next to the one playing, as the page names it. FEAT-20260919-620
 * — `stillUrl` is what the end screen shows beside "Play next"; local
 * episodes carry one, the online providers' do not, and the screen falls back
 * to the poster.
 */
export interface EpisodeRef {
  id: string;
  title: string;
  stillUrl?: string | null;
  /** The series' name and the episode's place in it, for "Breaking Bad · S1 · E2" over the title. */
  series?: string;
  season?: number;
  episode?: number;
}

/**
 * FEAT-20260925-718 L3 — the frame's shape: one of the three a host names,
 * or any `w/h` a CSS `aspect-ratio` takes.
 */
export type PlayerAspectRatio = '16:9' | '9:16' | '1:1' | `${number}/${number}`;

/**
 * FEAT-20260925-718 L3 — why the player gave up: the element erred with no
 * fallback left, or hls.js stayed fatal after its own recovery attempts.
 */
export interface PlayerError {
  kind: 'playback';
}

/** FEAT-20260925-718 L3 — the first `<Player>`'s props: a subset of §9.2. */
export interface PlayerProps {
  /** A progressive source (MP4, WebM), over HTTP Range. */
  src: string;
  /** Tried once when the element refuses `src`. */
  fallbackSrc?: string;
  /**
   * A manifest, driven by hls.js only with `loadHls` (or natively, where the
   * engine plays HLS itself).
   */
  hlsSrc?: string;
  /** Where hls.js comes from: pass `loadHls` from `luna-player/hls`. */
  loadHls?: HlsLoader;
  hlsLoading?: HlsLoading;
  poster?: string;
  /** The idle play button's accessible name; "Play" when absent. */
  title?: string;
  /** The frame's shape; `'16:9'` when absent. */
  aspectRatio?: PlayerAspectRatio;
  /** Called once per source, when playback fails for good. */
  onError?(error: PlayerError): void;
  /** Start on mount. A `play()` the browser refuses is not an error. */
  autoPlay?: boolean;
  /** For audio-track names; `'en'` when absent. */
  locale?: string;
  /** Merged over the built-in English. */
  labels?: Partial<PlayerLabels>;
  /**
   * Where volume and speed are kept: `localStoragePlayerStorage('luna-player:')`
   * when absent, nowhere with `null`.
   */
  storage?: PlayerStorage | null;
  /** The `<video>` itself, when it mounts, and `null` when it goes. */
  onVideoElement?(element: HTMLVideoElement | null): void;
  /** On the frame's wrapper. */
  className?: string;
}

/** FEAT-20260925-718 L3 — what a `ref` on `<Player>` reaches: a subset of §9.2. */
export interface PlayerHandle {
  play(): void;
  pause(): void;
  seekTo(seconds: number): void;
  /** The playhead, in seconds. */
  getTime(): number;
  /** Start playback and fill the screen, as luna-watch's Watch button does. */
  startFullscreen(): void;
}
