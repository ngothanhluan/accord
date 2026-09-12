// D-51: the CLI loader must reproduce the core golden from a real git working tree.
import { execFileSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadSnapshot } from '@accord-dev/accord-core';
import { describe, expect, it } from 'vitest';
import { loadFromFs, UsageError } from '../src/load/fs.js';

const fixture = fileURLToPath(new URL('../../core/test/fixtures/valid-build/', import.meta.url));
const golden = fileURLToPath(
  new URL('../../core/test/__golden__/valid-build.snapshot.json', import.meta.url),
);

/** Same replacer as packages/core/test/helpers/fixture.ts; not imported across packages. */
function stableJson(x: unknown): string {
  return JSON.stringify(
    x,
    (_key, value: unknown) =>
      value !== null && typeof value === 'object' && !Array.isArray(value)
        ? Object.fromEntries(
            Object.keys(value as Record<string, unknown>)
              .sort()
              .map((k) => [k, (value as Record<string, unknown>)[k]]),
          )
        : value,
    2,
  );
}

const makeTmp = () => mkdtempSync(join(tmpdir(), 'accord-fs-'));
const gitInit = (dir: string) => execFileSync('git', ['init', '-q'], { cwd: dir });
// git object files are read-only on Windows; retries let rmSync win the race with the index writer.
const cleanup = (dir: string) => rmSync(dir, { recursive: true, force: true, maxRetries: 5 });

/** Copy of the valid-build fixture with `git init`; nothing is staged, so ls-files sees it via --others. */
function makeRepo(): string {
  const tmp = makeTmp();
  cpSync(fixture, tmp, { recursive: true });
  gitInit(tmp);
  return tmp;
}

describe('loadFromFs', () => {
  it('matches the core golden exactly', () => {
    const tmp = makeRepo();
    try {
      const input = loadFromFs(tmp);
      expect(stableJson(loadSnapshot(input))).toBe(readFileSync(golden, 'utf8'));
      expect(Object.keys(input.files).sort()).toEqual([
        'accord/config.yml',
        'accord/product/glossary.md',
        'accord/tickets/EPIC-1.md',
        'accord/tickets/LOGIN-1.md',
        'accord/tickets/LOGIN-1/verification.md',
        'src/styles/tokens.css',
      ]);
      expect(input.tree).toEqual([
        'README.md',
        'accord/config.yml',
        'accord/product/glossary.md',
        'accord/tickets/EPIC-1.md',
        'accord/tickets/LOGIN-1.md',
        'accord/tickets/LOGIN-1/verification.md',
        'src/login.ts',
        'src/styles/tokens.css',
      ]);
    } finally {
      cleanup(tmp);
    }
  });

  it('keys never contain a backslash', () => {
    const tmp = makeRepo();
    try {
      const input = loadFromFs(tmp);
      for (const k of Object.keys(input.files)) expect(k).not.toContain('\\');
      for (const p of input.tree) expect(p).not.toContain('\\');
    } finally {
      cleanup(tmp);
    }
  });

  it('respects .gitignore', () => {
    const tmp = makeRepo();
    try {
      writeFileSync(join(tmp, '.gitignore'), 'ignored.txt\n');
      writeFileSync(join(tmp, 'ignored.txt'), 'x\n');
      const { tree } = loadFromFs(tmp);
      expect(tree).not.toContain('ignored.txt');
      expect(tree).toContain('.gitignore');
    } finally {
      cleanup(tmp);
    }
  });

  it('skips a tokens path outside the repository', () => {
    const parent = makeTmp();
    try {
      const tmp = join(parent, 'repo');
      mkdirSync(tmp);
      cpSync(fixture, tmp, { recursive: true });
      gitInit(tmp);
      writeFileSync(join(parent, 'outside.css'), ':root {}\n');
      const config = readFileSync(join(tmp, 'accord/config.yml'), 'utf8');
      writeFileSync(
        join(tmp, 'accord/config.yml'),
        config.replace('src/styles/tokens.css', '../outside.css'),
      );
      const { files } = loadFromFs(tmp);
      expect(Object.keys(files).some((k) => k.endsWith('outside.css'))).toBe(false);
    } finally {
      cleanup(parent);
    }
  });

  it('a directory that is not a repository is a UsageError', () => {
    // Assumes the temp directory is not inside a git work tree (true on CI and the author's machine).
    const dir = makeTmp();
    try {
      expect(() => loadFromFs(dir)).toThrow(UsageError);
      expect(() => loadFromFs(dir)).toThrow('not a git repository');
    } finally {
      cleanup(dir);
    }
  });

  it('missing accord folder is a UsageError', () => {
    const dir = makeTmp();
    try {
      gitInit(dir);
      expect(() => loadFromFs(dir)).toThrow(UsageError);
      expect(() => loadFromFs(dir)).toThrow('no accord/ folder');
    } finally {
      cleanup(dir);
    }
  });

  it('exposes exit code 2 on UsageError', () => {
    const dir = makeTmp();
    try {
      gitInit(dir);
      let caught: unknown;
      try {
        loadFromFs(dir);
      } catch (err) {
        caught = err;
      }
      expect(caught).toBeInstanceOf(UsageError);
      expect((caught as UsageError).exitCode).toBe(2);
      expect((caught as UsageError).name).toBe('UsageError');
    } finally {
      cleanup(dir);
    }
  });
});
