/**
 * FEAT-20260923-633 — the volume this device comes back on.
 *
 * A device preference like `luna:speed`, so not scoped per account. The
 * level only: mute is not remembered, and neither is silence — a film that
 * starts with no sound and no mute icon on the bar reads as broken playback,
 * which on a television nobody can diagnose.
 */

export const VOLUME_STORAGE_KEY = 'luna:volume';

/** The stored level, or `null` when there is none worth applying. */
export function savedVolume(raw: string | null): number | null {
  if (raw === null || raw.trim() === '') return null;
  const level = Number(raw);
  return Number.isFinite(level) && level > 0 && level <= 1 ? level : null;
}
