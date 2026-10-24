/**
 * FEAT-20260923-661 (W-WEB-player-controls) Q-03 — the auto-hide timer's
 * wiring. The rules it asks are pure and held in `controls-hide.test.ts`;
 * this holds what the hook does with their answer: the fade, the re-arm
 * when it is refused, the timer's cleanup, the pointer and the cursor.
 *
 * The hook's own five-second timers are captured and fired by hand; every
 * other timeout (React's) still runs on the real clock.
 */
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  test,
} from 'bun:test';
import { registerDom, unregisterDom } from '../test-dom-shim';
import { stubGlobal } from '../test-stub-global';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { useControlsVisibility } from './use-controls-visibility';

type Visibility = ReturnType<typeof useControlsVisibility>;

let container: HTMLDivElement;
let root: Root | null = null;
let current: Visibility;
const restore: Array<() => void> = [];

/** The hook's pending fades, by id. */
const fades = new Map<number, () => void>();
let nextId = 1_000_000;

beforeAll(() => {
  registerDom();
  (
    globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
  const realSet = globalThis.setTimeout;
  const realClear = globalThis.clearTimeout;
  restore.push(
    stubGlobal(
      'setTimeout',
      (fn: () => void, ms?: number, ...args: unknown[]) => {
        if ((ms ?? 0) < 5_000) return realSet(fn, ms, ...args);
        const id = nextId++;
        fades.set(id, fn);
        return id;
      },
    ),
    stubGlobal('clearTimeout', (id: unknown) => {
      if (typeof id === 'number' && fades.delete(id)) return;
      realClear(id as Parameters<typeof clearTimeout>[0]);
    }),
  );
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
  fades.clear();
});

afterAll(() => {
  container.remove();
  for (const undo of restore.reverse()) undo();
  unregisterDom();
});

interface Input {
  menuOpen: boolean;
  playing: boolean;
  fullscreenActive: boolean;
}

function Probe(input: Input) {
  current = useControlsVisibility(input);
  return null;
}

async function render(input: Partial<Input> = {}) {
  root ??= createRoot(container);
  await act(async () => {
    root?.render(
      <Probe menuOpen={false} playing fullscreenActive={false} {...input} />,
    );
  });
}

/** Lets every armed fade run, as five seconds passing would. */
async function elapse() {
  const due = [...fades.values()];
  fades.clear();
  await act(async () => {
    for (const fn of due) fn();
  });
}

describe('useControlsVisibility', () => {
  test('the fade takes the controls away', async () => {
    await render();
    expect(current.showControls).toBe(true);
    await act(async () => current.scheduleHide());
    await elapse();
    expect(current.showControls).toBe(false);
    await act(async () => current.showAndScheduleHide());
    expect(current.showControls).toBe(true);
  });

  test('an open menu refuses the fade, and closing it starts the clock again', async () => {
    await render({ menuOpen: true });
    await act(async () => current.scheduleHide());
    await elapse();
    expect(current.showControls).toBe(true);
    // Refused, not cancelled: a fade is armed again.
    expect(fades.size).toBe(1);

    await render({ menuOpen: false });
    await elapse();
    expect(current.showControls).toBe(false);
  });

  test('a suppression holds the controls until it is released', async () => {
    await render();
    await act(async () => current.suppress(true));
    await act(async () => current.scheduleHide());
    await elapse();
    expect(current.showControls).toBe(true);

    await act(async () => current.suppress(false));
    await elapse();
    expect(current.showControls).toBe(false);
  });

  test('hide clears the armed fade; unmounting clears it too', async () => {
    await render();
    await act(async () => current.scheduleHide());
    await act(async () => current.hide());
    expect(current.showControls).toBe(false);
    expect(fades.size).toBe(0);

    await act(async () => current.scheduleHide());
    expect(fades.size).toBe(1);
    const r = root;
    root = null;
    await act(async () => r?.unmount());
    expect(fades.size).toBe(0);
  });

  test('the pointer leaving takes them only from a running film with no menu', async () => {
    await render({ playing: false });
    await act(async () => current.hideOnPointerLeave());
    expect(current.showControls).toBe(true);

    await render({ playing: true, menuOpen: true });
    await act(async () => current.hideOnPointerLeave());
    expect(current.showControls).toBe(true);

    await render({ playing: true, menuOpen: false });
    await act(async () => current.hideOnPointerLeave());
    expect(current.showControls).toBe(false);
  });

  test('the cursor goes with them in fullscreen, and comes back on unmount', async () => {
    await render({ fullscreenActive: true });
    await act(async () => current.hide());
    expect(current.hidesCursor).toBe(true);
    expect(document.body.style.cursor).toBe('none');

    const r = root;
    root = null;
    await act(async () => r?.unmount());
    expect(document.body.style.cursor).toBe('');
  });
});
