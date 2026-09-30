import { describe, expect, it } from 'bun:test';

import { formatRemaining, formatTime } from './format-time';

describe('formatTime', () => {
  it('shows minutes and zero-padded seconds under an hour', () => {
    expect(formatTime(0)).toBe('0:00');
    expect(formatTime(7)).toBe('0:07');
    expect(formatTime(65)).toBe('1:05');
    expect(formatTime(3599)).toBe('59:59');
  });

  it('adds the hour and pads the minutes past it', () => {
    expect(formatTime(3600)).toBe('1:00:00');
    expect(formatTime(3661)).toBe('1:01:01');
    expect(formatTime(7325.9)).toBe('2:02:05');
  });

  it('truncates fractional seconds rather than rounding them', () => {
    expect(formatTime(59.99)).toBe('0:59');
  });
});

describe('formatRemaining', () => {
  it('counts down with a real minus sign', () => {
    expect(formatRemaining(4, 6002)).toBe('\u22121:39:58');
    expect(formatRemaining(0, 90)).toBe('\u22121:30');
  });

  it('never goes below zero', () => {
    expect(formatRemaining(100, 90)).toBe('\u22120:00');
  });
});
