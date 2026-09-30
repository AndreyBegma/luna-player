/**
 * FEAT-20260923-654 — where the sound modes may be offered, and what each one
 * does to the sound: night mode and dialogue boost.
 *
 * Both route the `<video>` through Web Audio, and the one failure that
 * matters is a film that goes silent. A `MediaElementAudioSourceNode` outputs
 * zeroes for a cross-origin source the page may not read, and the routing
 * cannot be undone once it is made. So the control is offered only where the
 * feature plan's spike proved the sound survives, and is absent everywhere
 * else — never present and muting:
 *
 *   * a `blob:` source — hls.js feeding a MediaSource. Every byte was fetched
 *     by the script under CORS before the element saw it, which makes it
 *     safe whatever provider sits behind the API's proxy. A library film
 *     played directly is a cross-origin URL, and is silent through a graph;
 *   * not WebKit — Safari keeps an MSE-fed graph silent (WebKit bug 180696),
 *     and every browser on iOS is WebKit and says `Apple` too;
 *   * not a television — Tizen plays video on its own pipeline, and nobody
 *     has heard the graph on one yet.
 */

import { TELEVISION } from '../platform/media-query';

/** Television browsers that may not answer the query (a set with a pointer). */
const TELEVISION_AGENT = /Tizen|Web0S|SMART-TV/i;

export type SoundMode = 'night' | 'dialogue';

export type SoundModes = Record<SoundMode, boolean>;

export const SOUND_MODES_OFF: SoundModes = { night: false, dialogue: false };

export const SOUND_MODE_STORAGE_KEY = 'luna:sound-mode';

/**
 * FEAT-20260923-654 increment 3 — this device's last choice, a device
 * preference like `luna:volume` rather than the room's or the profile's.
 * Each field stands alone: anything that is not both booleans is not a
 * choice worth applying, and the film stays untouched rather than routed on
 * a half-read value.
 */
export function savedSoundModes(raw: string | null): SoundModes | null {
  if (!raw) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof parsed !== 'object' || parsed === null) return null;
  const { night, dialogue } = parsed as Record<string, unknown>;
  if (typeof night !== 'boolean' || typeof dialogue !== 'boolean') {
    return null;
  }
  return { night, dialogue };
}

export interface SoundEnvironment {
  hasAudioContext: boolean;
  /** `navigator.vendor` — `Apple Computer, Inc.` on every WebKit. */
  vendor: string;
  userAgent: string;
  television: boolean;
  /** The element's `currentSrc` right now. */
  currentSrc: string;
}

export function soundModesOffered(env: SoundEnvironment): boolean {
  return (
    env.hasAudioContext &&
    !env.vendor.startsWith('Apple') &&
    !env.television &&
    !TELEVISION_AGENT.test(env.userAgent) &&
    env.currentSrc.startsWith('blob:')
  );
}

/** This browser's environment, for the element that would be routed. */
export function readSoundEnvironment(
  video: HTMLVideoElement,
): SoundEnvironment {
  return {
    hasAudioContext: audioContextConstructor() !== null,
    vendor: navigator.vendor ?? '',
    userAgent: navigator.userAgent,
    television:
      typeof window.matchMedia === 'function' &&
      window.matchMedia(TELEVISION).matches,
    currentSrc: video.currentSrc,
  };
}

export function audioContextConstructor(): typeof AudioContext | null {
  if (typeof window === 'undefined') return null;
  return (
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext ??
    null
  );
}

/**
 * Measured in Chrome (feature plan §4.5): a 1 kHz sine at −40…0 dBFS comes
 * out at −34.8…−11.3 — speech-level material about 5 dB louder, full-scale
 * action about 11 dB quieter, nothing near clipping.
 *
 * No make-up gain on top: Chrome's compressor applies its own, and a first
 * try with an explicit one lifted −50 dBFS by 23 dB — the room tone of every
 * quiet scene. The trim after it takes the loudest material down instead.
 */
export const NIGHT_COMPRESSOR = {
  threshold: -30,
  knee: 10,
  ratio: 3,
  attack: 0.005,
  release: 0.3,
} as const;

export const NIGHT_TRIM_DB = -6;

/**
 * Dialogue boost, measured in Chrome (feature plan §4.6): the speech band
 * lifted, the rumble under it cut. The shelf's frequency is its midpoint —
 * −1.5 dB at 150 Hz, −3 dB below 80 — so a man's voice keeps its body.
 */
export const DIALOGUE_LOW_SHELF = { frequency: 150, gain: -3 } as const;

export const DIALOGUE_PRESENCE = { frequency: 2500, Q: 0.9, gain: 5 } as const;

/**
 * The filter's largest gain, taken back off the dry path: Web Audio's output
 * hard-clips above full scale, and on a hot master the untrimmed lift clipped
 * for 46 s of a 12-minute film; trimmed, for none. With night mode on the
 * compressor's own trim leaves room, so this is the dry path's alone.
 */
export const DIALOGUE_TRIM_DB = -DIALOGUE_PRESENCE.gain;
