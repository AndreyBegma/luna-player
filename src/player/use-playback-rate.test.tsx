/**
 * FEAT-20260923-661 Q-02 — the playback rate, remembered per device: a stored
 * rung comes back onto the element, and a browser that refuses storage still
 * plays and still changes speed, it just does not remember.
 */
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  test,
} from 'bun:test';
import { registerDom, unregisterDom } from '../test-dom-shim';
import { act, createRef, type RefObject } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { localStoragePlayerStorage } from './storage/local-storage';
import type { PlayerStorage } from './storage/player-storage';
import { usePlaybackRate } from './use-playback-rate';

type Rate = ReturnType<typeof usePlaybackRate>;

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

afterEach(() => {
  act(() => root?.unmount());
  root = null;
  container?.remove();
  localStorage.removeItem('luna:speed');
});

/**
 * FEAT-20260925-718 L2 — Luna's own keys, through the package's adapter, so
 * every assertion below on `luna:speed` holds as it did before the seam.
 */
const lunaStorage = localStoragePlayerStorage('luna:');

function mount(
  storage: PlayerStorage | null = lunaStorage,
  rates?: readonly number[],
) {
  const videoRef =
    createRef<HTMLVideoElement>() as RefObject<HTMLVideoElement | null>;
  videoRef.current = { playbackRate: 1 } as unknown as HTMLVideoElement;
  const latest: { current: Rate | null } = { current: null };

  function Harness() {
    latest.current = usePlaybackRate({ videoRef, storage, rates });
    return null;
  }

  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => root?.render(<Harness />));
  return { videoRef, latest };
}

/** What a browser with site storage blocked does: touching it throws. */
function refuseStorage(): () => void {
  const own = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    get: () => {
      throw new DOMException('The operation is insecure.', 'SecurityError');
    },
  });
  return () => {
    if (own) Object.defineProperty(globalThis, 'localStorage', own);
  };
}

describe('usePlaybackRate', () => {
  test('comes back on the stored rung and puts it on the element', () => {
    localStorage.setItem('luna:speed', '1.5');
    const { videoRef, latest } = mount();
    expect(latest.current?.rate).toBe(1.5);
    act(() => latest.current?.restore());
    expect(videoRef.current?.playbackRate).toBe(1.5);
  });

  test('remembers a step', () => {
    const { videoRef, latest } = mount();
    let landed = 0;
    act(() => {
      landed = latest.current?.step(1) ?? 0;
    });
    expect(landed).toBe(1.25);
    expect(videoRef.current?.playbackRate).toBe(1.25);
    expect(localStorage.getItem('luna:speed')).toBe('1.25');
  });

  test('mounts at 1× and still changes speed when storage is refused', () => {
    const restore = refuseStorage();
    try {
      const { videoRef, latest } = mount();
      expect(latest.current?.rate).toBe(1);
      act(() => {
        latest.current?.step(1);
      });
      expect(latest.current?.rate).toBe(1.25);
      expect(videoRef.current?.playbackRate).toBe(1.25);
    } finally {
      restore();
    }
  });
});

describe('the storage and rates seams (FEAT-20260925-718)', () => {
  test('null storage reads nothing and keeps nothing', () => {
    localStorage.setItem('luna:speed', '1.5');
    const { latest } = mount(null);
    expect(latest.current?.rate).toBe(1);
    act(() => {
      latest.current?.step(1);
    });
    expect(latest.current?.rate).toBe(1.25);
    expect(localStorage.getItem('luna:speed')).toBe('1.5');
  });

  test('reads and writes through the adapter it is given', () => {
    const kept = new Map<string, string>();
    const storage: PlayerStorage = {
      get: (key) => kept.get(key) ?? null,
      set: (key, value) => {
        kept.set(key, value);
      },
      remove: (key) => {
        kept.delete(key);
      },
    };
    kept.set('speed', '0.75');
    const { latest } = mount(storage);
    expect(latest.current?.rate).toBe(0.75);
    act(() => latest.current?.cycle());
    expect(kept.get('speed')).toBe('1');
    expect(localStorage.getItem('luna:speed')).toBeNull();
  });

  test('an adapter that throws does not throw out of the hook', () => {
    const throwing: PlayerStorage = {
      get: () => {
        throw new Error('refused');
      },
      set: () => {
        throw new Error('refused');
      },
      remove: () => {
        throw new Error('refused');
      },
    };
    const { latest } = mount(throwing);
    expect(latest.current?.rate).toBe(1);
    act(() => latest.current?.cycle());
    expect(latest.current?.rate).toBe(1.25);
  });

  test('cycles and steps along the rates it is given', () => {
    const { latest } = mount(null, [0.6, 1, 1.5]);
    act(() => latest.current?.cycle());
    expect(latest.current?.rate).toBe(1.5);
    act(() => latest.current?.cycle());
    expect(latest.current?.rate).toBe(0.6);
    act(() => {
      latest.current?.step(-1);
    });
    expect(latest.current?.rate).toBe(0.6);
  });
});
