import type { BunPlugin } from 'bun';
import { describe, expect, test } from 'bun:test';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * FEAT-20260925-718 L3 — what a host's bundler gets from
 * `luna-player/player`: built the way one would build it (browser target,
 * minified, every peer external), it builds, it carries no hls.js, and it
 * stays inside its budget.
 *
 * hls.js is deliberately *not* external here. If anything under the entry
 * reached it, the bundler would inline it, and its own internals would show
 * up in the output — which is how a host without the optional peer would
 * fail its build (Next.js resolves a dynamic `import('hls.js')` at build
 * time too).
 *
 * The budget is the first measurement (65,557 bytes, Bun 1.4.0) plus 10 %,
 * recorded in the README; raise it there and here together, on purpose.
 */
const BUDGET_BYTES = 72_100;

const ROOT = join(import.meta.dir, '..', '..');
const manifest = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')) as {
  peerDependencies: Record<string, string>;
  peerDependenciesMeta: Record<string, { optional?: boolean }>;
};
// Every required peer is the host's; the optional one (hls.js) is not.
const EXTERNAL = Object.keys(manifest.peerDependencies)
  .filter((name) => !manifest.peerDependenciesMeta[name]?.optional)
  .flatMap((name) => [name, `${name}/*`])
  .concat(['@radix-ui/*']);

/** Strings only hls.js's own source holds, none of them the player's. */
const HLS_INTERNALS = ['BufferController', 'TransmuxerInterface'];
/** An import of it left in the output, had it been made external after all. */
const HLS_IMPORT = /["']hls\.js(?:\/[^"']*)?["']/;

/**
 * Built straight from `src/`, Bun's bundler gives a bare `export {…}` with
 * nothing behind it, for two reasons of its own: a `'use client'` module is
 * a server-components client reference to it, and `"sideEffects": ["*.css"]`
 * in this package's manifest drops the modules behind a barrel. A host's
 * client build (Next.js, Vite) includes those modules whole. So the sources
 * are loaded here through a namespace of their own, where neither applies,
 * with the directive taken off: what is measured is that client build.
 */
const ENTRY = join(import.meta.dir, 'index.ts');
const SOURCE_EXTENSIONS = ['.ts', '.tsx', '/index.ts', '/index.tsx'];
const clientBuild: BunPlugin = {
  name: 'client-build',
  setup(build) {
    build.onResolve({ filter: /^\.\.?\//, namespace: 'client' }, ({ path, importer }) => {
      const base = join(importer, '..', path);
      for (const ext of SOURCE_EXTENSIONS) {
        if (existsSync(`${base}${ext}`)) return { path: `${base}${ext}`, namespace: 'client' };
      }
      // A stylesheet: the bundler's own, emitted as an asset of its own.
      return { path: base };
    });
    build.onLoad({ filter: /.*/, namespace: 'client' }, async ({ path }) => ({
      contents: (await Bun.file(path).text()).replace(/^(['"])use client\1;?/, ''),
      loader: path.endsWith('.tsx') ? 'tsx' : 'ts',
    }));
    build.onResolve({ filter: /^client:/ }, ({ path }) => ({
      path: path.slice('client:'.length),
      namespace: 'client',
    }));
  },
};

const result = await Bun.build({
  entrypoints: [`client:${ENTRY}`],
  root: import.meta.dir,
  target: 'browser',
  minify: true,
  external: EXTERNAL,
  plugins: [clientBuild],
});
// The stylesheets come out as their own asset; the budget is the script.
const code = (
  await Promise.all(
    result.outputs.filter((o) => o.path.endsWith('.js')).map((o) => o.text()),
  )
).join('\n');

describe('the luna-player/player bundle', () => {
  test('builds', () => {
    expect(result.logs.filter((log) => log.level === 'error')).toEqual([]);
    expect(result.success).toBe(true);
  });

  test('carries none of the optional HLS engine', () => {
    expect(HLS_INTERNALS.filter((needle) => code.includes(needle))).toEqual([]);
    expect(code).not.toMatch(HLS_IMPORT);
  });

  test('is the whole player, not a client-reference stub', () => {
    expect(code).toContain('aspectRatio');
    expect(code).toContain('control-bar-shell');
  });

  test(`stays under ${BUDGET_BYTES} bytes minified`, () => {
    const bytes = new TextEncoder().encode(code).length;
    console.log(`luna-player/player: ${bytes} bytes minified`);
    expect(bytes).toBeLessThan(BUDGET_BYTES);
  });
});
