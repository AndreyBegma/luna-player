/**
 * FEAT-20260925-718 L2 — the transport keys split out of `use-player-keys.ts`
 * answer exactly as the switch did inside it.
 */
import { describe, expect, test } from 'bun:test';
import { handleTransportKey, isTransportKey, STEP_SECONDS } from './tv-transport-keys';

function harness(hasNeighbour = true) {
  const calls: string[] = [];
  let prevented = false;
  const e = {
    preventDefault: () => {
      prevented = true;
    },
  } as KeyboardEvent;
  const actions = {
    doPlay: () => calls.push('doPlay'),
    ensurePlaying: () => calls.push('ensurePlaying'),
    pause: () => calls.push('pause'),
    stepEpisode: (direction: 1 | -1) => {
      calls.push(`step ${direction}`);
      return hasNeighbour;
    },
    currentTime: () => 100,
    seekToTime: (time: number) => calls.push(`seek ${time}`),
  };
  return {
    press: (id: string) => handleTransportKey(id, e, actions),
    calls,
    prevented: () => prevented,
  };
}

describe('isTransportKey', () => {
  test('names the media rows and nothing else', () => {
    expect(isTransportKey('mediaPlayPause')).toBe(true);
    expect(isTransportKey('mediaRewind')).toBe(true);
    expect(isTransportKey('playPause')).toBe(false);
    expect(isTransportKey('seekBack')).toBe(false);
  });
});

describe('handleTransportKey', () => {
  test.each([
    ['mediaPlayPause', 'doPlay'],
    ['mediaPlay', 'ensurePlaying'],
    ['mediaPause', 'pause'],
    ['mediaStop', 'pause'],
    ['mediaRewind', `seek ${100 - STEP_SECONDS}`],
    ['mediaFastForward', `seek ${100 + STEP_SECONDS}`],
    ['mediaTrackNext', 'step 1'],
    ['mediaTrackPrevious', 'step -1'],
  ])('%s → %s, and the key is taken', (id, call) => {
    const h = harness();
    h.press(id);
    expect(h.calls).toEqual([call]);
    expect(h.prevented()).toBe(true);
  });

  test('a track key with no neighbour on that side is left to the page', () => {
    const h = harness(false);
    h.press('mediaTrackNext');
    expect(h.calls).toEqual(['step 1']);
    expect(h.prevented()).toBe(false);
  });
});
