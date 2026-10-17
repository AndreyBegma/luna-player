import { afterAll, describe, expect, test } from 'bun:test';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const script = new URL('./should-tag.sh', import.meta.url).pathname;
const dir = mkdtempSync(join(tmpdir(), 'should-tag-'));
afterAll(() => rmSync(dir, { recursive: true, force: true }));

function shouldTag(decision: string | null, tagExists: string) {
  const file = join(dir, 'decision');
  if (decision !== null) writeFileSync(file, decision);
  const path = decision === null ? join(dir, 'missing') : file;
  const run = spawnSync('sh', [script, path, tagExists], { encoding: 'utf8' });
  return { status: run.status, out: run.stdout.trim() };
}

describe('release should-tag.sh', () => {
  test('published now: tag, even though the registry may not show it yet', () => {
    expect(shouldTag('publish=yes\nversion=0.28.0\n', 'no')).toEqual({
      status: 0,
      out: 'tag=yes',
    });
  });

  test('already published, no tag yet: tag (idempotent re-run)', () => {
    expect(shouldTag('publish=no\nversion=0.28.0\n', 'no').out).toBe('tag=yes');
  });

  test('no version bump: the version is published and tagged, no tag', () => {
    expect(shouldTag('publish=no\nversion=0.28.0\n', 'yes').out).toBe('tag=no');
  });

  test('no decision recorded (publish step skipped): no tag', () => {
    expect(shouldTag(null, 'no')).toEqual({ status: 0, out: 'tag=no' });
  });

  test('a decision without a version is an error', () => {
    expect(shouldTag('publish=yes\n', 'no').status).toBe(2);
  });
});
