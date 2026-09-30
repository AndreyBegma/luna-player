import { describe, expect, it } from 'bun:test';

import {
  type ArrowHold,
  arrowSeek,
  bubbleLeft,
  thumbLeft,
} from './seek-geometry';

describe('thumbLeft', () => {
  it('sits flush with the track at both ends', () => {
    expect(thumbLeft(0)).toBe('calc(0% - 0rem)');
    expect(thumbLeft(100)).toBe('calc(100% - 1rem)');
  });

  it('is still centred on its position at the midpoint', () => {
    // The offset the bar shipped with, which was only ever right here.
    expect(thumbLeft(50)).toBe('calc(50% - 0.5rem)');
  });

  it('interpolates between the two', () => {
    expect(thumbLeft(25)).toBe('calc(25% - 0.25rem)');
    expect(thumbLeft(80)).toBe('calc(80% - 0.8rem)');
  });

  it('clamps a progress outside the track', () => {
    expect(thumbLeft(-10)).toBe('calc(0% - 0rem)');
    expect(thumbLeft(140)).toBe('calc(100% - 1rem)');
  });

  it('treats a progress off a NaN duration as the start', () => {
    expect(thumbLeft(Number.NaN)).toBe('calc(0% - 0rem)');
    expect(thumbLeft(Number.POSITIVE_INFINITY)).toBe('calc(0% - 0rem)');
  });
});

describe('arrowSeek', () => {
  const press = (over: Partial<Parameters<typeof arrowSeek>[1]> = {}) => ({
    now: 0,
    repeat: false,
    direction: 1 as const,
    coarse: false,
    playhead: 100,
    duration: 600,
    ...over,
  });

  it('is ten seconds from the playhead on a single press, sixty with Shift', () => {
    expect(arrowSeek(null, press()).seekTo).toBe(110);
    expect(arrowSeek(null, press({ direction: -1 })).seekTo).toBe(90);
    expect(arrowSeek(null, press({ coarse: true })).seekTo).toBe(160);
  });

  it('stays inside the film', () => {
    expect(arrowSeek(null, press({ playhead: 595 })).seekTo).toBe(600);
    expect(arrowSeek(null, press({ playhead: 4, direction: -1 })).seekTo).toBe(
      0,
    );
  });

  it('builds on a seek that has not landed yet', () => {
    // The store has not moved since the first press was sent.
    const first = arrowSeek(null, press());
    const second = arrowSeek(first.hold, press({ now: 150 }));
    expect(second.seekTo).toBe(120);
  });

  it('reads the playhead again once the seek has landed', () => {
    const first = arrowSeek(null, press());
    const second = arrowSeek(first.hold, press({ now: 150, playhead: 111 }));
    expect(second.seekTo).toBe(121);
  });

  it('stops building on a seek that never lands', () => {
    const first = arrowSeek(null, press());
    expect(arrowSeek(first.hold, press({ now: 5_000 })).seekTo).toBe(110);
  });

  it('drops a key repeat that comes sooner than a tick', () => {
    const first = arrowSeek(null, press());
    const repeat = arrowSeek(first.hold, press({ now: 33, repeat: true }));
    expect(repeat.seekTo).toBeNull();
    expect(repeat.hold).toBe(first.hold);
  });

  it('accelerates a held key on the window schedule: 180 s over three seconds', () => {
    let hold: ArrowHold | null = null;
    let target = 0;
    // A key repeating every 50 ms, a divisor of the tick so the ticks fall
    // where the window's interval puts them; the playhead never catches up.
    for (let now = 0; now < 3_000; now += 50) {
      const next = arrowSeek(
        hold,
        press({ now, repeat: now > 0, playhead: 0, duration: 7_200 }),
      );
      hold = next.hold;
      if (next.seekTo !== null) target = next.seekTo;
    }
    expect(target).toBe(3 * 10 + 5 * 30);
  });

  it('starts a new hold when the direction changes', () => {
    const right = arrowSeek(null, press());
    const left = arrowSeek(
      right.hold,
      press({ now: 50, repeat: true, direction: -1 }),
    );
    // Not dropped as a repeat of the right hold, and built on its pending target.
    expect(left.seekTo).toBe(100);
    expect(left.hold.startedAt).toBe(50);
  });
});

describe('bubbleLeft', () => {
  it('centres the bubble on its point, held inside the track', () => {
    expect(bubbleLeft(40)).toBe('clamp(2rem, 40%, calc(100% - 2rem))');
  });

  it('clamps out-of-range and non-finite input', () => {
    expect(bubbleLeft(-5)).toBe('clamp(2rem, 0%, calc(100% - 2rem))');
    expect(bubbleLeft(250)).toBe('clamp(2rem, 100%, calc(100% - 2rem))');
    expect(bubbleLeft(Number.NaN)).toBe('clamp(2rem, 0%, calc(100% - 2rem))');
  });
});
