import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import pkg from '../package.json' with { type: 'json' };
import { makeClone } from './helpers/worktree.js';

const cli = fileURLToPath(new URL('../dist/cli.js', import.meta.url));

describe('accord bin', () => {
  it('is built', () => {
    expect(existsSync(cli), 'run npm run build first').toBe(true);
  });

  it('starts with a shebang', () => {
    const firstLine = readFileSync(cli, 'utf8').split('\n')[0];
    expect(firstLine).toBe('#!/usr/bin/env node');
  });

  // CLI-07: the built binary is started by absolute path under process.execPath — no shell, no
  // `accord.cmd` shim, and no package manager. `--help` is answered by commander before any action
  // runs, so this stays true as later plans in this phase register more commands.
  it('runs under process.execPath and lists the lint command', () => {
    const out = execFileSync(process.execPath, [cli, '--help'], { encoding: 'utf8' });
    expect(out).toContain('lint');
  });

  // Read from the manifest, not written as a literal: the version moves every release, and a
  // literal here turns a routine bump into a red test in a file that has nothing to do with it.
  it('--version prints the version', () => {
    const out = execFileSync(process.execPath, [cli, '--version'], { encoding: 'utf8' });
    expect(out.trim()).toBe(pkg.version);
  });

  // D-164: bundling under D-150 removes the import, not the declaration. A dependency on a package
  // that is never published sends every `npx --yes` install to the registry for a name that 404s,
  // and `npm publish --dry-run` says nothing about it, because the failure happens at install time
  // on someone else's machine. The engines floor is read for the same reason: widening it would
  // publish a package that installs onto a runtime commander 15 and vitest 5 both refuse (OPS-03).
  it('declares exactly one runtime dependency and the OPS-03 engines floor (D-164)', () => {
    expect(Object.keys(pkg.dependencies)).toEqual(['commander']);
    expect(pkg.engines.node).toBe('>=22.12.0');
  });

  // The other half of the same failure, one layer down: a future edit that un-bundles core leaves a
  // manifest that installs and a binary that cannot resolve its own import. Matched on the import
  // specifier rather than a bare substring — an ordinary comment naming the package would defeat a
  // substring search, and core's own strings inside the bundle would fire it.
  it('the bundle inlines core rather than importing it (D-150)', () => {
    const text = readFileSync(cli, 'utf8');
    expect(text).not.toMatch(/from ['"]@accord-dev\/accord-core['"]/);
  });
});

it('risk:parsing the built cli hands hook input on stdin to the prompt expansion hook', () => {
  const c = makeClone();
  try {
    c.git('worktree', 'add', '-q', '-b', 't/ST-9', c.sibling('ST-9'), 'origin/main');
    const out = execFileSync(process.execPath, [cli, 'hook', 'prompt-expansion'], {
      cwd: c.root,
      encoding: 'utf8',
      input: JSON.stringify({ session_id: 's', command_name: 'accord', command_args: 'pick-up ST-10', cwd: c.sibling('ST-9') }),
    });
    expect(JSON.parse(out).decision).toBe('block');
  } finally {
    c.cleanupAll();
  }
});
