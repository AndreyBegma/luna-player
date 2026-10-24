/**
 * BUG-20260919-628 — `focusAwayFromHiddenStrip` is the fix: the pause strip
 * hides by prop, not by unmounting, so a focus left inside it needs somewhere
 * real to go rather than sitting on a control nobody can see.
 */
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'bun:test';
import { registerDom, unregisterDom } from '../test-dom-shim';
import { focusAwayFromHiddenStrip } from './transport-focus';

let container: HTMLDivElement;

beforeAll(() => {
  registerDom();
  container = document.createElement('div');
  // The real player container carries `tabIndex={-1}` for exactly this
  // fallback (`video-player.tsx`) — without it `.focus()` is a no-op.
  container.tabIndex = -1;
  document.body.appendChild(container);
});

// FEAT-20260925-718 L2 — the package's preload empties `document.body` after
// every test (`test-setup.ts`), which detaches the container attached once
// above; a detached element cannot take focus.
beforeEach(() => {
  document.body.appendChild(container);
});

afterEach(() => {
  container.innerHTML = '';
});

afterAll(() => {
  container.remove();
  unregisterDom();
});

/** A container holding a hidden pause strip and, optionally, a cluster. */
function build(options: { withCluster: boolean }): {
  link: HTMLAnchorElement;
  primary: HTMLButtonElement | null;
} {
  container.innerHTML = `
    <div data-nav-section="pause-strip" aria-hidden="true">
      <a href="/people/1" tabindex="-1">Actor</a>
    </div>
    ${options.withCluster ? '<button data-centre-transport-primary>Play</button>' : ''}
  `;
  const link = container.querySelector<HTMLAnchorElement>('a');
  if (!link) throw new Error('expected the strip link to exist');
  const primary = container.querySelector<HTMLButtonElement>(
    '[data-centre-transport-primary]',
  );
  return { link, primary };
}

describe('focusAwayFromHiddenStrip', () => {
  it('moves focus to the centre cluster primary when the strip held it', () => {
    const { link, primary } = build({ withCluster: true });
    link.focus();
    expect(document.activeElement).toBe(link);

    focusAwayFromHiddenStrip(container);

    expect(document.activeElement).toBe(primary);
  });

  it('falls back to the container when there is no cluster on screen', () => {
    const { link } = build({ withCluster: false });
    link.focus();

    focusAwayFromHiddenStrip(container);

    expect(document.activeElement).toBe(container);
  });

  it('leaves focus alone when it was never inside the strip', () => {
    build({ withCluster: true });
    const outsider = document.createElement('button');
    container.appendChild(outsider);
    outsider.focus();

    focusAwayFromHiddenStrip(container);

    expect(document.activeElement).toBe(outsider);
  });

  it('leaves focus alone when nothing in the strip is focused at all', () => {
    build({ withCluster: true });
    // document.body is the default activeElement with nothing focused.
    (document.activeElement as HTMLElement | null)?.blur();
    const before = document.activeElement;

    focusAwayFromHiddenStrip(container);

    expect(document.activeElement).toBe(before);
  });
});
