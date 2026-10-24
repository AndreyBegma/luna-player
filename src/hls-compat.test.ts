/**
 * FEAT-20260925-718 L2 — the player names hls.js only through its own
 * structural types (`player/hls-types.ts`), so nothing would notice if the
 * library moved away from them. This file does: it is outside `src/player/`
 * (whose fence bans the specifier) and is the one place the real module is
 * handed to an `HlsLoader`.
 *
 * The assignment is the test — it fails `bun run typecheck` if the installed
 * hls.js stops fitting the shapes. The runtime checks keep the statics the
 * engine reads at the names it reads them.
 */
import { describe, expect, test } from 'bun:test';
import type { HlsLoader } from './player/hls-types';

const loadHls: HlsLoader = () => import('hls.js');

describe('the installed hls.js fits the player’s HlsLoader', () => {
  test('the statics the engine reads are there', async () => {
    const { default: Hls } = await loadHls();
    expect(typeof Hls.isSupported).toBe('function');
    expect(Hls.DefaultConfig.fragLoadPolicy.default.maxLoadTimeMs).toBeGreaterThan(0);
    for (const name of [
      'MANIFEST_PARSED',
      'AUDIO_TRACKS_UPDATED',
      'LEVEL_SWITCHED',
      'ERROR',
      'FRAG_BUFFERED',
    ] as const) {
      expect(typeof Hls.Events[name]).toBe('string');
    }
    expect(typeof Hls.ErrorTypes.NETWORK_ERROR).toBe('string');
    expect(typeof Hls.ErrorTypes.MEDIA_ERROR).toBe('string');
  });
});
