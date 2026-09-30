import { resolveTrackLanguageCode } from '../platform/audio-track-language';

/**
 * BUG-20260819-207 — provider audio tracks are named `rus0`, `eng1`, `ukr4`:
 * a language code with a running index. Shown raw they are barely readable.
 *
 * The code becomes a language name in the interface's own language, and the
 * number is dropped unless that language appears more than once — several
 * English dubs need telling apart, a single Russian one does not. Numbering
 * restarts per language, so the provider's global index never leaks through as
 * a confusing "Russian 1, English 2".
 */
export function audioTrackLabels(
  tracks: { name?: string; lang?: string }[],
  locale: string,
): string[] {
  const naming = (() => {
    try {
      return new Intl.DisplayNames([locale], { type: 'language' });
    } catch {
      return null;
    }
  })();

  const named = tracks.map((track, index) => {
    const code = resolveTrackLanguageCode(track);
    if (!code) return { label: track.name || `${index + 1}`, code: null };
    let readable = code;
    try {
      readable = naming?.of(code) ?? code;
    } catch {
      // Unknown or malformed code — the raw one still beats nothing.
    }
    return {
      label: readable.charAt(0).toUpperCase() + readable.slice(1),
      code,
    };
  });

  const seen = new Map<string, number>();
  return named.map(({ label, code }) => {
    if (!code) return label;
    const duplicated = named.filter((t) => t.code === code).length > 1;
    if (!duplicated) return label;
    const n = (seen.get(code) ?? 0) + 1;
    seen.set(code, n);
    return `${label} ${n}`;
  });
}
