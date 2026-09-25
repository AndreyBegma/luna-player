/// <reference types="bun" />

/**
 * FEAT-20260925-718 — the DOM the package's tests run in, following glass-ui's
 * `src/test-setup.ts`.
 *
 * `bun test` has no DOM of its own, so one is registered globally before any
 * test file is evaluated. This is a `preload` (see `bunfig.toml`), not an
 * import inside each test: React reads `document` while its module evaluates,
 * so a DOM installed from inside a test file arrives too late.
 *
 * happy-dom rather than jsdom for the same reason as glass-ui: it starts in
 * single-digit milliseconds, and a player has a lot of small, fast tests.
 */
import { GlobalRegistrator } from '@happy-dom/global-registrator';

GlobalRegistrator.register({
  url: 'http://localhost/',
  width: 390,
  height: 844,
});

/**
 * React 19 refuses to run `act` unless the environment declares itself a test
 * environment. Without it, state updates warn and some are dropped.
 */
(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

/**
 * happy-dom does not implement `ResizeObserver`, and the player's fit and
 * layout code calls it unconditionally.
 */
if (!('ResizeObserver' in globalThis)) {
  (globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

/**
 * No `@testing-library/react` here — it is not a peer or a dependency of this
 * package, unlike glass-ui's. Component tests use `createRoot` directly
 * (`react-dom/client`, imported dynamically after the DOM above is
 * registered), so cleanup between tests is the DOM itself, not an unmount
 * helper tracking React roots it was never given.
 */
import { afterEach } from 'bun:test';

afterEach(() => {
  document.body.replaceChildren();
});
