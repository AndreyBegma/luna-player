'use client';

import { type RefObject, useCallback, useEffect, useRef, useState } from 'react';
import {
  arrowOwnerHasFocus,
  bindingFor,
  controlHasFocus,
  playerInUse,
  tenthFor,
  verticalArrowOwnerHasFocus,
} from '../logic/player-keys';
import type { PlayheadStore } from './playhead-store';
import { moveTransportFocus, moveWithinCluster } from './transport-focus';
import { handleTransportKey, isTransportKey, STEP_SECONDS } from './tv-transport-keys';
import { useBackCapture } from './use-back-capture';
import { useHoldSeek } from './use-hold-seek';
import { useKeyFeedback } from './use-key-feedback';
import { usePlatformMediaKeys } from './use-platform-media-keys';
import type { EpisodeRef } from './types';

/** One frame at the 25 fps most of the catalogue is mastered at. */
const FRAME_SECONDS = 1 / 25;

/** Enter and Space: the keys the DOM turns into a click on a focused button. */
function isActivationKey(e: KeyboardEvent): boolean {
  return e.key === 'Enter' || e.key === ' ' || e.code === 'Enter' || e.code === 'Space';
}

interface Options {
  videoRef: RefObject<HTMLVideoElement | null>;
  containerRef: RefObject<HTMLDivElement | null>;
  /** FEAT-20260821-261 — true only while the branded clip is on screen. */
  introActiveRef: RefObject<boolean>;
  showControls: boolean;
  fullscreenActive: boolean;
  pseudoFullscreen: boolean;
  /** FEAT-20260919-619 — no fine pointer: a television, or a phone with a keyboard. */
  finePointer: boolean;
  /** FEAT-20260919-619 — one of the player's menus is open; Back is its. */
  menuOpen: boolean;
  duration: number;
  /** The playhead in the film's clock, read when an arrow seeks from it. */
  playhead: PlayheadStore;
  /** Play, or pause, with the clip in front — the same door a click uses. */
  doPlay: () => void;
  ensurePlaying: () => void;
  exitFullscreen: () => void;
  toggleFullscreen: () => void;
  seekToTime: (time: number) => void;
  /** Whether a seek on this source restarts the stream — see `use-hold-seek.ts`. */
  seekRestartsStream: () => boolean;
  showAndScheduleHide: () => void;
  hideControls: () => void;
  setVolume: (volume: number) => void;
  setMuted: (muted: boolean) => void;
  /** `<` and `>`: one rung down or up the speed list; answers the rate it landed on. */
  onStepSpeed: (direction: 1 | -1) => number;
  /** `C`: subtitles off, or back on to the last chosen track. `null` with no tracks. */
  onToggleSubtitles: (() => void) | null;
  /**
   * FEAT-20260902-541 — `R` repeats the line the viewer is on.
   *
   * `null` whenever learning mode's subtitles are not on screen, so the key is
   * not merely inert but unbound: with no cue layer there is no line, and a
   * letter that silently does nothing on every other film is a key nobody can
   * learn.
   */
  onRepeatLine: (() => void) | null;
  /**
   * FEAT-20260923-633 — the neighbours, as the page names them, for Shift+N /
   * Shift+P and the track keys. Built inline by the pages, so read through a
   * ref rather than bound into the listener.
   */
  onPrevEpisode: EpisodeRef | null | undefined;
  onNextEpisode: EpisodeRef | null | undefined;
  onEpisodeChange: ((episodeId: string) => void) | undefined;
}

/**
 * FEAT-20260828-464 — the keyboard, the remote and the platform's transport
 * keys, out of the player: the window `keydown` handler here, the Tizen key
 * registration and the `mediaSession` handlers in
 * `use-platform-media-keys.ts`, the held arrow's clock in `use-hold-seek.ts`.
 *
 * FEAT-20260919-619 — every key is a row of `KEY_BINDINGS` in
 * `player-keys.ts`; `bindingFor` names it and the handler dispatches on the
 * name. The guards keep the order they have always had: the transport keys
 * are always ours, then a control that owns the arrows wins, then the player
 * has to be in use at all, then the rest.
 */
export function usePlayerKeys({
  videoRef,
  containerRef,
  introActiveRef,
  showControls,
  fullscreenActive,
  pseudoFullscreen,
  finePointer,
  menuOpen,
  duration,
  playhead,
  doPlay,
  ensurePlaying,
  exitFullscreen,
  toggleFullscreen,
  seekToTime,
  seekRestartsStream,
  showAndScheduleHide,
  hideControls,
  setVolume,
  setMuted,
  onStepSpeed,
  onToggleSubtitles,
  onRepeatLine,
  onPrevEpisode,
  onNextEpisode,
  onEpisodeChange,
}: Options) {
  /**
   * BUG-20260820-238 — what the last key event actually contained.
   *
   * This bug cannot be reproduced anywhere but on the television, and the
   * previous attempt to fix it blind did not work. Rather than guess a third
   * time, `?keydebug=1` puts the raw event on screen so whoever is holding the
   * remote can read out what the set really sends — or see nothing appear at
   * all, which would mean the television keeps the key for itself and no
   * amount of matching in here will ever help.
   */
  const [lastKey, setLastKey] = useState<string | null>(null);
  const keyDebug =
    typeof window !== 'undefined' &&
    new URLSearchParams(window.location.search).get('keydebug') === '1';

  /** FEAT-20260919-619 — the `?` sheet. */
  const [helpOpen, setHelpOpen] = useState(false);

  const hold = useHoldSeek({ playhead, duration, seekToTime, seekRestartsStream });
  const { begin: beginHold, end: endHold } = hold;

  const openHelp = useCallback(() => setHelpOpen(true), []);
  const { feedback: keyFeedback, flash } = useKeyFeedback();

  const neighbours = useRef({ onPrevEpisode, onNextEpisode, onEpisodeChange });
  useEffect(() => {
    neighbours.current = { onPrevEpisode, onNextEpisode, onEpisodeChange };
  }, [onPrevEpisode, onNextEpisode, onEpisodeChange]);

  /** FEAT-20260923-633 — to the neighbour on that side; `false` when there is none. */
  const stepEpisode = useCallback((direction: 1 | -1): boolean => {
    const { onPrevEpisode: prev, onNextEpisode: next, onEpisodeChange: change } =
      neighbours.current;
    const target = direction === 1 ? next : prev;
    if (!target || !change) return false;
    change(target.id);
    return true;
  }, []);

  usePlatformMediaKeys({
    videoRef,
    ensurePlaying,
    stepEpisode,
    hasPrevEpisode: Boolean(onPrevEpisode && onEpisodeChange),
    hasNextEpisode: Boolean(onNextEpisode && onEpisodeChange),
  });

  useBackCapture({
    containerRef,
    introActiveRef,
    fullscreenActive,
    finePointer,
    showControls,
    menuOpen,
    sheetOpen: helpOpen,
    hideControls,
  });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const v = videoRef.current;
      if (!v) return;
      // FEAT-20260821-261 — the clip owns the picture while it runs; nothing
      // on the keyboard or the remote pauses, seeks or skips past it.
      if (introActiveRef.current) return;

      if (keyDebug) {
        setLastKey(
          `key=${JSON.stringify(e.key)} code=${JSON.stringify(e.code)} keyCode=${e.keyCode}`,
        );
      }

      // Remotes and other non-keyboard devices routinely fill in `key` and
      // leave `code` empty — `code` describes a position on a keyboard they
      // do not have. `bindingFor` reads both, so a device only has to report
      // one.
      const binding = bindingFor(e);
      if (!binding) return;
      // The capture-phase listener above already answered this Back by
      // hiding the controls; bringing them straight back would undo it.
      if (binding.id === 'back' && e.defaultPrevented) return;

      // FEAT-20260923-661 Q-03 — the controls come up for a key the player
      // answers: a transport key from anywhere, the rest only in use (the
      // guard below). Before, typing in the page's search field or scrolling
      // it with the arrows brought an unwatched player's transport up.
      const inUse = playerInUse(containerRef.current, fullscreenActive);
      if (isTransportKey(binding.id) || inUse) showAndScheduleHide();

      // FEAT-20260925-718 L2 — the transport keys, always ours: see
      // `tv-transport-keys.ts`, which this switch was split out to.
      if (isTransportKey(binding.id)) {
        handleTransportKey(binding.id, e, {
          doPlay,
          ensurePlaying,
          pause: () => v.pause(),
          stepEpisode,
          currentTime: () => playhead.get().time,
          seekToTime,
        });
        return;
      }

      // FEAT-20260919-619 — the sheet is a dialog with its own keys; while it
      // is up, the player's are not listening.
      if (helpOpen) return;

      // Everything below is a key the focus system may also want — but only
      // while the controls are actually on screen.
      //
      // BUG-20260820-238 — the guard added in BUG-20260820-236 was too broad.
      // Hiding the controls sets `opacity-0 pointer-events-none` on the
      // overlay; the button inside it becomes invisible and unclickable but
      // keeps DOM focus. On a television that is the normal state seconds
      // after entering fullscreen, with focus stranded on the fullscreen
      // button the viewer just pressed — so OK deferred to a control nobody
      // could see, and pressing anywhere did nothing at all.
      //
      // A control owns the key while it is visible. Once it is gone, the
      // player takes the keys back.
      //
      // FEAT-20260830-489 — narrowed to the controls that genuinely own the
      // keys: a text field, a slider, an open menu. The broad test is still
      // applied to Enter and Space further down, which is the pair
      // BUG-20260820-238 was actually about; applying it to the arrows as well
      // meant that on a television, where a control holds focus almost all the
      // time the transport is up, the viewer could not seek at all.
      //
      // FEAT-20260919-619 — Up and Down ask the narrower question: the
      // scrubber owns Left and Right and nothing vertical, and a remote that
      // lands on it must be able to leave it for the cluster above.
      //
      // BUG-20260924-691 — only the arrows ask this question at all. The
      // ternary used to run for every binding that reached this line, so
      // once the scrubber (`[role="slider"]`) took focus after a drag,
      // `arrowOwnerHasFocus()` being true deferred Space, K, M, F and every
      // other letter to it as well — none of which the slider answers — and
      // they stayed dead until focus moved elsewhere.
      const vertical = binding.id === 'up' || binding.id === 'down';
      const horizontal =
        binding.id === 'seekBack' ||
        binding.id === 'seekBackCoarse' ||
        binding.id === 'seekForward' ||
        binding.id === 'seekForwardCoarse';
      if (showControls) {
        if (vertical && verticalArrowOwnerHasFocus()) return;
        if (horizontal && arrowOwnerHasFocus()) return;
      }

      // BUG-20260823-368 — and the page owns them while nobody is watching.
      //
      // Everything above this line is addressed to the machine: a remote's
      // play button is not sent to a focused element, which is the whole
      // point of BUG-20260820-238. Everything below it is addressed to a
      // player somebody is using — and until now the handler never asked
      // whether anybody was.
      //
      // The player is mounted inline, halfway down a page of text, on all
      // three title pages. With focus on `<body>` — the normal state of a
      // page nobody has clicked into — `ArrowUp`, `ArrowDown` and `Space`
      // were taken from the browser and given to a video the reader had not
      // touched. The page could not be scrolled with the keyboard, the volume
      // of an unwatched film changed instead, and the space bar started
      // playback out loud. Only `PageDown` and `Home` still scrolled, and
      // nobody reads a page with those.
      //
      // Fullscreen is an `||` rather than an `&&` on purpose. In fullscreen on
      // a television focus is routinely on nothing at all — that is the state
      // BUG-20260820-238 was filed about — so requiring focus inside the
      // container would take the shortcuts away exactly where they matter
      // most.
      //
      // Deliberately *not* included: whether the video is playing. A film
      // playing inline while somebody reads the page below it is the case
      // where scrolling should still win.
      if (!inUse) return;

      switch (binding.id) {
        case 'back':
          // FEAT-20260824-377 — the viewport-filling fullscreen is ours, so the
          // key that leaves the browser's own is ours to honour too. Nothing
          // else answers Escape while it is on. (Hiding the controls first is
          // the capture-phase listener above; a press that reaches here found
          // them already down.)
          if (e.key === 'Escape' && pseudoFullscreen) {
            e.preventDefault();
            exitFullscreen();
          }
          return;
        case 'playPause':
          // BUG-20260820-236 — the broad test, and only here. The DOM dispatches
          // a click for Enter on a focused button, so acting on it as well
          // toggles playback twice and leaves it where it started. K is not
          // an activation key and never doubles up, so it is not guarded.
          if (showControls && isActivationKey(e) && controlHasFocus()) return;
          e.preventDefault();
          doPlay();
          return;
        case 'seekBack':
        case 'seekBackCoarse':
        case 'seekForward':
        case 'seekForwardCoarse': {
          e.preventDefault();
          const direction = binding.id.startsWith('seekBack') ? -1 : 1;
          // FEAT-20260919-619 — inside the centre cluster the arrows walk the
          // discs; off either end they seek, as everywhere else.
          if (showControls && moveWithinCluster(direction === 1 ? 'right' : 'left'))
            return;
          if (e.repeat) return;
          // FEAT-20260830-489 — Shift is the coarse step, matching the scrubber.
          beginHold(direction, binding.id.endsWith('Coarse'));
          return;
        }
        case 'seekBackStep':
        case 'seekForwardStep':
          e.preventDefault();
          seekToTime(
            playhead.get().time + (binding.id === 'seekBackStep' ? -STEP_SECONDS : STEP_SECONDS),
          );
          return;
        case 'up':
        case 'down': {
          /**
           * FEAT-20260830-489 — the vertical axis does two jobs, decided by
           * whether the transport is on screen.
           *
           * Left and Right always seek, because seeking is what a viewer reaches
           * for constantly and it is what those keys mean to everybody. That
           * leaves no horizontal axis for moving between the controls — so the
           * vertical one takes it, but only while there are controls to move
           * between. With the transport hidden the player is simply being
           * watched, and Up and Down are volume, which is where a remote without
           * dedicated volume keys expects to find it. The walk itself is
           * `transport-focus.ts`; off either end it falls through to volume
           * rather than swallowing the press.
           */
          e.preventDefault();
          const container = containerRef.current;
          if (showControls && container && moveTransportFocus(container, binding.id)) return;
          const step = binding.id === 'up' ? 0.1 : -0.1;
          v.volume = Math.max(0, Math.min(v.volume + step, 1));
          setVolume(v.volume);
          flash({ kind: 'volume', level: v.volume, muted: v.muted });
          return;
        }
        case 'jumpTenth': {
          const tenth = tenthFor(e);
          if (tenth === null || duration <= 0) return;
          e.preventDefault();
          seekToTime((duration * tenth) / 10);
          return;
        }
        case 'frameBack':
        case 'frameForward':
          // A frame step is a paused film's: while it plays the next frame is
          // already on its way.
          if (!v.paused) return;
          e.preventDefault();
          seekToTime(
            playhead.get().time + (binding.id === 'frameBack' ? -FRAME_SECONDS : FRAME_SECONDS),
          );
          return;
        case 'speedDown':
        case 'speedUp':
          e.preventDefault();
          flash({ kind: 'rate', rate: onStepSpeed(binding.id === 'speedUp' ? 1 : -1) });
          return;
        case 'mute':
          v.muted = !v.muted;
          setMuted(v.muted);
          flash({ kind: 'volume', level: v.volume, muted: v.muted });
          return;
        case 'fullscreen':
          toggleFullscreen();
          return;
        case 'subtitles':
          if (!onToggleSubtitles) return;
          e.preventDefault();
          onToggleSubtitles();
          return;
        case 'repeatLine':
          // FEAT-20260902-541 — beside the other letters this player answers,
          // and guarded by the same tests they are: the film is in use, and
          // no field or menu has asked for the keyboard.
          if (!onRepeatLine) return;
          e.preventDefault();
          onRepeatLine();
          return;
        case 'previousEpisode':
        case 'nextEpisode':
          // FEAT-20260923-633 — Shift+P / Shift+N, where the page supplied
          // that neighbour; on a film, or at either end of a season, unbound.
          if (stepEpisode(binding.id === 'nextEpisode' ? 1 : -1)) e.preventDefault();
          return;
        case 'help':
          // FEAT-20260919-621 — everywhere, including element fullscreen:
          // there the sheet is portalled into the player's element
          // (`key-sheet.tsx`), so there is nowhere it opens unseen.
          e.preventDefault();
          setHelpOpen(true);
          return;
      }
    };

    // The hold ends with the arrow that started it; other keys coming up are
    // not its business.
    const onKeyUp = (e: KeyboardEvent) => {
      const id = bindingFor(e)?.id;
      if (id?.startsWith('seekBack') || id?.startsWith('seekForward')) endHold();
    };

    window.addEventListener('keydown', onKey);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [
    videoRef,
    containerRef,
    introActiveRef,
    keyDebug,
    helpOpen,
    showControls,
    // BUG-20260823-368 — the handler now reads it, so it has to re-bind when
    // it changes; without this the closure keeps the value from mount and
    // fullscreen never gets its shortcuts.
    fullscreenActive,
    pseudoFullscreen,
    duration,
    exitFullscreen,
    ensurePlaying,
    showAndScheduleHide,
    doPlay,
    toggleFullscreen,
    seekToTime,
    beginHold,
    endHold,
    // FEAT-20260914-584 (#1053) — the playhead is read from the store when a
    // key fires, so the listener no longer re-binds on every `timeupdate`.
    playhead,
    setVolume,
    setMuted,
    onStepSpeed,
    onToggleSubtitles,
    onRepeatLine,
    stepEpisode,
    flash,
  ]);

  return {
    keyDebug,
    lastKey,
    helpOpen,
    setHelpOpen,
    openHelp,
    feedback: hold.feedback ?? keyFeedback,
  };
}
