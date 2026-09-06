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

  it('runs under process.execPath and prints the schema ids', () => {
    const out = execFileSync(process.execPath, [cli], { encoding: 'utf8' });
    expect(out.startsWith('accord 0.1.0')).toBe(true);
    expect(out).toContain('schemas: ticket, verification, config');
  });

  it('--version prints the version', () => {
    const out = execFileSync(process.execPath, [cli, '--version'], { encoding: 'utf8' });
    expect(out.trim()).toBe('0.1.0');
  });
});
