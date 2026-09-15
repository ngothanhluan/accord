import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

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

  it('--version prints the version', () => {
    const out = execFileSync(process.execPath, [cli, '--version'], { encoding: 'utf8' });
    expect(out.trim()).toBe('0.1.0');
  });
});
