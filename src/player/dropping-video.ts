/**
 * BUG-20260930-719 — a `<video>` that behaves like iOS WebKit on HLS: a
 * `currentTime` write is dropped while the element holds nothing, or while
 * `seekable` does not yet reach it. Chrome keeps such a write for later,
 * which is why the resume only failed on an iPhone.
 */
export class DroppingVideo {
  readyState = 0;
  paused = true;
  seeking = false;
  seekableEnd = 0;
  duration = Number.NaN;
  buffered = { length: 0 };
  src = '';
  writes = 0;
  private time = 0;
  // Its own listeners rather than `EventTarget`: `registerDom` swaps the
  // global `Event` for happy-dom's, which Bun's native target refuses.
  private listeners = new Map<string, Set<(event: Event) => void>>();

  addEventListener(type: string, listener: (event: Event) => void) {
    const set = this.listeners.get(type) ?? new Set();
    set.add(listener);
    this.listeners.set(type, set);
  }
  removeEventListener(type: string, listener: (event: Event) => void) {
    this.listeners.get(type)?.delete(listener);
  }

  get seekable(): TimeRanges {
    const end = this.seekableEnd;
    return {
      length: end > 0 ? 1 : 0,
      start: () => 0,
      end: () => end,
    } as TimeRanges;
  }
  get currentTime() {
    return this.time;
  }
  set currentTime(value: number) {
    this.writes += 1;
    if (this.readyState < 1 || value > this.seekableEnd) return;
    this.time = value;
  }
  load() {}
  play() {
    this.paused = false;
    return Promise.resolve();
  }
  pause() {
    this.paused = true;
  }
  /** The stream has arrived: metadata, and a range that can be sought. */
  becomeSeekable(end = 3600) {
    this.readyState = 4;
    this.seekableEnd = end;
    this.duration = end;
    this.fire('canplay');
  }
  /** Playback moves the playhead on by itself, and says so. */
  advance(to: number) {
    this.time = to;
    this.fire('timeupdate');
  }
  fire(type: string) {
    const event = { type } as Event;
    for (const listener of [...(this.listeners.get(type) ?? [])])
      listener(event);
  }
  get element() {
    return this as unknown as HTMLVideoElement;
  }
}
