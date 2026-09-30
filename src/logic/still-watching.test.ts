import { describe, expect, it } from 'bun:test';
import {
  STILL_WATCHING_AFTER,
  createStillWatchingCounter,
} from './still-watching';

describe('stillWatching', () => {
  it('asks after three untouched auto-advances, and not before', () => {
    const counter = createStillWatchingCounter();
    expect(counter.shouldAsk()).toBe(false);
    counter.noteAutoAdvance();
    counter.noteAutoAdvance();
    expect(counter.shouldAsk()).toBe(false);
    counter.noteAutoAdvance();
    expect(counter.shouldAsk()).toBe(true);
    expect(counter.autoAdvances()).toBe(STILL_WATCHING_AFTER);
  });

  it('any input resets the run', () => {
    const counter = createStillWatchingCounter();
    counter.noteAutoAdvance();
    counter.noteAutoAdvance();
    counter.noteInput();
    counter.noteAutoAdvance();
    expect(counter.autoAdvances()).toBe(1);
    expect(counter.shouldAsk()).toBe(false);
  });

  it('keeps asking until somebody answers', () => {
    const counter = createStillWatchingCounter();
    for (let i = 0; i < STILL_WATCHING_AFTER; i++) counter.noteAutoAdvance();
    expect(counter.shouldAsk()).toBe(true);
    counter.noteAutoAdvance();
    expect(counter.shouldAsk()).toBe(true);
    counter.noteInput();
    expect(counter.shouldAsk()).toBe(false);
  });

  it('the threshold is the one constant', () => {
    const counter = createStillWatchingCounter(1);
    counter.noteAutoAdvance();
    expect(counter.shouldAsk()).toBe(true);
  });
});
