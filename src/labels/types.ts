/**
 * FEAT-20260925-718 S2 — the strings `core/**` needs, in the shape it needs
 * them: a plain object, not a translation function. A key with no parameter
 * is a `string`; a key that took `t(key, params)` is a function, so a caller
 * cannot forget a parameter the string requires.
 *
 * The set here is exactly what `core/**` uses today (§6.2 of the plan calls
 * it "~95 keys, the parameterised ones as functions"). It is not the whole
 * `VideoPlayer` namespace — the keys Luna's own overlays and menus still use
 * (`learningWordTitle`, `stillWatching`, `theEnd`, …) stay on `next-intl` in
 * `components/player/luna/**` until this item lifts the package (P1).
 */
export interface PlayerLabels {
  // — Transport
  ariaBack10: string;
  ariaForward10: string;
  ariaPause: string;
  ariaPlay: string;
  ariaPrevEpisode: string;
  ariaNextEpisode: string;

  // — Audio
  ariaAudioTrack: string;
  trackN: (n: number) => string;
  ariaMute: string;
  ariaUnmute: string;
  ariaVolume: string;
  soundLabel: string;
  nightMode: string;
  dialogueBoost: string;
  soundModeOn: string;
  soundModeOff: string;

  // — Quality / settings gear
  ariaSettings: string;
  qualityLabel: string;
  qualityAuto: string;
  learningLabel: string;
  learningOn: string;
  learningOff: string;

  // — Playback errors / resume
  playbackFailed: string;
  playbackFailedHint: string;
  retryPlayback: string;
  continueFrom: (time: string) => string;
  continue: string;
  fromStart: string;

  // — Seek bar
  ariaSeek: string;
  seekPosition: (position: string, duration: string) => string;
  skipIntro: string;
  skipOutro: string;

  // — Badges / TV
  transcodeCpu: string;
  ariaPlayOnTv: string;

  // — Fullscreen / PiP
  ariaPip: string;
  ariaEnterFullscreen: string;
  ariaExitFullscreen: string;

  // — Speed
  ariaPlaybackSpeed: (rate: number) => string;

  // — Fit menu
  fitPicture: string;
  fitAuto: string;
  fitOriginal: string;
  fitFill: string;

  // — Subtitles
  ariaSubtitles: string;
  subtitlesOff: string;
  subtitleKind_forced: string;
  subtitleKind_sdh: string;
  subtitleKind_generated: string;
  learningStateOn: string;
  learningStateOff: string;
  learningModesLabel: string;
  learningHideNative: string;
  learningPauseAfterLine: string;
  learningSlow: string;
  learningRepeatLine: string;

  // — Subtitle appearance menu
  subtitleAppearanceLabel: string;
  subtitleSize: string;
  subtitleSize_s: string;
  subtitleSize_m: string;
  subtitleSize_l: string;
  subtitleSize_xl: string;
  subtitleBackground: string;
  subtitleBackground_none: string;
  subtitleBackground_shadow: string;
  subtitleBackground_box: string;
  subtitlePosition: string;
  subtitlePosition_bottom: string;
  subtitlePosition_raised: string;

  // — Sleep timer
  sleepTimerLabel: string;
  sleepTimerOff: string;
  sleepTimerEndOfEpisode: string;
  sleepTimerMinutes: (minutes: number) => string;
  sleepTimerLeft: (minutes: number) => string;

  // — Clock
  ariaClockElapsed: string;
  ariaClockRemaining: string;

  // — Now playing / episodes
  episodeOrdinal: (episode: number) => string;
  episodePosition: (season: number, episode: number) => string;

  // — Picture feedback (tap / drag overlay)
  feedbackSeconds: (seconds: string) => string;
  feedbackRate: (rate: number) => string;
  feedbackMuted: string;
  feedbackVolume: (percent: number) => string;

  // — Key sheet
  keysTitle: string;
  keysGroup_playback: string;
  keysGroup_seek: string;
  keysGroup_sound: string;
  keysGroup_picture: string;
  keysGroup_subtitles: string;
  key_playPause: string;
  key_speedUp: string;
  key_seekForward: string;
  key_seekForwardCoarse: string;
  key_seekForwardStep: string;
  key_jumpTenth: string;
  key_frameForward: string;
  key_down: string;
  key_mute: string;
  key_fullscreen: string;
  key_back: string;
  key_help: string;
  key_subtitles: string;
  key_repeatLine: string;
  key_nextEpisode: string;
}
