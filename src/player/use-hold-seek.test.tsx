/**
 * The held-arrow hook: its own clock, its own target, and one commit on
 * release where a seek restarts the stream.
 *
 * FEAT-20260923-661 Q-03 — the other arrow pressed during a hold started the
 * new hold from the playhead, which had not moved yet: on a stream that
 * commits on release the first hold's distance was lost.
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
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { registerDom, unregisterDom } from '../test-dom-shim';
import { HOLD_TICK_MS } from '../logic/hold-seek';
import { createPlayheadStore } from './playhead-store';
import { useHoldSeek } from './use-hold-seek';

type HoldSeek = ReturnType<typeof useHoldSeek>;

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

function mount(restarts: boolean, time = 100, duration = 1_000) {
  jest.useFakeTimers();
  const playhead = createPlayheadStore();
  playhead.set({ time });
  const seeks: number[] = [];
  const latest: { current: HoldSeek | null } = { current: null };

  function Harness() {
    latest.current = useHoldSeek({
      playhead,
      duration,
      // A seek that has not landed yet: the store is not written.
      seekToTime: (t) => seeks.push(t),
      seekRestartsStream: () => restarts,
    });
    return null;
  }

  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => root?.render(<Harness />));
  const tick = (n = 1) => act(() => jest.advanceTimersByTime(HOLD_TICK_MS * n));
  return { seeks, latest, tick };
}

describe('useHoldSeek', () => {
  test('in place: every tick commits, from its own target', () => {
    const { seeks, latest, tick } = mount(false);
    act(() => latest.current?.begin(1, false));
    tick(2);
    act(() => latest.current?.end());
    expect(seeks).toEqual([110, 120, 130]);
    expect(latest.current?.feedback).toBeNull();
  });

  test('restarting the stream: one commit, on release', () => {
    const { seeks, latest, tick } = mount(true);
    act(() => latest.current?.begin(-1, false));
    tick(2);
    expect(seeks).toEqual([]);
    expect(latest.current?.feedback).toEqual({ kind: 'seek', seconds: -10 });
    act(() => latest.current?.end());
    expect(seeks).toEqual([70]);
  });

  test('a key repeat is not a new hold', () => {
    const { seeks, latest } = mount(false);
    act(() => latest.current?.begin(1, false));
    act(() => latest.current?.begin(1, false));
    expect(seeks).toEqual([110]);
  });

  test('the other arrow carries on from the first hold, not from the playhead', () => {
    const { seeks, latest, tick } = mount(true);
    act(() => latest.current?.begin(1, false));
    tick(2);
    act(() => latest.current?.begin(-1, false));
    act(() => latest.current?.end());
    expect(seeks).toEqual([130, 120]);
  });

  test('the window losing focus ends the hold', () => {
    const { seeks, latest } = mount(true);
    act(() => latest.current?.begin(1, false));
    act(() => {
      window.dispatchEvent(new Event('blur'));
    });
    expect(seeks).toEqual([110]);
    expect(latest.current?.feedback).toBeNull();
  });
});
