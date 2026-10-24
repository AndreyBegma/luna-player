/**
 * FEAT-20260925-718 L2 — the slice of luna-watch's `video-player-props.ts`
 * the lifted hooks read, and the seams' own types, in the place §7.1 of the
 * feature plan puts `types.ts`. Names follow §9.2.
 *
 * Internal until the `<Player>` slice: nothing here is in `exports` yet, and
 * that slice grows `PlayerProps` / `PlayerHandle` around these.
 */

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
