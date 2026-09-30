/**
 * FEAT-20260923-654 — where the sound modes are offered. Every condition is a way
 * the film could go silent, so each one is shown to close the gate alone.
 */
import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { TELEVISION } from '../platform/media-query';
import { registerDom, unregisterDom } from '../test-dom-shim';
import {
  readSoundEnvironment,
  type SoundEnvironment,
  savedSoundModes,
  soundModesOffered,
} from './sound-mode';

const chromeOnMse: SoundEnvironment = {
  hasAudioContext: true,
  vendor: 'Google Inc.',
  userAgent:
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Safari/537.36',
  television: false,
  currentSrc: 'blob:https://watch.luna-realm.com/5f0c1d9e',
};

describe('soundModesOffered', () => {
  test('Chrome playing through hls.js', () => {
    expect(soundModesOffered(chromeOnMse)).toBe(true);
  });

  test('Firefox, which reports no vendor', () => {
    expect(soundModesOffered({ ...chromeOnMse, vendor: '' })).toBe(true);
  });

  test('not a cross-origin URL on the element: a library film played directly', () => {
    expect(
      soundModesOffered({
        ...chromeOnMse,
        currentSrc: 'https://watch-api.luna-realm.com/movies/1/stream?sig=abc',
      }),
    ).toBe(false);
  });

  test('not before anything is attached', () => {
    expect(soundModesOffered({ ...chromeOnMse, currentSrc: '' })).toBe(false);
  });

  test('not without Web Audio', () => {
    expect(soundModesOffered({ ...chromeOnMse, hasAudioContext: false })).toBe(
      false,
    );
  });

  test('not on WebKit — Safari, and every browser on iOS', () => {
    expect(
      soundModesOffered({ ...chromeOnMse, vendor: 'Apple Computer, Inc.' }),
    ).toBe(false);
  });

  test('not on a television by its shape', () => {
    expect(soundModesOffered({ ...chromeOnMse, television: true })).toBe(false);
  });

  test('not on a television by its browser', () => {
    for (const userAgent of [
      'Mozilla/5.0 (SMART-TV; LINUX; Tizen 7.0) AppleWebKit/537.36 (KHTML, like Gecko) 94.0.4606.31/7.0 TV Safari/537.36',
      'Mozilla/5.0 (Web0S; Linux/SmartTV) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/87.0.4280.88 Safari/537.36',
    ]) {
      expect(soundModesOffered({ ...chromeOnMse, userAgent })).toBe(false);
    }
  });
});

describe('savedSoundModes', () => {
  test('nothing stored', () => {
    expect(savedSoundModes(null)).toBeNull();
    expect(savedSoundModes('')).toBeNull();
  });

  test('not JSON', () => {
    expect(savedSoundModes('not json')).toBeNull();
  });

  test('JSON that is not an object', () => {
    expect(savedSoundModes('"night"')).toBeNull();
    expect(savedSoundModes('42')).toBeNull();
    expect(savedSoundModes('null')).toBeNull();
  });

  test('a field missing or the wrong type is not a choice worth applying', () => {
    expect(savedSoundModes(JSON.stringify({ night: true }))).toBeNull();
    expect(
      savedSoundModes(JSON.stringify({ night: 'true', dialogue: false })),
    ).toBeNull();
  });

  test('a valid choice, either way', () => {
    expect(
      savedSoundModes(JSON.stringify({ night: true, dialogue: false })),
    ).toEqual({ night: true, dialogue: false });
    expect(
      savedSoundModes(JSON.stringify({ night: false, dialogue: true })),
    ).toEqual({ night: false, dialogue: true });
  });
});

describe('readSoundEnvironment', () => {
  beforeAll(() => {
    registerDom();
  });

  afterAll(() => {
    unregisterDom();
  });

  test('asks the one television query the rest of the app asks', () => {
    const asked: string[] = [];
    const matchMedia = window.matchMedia;
    window.matchMedia = ((query: string) => {
      asked.push(query);
      return { matches: query === TELEVISION } as MediaQueryList;
    }) as typeof window.matchMedia;
    try {
      const video = { currentSrc: 'blob:x' } as HTMLVideoElement;
      const env = readSoundEnvironment(video);
      expect(asked).toEqual([TELEVISION]);
      expect(env.television).toBe(true);
      expect(env.currentSrc).toBe('blob:x');
    } finally {
      window.matchMedia = matchMedia;
    }
  });
});
