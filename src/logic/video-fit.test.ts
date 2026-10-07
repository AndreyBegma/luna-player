import { describe, expect, it } from 'bun:test';

import {
  type ContentRect,
  detectContentRect,
  FULL_FRAME,
  fitTransform,
  foldSample,
  isFullFrame,
  parseFitMode,
  rectsAgree,
  shouldFill,
  unionRect,
} from './video-fit';

const BOX_16_9 = { width: 1600, height: 900 };
/** A phone held sideways: 19.5:9, the viewport pseudo-fullscreen fills. */
const BOX_PHONE = { width: 1755, height: 810 };
const FRAME_16_9 = { width: 1920, height: 1080 };
const FRAME_239 = { width: 1920, height: 803 };

/**
 * An RGBA buffer with black bands of the given thickness and a mid-grey
 * picture between them, so the detector has something lit to find.
 */
function frame({
  width,
  height,
  top = 0,
  bottom = 0,
  left = 0,
  right = 0,
  picture = 128,
  bar = 0,
}: {
  width: number;
  height: number;
  top?: number;
  bottom?: number;
  left?: number;
  right?: number;
  picture?: number;
  bar?: number;
}): Uint8ClampedArray {
  const pixels = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const inPicture =
        y >= top && y < height - bottom && x >= left && x < width - right;
      const value = inPicture ? picture : bar;
      const i = (y * width + x) * 4;
      pixels[i] = value;
      pixels[i + 1] = value;
      pixels[i + 2] = value;
      pixels[i + 3] = 255;
    }
  }
  return pixels;
}

/** What the content rectangle actually measures once the transform is on. */
function renderedContentAspect(
  box: { width: number; height: number },
  intrinsic: { width: number; height: number },
  content: ContentRect,
): number {
  const drawn = Math.min(
    box.width / intrinsic.width,
    box.height / intrinsic.height,
  );
  const t = fitTransform({ box, intrinsic, content });
  const scale = t?.scale ?? 1;
  const w = (content.x1 - content.x0) * intrinsic.width * drawn * scale;
  const h = (content.y1 - content.y0) * intrinsic.height * drawn * scale;
  return w / h;
}

describe('parseFitMode', () => {
  it('takes the three it knows and defaults everything else to auto', () => {
    expect(parseFitMode('fill')).toBe('fill');
    expect(parseFitMode('original')).toBe('original');
    expect(parseFitMode('auto')).toBe('auto');
    expect(parseFitMode(null)).toBe('auto');
    expect(parseFitMode('')).toBe('auto');
    expect(parseFitMode('cover')).toBe('auto');
  });
});

describe('shouldFill', () => {
  it('fills a 2.39:1 stream in the inline 16:9 box', () => {
    expect(
      shouldFill({
        box: BOX_16_9,
        intrinsic: FRAME_239,
        content: FULL_FRAME,
      }),
    ).toBe(true);
  });

  it('fills a 16:9 stream in a phone viewport held sideways', () => {
    expect(
      shouldFill({
        box: BOX_PHONE,
        intrinsic: FRAME_16_9,
        content: FULL_FRAME,
      }),
    ).toBe(true);
  });

  it('leaves a 16:9 stream in a 16:9 box alone', () => {
    expect(
      shouldFill({
        box: BOX_16_9,
        intrinsic: FRAME_16_9,
        content: FULL_FRAME,
      }),
    ).toBe(false);
  });

  it('leaves the thin bars of a 1.85:1 film alone', () => {
    // 3.9% of the box height, and FILL_THRESHOLD is 5%: below it on purpose.
    expect(
      shouldFill({
        box: BOX_16_9,
        intrinsic: { width: 1998, height: 1080 },
        content: FULL_FRAME,
      }),
    ).toBe(false);
  });

  it('fills when the bars are baked into a 16:9 frame', () => {
    expect(
      shouldFill({
        box: BOX_16_9,
        intrinsic: FRAME_16_9,
        content: { x0: 0, y0: 0.128, x1: 1, y1: 0.872 },
      }),
    ).toBe(true);
  });

  it('says nothing about a box or a frame it has no size for', () => {
    expect(
      shouldFill({
        box: { width: 0, height: 0 },
        intrinsic: FRAME_239,
        content: FULL_FRAME,
      }),
    ).toBe(false);
    expect(
      shouldFill({
        box: BOX_16_9,
        intrinsic: { width: 0, height: 0 },
        content: FULL_FRAME,
      }),
    ).toBe(false);
  });
});

describe('fitTransform', () => {
  it('covers the box with a 2.39:1 stream, without moving it', () => {
    const t = fitTransform({
      box: BOX_16_9,
      intrinsic: FRAME_239,
      content: FULL_FRAME,
    });
    // Drawn at 1600/1920, the frame is 669px tall in a 900px box.
    expect(t?.scale).toBeCloseTo(900 / ((803 * 1600) / 1920), 5);
    expect(t?.x).toBeCloseTo(0, 6);
    expect(t?.y).toBeCloseTo(0, 6);
  });

  it('has nothing to do when the shapes already agree', () => {
    expect(
      fitTransform({
        box: BOX_16_9,
        intrinsic: FRAME_16_9,
        content: FULL_FRAME,
      }),
    ).toBeNull();
  });

  it('scales a baked-in letterbox by the height it actually has', () => {
    const content = { x0: 0, y0: 0.128, x1: 1, y1: 0.872 };
    const t = fitTransform({
      box: BOX_16_9,
      intrinsic: FRAME_16_9,
      content,
    });
    // The picture is 74.4% of a frame drawn 900px tall, so 669px; it has to
    // reach 900. Horizontally it is already 1600 wide, so height decides.
    expect(t?.scale).toBeCloseTo(900 / (0.744 * 900), 5);
    // Centred bands: the content rectangle's centre is the frame's centre.
    expect(t?.y).toBeCloseTo(0, 6);
  });

  it('never changes the aspect ratio of the picture', () => {
    const content = { x0: 0, y0: 0.128, x1: 1, y1: 0.872 };
    const before = renderedContentAspect(BOX_16_9, FRAME_16_9, FULL_FRAME);
    const after = renderedContentAspect(BOX_16_9, FRAME_16_9, content);
    // The frame's aspect and the content rectangle's differ, which is the whole
    // point; what must not differ is the content rectangle's before and after
    // the transform, and that is what the ratio of its own sides is.
    expect(before).toBeCloseTo(1920 / 1080, 5);
    expect(after).toBeCloseTo((1920 * 1) / (1080 * 0.744), 5);
  });

  it('moves an off-centre content rectangle back to the middle', () => {
    // All the black at the bottom: the picture sits high in the frame.
    const t = fitTransform({
      box: BOX_16_9,
      intrinsic: FRAME_16_9,
      content: { x0: 0, y0: 0, x1: 1, y1: 0.744 },
    });
    expect(t).not.toBeNull();
    // The centre was above the box's, so it is pushed down.
    expect((t?.y ?? 0) > 0).toBe(true);
  });

  it('refuses a box or a frame with no size', () => {
    expect(
      fitTransform({
        box: { width: 0, height: 900 },
        intrinsic: FRAME_16_9,
        content: FULL_FRAME,
      }),
    ).toBeNull();
    expect(
      fitTransform({
        box: BOX_16_9,
        intrinsic: { width: 1920, height: 0 },
        content: FULL_FRAME,
      }),
    ).toBeNull();
  });
});

describe('detectContentRect', () => {
  it('finds a 2.39:1 picture baked into a 16:9 frame', () => {
    // 96 × 54, twelve percent of the height black at each end.
    const rect = detectContentRect(
      frame({ width: 96, height: 54, top: 7, bottom: 7 }),
      96,
      54,
    );
    expect(rect).not.toBeNull();
    expect(rect?.y0).toBeCloseTo(7 / 54, 6);
    expect(rect?.y1).toBeCloseTo(47 / 54, 6);
    expect(rect?.x0).toBe(0);
    expect(rect?.x1).toBe(1);
  });

  it('finds a pillarboxed 4:3 picture inside a 16:9 frame', () => {
    const rect = detectContentRect(
      frame({ width: 96, height: 54, left: 12, right: 12 }),
      96,
      54,
    );
    expect(rect?.x0).toBeCloseTo(12 / 96, 6);
    expect(rect?.x1).toBeCloseTo(84 / 96, 6);
    expect(rect?.y0).toBe(0);
    expect(rect?.y1).toBe(1);
  });

  it('will not call a band a band when one pixel of it is lit', () => {
    const pixels = frame({ width: 96, height: 54, top: 7, bottom: 7 });
    // A lamp, a subtitle, the corner of a logo — in the frame's very first row.
    const i = 40 * 4;
    pixels[i] = 60;
    pixels[i + 1] = 60;
    pixels[i + 2] = 60;
    const rect = detectContentRect(pixels, 96, 54);
    // The whole top band is disqualified by that one pixel; nothing is cropped
    // off the top, however black the six rows under it are.
    expect(rect?.y0).toBe(0);
    expect(rect?.y1).toBeCloseTo(47 / 54, 6);
  });

  it('stops a band at the first row that is not black', () => {
    const pixels = frame({ width: 96, height: 54, top: 7, bottom: 7 });
    const i = (3 * 96 + 40) * 4;
    pixels[i] = 60;
    pixels[i + 1] = 60;
    pixels[i + 2] = 60;
    const rect = detectContentRect(pixels, 96, 54);
    // Three rows, not seven: the scan stops where the black stops, so a lit
    // pixel can only ever make the crop smaller than the truth, never larger.
    expect(rect?.y0).toBeCloseTo(3 / 54, 6);
  });

  it('says nothing about a dark scene that is not black', () => {
    // Luma 20 everywhere: dim, above NEAR_BLACK, no bands at all.
    expect(
      detectContentRect(
        frame({ width: 96, height: 54, picture: 20, bar: 20 }),
        96,
        54,
      ),
    ).toBeNull();
  });

  it('says nothing about a frame that is entirely black', () => {
    expect(
      detectContentRect(
        frame({ width: 96, height: 54, picture: 0, bar: 0 }),
        96,
        54,
      ),
    ).toBeNull();
  });

  it('says nothing when the picture it found has no light in it', () => {
    // Real bands, but everything between them is luma 30 — under CONTENT_LUMA.
    expect(
      detectContentRect(
        frame({ width: 96, height: 54, top: 7, bottom: 7, picture: 30 }),
        96,
        54,
      ),
    ).toBeNull();
  });

  it('refuses a band thicker than a quarter of the frame', () => {
    // 40% of the height black at the top: a dark frame, not a letterbox.
    expect(
      detectContentRect(
        frame({ width: 96, height: 54, top: 22 }),
        96,
        54,
      ),
    ).toBeNull();
  });

  it('rounds away a single row of encoder noise', () => {
    // One row of 54 is 1.9%, under MIN_BAR.
    expect(
      detectContentRect(frame({ width: 96, height: 54, top: 1 }), 96, 54),
    ).toEqual(FULL_FRAME);
  });

  // FEAT-20260923-661 Q-01 — "no bands" is an answer, not "could not tell":
  // it is the sample that lets an applied crop go.
  it('reports the whole frame for a lit frame with no bands', () => {
    expect(
      detectContentRect(frame({ width: 96, height: 54 }), 96, 54),
    ).toEqual(FULL_FRAME);
  });

  it('refuses a buffer that is the wrong size for its dimensions', () => {
    expect(detectContentRect(new Uint8ClampedArray(16), 96, 54)).toBeNull();
    expect(detectContentRect(frame({ width: 8, height: 8 }), 0, 8)).toBeNull();
  });
});

describe('rectsAgree, unionRect and isFullFrame', () => {
  const a: ContentRect = { x0: 0, y0: 0.128, x1: 1, y1: 0.872 };

  it('agrees with itself and with a sample one percent off', () => {
    expect(rectsAgree(a, a)).toBe(true);
    expect(rectsAgree(a, { ...a, y0: 0.138 })).toBe(true);
  });

  it('does not agree with a sample five percent off', () => {
    expect(rectsAgree(a, { ...a, y0: 0.18 })).toBe(false);
  });

  it('takes the smaller crop of two rectangles', () => {
    const union = unionRect(a, { x0: 0, y0: 0.1, x1: 1, y1: 0.86 });
    expect(union.y0).toBeCloseTo(0.1, 6);
    expect(union.y1).toBeCloseTo(0.872, 6);
  });

  it('knows the whole frame when it sees it', () => {
    expect(isFullFrame(FULL_FRAME)).toBe(true);
    expect(isFullFrame(a)).toBe(false);
  });
});

// FEAT-20260923-661 Q-01 — the two rules the fold keeps: the crop grows only
// on two agreeing samples in a row, and retreats on one.
describe('foldSample', () => {
  const letterbox: ContentRect = { x0: 0, y0: 0.128, x1: 1, y1: 0.872 };
  const start = { applied: FULL_FRAME, candidate: null };

  it('holds a first crop as a candidate without applying it', () => {
    const next = foldSample(start, letterbox);
    expect(next.applied).toEqual(FULL_FRAME);
    expect(next.candidate).toEqual(letterbox);
  });

  it('applies a crop once a second sample agrees with it', () => {
    const next = foldSample(foldSample(start, letterbox), {
      ...letterbox,
      y0: 0.13,
    });
    expect(next.applied.y0).toBeCloseTo(0.128, 6);
    expect(next.candidate).toBeNull();
  });

  it('lets an applied crop go on one full-frame sample', () => {
    const next = foldSample({ applied: letterbox, candidate: null }, FULL_FRAME);
    expect(next.applied).toEqual(FULL_FRAME);
  });

  it('keeps what it has on a sample it could not judge', () => {
    const state = { applied: letterbox, candidate: null };
    expect(foldSample(state, null)).toBe(state);
  });

  it('does not agree across a full-frame sample in between', () => {
    const next = foldSample(
      foldSample(foldSample(start, letterbox), FULL_FRAME),
      letterbox,
    );
    expect(next.applied).toEqual(FULL_FRAME);
    expect(next.candidate).toEqual(letterbox);
  });
});
