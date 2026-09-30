/**
 * FEAT-20260821-264 — resolving a language-based default audio track.
 *
 * Source files and provider streams tag tracks inconsistently: sometimes a
 * clean 2-letter code (`uk`), sometimes ISO 639-2 (`ukr`), sometimes only a
 * `name` like `rus0` with the code and a running index glued together (the
 * pattern BUG-20260819-207 already parses for display labels). This is the
 * same extraction, factored out so language *matching* and language *display*
 * never drift into two different ideas of what a track's code is.
 */

interface LanguageTaggedTrack {
  name?: string | null;
  lang?: string | null;
  language?: string | null;
}

const ALPHA3_TO_APP_LOCALE: Record<string, string> = {
  ukr: 'uk',
  rus: 'ru',
  eng: 'en',
};

/** Extracts a track's language code and normalizes it to the app's uk/ru/en set where possible. */
export function resolveTrackLanguageCode(track: LanguageTaggedTrack): string | null {
  const raw =
    (track.name ?? '').match(/^([a-z]{2,3})\d*$/i)?.[1] ??
    track.lang ??
    track.language ??
    null;
  if (!raw) return null;
  const lower = raw.toLowerCase();
  return ALPHA3_TO_APP_LOCALE[lower] ?? lower;
}

/**
 * The first track whose resolved language matches, in order, one of
 * `preferredCodes`. `null` means none of them are present — the caller must
 * leave the existing selection alone rather than guess.
 */
export function pickDefaultTrackIndex(
  tracks: LanguageTaggedTrack[],
  preferredCodes: string[],
): number | null {
  for (const code of preferredCodes) {
    const index = tracks.findIndex(
      (track) => resolveTrackLanguageCode(track) === code,
    );
    if (index !== -1) return index;
  }
  return null;
}

/** Account locale first, then the app's fixed uk → ru → en fallback, deduplicated. */
export function buildPreferredLanguageChain(accountLocale: string): string[] {
  return [...new Set([accountLocale, 'uk', 'ru', 'en'])];
}
