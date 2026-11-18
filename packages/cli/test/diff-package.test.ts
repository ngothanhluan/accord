// ST-LN-83 07-07 (D-05): `accord diff-package <base> <head> [--security]` packages the changes of any two commits for a review of code accord did not build,
// with a deterministic changed-line count, and writes nothing.
import { expect, it } from 'vitest';
import { cleanup, commitMsg, gitRun, makeEmptyRepo, run, writeFiles } from './helpers/repo.js';
import { CONFIG, LANE_S_BODY, laneTicket } from '../../../test/helpers/lane.js';

function identity(repo: string): void {
  gitRun(repo, 'config', 'user.email', 'an@example.com');
  gitRun(repo, 'config', 'user.name', 'an');
  gitRun(repo, 'config', 'commit.gpgsign', 'false');
}

const BASE = ['l1', 'l2', 'l3', 'l4', 'l5'].join('\n') + '\n';
// l2 and l4 removed, seven lines added: nine changed lines
const FEATURE = ['l1', 'l3', 'l5', 'n1', 'n2', 'n3', 'n4', 'n5', 'n6', 'n7'].join('\n') + '\n';
const RUN_BASE = 'export const one = 1;\nexport const two = 2;\nexport const three = 3;\n';
const RUN_NEW = "export const one = 1;\nexport const two = 2;\nspawnSync('git', ['status']);\nexport const three = 3;\n";

const sections = (out: string): string => out.slice(out.indexOf('## Checklist'));

it('ac-3 diff-package counts the changed lines of two commits and writes nothing (ST-LN-83 7-ac-3)', async () => {
  const repo = makeEmptyRepo();
  try {
    identity(repo);
    writeFiles(repo, { 'accord/config.yml': CONFIG, 'src/a.txt': BASE });
    const base = commitMsg(repo, 'base');
    gitRun(repo, 'branch', '-M', 'main');
    gitRun(repo, 'switch', '-q', '-c', 'feature');
    writeFiles(repo, { 'src/a.txt': FEATURE });
    const head = commitMsg(repo, 'feature');
    // main moves on after the branch left it: the merge-base diff must not count that
    gitRun(repo, 'switch', '-q', 'main');
    writeFiles(repo, { 'src/other.txt': 'a\nb\nc\nd\n' });
    const main = commitMsg(repo, 'main moves');
    gitRun(repo, 'switch', '-q', 'feature');

    const status = gitRun(repo, 'status', '--porcelain');
    const refs = gitRun(repo, 'for-each-ref');
    const out = await run(['diff-package', 'main', 'feature'], repo);
    expect(out.err).toBe('');
    expect(out.code).toBe(0);
    expect(out.out).toMatch(/^# Diff package main\.\.\.feature\n/);
    expect(out.out).toContain(`\nBase: ${main}\n`);
    expect(out.out).toContain(`\nHead: ${head}\n`);
    expect(out.out).toMatch(/^Changed lines: 9$/m);
    expect(out.out).toContain('## Stat');
    expect(out.out).toContain('## Diff');
    expect(out.out).toContain('+n7');
    expect(out.out).toContain('-l2');
    expect(out.out).not.toContain('other.txt');
    expect(out.out.indexOf('## Stat')).toBeLessThan(out.out.indexOf('## Diff'));
    // the merge base is `base`: counting from it gives the same total
    expect((await run(['diff-package', base, 'feature'], repo)).out).toMatch(/^Changed lines: 9$/m);
    // no --security: no security sections
    expect(out.out).not.toContain('## Matched hunks');
    // two runs print the same bytes, and the command writes nothing
    expect((await run(['diff-package', 'main', 'feature'], repo)).out).toBe(out.out);
    expect(gitRun(repo, 'status', '--porcelain')).toBe(status);
    expect(gitRun(repo, 'for-each-ref')).toBe(refs);
  } finally {
    cleanup(repo);
  }
}, 120_000);

it('ac-3 diff-package --security gives the security sections of a risky path (ST-LN-83 7-ac-3)', async () => {
  const repo = makeEmptyRepo();
  try {
    identity(repo);
    writeFiles(repo, {
      'accord/config.yml': CONFIG,
      'accord/tickets/S-1.md': laneTicket('S-1', { lane: 'S', body: LANE_S_BODY }),
      'src/run.ts': RUN_BASE,
      'src/other.ts': 'export const o = 1;\n',
    });
    commitMsg(repo, 'base');
    gitRun(repo, 'branch', '-M', 'main');
    gitRun(repo, 'switch', '-q', '-c', 't/S-1');
    writeFiles(repo, { 'src/run.ts': RUN_NEW, 'src/other.ts': 'export const o = 2;\n' });
    commitMsg(repo, 'spawn');

    const status = gitRun(repo, 'status', '--porcelain');
    const mine = await run(['diff-package', 'main', 't/S-1', '--security'], repo);
    expect(mine.err).toBe('');
    expect(mine.code).toBe(0);
    expect(mine.out).toMatch(/^# Diff package main\.\.\.t\/S-1\n/);
    expect(mine.out).toMatch(/^Changed lines: [0-9]+$/m);
    expect(mine.out).toContain('## Checklist');
    expect(mine.out).toContain('## Security triggers\n\nsrc/run.ts:3: spawn (process spawn)');
    expect(mine.out).toContain('## Matched hunks');
    expect(mine.out).toContain("+spawnSync('git', ['status']);");
    // the sections are the ones review-package builds for the same diff and changed list
    const theirs = await run(['review-package', 'S-1', '--security'], repo);
    expect(theirs.err).toBe('');
    expect(theirs.code).toBe(0);
    expect(sections(mine.out)).toBe(sections(theirs.out));
    expect(gitRun(repo, 'status', '--porcelain')).toBe(status);

    // a change no pattern matches
    gitRun(repo, 'switch', '-q', 'main');
    gitRun(repo, 'switch', '-q', '-c', 'quiet');
    writeFiles(repo, { 'src/other.ts': 'export const o = 3;\n' });
    commitMsg(repo, 'quiet');
    const quiet = await run(['diff-package', 'main', 'quiet', '--security'], repo);
    expect(quiet.code).toBe(0);
    expect(quiet.out).toContain('## Security triggers\n\n(none: no pattern matched)');
  } finally {
    cleanup(repo);
  }
}, 120_000);

it('ac-3 diff-package refuses an option-like or unknown ref (ST-LN-83 7-ac-3)', async () => {
  const repo = makeEmptyRepo();
  try {
    identity(repo);
    writeFiles(repo, { 'accord/config.yml': CONFIG, 'src/a.txt': BASE });
    commitMsg(repo, 'base');
    gitRun(repo, 'branch', '-M', 'main');
    gitRun(repo, 'switch', '-q', '-c', 'feature');
    writeFiles(repo, { 'src/a.txt': FEATURE });
    commitMsg(repo, 'feature');
    const status = gitRun(repo, 'status', '--porcelain');

    // `--` keeps commander from reading the value as its own option; the command itself must still refuse it
    for (const args of [['--', '--output=x', 'feature'], ['--', 'main', '--output=x'], ['--', '-x', 'feature'], ['--', 'main', '-']]) {
      const bad = await run(['diff-package', ...args], repo);
      expect(bad.code, args.join(' ')).toBe(2);
      expect(bad.out, args.join(' ')).toBe('');
      expect(bad.err, args.join(' ')).toContain('not a git ref');
    }
    const unknown = await run(['diff-package', 'main', 'no-such-branch'], repo);
    expect(unknown.code).toBe(2);
    expect(unknown.out).toBe('');
    expect(unknown.err).toContain('no-such-branch');
    const unknownBase = await run(['diff-package', 'nowhere', 'feature'], repo);
    expect(unknownBase.code).toBe(2);
    expect(unknownBase.err).toContain('nowhere');
    // git never wrote the file an option-like ref would have named
    expect(gitRun(repo, 'status', '--porcelain')).toBe(status);
  } finally {
    cleanup(repo);
  }
}, 120_000);
