// D-51: the CLI loader must reproduce the core golden from a real git working tree.
import { execFileSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
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

/**
 * The one git invocation site in this file. `execFileSync` defaults to `process.cwd()`, which under
 * vitest is the accord repository root, so a single omitted `cwd` on an `add -A` / `commit` pair would
 * stage and commit the author's whole working tree inside a green test run. The working directory is
 * therefore pinned once, here, and the guard refuses to hand the wrapper out unless `tmp` is a throwaway
 * sandbox under the OS temp directory. It throws rather than expects, so it fires outside a test body too.
 */
function gitIn(tmp: string) {
  // `.native` for the 8.3 reason given at the D-78 test below: both sides of every path comparison in
  // this file canonicalise the same way, or a Windows short name makes equal directories compare unequal.
  const root = realpathSync.native(tmp);
  if (!root.startsWith(realpathSync.native(tmpdir())) || root === realpathSync.native(process.cwd())) {
    throw new Error('refusing to run git outside a temporary sandbox: ' + tmp);
  }
  return (...args: string[]) =>
    execFileSync('git', args, { cwd: tmp, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
}
const gitInit = (dir: string) => gitIn(dir)('init', '-q');
// git object files are read-only on Windows; retries let rmSync win the race with the index writer.
const cleanup = (dir: string) => rmSync(dir, { recursive: true, force: true, maxRetries: 5 });

/** Copy of the valid-build fixture with `git init`; nothing is staged, so ls-files sees it via --others. */
function makeRepo(): string {
  const tmp = makeTmp();
  cpSync(fixture, tmp, { recursive: true });
  gitInit(tmp);
  return tmp;
}

/** The same fixture with exactly one commit, so HEAD is born and `gitFacts` has something to read. */
function makeCommittedRepo(): { tmp: string; git: (...args: string[]) => string } {
  const tmp = makeTmp();
  cpSync(fixture, tmp, { recursive: true });
  const git = gitIn(tmp);
  git('init', '-q');
  const who = ['-c', 'user.email=dev@example.test', '-c', 'user.name=Dev', '-c', 'commit.gpgsign=false'];
  git(...who, 'add', '-A');
  git(...who, 'commit', '-m', 'seed');
  return { tmp, git };
}

describe('loadFromFs', () => {
  it('matches the core golden exactly', () => {
    const tmp = makeRepo();
    try {
      const input = loadFromFs(tmp);
      expect(stableJson(loadSnapshot(input))).toBe(readFileSync(golden, 'utf8'));
      expect(Object.keys(input.files).sort()).toEqual([
        'accord/assets/LOGIN-1/prototype.html',
        'accord/config.yml',
        'accord/product/glossary.md',
        'accord/tickets/EPIC-1.md',
        'accord/tickets/LOGIN-1.md',
        'accord/tickets/LOGIN-1/verification.md',
        'src/styles/tokens.css',
      ]);
      expect(input.tree).toEqual([
        'README.md',
        'accord/assets/LOGIN-1/prototype.html',
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

  it('reads tests.report into files', () => {
    const tmp = makeRepo();
    try {
      const configPath = join(tmp, 'accord/config.yml');
      writeFileSync(configPath, readFileSync(configPath, 'utf8') + 'tests:\n  report: reports/junit.xml\n');
      mkdirSync(join(tmp, 'reports'));
      writeFileSync(
        join(tmp, 'reports/junit.xml'),
        '<testsuite><testcase classname="a" name="b"/><testcase classname="a" name="c"><failure/></testcase></testsuite>\n',
      );
      const input = loadFromFs(tmp);
      expect(Object.keys(input.files)).toContain('reports/junit.xml');
      expect(loadSnapshot(input).tests).toEqual({ 'a#b': 'passed', 'a#c': 'failed' });
    } finally {
      cleanup(tmp);
    }
  });

  it('skips a report path outside the repository', () => {
    const parent = makeTmp();
    try {
      const tmp = join(parent, 'repo');
      mkdirSync(tmp);
      cpSync(fixture, tmp, { recursive: true });
      gitInit(tmp);
      writeFileSync(join(parent, 'outside.xml'), '<testsuite><testcase name="x"/></testsuite>\n');
      const configPath = join(tmp, 'accord/config.yml');
      writeFileSync(configPath, readFileSync(configPath, 'utf8') + 'tests:\n  report: ../outside.xml\n');
      const input = loadFromFs(tmp);
      expect(Object.keys(input.files).some((k) => k.endsWith('outside.xml'))).toBe(false);
      expect('tests' in loadSnapshot(input)).toBe(false);
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

  it('omits git entirely when the repository has no commit, so the golden is byte-unchanged (D-54)', () => {
    const tmp = makeRepo();
    try {
      expect(Object.hasOwn(loadFromFs(tmp), 'git')).toBe(false);
    } finally {
      cleanup(tmp);
    }
  });

  it('supplies git.commit and git.authors from a repository with one commit (D-78)', () => {
    const { tmp, git } = makeCommittedRepo();
    try {
      // Closes the loop on the guard: a helper that ever drifted onto the accord repository fails here
      // rather than committing to it.
      // `.native` throughout, never plain `realpathSync`: on Windows the plain form resolves symlinks
      // and junctions but leaves an 8.3 short component as it found it, so `mkdtemp` under a temp
      // directory whose owner has a name longer than eight characters yields `C:\Users\RUNNER~1\...`
      // while `git rev-parse` yields `C:\Users\runneradmin\...` — the same directory, unequal strings.
      // That is not hypothetical: it is the GitHub windows-latest runner, and it is invisible on a
      // developer machine whose username is short enough that Windows generates no alias at all.
      const toplevel = realpathSync.native(git('rev-parse', '--show-toplevel').trim());
      expect(toplevel).toBe(realpathSync.native(tmp));
      expect(toplevel).not.toBe(realpathSync.native(process.cwd()));

      const input = loadFromFs(tmp);
      const facts = input.git;
      if (facts === undefined) throw new Error('expected loadFromFs to supply git facts');
      expect(facts.commit).toMatch(/^[0-9a-f]{40}$/);
      expect(facts.authors[facts.commit]).toBe('dev@example.test');
      expect(facts.authors['accord/tickets/LOGIN-1/verification.md']).toBe('dev@example.test');
      for (const k of Object.keys(facts.authors)) expect(k).not.toContain('\\');
      // The field survives the loader untouched (D-78).
      expect(loadSnapshot(input).git).toEqual(facts);
    } finally {
      cleanup(tmp);
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
