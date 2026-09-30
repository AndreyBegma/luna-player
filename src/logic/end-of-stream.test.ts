import { describe, expect, it } from 'bun:test';
import {
  END_TAIL_SECONDS,
  STALL_AT_TAIL_MS,
  endOfStream,
} from './end-of-stream';

const base = {
  ended: false,
  hasError: false,
  readyState: 2,
  currentTime: 0,
  duration: 100,
  stalledForMs: 0,
};

describe('endOfStream', () => {
  it('the element\'s own ended always wins', () => {
    expect(
      endOfStream({ ...base, ended: true, currentTime: 0, stalledForMs: 0 }),
    ).toBe('ended');
  });

  it('plays on, far from the tail, however long it has sat still', () => {
    expect(
      endOfStream({
        ...base,
        currentTime: 50,
        stalledForMs: STALL_AT_TAIL_MS * 10,
      }),
    ).toBe('playing');
  });

  it('a stall inside the tail counts once it has held for the window', () => {
    expect(
      endOfStream({
        ...base,
        currentTime: base.duration - END_TAIL_SECONDS + 1,
        stalledForMs: STALL_AT_TAIL_MS,
      }),
    ).toBe('stalled-at-tail');
  });

  it('a short stall inside the tail is still buffering', () => {
    expect(
      endOfStream({
        ...base,
        currentTime: base.duration - 1,
        stalledForMs: STALL_AT_TAIL_MS - 1,
      }),
    ).toBe('playing');
  });

  it('exactly at the tail boundary counts as inside it', () => {
    expect(
      endOfStream({
        ...base,
        currentTime: base.duration - END_TAIL_SECONDS,
        stalledForMs: STALL_AT_TAIL_MS,
      }),
    ).toBe('stalled-at-tail');
  });

  it('an element carrying an error is not this rule\'s job', () => {
    expect(
      endOfStream({
        ...base,
        hasError: true,
        currentTime: base.duration - 1,
        stalledForMs: STALL_AT_TAIL_MS,
      }),
    ).toBe('playing');
  });

  it('readyState 0 — no source loaded yet — never counts', () => {
    expect(
      endOfStream({
        ...base,
        readyState: 0,
        currentTime: base.duration - 1,
        stalledForMs: STALL_AT_TAIL_MS,
      }),
    ).toBe('playing');
  });

  it('an unknown or zero duration never arms the rule', () => {
    expect(
      endOfStream({
        ...base,
        duration: null,
        currentTime: 50,
        stalledForMs: STALL_AT_TAIL_MS,
      }),
    ).toBe('playing');
    expect(
      endOfStream({
        ...base,
        duration: 0,
        currentTime: 50,
        stalledForMs: STALL_AT_TAIL_MS,
      }),
    ).toBe('playing');
  });

  it('a seek that resets the stall clock (stalledForMs back to 0) does not fire, even mid-tail', () => {
    expect(
      endOfStream({
        ...base,
        currentTime: base.duration - 1,
        stalledForMs: 0,
      }),
    ).toBe('playing');
  });
});
