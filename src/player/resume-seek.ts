/**
 * BUG-20260930-719 — put the film at the resume position, and make sure it
 * stays there.
 *
 * Every consumer of `pendingSeek` used to write `currentTime` once and trust
 * it: hls.js's `MANIFEST_PARSED`, while the element is still `HAVE_NOTHING`,
 * and `loadedmetadata` on the native path. Chrome and desktop WebKit keep an
 * early write as the default playback start position and honour it later.
 * iOS WebKit, whose media is AVFoundation, drops or resets a seek that lands
 * before `seekable` covers the target — and "Continue from 7:00" on an
 * iPhone started the episode from 0 while every other device resumed.
 *
 * So the write is made once as before, and then checked on the events that
 * follow it. While the playhead is short of the target, the seek is made
 * again, but only once `seekable` reaches the target and at most
 * `MAX_REAPPLIES` times: an element that never lands is not seeked forever.
 * The first `timeupdate` of playback at the target confirms it and lets go.
 *
 * `cancelResumeSeek` is for everything that decides the position after this:
 * the viewer's own seek, a start from the top, a source replaced under it.
 */

/** How far short of the target still counts as there. */
const TOLERANCE_S = 2;

/** Re-applications before giving up on an element that keeps dropping it. */
const MAX_REAPPLIES = 5;

const HAVE_METADATA = 1;

const CHECKED_ON = [
  'loadedmetadata',
  'loadeddata',
  'canplay',
  'playing',
  'seeked',
  'timeupdate',
] as const;

const armed = new WeakMap<HTMLVideoElement, () => void>();

function covers(seekable: TimeRanges | undefined, target: number): boolean {
  // An element that reports nothing about it is taken at its word.
  if (!seekable) return true;
  for (let i = 0; i < seekable.length; i++) {
    if (seekable.start(i) <= target && target <= seekable.end(i)) return true;
  }
  return false;
}

export function cancelResumeSeek(video: HTMLVideoElement | null): void {
  if (!video) return;
  armed.get(video)?.();
}

export function resumeSeek(video: HTMLVideoElement, target: number): void {
  cancelResumeSeek(video);
  video.currentTime = target;
  // A test double without events gets the single write it always got.
  if (typeof video.addEventListener !== 'function') return;

  let reapplied = 0;
  const stop = () => {
    for (const type of CHECKED_ON) video.removeEventListener(type, check);
    armed.delete(video);
  };
  function check(event: Event) {
    if (video.readyState < HAVE_METADATA) return;
    if (video.currentTime >= target - TOLERANCE_S) {
      if (event.type === 'timeupdate' && !video.paused && !video.seeking)
        stop();
      return;
    }
    if (video.seeking || !covers(video.seekable, target)) return;
    if (reapplied >= MAX_REAPPLIES) {
      stop();
      return;
    }
    reapplied += 1;
    video.currentTime = target;
  }
  for (const type of CHECKED_ON) video.addEventListener(type, check);
  armed.set(video, stop);
}
