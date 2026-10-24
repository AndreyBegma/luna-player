/**
 * FEAT-20260924-679 — the bar's tooltips on the television open only once
 * focus has rested.
 *
 * Read off the trigger's `data-state`, which Radix sets from the open state
 * this component controls. happy-dom does not draw the content of a tooltip
 * opened after mount; that it is drawn inside `container` is glass-ui's own
 * test (`tooltip.test.tsx`).
 *
 * BUG-20260924-687 — and they go when the bar does.
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
import { BarTooltip, BarVisibleContext } from './bar-tooltip';

let host: HTMLDivElement;
let root: Root | null = null;
let realMatchMedia: typeof window.matchMedia;

beforeAll(() => {
  registerDom();
  (
    globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
  realMatchMedia = window.matchMedia;
});

afterEach(async () => {
  window.matchMedia = realMatchMedia;
  if (root) {
    const r = root;
    root = null;
    await act(async () => r.unmount());
  }
  host?.remove();
});

afterAll(() => unregisterDom());

function television(on: boolean) {
  window.matchMedia = ((query: string) => ({
    ...realMatchMedia(query),
    matches: on,
  })) as typeof window.matchMedia;
}

function render(barVisible: boolean) {
  root?.render(
    <BarVisibleContext value={barVisible}>
      <BarTooltip label="Subtitles" portalHost={host}>
        <button type="button">S</button>
      </BarTooltip>
    </BarVisibleContext>,
  );
}

async function mountAndFocus() {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => render(true));
  const trigger = host.querySelector('button');
  // happy-dom's `focus()` sends no `focusin`, which is what React's `onFocus` listens to.
  await act(async () => {
    trigger?.focus();
    trigger?.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
  });
}

const setBarVisible = (visible: boolean) => act(async () => render(visible));

const isOpen = () =>
  host.querySelector('button')?.getAttribute('data-state') !== 'closed';
const rest = (ms: number) =>
  act(async () => {
    await new Promise((r) => setTimeout(r, ms));
  });

describe('BarTooltip', () => {
  test('away from the television, focus names the control at once', async () => {
    television(false);
    await mountAndFocus();
    expect(isOpen()).toBe(true);
  });

  test('on the television, only after focus has rested', async () => {
    television(true);
    await mountAndFocus();
    expect(isOpen()).toBe(false);
    await rest(650);
    expect(isOpen()).toBe(true);
  });

  test('on the television, focus passing through never shows it', async () => {
    television(true);
    await mountAndFocus();
    await act(async () => {
      const trigger = host.querySelector('button');
      trigger?.blur();
      trigger?.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
    });
    await rest(650);
    expect(isOpen()).toBe(false);
  });

  test('the bar hiding closes an open name, focus still on its control', async () => {
    television(false);
    await mountAndFocus();
    expect(isOpen()).toBe(true);
    await setBarVisible(false);
    expect(isOpen()).toBe(false);
    // Nothing reopens it by itself when the bar comes back.
    await setBarVisible(true);
    expect(isOpen()).toBe(false);
  });

  test('on the television, a rest still pending when the bar hides never opens', async () => {
    television(true);
    await mountAndFocus();
    await setBarVisible(false);
    await rest(650);
    expect(isOpen()).toBe(false);
    await setBarVisible(true);
    expect(isOpen()).toBe(false);
  });

  test('the television rest after Back: open, then gone with the bar', async () => {
    television(true);
    await mountAndFocus();
    await rest(650);
    expect(isOpen()).toBe(true);
    await setBarVisible(false);
    expect(isOpen()).toBe(false);
  });
});
