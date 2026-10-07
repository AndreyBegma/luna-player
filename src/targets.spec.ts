import { describe, expect, test } from 'bun:test';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { extname, join, relative } from 'node:path';

/**
 * FEAT-20260925-718 — the television is Chromium 94 (S90F firmware ~108), and
 * Luna has no `browserslist`: nothing down-levels syntax for it, so the
 * package has to avoid post-94 syntax and APIs at the source, the way
 * glass-ui's `tokens.spec.ts` bans raw colour at the source instead of relying
 * on review (§4.6). A consumer's build tooling does not save the television;
 * only not writing the API does.
 *
 * Each entry here is something the plan names as unsupported on Chromium 94:
 * - `Array.prototype.findLast` / `findLastIndex` — ES2023.
 * - `color-mix()` — Chromium 111.
 * - `@starting-style` — Chromium 117, and only load-bearing here as a
 *   visibility dependency (an element that only becomes visible through it).
 * - `document.startViewTransition` — Chromium 111.
 * - `scroll-timeline` (and `animation-timeline`, its shorthand partner) —
 *   Chromium 115, part of the same scroll-driven-animations feature.
 */

const SRC = new URL('.', import.meta.url).pathname;

const BANNED: { name: string; pattern: RegExp }[] = [
  { name: 'Array#findLast / findLastIndex (ES2023)', pattern: /\bfindLast(?:Index)?\b/ },
  { name: 'color-mix()', pattern: /color-mix\(/ },
  { name: '@starting-style', pattern: /@starting-style/ },
  { name: 'startViewTransition', pattern: /startViewTransition/ },
  { name: 'scroll-timeline / animation-timeline', pattern: /\b(?:scroll|animation)-timeline\b/ },
];

/** A rule quoted in prose is not a rule anybody's build fails on. */
function stripComments(source: string, ext: string): string {
  const withoutBlockComments = source.replace(/\/\*[\s\S]*?\*\//g, ' ');
  if (ext === '.css') return withoutBlockComments;
  return withoutBlockComments.replace(/(^|[^:])\/\/.*$/gm, '$1 ');
}

const SCANNED_EXTENSIONS = new Set(['.ts', '.tsx', '.css']);

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return sourceFiles(full);
    const ext = extname(full);
    if (!SCANNED_EXTENSIONS.has(ext)) return [];
    if (full.endsWith('.spec.ts') || full.endsWith('.test.ts') || full.endsWith('.test.tsx')) {
      return [];
    }
    return [full];
  });
}

const files = sourceFiles(SRC).map((f) => ({
  name: relative(SRC, f),
  body: stripComments(readFileSync(f, 'utf8'), extname(f)),
}));

describe('the browser targets hold', () => {
  test('there are source files to check at all', () => {
    expect(files.length).toBeGreaterThan(0);
  });

  for (const { name, pattern } of BANNED) {
    test(`no source file uses ${name}`, () => {
      const offenders = files.filter((f) => pattern.test(f.body)).map((f) => f.name);
      expect(offenders).toEqual([]);
    });
  }
});
