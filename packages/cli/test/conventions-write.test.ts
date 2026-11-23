// Phase 8.1 G3a (D-09): `accord conventions write <file>` puts only the accepted lines on their own branch cut from origin's default branch, in a throwaway worktree.
// Real git in tmp sandboxes with a bare origin; nothing here reaches the real origin.
import { mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { lineProblem } from '@accord-dev/accord-core';
import { afterEach, expect, it } from 'vitest';
import { cleanup, gitRun, run, writeFiles } from './helpers/repo.js';
import { makeClone } from './helpers/worktree.js';
import type { Clone } from './helpers/worktree.js';

const clones: Clone[] = [];
const dirs: string[] = [];
afterEach(() => {
  while (clones.length > 0) clones.pop()?.cleanupAll();
  while (dirs.length > 0) cleanup(dirs.pop() as string);
});

const today = (): string => new Date().toISOString().slice(0, 10);
const tempFolders = (): string[] => readdirSync(tmpdir()).filter((n) => n.startsWith('accord-conventions-')).sort();
const EXISTING = '# Conventions\n\n- Existing rule — enforced by: prose\n';

/** A clone whose default branch holds a conventions file, with the bare origin that holds it too. */
function clone(): Clone {
  const c = makeClone();
  clones.push(c);
  writeFiles(c.root, { 'accord/product/conventions.md': EXISTING });
  c.git('add', '-A');
  c.git('commit', '-q', '-m', 'conventions');
  c.git('push', '-q', 'origin', 'main');
  return c;
}

/** The accepted lines as the skill writes them: a file outside the repository. */
function accepted(text: string): string {
  const dir = mkdtempSync(join(tmpdir(), 'accord-accepted-'));
  dirs.push(dir);
  const file = join(dir, 'lines.md');
  writeFileSync(file, text);
  return file;
}

const A = '- Use named exports — enforced by: import/no-default-export';
const B = '- Tests sit beside the code — enforced by: prose';

it('risk:data-loss accord conventions write puts only the accepted lines on their own branch (D-09)', async () => {
  const c = clone();
  const before = [c.git('rev-parse', 'HEAD'), c.git('status', '--porcelain', '--untracked-files=all'), readFileSync(join(c.root, 'accord/product/conventions.md'), 'utf8')];
  const folders = tempFolders();
  const first = today();

  const r = await run(['conventions', 'write', accepted(`${A}\n\n${B}\n- Existing rule — enforced by: prose\n`)], c.root);
  expect(r.code, r.out + r.err).toBe(0);
  const out = r.out.split('\n').filter((l) => l !== '');
  const branchLine = out.find((l) => l.startsWith('branch: '));
  const m = /^branch: conventions\/(\d{4}-\d{2}-\d{2})$/.exec(branchLine ?? '');
  expect(m, r.out).not.toBeNull();
  const date = (m as RegExpExecArray)[1];
  expect([first, today()]).toContain(date);
  expect(out).toContain('base: main');
  expect(out).toContain(`title: conventions: ${date}`);
  // a line the default branch already has is skipped and named
  expect(r.out + r.err).toMatch(/skipped.*Existing rule/);

  // origin: one commit over main with the subject, holding the default branch's file and exactly the two new lines
  expect(gitRun(c.remote, 'rev-list', '--count', `main..conventions/${date}`).trim()).toBe('1');
  expect(gitRun(c.remote, 'log', '-1', '--format=%s', `conventions/${date}`).trim()).toBe(`conventions: ${date}`);
  expect(gitRun(c.remote, 'show', `conventions/${date}:accord/product/conventions.md`)).toBe(`${EXISTING}${A}\n${B}\n`);
  expect(gitRun(c.remote, 'diff', '--name-only', `main`, `conventions/${date}`).trim()).toBe('accord/product/conventions.md');

  // the checkout is untouched, and no throwaway folder or branch is left
  expect([c.git('rev-parse', 'HEAD'), c.git('status', '--porcelain', '--untracked-files=all'), readFileSync(join(c.root, 'accord/product/conventions.md'), 'utf8')]).toEqual(before);
  expect(c.git('branch', '--list', 'conventions/*').trim()).toBe('');
  expect(c.git('worktree', 'list', '--porcelain').split('\n').filter((l) => l.startsWith('worktree '))).toHaveLength(1);
  expect(tempFolders()).toEqual(folders);

  // a second run the same day is refused, naming the branch, and writes nothing
  const again = await run(['conventions', 'write', accepted(`${B}\n`)], c.root);
  expect(again.code, again.out + again.err).toBe(2);
  expect(again.err).toContain(`conventions/${date}`);
});

it('risk:security accord conventions write refuses a line it cannot read and changes nothing (D-09)', async () => {
  const c = clone();
  const bad: [string, string][] = [
    ['a line without the enforced-by part', '- Use named exports'],
    ['a line holding a comment opener', '- Use <!-- named exports — enforced by: prose'],
    ['a line holding a comment closer', '- Use named exports --> — enforced by: prose'],
    ['a line over 300 characters', `- ${'x'.repeat(300)} — enforced by: prose`],
    ['a line with a control character', '- Use named\u0007 exports — enforced by: prose'],
    ['a line with no list marker', 'Use named exports — enforced by: prose'],
  ];
  for (const [what, line] of bad) {
    const r = await run(['conventions', 'write', accepted(`${A}\n${line}\n`)], c.root);
    expect(r.code, `${what}: ${r.out}${r.err}`).toBe(2);
    expect(r.err, what).toContain('line 2');
    expect(gitRun(c.remote, 'branch', '--list', 'conventions/*').trim(), what).toBe('');
  }
  const none = await run(['conventions', 'write', accepted('\n\n')], c.root);
  expect(none.code, none.out + none.err).toBe(2);
  const missing = await run(['conventions', 'write', join(c.root, 'nope.md')], c.root);
  expect(missing.code, missing.out + missing.err).toBe(2);
  expect(gitRun(c.remote, 'branch', '--list', 'conventions/*').trim()).toBe('');
});

it('risk:security accord conventions write accepts and refuses exactly the lines the delivery check does (8.5-ac-3 D-12)', async () => {
  const c = clone();
  const tail = ' — enforced by: prose';
  /** a writer-shaped line of exactly `n` characters */
  const ofLength = (n: number): string => `- ${'x'.repeat(n - 2 - tail.length)}${tail}`;
  const shaped = (x: string): string => `- ${x}${tail}`;
  // hidden characters are built by escape, never written literally
  const persian = 'می‌خواهم';
  const rows: [string, string, boolean][] = [
    ['U+200C between letters', shaped(persian), true],
    ['a bidi override U+202E', shaped(`a${String.fromCodePoint(0x202e)}b`), false],
    ['a tag character U+E0041', shaped(`a${String.fromCodePoint(0xe0041)}b`), false],
    ['a TAB', shaped('a\tb'), false],
    ['300 characters in all', ofLength(300), true],
    ['301 characters in all', ofLength(301), false],
    ['a Test command: start', '- Test command: x — enforced by: prose', false],
    ['a Commit rule: start', '- Commit rule: x — enforced by: prose', false],
  ];
  for (const [what, line, accepted_] of rows) {
    const problem = lineProblem(line);
    // the contract of D-12: accepted exactly when the delivery check finds nothing; the table also states what each row is
    expect(problem === undefined, `${what}: the table row matches the delivery check`).toBe(accepted_);
    const r = await run(['conventions', 'write', accepted(`${A}\n${line}\n`)], c.root);
    if (problem === undefined) {
      expect(r.code, `${what}: ${r.out}${r.err}`).toBe(0);
      const m = /^branch: (conventions\/\d{4}-\d{2}-\d{2})$/m.exec(r.out);
      expect(m, `${what}: ${r.out}`).not.toBeNull();
      const branch = (m as RegExpExecArray)[1];
      expect(gitRun(c.remote, 'show', `${branch}:accord/product/conventions.md`), what).toContain(line);
      gitRun(c.remote, 'branch', '-D', branch);
    } else {
      expect(r.code, `${what}: ${r.out}${r.err}`).toBe(2);
      expect(r.err, what).toContain('line 2');
      expect(r.err, what).toContain(problem.reason);
      expect(gitRun(c.remote, 'branch', '--list', 'conventions/*').trim(), `${what}: no branch is pushed`).toBe('');
    }
  }
});

it('risk:security accord conventions write refuses a conventions subject the quoted gh title cannot carry and writes nothing (U-3)', async () => {
  const c = clone();
  const config = join(c.root, 'accord/config.yml');
  const original = readFileSync(config, 'utf8');
  const before = c.git('rev-parse', 'HEAD');
  for (const [what, template] of [['a double quote', 'conventions "x" {id}'], ['a dollar sign', 'conventions $(id) {id}'], ['a backtick', 'conventions `id` {id}'], ['a backslash', String.raw`conventions a\b {id}`]] as const) {
    writeFileSync(config, original + `commits:\n  subjects:\n    conventions: ${JSON.stringify(template)}\n`);
    const r = await run(['conventions', 'write', accepted(`${A}\n`)], c.root);
    expect(r.code, `${what}: ${r.out}${r.err}`).toBe(2);
    expect(r.out, `${what}: no title line is printed`).not.toContain('title:');
    expect(r.err, what).toContain('commits.subjects.conventions');
    expect(r.err, what).toContain('fix:');
    expect(gitRun(c.remote, 'branch', '--list', 'conventions/*').trim(), `${what}: nothing is pushed`).toBe('');
    expect(c.git('branch', '--list', 'conventions/*').trim(), what).toBe('');
  }
  expect(c.git('rev-parse', 'HEAD')).toBe(before);
});

// Phase 08.8 D-17: the hint for a branch already in this clone deletes only the tip the command read (accord/product/conventions.md line 9), never `git branch -D`
it('risk:data-loss an existing branch is refused with a tip-pinned delete hint (D-17)', async () => {
  const c = clone();
  const branch = `conventions/${today()}`;
  c.git('branch', branch);
  const tip = c.git('rev-parse', `refs/heads/${branch}`).trim();
  expect(tip).toMatch(/^[0-9a-f]{40,64}$/);
  const r = await run(['conventions', 'write', accepted(`${A}\n`)], c.root);
  expect(r.code, r.out + r.err).toBe(2);
  expect(r.err).toContain(`git update-ref -d refs/heads/${branch} ${tip}`);
  expect(r.err).not.toContain('git branch -D');
  expect(gitRun(c.remote, 'branch', '--list', 'conventions/*').trim()).toBe('');
});
