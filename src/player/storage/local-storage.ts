import type {
  PlayerPreference,
  PlayerScope,
  PlayerStorage,
} from './player-storage';

/**
 * FEAT-20260925-718 L2 — the default `PlayerStorage` (§9.1 of the feature
 * plan): `localStorage`, under a prefix the package owns.
 *
 * - Device preferences are one key each: `luna-player:volume`.
 * - Per-title and per-series choices carry the scope: `…:audio-track:<id>`
 *   for a title, `…:audio-track:series:<id>` for a series. A title wins over
 *   its series, as Luna's `watch-storage` keys do.
 * - `position` is per title only; with no `contentId` there is nowhere to
 *   keep it, so nothing is read or written.
 *
 * Every touch is behind a `try`: a browser that refuses site storage (a
 * private window, a full quota, a sandboxed frame) throws on access, and a
 * preference that cannot be remembered must never stop a film. Nothing is
 * read when this module loads — `localStorage` is reached for on the first
 * call — so importing it on a server is safe.
 *
 * `prefix` is also how an app keeps keys it already has: Luna's device keys
 * are exactly `localStoragePlayerStorage('luna:')`'s.
 */
export function localStoragePlayerStorage(
  prefix = 'luna-player:',
): PlayerStorage {
  const keyFor = (
    preference: PlayerPreference,
    scope: PlayerScope | undefined,
  ): string | null => {
    switch (preference) {
      case 'audio-track':
      case 'subtitle-track':
        if (scope?.contentId) return `${prefix}${preference}:${scope.contentId}`;
        if (scope?.seriesId)
          return `${prefix}${preference}:series:${scope.seriesId}`;
        return null;
      case 'position':
        return scope?.contentId
          ? `${prefix}${preference}:${scope.contentId}`
          : null;
      default:
        return `${prefix}${preference}`;
    }
  };

  return {
    get(preference, scope) {
      const key = keyFor(preference, scope);
      if (key === null) return null;
      try {
        return localStorage.getItem(key);
      } catch {
        return null;
      }
    },
    set(preference, value, scope) {
      const key = keyFor(preference, scope);
      if (key === null) return;
      try {
        localStorage.setItem(key, value);
      } catch {
        // Not remembered on this device; playback is unaffected.
      }
    },
    remove(preference, scope) {
      const key = keyFor(preference, scope);
      if (key === null) return;
      try {
        localStorage.removeItem(key);
      } catch {
        // Nothing to forget where nothing could be kept.
      }
    },
  };
}
