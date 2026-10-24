/**
 * FEAT-20260925-718 L2 — what a lifted file changed against its luna-watch
 * original, with the import rewrites the lift is allowed to make taken out.
 *
 *   bun scripts/lift-diff.ts <luna-watch checkout> <sha> [file…]
 *
 * Each lifted file is read from luna-watch at `<sha>` (`git show`, so the
 * checkout's working tree does not matter) and from `src/` here. Both sides
 * have every import specifier normalised to the module it names — a sibling
 * (`./resume-seek`), an app-absolute core path
 * (`@/components/player/core/quality-menu`), a package subpath
 * (`luna-player/saved-volume`) and its relative replacement
 * (`../logic/saved-volume`) all become the bare module name — so the only
 * hunks left are the seams the issue names. An empty diff prints `=`.
 *
 * Exits non-zero when a file is missing on either side, never because a diff
 * is non-empty: a seam is a reviewed hunk, not a failure.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';

const ROOT = join(import.meta.dir, '..');
const CORE = 'apps/web/src/components/player/core';

/** luna-watch path (from the repository root) → path here (from `src/`). */
const LIFTED: Record<string, string> = {
  'apps/web/src/test/stub-global.ts': 'test-stub-global.ts',
};
for (const file of [
  'playhead-store.ts',
  'source-refs.ts',
  'source-url.ts',
  'resume-seek.ts',
  'resume-seek.test.ts',
  'dropping-video.ts',
  'tracks/types.ts',
  'storage/player-storage.ts',
  'use-hls-engine.ts',
  'use-hls-engine.test.tsx',
  'use-source-controller.ts',
  'use-source-controller.test.tsx',
  'use-element-timeline.ts',
  'use-element-timeline.test.tsx',
  'use-volume.ts',
  'use-volume.test.tsx',
  'use-playback-rate.ts',
  'use-playback-rate.test.tsx',
  'use-fullscreen.ts',
  'use-fullscreen-element.ts',
  'rotation-fullscreen.ts',
  'rotation-fullscreen.test.ts',
  'use-controls-visibility.ts',
  'use-controls-visibility.test.tsx',
  'use-frame-gestures.ts',
  'use-frame-gestures.test.tsx',
  'use-frame-tap.ts',
  'use-frame-tap.test.tsx',
  'use-long-press.ts',
  'use-long-press.test.tsx',
  'picture-feedback.tsx',
  'use-hold-seek.ts',
  'use-hold-seek.test.tsx',
  'use-key-feedback.ts',
  'use-player-keys.ts',
  'use-player-keys.test.tsx',
  'use-back-capture.ts',
  'use-platform-media-keys.ts',
  'transport-focus.ts',
  'transport-focus.test.ts',
  'use-hover-time.ts',
  'use-play-pause-confirm.ts',
  'use-play-pause-confirm.test.tsx',
  'use-player-frame.ts',
  'use-bar-clearance.ts',
  'use-bar-clearance.test.tsx',
  // FEAT-20260925-718 L3 — the components under the first `<Player>`.
  'video-element.tsx',
  'video-element.test.tsx',
  'use-subtitle-appearance.ts',
  'launch-veil.tsx',
  'launch-veil.test.tsx',
  'player-frame.tsx',
  'player-frame.test.tsx',
  'seek-bar.tsx',
  'seek-bar.test.tsx',
  'volume-control.tsx',
  'volume-control.test.tsx',
  'speed-button.tsx',
  'playhead-clock.tsx',
  'bar-tooltip.tsx',
  'bar-tooltip.test.tsx',
  'centre-transport.tsx',
  'centre-transport.test.tsx',
  'play-pause-confirm.tsx',
  'playback-error-notice.tsx',
  'playback-error-notice.test.tsx',
  'player.css',
  'player-motion.css',
  'player-cues.css',
  // Reduced copies: their diffs are the removed blocks the PR explains.
  'control-bar.tsx',
  'control-bar.test.tsx',
]) {
  LIFTED[`${CORE}/${file}`] = `player/${file}`;
}

/** The test helpers luna-watch imports by alias, and the shims they map to. */
const ALIASES: Record<string, string> = {
  '@/test/dom': 'test-dom-shim',
  '@/test/stub-global': 'test-stub-global',
};

const SPECIFIER = /(\bfrom\s*|\bimport\s*\(\s*|\bimport\s+)(['"])([^'"]+)\2/g;

/**
 * The module a specifier names, from the core folder's point of view:
 * `./tracks/types` stays `tracks/types` (it is not `./types`), while
 * `luna-player/saved-volume` and `../logic/saved-volume` both become
 * `saved-volume`.
 */
function normaliseSpecifier(specifier: string): string {
  if (ALIASES[specifier]) return ALIASES[specifier];
  if (specifier.startsWith('glass-ui/')) return `@andrewbehma/${specifier}`;
  if (specifier.startsWith('luna-player/')) return basename(specifier);
  if (specifier.startsWith('@/components/player/core/')) {
    return specifier.slice('@/components/player/core/'.length);
  }
  if (specifier.startsWith('.')) {
    return specifier.replace(/^(?:\.\.?\/)+/, '').replace(/^(?:logic|platform)\//, '');
  }
  return specifier;
}

function normalise(source: string): string {
  return source.replace(
    SPECIFIER,
    (_match, keyword: string, quote: string, specifier: string) =>
      `${keyword}${quote}${normaliseSpecifier(specifier)}${quote}`,
  );
}

const [checkout, sha, ...only] = process.argv.slice(2);
if (!checkout || !sha) {
  console.error('usage: bun scripts/lift-diff.ts <luna-watch checkout> <sha> [file…]');
  process.exit(2);
}

const scratch = mkdtempSync(join(tmpdir(), 'lift-diff-'));
let missing = 0;
let changed = 0;
const entries = Object.entries(LIFTED).filter(
  ([from, to]) => only.length === 0 || only.some((f) => from.endsWith(f) || to.endsWith(f)),
);

console.log(`luna-watch ${sha}`);
for (const [from, to] of entries) {
  const original = spawnSync('git', ['-C', checkout, 'show', `${sha}:${from}`], {
    encoding: 'utf8',
  });
  const here = join(ROOT, 'src', to);
  if (original.status !== 0 || !existsSync(here)) {
    console.log(`\n### src/${to}: MISSING (${original.status !== 0 ? 'luna-watch' : 'here'})`);
    missing += 1;
    continue;
  }
  const a = join(scratch, 'a');
  const b = join(scratch, 'b');
  writeFileSync(a, normalise(original.stdout));
  writeFileSync(b, normalise(readFileSync(here, 'utf8')));
  const diff = spawnSync(
    'git',
    ['diff', '--no-index', '--no-color', '-U2', `--src-prefix=luna-watch/`, `--dst-prefix=luna-player/`, a, b],
    { encoding: 'utf8' },
  );
  const body = diff.stdout.split('\n').slice(4).join('\n').trimEnd();
  if (body === '') {
    console.log(`= src/${to}`);
    continue;
  }
  changed += 1;
  console.log(`\n### src/${to}  (from ${from})\n${body}`);
}
rmSync(scratch, { recursive: true, force: true });

console.log(
  `\n${entries.length} files: ${entries.length - changed - missing} identical after import normalisation, ${changed} with seams, ${missing} missing`,
);
if (missing > 0) process.exit(1);
