/**
 * FEAT-20260923-661 (W-WEB-player-controls) — the scrubber as a control: its
 * keys (Q-01) and a pointer drag. The arithmetic behind the keys is held in
 * `seek-geometry.test.ts`; this holds the wiring.
 */
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  mock,
  test,
} from 'bun:test';
import { registerDom, unregisterDom } from '../test-dom-shim';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { LabelsProvider } from '../labels';
import { TEST_LABELS } from './labels/test-labels';
import { createPlayheadStore, type PlayheadStore } from './playhead-store';
import { SeekBar } from './seek-bar';

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

async function mount(playhead: PlayheadStore, onSeek: (t: number) => void) {
  root = createRoot(container);
  await act(async () => {
    root?.render(
      <LabelsProvider labels={TEST_LABELS}>
        <SeekBar
          playhead={playhead}
          duration={600}
          introRange={undefined}
          outroRange={undefined}
          onSeek={onSeek}
        />
      </LabelsProvider>,
    );
  });
  const slider = container.querySelector<HTMLDivElement>('[role="slider"]');
  if (!slider) throw new Error('no slider');
  return slider;
}

async function key(slider: HTMLElement, name: string, repeat = false) {
  await act(async () => {
    slider.dispatchEvent(
      new KeyboardEvent('keydown', { key: name, repeat, bubbles: true }),
    );
  });
}

describe('SeekBar — keys', () => {
  test('two quick presses are twenty seconds, not ten twice', async () => {
    const playhead = createPlayheadStore();
    playhead.set({ time: 100 });
    const onSeek = mock((_t: number) => {});
    const slider = await mount(playhead, onSeek);
    // No `timeupdate` between them: the store still reads 100.
    await key(slider, 'ArrowRight');
    await key(slider, 'ArrowRight');
    expect(onSeek.mock.calls).toEqual([[110], [120]]);
  });

  test('a key repeat sooner than a tick seeks nothing', async () => {
    const playhead = createPlayheadStore();
    playhead.set({ time: 100 });
    const onSeek = mock((_t: number) => {});
    const slider = await mount(playhead, onSeek);
    await key(slider, 'ArrowLeft');
    await key(slider, 'ArrowLeft', true);
    await key(slider, 'ArrowLeft', true);
    expect(onSeek.mock.calls).toEqual([[90]]);
  });

  test('Home and End go to either end of the film', async () => {
    const onSeek = mock((_t: number) => {});
    const slider = await mount(createPlayheadStore(), onSeek);
    await key(slider, 'End');
    await key(slider, 'Home');
    expect(onSeek.mock.calls).toEqual([[600], [0]]);
  });
});

describe('SeekBar — a pointer drag', () => {
  test('draws where the pointer is and seeks once, where it lets go', async () => {
    const playhead = createPlayheadStore();
    const onSeek = mock((_t: number) => {});
    const slider = await mount(playhead, onSeek);
    slider.getBoundingClientRect = () =>
      ({ left: 0, width: 200, top: 0, height: 8 }) as DOMRect;
    slider.setPointerCapture = () => {};
    slider.hasPointerCapture = () => true;
    slider.releasePointerCapture = () => {};

    const pointer = (type: string, clientX: number) =>
      act(async () => {
        slider.dispatchEvent(
          new PointerEvent(type, {
            clientX,
            button: 0,
            pointerId: 1,
            pointerType: 'mouse',
            bubbles: true,
          }),
        );
      });

    await pointer('pointerdown', 50);
    await pointer('pointermove', 100);
    // A `timeupdate` mid-drag does not pull the thumb back.
    await act(async () => playhead.set({ time: 10 }));
    expect(slider.getAttribute('aria-valuenow')).toBe('300');
    expect(onSeek).not.toHaveBeenCalled();

    await pointer('pointerup', 150);
    expect(onSeek.mock.calls).toEqual([[450]]);
    expect(slider.getAttribute('aria-valuenow')).toBe('10');
  });
});

describe('SeekBar — FEAT-20260924-679', () => {
  const hover = (target: HTMLElement, type: string, init: PointerEventInit) =>
    act(async () => {
      target.dispatchEvent(new PointerEvent(type, { bubbles: true, ...init }));
    });

  test('three layers in three tokens: rest, buffered, played', async () => {
    const playhead = createPlayheadStore();
    playhead.set({ time: 60, buffered: 50 });
    const slider = await mount(playhead, () => {});
    expect(slider.className.split(' ')).toContain('bg-line-strong');
    const layers = [...slider.children].map((c) => c.className.split(' '));
    expect(layers.some((c) => c.includes('bg-ink-3'))).toBe(true);
    expect(layers.some((c) => c.includes('bg-ink'))).toBe(true);
  });

  test('the thumb is not inside the track, so the hover scale cannot stretch it', async () => {
    const slider = await mount(createPlayheadStore(), () => {});
    const thumb = slider.parentElement?.querySelector('.size-4');
    expect(thumb).not.toBeNull();
    expect(slider.contains(thumb ?? null)).toBe(false);
  });

  test('a resting mouse shows the time under it, and leaving clears it', async () => {
    const slider = await mount(createPlayheadStore(), () => {});
    slider.getBoundingClientRect = () =>
      ({ left: 0, width: 200, top: 0, height: 8 }) as DOMRect;
    const bubble = () => slider.parentElement?.querySelector('.glass-clear');

    await hover(slider, 'pointermove', { clientX: 50, pointerType: 'mouse' });
    expect(bubble()?.textContent).toBe('2:30');

    await hover(slider, 'pointerout', {
      pointerType: 'mouse',
      relatedTarget: document.body,
    });
    expect(bubble()).toBeNull();
  });

  test('a finger resting on the bar is not a hover', async () => {
    const slider = await mount(createPlayheadStore(), () => {});
    slider.getBoundingClientRect = () =>
      ({ left: 0, width: 200, top: 0, height: 8 }) as DOMRect;
    await hover(slider, 'pointermove', { clientX: 50, pointerType: 'touch' });
    expect(slider.parentElement?.querySelector('.glass-clear')).toBeNull();
  });
});
