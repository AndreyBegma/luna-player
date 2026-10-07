import { describe, expect, it } from 'bun:test';
import { savedVolume } from './saved-volume';

describe('savedVolume', () => {
  it('trusts a level in (0, 1]', () => {
    expect(savedVolume('0.35')).toBe(0.35);
    expect(savedVolume('1')).toBe(1);
  });

  it('does not bring back silence, nothing, or nonsense', () => {
    expect(savedVolume('0')).toBeNull();
    expect(savedVolume(null)).toBeNull();
    expect(savedVolume('')).toBeNull();
    expect(savedVolume('loud')).toBeNull();
    expect(savedVolume('1.5')).toBeNull();
    expect(savedVolume('-0.2')).toBeNull();
  });
});
