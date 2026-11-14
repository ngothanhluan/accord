// ST-LN-96 t1-ac-5, D-04 Ruling: the keep-sites of the merge-commit audit (03.1-10-MERGE-SITES.md) hold on a rebased branch and after a squash merge.
// Each `it` carries the audit row it covers (S6, S7, S12, S13, S16, S18, S20), against real git in tmp sandboxes. A site that was already right shows
// here as a guard: the test passes at once, and the row's decision stays Keep.
import { existsSync } from 'node:fs';
import { expect, it, vi } from 'vitest';
import { loadSnapshot, scopeProblems } from '@accord-dev/accord-core';
import { CONFIG, LANE_S_BODY, laneTicket } from '../../../test/helpers/lane.js';
import { gitBranchCommits, loadFromFs } from '../src/load/fs.js';
import { readHistory } from '../src/load/record-history.js';
import { roundFactsFor } from '../src/load/round-facts.js';
import { readWalk } from '../src/load/walk.js';
import { cleanup, commitMsg, gitRun, makeEmptyRepo, run, writeFiles } from './helpers/repo.js';
import { claimWorktree, type Clone, copy, doneOnRemote, dropOnRemote, has, lines, ME, teammate, ticketWorktree, useSandboxes } from './helpers/worktree.js';

vi.mock('../src/load/proc.js', async (orig) => {
  const real = await orig<typeof import('../src/load/proc.js')>();
  return { ...real, processTable: vi.fn(real.processTable) };
});
vi.mock('../src/commands/fetch-limit.js', async (orig) => {
  const real = await orig<typeof import('../src/commands/fetch-limit.js')>();
  return { ...real, fetchLimitMs: vi.fn(real.fetchLimitMs) };
});

useSandboxes([{}]);

const REVIEW = 'accord/tickets/T-1/review.md';
const DEF = { def: 'refs/heads/main' };
const config = CONFIG.replace(/^accord: .*$/m, 'accord: "0.4.0"');
const v1 = (rounds: number): string => 'Round record: 1\n\n' + Array.from({ length: rounds }, (_, i) => `## Round ${i + 1}\n\nNo findings\n`).join('\n');
const v2 = (heads: string[]): string => 'Round record: 2\n\n' + heads.map((h, i) => `## Round ${i + 1} head ${h}\n\nNo findings\n`).join('\n');
/** The record history of T-1 as read from the checked-out branch; a history git could not read fails the test. */
function historyOf(repo: string): Exclude<ReturnType<typeof readHistory>, { error: string }> {
  const h = readHistory(repo, 'T-1', undefined, '0.4.0', DEF);
  if ('error' in h) throw new Error(h.error);
  return h;
}
const subject = (repo: string, sha: string): string => gitRun(repo, 'log', '-1', '--format=%s', sha).trim();

/** A repository on `main` holding T-1; the clone has no origin, so main is the default ref, and `origin/main` is faked where a reader asks for it. */
function start(): string {
  const repo = makeEmptyRepo();
  gitRun(repo, 'config', 'user.email', 'an@example.com');
  gitRun(repo, 'config', 'user.name', 'an');
  gitRun(repo, 'config', 'commit.gpgsign', 'false');
  writeFiles(repo, { 'accord/config.yml': config, 'accord/tickets/T-1.md': laneTicket('T-1'), 'src/base.ts': 'export const base = 1;\n' });
  commitMsg(repo, 'base');
  gitRun(repo, 'branch', '-M', 'main');
  return repo;
}

/** Main moves by one commit while the branch `t/T-1` is checked out; the branch is left checked out. */
function mainMoves(repo: string): void {
  gitRun(repo, 'switch', '-q', 'main');
  writeFiles(repo, { 'src/m.ts': 'export const m = 1;\n' });
  commitMsg(repo, 'main moves');
  gitRun(repo, 'switch', '-q', 't/T-1');
}

/** A GitHub-style squash of `t/T-1` into main; main is left checked out and the branch is kept. */
function squashIntoMain(repo: string): string {
  gitRun(repo, 'switch', '-q', 'main');
  gitRun(repo, 'merge', '--squash', '-q', 't/T-1');
  return commitMsg(repo, 'T-1 (#1)');
}

it('risk:regression S6 the ticket commit walk lists the same commits over a rebased and a squash-merged history (ST-LN-96 t1-ac-5)', () => {
  const repo = start();
  try {
    gitRun(repo, 'switch', '-q', '-c', 't/T-1');
    writeFiles(repo, { 'src/a.ts': 'export const a = 1;\n' });
    commitMsg(repo, 'code a');
    writeFiles(repo, { 'src/b.ts': 'export const b = 1;\n', 'src/a.ts': 'export const a = 2;\n' });
    commitMsg(repo, 'code b');
    const walkOf = () => {
      const w = readWalk(repo, { laneS: false, def: 'refs/heads/main', baseline: undefined });
      if ('error' in w) throw new Error(w.error);
      return w;
    };
    const filesOf = (w: ReturnType<typeof walkOf>) => w.order.map((sha) => [(w.commits.get(sha) as { files: string[] }).files, (w.commits.get(sha) as { parents: string[] }).parents.length]);
    const before = walkOf();
    expect(filesOf(before)).toEqual([[['src/a.ts', 'src/b.ts'], 1], [['src/a.ts'], 1]]);

    // a rebase onto a moved main replays the same two commits, with new shas and no merge commit
    mainMoves(repo);
    gitRun(repo, 'rebase', '-q', 'main');
    const afterRebase = walkOf();
    expect(afterRebase.order).toHaveLength(2);
    expect(afterRebase.order.some((sha) => before.order.includes(sha))).toBe(false);
    expect(filesOf(afterRebase)).toEqual(filesOf(before));

    // a squash merge of the rebased branch leaves the branch alone: it still lists its own commits, never main's squash commit
    const squash = squashIntoMain(repo);
    gitRun(repo, 'switch', '-q', 't/T-1');
    const afterSquash = walkOf();
    expect(afterSquash.order).toEqual(afterRebase.order);
    expect(afterSquash.order).not.toContain(squash);
  } finally {
    cleanup(repo);
  }
});

it('risk:regression S7 review rounds are counted over a rebased history and a squash-merged one (ST-LN-96 t1-ac-5)', () => {
  const repo = start();
  try {
    gitRun(repo, 'switch', '-q', '-c', 't/T-1');
    writeFiles(repo, { 'src/a.ts': 'export const a = 1;\n' });
    commitMsg(repo, 'code');
    writeFiles(repo, { [REVIEW]: v1(1) });
    commitMsg(repo, 'round 1');
    writeFiles(repo, { [REVIEW]: v1(2) });
    commitMsg(repo, 'round 2');
    const own = historyOf(repo);
    expect(own.rounds.map((s) => subject(repo, s))).toEqual(['round 1', 'round 2']);

    // a rebase onto a moved main rewrites the two round commits; each round is still found, at its own rewritten commit
    mainMoves(repo);
    gitRun(repo, 'rebase', '-q', 'main');
    const rebased = historyOf(repo);
    expect(rebased.rounds).toHaveLength(2);
    expect(rebased.rounds.map((s) => subject(repo, s))).toEqual(['round 1', 'round 2']);
    expect(rebased.rounds.some((s) => own.rounds.includes(s))).toBe(false);
    expect(rebased.pin).toBe('0.4.0');

    // main squash-merges the rebased branch: one commit with one parent adds review.md holding both rounds, and the branch is read as before
    const squash = squashIntoMain(repo);
    expect(historyOf(repo).rounds).toEqual([squash, squash]);
    gitRun(repo, 'switch', '-q', 't/T-1');
    expect(historyOf(repo).rounds).toEqual(rebased.rounds);
  } finally {
    cleanup(repo);
  }
});

it('risk:regression S12 a round head typed before a rebase is refused with the retype message, in a clone that still has the old commit and in one that has not (ST-LN-96 t1-ac-5)', () => {
  const repo = start();
  try {
    gitRun(repo, 'switch', '-q', '-c', 't/T-1');
    writeFiles(repo, { 'src/a.ts': 'export const a = 1;\n' });
    const c1 = commitMsg(repo, 'code');
    writeFiles(repo, { [REVIEW]: v2([c1]) });
    commitMsg(repo, 'round 1');
    const problems = (): string[] => {
      const snapshot = loadSnapshot(loadFromFs(repo));
      const facts = roundFactsFor(repo, snapshot, 'T-1');
      if (facts === undefined || 'error' in facts) throw new Error('facts: ' + JSON.stringify(facts));
      return scopeProblems({ ...snapshot, roundFacts: { 'T-1': facts } }, 'T-1').map((p) => p.reason);
    };
    expect(problems()).toEqual([]);

    mainMoves(repo);
    gitRun(repo, 'rebase', '-q', 'main');
    // the old commit is still in this clone's object store: its head is not in the rebased history
    const kept = problems();
    expect(kept).toHaveLength(1);
    expect(kept[0]).toContain(`head ${c1} is not between`);
    // a clone that never had it, or one that has collected it: the head names no commit, and the message says to retype it
    gitRun(repo, 'reflog', 'expire', '--expire=now', '--all');
    gitRun(repo, 'gc', '-q', '--prune=now');
    const gone = problems();
    expect(gone).toHaveLength(1);
    expect(gone[0]).toContain(`head ${c1} names no commit in this repository; after a rebase, retype each round's head`);
  } finally {
    cleanup(repo);
  }
});

it('risk:regression S13 a squash-merged done ticket whose branch was not deleted shows done and not in progress on the dashboard (ST-LN-96 t1-ac-5)', async () => {
  const c = copy();
  ticketWorktree(c, 'ST-9');
  const tips = doneOnRemote(c, ['ST-9'], { squash: true });
  c.git('fetch', '-q', 'origin');
  c.git('merge', '--ff-only', '-q', 'origin/main');
  // the branch is neither deleted here nor on the remote, and its tip is no ancestor of main
  expect(has(c.root, 'refs/heads/t/ST-9')).toBe(true);
  expect(has(c.remote, 'refs/heads/t/ST-9')).toBe(true);
  expect(() => c.git('merge-base', '--is-ancestor', tips['ST-9'], 'origin/main')).toThrow();
  const r = await run(['dashboard', '--json'], c.root);
  expect(r.code).toBe(0);
  const board = JSON.parse(r.out) as { yours: { rows: { id: string }[] }; team: { rows: { id: string }[] }; summary: { done: number } };
  expect([...board.yours.rows, ...board.team.rows].some((row) => row.id === 'ST-9')).toBe(false);
  expect(board.summary.done).toBe(1);
  const status = JSON.parse((await run(['status', '--json'], c.root)).out) as { id: string; stage: string }[];
  expect(status.find((row) => row.id === 'ST-9')?.stage).toBe('done');
}, 120_000);

it("risk:data-loss S16 a dropped ticket's squash-merged branch stays a cleanup candidate and is judged by its drop guards (ST-LN-96 t1-ac-5)", async () => {
  const squashed = (id: string) => {
    const c = copy();
    const tip = claimWorktree(c, id, { [`accord/tickets/${id}.md`]: laneTicket(id), 'src/a.ts': 'a\n' });
    const o = c.otherClone();
    gitRun(o, 'fetch', '-q', 'origin');
    gitRun(o, 'merge', '--squash', '-q', `origin/t/${id}`);
    commitMsg(o, 'squash ' + id);
    gitRun(o, 'push', '-q', 'origin', 'main');
    dropOnRemote(c, [id]);
    expect(() => c.git('merge-base', '--is-ancestor', tip, 'origin/main')).toThrow();
    return { c, tip };
  };
  // nothing is lost: both branches go, though the tip is on no merged list and in no ancestry of main
  const clean = squashed('ST-10');
  const a = await run(['worktree', 'clean'], clean.c.root);
  expect(a.code).toBe(0);
  expect(lines(a.out)).toEqual([`removed ${clean.c.sibling('ST-10')}`, `deleted origin/t/ST-10 (was ${clean.tip})`, `deleted t/ST-10 (was ${clean.tip})`]);
  expect(has(clean.c.root, 'refs/heads/t/ST-10')).toBe(false);
  // a commit on the local branch that origin lacks: the drop guard keeps it, so the squash did not make it look merged
  const guarded = squashed('ST-10');
  writeFiles(guarded.c.sibling('ST-10'), { 'more.txt': 'more\n' });
  const more = commitMsg(guarded.c.sibling('ST-10'), 'unpushed');
  const b = await run(['worktree', 'clean'], guarded.c.root);
  expect(b.code).toBe(0);
  expect(lines(b.out)).toEqual(['kept t/ST-10: 1 commits not on origin']);
  expect(existsSync(guarded.c.sibling('ST-10'))).toBe(true);
  expect(guarded.c.git('rev-parse', 'refs/heads/t/ST-10').trim()).toBe(more);
}, 120_000);

it('risk:regression S18 review-package leaves out main on a rebased branch, with no merge to exclude (ST-LN-96 t1-ac-5)', async () => {
  const repo = makeEmptyRepo();
  try {
    gitRun(repo, 'config', 'user.email', 'an@example.com');
    gitRun(repo, 'config', 'user.name', 'an');
    gitRun(repo, 'config', 'commit.gpgsign', 'false');
    writeFiles(repo, {
      'accord/config.yml': CONFIG,
      'accord/tickets/S-1.md': laneTicket('S-1', { lane: 'S', body: LANE_S_BODY + '\n## Scope\nsrc/b.ts\n' }),
      'src/a.ts': 'a\n',
    });
    commitMsg(repo, 'base');
    gitRun(repo, 'branch', '-M', 'main');
    gitRun(repo, 'switch', '-q', '-c', 't/S-1');
    writeFiles(repo, { 'src/b.ts': 'b\n' });
    commitMsg(repo, 'branch change');
    gitRun(repo, 'switch', '-q', 'main');
    writeFiles(repo, { 'src/main-only.ts': 'm\n' });
    commitMsg(repo, 'main only work');
    gitRun(repo, 'switch', '-q', 't/S-1');
    gitRun(repo, 'rebase', '-q', 'main');
    const r = await run(['review-package', 'S-1'], repo);
    expect(r.code).toBe(0);
    // a rebased branch is main plus its own commits: the exclusion count is equal, so the header names no "without <ref>"
    expect(r.out.split('\n')[0]).not.toContain('without');
    expect(r.out).toContain('branch change');
    expect(r.out).not.toContain('main only work');
    expect(r.out).not.toContain('src/main-only.ts');
    expect(r.out.slice(r.out.indexOf('## Diff'))).toContain('src/b.ts');
  } finally {
    cleanup(repo);
  }
}, 120_000);

it('risk:regression S20 the trailer scan reads the same branch commits after a rebase (ST-LN-96 t1-ac-5)', () => {
  const repo = start();
  try {
    gitRun(repo, 'switch', '-q', '-c', 't/T-1');
    writeFiles(repo, { 'src/a.ts': 'export const a = 1;\n' });
    commitMsg(repo, 'feat: a\n\nCo-Authored-By: Bot <bot@example.com>');
    writeFiles(repo, { 'src/b.ts': 'export const b = 1;\n' });
    commitMsg(repo, 'feat: b');
    gitRun(repo, 'update-ref', 'refs/remotes/origin/main', 'main');
    const messages = () => gitBranchCommits(repo).map((c) => c.message.trim());
    const before = messages();
    expect(before).toEqual(['feat: b', 'feat: a\n\nCo-Authored-By: Bot <bot@example.com>']);

    mainMoves(repo);
    gitRun(repo, 'update-ref', 'refs/remotes/origin/main', 'main');
    gitRun(repo, 'rebase', '-q', 'main');
    // the rewritten commits keep their messages and their order; main's own commit is not among them
    expect(messages()).toEqual(before);
    expect(gitBranchCommits(repo).every((c) => !c.message.includes('main moves'))).toBe(true);
  } finally {
    cleanup(repo);
  }
});

/** ST-9 claimed on `t/ST-9` by a teammate (`mine` or y@example.invalid), then rebased onto a moved main and pushed with a lease; the claim commit is rewritten. */
function rebasedClaim(c: Clone, mine: boolean): void {
  const o = teammate(c);
  gitRun(o, 'switch', '-q', '-c', 't/ST-9', 'main');
  gitRun(o, ...(mine ? ME : []), 'commit', '-q', '--allow-empty', '-m', 'claim: ST-9');
  writeFiles(o, { 'work.txt': 'w\n' });
  commitMsg(o, 'work');
  const old = gitRun(o, 'rev-parse', 'HEAD~1').trim();
  gitRun(o, 'push', '-q', 'origin', 't/ST-9');
  gitRun(o, 'switch', '-q', 'main');
  writeFiles(o, { 'next.txt': 'n\n' });
  commitMsg(o, 'next');
  gitRun(o, 'push', '-q', 'origin', 'main');
  gitRun(o, 'switch', '-q', 't/ST-9');
  gitRun(o, 'rebase', '-q', 'main');
  gitRun(o, 'push', '-q', '--force-with-lease', 'origin', 't/ST-9');
  const now = gitRun(o, 'rev-parse', 'HEAD~1').trim();
  expect(now).not.toBe(old);
  expect(gitRun(o, 'log', '-1', '--format=%s', now).trim()).toBe('claim: ST-9');
  c.git('fetch', '-q', 'origin');
}

it("risk:regression S23 a rebased claim commit still names its claimant by subject and author (ST-LN-96 t1-ac-5)", async () => {
  const own = copy();
  rebasedClaim(own, true);
  const reused = await run(['worktree', 'open', 'ST-9'], own.root);
  expect(reused.err).toBe('');
  expect(reused.code).toBe(0);
  expect(reused.out.split('\n').slice(0, 3)).toEqual(['stop: open a session in this folder and type the line below it', own.sibling('ST-9'), '/accord continue ST-9']);
  expect(own.git('rev-parse', 'refs/heads/t/ST-9').trim()).toBe(own.git('rev-parse', 'origin/t/ST-9').trim());
  const theirs = copy();
  rebasedClaim(theirs, false);
  const refused = await run(['worktree', 'open', 'ST-9'], theirs.root);
  expect(refused.code).toBe(2);
  expect(refused.err.startsWith('claimed: ST-9 by y@example.invalid')).toBe(true);
  expect(existsSync(theirs.sibling('ST-9'))).toBe(false);
}, 120_000);
