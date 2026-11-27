// Phase 08.9.3 D-07, D-04, D-06, D-08: `accord repos status <id>` prints, for each other repository of a ticket's plan, the facts the verifier copies into `## Repository <name>` of verification.md: the clone, the
// worktree, each slice's branch and head, the pull request read from `gh` (merge state read, never written), the `record:` lines, the suite and where to run it, and which later slice of this repository is held until
// that pull request merges. `gh` is intercepted as in pr-wait.test.ts (a recorded argv array and options, never a spawn, so no case reaches GitHub); `git` stays real, in two sibling clones (helpers/repos.ts).
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, it, vi } from 'vitest';
import { REPOS_FROM } from '@accord-dev/accord-core';
import { claimedUnder, commitAll, run, writeFiles } from './helpers/repo.js';
import { reposCopy, useRepoSandboxes, type Repos } from './helpers/repos.js';

/** What the fake `gh` answers: a string is stdout, an Error is a failed call. Set per case. */
interface Opts {
  cwd?: string;
  shell?: unknown;
  env?: Record<string, string | undefined>;
}
const gh = vi.hoisted(() => ({
  calls: [] as { args: string[]; opts: Opts }[],
  answer: (() => '') as (args: string[], opts: Opts) => string | Error,
}));
vi.mock('node:child_process', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:child_process')>();
  return {
    ...actual,
    execFileSync: (file: string, args: string[], opts: unknown) => {
      if (file !== 'gh') return (actual.execFileSync as unknown as (...a: unknown[]) => unknown)(file, args, opts);
      gh.calls.push({ args, opts: opts as Opts });
      const out = gh.answer(args, opts as Opts);
      if (out instanceof Error) throw out;
      return out;
    },
  };
});

useRepoSandboxes();

const CLAIM = 't/ST-9';
const posix = (p: string): string => p.replace(/\\/g, '/');
const task = (n: number, files: string): string => `## Task ${n}: Step ${n}\ncovers: @ac-${n}\nfiles: ${files}\nverify: export#step-${n} (@ac-${n})\nafter: none\nDo step ${n}.\n`;
const slice = (n: number, repo?: string): string => `## Slice ${n}: Part ${n}\n${repo === undefined ? '' : `repo: ${repo}\n`}tasks: ${n}\ncovers: @ac-${n}\n`;

/** One slice of the plan: its number and the repository it is built in (absent: this repository). */
interface Part {
  n: number;
  repo?: string;
}
const ONE_TWO: Part[] = [{ n: 1, repo: 'tools' }, { n: 2 }];

/** ST-9 claimed at REPOS_FROM on t/ST-9 of the svc clone, planned with `parts` (task n is slice n's), the plan committed. */
async function planned(r: Repos, parts: Part[]): Promise<void> {
  r.git(r.svc, 'switch', '-q', '-c', CLAIM);
  claimedUnder(r.svc, REPOS_FROM, 'ST-9');
  expect((await run(['approve', 'ST-9'], r.svc)).code).toBe(0);
  writeFiles(r.svc, { 'src/svc.ts': 'export const svc = 1;\n' });
  const base = commitAll(r.svc);
  const toolsSha = r.git(r.tools, 'rev-parse', 'refs/remotes/origin/main').trim();
  const where = (p: Part): string => (p.repo === undefined ? 'src/svc.ts' : p.n === 1 ? 'tools:src/Tools.cs' : 'tools:src/Other.cs');
  const text = ['---', `baseline: ${base}`, `baseline_tools: ${toolsSha}`, '---', '', '# Plan', '', ...parts.map((p) => task(p.n, where(p))), ...parts.map((p) => slice(p.n, p.repo))].join('\n');
  writeFiles(r.svc, { 'accord/tickets/ST-9/plan.md': text });
  commitAll(r.svc);
}

const toolsWt = (r: Repos): string => posix(join(r.parent, 'tools-st-9'));

/** The tools worktree of ST-9 opened on slice 1 with one commit on it; returns the commit. */
async function toolsOneCommitted(r: Repos): Promise<string> {
  const res = await run(['worktree', 'slice', 'ST-9', '1'], r.svc);
  expect(res.code, res.out + res.err).toBe(0);
  writeFiles(toolsWt(r), { 'src/Tools.cs': 'class Tools { int one; }\n' });
  return commitAll(toolsWt(r), 'tools slice one');
}

const M = 'e'.repeat(40);
/** The `gh pr list` answer for one head branch; any other call is a failed one, so a call the command should not make shows. */
function answers(byBranch: Record<string, unknown[]>): void {
  gh.calls.length = 0;
  gh.answer = (args, opts) => {
    if (args[0] !== 'pr' || args[1] !== 'list') return new Error('unexpected gh call: ' + args.join(' '));
    if (opts.env?.GH_REPO !== 'acme/tools') return new Error('gh was not aimed at acme/tools');
    const branch = args[args.indexOf('--head') + 1];
    return JSON.stringify(byBranch[branch] ?? []);
  };
}

it('risk:regression accord repos status ST-9 prints the tools pull request and the lines the verifier copies (D-07, D-04)', async () => {
  const r = reposCopy();
  await planned(r, ONE_TWO);
  const tip = await toolsOneCommitted(r);
  answers({ 'slice/ST-9/1': [{ number: 41, state: 'MERGED', isDraft: false, mergeCommit: { oid: M } }] });
  const res = await run(['repos', 'status', 'ST-9'], r.svc);
  expect(res.code, res.out + res.err).toBe(0);
  expect(res.out).toBe(
    [
      'repository: tools',
      `clone: ${posix(r.tools)}`,
      `worktree: ${toolsWt(r)}`,
      'suite: node -e "process.exit(0)"',
      `suite-dir: ${toolsWt(r)}`,
      'slice 1: branch slice/ST-9/1',
      `slice 1: head ${tip}`,
      `slice 1: pr #41 merged ${M}`,
      'record: Slice: 1',
      'record: PR: #41',
      `record: Verified head: ${tip}`,
      `record: Merged: ${M}`,
      '',
    ].join('\n'),
  );
}, 120_000);

it('risk:security every gh call of repos status is an argument array of read verbs, with no shell, from this checkout and aimed at the declared repository by GH_REPO (T-08.9.3-28, R17)', async () => {
  const r = reposCopy();
  await planned(r, ONE_TWO);
  await toolsOneCommitted(r);
  answers({ 'slice/ST-9/1': [{ number: 41, state: 'OPEN', isDraft: true, mergeCommit: null }] });
  const res = await run(['repos', 'status', 'ST-9'], r.svc, { GH_REPO: 'evil/elsewhere' });
  expect(res.code, res.out + res.err).toBe(0);
  expect(gh.calls.length).toBeGreaterThan(0);
  for (const c of gh.calls) {
    expect(c.args.slice(0, 2)).toEqual(['pr', 'list']);
    expect(c.opts.shell).toBeUndefined();
    expect(posix(String(c.opts.cwd)).toLowerCase()).toBe(posix(r.svc).toLowerCase());
    expect(c.opts.env?.GH_REPO).toBe('acme/tools');
    expect(c.opts.env?.GH_PROMPT_DISABLED).toBe('1');
  }
}, 120_000);

it('risk:security accord repos status writes nothing: the records, the refs and the files of both clones are as they were (D-04)', async () => {
  const r = reposCopy();
  await planned(r, ONE_TWO);
  await toolsOneCommitted(r);
  const state = (): string =>
    [
      r.git(r.svc, 'for-each-ref', '--format=%(refname) %(objectname)'),
      r.git(r.tools, 'for-each-ref', '--format=%(refname) %(objectname)'),
      r.git(r.svc, 'status', '--porcelain', '--untracked-files=all'),
      r.git(toolsWt(r), 'status', '--porcelain', '--untracked-files=all'),
      ...['worktrees', 'slices', 'repos'].map((n) => (existsSync(join(r.svc, '.git', 'accord', n)) ? readFileSync(join(r.svc, '.git', 'accord', n), 'utf8') : '')),
    ].join('\n--\n');
  answers({ 'slice/ST-9/1': [{ number: 41, state: 'OPEN', isDraft: false, mergeCommit: null }] });
  const before = state();
  const res = await run(['repos', 'status', 'ST-9'], r.svc);
  expect(res.code, res.out + res.err).toBe(0);
  expect(state()).toBe(before);
}, 120_000);
