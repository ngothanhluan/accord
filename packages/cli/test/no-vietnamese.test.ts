import { execFileSync } from 'node:child_process';
import { readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, it } from 'vitest';
import { cleanup, commitMsg, gitRun, makeEmptyRepo, writeFiles } from './helpers/repo.js';

// The check's letter set, as escapes so this file passes its own check.
const LETTER = /[\u0102\u0103\u0110\u0111\u01A0\u01A1\u01AF\u01B0\u1EA0-\u1EF9]/u;

/** Every `path:line` of a tracked text file holding a Vietnamese-only letter, in `git ls-files` order. */
export function vietnameseLines(root: string): string[] {
  const listed = execFileSync('git', ['ls-files', '-z'], { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  const found: string[] = [];
  for (const rel of listed.split('\0').filter((p) => p !== '')) {
    const abs = join(root, ...rel.split('/'));
    if (!statSync(abs, { throwIfNoEntry: false })?.isFile()) continue; // deleted in the working tree, or a submodule
    const buf = readFileSync(abs);
    if (buf.includes(0)) continue; // binary
    buf.toString('utf8').normalize('NFC').split('\n').forEach((line, i) => {
      if (LETTER.test(line)) found.push(rel + ':' + (i + 1));
    });
  }
  return found;
}

it('ac-2 the check fails on a committed d with stroke and names its path and line 3', () => {
  const repo = makeEmptyRepo();
  try {
    gitRun(repo, 'config', 'user.email', 'an@example.com');
    gitRun(repo, 'config', 'user.name', 'an');
    gitRun(repo, 'config', 'commit.gpgsign', 'false');
    // b.md: decomposed o + horn (only NFC finds it); c.md: a NUL byte hides its d with stroke.
    writeFiles(repo, {
      'docs/notes/a.md': 'one\ntwo\nthree \u0111\n',
      'docs/notes/b.md': 'one\ntwo\nthree\nfour o\u031b\n',
      'docs/notes/c.md': 'one\0\u0111\n',
    });
    commitMsg(repo, 'add a');
    expect(vietnameseLines(repo)).toEqual(['docs/notes/a.md:3', 'docs/notes/b.md:4']);
  } finally {
    cleanup(repo);
  }
}, 60_000);

it('ac-1 no tracked file holds a Vietnamese-only letter', () => {
  expect(vietnameseLines(fileURLToPath(new URL('../../../', import.meta.url)))).toEqual([]);
}, 60_000);
