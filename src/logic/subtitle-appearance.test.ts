import { describe, expect, mock, test } from 'bun:test';
import {
  applyCuePosition,
  canLiftCueContainer,
  createSubtitleAppearanceStore,
  cuePlacement,
  defaultAppearance,
  nextOf,
  parseAppearance,
  SUBTITLE_BACKGROUNDS,
  SUBTITLE_POSITIONS,
  SUBTITLE_SIZES,
} from './subtitle-appearance';

const DESK = defaultAppearance(false);

describe('defaultAppearance', () => {
  test('a television starts at the largest size', () => {
    expect(defaultAppearance(true)).toEqual({
      size: 'xl',
      background: 'shadow',
      position: 'bottom',
    });
  });

  test("everything else starts at today's look", () => {
    expect(DESK).toEqual({ size: 'm', background: 'shadow', position: 'bottom' });
  });
});

describe('parseAppearance', () => {
  test('nothing stored is the default', () => {
    expect(parseAppearance(null, DESK)).toBe(DESK);
  });

  test('a stored appearance wins over the default', () => {
    expect(
      parseAppearance(
        '{"size":"s","background":"box","position":"raised"}',
        DESK,
      ),
    ).toEqual({
      size: 's',
      background: 'box',
      position: 'raised',
    });
  });

  test('an unknown value falls back for that field alone', () => {
    expect(
      parseAppearance(
        '{"size":"xxl","background":"none","position":"floating"}',
        DESK,
      ),
    ).toEqual({
      size: 'm',
      background: 'none',
      position: 'bottom',
    });
  });

  test('an appearance stored before position existed defaults it', () => {
    expect(parseAppearance('{"size":"l","background":"box"}', DESK)).toEqual({
      size: 'l',
      background: 'box',
      position: 'bottom',
    });
  });

  test('garbage is the default', () => {
    expect(parseAppearance('not json', DESK)).toBe(DESK);
    expect(parseAppearance('7', DESK)).toBe(DESK);
    expect(parseAppearance('null', DESK)).toBe(DESK);
  });
});

describe('nextOf', () => {
  test('steps through the sizes and wraps', () => {
    expect(nextOf(SUBTITLE_SIZES, 'm')).toBe('l');
    expect(nextOf(SUBTITLE_SIZES, 'xl')).toBe('s');
  });

  test('steps through the backgrounds and wraps', () => {
    expect(nextOf(SUBTITLE_BACKGROUNDS, 'shadow')).toBe('box');
    expect(nextOf(SUBTITLE_BACKGROUNDS, 'box')).toBe('none');
  });

  test('steps through the positions and wraps', () => {
    expect(nextOf(SUBTITLE_POSITIONS, 'bottom')).toBe('raised');
    expect(nextOf(SUBTITLE_POSITIONS, 'raised')).toBe('bottom');
  });
});

describe('applyCuePosition', () => {
  function cue(line: number | 'auto' = 'auto') {
    return { line, snapToLines: true };
  }

  test('raised sets a negative line and remembers the original', () => {
    const cues = [cue(), cue(3)];
    applyCuePosition(cues, 'raised');
    expect(cues[0]?.line).toBeLessThan(0);
    expect(cues[1]?.line).toBeLessThan(0);
  });

  test('bottom restores a cue this module raised', () => {
    const cues = [cue('auto'), cue(3)];
    applyCuePosition(cues, 'raised');
    applyCuePosition(cues, 'bottom');
    expect(cues[0]?.line).toBe('auto');
    expect(cues[1]?.line).toBe(3);
  });

  test('bottom restores a percentage line as a percentage, not as a line count', () => {
    // A sidecar's `line:10%` — a sign at the top of the frame.
    const sign = { line: 10 as number | 'auto', snapToLines: false };
    applyCuePosition([sign], 'raised');
    expect(sign.snapToLines).toBe(true);
    applyCuePosition([sign], 'bottom');
    expect(sign).toEqual({ line: 10, snapToLines: false });
  });

  test('raising twice still restores what the cue had before the first', () => {
    const cues = [cue(3)];
    applyCuePosition(cues, 'raised');
    applyCuePosition(cues, 'raised');
    applyCuePosition(cues, 'bottom');
    expect(cues[0]).toEqual({ line: 3, snapToLines: true });
  });

  test("bottom leaves a cue's own line alone when this module never raised it", () => {
    const cues = [cue(5)];
    applyCuePosition(cues, 'bottom');
    expect(cues[0]?.line).toBe(5);
  });
});

describe('createSubtitleAppearanceStore', () => {
  test('reads storage once, lazily, and keeps the same object', () => {
    const read = mock(
      () => '{"size":"l","background":"box","position":"raised"}',
    );
    const store = createSubtitleAppearanceStore({
      read,
      write: () => {},
      television: () => false,
    });
    expect(read).not.toHaveBeenCalled();
    const first = store.get();
    expect(first).toEqual({ size: 'l', background: 'box', position: 'raised' });
    expect(store.get()).toBe(first);
    expect(read).toHaveBeenCalledTimes(1);
  });

  test('the device decides the default when nothing is stored', () => {
    const store = createSubtitleAppearanceStore({
      read: () => null,
      write: () => {},
      television: () => true,
    });
    expect(store.get().size).toBe('xl');
  });

  test('set writes through and tells every listener', () => {
    const write = mock((_: string) => {});
    const store = createSubtitleAppearanceStore({
      read: () => null,
      write,
      television: () => false,
    });
    const listener = mock(() => {});
    const unsubscribe = store.subscribe(listener);
    store.set({ size: 'xl', background: 'none', position: 'raised' });
    expect(store.get()).toEqual({
      size: 'xl',
      background: 'none',
      position: 'raised',
    });
    expect(write).toHaveBeenCalledWith(
      '{"size":"xl","background":"none","position":"raised"}',
    );
    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
    store.set({ size: 's', background: 'none', position: 'bottom' });
    expect(listener).toHaveBeenCalledTimes(1);
  });
});

describe('cuePlacement (BUG-20260924-687)', () => {
  test('raised is carried by the container where it can be lifted, and the lines stay put', () => {
    expect(cuePlacement('raised', true)).toEqual({
      container: 'raised',
      lines: 'bottom',
    });
  });

  test('raised falls back to the lines where the container cannot be lifted', () => {
    expect(cuePlacement('raised', false)).toEqual({
      container: 'bottom',
      lines: 'raised',
    });
  });

  test('never both, and bottom is neither', () => {
    for (const position of SUBTITLE_POSITIONS) {
      for (const liftable of [true, false]) {
        const { container, lines } = cuePlacement(position, liftable);
        expect(container === 'raised' && lines === 'raised').toBe(false);
        expect(container === 'raised' || lines === 'raised').toBe(
          position === 'raised',
        );
      }
    }
  });
});

describe('canLiftCueContainer', () => {
  const real = globalThis.CSS;
  /**
   * FEAT-20260925-718 L1 — `bun test src` preloads happy-dom once for the
   * whole run (`test-setup.ts`) instead of per file, so by the time this
   * describe block runs, `globalThis.CSS` is happy-dom's own accessor
   * (getter, no setter) rather than a plain, freely assignable property.
   * `Object.defineProperty` replaces it instead of `=`; the property stays
   * `configurable`, so this and the restore below both still work.
   */
  function setCss(value: unknown) {
    Object.defineProperty(globalThis, 'CSS', {
      value,
      configurable: true,
      writable: true,
    });
  }
  function engine(supports: ((condition: string) => boolean) | undefined) {
    setCss(supports === undefined ? undefined : { supports });
  }

  test('asks the engine about the cue container, and trusts its answer', () => {
    const asked: string[] = [];
    engine((condition) => {
      asked.push(condition);
      return true;
    });
    expect(canLiftCueContainer()).toBe(true);
    expect(asked).toEqual([
      'selector(video::-webkit-media-text-track-container)',
    ]);
    engine(() => false);
    expect(canLiftCueContainer()).toBe(false);
    setCss(real);
  });

  test('an engine without CSS.supports gets the line fallback', () => {
    engine(undefined);
    expect(canLiftCueContainer()).toBe(false);
    setCss(real);
  });
});
