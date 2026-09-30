import {
  DIALOGUE_LOW_SHELF,
  DIALOGUE_PRESENCE,
  DIALOGUE_TRIM_DB,
  NIGHT_COMPRESSOR,
  NIGHT_TRIM_DB,
  type SoundModes,
} from './sound-mode';

/**
 * FEAT-20260923-654 — the `<video>`'s sound, routed through Web Audio so that
 * night mode can compress it and dialogue boost can lift the speech band.
 *
 * Routing is for the element's life: `createMediaElementSource` cannot be
 * undone, and from then on the element is heard only through this graph. Two
 * things follow, and both are this module's to get right rather than its
 * caller's:
 *
 *   * The context must be running before the element is routed. A graph
 *     behind a suspended context is a silent film, so `attachSoundGraph` is
 *     called inside a press — the gesture the browser wants — and routes
 *     nothing unless `resume()` has actually brought the context up.
 *   * The element is switched to CORS mode first. hls.js's fatal-error
 *     fallback and the server-seek reloads put a plain cross-origin URL on
 *     the same element, and without `crossorigin` a routed element plays
 *     that in silence — with night mode off. The Watch API answers every
 *     route with the web origin, so in CORS mode those loads stay audible
 *     (feature plan §4.2, cases D and E).
 *
 * Off is a path, not a teardown: the dry signal and the compressed one are
 * both live and crossfaded, so switching is a fade rather than a click. The
 * dialogue filter sits before the split and feeds both; off, its gains are
 * 0 dB, which is an exact identity (feature plan §4.6).
 *
 *   source → low shelf → presence ┬→ dry ──────────────────→ out
 *                                  └→ compressor → trim → night → out
 */
export interface SoundGraph {
  /** Fades every path and filter to what `modes` asks for. */
  set: (modes: SoundModes) => void;
  /** Only with the element itself: a closed context silences a routed one. */
  close: () => void;
}

/** A 15 ms time constant: each path is within 2% of its target by 60 ms. */
const FADE_SECONDS = 0.015;

const DRY_DIALOGUE_GAIN = 10 ** (DIALOGUE_TRIM_DB / 20);

export async function attachSoundGraph(
  video: HTMLVideoElement,
  Context: typeof AudioContext,
): Promise<SoundGraph | null> {
  // Constructed and resumed before any `await`, while the press still counts
  // as one.
  let ctx: AudioContext;
  try {
    ctx = new Context();
  } catch {
    // FEAT-20260923-661 (Q-04) — no context to be had (the browser's cap on
    // live ones, no output device): the same answer as one that will not run.
    return null;
  }
  const starting = ctx.state === 'running' ? null : ctx.resume();
  await starting?.catch(() => undefined);
  if (ctx.state !== 'running') {
    void ctx.close().catch(() => undefined);
    return null;
  }

  video.crossOrigin = 'anonymous';
  let source: MediaElementAudioSourceNode;
  try {
    source = ctx.createMediaElementSource(video);
  } catch {
    // Already routed by another context (a hot reload, in practice): that
    // graph is the element's sound now, and a second one cannot be made.
    void ctx.close().catch(() => undefined);
    return null;
  }

  const shelf = ctx.createBiquadFilter();
  shelf.type = 'lowshelf';
  shelf.frequency.value = DIALOGUE_LOW_SHELF.frequency;
  shelf.gain.value = 0;
  const presence = ctx.createBiquadFilter();
  presence.type = 'peaking';
  presence.frequency.value = DIALOGUE_PRESENCE.frequency;
  presence.Q.value = DIALOGUE_PRESENCE.Q;
  presence.gain.value = 0;

  const dry = ctx.createGain();
  const compressor = ctx.createDynamicsCompressor();
  compressor.threshold.value = NIGHT_COMPRESSOR.threshold;
  compressor.knee.value = NIGHT_COMPRESSOR.knee;
  compressor.ratio.value = NIGHT_COMPRESSOR.ratio;
  compressor.attack.value = NIGHT_COMPRESSOR.attack;
  compressor.release.value = NIGHT_COMPRESSOR.release;
  const trim = ctx.createGain();
  trim.gain.value = 10 ** (NIGHT_TRIM_DB / 20);
  const night = ctx.createGain();
  night.gain.value = 0;

  source.connect(shelf);
  shelf.connect(presence);
  presence.connect(dry);
  dry.connect(ctx.destination);
  presence.connect(compressor);
  compressor.connect(trim);
  trim.connect(night);
  night.connect(ctx.destination);

  // A context the platform suspends under a playing film (an output device
  // going away, the OS reclaiming audio) is a silent film until resumed.
  const keepRunning = () => {
    if (ctx.state === 'suspended' && !video.paused) {
      void ctx.resume().catch(() => undefined);
    }
  };
  ctx.addEventListener('statechange', keepRunning);
  video.addEventListener('play', keepRunning);

  return {
    set: ({ night: nightOn, dialogue }) => {
      const now = ctx.currentTime;
      const fade = (param: AudioParam, target: number) =>
        param.setTargetAtTime(target, now, FADE_SECONDS);
      fade(shelf.gain, dialogue ? DIALOGUE_LOW_SHELF.gain : 0);
      fade(presence.gain, dialogue ? DIALOGUE_PRESENCE.gain : 0);
      // The lift is taken back off the dry path alone: under night mode the
      // compressor's trim already leaves the headroom.
      fade(dry.gain, nightOn ? 0 : dialogue ? DRY_DIALOGUE_GAIN : 1);
      fade(night.gain, nightOn ? 1 : 0);
    },
    close: () => {
      ctx.removeEventListener('statechange', keepRunning);
      video.removeEventListener('play', keepRunning);
      void ctx.close().catch(() => undefined);
    },
  };
}
