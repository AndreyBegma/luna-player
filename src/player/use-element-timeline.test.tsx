/**
 * FEAT-20260923-661 (W-WEB-player-engine) — the position the timeline keeps
 * on the device for the next visit.
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
import { act, createRef, type RefObject } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { registerDom, unregisterDom } from '../test-dom-shim';
import { stubGlobal } from '../test-stub-global';
import { DroppingVideo } from './dropping-video';
import { createPlayheadStore } from './playhead-store';
import { type SourceRefs, useSourceRefs } from './source-refs';
import { localStoragePlayerStorage } from './storage/local-storage';
import type { PlayerStorage } from './storage/player-storage';
import { useElementTimeline } from './use-element-timeline';

const DURATION = 7200;

let container: HTMLDivElement;
let root: Root | null = null;
let timeline: ReturnType<typeof useElementTimeline>;
let video: {
  currentTime: number;
  duration: number;
  buffered: { length: number };
};
let videoRef: RefObject<HTMLVideoElement | null>;
let introActive: { current: boolean };
let refs: SourceRefs;
/** FEAT-20260925-718 L2 — what the harness hands the hook, per test. */
let storage: PlayerStorage | null;
let contentId: string | undefined;

function Harness() {
  refs = useSourceRefs();
  timeline = useElementTimeline({
    videoRef,
    introActiveRef: introActive,
    refs,
    playhead: createPlayheadStore(),
    duration: DURATION,
    knownDuration: DURATION,
    content: { id: contentId, type: 'movie' },
    onCurrentTime: undefined,
    setDuration: () => {},
    setMediaReady: () => {},
    restoreRate: () => {},
    storage,
  });
  return null;
}

const saved = () =>
  localStoragePlayerStorage().get('position', { contentId: 'm1' });

function mount() {
  act(() => root?.render(<Harness />));
}

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
  storage = localStoragePlayerStorage();
  contentId = 'm1';
  video = { currentTime: 0, duration: DURATION, buffered: { length: 0 } };
  videoRef = createRef<HTMLVideoElement>();
  (videoRef as { current: HTMLVideoElement | null }).current =
    video as unknown as HTMLVideoElement;
  introActive = { current: false };
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  mount();
});

afterEach(() => {
  act(() => root?.unmount());
  root = null;
  container.remove();
});

describe('savePosition', () => {
  test('keeps a pause in the middle of the film', () => {
    video.currentTime = 388;
    timeline.savePosition();
    expect(saved()).toBe('388');
  });

  test('keeps nothing in the first five seconds', () => {
    video.currentTime = 4;
    timeline.savePosition();
    expect(saved()).toBeNull();
  });

  test('keeps nothing for the clip in front of the film', () => {
    introActive.current = true;
    video.currentTime = 6;
    timeline.savePosition();
    expect(saved()).toBeNull();
  });

  // Q-09 — the pause an ended element fires wrote the end back after
  // `timeupdate` had cleared it, and a finished film offered to continue.
  test('keeps nothing in the last 30 seconds, where the film counts as watched', () => {
    video.currentTime = DURATION - 10;
    timeline.onTimeUpdate();
    timeline.savePosition();
    expect(saved()).toBeNull();
  });
});

describe('the storage seam (FEAT-20260925-718)', () => {
  test('null storage keeps nothing', () => {
    storage = null;
    mount();
    video.currentTime = 388;
    timeline.savePosition();
    expect(localStorage.length).toBe(0);
  });

  test('with no content id nothing is written', () => {
    contentId = undefined;
    mount();
    video.currentTime = 388;
    timeline.savePosition();
    expect(localStorage.length).toBe(0);
  });

  test('reaching the watched tail clears the position through the adapter', () => {
    video.currentTime = 388;
    timeline.savePosition();
    video.currentTime = DURATION - 10;
    timeline.onTimeUpdate();
    expect(saved()).toBeNull();
  });

  test('a localStorage that throws does not throw out of the hook', () => {
    const restore = stubGlobal('localStorage', {
      setItem() {
        throw new Error('QuotaExceededError');
      },
      removeItem() {
        throw new Error('SecurityError');
      },
    });
    try {
      video.currentTime = 388;
      expect(() => timeline.savePosition()).not.toThrow();
      video.currentTime = DURATION - 10;
      expect(() => timeline.onTimeUpdate()).not.toThrow();
    } finally {
      restore();
    }
  });
});

describe('onLoadedMetadata, the resume (BUG-20260930-719)', () => {
  test('a resume iOS drops at loadedmetadata still lands once the stream is seekable', () => {
    const dropping = new DroppingVideo();
    (videoRef as { current: HTMLVideoElement | null }).current =
      dropping.element;
    refs.pendingSeek.current = 420;
    dropping.readyState = 1;
    timeline.onLoadedMetadata();
    expect(dropping.currentTime).toBe(0);
    expect(refs.pendingSeek.current).toBeNull();

    dropping.becomeSeekable();
    expect(dropping.currentTime).toBe(420);
  });
});
