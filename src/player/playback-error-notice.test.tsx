/**
 * FEAT-20260923-661 (W-WEB-player-engine) — the notice shown when hls.js has
 * given up: said out loud, and Retry within reach of a remote.
 */
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  test,
} from 'bun:test';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { en as messagesEn } from '../labels/en';
import { registerDom, unregisterDom } from '../test-dom-shim';
import { LabelsProvider } from '../labels';
import { TEST_LABELS } from './labels/test-labels';
import { PlaybackErrorNotice } from './playback-error-notice';

let container: HTMLDivElement;
let root: Root | null = null;
let before: HTMLButtonElement;
let retries: number;

function show(shown: boolean) {
  act(() =>
    root?.render(
      <LabelsProvider labels={TEST_LABELS}>
        {shown && <PlaybackErrorNotice onRetry={() => retries++} />}
      </LabelsProvider>,
    ),
  );
}

beforeAll(() => {
  registerDom();
  (
    globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
});

afterAll(() => {
  unregisterDom();
});

beforeEach(() => {
  retries = 0;
  before = document.createElement('button');
  document.body.appendChild(before);
  before.focus();
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  show(true);
});

afterEach(() => {
  act(() => root?.unmount());
  root = null;
  container.remove();
  before.remove();
});

const retry = () => container.querySelector('button') as HTMLButtonElement;

describe('PlaybackErrorNotice', () => {
  test('Retry retries', () => {
    act(() => retry().click());
    expect(retries).toBe(1);
  });

  // Q-07 — the design system's white primary. FEAT-20260925-718 L3 — Glass
  // UI 0.34 (this package's dev pin; luna-watch is on 0.20) draws `solid`
  // in the accent, so the check is for that variant rather than its colour.
  test('Retry is the design system button', () => {
    expect(retry().className).toContain('after:h-(--size-tap)');
    expect(retry().className).toContain('bg-accent');
  });

  // Q-08 — announced, and on a television the remote lands on Retry.
  test('the failure is announced', () => {
    const alert = container.querySelector('[role="alert"]');
    expect(alert?.textContent).toContain(messagesEn.playbackFailed);
  });

  test('Retry takes focus, and gives it back when the notice goes', () => {
    expect(document.activeElement).toBe(retry());
    show(false);
    expect(document.activeElement).toBe(before);
  });
});
