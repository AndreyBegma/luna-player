/**
 * FEAT-20260925-718 L2 — the default `PlayerStorage`: one key per device
 * preference under the prefix, the scope in the key for per-title and
 * per-series choices, and a browser that refuses storage costing nothing but
 * the memory.
 */
import { afterEach, describe, expect, test } from 'bun:test';
import { stubGlobal } from '../../test-stub-global';
import { localStoragePlayerStorage } from './local-storage';

afterEach(() => {
  localStorage.clear();
});

describe('localStoragePlayerStorage', () => {
  test('a device preference is one key under the package prefix', () => {
    const storage = localStoragePlayerStorage();
    storage.set('volume', '0.4');
    expect(localStorage.getItem('luna-player:volume')).toBe('0.4');
    expect(storage.get('volume')).toBe('0.4');
    storage.remove('volume');
    expect(localStorage.getItem('luna-player:volume')).toBeNull();
  });

  test('a prefix reproduces keys an app already has', () => {
    localStoragePlayerStorage('luna:').set('speed', '1.5');
    expect(localStorage.getItem('luna:speed')).toBe('1.5');
  });

  test('a track choice is kept per title, then per series', () => {
    const storage = localStoragePlayerStorage();
    storage.set('audio-track', '2', { contentId: 'e1', seriesId: 's1' });
    storage.set('audio-track', '1', { seriesId: 's1' });
    expect(localStorage.getItem('luna-player:audio-track:e1')).toBe('2');
    expect(localStorage.getItem('luna-player:audio-track:series:s1')).toBe('1');
    expect(storage.get('audio-track', { contentId: 'e1' })).toBe('2');
    expect(storage.get('audio-track', { contentId: 'e2' })).toBeNull();
    expect(storage.get('subtitle-track', { seriesId: 's1' })).toBeNull();
  });

  test('a scoped choice with no scope is neither read nor written', () => {
    const storage = localStoragePlayerStorage();
    storage.set('subtitle-track', '0');
    storage.set('position', '120', { seriesId: 's1' });
    expect(localStorage.length).toBe(0);
    expect(storage.get('position')).toBeNull();
  });

  test('a position is kept per title', () => {
    const storage = localStoragePlayerStorage();
    storage.set('position', '120', { contentId: 'm1', contentType: 'movie' });
    expect(localStorage.getItem('luna-player:position:m1')).toBe('120');
    storage.remove('position', { contentId: 'm1' });
    expect(storage.get('position', { contentId: 'm1' })).toBeNull();
  });

  test('a browser that refuses storage throws nothing out of it', () => {
    const refusing = {
      getItem() {
        throw new Error('SecurityError');
      },
      setItem() {
        throw new Error('QuotaExceededError');
      },
      removeItem() {
        throw new Error('SecurityError');
      },
    };
    const restore = stubGlobal('localStorage', refusing);
    try {
      const storage = localStoragePlayerStorage();
      expect(() => storage.set('volume', '0.5')).not.toThrow();
      expect(storage.get('volume')).toBeNull();
      expect(() => storage.remove('volume')).not.toThrow();
    } finally {
      restore();
    }
  });

  test('creating one reads nothing', () => {
    const restore = stubGlobal('localStorage', undefined);
    try {
      expect(() => localStoragePlayerStorage()).not.toThrow();
    } finally {
      restore();
    }
  });
});
