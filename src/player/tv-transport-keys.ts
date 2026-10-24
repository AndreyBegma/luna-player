/**
 * FEAT-20260925-718 L2 — the transport keys of `use-player-keys.ts`, split
 * out of it unchanged (plan §8: the file was over the 500-line ceiling, and
 * this is the part the plan names). The handler still decides *when* they
 * are answered — after the clip guard and the controls coming up, before
 * every focus and in-use guard; this is only *what* each one does.
 */

/** J / L, and the remote's rewind and fast-forward. */
export const STEP_SECONDS = 10;

/** The `media*` rows: they name what they do, whatever holds focus. */
export function isTransportKey(id: string): boolean {
  return id.startsWith('media');
}

interface TransportActions {
  doPlay: () => void;
  ensurePlaying: () => void;
  pause: () => void;
  /** To the neighbour on that side; `false` when there is none. */
  stepEpisode: (direction: 1 | -1) => boolean;
  /** The playhead in the film's clock, for the remote's rewind and fast-forward. */
  currentTime: () => number;
  seekToTime: (time: number) => void;
}

/**
 * Answers one `media*` binding (`isTransportKey`).
 *
 * The transport keys say what they mean regardless of what is focused,
 * so unlike Enter they are always ours to handle.
 *
 * BUG-20260820-238 — the named values alone were not enough. Television
 * platforms publish their transport keys as numbers: Tizen and webOS
 * send 415 for play, 19 for pause, 413 for stop, and Tizen a combined
 * 10252 for play/pause. Matching only `MediaPlayPause` and friends
 * discarded every one of them.
 *
 * Note which number is absent. Android names its constant
 * MEDIA_PLAY_PAUSE = 85, and 85 is also the letter U on a keyboard — a
 * player where typing "u" pauses the film would be a worse bug than the
 * one being fixed here. Android TV reports the named value anyway.
 */
export function handleTransportKey(
  id: string,
  e: KeyboardEvent,
  {
    doPlay,
    ensurePlaying,
    pause,
    stepEpisode,
    currentTime,
    seekToTime,
  }: TransportActions,
): void {
  switch (id) {
    case 'mediaPlayPause':
      e.preventDefault();
      doPlay();
      return;
    case 'mediaPlay':
      e.preventDefault();
      ensurePlaying();
      return;
    case 'mediaPause':
    case 'mediaStop':
      e.preventDefault();
      pause();
      return;
    // FEAT-20260923-633 — the remote's and the headset's remaining
    // transport keys, on the same terms: they name what they do.
    case 'mediaTrackPrevious':
    case 'mediaTrackNext':
      if (stepEpisode(id === 'mediaTrackNext' ? 1 : -1)) e.preventDefault();
      return;
    case 'mediaRewind':
    case 'mediaFastForward':
      e.preventDefault();
      seekToTime(
        currentTime() + (id === 'mediaRewind' ? -STEP_SECONDS : STEP_SECONDS),
      );
      return;
  }
}
