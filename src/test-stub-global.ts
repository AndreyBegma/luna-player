/**
 * Stubs one property on `globalThis`, returning a function that restores
 * whatever was there before. Several auth tests install a bare `document`
 * or `window` object (just enough for the module under test) fresh before
 * every test, via their own `installX()` helper, and previously never put
 * the original back — so once one of those files ran, the stub stayed on
 * `globalThis` for the rest of the `bun test` process and broke unrelated
 * files that expect a real DOM or no DOM at all.
 *
 * A file using this keeps calling its own `installX()` as often as it
 * likes (each call still overwrites the property for that test); it only
 * needs to keep the restore function from the first call and invoke it
 * once, in its own `afterAll`.
 *
 * A test file that replaces a global installs it in `beforeAll` through this
 * helper and restores it in `afterAll`; three files did not (BUG-597,
 * BUG-602, BUG-605) and each cost a red pipeline.
 */
export function stubGlobal(name: PropertyKey, value: unknown): () => void {
  const previous = Object.getOwnPropertyDescriptor(globalThis, name);
  Object.defineProperty(globalThis, name, { configurable: true, value });
  return () => {
    if (previous) {
      Object.defineProperty(globalThis, name, previous);
    } else {
      delete (globalThis as Record<PropertyKey, unknown>)[name];
    }
  };
}
