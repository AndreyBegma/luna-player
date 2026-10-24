/**
 * FEAT-20260923-661 Q-01 — which clicks on the frame are the picture's.
 *
 * A mouse click on the picture toggles playback. A click on anything that
 * sits over the picture and has its own purpose must not: on the end screen
 * it used to reach `doPlay`, and `play()` on an ended element restarts the
 * film from the top and cancels the next-episode countdown.
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
import { act, createRef, type ReactNode, type RefObject } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { registerDom, unregisterDom } from '../test-dom-shim';
import { type Launch, useLaunch } from './launch-veil';
import { PlayerFrame } from './player-frame';

let container: HTMLDivElement;
let root: Root | null = null;

beforeAll(() => {
  registerDom();
  (
    globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement('div');
  document.body.appendChild(container);
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
  container.remove();
  unregisterDom();
});

const noop = () => {};

async function mount(
  children: ReactNode,
  finePointer = true,
  {
    pseudoFullscreen = false,
    containerRef = createRef<HTMLDivElement>(),
  }: {
    pseudoFullscreen?: boolean;
    containerRef?: RefObject<HTMLDivElement | null>;
  } = {},
) {
  const onPictureClick = mock(noop);
  const onToggleFullscreen = mock(noop);
  root ??= createRoot(container);
  await act(async () => {
    root?.render(
      <PlayerFrame
        containerRef={containerRef}
        pseudoFullscreen={pseudoFullscreen}
        finePointer={finePointer}
        hidesCursor={false}
        onPictureClick={onPictureClick}
        onToggleFullscreen={onToggleFullscreen}
        gestures={{
          onPointerDown: noop,
          onPointerMove: noop,
          onPointerUp: noop,
          onPointerCancel: noop,
        }}
        onActivity={noop}
        onMouseEnter={noop}
        onTouchStart={noop}
        onPointerLeave={noop}
      >
        {children}
      </PlayerFrame>,
    );
  });
  return { onPictureClick, onToggleFullscreen };
}

async function click(selector: string, type: 'click' | 'dblclick' = 'click') {
  const target = container.querySelector(selector);
  if (!target) throw new Error(`nothing matches ${selector}`);
  await act(async () => {
    target.dispatchEvent(new MouseEvent(type, { bubbles: true }));
  });
}

describe('PlayerFrame — a click is the picture’s only when nothing over it owns it', () => {
  test('the picture itself and the controls overlay’s empty space are the picture’s', async () => {
    const { onPictureClick } = await mount(
      <div id="overlay">
        <span id="empty" />
      </div>,
    );
    await click('#empty');
    await click('#overlay');
    expect(onPictureClick).toHaveBeenCalledTimes(2);
  });

  test('a control, and anything inside one, is never the picture’s', async () => {
    const { onPictureClick } = await mount(
      <>
        <button type="button">
          <svg id="icon" aria-hidden="true" />
        </button>
        <div data-player-control>
          <span id="in-menu" />
        </div>
      </>,
    );
    await click('#icon');
    await click('#in-menu');
    expect(onPictureClick).not.toHaveBeenCalled();
  });

  test('the end screen’s own surface is not the picture — its backdrop used to restart the film', async () => {
    const { onPictureClick } = await mount(
      <div role="dialog" aria-modal="true" id="end-screen">
        <p id="heading">Up next</p>
      </div>,
    );
    await click('#end-screen');
    await click('#heading');
    expect(onPictureClick).not.toHaveBeenCalled();
  });

  test('a link over the picture (an actor on the pause strip) navigates without toggling playback', async () => {
    const { onPictureClick } = await mount(
      <a href="/person/1">
        <span id="actor">An actor</span>
      </a>,
    );
    await click('#actor');
    expect(onPictureClick).not.toHaveBeenCalled();
  });

  test('a double click fills the screen from the picture, not from a layer, and only with a mouse', async () => {
    const fine = await mount(
      <>
        <span id="picture" />
        <div role="dialog" id="dialog" />
      </>,
    );
    await click('#picture', 'dblclick');
    await click('#dialog', 'dblclick');
    expect(fine.onToggleFullscreen).toHaveBeenCalledTimes(1);

    await act(async () => {
      root?.unmount();
    });
    root = null;
    const coarse = await mount(<span id="picture" />, false);
    await click('#picture', 'dblclick');
    expect(coarse.onToggleFullscreen).not.toHaveBeenCalled();
  });
});

/**
 * FEAT-20260924-680 (increment 2) — the frame tells the launch veil when it
 * fills the screen: natively (it is the document's fullscreen element) or as
 * the iOS pseudo-fullscreen. Observed through a first play, which the veil
 * holds until the frame fills the screen, and then runs.
 */
describe('PlayerFrame — what it tells the launch veil', () => {
  const video = { paused: false } as HTMLVideoElement;
  let launch: Launch;
  function Probe() {
    launch = useLaunch({ current: video });
    return <span id="probe" data-veil={launch.veil ?? ''} />;
  }
  const veil = () =>
    container.querySelector('#probe')?.getAttribute('data-veil');
  const play = () =>
    act(async () => {
      launch.onPlay();
    });

  function setFullscreenElement(element: Element | null) {
    Object.defineProperty(document, 'fullscreenElement', {
      configurable: true,
      get: () => element,
    });
  }

  // A test that ends in fullscreen records a teardown, which the next one
  // would read as "the next episode"; each starts a minute later.
  let clock = Date.now() + 3 * 86_400_000;
  beforeEach(() => {
    clock += 60_000;
    setSystemTime(new Date(clock));
  });

  afterEach(() => {
    setFullscreenElement(null);
  });

  afterAll(() => {
    setSystemTime();
  });

  test('the frame becoming the fullscreen element is a launch', async () => {
    const containerRef = createRef<HTMLDivElement>();
    await mount(<Probe />, true, { containerRef });
    await play();
    expect(veil()).toBe('hold');

    setFullscreenElement(containerRef.current);
    await act(async () => {
      document.dispatchEvent(new Event('fullscreenchange'));
    });
    expect(veil()).toBe('run');
  });

  test('another element going fullscreen is not this frame', async () => {
    await mount(<Probe />);
    await play();
    setFullscreenElement(document.body);
    await act(async () => {
      document.dispatchEvent(new Event('fullscreenchange'));
    });
    expect(veil()).toBe('hold');
  });

  test('the iOS pseudo-fullscreen is a launch too, with the same veil', async () => {
    await mount(<Probe />);
    await play();
    await mount(<Probe />, true, { pseudoFullscreen: true });
    expect(veil()).toBe('run');
  });
});
