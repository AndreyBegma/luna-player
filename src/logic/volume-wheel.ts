/**
 * FEAT-20260919-619 — the wheel over the volume group: five per cent a
 * notch, up for louder, the way every desktop player does it.
 */

export const WHEEL_VOLUME_STEP = 0.05;

/** The volume after a wheel notch of `deltaY`; a notch away from the viewer is quieter. */
export function wheelVolume(volume: number, deltaY: number): number {
  if (deltaY === 0) return volume;
  const next = volume + (deltaY < 0 ? WHEEL_VOLUME_STEP : -WHEEL_VOLUME_STEP);
  // Rounded to hundredths so a long spin lands on 0.35, not 0.35000000000000003.
  return Math.round(Math.max(0, Math.min(next, 1)) * 100) / 100;
}
