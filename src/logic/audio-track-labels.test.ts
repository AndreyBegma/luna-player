import { describe, expect, it } from 'bun:test';

import { audioTrackLabels } from './audio-track-labels';

describe('audioTrackLabels', () => {
  it('names a provider track by its language, in the interface language', () => {
    expect(audioTrackLabels([{ name: 'rus0' }, { name: 'eng1' }], 'en')).toEqual([
      'Russian',
      'English',
    ]);
  });

  it('numbers a language only when it appears more than once, restarting per language', () => {
    expect(
      audioTrackLabels(
        [{ name: 'eng0' }, { name: 'rus1' }, { name: 'eng2' }, { name: 'eng3' }],
        'en',
      ),
    ).toEqual(['English 1', 'Russian', 'English 2', 'English 3']);
  });

  it('falls back to the raw name, or the position, when there is no language', () => {
    expect(audioTrackLabels([{ name: 'Commentary' }, {}], 'en')).toEqual([
      'Commentary',
      '2',
    ]);
  });
});
