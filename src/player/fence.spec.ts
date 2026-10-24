import { describe, expect, test } from 'bun:test';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, extname, join, relative, resolve } from 'node:path';

/**
 * FEAT-20260925-718 §7.1 — the player imports nothing outside the package but
 * its declared peers.
 *
 * The hooks here were lifted out of luna-watch, where `@/lib/…`,
 * `next-intl`, `watch-storage` and `../luna/…` were a keystroke away; one of
 * those slipping back in would build here (nothing resolves `@/`) only to
 * fail in a consumer. So every specifier under `src/player/` is either
 * relative and stays inside `src/`, or names a peer in `package.json` (or a
 * subpath of one). Tests may also import `bun:test`, `bun` (its types, for
 * `bundle.test.ts`) and `node:` builtins.
 *
 * hls.js is a peer, but an optional one, and the player reaches it only
 * through an injected `HlsLoader`: its name may not appear here at all
 * outside comments, so no emitted module or declaration can depend on it.
 *
 * FEAT-20260925-718 L3 — with one exception: `hls.ts`, the
 * `luna-player/hls` entry, is the default loader and the only module that
 * names it. Nothing under `luna-player/player` imports it
 * (`bundle.test.ts` builds that graph and finds no hls.js in it).
 */
const HLS_ENTRY = join(new URL('.', import.meta.url).pathname, 'hls.ts');

const PLAYER = new URL('.', import.meta.url).pathname;
const SRC = resolve(PLAYER, '..');
const ROOT = resolve(SRC, '..');

const manifest = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')) as {
  peerDependencies: Record<string, string>;
};
const PEERS = Object.keys(manifest.peerDependencies).filter((name) => name !== 'hls.js');

const BANNED: { name: string; pattern: RegExp }[] = [
  { name: 'an app alias (@/…)', pattern: /^@\// },
  { name: 'next / next-intl', pattern: /^next(?:-intl)?(?:\/|$)/ },
  { name: 'watch-storage', pattern: /watch-storage/ },
  { name: "luna-watch's ../luna/…", pattern: /(?:^|\/)luna\// },
];

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return sourceFiles(full);
    return ['.ts', '.tsx'].includes(extname(full)) ? [full] : [];
  });
}

/** Comments out, so a FEAT note quoting an old import is not an import. */
function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/.*$/gm, '$1 ');
}

const SPECIFIER = /(?:\bfrom\s*|\bimport\s*\(\s*|\bimport\s+)(['"])([^'"]+)\1/g;

const files = sourceFiles(PLAYER).map((path) => {
  const body = stripComments(readFileSync(path, 'utf8'));
  return {
    path,
    name: relative(SRC, path),
    body,
    specifiers: [...body.matchAll(SPECIFIER)].map((match) => match[2]),
    isTest: /\.(test|spec)\.tsx?$/.test(path),
  };
});

function isPeer(specifier: string): boolean {
  return PEERS.some((peer) => specifier === peer || specifier.startsWith(`${peer}/`));
}

describe('the player fence', () => {
  test('there are player files to check at all', () => {
    expect(files.length).toBeGreaterThan(0);
  });

  test('the player itself and its components are inside the fence', () => {
    const names = files.map((file) => file.name);
    for (const name of [
      'player/player.tsx',
      'player/player-layers.tsx',
      'player/control-bar.tsx',
      'player/video-element.tsx',
      'player/index.ts',
      'player/hls.ts',
    ]) {
      expect(names).toContain(name);
    }
  });

  test('nothing in the player imports the hls entry', () => {
    const importers = files
      .filter((file) => file.specifiers.some((s) => /(?:^|\/)hls(?:\.ts)?$/.test(s)))
      .map((file) => file.name);
    expect(importers).toEqual([]);
  });

  test('every import is relative inside src/, a declared peer, or bun:test in a test', () => {
    const offenders = files.flatMap((file) =>
      file.specifiers
        .filter((specifier) => {
          if (specifier.startsWith('.')) {
            const target = resolve(dirname(file.path), specifier);
            return relative(SRC, target).startsWith('..');
          }
          if (
            file.isTest &&
            (specifier === 'bun' || specifier === 'bun:test' || specifier.startsWith('node:'))
          )
            return false;
          if (file.path === HLS_ENTRY && specifier === 'hls.js') return false;
          return !isPeer(specifier);
        })
        .map((specifier) => `${file.name}: ${specifier}`),
    );
    expect(offenders).toEqual([]);
  });

  for (const { name, pattern } of BANNED) {
    test(`nothing imports ${name}`, () => {
      const offenders = files.flatMap((file) =>
        file.specifiers
          .filter((specifier) => pattern.test(specifier))
          .map((specifier) => `${file.name}: ${specifier}`),
      );
      expect(offenders).toEqual([]);
    });
  }

  // The module name as a string literal — a specifier in any form, static,
  // dynamic or `import type`. Prose naming the library (a test title) is not
  // one; this file is skipped because it has to spell the pattern out.
  test('no string literal names hls.js outside comments', () => {
    const literal = /(['"`])hls\.js(?:\/[^'"`]*)?\1/;
    const offenders = files
      .filter((file) => !file.path.endsWith('fence.spec.ts'))
      .filter((file) => file.path !== HLS_ENTRY)
      .filter((file) => literal.test(file.body))
      .map((file) => file.name);
    expect(offenders).toEqual([]);
  });
});
