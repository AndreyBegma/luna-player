/**
 * FEAT-20260919-619 — whether the transport clock reads elapsed or
 * remaining time, remembered on the device the way `learning-modes.ts`
 * remembers its two flags: one key, a parse that trusts nothing it does
 * not know, and reads and writes that fail quietly where storage does.
 *
 * A module-level store rather than component state because the bar mounts
 * the clock twice — once for the phone row, once for the desk row — and a
 * flip on one must reach the other.
 */

import { useSyncExternalStore } from 'react';

export type ClockMode = 'elapsed' | 'remaining';

const STORAGE_KEY = 'luna:clock';

export function parseClockMode(raw: string | null): ClockMode {
  return raw === 'remaining' ? 'remaining' : 'elapsed';
}

export function nextClockMode(mode: ClockMode): ClockMode {
  return mode === 'elapsed' ? 'remaining' : 'elapsed';
}

interface ClockModeStore {
  /** The same value until a flip: safe for `useSyncExternalStore`. */
  get: () => ClockMode;
  subscribe: (listener: () => void) => () => void;
  /** One identity for the page's life, so a caller never rebuilds a handler for it. */
  flip: () => void;
}

interface ClockModeEnv {
  read: () => string | null;
  write: (value: ClockMode) => void;
}

/**
 * Read once, lazily — the first `get` is on the client, after hydration's
 * server snapshot — and written through on every flip. The environment is
 * injected so that the test drives a store of its own rather than the page's.
 */
export function createClockModeStore(env: ClockModeEnv): ClockModeStore {
  let mode: ClockMode | null = null;
  const listeners = new Set<() => void>();

  const get = (): ClockMode => {
    mode ??= parseClockMode(env.read());
    return mode;
  };

  return {
    get,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    flip: () => {
      mode = nextClockMode(get());
      env.write(mode);
      for (const listener of listeners) listener();
    },
  };
}

const clockMode = createClockModeStore({
  read: () => {
    try {
      return localStorage.getItem(STORAGE_KEY);
    } catch {
      return null;
    }
  },
  write: (value) => {
    try {
      localStorage.setItem(STORAGE_KEY, value);
    } catch {
      // Private mode or a refused quota: the flip still holds for this page.
    }
  },
});

// The server has no storage; it renders elapsed and the client agrees on
// hydration, then reads the real preference.
const serverMode = (): ClockMode => 'elapsed';

/** The mode, and the flip. */
export function useClockMode(): [ClockMode, () => void] {
  const current = useSyncExternalStore(
    clockMode.subscribe,
    clockMode.get,
    serverMode,
  );
  return [current, clockMode.flip];
}
