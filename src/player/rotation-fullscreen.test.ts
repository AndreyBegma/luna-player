import { describe, expect, it } from 'bun:test';
import { ROTATE_GRACE_MS, rotationAction } from './rotation-fullscreen';

const base = {
  landscape: true,
  phone: true,
  mediaReady: true,
  fullscreenActive: false,
  enteredByRotation: false,
  manualExitAt: null,
  now: 10_000,
};

describe('rotationAction', () => {
  it('enters fullscreen when a phone with media turns to landscape', () => {
    expect(rotationAction(base)).toBe('enter');
  });

  it('does nothing without media, off a phone, or when already fullscreen', () => {
    expect(rotationAction({ ...base, mediaReady: false })).toBe('none');
    expect(rotationAction({ ...base, phone: false })).toBe('none');
    expect(rotationAction({ ...base, fullscreenActive: true })).toBe('none');
  });

  it('respects a manual exit for the grace period, then forgets it', () => {
    expect(rotationAction({ ...base, manualExitAt: 10_000 - ROTATE_GRACE_MS + 1 })).toBe('none');
    expect(rotationAction({ ...base, manualExitAt: 10_000 - ROTATE_GRACE_MS })).toBe('enter');
  });

  it('leaves only the fullscreen a rotation entered when the phone turns back', () => {
    expect(
      rotationAction({ ...base, landscape: false, fullscreenActive: true, enteredByRotation: true }),
    ).toBe('exit');
    expect(
      rotationAction({ ...base, landscape: false, fullscreenActive: true, enteredByRotation: false }),
    ).toBe('none');
    expect(rotationAction({ ...base, landscape: false })).toBe('none');
  });
});
