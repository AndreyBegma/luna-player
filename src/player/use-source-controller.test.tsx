/**
 * FEAT-20260923-661 (W-WEB-player-engine) — the source controller's doors:
 * the seek door on each kind of source, the play/pause toggle and the
 * element's own fallback hop.
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
import { DroppingVideo } from './dropping-video';
import { createPlayheadStore, type PlayheadStore } from './playhead-store';
import { type SourceRefs, useSourceRefs } from './source-refs';
import type { ServerSeek } from './source-url';
import { useSourceController } from './use-source-controller';

interface FakeVideo {
  src: string;
  currentTime: number;
  paused: boolean;
  readyState: number;
  load: () => void;
  play: () => Promise<void>;
  pause: () => void;
}

function fakeVideo(): FakeVideo {
  const video: FakeVideo = {
    src: '',
    currentTime: 0,
    paused: true,
    readyState: 4,
    load: () => {},
    play: () => {
      video.paused = false;
      return Promise.resolve();
    },
    pause: () => {
      video.paused = true;
    },
  };
  return video;
}

interface Props {
  hlsSrc?: string;
  serverSeek?: boolean;
  fallbackSrc?: string;
}

/**
 * FEAT-20260925-718 S4 — the boolean these tests always passed, as the
 * `ServerSeek` Luna's root now builds from it (`luna/source-url.ts`): the
 * primary restarts on the server only with `serverSeek`, the fallback always.
 */
function serverSeekFor(serverSeek: boolean): ServerSeek {
  const buildUrl: ServerSeek['buildUrl'] = (base, { time }) =>
    `${base}&t=${time}`;
  return serverSeek ? { buildUrl } : { buildUrl, fallbackOnly: true };
}

const SRC = 'https://api/t?sig=x';
const FALLBACK = 'https://api/fallback?sig=y';

let container: HTMLDivElement;
let root: Root | null = null;
let controller: ReturnType<typeof useSourceController>;
let refs: SourceRefs;
let video: FakeVideo;
let videoRef: RefObject<HTMLVideoElement | null>;
let playhead: PlayheadStore;
let attaches: boolean[];

function Harness(props: Props) {
  refs = useSourceRefs();
  controller = useSourceController({
    videoRef,
    src: SRC,
    fallbackSrc: props.fallbackSrc,
    hlsSrc: props.hlsSrc,
    serverSeek: serverSeekFor(props.serverSeek ?? false),
    duration: 3600,
    refs,
    introActiveRef: { current: false },
    initHls: (autoplay) => attaches.push(autoplay),
    resetEngine: () => {},
    runIntroClip: () => false,
    skipIntro: () => {},
    setIsBuffering: () => {},
    playhead,
  });
  return null;
}

function mount(props: Props = {}) {
  act(() => root?.render(<Harness {...props} />));
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
  video = fakeVideo();
  videoRef = createRef<HTMLVideoElement>();
  (videoRef as { current: HTMLVideoElement | null }).current =
    video as unknown as HTMLVideoElement;
  playhead = createPlayheadStore();
  attaches = [];
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root?.unmount());
  root = null;
  container.remove();
});

describe('seekToTime, the single seek door', () => {
  test('refuses an element holding nothing', () => {
    mount();
    video.readyState = 0;
    controller.seekToTime(10);
    expect(video.currentTime).toBe(0);
  });

  test('seeks in place under hls.js, clamped to the film', () => {
    mount({ hlsSrc: 'https://api/a.m3u8' });
    refs.hlsActive.current = true;
    controller.seekToTime(5000);
    expect(video.currentTime).toBe(3600);
    controller.seekToTime(-3);
    expect(video.currentTime).toBe(0);
  });

  test('rebuilds a server-seeking source at the second, and draws the target', () => {
    mount({ serverSeek: true });
    video.paused = false;
    controller.seekToTime(600.7);
    expect(video.src).toBe('https://api/t?sig=x&t=600');
    expect(refs.seekOffset.current).toBe(600);
    expect(playhead.get().time).toBe(600);
    expect(video.paused).toBe(false);
  });
});

describe('doPlay', () => {
  test('attaches the film once and toggles it', () => {
    mount();
    controller.doPlay();
    expect(video.src).toBe(SRC);
    expect(video.paused).toBe(false);
    video.src = 'unchanged';
    controller.doPlay();
    expect(video.src).toBe('unchanged');
    expect(video.paused).toBe(true);
  });

  test('hands an HLS source to the engine instead of the element', () => {
    mount({ hlsSrc: 'https://api/a.m3u8' });
    controller.doPlay();
    expect(attaches).toEqual([true]);
    expect(video.src).toBe('');
  });
});

describe('fallbackToElementSrc', () => {
  test('hops to the fallback once, keeping play state', () => {
    mount({ fallbackSrc: FALLBACK });
    video.paused = false;
    controller.fallbackToElementSrc();
    expect(video.src).toBe(FALLBACK);
    expect(video.paused).toBe(false);
    video.src = 'unchanged';
    controller.fallbackToElementSrc();
    expect(video.src).toBe('unchanged');
  });

  // Q-04 — the fallback URL starts at zero; an offset left over from a
  // server-side seek put the clock and the saved position that far ahead.
  test('the element fallback starts the clock at zero', () => {
    mount({ serverSeek: true, fallbackSrc: FALLBACK });
    controller.seekToTime(600);
    expect(refs.seekOffset.current).toBe(600);
    controller.fallbackToElementSrc();
    expect(refs.seekOffset.current).toBe(0);
  });
});

describe('a held resume (BUG-20260930-719)', () => {
  function onDropping() {
    const dropping = new DroppingVideo();
    dropping.paused = false;
    (videoRef as { current: HTMLVideoElement | null }).current =
      dropping.element;
    mount({ hlsSrc: 'https://api/a.m3u8' });
    refs.hlsActive.current = true;
    return dropping;
  }

  test('the resume on an attached stream is held until it lands', () => {
    const dropping = onDropping();
    refs.pendingSeek.current = 420;
    controller.ensurePlaying();
    expect(dropping.currentTime).toBe(0);

    dropping.becomeSeekable();
    expect(dropping.currentTime).toBe(420);
  });

  test("the viewer's own seek lets go of it", () => {
    const dropping = onDropping();
    dropping.becomeSeekable();
    refs.pendingSeek.current = 420;
    controller.ensurePlaying();
    controller.seekToTime(60);

    dropping.advance(60);
    expect(dropping.currentTime).toBe(60);
  });

  test('a start from the top lets go of it', () => {
    const dropping = onDropping();
    dropping.becomeSeekable();
    refs.pendingSeek.current = 420;
    controller.ensurePlaying();
    controller.startContentAt(null);

    dropping.advance(0);
    expect(dropping.currentTime).toBe(0);
  });
});
