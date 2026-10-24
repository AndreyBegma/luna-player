import type { PlayerLabels } from './types';

/**
 * FEAT-20260925-718 L3 (plan P1) — the player's built-in English, the
 * strings luna-watch renders: `apps/web/src/messages/en.json` → `VideoPlayer`
 * at luna-watch 8c2def7, key for key the way `core/labels/test-labels.ts`
 * builds `TEST_LABELS` there. A `{name}` placeholder becomes the matching
 * parameter. `<Player>` merges a host's `labels` over this; `ru` and `uk`
 * come later.
 */
export const en: PlayerLabels = {
  ariaBack10: '-10 sec',
  ariaForward10: '+10 sec',
  ariaPause: 'Pause',
  ariaPlay: 'Play',
  ariaPrevEpisode: 'Previous episode',
  ariaNextEpisode: 'Next episode',

  ariaAudioTrack: 'Audio track',
  trackN: (n) => `Track ${n}`,
  ariaMute: 'Mute',
  ariaUnmute: 'Unmute',
  ariaVolume: 'Volume',
  soundLabel: 'Sound',
  nightMode: 'Night mode',
  dialogueBoost: 'Dialogue boost',
  soundModeOn: 'On',
  soundModeOff: 'Off',

  ariaSettings: 'Settings',
  qualityLabel: 'Quality',
  qualityAuto: 'Auto',
  learningLabel: 'English',
  learningOn: 'Learning mode on',
  learningOff: 'Learning mode off',

  playbackFailed: 'Playback stopped',
  playbackFailedHint: 'The stream could not be recovered.',
  retryPlayback: 'Try again',
  continueFrom: (time) => `Continue from ${time}?`,
  continue: 'Continue',
  fromStart: 'From start',

  ariaSeek: 'Seek',
  seekPosition: (position, duration) => `${position} of ${duration}`,
  skipIntro: 'Skip intro',
  skipOutro: 'Skip outro',

  transcodeCpu: 'CPU transcode',
  ariaPlayOnTv: 'Play on a television',

  ariaPip: 'Picture in picture',
  ariaEnterFullscreen: 'Fullscreen',
  ariaExitFullscreen: 'Exit fullscreen',

  ariaPlaybackSpeed: (rate) => `Playback speed ${rate}×`,

  fitPicture: 'Picture',
  fitAuto: 'Auto',
  fitOriginal: 'Original',
  fitFill: 'Fill screen',

  ariaSubtitles: 'Subtitles',
  subtitlesOff: 'Off',
  subtitleKind_forced: 'forced',
  subtitleKind_sdh: 'SDH',
  subtitleKind_generated: 'auto',
  learningStateOn: 'On',
  learningStateOff: 'Off',
  learningModesLabel: 'Learning',
  learningHideNative: 'Hide the native line',
  learningPauseAfterLine: 'Pause after each line',
  learningSlow: 'Slow (0.75×)',
  learningRepeatLine: 'Repeat the line',

  subtitleAppearanceLabel: 'Appearance',
  subtitleSize: 'Size',
  subtitleSize_s: 'Small',
  subtitleSize_m: 'Medium',
  subtitleSize_l: 'Large',
  subtitleSize_xl: 'Extra large',
  subtitleBackground: 'Background',
  subtitleBackground_none: 'None',
  subtitleBackground_shadow: 'Shadow',
  subtitleBackground_box: 'Box',
  subtitlePosition: 'Position',
  subtitlePosition_bottom: 'Bottom',
  subtitlePosition_raised: 'Raised',

  sleepTimerLabel: 'Sleep timer',
  sleepTimerOff: 'Off',
  sleepTimerEndOfEpisode: 'End of episode',
  sleepTimerMinutes: (minutes) => `${minutes} min`,
  sleepTimerLeft: (minutes) => `${minutes} min left`,

  ariaClockElapsed: 'Show time elapsed',
  ariaClockRemaining: 'Show time remaining',

  episodeOrdinal: (episode) => `E${episode}`,
  episodePosition: (season, episode) => `S${season} · E${episode}`,

  feedbackSeconds: (seconds) => `${seconds} s`,
  feedbackRate: (rate) => `${rate}×`,
  feedbackMuted: 'Muted',
  feedbackVolume: (percent) => `Volume ${percent} %`,

  keysTitle: 'Keyboard shortcuts',
  keysGroup_playback: 'Playback',
  keysGroup_seek: 'Seeking',
  keysGroup_sound: 'Sound',
  keysGroup_picture: 'Picture',
  keysGroup_subtitles: 'Subtitles',
  key_playPause: 'Play or pause',
  key_speedUp: 'Slower or faster',
  key_seekForward: 'Back or forward 10 s; hold to go faster',
  key_seekForwardCoarse: 'Back or forward 60 s',
  key_seekForwardStep: 'Back or forward 10 s',
  key_jumpTenth: 'Jump to a tenth of the film',
  key_frameForward: 'One frame back or forward, while paused',
  key_down: 'Volume, while the controls are hidden',
  key_mute: 'Mute',
  key_fullscreen: 'Fullscreen',
  key_back: 'Hide the controls, leave fullscreen',
  key_help: 'This list',
  key_subtitles: 'Subtitles on or off',
  key_repeatLine: 'Repeat the line, in learning mode',
  key_nextEpisode: 'Previous or next episode',
};
