'use client';

import { useSyncExternalStore } from 'react';

/**
 * FEAT-20260914-584 (#1053) — where the playhead lives.
 *
 * It used to be `useState` in the player, written on every `timeupdate` —
 * four times a second — and every write re-rendered the whole composition,
 * the control bar under it, and rebuilt every callback whose dependency list
 * named it: the frame tap, the audio switch, the window `keydown` handler,
 * the remote's `getCurrentTime`. Almost nothing that read the number needed a
 * render for it. A seek handler wants the position at the moment of the
 * event; only the scrubber, the clock, the skip buttons and the cue layer
 * draw it.
 *
 * So the position is an external store, one per player, and the two kinds of
 * reader take it two ways. A handler calls `get()` when it fires and keeps no
 * dependency on the value. A component that draws it calls `usePlayhead()`,
 * which subscribes through `useSyncExternalStore` — and, by handing it a
 * selector that returns a primitive, re-renders on a *transition* (a whole
 * second, a cue index, a boolean) rather than on every tick.
 *
 * `buffered` rides along because it is written from the same event and drawn
 * by the same scrubber; leaving it in state would have kept the player
 * re-rendering on the transcode path, where the buffered end grows
 * continuously.
 *
 * `lib/search-trigger.ts` is the same construction at module level; this one
 * is an instance because two players can be mounted at once (the party page
 * and a title page behind it) and neither may drive the other's scrubber.
 */
export interface PlayheadSnapshot {
  /** Seconds into the film — `refs.seekOffset` already added, never the raw element clock. */
  time: number;
  /** Percent of the film the element has buffered. */
  buffered: number;
}

export interface PlayheadStore {
  get(): PlayheadSnapshot;
  /**
   * Writes the fields given and tells subscribers once. A write that changes
   * nothing tells nobody, which is what keeps a paused player quiet.
   */
  set(next: Partial<PlayheadSnapshot>): void;
  subscribe(listener: () => void): () => void;
}

export function createPlayheadStore(): PlayheadStore {
  let snapshot: PlayheadSnapshot = { time: 0, buffered: 0 };
  const listeners = new Set<() => void>();

  return {
    get: () => snapshot,
    set: (next) => {
      const time = next.time ?? snapshot.time;
      const buffered = next.buffered ?? snapshot.buffered;
      if (time === snapshot.time && buffered === snapshot.buffered) return;
      snapshot = { time, buffered };
      for (const listener of listeners) listener();
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

const selectTime = (snapshot: PlayheadSnapshot): number => snapshot.time;

/**
 * The store, read by something that draws it.
 *
 * `select` must return a primitive — a number, a boolean, a string. It is
 * compared with `Object.is` on every notification, and a selector that built
 * an object would be a new value every time, which `useSyncExternalStore`
 * treats as an update without end. The server snapshot is the same selector
 * over the same initial store, so the first client paint matches the markup
 * it hydrates.
 */
export function usePlayhead<T = number>(
  store: PlayheadStore,
  select: (snapshot: PlayheadSnapshot) => T = selectTime as (
    snapshot: PlayheadSnapshot,
  ) => T,
): T {
  return useSyncExternalStore(
    store.subscribe,
    () => select(store.get()),
    () => select(store.get()),
  );
}
