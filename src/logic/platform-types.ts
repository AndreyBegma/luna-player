/**
 * FEAT-20260828-464 — the WebKit-only members of the media element and the
 * document that the player reaches for, in one place so that every hook that
 * needs a cast shares the same shape.
 */
export type AnyVideo = HTMLVideoElement & {
  webkitEnterFullscreen?: () => void;
  webkitExitFullscreen?: () => void;
  webkitDisplayingFullscreen?: boolean;
  webkitSupportsPresentationMode?: (
    mode: 'picture-in-picture' | 'inline',
  ) => boolean;
  webkitSetPresentationMode?: (mode: 'picture-in-picture' | 'inline') => void;
  webkitPresentationMode?: 'picture-in-picture' | 'inline' | 'fullscreen';
};

export interface AnyDocument extends Document {
  webkitFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => void;
}

/**
 * FEAT-20260824-377 — the element's own audio tracks, as Safari exposes them.
 *
 * `AudioTrackList` was dropped from the TypeScript DOM library because no
 * engine but WebKit implements it, which is precisely the engine that needs
 * it here: on an iPhone playing HLS natively this list is the only place the
 * manifest's dubs appear.
 */
interface NativeAudioTrack {
  enabled: boolean;
  label: string;
  language: string;
}

export interface NativeAudioTrackList {
  length: number;
  [index: number]: NativeAudioTrack;
  addEventListener?: (type: string, listener: () => void) => void;
  removeEventListener?: (type: string, listener: () => void) => void;
}
