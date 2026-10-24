/**
 * FEAT-20260923-661 (W-WEB-player-engine) — the hls.js engine, against a fake
 * hls.js that records what it was asked and fires the events a test hands it.
 *
 * FEAT-20260925-718 L2 — the fake arrives through the engine's `loadHls`, the
 * way the real library does in an app, so nothing here mocks a module.
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
import type { HlsConfigLike, HlsLoader } from './hls-types';
import { type SourceRefs, useSourceRefs } from './source-refs';
import type { ServerSeek } from './source-url';
import { useHlsEngine } from './use-hls-engine';

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

type Handler = (event: string, data: unknown) => void;

class FakeHls {
  static instances: FakeHls[] = [];
  static isSupported = () => true;
  static Events = {
    MANIFEST_PARSED: 'manifestParsed',
    AUDIO_TRACKS_UPDATED: 'audioTracksUpdated',
    LEVEL_SWITCHED: 'levelSwitched',
    ERROR: 'error',
    FRAG_BUFFERED: 'fragBuffered',
  };
  static ErrorTypes = {
    NETWORK_ERROR: 'networkError',
    MEDIA_ERROR: 'mediaError',
    OTHER_ERROR: 'otherError',
  };
  static DefaultConfig = {
    fragLoadPolicy: {
      default: {
        maxTimeToFirstByteMs: 10,
        maxLoadTimeMs: 20,
        timeoutRetry: null,
        errorRetry: null,
      },
    },
  };

  handlers = new Map<string, Handler[]>();
  levels = [{ height: 720 }, { height: 1080 }];
  audioTracks = [];
  audioTrack = 0;
  currentLevel = -1;
  source: string | null = null;
  destroyed = false;
  startLoads = 0;

  constructor(readonly config: Partial<HlsConfigLike> = {}) {
    FakeHls.instances.push(this);
  }
  loadSource(url: string) {
    this.source = url;
  }
  attachMedia() {}
  on(event: string, handler: Handler) {
    this.handlers.set(event, [...(this.handlers.get(event) ?? []), handler]);
  }
  emit(event: string, data: unknown = {}) {
    for (const handler of this.handlers.get(event) ?? []) handler(event, data);
  }
  destroy() {
    this.destroyed = true;
  }
  startLoad() {
    this.startLoads += 1;
  }
  recoverMediaError() {}
}

const fakeLoader: HlsLoader = () => Promise.resolve({ default: FakeHls });

const live = () => FakeHls.instances.filter((hls) => !hls.destroyed);
const fatal = (type: string, code?: number) => ({
  fatal: true,
  type,
  response: code === undefined ? undefined : { code },
});

interface FakeVideo {
  src: string;
  currentTime: number;
  paused: boolean;
  plays: number;
  load: () => void;
  play: () => Promise<void>;
}

function fakeVideo(): FakeVideo {
  const video: FakeVideo = {
    src: '',
    currentTime: 0,
    paused: true,
    plays: 0,
    load: () => {},
    play: () => {
      video.plays += 1;
      video.paused = false;
      return Promise.resolve();
    },
  };
  return video;
}

interface Props {
  src: string;
  hlsSrc: string | undefined;
  fallbackSrc?: string;
  serverSeek?: boolean;
  onPlaybackExpired?: () => Promise<unknown>;
  /** `null`: no loader at all, an app without hls.js. */
  loadHls?: HlsLoader | null;
}

let container: HTMLDivElement;
let root: Root | null = null;
let engine: ReturnType<typeof useHlsEngine>;
let refs: SourceRefs;
let video: FakeVideo;
let videoRef: RefObject<HTMLVideoElement | null>;

function Harness(props: Props) {
  refs = useSourceRefs();
  engine = useHlsEngine({
    videoRef,
    src: props.src,
    fallbackSrc: props.fallbackSrc,
    hlsSrc: props.hlsSrc,
    hlsLoading: undefined,
    loadHls: props.loadHls === null ? undefined : (props.loadHls ?? fakeLoader),
    serverSeek: serverSeekFor(props.serverSeek ?? false),
    locale: 'en',
    onPlaybackExpired: props.onPlaybackExpired,
    refs,
    introActiveRef: { current: false },
    introPendingRef: { current: false },
    setIsBuffering: () => {},
    setHlsAudioTracks: () => {},
    setSelectedAudioTrack: () => {},
  });
  return null;
}

function render(props: Props) {
  act(() => root?.render(<Harness {...props} />));
}

/** Lets the engine's `import('hls.js')` and everything after it settle. */
async function settle() {
  await act(() => new Promise((resolve) => setTimeout(resolve, 0)));
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
  FakeHls.instances = [];
  video = fakeVideo();
  videoRef = createRef<HTMLVideoElement>();
  (videoRef as { current: HTMLVideoElement | null }).current =
    video as unknown as HTMLVideoElement;
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root?.unmount());
  root = null;
  container.remove();
});

const A = 'https://api/a.m3u8';
const B = 'https://api/b.m3u8';

describe('an attach still in flight when the player moves on (Q-01)', () => {
  test('an attach that resolves after unmount builds nothing', async () => {
    render({ src: A, hlsSrc: A });
    engine.initHls(false);
    act(() => root?.unmount());
    root = null;
    await settle();
    expect(live()).toHaveLength(0);
  });

  test('an attach that resolves after a swap builds nothing for the old stream', async () => {
    render({ src: A, hlsSrc: A });
    engine.initHls(false);
    render({ src: B, hlsSrc: B });
    engine.initHls(true);
    await settle();
    expect(live().map((hls) => hls.source)).toEqual([B]);
  });
});

describe('an expired URL (Q-02)', () => {
  test('a refreshed source after a 401 is attached without a press, at the position', async () => {
    let refreshes = 0;
    const onPlaybackExpired = async () => {
      refreshes += 1;
    };
    render({ src: A, hlsSrc: A, onPlaybackExpired });
    engine.initHls(true);
    await settle();
    video.currentTime = 600;
    act(() => FakeHls.instances[0].emit('error', fatal('networkError', 401)));
    expect(refreshes).toBe(1);
    expect(live()).toHaveLength(0);

    render({ src: B, hlsSrc: B, onPlaybackExpired });
    await settle();
    expect(live().map((hls) => hls.source)).toEqual([B]);
    video.paused = true;
    act(() => live()[0].emit('manifestParsed'));
    expect(video.currentTime).toBe(600);
    expect(video.paused).toBe(false);
  });

  test('the online path, which re-attaches through reloadAt, still attaches once', async () => {
    const onPlaybackExpired = async () => {};
    render({ src: A, hlsSrc: A, onPlaybackExpired });
    engine.initHls(true);
    await settle();
    act(() => FakeHls.instances[0].emit('error', fatal('networkError', 403)));
    render({ src: B, hlsSrc: B, onPlaybackExpired });
    engine.reset();
    engine.initHls(true);
    await settle();
    expect(live().map((hls) => hls.source)).toEqual([B]);
  });

  test('refreshes once, and again only after a fragment has played', async () => {
    let refreshes = 0;
    const onPlaybackExpired = async () => {
      refreshes += 1;
    };
    render({ src: A, hlsSrc: A, onPlaybackExpired });
    engine.initHls(true);
    await settle();
    act(() => FakeHls.instances[0].emit('error', fatal('networkError', 401)));
    render({ src: B, hlsSrc: B, onPlaybackExpired });
    await settle();
    const second = live()[0];
    act(() => second.emit('error', fatal('networkError', 401)));
    expect(refreshes).toBe(1);
    expect(second.startLoads).toBe(1);

    act(() => second.emit('fragBuffered'));
    act(() => second.emit('error', fatal('networkError', 401)));
    expect(refreshes).toBe(2);
  });
});

describe('the quality menu follows the instance (Q-03)', () => {
  test('a new manifest resets the menu to auto', async () => {
    render({ src: A, hlsSrc: A });
    engine.initHls(true);
    await settle();
    act(() => FakeHls.instances[0].emit('manifestParsed'));
    act(() => engine.switchQuality(1));
    expect(engine.selectedLevel).toBe(1);

    act(() => engine.reset());
    engine.initHls(true);
    await settle();
    act(() => live()[0].emit('manifestParsed'));
    expect(engine.selectedLevel).toBe(-1);
  });

  test('a fatal fallback to an element source empties the levels', async () => {
    render({ src: A, hlsSrc: A, fallbackSrc: 'https://api/a.mp4' });
    engine.initHls(true);
    await settle();
    act(() => FakeHls.instances[0].emit('manifestParsed'));
    act(() => FakeHls.instances[0].emit('levelSwitched', { level: 1 }));
    expect(engine.levels).toHaveLength(2);
    act(() => FakeHls.instances[0].emit('error', fatal('otherError')));
    expect(engine.levels).toEqual([]);
    expect(engine.activeLevelHeight).toBeNull();
  });
});

describe('bounded recovery and the fallback chain', () => {
  test('three fatal network errors reload; the fourth falls back at the position', async () => {
    render({ src: A, hlsSrc: A, fallbackSrc: 'https://api/a.mp4' });
    engine.initHls(true);
    await settle();
    const hls = FakeHls.instances[0];
    video.currentTime = 100;
    for (let i = 0; i < 3; i++)
      act(() => hls.emit('error', fatal('networkError')));
    expect(hls.startLoads).toBe(3);
    expect(hls.destroyed).toBe(false);

    act(() => hls.emit('error', fatal('networkError')));
    expect(hls.destroyed).toBe(true);
    expect(video.src).toBe('https://api/a.mp4');
    expect(refs.pendingSeek.current).toBe(100);
    expect(refs.usingFallbackSrc.current).toBe(true);
  });

  test('a buffered fragment gives the budget back', async () => {
    render({ src: A, hlsSrc: A });
    engine.initHls(true);
    await settle();
    const hls = FakeHls.instances[0];
    for (let i = 0; i < 3; i++)
      act(() => hls.emit('error', fatal('networkError')));
    act(() => hls.emit('fragBuffered'));
    for (let i = 0; i < 3; i++)
      act(() => hls.emit('error', fatal('networkError')));
    expect(hls.startLoads).toBe(6);
    expect(engine.playbackFailed).toBe(false);
  });

  test('a server-seeking fallback carries the position in the URL', async () => {
    render({
      src: A,
      hlsSrc: A,
      fallbackSrc: 'https://api/t?sig=x',
      serverSeek: true,
    });
    engine.initHls(true);
    await settle();
    video.currentTime = 90;
    act(() => FakeHls.instances[0].emit('error', fatal('otherError')));
    expect(video.src).toBe('https://api/t?sig=x&t=90');
    expect(refs.seekOffset.current).toBe(90);
  });

  test('with nothing left to try it says so and keeps the position for Retry', async () => {
    render({ src: A, hlsSrc: A });
    engine.initHls(true);
    await settle();
    video.currentTime = 42;
    act(() => FakeHls.instances[0].emit('error', fatal('otherError')));
    expect(engine.playbackFailed).toBe(true);
    expect(refs.pendingSeek.current).toBe(42);
    expect(refs.hlsActive.current).toBe(false);
  });
});

describe('a resume on a stream (BUG-20260930-719)', () => {
  test('hls.js starts loading at the resume position, not at segment 0', async () => {
    render({ src: A, hlsSrc: A });
    refs.pendingSeek.current = 420;
    engine.initHls(true);
    await settle();
    expect(live()[0].config.startPosition).toBe(420);
  });

  test('with nothing to resume, hls.js keeps its own default start', async () => {
    render({ src: A, hlsSrc: A });
    engine.initHls(true);
    await settle();
    expect(live()[0].config.startPosition).toBe(-1);
  });

  test('a seek iOS drops at the manifest still lands once the stream is seekable', async () => {
    const dropping = new DroppingVideo();
    (videoRef as { current: HTMLVideoElement | null }).current =
      dropping.element;
    render({ src: A, hlsSrc: A });
    refs.pendingSeek.current = 420;
    engine.initHls(true);
    await settle();
    act(() => live()[0].emit('manifestParsed'));
    expect(dropping.currentTime).toBe(0);

    dropping.becomeSeekable();
    expect(dropping.currentTime).toBe(420);
  });
});

describe('the injected loader (FEAT-20260925-718 L2)', () => {
  test('a source change destroys the attached instance', async () => {
    render({ src: A, hlsSrc: A });
    engine.initHls(true);
    await settle();
    expect(live()).toHaveLength(1);

    render({ src: B, hlsSrc: B });
    expect(FakeHls.instances[0].destroyed).toBe(true);
    expect(live()).toHaveLength(0);
    expect(refs.hlsActive.current).toBe(false);
  });

  test('without a loader an hlsSrc falls back to src on the element', async () => {
    render({ src: 'https://api/a.mp4', hlsSrc: A, loadHls: null });
    engine.initHls(true);
    await settle();
    expect(FakeHls.instances).toHaveLength(0);
    expect(video.src).toBe('https://api/a.mp4');
    expect(video.plays).toBe(1);
    expect(refs.srcLoaded.current).toBe(true);
    expect(refs.hlsActive.current).toBe(false);
  });

  test('a loader that resolves to an unsupported hls.js does the same', async () => {
    const unsupported = class extends FakeHls {
      static isSupported = () => false;
    };
    render({
      src: 'https://api/a.mp4',
      hlsSrc: A,
      loadHls: () => Promise.resolve({ default: unsupported }),
    });
    engine.initHls(true);
    await settle();
    expect(live()).toHaveLength(0);
    expect(video.src).toBe('https://api/a.mp4');
  });
});
