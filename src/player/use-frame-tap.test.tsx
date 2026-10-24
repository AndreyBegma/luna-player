/**
 * FEAT-20260923-661 Q-01 — a run of taps moves the film by the counter it
 * shows, even when the playhead has not caught up with the last seek. On the
 * HLS path the store is written on `timeupdate`, which arrives only once the
 * seek has landed; a fourth tap read the position the second one left.
 */
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  setSystemTime,
  test,
} from 'bun:test';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { registerDom, unregisterDom } from '../test-dom-shim';
import { createPlayheadStore } from './playhead-store';
import { useFrameTap } from './use-frame-tap';

type Tap = ReturnType<typeof useFrameTap>;

const START = 1_700_000_000_000;
const RECT = { left: 0, width: 300 } as DOMRect;
const RIGHT = 250;
const LEFT = 50;
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
  setSystemTime();
});

function mount(time = 100) {
  const playhead = createPlayheadStore();
  playhead.set({ time });
  const calls = { seeks: [] as number[], shows: 0, hides: 0 };
  const latest: { current: Tap | null } = { current: null };

  function Harness() {
    latest.current = useFrameTap({
      playhead,
      showAndScheduleHide: () => calls.shows++,
      hideControls: () => calls.hides++,
      // A seek that has not landed yet: the store is not written.
      seekToTime: (t) => calls.seeks.push(t),
    });
    return null;
  }

  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => root?.render(<Harness />));

  let now = START;
  const tap = (clientX: number, after = 100, visible = true) => {
    now += after;
    setSystemTime(now);
    act(() => latest.current?.onTap(clientX, RECT, visible));
  };
  return { playhead, calls, latest, tap };
}

describe('useFrameTap — the run', () => {
  test('moves the film by the running total, not from a stale playhead', () => {
    const { calls, latest, tap } = mount(100);
    tap(RIGHT);
    tap(RIGHT);
    tap(RIGHT);
    tap(RIGHT);
    expect(calls.seeks).toEqual([110, 120, 130]);
    expect(latest.current?.feedback).toEqual({ kind: 'seek', seconds: 30 });
  });

  test('goes back by the running total on the left third', () => {
    const { calls, latest, tap } = mount(100);
    tap(LEFT);
    tap(LEFT);
    tap(LEFT);
    expect(calls.seeks).toEqual([90, 80]);
    expect(latest.current?.feedback).toEqual({ kind: 'seek', seconds: -20 });
  });

  test('a new run starts from where the playhead is now', () => {
    const { calls, playhead, tap } = mount(100);
    tap(RIGHT);
    tap(RIGHT);
    playhead.set({ time: 400 });
    tap(RIGHT, 1_000);
    tap(RIGHT);
    expect(calls.seeks).toEqual([110, 410]);
  });

  test('a centre tap with the controls up hides them and seeks nothing', () => {
    const { calls, tap } = mount();
    tap(CENTRE);
    expect(calls.hides).toBe(1);
    expect(calls.seeks).toEqual([]);
  });

  test('a tap with the controls down only brings them up', () => {
    const { calls, tap } = mount();
    tap(RIGHT, 100, false);
    expect(calls.shows).toBe(1);
    expect(calls.hides).toBe(0);
    expect(calls.seeks).toEqual([]);
  });
});
