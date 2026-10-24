/**
 * FEAT-20260923-661 Q-05 — the centre confirmation: the glyph is the opposite
 * of the state before the toggle, a rapid second press restarts it, and the
 * door is always called whether or not a glyph is drawn.
 */
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  test,
} from 'bun:test';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { registerDom, unregisterDom } from '../test-dom-shim';
import { usePlayPauseConfirm } from './use-play-pause-confirm';

type Confirm = ReturnType<typeof usePlayPauseConfirm>;

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
});

function mount(playing: boolean) {
  let plays = 0;
  const latest: { current: Confirm | null } = { current: null };

  function Harness() {
    latest.current = usePlayPauseConfirm({ playing, doPlay: () => plays++ });
    return null;
  }

  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => root?.render(<Harness />));
  return { latest, plays: () => plays };
}

describe('usePlayPauseConfirm', () => {
  test('a playing film shows pause, a paused one play, and the door is called', () => {
    const playing = mount(true);
    act(() => playing.latest.current?.confirmedDoPlay());
    expect(playing.latest.current?.icon).toBe('pause');
    expect(playing.plays()).toBe(1);
    act(() => root?.unmount());

    const paused = mount(false);
    act(() => paused.latest.current?.confirmedDoPlay());
    expect(paused.latest.current?.icon).toBe('play');
  });

  test('a second press restarts the glyph; the end of its animation clears it', () => {
    const { latest } = mount(true);
    act(() => latest.current?.confirmedDoPlay());
    const first = latest.current?.token;
    act(() => latest.current?.confirmedDoPlay());
    expect(latest.current?.token).toBe((first ?? 0) + 1);
    act(() => latest.current?.clear());
    expect(latest.current?.icon).toBeNull();
  });
});
