/**
 * FEAT-20260925-718 L2 — the slice of hls.js the player drives, as a
 * structural type the package owns.
 *
 * hls.js is an optional peer: a consumer that never plays HLS does not
 * install it, so no emitted `.d.ts` may name it — a declaration that does
 * fails that consumer's typecheck with "cannot find module". Instead the
 * player is handed a loader (`HlsLoader`), usually `() => import('hls.js')`,
 * and talks to whatever it resolves through these shapes.
 *
 * Only what `use-hls-engine.ts` and the source refs touch is listed; the real
 * library is assignable to every one of them, which `use-hls-engine.test.tsx`
 * proves against the installed hls.js at compile time.
 */

/** One rendition in the manifest. */
export interface HlsLevelLike {
  height: number;
}

/** One audio alternate in the manifest, as `audioTrackLabels` reads it. */
export interface HlsAudioTrackLike {
  name?: string;
  lang?: string;
}

/** `AUDIO_TRACKS_UPDATED`'s payload. */
export interface HlsAudioTracksUpdatedLike {
  audioTracks: HlsAudioTrackLike[];
}

/** `LEVEL_SWITCHED`'s payload. */
export interface HlsLevelSwitchedLike {
  level: number;
}

/** `ERROR`'s payload: only the fields the recovery reads. */
export interface HlsErrorDataLike {
  fatal: boolean;
  type: string;
  response?: { code: number };
}

/**
 * A retry rule inside a load policy. hls.js's own also carries an optional
 * `shouldRetry` callback; leaving it out keeps this assignable both ways —
 * read from `DefaultConfig`, and handed back to the constructor.
 */
export interface HlsRetryLike {
  maxNumRetry: number;
  retryDelayMs: number;
  maxRetryDelayMs: number;
  backoff?: 'exponential' | 'linear';
}

/** A fragment loader's timing policy (`fragLoadPolicy.default`). */
export interface HlsLoaderTimingLike {
  maxTimeToFirstByteMs: number;
  maxLoadTimeMs: number;
  timeoutRetry: HlsRetryLike | null;
  errorRetry: HlsRetryLike | null;
}

export interface HlsLoadPolicyLike {
  default: HlsLoaderTimingLike;
}

/** The constructor options the engine passes. */
export interface HlsConfigLike {
  maxBufferLength: number;
  maxMaxBufferLength: number;
  maxBufferSize: number;
  startLevel: number;
  startPosition: number;
  enableWorker: boolean;
  fragLoadPolicy?: HlsLoadPolicyLike;
}

/**
 * An event listener whose payload the listener itself types
 * (`HlsErrorDataLike`, …). Declared through a method so its parameters are
 * compared bivariantly: hls.js's `on` hands each event its own payload type,
 * and no single payload type here could be assignable to all of them.
 */
type HlsListenerLike = {
  bivarianceHack(event: string, data: unknown): void;
}['bivarianceHack'];

/** An attached hls.js instance. */
export interface HlsLike {
  readonly levels: readonly HlsLevelLike[];
  readonly audioTracks: readonly HlsAudioTrackLike[];
  audioTrack: number;
  currentLevel: number;
  loadSource(url: string): void;
  attachMedia(media: HTMLMediaElement): void;
  startLoad(): void;
  recoverMediaError(): void;
  destroy(): void;
  on(event: string, listener: HlsListenerLike): void;
}

/** The hls.js default export: the class and its statics. */
export interface HlsConstructorLike {
  new (config: HlsConfigLike): HlsLike;
  isSupported(): boolean;
  readonly DefaultConfig: { fragLoadPolicy: HlsLoadPolicyLike };
  readonly Events: {
    readonly MANIFEST_PARSED: string;
    readonly AUDIO_TRACKS_UPDATED: string;
    readonly LEVEL_SWITCHED: string;
    readonly ERROR: string;
    readonly FRAG_BUFFERED: string;
  };
  readonly ErrorTypes: {
    readonly NETWORK_ERROR: string;
    readonly MEDIA_ERROR: string;
  };
}

/**
 * Where hls.js comes from: `() => import('hls.js')` in an app that has it.
 * Absent, an `hlsSrc` is treated as unplayable by script and the element is
 * given `src` instead.
 */
export type HlsLoader = () => Promise<{ default: HlsConstructorLike }>;
