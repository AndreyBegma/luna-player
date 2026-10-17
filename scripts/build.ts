/**
 * Builds the published package into `dist/`.
 *
 * `tsc -p tsconfig.build.json` emits one `.js` and one `.d.ts` per source
 * module — no bundling, so deep imports and tree-shaking keep working, and a
 * `'use client'` prologue stays the first statement of the file it was in.
 *
 * The source imports its siblings without an extension
 * (`'../platform/media-query'`, `'./labels'`), which a bundler resolves and
 * Node's ESM loader does not. tsc leaves those specifiers alone, so every
 * relative specifier in the output is rewritten here to the file it actually
 * names (`'../platform/media-query.js'`, `'./labels/index.js'`). A specifier
 * that names no emitted file fails the build rather than shipping a module
 * that cannot be imported.
 *
 * Stylesheets are copied as they are, before the rewrite, because components
 * import their own (`import './player.css'`, once the player lands) and the
 * rewrite checks that those exist too.
 */
import { spawnSync } from 'node:child_process';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, relative } from 'node:path';

const ROOT = join(import.meta.dir, '..');
const SRC = join(ROOT, 'src');
const DIST = join(ROOT, 'dist');

/** Every file under `dir`, recursively, as absolute paths. */
function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

/**
 * `from '…'`, `import '…'` and `import('…')` with a relative specifier — the
 * three shapes tsc emits into `.js` and `.d.ts`.
 */
const RELATIVE_SPECIFIER =
  /(\bfrom\s*|\bimport\s*\(\s*|\bimport\s+)(['"])(\.\.?\/[^'"]*)\2/g;

function resolveSpecifier(file: string, specifier: string): string {
  const base = join(dirname(file), specifier);
  if (/\.(js|css)$/.test(specifier) && existsSync(base)) return specifier;
  if (existsSync(`${base}.js`)) return `${specifier}.js`;
  if (existsSync(join(base, 'index.js'))) {
    return `${specifier.replace(/\/$/, '')}/index.js`;
  }
  throw new Error(
    `${relative(ROOT, file)}: '${specifier}' names no file in dist/`,
  );
}

rmSync(DIST, { recursive: true, force: true });

const tsc = spawnSync('tsc', ['-p', join(ROOT, 'tsconfig.build.json')], {
  cwd: ROOT,
  stdio: 'inherit',
});
if (tsc.status !== 0) process.exit(tsc.status ?? 1);

for (const file of walk(SRC).filter((path) => path.endsWith('.css'))) {
  const target = join(DIST, relative(SRC, file));
  mkdirSync(dirname(target), { recursive: true });
  copyFileSync(file, target);
}

let rewritten = 0;
for (const file of walk(DIST).filter((path) => /\.(js|d\.ts)$/.test(path))) {
  const source = readFileSync(file, 'utf8');
  const output = source.replace(
    RELATIVE_SPECIFIER,
    (_match, keyword: string, quote: string, specifier: string) =>
      `${keyword}${quote}${resolveSpecifier(file, specifier)}${quote}`,
  );
  if (output !== source) {
    writeFileSync(file, output);
    rewritten += 1;
  }
}

console.log(`dist/ built; relative specifiers rewritten in ${rewritten} files`);
