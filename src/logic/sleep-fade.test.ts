import { describe, expect, it } from 'bun:test';
import { SLEEP_FADE_MS, sleepFadeVolume } from './sleep-fade';

describe('sleepFadeVolume', () => {
  it('leaves the level alone outside the last thirty seconds', () => {
    expect(sleepFadeVolume(0.8, SLEEP_FADE_MS)).toBe(0.8);
    expect(sleepFadeVolume(0.8, SLEEP_FADE_MS + 60_000)).toBe(0.8);
  });

  it('reaches exactly 0 at and past the deadline', () => {
    expect(sleepFadeVolume(0.8, 0)).toBe(0);
    expect(sleepFadeVolume(0.8, -5_000)).toBe(0);
  });

  it('ramps linearly in between', () => {
    expect(sleepFadeVolume(1, SLEEP_FADE_MS / 2)).toBeCloseTo(0.5);
    expect(sleepFadeVolume(0.4, SLEEP_FADE_MS / 4)).toBeCloseTo(0.1);
  });
});
