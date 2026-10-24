'use client';

import {
  createContext,
  type ReactNode,
  type RefObject,
  useContext,
  useEffect,
  useReducer,
  useRef,
} from 'react';
import './player-motion.css';

/**
 * FEAT-20260924-680 (increment 2) — the cinematic launch.
 *
 * Watch asks for fullscreen inside its own gesture, so the screen is the
 * player frame from the first frame, and the "backdrop filling the screen"
 * has to happen inside it: the title's backdrop, full-bleed, eases up to
 * `scale(1.06)` while it fades to black, black holds, and the branded clip —
 * and after it the film — fades up out of the black on its first `playing`.
 *
 * Nothing tells the player that a start is a launch: that is decided in
 * `use-playback-doors.ts`, behind `video-player.tsx`, and the same door also
 * serves a deep link and the next episode. So a launch is read from what the
 * frame can see, and it is this, in order:
 *
 * 1. the first `play` of this mount, with the frame not yet filling the
 *    screen — the veil *holds* the backdrop over the picture, which on a
 *    16:9 frame looks exactly like the poster that was already there;
 * 2. the frame fills the screen within `ARM_WINDOW_MS` of that, still
 *    playing — Watch's door requests it 100 ms after `play()`;
 * 3. no fullscreen frame was torn down in the last `CONTINUATION_MS` — a
 *    player remounting for the next episode is a continuation, not a launch.
 *
 * A start that never fills the screen (a click on the inline picture, a media
 * key) lets go of the hold with a short fade; an unpause is never a first
 * play. Leaving fullscreen mid-launch shows the picture at once.
 */
const ARM_WINDOW_MS = 1000;
const CONTINUATION_MS = 3000;
/**
 * The veil ends on `animationend`; this is the ceiling if that never comes (a
 * hidden tab, an engine that drops the event), so the picture is never left
 * behind a black layer. Above `--dur-scene`'s 640 ms on the television.
 */
const VEIL_CEILING_MS = 1500;

let lastFullscreenTeardownAt = Number.NEGATIVE_INFINITY;

const LaunchFrameContext = createContext(false);

/**
 * `player-frame.tsx` wraps its children in this: whether the frame fills the
 * screen, natively or as the iOS pseudo-fullscreen. It also remembers when a
 * frame that filled the screen went away, which is what rule 3 reads.
 */
export function LaunchFrameProvider({
  fullscreen,
  children,
}: {
  fullscreen: boolean;
  children: ReactNode;
}) {
  const fullscreenRef = useRef(fullscreen);
  fullscreenRef.current = fullscreen;
  useEffect(
    () => () => {
      if (fullscreenRef.current) lastFullscreenTeardownAt = Date.now();
    },
    [],
  );
  return (
    <LaunchFrameContext.Provider value={fullscreen}>
      {children}
    </LaunchFrameContext.Provider>
  );
}

/**
 * - `idle` — nothing has played on this mount yet.
 * - `hold` — first play; the backdrop is held over the picture, undecided.
 * - `release` — not a launch after all; the hold fades away.
 * - `run` — the launch: the backdrop scales and fades to black.
 * - `dark` — black holds until the picture is playing.
 * - `up` — the clip (or the film) fades up.
 * - `swap` — the clip ended and the film is loading: black again.
 * - `done` / `off` — over, after a launch or without one.
 */
type Phase =
  | 'idle'
  | 'hold'
  | 'release'
  | 'run'
  | 'dark'
  | 'up'
  | 'swap'
  | 'done'
  | 'off';

interface State {
  phase: Phase;
  armedAt: number;
  /** A `playing` arrived before the veil reached black (held or running). */
  playing: boolean;
  /** The clip reached its end; the next `loadstart` is the film's. */
  ended: boolean;
}

type Action =
  | { type: 'play'; fullscreen: boolean; now: number }
  | { type: 'fullscreen'; now: number; paused: boolean }
  | { type: 'exit' }
  | { type: 'expire' }
  | { type: 'pause' }
  | { type: 'veil-end' }
  | { type: 'playing' }
  | { type: 'ended' }
  | { type: 'loadstart' };

const INITIAL: State = {
  phase: 'idle',
  armedAt: 0,
  playing: false,
  ended: false,
};

function step(state: State, action: Action): State {
  const { phase } = state;
  switch (action.type) {
    case 'play':
      if (phase !== 'idle') return state;
      return action.fullscreen
        ? { ...state, phase: 'off' }
        : { ...state, phase: 'hold', armedAt: action.now };
    case 'fullscreen': {
      if (phase !== 'hold') return state;
      // A teardown stamped in the future (the clock moved back) is no
      // evidence of anything.
      const sinceTeardown = action.now - lastFullscreenTeardownAt;
      const launch =
        !action.paused &&
        action.now - state.armedAt <= ARM_WINDOW_MS &&
        (sinceTeardown < 0 || sinceTeardown > CONTINUATION_MS);
      return { ...state, phase: launch ? 'run' : 'release' };
    }
    case 'expire':
    case 'pause':
      return phase === 'hold' ? { ...state, phase: 'release' } : state;
    case 'exit':
      return phase === 'run' || phase === 'dark' || phase === 'swap'
        ? { ...state, phase: 'done' }
        : state;
    case 'veil-end':
      if (phase === 'release') return { ...state, phase: 'off' };
      if (phase !== 'run') return state;
      return { ...state, phase: state.playing ? 'up' : 'dark' };
    case 'playing':
      // A cached clip can be playing before the frame fills the screen.
      if (phase === 'hold' || phase === 'run')
        return { ...state, playing: true };
      if (phase === 'dark') return { ...state, phase: 'up' };
      if (phase === 'swap') return { ...state, phase: 'done' };
      return state;
    case 'ended':
      return phase === 'up' ? { ...state, ended: true } : state;
    case 'loadstart':
      if (phase !== 'up') return state;
      return { ...state, phase: state.ended ? 'swap' : 'done' };
  }
}

const VIDEO_LAUNCH: Partial<Record<Phase, 'dark' | 'up'>> = {
  run: 'dark',
  dark: 'dark',
  swap: 'dark',
  up: 'up',
  done: 'up',
};

const VEIL: Partial<Record<Phase, 'hold' | 'run' | 'release'>> = {
  hold: 'hold',
  run: 'run',
  release: 'release',
};

export interface Launch {
  /** `data-launch` on the `<video>`: `dark` behind the veil, `up` fading in. */
  video: 'dark' | 'up' | undefined;
  /** The veil's state, or `undefined` when nothing is drawn. */
  veil: 'hold' | 'run' | 'release' | undefined;
  onVeilEnd: () => void;
  onPlay: () => void;
  onPlaying: () => void;
  onPause: () => void;
  onEnded: () => void;
  onLoadStart: () => void;
}

export function useLaunch(
  videoRef: RefObject<HTMLVideoElement | null>,
): Launch {
  const fullscreen = useContext(LaunchFrameContext);
  const [state, dispatch] = useReducer(step, INITIAL);
  const fullscreenRef = useRef(fullscreen);
  fullscreenRef.current = fullscreen;

  useEffect(() => {
    if (fullscreen) {
      dispatch({
        type: 'fullscreen',
        now: Date.now(),
        paused: videoRef.current?.paused ?? true,
      });
    } else {
      dispatch({ type: 'exit' });
    }
  }, [fullscreen, videoRef]);

  const { phase, armedAt } = state;
  useEffect(() => {
    if (phase !== 'hold') return;
    const timer = setTimeout(
      () => dispatch({ type: 'expire' }),
      Math.max(0, armedAt + ARM_WINDOW_MS - Date.now()),
    );
    return () => clearTimeout(timer);
  }, [phase, armedAt]);

  useEffect(() => {
    if (phase !== 'run' && phase !== 'release') return;
    const timer = setTimeout(
      () => dispatch({ type: 'veil-end' }),
      VEIL_CEILING_MS,
    );
    return () => clearTimeout(timer);
  }, [phase]);

  return {
    video: VIDEO_LAUNCH[phase],
    veil: VEIL[phase],
    onVeilEnd: () => dispatch({ type: 'veil-end' }),
    onPlay: () =>
      dispatch({
        type: 'play',
        fullscreen: fullscreenRef.current,
        now: Date.now(),
      }),
    onPlaying: () => dispatch({ type: 'playing' }),
    onPause: () => dispatch({ type: 'pause' }),
    onEnded: () => dispatch({ type: 'ended' }),
    onLoadStart: () => dispatch({ type: 'loadstart' }),
  };
}

/**
 * The veil itself: the backdrop, full-bleed over the picture. The black it
 * fades to is the frame's own `bg-black` — the picture under it is dark for
 * the whole run — so the layer carries nothing but the image, and a veil
 * with no backdrop draws nothing at all (it still times the run).
 *
 * A CSS background rather than an `<img>` or `next/image`: it is the very URL
 * the `<video>` already shows as its poster, so it comes from cache and is on
 * screen on the first frame; an optimised image would be a second fetch.
 *
 * One layer, opacity and transform only, `animation` rather than
 * `@starting-style` — the Samsung's Chromium 94 path. It unmounts when it is
 * done, so nothing rests with a transform.
 */
export function LaunchVeil({
  state,
  poster,
  onEnd,
}: {
  state: 'hold' | 'run' | 'release';
  poster: string | undefined;
  onEnd: () => void;
}) {
  return (
    <div
      className="launch-veil"
      data-veil={state}
      aria-hidden="true"
      onAnimationEnd={(e) => {
        // A layer's own end only; `animationend` bubbles.
        if (
          state === 'release'
            ? e.target === e.currentTarget
            : e.target !== e.currentTarget
        ) {
          onEnd();
        }
      }}
    >
      <div
        className="launch-veil-image"
        style={
          poster
            ? { backgroundImage: `url("${poster.replaceAll('"', '%22')}")` }
            : undefined
        }
      />
    </div>
  );
}
