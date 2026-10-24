/**
 * FEAT-20260925-718 S3 — `AudioTrack` and `SubtitleTrack`, owned by core
 * instead of the app's `@/lib/api`.
 *
 * Structurally identical to `lib/api/media.ts`'s `AudioTrack` and
 * `lib/api/online.ts`'s `SubtitleTrack` today, so a value built from either
 * side of the seam stays assignable to the other without a cast. This is a
 * first piece of `luna-player`'s eventual `types.ts` (§7.1 of the feature
 * plan); S5 grows the rest of the public surface (`PlayerProps`,
 * `PlayerHandle`, …) around it.
 *
 * `use-hls-engine.ts`, `video-element.tsx`, `control-bar.tsx`,
 * `audio-track-menu.tsx` and `video-player-props.ts` still import these from
 * `@/lib/api` — that swap is a later slot's (S3's fence does not reach those
 * files); structural typing keeps both sides assignable in the meantime.
 */

export interface AudioTrack {
  index: number;
  language: string | null;
  title: string | null;
  channels: number;
}

export interface SubtitleTrack {
  url: string;
  /** The provider's own name, the last-resort label. */
  name: string;
  language: string | null;
  kind: 'full' | 'forced' | 'sdh';
  generated: boolean;
}

/**
 * FEAT-20260925-718 L2 — moved here from `quality-menu.tsx`, which is not
 * lifted with the hooks, so `use-hls-engine.ts` can name it.
 */
export interface QualityLevel {
  /** hls.js level index; -1 means automatic bitrate selection. */
  index: number;
  height: number;
}
