/**
 * BUG-20260930-719 — the resume seek against an element that behaves like iOS
 * WebKit: a `currentTime` write is dropped until `seekable` reaches it.
 */
import { beforeEach, describe, expect, test } from 'bun:test';
import { DroppingVideo } from './dropping-video';
import { cancelResumeSeek, resumeSeek } from './resume-seek';

let video: DroppingVideo;

beforeEach(() => {
  video = new DroppingVideo();
  video.paused = false;
});

describe('resumeSeek', () => {
  test('the single early write is lost on this element — the bug', () => {
    video.element.currentTime = 420;
    video.becomeSeekable();
    video.advance(0.5);
    expect(video.currentTime).toBe(0.5);
  });

  test('re-applies once seekable reaches the target, and lands', () => {
    resumeSeek(video.element, 420);
    expect(video.currentTime).toBe(0);

    video.readyState = 1;
    video.fire('loadedmetadata');
    expect(video.currentTime).toBe(0);

    video.becomeSeekable();
    expect(video.currentTime).toBe(420);
  });

  test('a playhead reset back to the start after landing is sought again', () => {
    video.becomeSeekable();
    resumeSeek(video.element, 420);
    expect(video.currentTime).toBe(420);

    video.advance(0);
    expect(video.currentTime).toBe(420);
  });

  test('lets go once playback is running at the target', () => {
    video.becomeSeekable();
    resumeSeek(video.element, 420);
    video.advance(421);
    const writes = video.writes;

    video.advance(10);
    expect(video.currentTime).toBe(10);
    expect(video.writes).toBe(writes);
  });

  test('gives up after a bounded number of re-applications', () => {
    video.becomeSeekable();
    resumeSeek(video.element, 420);
    for (let i = 0; i < 20; i++) video.advance(0);
    // The first write, plus five more.
    expect(video.writes).toBe(6);
  });

  test('cancelling hands the position back to whoever moves it next', () => {
    video.becomeSeekable();
    resumeSeek(video.element, 420);
    cancelResumeSeek(video.element);

    video.advance(0);
    expect(video.currentTime).toBe(0);
  });

  test('a second resume replaces the first', () => {
    video.becomeSeekable();
    resumeSeek(video.element, 420);
    resumeSeek(video.element, 900);

    video.advance(0);
    expect(video.currentTime).toBe(900);
  });

  test('an element without events gets the one write it always got', () => {
    const plain = { currentTime: 0 } as unknown as HTMLVideoElement;
    resumeSeek(plain, 420);
    expect(plain.currentTime).toBe(420);
  });
});
