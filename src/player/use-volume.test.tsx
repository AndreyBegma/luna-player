/**
 * FEAT-20260923-661 (W-WEB-player-audio-subs Q-01, Q-06) — the element is the
 * authority and the mirror follows it: the saved level on at mount, the
 * slider unmuting, and the mute button reading what it just did.
 */
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  test,
} from 'bun:test';
import { registerDom, unregisterDom } from '../test-dom-shim';
import { act, createRef, type RefObject } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { VOLUME_STORAGE_KEY } from '../logic/saved-volume';
import { stubGlobal } from '../test-stub-global';
import { localStoragePlayerStorage } from './storage/local-storage';
import type { PlayerStorage } from './storage/player-storage';
import { useVolume } from './use-volume';

let container: HTMLDivElement;
let root: Root | null = null;

beforeAll(() => {
  registerDom();
  (
    globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
});

afterAll(() => {
  unregisterDom();
});

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  act(() => root?.unmount());
  root = null;
  container?.remove();
});

/**
 * FEAT-20260925-718 L2 — Luna's own keys, through the package's adapter, so
 * every assertion below on `VOLUME_STORAGE_KEY` holds as it did before the
 * seam.
 */
const lunaStorage = localStoragePlayerStorage('luna:');

/** Only what the hook touches; no `volumechange` fires, so the mirror is the hook's own. */
function mount(storage: PlayerStorage | null = lunaStorage) {
  const videoRef =
    createRef<HTMLVideoElement>() as RefObject<HTMLVideoElement | null>;
  videoRef.current = { volume: 1, muted: false } as HTMLVideoElement;
  let latest: ReturnType<typeof useVolume> | null = null;

  function Harness() {
    latest = useVolume({ videoRef, storage });
    return null;
  }

  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => root?.render(<Harness />));
  return {
    element: videoRef.current,
    volume: () => {
      if (!latest) throw new Error('not rendered');
      return latest;
    },
  };
}

describe('useVolume', () => {
  test('the saved level is put on the element at mount', () => {
    localStorage.setItem(VOLUME_STORAGE_KEY, '0.4');
    const { element } = mount();
    expect(element.volume).toBe(0.4);
  });

  test('mute reads what the element is now, before its volumechange', () => {
    const { element, volume } = mount();
    act(() => volume().toggleMute());
    expect(element.muted).toBe(true);
    expect(volume().muted).toBe(true);
    act(() => volume().toggleMute());
    expect(element.muted).toBe(false);
    expect(volume().muted).toBe(false);
  });

  test('the slider sets a level and unmutes', () => {
    const { element, volume } = mount();
    element.muted = true;
    act(() => volume().setElementVolume(0.3));
    expect([element.volume, element.muted]).toEqual([0.3, false]);
  });

  test('a change on the element is mirrored and remembered', () => {
    const { element, volume } = mount();
    element.volume = 0.6;
    act(() => volume().onVolumeChange());
    expect(volume().volume).toBe(0.6);
    expect(localStorage.getItem(VOLUME_STORAGE_KEY)).toBe('0.6');
  });
});

describe('the storage seam (FEAT-20260925-718)', () => {
  test('null storage puts nothing on the element and keeps nothing', () => {
    localStorage.setItem(VOLUME_STORAGE_KEY, '0.4');
    const { element, volume } = mount(null);
    expect(element.volume).toBe(1);
    element.volume = 0.6;
    act(() => volume().onVolumeChange());
    expect(volume().volume).toBe(0.6);
    expect(localStorage.getItem(VOLUME_STORAGE_KEY)).toBe('0.4');
  });

  test('reads and writes through the adapter it is given', () => {
    const kept = new Map<string, string>([['volume', '0.25']]);
    const storage: PlayerStorage = {
      get: (key) => kept.get(key) ?? null,
      set: (key, value) => {
        kept.set(key, value);
      },
      remove: (key) => {
        kept.delete(key);
      },
    };
    const { element, volume } = mount(storage);
    expect(element.volume).toBe(0.25);
    element.volume = 0.7;
    act(() => volume().onVolumeChange());
    expect(kept.get('volume')).toBe('0.7');
  });

  test('a localStorage that throws does not throw out of the hook', () => {
    const restore = stubGlobal('localStorage', {
      getItem() {
        throw new Error('SecurityError');
      },
      setItem() {
        throw new Error('QuotaExceededError');
      },
    });
    try {
      const { element, volume } = mount(localStoragePlayerStorage());
      expect(element.volume).toBe(1);
      element.volume = 0.5;
      act(() => volume().onVolumeChange());
      expect(volume().volume).toBe(0.5);
    } finally {
      restore();
    }
  });
});
