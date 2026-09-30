import { describe, expect, it, mock } from 'bun:test';
import {
  type ClockMode,
  createClockModeStore,
  nextClockMode,
  parseClockMode,
} from './clock-mode';

describe('parseClockMode', () => {
  it('trusts only the one value it knows, and defaults to elapsed', () => {
    expect(parseClockMode('remaining')).toBe('remaining');
    expect(parseClockMode('elapsed')).toBe('elapsed');
    expect(parseClockMode(null)).toBe('elapsed');
    expect(parseClockMode('garbage')).toBe('elapsed');
  });
});

describe('nextClockMode', () => {
  it('flips', () => {
    expect(nextClockMode('elapsed')).toBe('remaining');
    expect(nextClockMode('remaining')).toBe('elapsed');
  });
});

describe('createClockModeStore', () => {
  function store(stored: string | null) {
    const read = mock(() => stored);
    const write = mock((_: ClockMode) => {});
    return { read, write, store: createClockModeStore({ read, write }) };
  }

  it('reads storage once, lazily', () => {
    const { read, store: clock } = store('remaining');
    expect(read).not.toHaveBeenCalled();
    expect(clock.get()).toBe('remaining');
    expect(clock.get()).toBe('remaining');
    expect(read).toHaveBeenCalledTimes(1);
  });

  it('a flip writes through and reaches every subscriber — the phone row and the desk row', () => {
    const { write, store: clock } = store(null);
    const phone = mock(() => {});
    const desk = mock(() => {});
    clock.subscribe(phone);
    const unsubscribeDesk = clock.subscribe(desk);
    clock.flip();
    expect(clock.get()).toBe('remaining');
    expect(write).toHaveBeenCalledWith('remaining');
    expect(phone).toHaveBeenCalledTimes(1);
    expect(desk).toHaveBeenCalledTimes(1);
    unsubscribeDesk();
    clock.flip();
    expect(clock.get()).toBe('elapsed');
    expect(phone).toHaveBeenCalledTimes(2);
    expect(desk).toHaveBeenCalledTimes(1);
  });

  it('a flip before the first read starts from the stored mode', () => {
    const { store: clock } = store('remaining');
    clock.flip();
    expect(clock.get()).toBe('elapsed');
  });
});
