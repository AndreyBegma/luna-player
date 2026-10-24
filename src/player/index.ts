/**
 * FEAT-20260925-718 L3 — `luna-player/player`: the first `<Player>` and
 * what a host types it with. hls.js is not reachable from here; a host that
 * wants it passes `loadHls` from `luna-player/hls`.
 */
export { Player } from './player';
export { localStoragePlayerStorage } from './storage/local-storage';
export type {
  HlsLoader,
  PlayerAspectRatio,
  PlayerError,
  PlayerHandle,
  PlayerProps,
  PlayerStorage,
} from './types';
