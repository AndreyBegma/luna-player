/**
 * FEAT-20260924-680 (increment 2) — when a start is a launch, and what the
 * veil and the picture do through one.
 *
 * The rules under test are `launch-veil.tsx`'s three: a first play, the frame
 * filling the screen within a second of it while playing, and no fullscreen
 * frame torn down in the last three seconds (the next episode).
 */
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  setSystemTime,
  test,
} from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { act, type RefObject } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { TELEVISION } from '../platform/media-query';
import { registerDom, unregisterDom } from '../test-dom-shim';
import {
  type Launch,
  LaunchFrameProvider,
  LaunchVeil,
  useLaunch,
} from './launch-veil';

let container: HTMLDivElement;
let root: Root | null = null;
// A day ahead of the real clock: other files in this process tear frames down
// at their own times, and the next-episode rule reads one module-level
// record. Each file that tears frames down has its own day (this one, then
// `video-element`, then `player-frame`), so none lands in another's window.
let clock = Date.now() + 86_400_000;
let originalMatchMedia: typeof window.matchMedia;

beforeAll(() => {
  registerDom();
  originalMatchMedia = window.matchMedia;
  (
    globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement('div');
  document.body.appendChild(container);
});

beforeEach(() => {
  // Every test starts well clear of any teardown a previous one recorded.
  clock += 60_000;
  setSystemTime(new Date(clock));
});

afterEach(async () => {
  window.matchMedia = originalMatchMedia;
  if (root) {
    const r = root;
    root = null;
    await act(async () => {
      r.unmount();
    });
  }
});

afterAll(() => {
  setSystemTime();
  container.remove();
  unregisterDom();
});

function advance(ms: number) {
  clock += ms;
  setSystemTime(new Date(clock));
}

// FEAT-20260925-718 L3 — writable here: luna-watch's tsc skips test files,
// and this package's includes them, where `paused` is read-only.
const video: { paused: boolean } = { paused: true };
const videoRef = { current: video } as unknown as RefObject<HTMLVideoElement | null>;
let launch: Launch;

function Harness() {
  launch = useLaunch(videoRef);
  return (
    <>
      <span id="picture" data-launch={launch.video} />
      {launch.veil && (
        <LaunchVeil
          state={launch.veil}
          poster="/backdrop.jpg"
          onEnd={launch.onVeilEnd}
        />
      )}
    </>
  );
}

function render(fullscreen: boolean) {
  root ??= createRoot(container);
  const r = root;
  return act(async () => {
    r.render(
      <LaunchFrameProvider fullscreen={fullscreen}>
        <Harness />
      </LaunchFrameProvider>,
    );
  });
}

const picture = () =>
  container.querySelector('#picture')?.getAttribute('data-launch') ?? undefined;
const veil = () =>
  container.querySelector('.launch-veil')?.getAttribute('data-veil') ??
  undefined;

async function fire(handler: keyof Omit<Launch, 'video' | 'veil'>) {
  await act(async () => {
    launch[handler]();
  });
}

/** `animationend` from the image (the run) or from the layer (the release). */
async function veilEnds() {
  const layer = container.querySelector('.launch-veil');
  if (!layer) throw new Error('no veil');
  const target =
    layer.getAttribute('data-veil') === 'release'
      ? layer
      : layer.querySelector('.launch-veil-image');
  await act(async () => {
    target?.dispatchEvent(new Event('animationend', { bubbles: true }));
  });
}

/** Watch's door: `play()` in the gesture, fullscreen 100 ms later. */
async function launchFromTitle() {
  await render(false);
  video.paused = false;
  await fire('onPlay');
  advance(100);
  await render(true);
}

describe('a launch from the title page', () => {
  test('holds the backdrop on the first play, then runs it to black once the frame fills the screen', async () => {
    await render(false);
    await fire('onPlay');
    expect(veil()).toBe('hold');
    // Still undecided: the picture is untouched under the held backdrop.
    expect(picture()).toBeUndefined();

    video.paused = false;
    advance(100);
    await render(true);
    expect(veil()).toBe('run');
    expect(picture()).toBe('dark');
    const image = container.querySelector<HTMLElement>('.launch-veil-image');
    expect(image?.style.backgroundImage).toContain('/backdrop.jpg');
  });

  test('black holds until the clip plays, then the clip fades up', async () => {
    await launchFromTitle();
    await veilEnds();
    expect(veil()).toBeUndefined();
    expect(picture()).toBe('dark');

    await fire('onPlaying');
    expect(picture()).toBe('up');
  });

  test('a clip already playing waits for black, and comes up the moment black is reached', async () => {
    await launchFromTitle();
    await fire('onPlaying');
    expect(picture()).toBe('dark');
    await veilEnds();
    expect(picture()).toBe('up');
  });

  test('a clip already playing during the hold is remembered, and comes up at black', async () => {
    await render(false);
    video.paused = false;
    await fire('onPlay');
    await fire('onPlaying');
    advance(100);
    await render(true);
    expect(picture()).toBe('dark');
    await veilEnds();
    expect(picture()).toBe('up');
  });

  test('the film after the clip comes up from black too, and after that the launch is over', async () => {
    await launchFromTitle();
    await veilEnds();
    await fire('onPlaying');
    await fire('onEnded');
    await fire('onLoadStart');
    expect(picture()).toBe('dark');
    await fire('onPlaying');
    expect(picture()).toBe('up');

    // A later source swap, a seek or a pause is not a launch.
    await fire('onLoadStart');
    await fire('onPause');
    await fire('onPlaying');
    expect(picture()).toBe('up');
    expect(veil()).toBeUndefined();
  });

  test('a film with no clip: its own first playing ends the launch, and a later reload does not go dark', async () => {
    await launchFromTitle();
    await veilEnds();
    await fire('onPlaying');
    await fire('onLoadStart');
    expect(picture()).toBe('up');
  });

  test('leaving fullscreen mid-launch shows the picture at once', async () => {
    await launchFromTitle();
    await render(false);
    expect(veil()).toBeUndefined();
    expect(picture()).toBe('up');
  });

  test('if animationend never comes, the veil still lets go', async () => {
    await launchFromTitle();
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 1600));
    });
    expect(veil()).toBeUndefined();
    expect(picture()).toBe('dark');
  });
});

describe('what is not a launch', () => {
  test('a first play that never fills the screen lets the hold go after a second', async () => {
    await render(false);
    video.paused = false;
    await fire('onPlay');
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 1050));
    });
    expect(veil()).toBe('release');
    await veilEnds();
    expect(veil()).toBeUndefined();
    expect(picture()).toBeUndefined();
  });

  test('fullscreen reached later than the arm window is a toggle, not a launch', async () => {
    await render(false);
    video.paused = false;
    await fire('onPlay');
    advance(1200);
    await render(true);
    expect(veil()).toBe('release');
  });

  test('a pause during the hold lets it go', async () => {
    await render(false);
    await fire('onPlay');
    await fire('onPause');
    expect(veil()).toBe('release');
  });

  test('a first play already in fullscreen draws nothing', async () => {
    await render(true);
    await fire('onPlay');
    expect(veil()).toBeUndefined();
    expect(picture()).toBeUndefined();
  });

  test('the next episode: a fullscreen frame torn down a moment ago makes the next start a continuation', async () => {
    await render(true);
    await act(async () => {
      root?.unmount();
    });
    root = null;
    advance(500);

    await launchFromTitle();
    expect(veil()).toBe('release');
    expect(picture()).toBeUndefined();
  });

  test('an unpause is never a first play', async () => {
    await render(false);
    await fire('onPlay');
    await fire('onPause');
    await veilEnds();
    await fire('onPlay');
    advance(100);
    await render(true);
    expect(veil()).toBeUndefined();
    expect(picture()).toBeUndefined();
  });
});

function stubMatchMedia(matching: string) {
  window.matchMedia = ((query: string) => ({
    matches: query === matching,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  })) as typeof window.matchMedia;
}

describe('profiles', () => {
  test('television: kept — the same launch, and nothing it depends on is missing from Chromium 94', async () => {
    stubMatchMedia(TELEVISION);
    await launchFromTitle();
    expect(veil()).toBe('run');
    await veilEnds();
    await fire('onPlaying');
    expect(picture()).toBe('up');
    expect(document.startViewTransition).toBeUndefined();
  });

  test('reduced: the launch ends with the picture up and nothing left over it', async () => {
    stubMatchMedia('(prefers-reduced-motion: reduce)');
    await launchFromTitle();
    await veilEnds();
    await fire('onPlaying');
    expect(veil()).toBeUndefined();
    expect(picture()).toBe('up');
  });
});

describe('player-motion.css — the launch rules', () => {
  const css = readFileSync(join(import.meta.dir, 'player-motion.css'), 'utf8');
  const block = (media: string) => {
    const start = css.indexOf(`@media (prefers-reduced-motion: ${media})`);
    let depth = 0;
    for (let i = css.indexOf('{', start); i < css.length; i++) {
      if (css[i] === '{') depth++;
      if (css[i] === '}' && --depth === 0) return css.slice(start, i + 1);
    }
    return '';
  };
  test('the scale runs only when motion is welcome, over --dur-scene', () => {
    expect(css).toMatch(
      /@keyframes launchVeilOut \{\s*to \{\s*opacity: 0;\s*transform: scale\(1\.06\);/,
    );
    // Applied in exactly one place, inside the gate.
    expect(css.match(/animation: launchVeilOut/g)?.length).toBe(1);
    expect(css).toMatch(
      /@media \(prefers-reduced-motion: no-preference\) \{\s*\.launch-veil\[data-veil="run"\] \.launch-veil-image \{\s*animation: launchVeilOut var\(--dur-scene\) var\(--ease-sheet\) forwards;/,
    );
  });

  test('reduced: no scale, a fade over --dur-fast', () => {
    const reduced = block('reduce');
    expect(reduced).toContain('launchVeilFade var(--dur-fast)');
    expect(reduced).not.toContain('launchVeilOut');
    expect(reduced).not.toContain('scale');
  });

  test('the picture fades up over --dur-scene and goes dark without a transition', () => {
    expect(css).toMatch(
      /video\[data-launch\] \{\s*transition: opacity var\(--dur-scene\) var\(--ease-sheet\);/,
    );
    expect(css).toMatch(
      /video\[data-launch="dark"\] \{\s*opacity: 0;\s*transition: none;/,
    );
  });

  test('every launch keyframe that has a to ends invisible', () => {
    for (const name of ['launchVeilOut', 'launchVeilFade']) {
      const body = css.slice(css.indexOf(`@keyframes ${name}`));
      expect(body.slice(0, body.indexOf('}'))).toContain('opacity: 0');
    }
  });
});
