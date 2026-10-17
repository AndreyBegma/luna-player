import { afterAll, describe, expect, test } from 'bun:test';
import { spawnSync } from 'node:child_process';
import {
  chmodSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const script = new URL('./publish.sh', import.meta.url).pathname;
const dir = mkdtempSync(join(tmpdir(), 'publish-'));
afterAll(() => rmSync(dir, { recursive: true, force: true }));

/** Runs publish.sh against a stub npm that prints `output` and exits `code`. */
function publish(output: string, code: number, tag = 'latest') {
  const stub = join(dir, 'npm');
  const args = join(dir, 'args');
  writeFileSync(
    stub,
    `#!/bin/sh\necho "$@" > '${args}'\nprintf '%s\\n' '${output}' >&2\nexit ${code}\n`,
  );
  chmodSync(stub, 0o755);
  const run = spawnSync('sh', [script, tag], {
    encoding: 'utf8',
    env: { ...process.env, NPM: stub },
  });
  return {
    status: run.status,
    out: run.stdout,
    args: readFileSync(args, 'utf8').trim(),
  };
}

describe('release publish.sh', () => {
  test('a publish that succeeds passes, with the dist-tag it was given', () => {
    const run = publish('+ luna-player@0.1.2', 0, 'v0.8');
    expect(run.status).toBe(0);
    expect(run.args).toBe('publish --ignore-scripts --tag v0.8');
  });

  test('a 409 over a staged version passes: the registry holds it', () => {
    const run = publish(
      'npm error code E409\nnpm error 409 Conflict - PUT https://registry.npmjs.org/luna-player - Cannot publish over previously staged version "0.1.2".',
      1,
    );
    expect(run.status).toBe(0);
    expect(run.out).toContain('treating it as published');
  });

  test('EPUBLISHCONFLICT passes too', () => {
    expect(publish('npm error code EPUBLISHCONFLICT', 1).status).toBe(0);
  });

  test('any other failure fails, with npm’s exit code', () => {
    const run = publish('npm error code E403\nnpm error 403 Forbidden', 1);
    expect(run.status).toBe(1);
  });

  test('without a dist-tag it is a usage error', () => {
    expect(spawnSync('sh', [script], { encoding: 'utf8' }).status).toBe(2);
  });
});
