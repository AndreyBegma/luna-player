/**
 * FEAT-20260925-718 S4 — a server that restarts the stream at a position
 * instead of letting the element seek it (Luna's transcode and remux).
 *
 * The URL protocol is the consumer's, not the player's: Luna's `?t=&audio=`
 * builder lives in `luna/source-url.ts` and arrives here through this seam.
 * With no `ServerSeek` at all, nothing restarts on the server and every seek
 * goes to the element.
 */
export interface ServerSeek {
  /** The URL that starts `base` at `time`, on audio track `audio` when one was chosen. */
  buildUrl(base: string, at: { time: number; audio?: number }): string;
  /**
   * Only the fallback restarts on the server; the primary `src` is a direct
   * file the element seeks itself. Luna's series episode that needs neither
   * remux nor transcode is exactly this: it plays the direct stream and falls
   * back to the transcode, and only the second takes its position in the URL.
   */
  fallbackOnly?: boolean;
}

/**
 * Does moving through the URL the element is playing restart the stream on
 * the server? The fallback always does once it has been taken; the primary
 * `src` does unless the seam says it is fallback-only.
 */
export function restartsOnServer(
  serverSeek: ServerSeek | undefined,
  usingFallback: boolean,
): serverSeek is ServerSeek {
  return !!serverSeek && (!serverSeek.fallbackOnly || usingFallback);
}

/** The URL the element is playing from — the fallback, once it has been taken. */
export function activeBaseUrl(
  src: string,
  fallbackSrc: string | undefined,
  usingFallback: boolean,
): string {
  return usingFallback && fallbackSrc ? fallbackSrc : src;
}
