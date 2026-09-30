import { describe, expect, it } from 'bun:test';

import { nextSpeed, savedRate, SPEEDS, stepSpeed } from './playback-rate';

describe('nextSpeed', () => {
  it('steps up one rung', () => {
    expect(nextSpeed(1)).toBe(1.25);
    expect(nextSpeed(0.5)).toBe(0.75);
  });

  it('wraps from the fastest back to the slowest', () => {
    expect(nextSpeed(2)).toBe(0.5);
  });

  it('starts the cycle over from a rate that is not a rung', () => {
    // `indexOf` says -1, and -1 + 1 is the first rung. Recorded rather than
    // designed: it is what the player has always done.
    expect(nextSpeed(3)).toBe(SPEEDS[0]);
  });
});

describe('savedRate', () => {
  it('accepts every rung as stored', () => {
    for (const speed of SPEEDS) {
      expect(savedRate(String(speed))).toBe(speed);
    }
  });

  it('refuses a rate that is not a rung', () => {
    expect(savedRate('3')).toBeNull();
    expect(savedRate('0.8')).toBeNull();
  });

  it('refuses nothing, an empty string and text', () => {
    expect(savedRate(null)).toBeNull();
    expect(savedRate('')).toBeNull();
    expect(savedRate('fast')).toBeNull();
  });
});

describe('stepSpeed', () => {
  it('goes one rung either way', () => {
    expect(stepSpeed(1, 1)).toBe(1.25);
    expect(stepSpeed(1, -1)).toBe(0.75);
  });

  it('stops at the ends rather than wrapping', () => {
    expect(stepSpeed(2, 1)).toBe(2);
    expect(stepSpeed(0.5, -1)).toBe(0.5);
  });

  it('steps from 1× when the rate is not a rung', () => {
    expect(stepSpeed(3, 1)).toBe(1.25);
    expect(stepSpeed(3, -1)).toBe(0.75);
  });
});
