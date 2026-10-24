/**
 * BUG-20260924-687 — "Raised" is the control bar's measured clearance, written
 * on the player where the native cues and the learning layer read it.
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
import { act, useRef } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { barClearance, useBarClearance } from './use-bar-clearance';

let root: Root | null = null;
let host: HTMLDivElement;
let realObserver: typeof ResizeObserver;
let observed: (() => void) | null = null;

beforeAll(() => {
  registerDom();
  (
    globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
  realObserver = globalThis.ResizeObserver;
  globalThis.ResizeObserver = class {
    constructor(callback: () => void) {
      observed = callback;
    }
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
});

afterEach(() => {
  act(() => root?.unmount());
  root = null;
  host?.remove();
  observed = null;
});

afterAll(() => {
  globalThis.ResizeObserver = realObserver;
  unregisterDom();
});

/** happy-dom lays nothing out: give the bar and its box the numbers a browser would. */
function layout(bar: HTMLElement, boxHeight: number, barTop: number) {
  const box = bar.parentElement as HTMLElement;
  Object.defineProperty(bar, 'offsetParent', {
    value: box,
    configurable: true,
  });
  Object.defineProperty(bar, 'offsetTop', {
    get: () => barTop,
    configurable: true,
  });
  Object.defineProperty(box, 'clientHeight', {
    get: () => boxHeight,
    configurable: true,
  });
}

function mount(boxHeight: number, barTop: number) {
  host = document.createElement('div');
  document.body.appendChild(host);
  const box = document.createElement('div');
  host.appendChild(box);

  function Bar() {
    const ref = useRef<HTMLDivElement>(null);
    useBarClearance(ref, host);
    return (
      <div
        ref={(node) => {
          ref.current = node;
          if (node) layout(node, boxHeight, barTop);
        }}
      />
    );
  }

  root = createRoot(box);
  act(() => root?.render(<Bar />));
}

const clearance = () => host.style.getPropertyValue('--player-bar-clearance');

describe('barClearance', () => {
  test('the bar top counted up from the bottom of the picture, plus a gap', () => {
    expect(barClearance(220, 60)).toBe(168);
    expect(barClearance(810, 690)).toBe(128);
  });

  test('never negative', () => {
    expect(barClearance(100, 200)).toBe(0);
  });
});

describe('useBarClearance', () => {
  test('writes the clearance on the player', () => {
    mount(390, 250);
    expect(clearance()).toBe('148px');
  });

  test('re-measures when the observer reports a change', () => {
    mount(390, 250);
    const bar = host.firstElementChild?.firstElementChild as HTMLElement;
    layout(bar, 844, 700);
    act(() => observed?.());
    expect(clearance()).toBe('152px');
  });

  test('takes it off the player when the bar goes', () => {
    mount(390, 250);
    act(() => root?.unmount());
    root = null;
    expect(clearance()).toBe('');
  });
});
