import { describe, expect, it } from 'bun:test';

import {
  buildPreferredLanguageChain,
  pickDefaultTrackIndex,
  resolveTrackLanguageCode,
} from './audio-track-language';

/**
 * FEAT-20260923-661 (W-WEB-playback-prefs Q-05) — the matcher that chooses
 * which dub a film starts in had no test of its own. Pure TypeScript, no React
 * and no Next import.
 */

describe('resolveTrackLanguageCode', () => {
  it('reads the code a provider glues to a running index', () => {
    expect(resolveTrackLanguageCode({ name: 'rus0' })).toBe('ru');
    expect(resolveTrackLanguageCode({ name: 'ukr12' })).toBe('uk');
    expect(resolveTrackLanguageCode({ name: 'ENG1' })).toBe('en');
  });

  it('falls back to the tag when the name is not a code', () => {
    expect(resolveTrackLanguageCode({ name: 'Дубляж', lang: 'ukr' })).toBe(
      'uk',
    );
    expect(resolveTrackLanguageCode({ name: null, language: 'eng' })).toBe(
      'en',
    );
  });

  it('keeps a code outside the app set as it is, lower-cased', () => {
    expect(resolveTrackLanguageCode({ lang: 'DEU' })).toBe('deu');
    expect(resolveTrackLanguageCode({ lang: 'fr' })).toBe('fr');
  });

  it('answers null when nothing names a language', () => {
    expect(resolveTrackLanguageCode({})).toBeNull();
    expect(resolveTrackLanguageCode({ name: 'Original sound' })).toBeNull();
  });
});

describe('pickDefaultTrackIndex', () => {
  const tracks = [{ name: 'eng0' }, { name: 'rus1' }, { lang: 'ukr' }];

  it('takes the first preference present, not the first track', () => {
    expect(pickDefaultTrackIndex(tracks, ['uk', 'ru', 'en'])).toBe(2);
    expect(pickDefaultTrackIndex(tracks, ['de', 'ru'])).toBe(1);
  });

  it('answers null rather than guessing when no preference is present', () => {
    expect(pickDefaultTrackIndex(tracks, ['de', 'fr'])).toBeNull();
    expect(pickDefaultTrackIndex([], ['uk'])).toBeNull();
  });
});

describe('buildPreferredLanguageChain', () => {
  it('puts the account locale first and never repeats a language', () => {
    expect(buildPreferredLanguageChain('ru')).toEqual(['ru', 'uk', 'en']);
    expect(buildPreferredLanguageChain('de')).toEqual(['de', 'uk', 'ru', 'en']);
  });
});
