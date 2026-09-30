import { describe, expect, it } from 'bun:test';
import { createSleepTimer, minutesLeft, sleepStatus } from './sleep-timer';

describe('sleepTimer', () => {
  it('starts off', () => {
    expect(createSleepTimer().get()).toEqual({ choice: null, deadline: null });
  });

  it('counts minutes from the moment it is set', () => {
    let clock = 1_000;
    const timer = createSleepTimer(() => clock);
    timer.set(30);
    expect(timer.get()).toEqual({ choice: 30, deadline: 1_000 + 30 * 60_000 });
    clock = 5_000;
    timer.set(60);
    expect(timer.get().deadline).toBe(5_000 + 60 * 60_000);
  });

  it('the end of the episode has no deadline, and is taken once', () => {
    const timer = createSleepTimer();
    timer.set('endOfEpisode');
    expect(timer.get()).toEqual({ choice: 'endOfEpisode', deadline: null });
    expect(timer.takeEndOfEpisode()).toBe(true);
    expect(timer.get().choice).toBeNull();
    expect(timer.takeEndOfEpisode()).toBe(false);
  });

  it('a minutes timer is not taken by the end of an episode', () => {
    const timer = createSleepTimer(() => 0);
    timer.set(60);
    expect(timer.takeEndOfEpisode()).toBe(false);
    expect(timer.get().choice).toBe(60);
  });

  it('off clears the deadline', () => {
    const timer = createSleepTimer(() => 0);
    timer.set(30);
    timer.set(null);
    expect(timer.get()).toEqual({ choice: null, deadline: null });
  });

  it('keeps one object between changes, and tells subscribers of each', () => {
    const timer = createSleepTimer(() => 0);
    let calls = 0;
    const unsubscribe = timer.subscribe(() => {
      calls += 1;
    });
    const before = timer.get();
    expect(timer.get()).toBe(before);
    timer.set(30);
    timer.set(null);
    expect(calls).toBe(2);
    unsubscribe();
    timer.set(60);
    expect(calls).toBe(2);
  });

  it('an expiry is off, and tells its deadline apart from Off (BUG-20260924-687)', () => {
    const timer = createSleepTimer(() => 0);
    timer.set(30);
    const deadline = 30 * 60_000;
    const seenBySubscriber: { value: boolean | null } = { value: null };
    timer.subscribe(() => {
      seenBySubscriber.value = timer.expired(deadline);
    });
    timer.expire();
    expect(timer.get()).toEqual({ choice: null, deadline: null });
    expect(timer.expired(deadline)).toBe(true);
    // A listener already sees it: the player re-renders from that call.
    expect(seenBySubscriber.value).toBe(true);
    // The next choice forgets it.
    timer.set(60);
    expect(timer.expired(deadline)).toBe(false);
  });

  it('Off is not an expiry', () => {
    const timer = createSleepTimer(() => 0);
    timer.set(30);
    timer.set(null);
    expect(timer.expired(30 * 60_000)).toBe(false);
  });
});

describe('minutesLeft', () => {
  it('rounds up, and never says zero', () => {
    expect(minutesLeft(30 * 60_000, 0)).toBe(30);
    expect(minutesLeft(30 * 60_000, 1)).toBe(30);
    expect(minutesLeft(29 * 60_000 + 1, 0)).toBe(30);
    expect(minutesLeft(10_000, 0)).toBe(1);
    expect(minutesLeft(0, 5_000)).toBe(1);
  });
});

describe('sleepStatus', () => {
  it('is null when off', () => {
    expect(sleepStatus({ choice: null, deadline: null }, 0)).toBeNull();
  });

  it('is the end of the episode when that is the choice', () => {
    expect(sleepStatus({ choice: 'endOfEpisode', deadline: null }, 0)).toEqual({
      kind: 'endOfEpisode',
    });
  });

  it('carries the minutes left for a minutes timer', () => {
    expect(
      sleepStatus({ choice: 60, deadline: 42 * 60_000 }, 12 * 60_000),
    ).toEqual({ kind: 'minutes', minutesLeft: 30 });
  });
});
