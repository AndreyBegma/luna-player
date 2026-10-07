import { describe, expect, it } from 'bun:test';
import {
  backHidesControls,
  bindingFor,
  KEY_BINDINGS,
  sheetRows,
  tenthFor,
  TV_KEY,
} from './player-keys';

const press = (over: Partial<Parameters<typeof bindingFor>[0]>) =>
  bindingFor({ key: '', code: '', keyCode: 0, shiftKey: false, ...over })?.id ?? null;

describe('bindingFor — the table the sheet and the handler share', () => {
  it('matches a remote that reports only key, and a keyboard that reports only code', () => {
    expect(press({ key: 'MediaPlayPause' })).toBe('mediaPlayPause');
    expect(press({ key: 'о', code: 'KeyJ' })).toBe('seekBackStep');
    expect(press({ key: 'k' })).toBe('playPause');
    expect(press({ key: ' ' })).toBe('playPause');
    expect(press({ key: 'Enter' })).toBe('playPause');
  });

  it('matches the numeric transport and back codes televisions send', () => {
    expect(press({ keyCode: TV_KEY.PLAY_PAUSE })).toBe('mediaPlayPause');
    expect(press({ keyCode: TV_KEY.PLAY })).toBe('mediaPlay');
    expect(press({ keyCode: TV_KEY.PAUSE })).toBe('mediaPause');
    expect(press({ keyCode: TV_KEY.STOP })).toBe('mediaStop');
    expect(press({ keyCode: TV_KEY.BACK })).toBe('back');
    expect(press({ keyCode: TV_KEY.BACK_TIZEN })).toBe('back');
    expect(press({ key: 'GoBack' })).toBe('back');
    expect(press({ key: 'Escape' })).toBe('back');
    // 85 is U on a keyboard; it is deliberately not Android's play/pause.
    expect(press({ key: 'u', keyCode: 85 })).toBeNull();
  });

  it('tells Shift + arrow from a bare arrow', () => {
    expect(press({ key: 'ArrowRight' })).toBe('seekForward');
    expect(press({ key: 'ArrowRight', shiftKey: true })).toBe('seekForwardCoarse');
    expect(press({ key: 'ArrowLeft', shiftKey: true })).toBe('seekBackCoarse');
  });

  it('tells , . from < > on the same two keys', () => {
    expect(press({ key: ',', code: 'Comma' })).toBe('frameBack');
    expect(press({ key: '<', code: 'Comma', shiftKey: true })).toBe('speedDown');
    expect(press({ key: '.', code: 'Period' })).toBe('frameForward');
    expect(press({ key: '>', code: 'Period', shiftKey: true })).toBe('speedUp');
    // A non-Latin layout: the position alone decides.
    expect(press({ key: 'б', code: 'Comma' })).toBe('frameBack');
    expect(press({ key: 'Б', code: 'Comma', shiftKey: true })).toBe('speedDown');
  });

  it('answers the rest of the standard set', () => {
    expect(press({ key: 'l' })).toBe('seekForwardStep');
    expect(press({ key: '7' })).toBe('jumpTenth');
    expect(press({ key: 'ы', code: 'Digit0' })).toBe('jumpTenth');
    expect(press({ key: 'm' })).toBe('mute');
    expect(press({ key: 'f' })).toBe('fullscreen');
    expect(press({ key: 'c' })).toBe('subtitles');
    expect(press({ key: 'r' })).toBe('repeatLine');
    expect(press({ key: '?', code: 'Slash', shiftKey: true })).toBe('help');
    expect(press({ key: '/', code: 'Slash' })).toBeNull();
    expect(press({ key: 'ArrowUp' })).toBe('up');
    expect(press({ key: 'ArrowDown' })).toBe('down');
    expect(press({ key: 'x' })).toBeNull();
  });

  // FEAT-20260923-661 Q-02 — on the Russian and Ukrainian layouts `?` is
  // Shift+7; the position used to win over the key and jump to 70 %.
  it('lets the key win over a position another row lists', () => {
    expect(press({ key: '?', code: 'Digit7', shiftKey: true })).toBe('help');
    expect(press({ key: '.', code: 'Slash' })).toBe('frameForward');
    expect(press({ key: '1', code: 'Digit1', shiftKey: true })).toBe('jumpTenth');
  });

  // FEAT-20260923-661 Q-01 — a chord is the browser's, never the player's.
  it('leaves Ctrl, Cmd and Alt chords to the browser', () => {
    expect(press({ key: 'c', code: 'KeyC', ctrlKey: true })).toBeNull();
    expect(press({ key: '1', code: 'Digit1', ctrlKey: true })).toBeNull();
    expect(press({ key: 'l', code: 'KeyL', metaKey: true })).toBeNull();
    expect(press({ key: 'r', code: 'KeyR', metaKey: true })).toBeNull();
    expect(press({ key: 'ArrowLeft', code: 'ArrowLeft', altKey: true })).toBeNull();
    expect(press({ key: 'f', code: 'KeyF', ctrlKey: true })).toBeNull();
    expect(press({ key: 'c', code: 'KeyC' })).toBe('subtitles');
  });

  it('lists every group of the sheet from the same rows', () => {
    const groups = new Set(KEY_BINDINGS.flatMap((b) => (b.sheet ? [b.sheet.group] : [])));
    expect([...groups].sort()).toEqual(['picture', 'playback', 'seek', 'sound', 'subtitles']);
  });
});

describe('bindingFor — FEAT-20260923-633 additions', () => {
  it('reads Shift+N and Shift+P as the episode keys, and leaves a bare n or p unbound', () => {
    expect(press({ key: 'N', code: 'KeyN', shiftKey: true })).toBe('nextEpisode');
    expect(press({ key: 'P', code: 'KeyP', shiftKey: true })).toBe('previousEpisode');
    // A Cyrillic layout: the position decides.
    expect(press({ key: 'Т', code: 'KeyN', shiftKey: true })).toBe('nextEpisode');
    expect(press({ key: 'З', code: 'KeyP', shiftKey: true })).toBe('previousEpisode');
    expect(press({ key: 'n', code: 'KeyN' })).toBeNull();
    expect(press({ key: 'p', code: 'KeyP' })).toBeNull();
  });

  it('matches the track and rewind keys by name and by the television codes', () => {
    expect(press({ key: 'MediaTrackNext' })).toBe('mediaTrackNext');
    expect(press({ key: 'MediaTrackPrevious' })).toBe('mediaTrackPrevious');
    expect(press({ keyCode: TV_KEY.TRACK_NEXT })).toBe('mediaTrackNext');
    expect(press({ keyCode: TV_KEY.TRACK_PREVIOUS })).toBe('mediaTrackPrevious');
    expect(press({ key: 'MediaRewind' })).toBe('mediaRewind');
    expect(press({ key: 'MediaFastForward' })).toBe('mediaFastForward');
    expect(press({ keyCode: TV_KEY.REWIND })).toBe('mediaRewind');
    expect(press({ keyCode: TV_KEY.FAST_FORWARD })).toBe('mediaFastForward');
  });
});

describe('sheetRows', () => {
  const ids = (hasEpisodes: boolean) =>
    sheetRows('playback', { hasEpisodes, hasLearning: true }).map((b) => b.id);
  const subtitleIds = (hasLearning: boolean) =>
    sheetRows('subtitles', { hasEpisodes: true, hasLearning }).map((b) => b.id);

  it('teaches the episode keys on an episode', () => {
    expect(ids(true)).toContain('nextEpisode');
  });

  it('leaves them off on a film, where they are unbound', () => {
    expect(ids(false)).not.toContain('nextEpisode');
    expect(ids(false)).toContain('playPause');
  });

  it('teaches R only where learning mode can be on', () => {
    expect(subtitleIds(true)).toContain('repeatLine');
    expect(subtitleIds(false)).not.toContain('repeatLine');
    expect(subtitleIds(false)).toContain('subtitles');
  });
});

describe('tenthFor', () => {
  it('reads the digit from the key, or from the position on a non-Latin layout', () => {
    expect(tenthFor({ key: '4', code: 'Digit4' })).toBe(4);
    expect(tenthFor({ key: 'ч', code: 'Digit4' })).toBe(4);
    expect(tenthFor({ key: '', code: 'Numpad9' })).toBe(9);
    expect(tenthFor({ key: 'a', code: 'KeyA' })).toBeNull();
  });
});

describe('backHidesControls', () => {
  const base = {
    televisionClass: true,
    inUse: true,
    showControls: true,
    menuOpen: false,
    sheetOpen: false,
  };

  it('takes Back on a television with the controls up and nothing open', () => {
    expect(backHidesControls(base)).toBe(true);
  });

  it('leaves Back alone with the controls down, a menu or the sheet open, off the television, or out of use', () => {
    expect(backHidesControls({ ...base, showControls: false })).toBe(false);
    expect(backHidesControls({ ...base, menuOpen: true })).toBe(false);
    expect(backHidesControls({ ...base, sheetOpen: true })).toBe(false);
    expect(backHidesControls({ ...base, televisionClass: false })).toBe(false);
    expect(backHidesControls({ ...base, inUse: false })).toBe(false);
  });
});
