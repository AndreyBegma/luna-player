import { describe, expect, it } from 'bun:test';
import { WHEEL_VOLUME_STEP, wheelVolume } from './volume-wheel';

describe('wheelVolume', () => {
  it('moves one step a notch, up for louder', () => {
    expect(wheelVolume(0.5, -100)).toBeCloseTo(0.5 + WHEEL_VOLUME_STEP);
    expect(wheelVolume(0.5, 100)).toBeCloseTo(0.5 - WHEEL_VOLUME_STEP);
    expect(wheelVolume(0.5, 0)).toBe(0.5);
  });

  it('stops at silence and at full', () => {
    expect(wheelVolume(0.02, 100)).toBe(0);
    expect(wheelVolume(0.98, -100)).toBe(1);
  });

  it('lands on the step, not on floating-point dust', () => {
    let v = 1;
    for (let i = 0; i < 13; i++) v = wheelVolume(v, 100);
    expect(v).toBe(0.35);
  });
});
