// CLI-06 / D-94: the version pin is a hard refusal — exit 2, both versions named, and no flag or
// environment variable that bypasses it. D-95 exempts `--version` and `--help`, because `--version`
// is the command a person types to diagnose the very mismatch being reported.
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import pkg from '../package.json' with { type: 'json' };
import { pinMessage } from '../src/pin.js';
import { cleanup, makeRepo, run } from './helpers/repo.js';

/** Rewrite the fixture's pinned version so a mismatch can be driven without touching package.json. */
function pin(repo: string, version: string): void {
  const file = join(repo, 'accord', 'config.yml');
  const text = readFileSync(file, 'utf8');
  const next = text.replace(/^accord: .*$/m, `accord: "${version}"`);
  if (next === text) throw new Error('fixture config.yml has no accord: line to repin');
  writeFileSync(file, next);
}

describe('pinMessage', () => {
  it('names the pinned version, the running version, and the fix command', () => {
    const message = pinMessage('0.2.0', '0.1.0');
    expect(message).toContain('0.2.0');
    expect(message).toContain('0.1.0');
    expect(message).toContain('npx --yes');
    expect(message).toContain(`${pkg.name}@0.2.0`);
  });

  it('returns undefined when the pin equals the running version', () => {
    expect(pinMessage('0.1.0', '0.1.0')).toBeUndefined();
  });

  it('returns undefined when there is no pin', () => {
    expect(pinMessage(undefined, '0.1.0')).toBeUndefined();
  });

  it('compares exact strings, never semver (D-94)', () => {
    expect(pinMessage('0.1.0-rc.1', '0.1.0')).toBeTypeOf('string');
  });
});

describe('the pin under runCli', () => {
  let repo: string | undefined;

  afterEach(() => {
    if (repo !== undefined) cleanup(repo);
    repo = undefined;
  });

  it('stops lint with exit 2 and writes nothing to stdout', async () => {
    repo = makeRepo('valid-build');
    pin(repo, '9.9.9');
    const { code, out, err } = await run(['lint'], repo);
    expect(code).toBe(2);
    expect(out).toBe('');
    expect(err).toContain('9.9.9');
    expect(err).toContain(pkg.version);
  });

  it('still answers --version under a mismatch (D-95)', async () => {
    repo = makeRepo('valid-build');
    pin(repo, '9.9.9');
    const { code, out } = await run(['--version'], repo);
    expect(code).toBe(0);
    expect(out.trim()).toBe(pkg.version);
  });

  it('reports schema findings rather than a pin error when config.yml fails the schema', async () => {
    repo = makeRepo('bad-config');
    const { code, out, err } = await run(['lint'], repo);
    expect(code).toBe(1);
    expect(out).toContain('accord/config.yml');
    expect(out).toContain('error schema.');
    expect(err).toBe('');
  });
});
