/**
 * FEAT-20260914-579 — what the centre of the picture shows, decided without
 * rendering anything so a test can hold every branch.
 */

export type CentreTransport = 'idle' | 'cluster' | 'none';

/**
 * A player shorter than this has no room for three discs above its bar: a
 * 16:9 player on a portrait phone is ~210 px, and FEAT-20260824-377 already
 * settled that the bar owns play/pause there. A landscape phone, a tablet
 * and any fullscreen clear it.
 */
export const CLUSTER_MIN_HEIGHT = 300;

/**
 * FEAT-20260919-619 — decided on the pointer class, not on touch. A
 * television reaches the picture through keys and reports no fine pointer;
 * it gets the cluster and its two seek discs join the focus order. A desk
 * with a mouse keeps the idle disc and the bar's own ±10.
 */
export function centreTransport(input: {
  mediaReady: boolean;
  finePointer: boolean;
  showControls: boolean;
  containerHeight: number;
}): CentreTransport {
  // Before there is media the single play disc is the idle player's whole
  // interface (FEAT-20260823-365); seek discs for a stream not fetched would
  // be the fake control the material's rules forbid.
  if (!input.mediaReady) return 'idle';
  if (input.finePointer) return 'idle';
  if (!input.showControls) return 'none';
  return input.containerHeight >= CLUSTER_MIN_HEIGHT ? 'cluster' : 'none';
}
