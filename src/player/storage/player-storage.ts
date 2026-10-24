/**
 * FEAT-20260925-718 S3 — where player preferences live, so core never reaches
 * for `@/lib/watch-storage` or a bare `luna:*` `localStorage` key itself.
 *
 * §9.2 of the feature plan names this interface as part of `luna-player`'s
 * public surface; this is its first home, inside `luna-watch`, before the
 * lift. `components/player/luna/storage.ts` is the one implementation today —
 * Luna's, reproducing every key exactly as §9.4 lists it. A `localStorage`
 * default under a package-owned prefix is P1's job, once there is a second
 * consumer to default for.
 */

/** Per-title and per-series choices: today's per-content and per-series
 *  `watch-storage` keys. `contentType` is only read for `'position'`, whose
 *  key embeds it (`luna:${scope}:progress:${contentType}:${contentId}`). */
export interface PlayerScope {
  contentId?: string;
  contentType?: 'movie' | 'episode';
  seriesId?: string;
}

export type PlayerPreference =
  | 'volume'
  | 'speed'
  | 'video-fit'
  | 'clock'
  | 'sound-mode'
  | 'subtitle-appearance'
  | 'audio-track'
  | 'subtitle-track'
  | 'position';

export interface PlayerStorage {
  get(key: PlayerPreference, scope?: PlayerScope): string | null;
  set(key: PlayerPreference, value: string, scope?: PlayerScope): void;
  remove(key: PlayerPreference, scope?: PlayerScope): void;
}
