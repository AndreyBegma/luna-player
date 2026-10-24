import type { HlsLoader } from './hls-types';

/**
 * FEAT-20260925-718 L3 — the one module that names hls.js.
 *
 * A bundler resolves a string-literal dynamic import at build time, so an
 * `import('hls.js')` anywhere under `luna-player/player` would fail the
 * build of a host that does not install the optional peer. The player takes
 * a loader instead, and this is the default a host with hls.js passes:
 *
 *   import { loadHls } from 'luna-player/hls';
 *   <Player src={mp4} hlsSrc={m3u8} loadHls={loadHls} />
 */
export const loadHls: HlsLoader = () => import('hls.js');
