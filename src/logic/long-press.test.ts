import { describe, expect, it } from 'bun:test';
import { LONG_PRESS_SLOP_PX, pressDrifted, pressMayHold } from './long-press';

describe('pressDrifted', () => {
  it('lets a resting finger wobble inside the slop', () => {
    expect(pressDrifted({ x: 100, y: 100 }, { x: 100 + LONG_PRESS_SLOP_PX, y: 100 })).toBe(false);
    expect(pressDrifted({ x: 100, y: 100 }, { x: 105, y: 105 })).toBe(false);
  });

  it('cancels once the finger has travelled further than the slop, on any axis', () => {
    expect(pressDrifted({ x: 100, y: 100 }, { x: 100, y: 111 })).toBe(true);
    expect(pressDrifted({ x: 100, y: 100 }, { x: 108, y: 108 })).toBe(true);
  });
});

describe('pressMayHold', () => {
  it('is a finger on a playing film, and nothing else', () => {
    expect(pressMayHold({ pointerType: 'touch', playing: true })).toBe(true);
    expect(pressMayHold({ pointerType: 'touch', playing: false })).toBe(false);
    expect(pressMayHold({ pointerType: 'mouse', playing: true })).toBe(false);
    expect(pressMayHold({ pointerType: 'pen', playing: true })).toBe(false);
  });
});
