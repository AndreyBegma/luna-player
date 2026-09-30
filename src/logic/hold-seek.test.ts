import { describe, expect, it } from 'bun:test';
import { HOLD_TICK_MS, holdStep, holdTarget } from './hold-seek';

describe('holdStep', () => {
  it('is ten seconds for the first second, thirty to three, then sixty', () => {
    expect(holdStep(0, false)).toBe(10);
    expect(holdStep(999, false)).toBe(10);
    expect(holdStep(1_000, false)).toBe(30);
    expect(holdStep(2_999, false)).toBe(30);
    expect(holdStep(3_000, false)).toBe(60);
    expect(holdStep(30_000, false)).toBe(60);
  });

  it('is the coarse sixty from the first tick with Shift', () => {
    expect(holdStep(0, true)).toBe(60);
    expect(holdStep(5_000, true)).toBe(60);
  });

  it('moves a three-second hold by the sum of its ticks: 180 s', () => {
    let target = 0;
    for (let held = 0; held < 3_000; held += HOLD_TICK_MS) {
      target = holdTarget({ target, step: holdStep(held, false), direction: 1, duration: 7_200 });
    }
    // Ticks at 0, 400, 800 (10 each) and 1200 … 2800 (30 each).
    expect(target).toBe(3 * 10 + 5 * 30);
  });
});

describe('holdTarget', () => {
  it('steps in the direction held and stops at either end of the film', () => {
    expect(holdTarget({ target: 100, step: 30, direction: 1, duration: 600 })).toBe(130);
    expect(holdTarget({ target: 100, step: 30, direction: -1, duration: 600 })).toBe(70);
    expect(holdTarget({ target: 20, step: 30, direction: -1, duration: 600 })).toBe(0);
    expect(holdTarget({ target: 590, step: 30, direction: 1, duration: 600 })).toBe(600);
  });

  it('is unbounded above while the duration is not yet known', () => {
    expect(holdTarget({ target: 590, step: 60, direction: 1, duration: 0 })).toBe(650);
  });
});
