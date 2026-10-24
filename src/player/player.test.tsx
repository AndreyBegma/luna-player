/**
 * FEAT-20260925-718 L3 — the first `<Player>`, as a host mounts it.
 *
 * happy-dom's `<video>` plays nothing, so each element is given the little a
 * test needs: a `play()` that reports `play`, a `pause()` that reports
 * `pause`, and a `readyState` the test sets. Everything else — the element's
 * events, `src`, `poster`, focus and the keys — is the real DOM.
 */
import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test';
import { act, createRef } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { en } from '../labels/en';
import { Player } from './player';
import type { PlayerError, PlayerHandle, PlayerProps } from './types';

let container: HTMLDivElement;
let root: Root | null = null;

beforeEach(() => {
  localStorage.clear();
  container = document.createElement('div');
  document.body.appendChild(container);
});

afterEach(async () => {
  if (root) {
    const r = root;
    root = null;
    await act(async () => r.unmount());
  }
  container.remove();
});

interface FakeMedia {
  readyState: number;
  plays: number;
  pauses: number;
}

/** The element under test, made to answer `play()` and `pause()`. */
function fakeMedia(video: HTMLVideoElement): FakeMedia {
  const media: FakeMedia = { readyState: 0, plays: 0, pauses: 0 };
  let paused = true;
  Object.defineProperty(video, 'readyState', { get: () => media.readyState });
  Object.defineProperty(video, 'paused', { get: () => paused });
  video.play = () => {
    media.plays += 1;
    paused = false;
    video.dispatchEvent(new Event('play'));
    return Promise.resolve();
  };
  video.pause = () => {
    media.pauses += 1;
    paused = true;
    video.dispatchEvent(new Event('pause'));
  };
  return media;
}

const video = () => {
  const found = container.querySelector('video');
  if (!found) throw new Error('no <video>');
  return found;
};
const frame = () => {
  const found = container.querySelector<HTMLDivElement>('[data-tv-keys="own"]');
  if (!found) throw new Error('no frame');
  return found;
};
const buttonNamed = (name: string) =>
  container.querySelector<HTMLButtonElement>(`button[aria-label="${name}"]`);

async function render(props: PlayerProps, ref = createRef<PlayerHandle>()) {
  root ??= createRoot(container);
  await act(async () => {
    root?.render(<Player ref={ref} {...props} />);
  });
  return ref;
}

/** Mount, then fake the element the player rendered. */
async function mount(props: PlayerProps) {
  const ref = await render(props);
  return { ref, media: fakeMedia(video()) };
}

async function fire(type: string) {
  await act(async () => {
    video().dispatchEvent(new Event(type));
  });
}

/** The element has media: what `loadedmetadata` means to the player. */
async function loadMetadata(media: FakeMedia) {
  media.readyState = 1;
  Object.defineProperty(video(), 'duration', { configurable: true, value: 120 });
  await fire('loadedmetadata');
}

async function key(k: string) {
  await act(async () => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true }));
    window.dispatchEvent(new KeyboardEvent('keyup', { key: k, bubbles: true }));
  });
}

describe('<Player> — the element', () => {
  test('renders a <video> with the poster, and attaches `src` when play is asked for', async () => {
    const { ref } = await mount({ src: '/a.mp4', poster: '/a.jpg' });
    expect(video().getAttribute('poster')).toBe('/a.jpg');
    await act(async () => ref.current?.play());
    expect(video().src).toEndWith('/a.mp4');
  });

  test('`aspectRatio="9:16"` shapes the frame 9/16; the default is 16/9', async () => {
    await mount({ src: '/a.mp4' });
    expect(frame().style.aspectRatio.replaceAll(' ', '')).toBe('16/9');
    await act(async () => root?.unmount());
    root = null;
    await mount({ src: '/a.mp4', aspectRatio: '9:16' });
    expect(frame().style.aspectRatio.replaceAll(' ', '')).toBe('9/16');
  });

  test('the handle’s play, pause and seekTo reach the element', async () => {
    const { ref, media } = await mount({ src: '/a.mp4' });
    await act(async () => ref.current?.play());
    expect(media.plays).toBe(1);
    await act(async () => ref.current?.pause());
    expect(media.pauses).toBe(1);
    await loadMetadata(media);
    await act(async () => ref.current?.seekTo(30));
    expect(video().currentTime).toBe(30);
  });

  test('unmount releases the element’s source, so a range request in flight is aborted', async () => {
    const { ref } = await mount({ src: '/a.mp4' });
    await act(async () => ref.current?.play());
    const element = video();
    const load = mock(() => {});
    element.load = load;
    expect(element.getAttribute('src')).toBe('/a.mp4');
    await act(async () => root?.unmount());
    root = null;
    expect(element.hasAttribute('src')).toBe(false);
    expect(load).toHaveBeenCalled();
  });

  test('`onVideoElement` is handed the element, and `null` when it goes', async () => {
    const seen: (HTMLVideoElement | null)[] = [];
    const onVideoElement = (element: HTMLVideoElement | null) => seen.push(element);
    await mount({ src: '/a.mp4', onVideoElement });
    expect(seen).toEqual([video()]);
    await act(async () => root?.unmount());
    root = null;
    expect(seen.at(-1)).toBeNull();
  });
});

describe('<Player> — onError', () => {
  test('an element error with no fallbackSrc calls onError once with { kind: "playback" } and shows the notice', async () => {
    const onError = mock((_error: PlayerError) => {});
    const { ref } = await mount({ src: '/a.mp4', onError });
    await act(async () => ref.current?.play());
    await fire('error');
    await fire('error');
    expect(onError.mock.calls).toEqual([[{ kind: 'playback' }]]);
    expect(container.querySelector('[role="alert"]')?.textContent).toContain(en.playbackFailed);
  });

  test('with a fallbackSrc, the first error switches source and does not call onError', async () => {
    const onError = mock(() => {});
    const { ref } = await mount({ src: '/a.mp4', fallbackSrc: '/a.webm', onError });
    await act(async () => ref.current?.play());
    await fire('error');
    expect(video().src).toEndWith('/a.webm');
    expect(onError).not.toHaveBeenCalled();
    expect(container.querySelector('[role="alert"]')).toBeNull();

    await fire('error');
    expect(onError).toHaveBeenCalledTimes(1);
  });

  test('a new src resets the once-guard', async () => {
    const onError = mock(() => {});
    const first = await mount({ src: '/a.mp4', onError });
    await act(async () => first.ref.current?.play());
    await fire('error');
    expect(onError).toHaveBeenCalledTimes(1);

    const ref = await render({ src: '/b.mp4', onError });
    fakeMedia(video());
    expect(container.querySelector('[role="alert"]')).toBeNull();
    await act(async () => ref.current?.play());
    await fire('error');
    expect(onError).toHaveBeenCalledTimes(2);
  });

  test('a refused autoplay is not an error', async () => {
    const onError = mock(() => {});
    const original = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = () => Promise.reject(new DOMException('', 'NotAllowedError'));
    try {
      await render({ src: '/a.mp4', autoPlay: true, onError });
    } finally {
      HTMLMediaElement.prototype.play = original;
    }
    expect(video().getAttribute('src')).toBe('/a.mp4');
    expect(onError).not.toHaveBeenCalled();
    expect(container.querySelector('[role="alert"]')).toBeNull();
  });
});

describe('<Player> — labels', () => {
  test('with no labels the strings are English', async () => {
    const { media } = await mount({ src: '/a.mp4' });
    expect(buttonNamed(en.ariaPlay)).not.toBeNull();
    await loadMetadata(media);
    expect(buttonNamed(en.ariaEnterFullscreen)).not.toBeNull();
    expect(buttonNamed(en.ariaMute)).not.toBeNull();
  });

  test('`labels={{ ariaPlay: "X" }}` names the play button X, and keeps the rest English', async () => {
    const { media } = await mount({ src: '/a.mp4', labels: { ariaPlay: 'X' } });
    expect(buttonNamed('X')).not.toBeNull();
    await loadMetadata(media);
    const bar = container.querySelector('.control-bar-shell');
    expect(bar?.querySelector('button[aria-label="X"]')).not.toBeNull();
    expect(buttonNamed(en.ariaMute)).not.toBeNull();
  });

  test('a title names the idle play button instead', async () => {
    await mount({ src: '/a.mp4', title: 'Solaris' });
    expect(buttonNamed('Solaris')).not.toBeNull();
  });
});

describe('<Player> — storage', () => {
  async function changeVolume(media: FakeMedia) {
    await loadMetadata(media);
    video().volume = 0.5;
    await fire('volumechange');
  }

  test('`storage={null}` writes nothing', async () => {
    const { media } = await mount({ src: '/a.mp4', storage: null });
    await changeVolume(media);
    expect(localStorage.length).toBe(0);
  });

  test('the default keeps the volume under `luna-player:volume`', async () => {
    const { media } = await mount({ src: '/a.mp4' });
    await changeVolume(media);
    expect(localStorage.getItem('luna-player:volume')).toBe('0.5');
  });
});

describe('<Player> — keys work only while focus is in the frame', () => {
  test('k, m, arrows and f do nothing with focus outside the player', async () => {
    const { media } = await mount({ src: '/a.mp4' });
    await loadMetadata(media);
    const requestFullscreen = mock(() => Promise.resolve());
    frame().requestFullscreen = requestFullscreen;
    Object.defineProperty(document, 'fullscreenEnabled', { configurable: true, value: true });
    (document.activeElement as HTMLElement | null)?.blur();

    await key('k');
    await key('m');
    await key('ArrowRight');
    await key('f');
    expect(media.plays).toBe(0);
    expect(video().muted).toBe(false);
    expect(video().currentTime).toBe(0);
    expect(requestFullscreen).not.toHaveBeenCalled();
    Object.defineProperty(document, 'fullscreenEnabled', { configurable: true, value: false });
  });

  test('with focus in the frame, k plays, m mutes, the arrows seek and f fills the screen', async () => {
    const { media } = await mount({ src: '/a.mp4' });
    await loadMetadata(media);
    const requestFullscreen = mock(() => Promise.resolve());
    frame().requestFullscreen = requestFullscreen;
    // happy-dom reports no Fullscreen API; the engine asks before it uses it.
    Object.defineProperty(document, 'fullscreenEnabled', { configurable: true, value: true });
    await act(async () => frame().focus());

    await key('k');
    expect(media.plays).toBe(1);
    await key('m');
    expect(video().muted).toBe(true);
    await key('ArrowRight');
    expect(video().currentTime).toBe(10);
    await key('ArrowLeft');
    expect(video().currentTime).toBe(0);
    await key('f');
    expect(requestFullscreen).toHaveBeenCalledTimes(1);
    Object.defineProperty(document, 'fullscreenEnabled', { configurable: true, value: false });
  });
});
