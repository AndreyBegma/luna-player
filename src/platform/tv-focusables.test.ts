/**
 * FEAT-661 Q-05 — what the remote is allowed to land on.
 *
 * `spatial.test.ts` owns the geometry; this file owns the reading that feeds
 * it. The rule worth pinning is the one its comment gives a reason for: the
 * rest of the page is `inert` or `aria-hidden` while a modal is up, and a
 * remote that could still land there would walk out of an open dialog.
 */
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test } from 'bun:test';
import { registerDom, unregisterDom } from '../test-dom-shim';
import { candidateFor, collectFocusable } from './tv-focusables';

let container: HTMLDivElement;

beforeAll(() => {
  registerDom();
  container = document.createElement('div');
  document.body.appendChild(container);
});

/**
 * FEAT-20260925-718 L1 — `test-setup.ts`'s global `afterEach` clears
 * `document.body` after every test in the run (for components mounted with
 * `createRoot`, which have no other cleanup). That also detaches this file's
 * own long-lived `container` once the first test finishes; re-appending it
 * (a no-op if it is already attached) keeps `getComputedStyle` reading it as
 * part of the document instead of a disconnected subtree.
 */
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

/** happy-dom lays nothing out: give every element a box unless told not to. */
function lay(sizeless: string[] = []) {
  for (const el of container.querySelectorAll<HTMLElement>('*')) {
    const size = sizeless.includes(el.id) ? 0 : 100;
    el.getBoundingClientRect = () => new DOMRect(0, 0, size, size);
  }
}

const ids = () => collectFocusable(container).map((c) => c.ref.id);

describe('collectFocusable', () => {
  test('finds links, enabled controls and positive tab stops', () => {
    container.innerHTML = `
      <a id="link" href="/x">x</a>
      <a id="bare">no href</a>
      <button id="on">on</button>
      <button id="off" disabled>off</button>
      <input id="field" />
      <div id="stop" tabindex="0">stop</div>
      <div id="script-only" tabindex="-1">script</div>`;
    lay();
    expect(ids()).toEqual(['link', 'on', 'field', 'stop']);
  });

  test('skips what a modal has made inert or hidden behind it', () => {
    container.innerHTML = `
      <div inert><button id="inert">a</button></div>
      <div aria-hidden="true"><button id="hidden">b</button></div>
      <div role="dialog"><button id="in-dialog">c</button></div>`;
    lay();
    expect(ids()).toEqual(['in-dialog']);
  });

  test('skips what is not on screen', () => {
    container.innerHTML = `
      <button id="collapsed">a</button>
      <button id="invisible" style="visibility: hidden">b</button>
      <button id="transparent" style="opacity: 0">c</button>
      <button id="shown">d</button>`;
    lay(['collapsed']);
    expect(ids()).toEqual(['shown']);
  });

  test('reads the nearest section, and none outside one', () => {
    container.innerHTML = `
      <div data-nav-section="row"><div><button id="in">a</button></div></div>
      <button id="out">b</button>`;
    lay();
    const sections = collectFocusable(container).map((c) => c.section);
    expect(sections).toEqual(['row', null]);
    const inRow = container.querySelector('#in') as HTMLElement;
    expect(candidateFor(inRow).section).toBe('row');
  });
});
