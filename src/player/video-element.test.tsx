/**
 * FEAT-20260924-680 (increment 2) — the `<video>` reports what it plays to
 * the launch, carries `data-launch`, and keeps calling the hub's handlers
 * exactly as before.
 */
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  mock,
  setSystemTime,
  test,
} from 'bun:test';
import { act, createRef } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { registerDom, unregisterDom } from '../test-dom-shim';
import { LaunchFrameProvider } from './launch-veil';
import { VideoElement } from './video-element';

let container: HTMLDivElement;
let root: Root | null = null;
// Two days ahead of the real clock; see `launch-veil.test.tsx`.
let clock = Date.now() + 2 * 86_400_000;

beforeAll(() => {
  registerDom();
  (
    globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement('div');
  document.body.appendChild(container);
});

beforeEach(() => {
  clock += 60_000;
  setSystemTime(new Date(clock));
});

afterEach(async () => {
  if (root) {
    const r = root;
    root = null;
    await act(async () => {
      r.unmount();
    });
  }
});

afterAll(() => {
  setSystemTime();
  container.remove();
  unregisterDom();
});

const noop = () => {};
const handlers = {
  onPlay: mock(noop),
  onPlaying: mock(noop),
  onEnded: mock(noop),
  onPause: mock(noop),
};

function render(fullscreen: boolean) {
  root ??= createRoot(container);
  const r = root;
  return act(async () => {
    r.render(
      <LaunchFrameProvider fullscreen={fullscreen}>
        <VideoElement
          videoRef={createRef<HTMLVideoElement>()}
          objectFit={undefined}
          transform={undefined}
          poster="/backdrop.jpg"
          onClick={noop}
          {...handlers}
          onWaiting={noop}
          onTimeUpdate={noop}
          onLoadedMetadata={noop}
          onDurationChange={noop}
          onVolumeChange={noop}
          onEmptied={noop}
          onError={noop}
          subtitleCueUrl={null}
          subtitleTrackRef={createRef<HTMLTrackElement>()}
          selectedSubtitle={null}
          subtitles={undefined}
          subtitleLabels={[]}
        />
      </LaunchFrameProvider>,
    );
  });
}

const videoEl = () => {
  const v = container.querySelector('video');
  if (!v) throw new Error('no video');
  return v;
};

async function media(type: string) {
  await act(async () => {
    videoEl().dispatchEvent(new Event(type));
  });
}

describe('VideoElement — the launch', () => {
  test('rests with no launch attribute and no veil before anything plays', async () => {
    await render(false);
    expect(videoEl().hasAttribute('data-launch')).toBe(false);
    expect(videoEl().className).toBe('w-full h-full');
    expect(container.querySelector('.launch-veil')).toBeNull();
  });

  test('a launch: veil over the picture, dark picture, then up from black on playing', async () => {
    await render(false);
    Object.defineProperty(videoEl(), 'paused', {
      configurable: true,
      value: false,
    });
    await media('play');
    expect(
      container.querySelector('.launch-veil')?.getAttribute('data-veil'),
    ).toBe('hold');

    await render(true);
    const veil = container.querySelector('.launch-veil');
    expect(veil?.getAttribute('data-veil')).toBe('run');
    // The veil is the video's sibling, inside the same (fullscreen) frame.
    expect(veil?.previousElementSibling).toBe(videoEl());
    expect(videoEl().getAttribute('data-launch')).toBe('dark');
    expect(videoEl().classList.contains('motion-reduce-keep')).toBe(true);

    await act(async () => {
      veil
        ?.querySelector('.launch-veil-image')
        ?.dispatchEvent(new Event('animationend', { bubbles: true }));
    });
    await media('playing');
    expect(container.querySelector('.launch-veil')).toBeNull();
    expect(videoEl().getAttribute('data-launch')).toBe('up');

    // The clip ends and the film loads: black, then up again.
    await media('ended');
    await media('loadstart');
    expect(videoEl().getAttribute('data-launch')).toBe('dark');
    await media('playing');
    expect(videoEl().getAttribute('data-launch')).toBe('up');
  });

  test('the hub’s own handlers still run for every event the launch listens to', async () => {
    for (const handler of Object.values(handlers)) handler.mockClear();
    await render(false);
    await media('play');
    await media('playing');
    await media('pause');
    await media('ended');
    expect(handlers.onPlay).toHaveBeenCalledTimes(1);
    expect(handlers.onPlaying).toHaveBeenCalledTimes(1);
    expect(handlers.onPause).toHaveBeenCalledTimes(1);
    expect(handlers.onEnded).toHaveBeenCalledTimes(1);
  });
});
