/**
 * FEAT-20260923-661 Q-05 — the one rule that joins the tap model and the
 * long-press: the release of a hold is not a tap, a press on a control is
 * never the frame's, and a tap is judged on the controls as they were when
 * the finger landed.
 */
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  jest,
  test,
} from 'bun:test';
import { act, createRef, type RefObject } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { registerDom, unregisterDom } from '../test-dom-shim';
import { HELD_RATE, LONG_PRESS_MS } from '../logic/long-press';
import { createPlayheadStore } from './playhead-store';
import { useFrameGestures } from './use-frame-gestures';

type Gestures = ReturnType<typeof useFrameGestures>;

const RECT = { left: 0, width: 300 } as DOMRect;
const CENTRE = 150;

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
  jest.useRealTimers();
});

function mount(showControls: boolean) {
  jest.useFakeTimers();
  const videoRef =
    createRef<HTMLVideoElement>() as RefObject<HTMLVideoElement | null>;
  const video = { playbackRate: 1 } as HTMLVideoElement;
  videoRef.current = video;
  const calls = { shows: 0, hides: 0 };
  const latest: { current: Gestures | null } = { current: null };

  function Harness({ showControls }: { showControls: boolean }) {
    latest.current = useFrameGestures({
      videoRef,
      showControls,
      playing: true,
      playhead: createPlayheadStore(),
      showAndScheduleHide: () => calls.shows++,
      hideControls: () => calls.hides++,
      seekToTime: () => {},
    });
    return null;
  }

  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  const render = (v: boolean) =>
    act(() => root?.render(<Harness showControls={v} />));
  render(showControls);

  const down = (target: Element = container) =>
    act(() =>
      latest.current?.onPointerDown({
        pointerType: 'touch',
        clientX: CENTRE,
        clientY: 10,
        target,
      } as unknown as Parameters<Gestures['onPointerDown']>[0]),
    );
  const tap = () => act(() => latest.current?.onTap(CENTRE, RECT));
  return { video, calls, latest, render, down, tap };
}

describe('useFrameGestures', () => {
  test('the release of a hold is not a tap', () => {
    const { video, calls, latest, down, tap } = mount(true);
    down();
    act(() => jest.advanceTimersByTime(LONG_PRESS_MS));
    expect(video.playbackRate).toBe(HELD_RATE);
    expect(latest.current?.feedback).toEqual({ kind: 'rate', rate: HELD_RATE });
    act(() => latest.current?.onPointerUp());
    tap();
    expect(video.playbackRate).toBe(1);
    expect(calls.hides).toBe(0);
  });

  test('a press on a control never becomes a hold', () => {
    const { video, down } = mount(true);
    const button = document.createElement('button');
    container.appendChild(button);
    down(button);
    act(() => jest.advanceTimersByTime(LONG_PRESS_MS));
    expect(video.playbackRate).toBe(1);
  });

  test('a tap is judged on the controls as they were when the finger landed', () => {
    const { calls, render, down, tap } = mount(false);
    down();
    // The frame's touchstart brought the controls up before the click.
    render(true);
    tap();
    expect(calls.hides).toBe(0);
    expect(calls.shows).toBe(1);
  });
});
