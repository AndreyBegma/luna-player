/**
 * Smoke test of the published tarball. Run after `bun run build`:
 * `bun run smoke`, locally and in CI.
 *
 * 1. `npm pack`, and unpack the tarball as
 *    `.smoke/node_modules/luna-player` — so it is the package a
 *    consumer gets, not the working tree, and its peers still resolve from the
 *    repository's own `node_modules` by walking up.
 * 2. The tarball holds only `package.json`, `README.md`, `LICENSE` and
 *    `dist/`, and every `exports` target is in it.
 * 3. Every source module whose first statement is `'use client'` has it as the
 *    first statement of its built file, and no other built file gains one.
 * 4. Every JS subpath is imported by its package name under Node with
 *    `--conditions=import` (`smoke-import.mjs`), which exercises the exports
 *    map and every relative specifier the build rewrote. A resolution error
 *    fails the run. A subpath whose built file is a bare `export {};` — a
 *    types-only module such as `platform-types`, or the root barrel, which is
 *    empty on purpose — only has to import; every other one has to export
 *    something.
 * 5. A Tailwind 4 host (`fixtures/tailwind-consumer/`) imports
 *    `luna-player/player.css` from its entry stylesheet and is compiled
 *    against the unpacked tarball, the way `@tailwindcss/cli` compiles one:
 *    the player's `@source "."` has to bring a class used only in the built
 *    `dist/player/control-bar.js` into the host's CSS, and the same host
 *    without the import must not have it. The host turns its own detection
 *    off (`source(none)`), so the player's `@source` is the only way in.
 */
import { execFileSync, spawnSync } from 'node:child_process';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { compile } from '@tailwindcss/node';
import { Scanner } from '@tailwindcss/oxide';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(ROOT, 'src');
const SMOKE = join(ROOT, '.smoke');

const failures = [];
const fail = (message) => failures.push(message);

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

/**
 * A `'use client'` (or `"use client"`) directive as the first statement —
 * comments may precede it, and it is still one.
 */
const hasUseClient = (code) =>
  /^(?:\s|\/\/[^\n]*\n|\/\*[\s\S]*?\*\/)*(['"])use client\1/.test(code);

if (!existsSync(join(ROOT, 'dist'))) {
  console.error('dist/ is missing: run `bun run build` first');
  process.exit(1);
}

// 1. Pack and unpack.
rmSync(SMOKE, { recursive: true, force: true });
mkdirSync(SMOKE, { recursive: true });
const [{ filename }] = JSON.parse(
  execFileSync('npm', ['pack', '--json', '--pack-destination', SMOKE], {
    cwd: ROOT,
    encoding: 'utf8',
  }),
);
const modules = join(SMOKE, 'node_modules');
mkdirSync(modules, { recursive: true });
execFileSync('tar', ['-xzf', join(SMOKE, filename), '-C', modules]);
const PKG = join(modules, 'luna-player');
renameSync(join(modules, 'package'), PKG);
// Without a package.json of its own, `.smoke/` would sit in the repository's
// package scope, and `luna-player` would self-reference the working
// tree's `dist/` instead of resolving to the unpacked tarball.
writeFileSync(
  join(SMOKE, 'package.json'),
  JSON.stringify({ private: true, type: 'module' }),
);

// 2. Tarball contents and exports targets.
const manifest = JSON.parse(readFileSync(join(PKG, 'package.json'), 'utf8'));
for (const file of walk(PKG)) {
  const path = relative(PKG, file);
  if (!/^(package\.json|README\.md|LICENSE|dist\/.+)$/.test(path)) {
    fail(`tarball ships ${path}, outside dist/, README.md and LICENSE`);
  }
}
/** What tsc emits for a module that exports only types. */
const isTypeOnly = (code) =>
  /^\s*export\s*\{\s*\};?\s*$/.test(
    code.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, ''),
  );

const jsSubpaths = [];
const typeOnlySubpaths = [];
for (const [subpath, target] of Object.entries(manifest.exports)) {
  const targets = typeof target === 'string' ? [target] : Object.values(target);
  if (typeof target !== 'string') {
    const conditions = Object.keys(target).join(',');
    if (conditions !== 'types,import') {
      fail(`exports['${subpath}'] has conditions ${conditions}`);
    }
  }
  for (const path of targets) {
    if (!existsSync(join(PKG, path))) {
      fail(`exports['${subpath}'] → ${path} is not in the tarball`);
    }
  }
  if (typeof target !== 'string') {
    const built = join(PKG, target.import);
    if (existsSync(built) && isTypeOnly(readFileSync(built, 'utf8'))) {
      typeOnlySubpaths.push(subpath);
    } else {
      jsSubpaths.push(subpath);
    }
  }
}

// 3. 'use client' survives the build, file by file.
const sources = walk(SRC).filter(
  (path) =>
    /\.tsx?$/.test(path) &&
    !/\.(spec|test)\.tsx?$/.test(path) &&
    !path.endsWith('.d.ts') &&
    path !== join(SRC, 'test-setup.ts') &&
    path !== join(SRC, 'test-dom-shim.ts') &&
    path !== join(SRC, 'test-stub-global.ts') &&
    path !== join(SRC, 'player', 'dropping-video.ts') &&
    path !== join(SRC, 'player', 'labels', 'test-labels.ts'),
);
let clientModules = 0;
for (const source of sources) {
  const built = join(
    PKG,
    'dist',
    relative(SRC, source).replace(/\.tsx?$/, '.js'),
  );
  if (!existsSync(built)) {
    fail(`${relative(ROOT, source)} has no built file in the tarball`);
    continue;
  }
  const expected = hasUseClient(readFileSync(source, 'utf8'));
  const actual = hasUseClient(readFileSync(built, 'utf8'));
  if (expected) clientModules += 1;
  if (expected !== actual) {
    fail(
      `${relative(PKG, built)}: 'use client' is ${actual ? 'present' : 'missing'}, the source ${expected ? 'has' : 'lacks'} it`,
    );
  }
}

// 4. Import every JS subpath by package name, from inside `.smoke/`.
const runner = join(SMOKE, 'smoke-import.mjs');
copyFileSync(join(ROOT, 'scripts', 'smoke-import.mjs'), runner);
const imported = spawnSync(
  process.execPath,
  ['--conditions=import', runner, ...jsSubpaths, '--', ...typeOnlySubpaths],
  { cwd: SMOKE, encoding: 'utf8' },
);
process.stdout.write(imported.stdout);
process.stderr.write(imported.stderr);
if (imported.status !== 0) fail('importing the JS entries failed (above)');

// 5. The player's classes reach a Tailwind host through `@source`.
/** What `@tailwindcss/cli` does with one entry stylesheet, minus the file. */
async function tailwind(entry) {
  const css = readFileSync(entry, 'utf8');
  const compiler = await compile(css, { base: SMOKE, onDependency: () => {} });
  const sources = [
    ...(compiler.root === 'none'
      ? []
      : compiler.root === null
        ? [{ base: SMOKE, pattern: '**/*', negated: false }]
        : [{ ...compiler.root, negated: false }]),
    ...compiler.sources,
  ];
  return { css: compiler.build(new Scanner({ sources }).scan()), sources };
}

/** A class only `control-bar.tsx` uses: the bar's safe-area inset. */
const PLAYER_ONLY = 'safe-area-inset-left';
const builtBar = readFileSync(join(PKG, 'dist', 'player', 'control-bar.js'), 'utf8');
if (!builtBar.includes(PLAYER_ONLY)) {
  fail(`dist/player/control-bar.js no longer uses ${PLAYER_ONLY}; pick another marker`);
}
const FIXTURE = join(ROOT, 'scripts', 'fixtures', 'tailwind-consumer');
for (const name of ['app.css', 'bare.css']) {
  copyFileSync(join(FIXTURE, name), join(SMOKE, name));
}
let tailwindChecked = false;
try {
  const { css: host, sources } = await tailwind(join(SMOKE, 'app.css'));
  const { css: bare } = await tailwind(join(SMOKE, 'bare.css'));
  const playerDist = join(PKG, 'dist', 'player');
  if (!sources.some((source) => source.base === playerDist)) {
    fail(
      `the host's Tailwind sources are ${JSON.stringify(sources)}; none is the tarball's dist/player/`,
    );
  }
  if (!host.includes(PLAYER_ONLY)) {
    fail(
      `a Tailwind host importing luna-player/player.css did not get the player's classes (${PLAYER_ONLY}): @source does not reach dist/player/`,
    );
  }
  if (bare.includes(PLAYER_ONLY)) {
    fail(`a Tailwind host without luna-player/player.css has ${PLAYER_ONLY} anyway; the check proves nothing`);
  }
  tailwindChecked = true;
} catch (error) {
  fail(`compiling the Tailwind consumer fixture failed: ${error?.message ?? error}`);
}

if (failures.length > 0) {
  console.error(`\nsmoke test failed (${failures.length}):`);
  for (const message of failures) console.error(`  - ${message}`);
  process.exit(1);
}
console.log(
  `smoke test passed: ${filename}, ${Object.keys(manifest.exports).length} exports, ${jsSubpaths.length + typeOnlySubpaths.length} JS entries imported (${typeOnlySubpaths.length} types-only), ${clientModules} 'use client' modules checked, ${tailwindChecked ? 'player classes reach a Tailwind host' : 'Tailwind host not checked'}`,
);
