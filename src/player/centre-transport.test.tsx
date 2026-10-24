/**
 * BUG-20260919-623 — the three discs are icon-only chrome directly over the
 * picture, the rung `glass-clear` was cut for
 * (glass-material.md#the-third-rung); they landed on plain `glass` while the
 * pin was still in flight. This asserts the class, not the pixels — the
 * frame under `06-ui/assets/BUG-20260919-623-1-discs.png` is the visual
 * check.
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
import { CentreTransport } from './centre-transport';
import { LabelsProvider } from '../labels';
import { TEST_LABELS } from './labels/test-labels';

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

async function mount(mode: 'idle' | 'cluster', playing: boolean) {
  root = createRoot(container);
  await act(async () => {
    root?.render(
      <LabelsProvider labels={TEST_LABELS}>
        <CentreTransport
          mode={mode}
          mediaReady
          playing={playing}
          title="A film"
          onPlay={() => {}}
          onSeekBy={() => {}}
        />
      </LabelsProvider>,
    );
  });
}

const discs = () =>
  Array.from(container.querySelectorAll('button')) as HTMLButtonElement[];

describe('the discs sit on the clear rung', () => {
  test('all three of the cluster carry glass-clear, none carries plain glass', async () => {
    await mount('cluster', true);
    const buttons = discs();
    expect(buttons.length).toBe(3);
    for (const button of buttons) {
      const classes = button.className.split(/\s+/);
      expect(classes).toContain('glass-clear');
      expect(classes).not.toContain('glass');
      expect(classes).not.toContain('glass-strong');
    }
  });

  test('the idle disc is also glass-clear', async () => {
    await mount('idle', false);
    const buttons = discs();
    expect(buttons.length).toBe(1);
    const classes = buttons[0].className.split(/\s+/);
    expect(classes).toContain('glass-clear');
    expect(classes).not.toContain('glass');
  });
});
