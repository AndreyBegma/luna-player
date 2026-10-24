/**
 * FEAT-20260923-661 (W-WEB-player-audio-subs Q-02) — the wheel over the volume
 * group: a notch up or down is a step, and a sideways scroll is not a volume
 * change at all — it used to unmute, and while muted it silenced the film.
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
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { LabelsProvider } from '../labels';
import { TEST_LABELS } from './labels/test-labels';
import { VolumeControl } from './volume-control';

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
    await act(async () => r.unmount());
  }
});

afterAll(() => {
  container.remove();
  unregisterDom();
});

async function mount(muted: boolean, volume: number) {
  const changes: number[] = [];
  root = createRoot(container);
  await act(async () => {
    root?.render(
      <LabelsProvider labels={TEST_LABELS}>
        <VolumeControl
          portalHost={null}
          muted={muted}
          volume={volume}
          onToggleMute={() => {}}
          onVolumeChange={(v) => changes.push(v)}
        />
      </LabelsProvider>,
    );
  });
  const group = container.firstElementChild as HTMLElement;
  const wheel = (deltaX: number, deltaY: number) => {
    const event = new WheelEvent('wheel', {
      deltaX,
      deltaY,
      cancelable: true,
    });
    group.dispatchEvent(event);
    return event.defaultPrevented;
  };
  return { changes, wheel };
}

describe('VolumeControl wheel', () => {
  test('a notch away from the viewer is quieter, towards is louder', async () => {
    const { changes, wheel } = await mount(false, 0.5);
    expect(wheel(0, 100)).toBe(true);
    expect(wheel(0, -100)).toBe(true);
    expect(changes).toEqual([0.45, 0.55]);
  });

  test('a notch up while muted starts from silence', async () => {
    const { changes, wheel } = await mount(true, 0.8);
    wheel(0, -100);
    expect(changes).toEqual([0.05]);
  });

  test('a sideways scroll is not a volume change and is left to the page', async () => {
    const { changes, wheel } = await mount(true, 0.8);
    expect(wheel(40, 0)).toBe(false);
    expect(changes).toEqual([]);
  });
});
