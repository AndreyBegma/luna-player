/**
 * FEAT-20260923-661 Q-04 — the key handler's guards, in the order they run.
 *
 * `player-keys.test.ts` holds the table; this holds what the handler does with
 * it, which is where BUG-20260820-236, BUG-20260820-238 and BUG-20260823-368
 * each lived. Real `KeyboardEvent`s are dispatched on whatever holds focus and
 * bubble to the window, as a keyboard's and a remote's do; the player's own
 * doors are recorded rather than run.
 */
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test } from 'bun:test';
import { act, useRef } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { registerDom, unregisterDom } from '../test-dom-shim';
import { createPlayheadStore } from './playhead-store';
import { usePlayerKeys } from './use-player-keys';

type Options = Parameters<typeof usePlayerKeys>[0];
type Overrides = Partial<
  Pick<
    Options,
    'showControls' | 'fullscreenActive' | 'pseudoFullscreen' | 'finePointer' | 'duration'
  >
>;

let host: HTMLDivElement;
let root: Root | null = null;
let calls: string[];
let helpOpen: boolean;
const introActiveRef = { current: false };

function Harness(over: Overrides) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const playhead = useRef(createPlayheadStore()).current;
  const record = (name: string) => () => {
    calls.push(name);
  };
  const keys = usePlayerKeys({
    videoRef,
    containerRef,
    introActiveRef,
    showControls: over.showControls ?? false,
    fullscreenActive: over.fullscreenActive ?? false,
    pseudoFullscreen: over.pseudoFullscreen ?? false,
    finePointer: over.finePointer ?? true,
    menuOpen: false,
    duration: over.duration ?? 100,
    playhead,
    doPlay: record('doPlay'),
    ensurePlaying: record('ensurePlaying'),
    exitFullscreen: record('exitFullscreen'),
    toggleFullscreen: record('toggleFullscreen'),
    seekToTime: (t) => calls.push(`seek:${t}`),
    seekRestartsStream: () => false,
    showAndScheduleHide: record('show'),
    hideControls: record('hide'),
    setVolume: (v) => calls.push(`volume:${v.toFixed(1)}`),
    setMuted: (m) => calls.push(`muted:${m}`),
    onStepSpeed: () => 1,
    onToggleSubtitles: record('subtitles'),
    onRepeatLine: null,
    onPrevEpisode: null,
    onNextEpisode: null,
    onEpisodeChange: undefined,
  });
  helpOpen = keys.helpOpen;
  return (
    <div ref={containerRef} tabIndex={-1} data-testid="player">
      <video ref={videoRef}>
        <track kind="captions" />
      </video>
      <button type="button" data-testid="control">
        Play
      </button>
      <div
        role="slider"
        tabIndex={0}
        aria-valuenow={0}
        aria-valuemin={0}
        aria-valuemax={100}
        data-testid="slider"
      />
    </div>
  );
}

function mount(over: Overrides = {}) {
  act(() => root?.render(<Harness {...over} />));
}

const player = () => host.querySelector<HTMLElement>('[data-testid="player"]') as HTMLElement;
const control = () => host.querySelector<HTMLElement>('[data-testid="control"]') as HTMLElement;
const slider = () => host.querySelector<HTMLElement>('[data-testid="slider"]') as HTMLElement;

/** Press a key on whatever holds focus; answers whether the page lost it. */
function press(init: KeyboardEventInit): boolean {
  const event = new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init });
  const target = document.activeElement ?? document.body;
  act(() => {
    target.dispatchEvent(event);
  });
  return event.defaultPrevented;
}

beforeAll(() => {
  registerDom();
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

afterAll(() => {
  unregisterDom();
});

beforeEach(() => {
  calls = [];
  helpOpen = false;
  introActiveRef.current = false;
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
});

afterEach(() => {
  act(() => root?.unmount());
  root = null;
  host.remove();
  (document.activeElement as HTMLElement | null)?.blur?.();
});

describe('usePlayerKeys — the transport keys are always the player’s', () => {
  test('MediaPlayPause plays with focus on the page', () => {
    mount();
    expect(press({ key: 'MediaPlayPause' })).toBe(true);
    expect(calls).toContain('doPlay');
  });

  test('nothing answers while the branded clip runs', () => {
    introActiveRef.current = true;
    mount();
    expect(press({ key: 'MediaPlayPause' })).toBe(false);
    player().focus();
    expect(press({ key: ' ', code: 'Space' })).toBe(false);
    expect(calls).toEqual([]);
  });
});

describe('usePlayerKeys — BUG-20260823-368: a player nobody is using leaves the keys to the page', () => {
  test('Space and the arrows scroll the page with focus on <body>', () => {
    mount();
    expect(press({ key: ' ', code: 'Space' })).toBe(false);
    expect(press({ key: 'ArrowDown', code: 'ArrowDown' })).toBe(false);
    expect(calls.filter((c) => c !== 'show')).toEqual([]);
  });

  test('focus inside the player makes it the player’s', () => {
    mount();
    player().focus();
    expect(press({ key: ' ', code: 'Space' })).toBe(true);
    expect(calls).toContain('doPlay');
  });

  test('fullscreen makes it the player’s with focus on nothing', () => {
    mount({ fullscreenActive: true });
    expect(press({ key: ' ', code: 'Space' })).toBe(true);
    expect(calls).toContain('doPlay');
  });

  test('a digit jumps to that tenth of the film', () => {
    mount({ duration: 200 });
    player().focus();
    press({ key: '5', code: 'Digit5' });
    expect(calls).toContain('seek:100');
  });
});

describe('usePlayerKeys — BUG-20260820-236 / 238: Enter and a focused control', () => {
  test('with the controls up, Enter on a focused control is the control’s', () => {
    mount({ showControls: true });
    control().focus();
    expect(press({ key: 'Enter', code: 'Enter' })).toBe(false);
    expect(calls).not.toContain('doPlay');
  });

  test('with the controls down, the stranded control does not keep it', () => {
    mount({ showControls: false });
    control().focus();
    expect(press({ key: 'Enter', code: 'Enter' })).toBe(true);
    expect(calls).toContain('doPlay');
  });

  test('K is not an activation key and is never deferred', () => {
    mount({ showControls: true });
    control().focus();
    expect(press({ key: 'k', code: 'KeyK' })).toBe(true);
    expect(calls).toContain('doPlay');
  });
});

describe('usePlayerKeys — BUG-20260924-691: only the arrows defer to the scrubber', () => {
  test('Space, K, M and F still answer while the slider holds focus', () => {
    mount({ showControls: true });
    slider().focus();
    expect(press({ key: ' ', code: 'Space' })).toBe(true);
    expect(calls).toContain('doPlay');
    calls = [];
    press({ key: 'm', code: 'KeyM' });
    expect(calls).toContain('muted:true');
    calls = [];
    press({ key: 'f', code: 'KeyF' });
    expect(calls).toContain('toggleFullscreen');
  });

  test('ArrowLeft still defers to the slider', () => {
    mount({ showControls: true });
    slider().focus();
    expect(press({ key: 'ArrowLeft', code: 'ArrowLeft' })).toBe(false);
    expect(calls).toEqual(['show']);
  });
});

describe('usePlayerKeys — Back and the sheet', () => {
  test('on a television Back hides the controls and does not bring them back', () => {
    mount({ showControls: true, finePointer: false });
    player().focus();
    expect(press({ key: 'GoBack' })).toBe(true);
    expect(calls).toEqual(['hide']);
  });

  test('? opens the sheet, and the player stops listening while it is up', () => {
    mount();
    player().focus();
    expect(press({ key: '?', code: 'Slash', shiftKey: true })).toBe(true);
    expect(helpOpen).toBe(true);
    calls = [];
    expect(press({ key: 'f', code: 'KeyF' })).toBe(false);
    expect(calls.filter((c) => c !== 'show')).toEqual([]);
  });
});

describe('usePlayerKeys — FEAT-20260923-661 Q-03: the controls come up only for the player’s keys', () => {
  test('typing and scrolling elsewhere on the page leave the controls down', () => {
    mount();
    const search = document.createElement('input');
    document.body.appendChild(search);
    search.focus();
    press({ key: 'k', code: 'KeyK' });
    press({ key: 'm', code: 'KeyM' });
    search.remove();
    press({ key: 'ArrowDown', code: 'ArrowDown' });
    expect(calls).toEqual([]);
  });

  test('a key the player answers brings them up, and a transport key does from anywhere', () => {
    mount();
    press({ key: 'MediaPlayPause' });
    expect(calls).toEqual(['show', 'doPlay']);
    calls = [];
    player().focus();
    press({ key: 'm', code: 'KeyM' });
    expect(calls[0]).toBe('show');
  });
});

describe('usePlayerKeys — FEAT-20260923-661 Q-01: chords are the browser’s', () => {
  test('Ctrl+C, Ctrl+1 and Alt+← do nothing in the player and are not prevented', () => {
    mount({ fullscreenActive: true });
    expect(press({ key: 'c', code: 'KeyC', ctrlKey: true })).toBe(false);
    expect(press({ key: '1', code: 'Digit1', ctrlKey: true })).toBe(false);
    expect(press({ key: 'ArrowLeft', code: 'ArrowLeft', altKey: true })).toBe(false);
    expect(calls).toEqual([]);
  });
});
