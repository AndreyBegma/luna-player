/**
 * FEAT-20260925-718 L1 — the package's `bunfig.toml` registers happy-dom
 * globally as a `preload` (`test-setup.ts`), once for the whole run.
 * `luna-watch`'s tests call `registerDom()` / `unregisterDom()` per file
 * instead, because that repo has no such preload. The lifted test files keep
 * that same shape rather than being rewritten, so this is a no-op stand-in
 * for `@/test/dom` — the DOM is already there by the time either function
 * would run.
 */
export function registerDom(): void {}

export function unregisterDom(): void {}
