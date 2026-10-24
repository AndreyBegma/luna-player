/**
 * The long-press hook: a finger held on a playing film plays it at 2× and
 * gives the viewer's own rate back on release; the click the release makes
 * is not a tap.
 *
 * FEAT-20260923-661 Q-02 — a second finger during a hold used to re-arm the
 * timer, which then saved 2× as "the rate before" and restored it: the film
 * was left at double speed. Q-04 — a hold whose release produced no click
 * left the "released" flag up, and the next tap on a paused picture was
 * swallowed as that click.
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
import { useLongPress } from './use-long-press';

type LongPress = ReturnType<typeof useLongPress>;

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

function mount(playing = true, rate = 1.25) {
  jest.useFakeTimers();
  const videoRef =
    createRef<HTMLVideoElement>() as RefObject<HTMLVideoElement | null>;
  const video = { playbackRate: rate } as HTMLVideoElement;
  videoRef.current = video;
  const latest: { current: LongPress | null } = { current: null };

  function Harness({ playing }: { playing: boolean }) {
    latest.current = useLongPress({ videoRef, playing });
    return null;
  }

  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  const render = (p: boolean) =>
    act(() => root?.render(<Harness playing={p} />));
  render(playing);

  const press = (pointerType = 'touch') =>
    act(() =>
      latest.current?.onPointerDown({ pointerType, clientX: 10, clientY: 10 }),
    );
  const wait = (ms = LONG_PRESS_MS) => act(() => jest.advanceTimersByTime(ms));
  return { video, latest, press, wait, render };
}

describe('useLongPress', () => {
  test('holds 2× and gives the viewer their own rate back', () => {
    const { video, latest, press, wait } = mount();
    press();
    wait();
    expect(video.playbackRate).toBe(HELD_RATE);
    expect(latest.current?.feedback).toEqual({ kind: 'rate', rate: HELD_RATE });
    act(() => latest.current?.onPointerUp());
    expect(video.playbackRate).toBe(1.25);
    expect(latest.current?.feedback).toBeNull();
    expect(latest.current?.consumeReleasedClick()).toBe(true);
    expect(latest.current?.consumeReleasedClick()).toBe(false);
  });

  test('a short press is a tap: no rate change, and its click is not swallowed', () => {
    const { video, latest, press, wait } = mount();
    press();
    wait(LONG_PRESS_MS - 1);
    act(() => latest.current?.onPointerUp());
    wait();
    expect(video.playbackRate).toBe(1.25);
    expect(latest.current?.consumeReleasedClick()).toBe(false);
  });

  test('a finger that drifts past the slop is not a hold', () => {
    const { video, latest, press, wait } = mount();
    press();
    act(() => latest.current?.onPointerMove({ clientX: 30, clientY: 10 }));
    wait();
    expect(video.playbackRate).toBe(1.25);
  });

  test('a mouse, or a paused film, never holds', () => {
    const paused = mount(false);
    paused.press();
    paused.wait();
    expect(paused.video.playbackRate).toBe(1.25);
    act(() => root?.unmount());

    const mouse = mount(true);
    mouse.press('mouse');
    mouse.wait();
    expect(mouse.video.playbackRate).toBe(1.25);
  });

  test('a second finger during a hold does not leave the film at 2×', () => {
    const { video, latest, press, wait } = mount();
    press();
    wait();
    press();
    wait();
    act(() => latest.current?.onPointerUp());
    expect(video.playbackRate).toBe(1.25);
  });

  test('a release that made no click does not swallow the next tap', () => {
    const { latest, press, wait, render } = mount();
    press();
    wait();
    act(() => latest.current?.onPointerCancel());
    // The film is paused now; this press cannot hold, and its click is a tap.
    render(false);
    press();
    expect(latest.current?.consumeReleasedClick()).toBe(false);
  });
});
