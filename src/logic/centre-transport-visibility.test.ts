import { describe, expect, it } from 'bun:test';
import { CLUSTER_MIN_HEIGHT, centreTransport } from './centre-transport-visibility';

const base = { mediaReady: true, finePointer: false, showControls: true, containerHeight: 400 };

describe('centreTransport', () => {
  it('is the idle disc before there is media, whatever the device', () => {
    expect(centreTransport({ ...base, mediaReady: false })).toBe('idle');
    expect(centreTransport({ ...base, mediaReady: false, finePointer: true, containerHeight: 0 })).toBe('idle');
  });

  it('is the cluster without a fine pointer — a finger or a remote — with the controls up and room for it', () => {
    expect(centreTransport(base)).toBe('cluster');
    // A television: no touch points, no mouse. The discs are how a remote
    // reaches ±10 s without hunting for the bar's small buttons.
    expect(centreTransport({ ...base, containerHeight: 1080 })).toBe('cluster');
    expect(centreTransport({ ...base, containerHeight: CLUSTER_MIN_HEIGHT })).toBe('cluster');
  });

  it('is nothing on a portrait phone in the feed, and nothing while the controls are hidden', () => {
    expect(centreTransport({ ...base, containerHeight: 210 })).toBe('none');
    expect(centreTransport({ ...base, showControls: false })).toBe('none');
    expect(centreTransport({ ...base, containerHeight: 0 })).toBe('none');
  });

  it('leaves the desktop with the disc it has (the component hides it while playing)', () => {
    expect(centreTransport({ ...base, finePointer: true })).toBe('idle');
    expect(centreTransport({ ...base, finePointer: true, showControls: false })).toBe('idle');
  });
});
