import { describe, expect, it } from 'bun:test';

import {
  isResumeOffer,
  RESUME_MIN_SECONDS,
  shouldOfferResume,
} from './resume-policy';

describe('isResumeOffer', () => {
  it('reduces to the stored "position > 5" rule at a playhead of zero', () => {
    expect(isResumeOffer(RESUME_MIN_SECONDS, 0)).toBe(false);
    expect(isResumeOffer(RESUME_MIN_SECONDS + 0.5, 0)).toBe(true);
    expect(isResumeOffer(7, 0)).toBe(true);
    expect(isResumeOffer(388, 0)).toBe(true);
  });

  it('refuses a position the player is already at', () => {
    // The screenshot in the issue: the banner offered 6:28 at a playhead of 6:28.
    expect(isResumeOffer(388, 388)).toBe(false);
  });

  it('refuses a position the player is already past', () => {
    expect(isResumeOffer(388, 900)).toBe(false);
  });

  it('accepts a position far enough ahead of the playhead', () => {
    // Another device is twenty minutes further into the same episode.
    expect(isResumeOffer(1600, 388)).toBe(true);
  });

  it('draws the line at five seconds of lead, exclusive', () => {
    expect(isResumeOffer(392, 388)).toBe(false);
    expect(isResumeOffer(393, 388)).toBe(false);
    expect(isResumeOffer(394, 388)).toBe(true);
  });

  it('refuses a position or playhead that is not a number', () => {
    expect(isResumeOffer(Number.NaN, 0)).toBe(false);
    expect(isResumeOffer(388, Number.NaN)).toBe(false);
  });
});

describe('shouldOfferResume', () => {
  it('offers once on a cold open with a saved position', () => {
    expect(
      shouldOfferResume({ resumeTime: 388, playing: false, playhead: 0 }),
    ).toBe(true);
  });

  it('never draws over a playing film', () => {
    expect(
      shouldOfferResume({ resumeTime: 388, playing: true, playhead: 0 }),
    ).toBe(false);
  });

  it('stays down on the pause that used to raise it again', () => {
    // Played from the banner, paused ten seconds later. Even if something
    // re-arms `resumeTime`, the playhead is past it.
    expect(
      shouldOfferResume({ resumeTime: 388, playing: false, playhead: 398 }),
    ).toBe(false);
  });

  it('stays down once the question has been answered', () => {
    expect(
      shouldOfferResume({ resumeTime: null, playing: false, playhead: 0 }),
    ).toBe(false);
  });
});
