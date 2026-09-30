import { describe, expect, it } from 'bun:test';

import { controlsHideOnPointerLeave, controlsMayHide } from './controls-hide';

const guards = (over: Partial<Parameters<typeof controlsMayHide>[0]> = {}) => ({
  menuOpen: false,
  suppressed: false,
  controlFocused: false,
  ...over,
});

describe('controlsMayHide', () => {
  it('lets the controls go when nothing is holding them', () => {
    expect(controlsMayHide(guards())).toBe(true);
  });

  it('holds them while one of the player menus is open', () => {
    // BUG-20260905-571 — the regression this file exists for. The menu is
    // portalled into the player container rather than into the controls
    // overlay, so a bar that fades here leaves the menu behind with no trigger.
    expect(controlsMayHide(guards({ menuOpen: true }))).toBe(false);
  });

  it('holds them while the learning word popover is up', () => {
    expect(controlsMayHide(guards({ suppressed: true }))).toBe(false);
  });

  it('holds them while a control is visibly focused', () => {
    expect(controlsMayHide(guards({ controlFocused: true }))).toBe(false);
  });

  it('needs only one holder to say no', () => {
    expect(
      controlsMayHide(guards({ menuOpen: true, controlFocused: true })),
    ).toBe(false);
  });
});

describe('controlsHideOnPointerLeave', () => {
  it('hides on leaving a playing film with nothing open', () => {
    expect(
      controlsHideOnPointerLeave({ playing: true, menuOpen: false }),
    ).toBe(true);
  });

  it('does not hide while a menu is open', () => {
    expect(
      controlsHideOnPointerLeave({ playing: true, menuOpen: true }),
    ).toBe(false);
  });

  it('does not hide a paused film — the controls are how it is resumed', () => {
    expect(
      controlsHideOnPointerLeave({ playing: false, menuOpen: false }),
    ).toBe(false);
  });
});
