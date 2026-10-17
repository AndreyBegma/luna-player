import { describe, expect, test } from 'bun:test';
import { spawnSync } from 'node:child_process';

const script = new URL('./decide.sh', import.meta.url).pathname;

function decide(
  version: string,
  published: string,
  latest: string,
  branch: string,
) {
  const run = spawnSync('sh', [script, version, published, latest, branch], {
    encoding: 'utf8',
  });
  const out: Record<string, string> = {};
  for (const line of run.stdout.split('\n')) {
    const [key, ...rest] = line.split('=');
    if (key) out[key] = rest.join('=');
  }
  return { status: run.status, out };
}

describe('release decide.sh', () => {
  test('a version bump on main publishes as latest and tags it', () => {
    const { out } = decide('0.25.0', 'no', '0.24.0', 'main');
    expect(out).toEqual({
      publish: 'yes',
      npm_tag: 'latest',
      git_tag: 'v0.25.0',
    });
  });

  test('main without a version bump publishes nothing', () => {
    const { status, out } = decide('0.24.0', 'yes', '0.24.0', 'main');
    expect(status).toBe(0);
    expect(out.publish).toBe('no');
  });

  test('maint/v0.8 never publishes as latest', () => {
    const { out } = decide('0.8.14', 'no', '0.24.0', 'maint/v0.8');
    expect(out).toEqual({
      publish: 'yes',
      npm_tag: 'v0.8',
      git_tag: 'v0.8.14',
    });
  });

  test('a tag push (no branch) below latest is a maint line', () => {
    const { out } = decide('0.8.14', 'no', '0.24.0', '');
    expect(out.npm_tag).toBe('v0.8');
  });

  test('versions compare numerically, not as strings', () => {
    expect(decide('0.9.0', 'no', '0.24.0', '').out.npm_tag).toBe('v0.9');
    expect(decide('0.100.0', 'no', '0.24.0', '').out.npm_tag).toBe('latest');
  });

  test('a tag push of the latest version is idempotent', () => {
    const { out } = decide('0.24.0', 'yes', '0.24.0', '');
    expect(out.publish).toBe('no');
    expect(out.npm_tag).toBe('latest');
  });

  test('first publish with no latest on the registry is latest', () => {
    expect(decide('0.1.0', 'no', '', 'main').out.npm_tag).toBe('latest');
  });

  test('rejects a malformed version', () => {
    expect(decide('main', 'no', '0.24.0', 'main').status).toBe(2);
  });
});
