/**
 * FEAT-20260831-503 — the geometry and the letterbox detector, with no DOM in
 * either of them.
 *
 * A film arrives letterboxed for two quite different reasons, and the player
 * has to answer both with one gesture:
 *
 *  1. the stream's own shape disagrees with the box it is drawn into — a 2.39:1
 *     encode in a 16:9 player, or a 16:9 encode in the 19.5:9 viewport of a
 *     phone held sideways. `videoWidth / videoHeight` says so, exactly and for
 *     free;
 *  2. the bars are baked into the frame — a 2.39:1 film delivered inside a 16:9
 *     encode. `videoWidth / videoHeight` says 16:9 and lies, and the only way
 *     to know better is to look at a decoded frame.
 *
 * Both end at the same place: a *content rectangle* inside the frame, expressed
 * as fractions of it. Case 1 is the whole frame; case 2 is what
 * `detectContentRect` finds. `fitTransform` then scales that rectangle until it
 * covers the box — and with a whole-frame rectangle it reduces exactly to
 * `object-fit: cover`, which is why the hook can emit the one cheap CSS
 * property whenever nothing was detected, and only reach for a transform when
 * a real baked-in letterbox was.
 */

export type FitMode = 'auto' | 'original' | 'fill';

/** A rectangle inside the decoded frame, as fractions of it. */
export interface ContentRect {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export const FULL_FRAME: ContentRect = { x0: 0, y0: 0, x1: 1, y1: 1 };

export interface Size {
  width: number;
  height: number;
}

export interface FitInput {
  /** The `<video>` element's own box, in CSS pixels. */
  box: Size;
  /** `videoWidth` × `videoHeight` — the decoded frame. */
  intrinsic: Size;
  /** Where the picture actually is inside that frame. */
  content: ContentRect;
}

export interface FitTransform {
  scale: number;
  /** CSS pixels, applied before the scale in `translate(...) scale(...)`. */
  x: number;
  y: number;
}

/**
 * A pixel at or below this is black as far as this file is concerned.
 *
 * Encoders do not deliver a mathematically black bar: chroma noise and the
 * limited range of a 16–235 encode both lift it a little. 16 is above that
 * floor and far below anything a viewer would call picture.
 */
const NEAR_BLACK = 16;

/**
 * The derived content rectangle has to contain at least one pixel this bright.
 *
 * This is the guard that a night scene fails. A frame that is dim everywhere
 * has no lit picture to point at, and the honest answer for it is "no opinion"
 * rather than a crop.
 */
const CONTENT_LUMA = 48;

/**
 * A band thicker than this is not a letterbox.
 *
 * The widest ratio anybody ships inside a 16:9 container is about 2.76:1, which
 * is 17.8% a side. Past a quarter of the frame the picture is dark, not
 * letterboxed, and the whole sample is thrown away.
 */
const MAX_BAR = 0.25;

/** Thinner than this is encoder noise, not a bar. */
const MIN_BAR = 0.02;

/**
 * How much of the box the bars have to take before Auto fills.
 *
 * FEAT-20260831-503, at the orchestrator's call: 0.05 rather than 0.02. A
 * 1.85:1 film in a 16:9 box leaves 3.9% of black, about twenty pixels on a
 * 1080-tall screen, and cropping 4% off the sides of the picture to be rid of
 * them is the worse trade. The complaint this feature answers is wide bars — a
 * 2.39:1 film, or a 16:9 episode in a phone's viewport, both a quarter of the
 * box or more — and 0.05 still catches those with room to spare.
 */
const FILL_THRESHOLD = 0.05;

/** Two samples agree when every edge is within this of the other's. */
const AGREE_TOLERANCE = 0.02;

/** Below this a transform is not worth writing to the element. */
const IDENTITY_EPSILON = 0.002;

/** Rectangles are built from integer row counts; this is only float slack. */
const RECT_EPSILON = 1e-6;

export function parseFitMode(value: string | null | undefined): FitMode {
  return value === 'original' || value === 'fill' || value === 'auto'
    ? value
    : 'auto';
}

function luma(pixels: ArrayLike<number>, index: number): number {
  return (
    0.2126 * pixels[index] +
    0.7152 * pixels[index + 1] +
    0.0722 * pixels[index + 2]
  );
}

/**
 * The picture inside a sampled frame, or `null` when the sample says nothing.
 *
 * `pixels` is RGBA, four bytes per pixel, `width * height` of them — an
 * `ImageData.data` from a downscaled `drawImage`.
 *
 * A lit frame with no band is `FULL_FRAME`: that is a finding, and the one
 * that lets a crop go.
 *
 * Conservative on purpose, in four independent ways. A band row counts only
 * when *every* pixel in it is at or below `NEAR_BLACK`, so one lit pixel
 * anywhere along it — a lamp, a subtitle, the corner of a logo — disqualifies
 * the row. A band past `MAX_BAR` discards the sample. The content rectangle has
 * to contain light. And a band under `MIN_BAR` is rounded away.
 *
 * The caller adds the fifth: it takes two agreeing samples before the crop is
 * allowed to grow. Cropping a film that was not letterboxed is a far worse
 * failure than leaving bars on one that was, so every rule here is written to
 * fail towards doing nothing.
 */
export function detectContentRect(
  pixels: ArrayLike<number>,
  width: number,
  height: number,
): ContentRect | null {
  if (width <= 0 || height <= 0) return null;
  if (pixels.length < width * height * 4) return null;

  const rowIsBar = (y: number): boolean => {
    const row = y * width * 4;
    for (let x = 0; x < width; x += 1) {
      if (luma(pixels, row + x * 4) > NEAR_BLACK) return false;
    }
    return true;
  };
  let top = 0;
  while (top < height && rowIsBar(top)) top += 1;
  // Every row was black: the frame is dark, or the decoder handed over nothing.
  if (top === height) return null;
  let bottom = 0;
  while (bottom < height - top && rowIsBar(height - 1 - bottom)) bottom += 1;

  /**
   * Columns are judged inside the picture band only.
   *
   * Over the whole height, every column runs through the letterbox bars, so a
   * picture with a dark left edge reads as pillarboxed on top of being
   * letterboxed. A pillarbox is a property of the band that has picture in it.
   */
  const columnIsBar = (x: number): boolean => {
    const column = x * 4;
    for (let y = top; y < height - bottom; y += 1) {
      if (luma(pixels, y * width * 4 + column) > NEAR_BLACK) return false;
    }
    return true;
  };

  let left = 0;
  while (left < width && columnIsBar(left)) left += 1;
  if (left === width) return null;
  let right = 0;
  while (right < width - left && columnIsBar(width - 1 - right)) right += 1;

  const bars = [top / height, bottom / height, left / width, right / width];
  if (bars.some((bar) => bar > MAX_BAR)) return null;

  if (top / height < MIN_BAR) top = 0;
  if (bottom / height < MIN_BAR) bottom = 0;
  if (left / width < MIN_BAR) left = 0;
  if (right / width < MIN_BAR) right = 0;

  const rect: ContentRect = {
    x0: left / width,
    y0: top / height,
    x1: (width - right) / width,
    y1: (height - bottom) / height,
  };

  // The picture this claims to have found has to be lit. Without this a slow
  // fade to black reads as a frame growing bars on all four sides.
  let lit = false;
  for (let y = top; y < height - bottom && !lit; y += 1) {
    const row = y * width * 4;
    for (let x = left; x < width - right; x += 1) {
      if (luma(pixels, row + x * 4) > CONTENT_LUMA) {
        lit = true;
        break;
      }
    }
  }
  if (!lit) return null;

  // FEAT-20260923-661 Q-01 — no band is an answer, not "no opinion": it is
  // the sample that lets a crop go once the film opens up to the full frame.
  if (top === 0 && bottom === 0 && left === 0 && right === 0) return FULL_FRAME;
  return rect;
}

/** The content rectangle's aspect ratio, in the frame's own pixels. */
function aspectOf(content: ContentRect, intrinsic: Size): number {
  const width = (content.x1 - content.x0) * intrinsic.width;
  const height = (content.y1 - content.y0) * intrinsic.height;
  return height > 0 ? width / height : 0;
}

/**
 * How much of the box the bars would take, as a fraction of the dimension they
 * sit on: 0 when the picture and the box are the same shape, 0.256 for a 2.39:1
 * film in a 16:9 box.
 */
function barFraction({ box, intrinsic, content }: FitInput): number {
  const picture = aspectOf(content, intrinsic);
  if (picture <= 0 || box.width <= 0 || box.height <= 0) return 0;
  const frame = box.width / box.height;
  return picture > frame ? 1 - frame / picture : 1 - picture / frame;
}

/** The Auto decision: bars on both opposite sides, past the tolerance. */
export function shouldFill(input: FitInput): boolean {
  return barFraction(input) > FILL_THRESHOLD;
}

/**
 * What to do to a `<video>` drawn with `object-fit: contain` so that its
 * content rectangle covers the box instead of sitting inside it.
 *
 * `contain` draws the frame at `s = min(W/w, H/h)`, centred. So the content
 * rectangle lands on screen `(x1-x0)·w·s` by `(y1-y0)·h·s`, with its centre
 * offset from the box's by however far off-centre it is in the frame. Scaling
 * by `k = max(W/cw, H/ch)` makes it cover; translating by `−k·d` brings its
 * centre back to the middle. The picture's own aspect ratio is untouched —
 * there is one scale factor and it applies to both axes.
 *
 * `null` when there is nothing to do.
 */
export function fitTransform({
  box,
  intrinsic,
  content,
}: FitInput): FitTransform | null {
  if (box.width <= 0 || box.height <= 0) return null;
  if (intrinsic.width <= 0 || intrinsic.height <= 0) return null;

  const drawn = Math.min(
    box.width / intrinsic.width,
    box.height / intrinsic.height,
  );
  const contentWidth = (content.x1 - content.x0) * intrinsic.width * drawn;
  const contentHeight = (content.y1 - content.y0) * intrinsic.height * drawn;
  if (contentWidth <= 0 || contentHeight <= 0) return null;

  const scale = Math.max(
    box.width / contentWidth,
    box.height / contentHeight,
  );
  if (!Number.isFinite(scale) || scale <= 1 + IDENTITY_EPSILON) return null;

  const offsetX =
    ((content.x0 + content.x1) / 2 - 0.5) * intrinsic.width * drawn;
  const offsetY =
    ((content.y0 + content.y1) / 2 - 0.5) * intrinsic.height * drawn;

  return { scale, x: -scale * offsetX, y: -scale * offsetY };
}

export function isFullFrame(content: ContentRect): boolean {
  return (
    content.x0 <= RECT_EPSILON &&
    content.y0 <= RECT_EPSILON &&
    content.x1 >= 1 - RECT_EPSILON &&
    content.y1 >= 1 - RECT_EPSILON
  );
}

export function rectsAgree(a: ContentRect, b: ContentRect): boolean {
  return (
    Math.abs(a.x0 - b.x0) <= AGREE_TOLERANCE &&
    Math.abs(a.y0 - b.y0) <= AGREE_TOLERANCE &&
    Math.abs(a.x1 - b.x1) <= AGREE_TOLERANCE &&
    Math.abs(a.y1 - b.y1) <= AGREE_TOLERANCE
  );
}

/** What the fit has applied, and a crop seen once that is waiting for a second. */
export interface FitSampling {
  applied: ContentRect;
  candidate: ContentRect | null;
}

/**
 * A sample, folded into what is already applied.
 *
 * Two rules. The crop never grows on the strength of one sample: a rectangle
 * that crops more than the applied one is only a candidate, and it takes the
 * next sample agreeing with it — and then the *union* of the two, the smaller
 * crop of the pair, is what is applied. The crop always retreats on one: a
 * sample that sees less bar anywhere, the whole frame included, is taken
 * immediately, because leaving bars on a film is a far cheaper mistake than
 * eating a picture.
 *
 * `null` is neither of those. The detector returns it when the sample cannot
 * be judged — a scene too dark to read, a band too thick to be a band — and
 * "I could not tell" must not undo a crop that two samples agreed on. A film
 * that fills correctly at ten seconds would otherwise fall back to bars at
 * thirty because it happened to be night in the frame.
 *
 * Returns `state` itself when nothing changed.
 */
export function foldSample(
  state: FitSampling,
  found: ContentRect | null,
): FitSampling {
  if (!found) return state;
  const { applied, candidate } = state;
  const relaxed = unionRect(found, applied);
  if (!rectsEqual(relaxed, applied)) return { applied: relaxed, candidate: null };
  if (candidate && rectsAgree(candidate, found)) {
    return { applied: unionRect(candidate, found), candidate: null };
  }
  return { applied, candidate: found };
}

/** The larger of two rectangles on every edge — the smaller crop of the two. */
export function unionRect(a: ContentRect, b: ContentRect): ContentRect {
  return {
    x0: Math.min(a.x0, b.x0),
    y0: Math.min(a.y0, b.y0),
    x1: Math.max(a.x1, b.x1),
    y1: Math.max(a.y1, b.y1),
  };
}

export function rectsEqual(a: ContentRect, b: ContentRect): boolean {
  return (
    Math.abs(a.x0 - b.x0) <= RECT_EPSILON &&
    Math.abs(a.y0 - b.y0) <= RECT_EPSILON &&
    Math.abs(a.x1 - b.x1) <= RECT_EPSILON &&
    Math.abs(a.y1 - b.y1) <= RECT_EPSILON
  );
}
