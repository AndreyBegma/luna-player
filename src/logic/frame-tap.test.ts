import { describe, expect, it } from 'bun:test';

import {
  DOUBLE_TAP_MS,
  type PendingTap,
  resolveFrameTap,
  TAP_RUN_MS,
  TAP_SEEK_SECONDS,
  tapThird,
} from './frame-tap';

const rect = { left: 100, width: 300 };

describe('tapThird', () => {
  it('splits the frame into thirds from its left edge', () => {
    expect(tapThird(150, rect)).toBe('left');
    expect(tapThird(250, rect)).toBe('centre');
    expect(tapThird(350, rect)).toBe('right');
  });

  it('puts the boundaries themselves in the centre', () => {
    // `<` and `>`, not `<=`: exactly one third in is not the outer third.
    expect(tapThird(200, rect)).toBe('centre');
    expect(tapThird(300, rect)).toBe('centre');
  });

  it('treats a frame with no width as a centre tap', () => {
    expect(tapThird(50, { left: 0, width: 0 })).toBe('centre');
  });
});

const tap = (over: Partial<Parameters<typeof resolveFrameTap>[0]> = {}) =>
  resolveFrameTap({
    controlsVisible: true,
    third: 'right',
    previous: null,
    now: 1_000,
    ...over,
  });

const first: PendingTap = { at: 1_000, third: 'right', seeks: 0 };

describe('resolveFrameTap — the five cases', () => {
  it('1. controls down: the tap reveals them and nothing else, playing or paused', () => {
    expect(tap({ controlsVisible: false, third: 'centre' })).toEqual({
      kind: 'reveal',
      pending: null,
    });
  });

  it('2. controls down, outer third: reveals and remembers the tap for a pair', () => {
    expect(tap({ controlsVisible: false })).toEqual({
      kind: 'reveal',
      pending: first,
    });
  });

  it('3. controls up, centre third: hides them now — never a toggle', () => {
    expect(tap({ third: 'centre' })).toEqual({ kind: 'hide' });
  });

  it('4. controls up, outer third, no pending tap: waits to see if a second comes', () => {
    expect(tap()).toEqual({ kind: 'defer', pending: first });
    expect(tap({ third: 'left' })).toEqual({
      kind: 'defer',
      pending: { ...first, third: 'left' },
    });
  });

  it('5. the second tap of a pair on the same third seeks, +10 on the right and −10 on the left', () => {
    const at = 1_000 + DOUBLE_TAP_MS - 1;
    expect(tap({ previous: first, now: at })).toEqual({
      kind: 'seek',
      by: TAP_SEEK_SECONDS,
      total: TAP_SEEK_SECONDS,
      pending: { at, third: 'right', seeks: 1 },
    });
    expect(
      tap({ previous: { ...first, third: 'left' }, third: 'left', now: at }),
    ).toEqual({
      kind: 'seek',
      by: -TAP_SEEK_SECONDS,
      total: TAP_SEEK_SECONDS,
      pending: { at, third: 'left', seeks: 1 },
    });
  });
});

describe('resolveFrameTap — the run', () => {
  it('a pair that started from a clean picture seeks on its second tap', () => {
    const revealed = tap({ controlsVisible: false });
    if (revealed.kind !== 'reveal') throw new Error(revealed.kind);
    expect(tap({ previous: revealed.pending, now: 1_100 }).kind).toBe('seek');
  });

  it('accumulates: n taps are (n−1) × 10, with the running total for the counter', () => {
    let previous: PendingTap | null = null;
    const totals: number[] = [];
    for (let n = 1; n <= 4; n++) {
      const action = tap({ previous, now: 1_000 + n * 200 });
      if (action.kind === 'seek') {
        totals.push(action.total);
        previous = action.pending;
      } else if (action.kind === 'defer') {
        previous = action.pending;
      }
    }
    expect(totals).toEqual([10, 20, 30]);
  });

  it('gives a run half a second per tap, but a first pair only a quarter', () => {
    const run: PendingTap = { at: 1_000, third: 'right', seeks: 1 };
    expect(tap({ previous: run, now: 1_000 + TAP_RUN_MS - 1 }).kind).toBe('seek');
    expect(tap({ previous: run, now: 1_000 + TAP_RUN_MS }).kind).toBe('defer');
    expect(tap({ previous: first, now: 1_000 + DOUBLE_TAP_MS }).kind).toBe('defer');
  });

  it('a tap on the other third starts over rather than continuing', () => {
    expect(tap({ previous: first, third: 'left', now: 1_100 })).toEqual({
      kind: 'defer',
      pending: { at: 1_100, third: 'left', seeks: 0 },
    });
  });

  it('a centre tap ends the run and hides the controls', () => {
    const run: PendingTap = { at: 1_000, third: 'right', seeks: 2 };
    expect(tap({ previous: run, third: 'centre', now: 1_100 })).toEqual({ kind: 'hide' });
  });
});
