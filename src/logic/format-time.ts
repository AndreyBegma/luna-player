/** `h:mm:ss` past the hour, `m:ss` under it — what the transport clock shows. */
export function formatTime(s: number) {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = Math.floor(s % 60);
  if (h > 0)
    return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  return `${m}:${String(sec).padStart(2, '0')}`;
}

/**
 * FEAT-20260919-619 — the time left, as `−1:39:58`: a real minus sign
 * (U+2212), never below zero, and the whole of the film while nothing has
 * played. What the clock reads once it is flipped to remaining.
 */
export function formatRemaining(elapsed: number, duration: number): string {
  return `−${formatTime(Math.max(0, duration - elapsed))}`;
}
