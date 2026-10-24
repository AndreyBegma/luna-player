/**
 * FEAT-20260923-661 (W-WEB-player-controls) — the bar's own decisions: which
 * way the two step buttons go, and whether a pressed toggle looks pressed.
 * The menus it hosts have their own tests; here they are only mounted.
 *
 * FEAT-20260925-718 L3 — lifted with the stripped bar. The cases for the
 * controls this slice removes (cast and picture-in-picture pressed states,
 * the episode/ten-second step buttons and their glyphs, now-playing in the
 * middle and on the phone row) are gone with them; the two tooltip cases
 * that used the picture-in-picture button as their vehicle use play/pause.
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
import { en as messagesEn } from '../labels/en';
import { ControlBar, type ControlBarProps } from './control-bar';
import { LabelsProvider } from '../labels';
import { TEST_LABELS } from './labels/test-labels';
import { createPlayheadStore } from './playhead-store';

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

function props(overrides: Partial<ControlBarProps> = {}): ControlBarProps {
  const playhead = createPlayheadStore();
  playhead.set({ time: 100 });
  return {
    portalHost: null,
    playhead,
    duration: 600,
    playing: true,
    muted: false,
    volume: 1,
    playbackRate: 1,
    isTouchDevice: false,
    fullscreenActive: false,
    introRange: undefined,
    outroRange: undefined,
    onSeek: noop,
    onPlayPause: noop,
    onToggleMute: noop,
    onVolumeChange: noop,
    onCycleSpeed: noop,
    onToggleFullscreen: noop,
    visible: true,
    ...overrides,
  };
}

function barWith(p: ControlBarProps) {
  return (
    <LabelsProvider labels={TEST_LABELS}>
      <ControlBar {...p} />
    </LabelsProvider>
  );
}

async function mount(p: ControlBarProps) {
  root = createRoot(container);
  await act(async () => {
    root?.render(barWith(p));
  });
}

function button(name: string): HTMLButtonElement {
  const found = container.querySelector<HTMLButtonElement>(
    `button[aria-label="${name}"]`,
  );
  if (!found) throw new Error(`no button named ${name}`);
  return found;
}

const en = messagesEn;

describe('ControlBar — FEAT-20260924-679', () => {
  const icon = (name: string) =>
    [...(button(name).querySelector('svg')?.classList ?? [])].find((c) =>
      c.startsWith('lucide-'),
    );

  test('speed is an icon, with the rate as a badge only when it is not 1×', async () => {
    await mount(props());
    const plain = button('Playback speed 1×');
    expect(icon('Playback speed 1×')).toBe('lucide-gauge');
    expect(plain.textContent).toBe('');

    await act(async () => root?.unmount());
    root = null;
    await mount(props({ playbackRate: 1.5 }));
    expect(button('Playback speed 1.5×').textContent).toBe('1.5×');
  });

  test('hiding the bar closes the tooltip its focused control opened (BUG-20260924-687)', async () => {
    await mount(props());
    await act(async () => {
      button(en.ariaPause).dispatchEvent(
        new FocusEvent('focusin', { bubbles: true }),
      );
    });
    expect(button(en.ariaPause).getAttribute('data-state')).not.toBe('closed');
    await act(async () => root?.render(barWith(props({ visible: false }))));
    expect(button(en.ariaPause).getAttribute('data-state')).toBe('closed');
  });

  test('focus on a control opens its tooltip', async () => {
    await mount(props());
    expect(button(en.ariaPause).getAttribute('data-state')).toBe('closed');
    // happy-dom's `focus()` sends no `focusin`, which React's `onFocus` listens to.
    await act(async () => {
      button(en.ariaPause).dispatchEvent(
        new FocusEvent('focusin', { bubbles: true }),
      );
    });
    expect(button(en.ariaPause).getAttribute('data-state')).not.toBe('closed');
  });
});

/**
 * FEAT-20260925-718 L3 — every control on the stripped bar is a real button
 * with a name a screen reader can say, whatever state it is drawn in.
 */
describe('ControlBar — every button has an accessible name', () => {
  const states: [string, Partial<ControlBarProps>][] = [
    ['playing, unmuted, inline', {}],
    [
      'paused, muted, fullscreen, at 1.5×',
      { playing: false, muted: true, fullscreenActive: true, playbackRate: 1.5 },
    ],
  ];
  test.each(states)('%s', async (_state, overrides) => {
    await mount(props(overrides));
    const buttons = [...container.querySelectorAll('button')];
    expect(buttons.length).toBeGreaterThanOrEqual(6);
    for (const b of buttons) {
      expect(b.getAttribute('aria-label')?.trim() || b.textContent?.trim()).toBeTruthy();
    }
    const names = buttons.map((b) => b.getAttribute('aria-label'));
    expect(names).toContain(overrides.playing === false ? en.ariaPlay : en.ariaPause);
    expect(names).toContain(overrides.muted ? en.ariaUnmute : en.ariaMute);
    expect(names).toContain(
      overrides.fullscreenActive ? en.ariaExitFullscreen : en.ariaEnterFullscreen,
    );
  });
});
