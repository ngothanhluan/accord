// Phase 15 D-17, D-29, D-21: one dashboard picture per repository. A ticket whose claim branch merged before verify sits under `mergedWaiting`, never as ready or as the pick-up
// suggestion, and a worktree cut before the merge prints the same rows as the main checkout. Real git in tmp sandboxes (the repo's own helpers); the merge state is read from git, never written.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, expect, it } from 'vitest';
import { CONFIG, discussFiles, laneTicket, P, PLAN, ready } from '../../../test/helpers/lane.js';
import type { Files } from '../../../test/helpers/lane.js';
import { cleanup, commitMsg, gitRun, makeEmptyRepo, mergeMsg, run, writeFiles } from './helpers/repo.js';

type Json = Record<string, unknown>;
type Row = { id: string; stage?: string; next?: string; claimedBy?: string; tasksDone?: number };

const made: string[] = [];
afterEach(() => {
  for (const dir of made.splice(0).reverse()) cleanup(dir);
});

/** An empty claim commit on a new branch t/<id>, authored by `author`; the checkout stays on that branch. */
function claimBranch(repo: string, id: string, author: string): void {
  gitRun(repo, 'switch', '-q', '-c', `t/${id}`);
  const folder = mkdtempSync(join(tmpdir(), 'accord-msg-'));
  try {
    const file = join(folder, 'msg.txt');
    writeFileSync(file, `claim: ${id}\n`);
    const env: NodeJS.ProcessEnv = { ...process.env };
    for (const k of ['GIT_AUTHOR_EMAIL', 'GIT_AUTHOR_NAME', 'GIT_COMMITTER_NAME', 'GIT_COMMITTER_EMAIL']) delete env[k];
    execFileSync('git', ['-c', `user.email=${author}`, '-c', 'user.name=who', '-c', 'commit.gpgsign=false', 'commit', '-q', '--allow-empty', '-F', file, '--cleanup=verbatim'], { cwd: repo, env, stdio: ['ignore', 'pipe', 'pipe'] });
  } finally {
    cleanup(folder);
  }
}

/** main holds T-1 (ready, with its two-task plan) and T-2 (ready, no plan); `origin/main` is faked at main's tip, as a clone that fetched it. */
function base(): string {
  const repo = makeEmptyRepo();
  made.push(repo);
  gitRun(repo, 'symbolic-ref', 'HEAD', 'refs/heads/main');
  gitRun(repo, 'config', 'user.email', 'v@x.io');
  gitRun(repo, 'config', 'user.name', 'viewer');
  const files: Files = { 'accord/config.yml': CONFIG, ...discussFiles('T-1', 'T-2') };
  ready(files, 'T-1');
  files['accord/tickets/T-1/plan.md'] = PLAN;
  ready(files, 'T-2');
  writeFiles(repo, files);
  commitMsg(repo, 'add tickets');
  gitRun(repo, 'update-ref', 'refs/remotes/origin/main', 'HEAD');
  return repo;
}

/** The claim branch t/T-1 with both tasks done and the review converged, as the build and review stages leave it; the checkout is on it. */
function buildOnBranch(repo: string): void {
  claimBranch(repo, 'T-1', 'a@x.io');
  writeFiles(repo, {
    'accord/tickets/T-1/ledger.md': '## Tasks\n- task 1 done abc1234\n- task 2 done abc1234\n',
    'accord/tickets/T-1/review.md': 'verdict: converged\n',
  });
  commitMsg(repo, 'build: T-1');
  gitRun(repo, 'switch', '-q', 'main');
}

const dash = async (dir: string): Promise<Json> => {
  const r = await run(['dashboard', '--json', '--no-fetch'], dir);
  expect(r.code, r.err).toBe(0);
  return JSON.parse(r.out) as Json;
};
const rows = (d: Json, section: string): Row[] => ((d[section] as { rows?: Row[] } | undefined)?.rows ?? []);
const ids = (d: Json, section: string): string[] => rows(d, section).map((r) => r.id);

// Phase 15 D-29, RESEARCH 3.4 scenario A: the code merged, the branch was deleted by the host, verify is still to do.
it('risk:regression a merged ticket whose branch is gone is listed under mergedWaiting and never offered as ready or as a pick-up (D-29)', async () => {
  const repo = base();
  buildOnBranch(repo);
  mergeMsg(repo, 't/T-1', 'Merge pull request #1 from t/T-1');
  gitRun(repo, 'update-ref', 'refs/remotes/origin/main', 'HEAD');
  gitRun(repo, 'branch', '-D', 't/T-1');

  const d = await dash(repo);
  expect(ids(d, 'mergedWaiting')).toEqual(['T-1']);
  expect(rows(d, 'mergedWaiting')[0]).toMatchObject({ stage: 'verify' });
  for (const section of ['yours', 'team', 'ready', 'upNext']) expect(ids(d, section), section).not.toContain('T-1');
  // the pick-up suggestion never names it: it is absent or names the one ticket that really waits
  expect((d.upNext as { suggest?: { id: string } }).suggest?.id).not.toBe('T-1');
  expect(ids(d, 'ready')).toEqual(['T-2']);
  // D-21: the merge state is read, never written: the ticket file is what the merge brought
  expect(gitRun(repo, 'status', '--short').trim()).toBe('');
}, 120_000);

const SECTIONS = ['mergedWaiting', 'yours', 'team', 'ready', 'upNext'] as const;
const everyId = (d: Json): string[] => SECTIONS.flatMap((s) => ids(d, s));
const rowOf = (d: Json, id: string): Row | undefined => SECTIONS.flatMap((s) => rows(d, s)).find((r) => r.id === id);

/** A second worktree on a new branch `other-work`, cut at `rev` (a sibling folder in the temp area, as the sandbox guard requires). */
function cutAt(repo: string, rev: string, suffix = '-stale'): string {
  const dir = repo + suffix;
  made.push(dir);
  gitRun(repo, 'worktree', 'add', '-q', '-b', 'other-work', dir, rev);
  return dir;
}

/** The merge of t/T-1 into main as the host makes it, and `origin/main` moved to it. `kind`: a merge commit, or a squash that leaves the branch with other commits. */
function mergeIn(repo: string, kind: 'merge' | 'squash'): void {
  if (kind === 'merge') mergeMsg(repo, 't/T-1', 'Merge pull request #1 from t/T-1');
  else {
    gitRun(repo, 'merge', '--squash', 't/T-1');
    commitMsg(repo, 'T-1 export (#1)');
  }
  gitRun(repo, 'update-ref', 'refs/remotes/origin/main', 'HEAD');
}

// Phase 15 D-17, RESEARCH 3.4 scenarios B1 and B2: the main checkout and a worktree cut before the merge are one repository, so they print one picture.
it('risk:regression a worktree cut before the merge prints the same rows as the main checkout, with the branch gone or kept (D-17)', async () => {
  for (const kept of [false, true]) {
    const repo = base();
    const stale = cutAt(repo, 'HEAD', kept ? '-kept' : '-gone');
    buildOnBranch(repo);
    mergeIn(repo, 'merge');
    if (!kept) gitRun(repo, 'branch', '-D', 't/T-1');

    const main = await dash(repo);
    const old = await dash(stale);
    for (const section of SECTIONS) expect(rows(old, section).map((r) => [r.id, r.stage]), `${section} kept=${kept}`).toEqual(rows(main, section).map((r) => [r.id, r.stage]));
    expect(ids(old, 'mergedWaiting'), `kept=${kept}`).toEqual(['T-1']);
    expect(ids(old, 'ready'), `kept=${kept}`).toEqual(['T-2']);
    expect((old.upNext as { suggest?: { id: string } }).suggest?.id).not.toBe('T-1');
  }
}, 180_000);

// RESEARCH 3.4 scenario C1: a squash merge leaves the claim branch unmerged by ancestry; its records equal the default ref's.
it('risk:regression a squash-merged ticket whose branch is kept is merged by its record blobs, not yours or the team\'s (D-29)', async () => {
  const repo = base();
  buildOnBranch(repo);
  mergeIn(repo, 'squash');
  const d = await dash(repo);
  expect(ids(d, 'mergedWaiting')).toEqual(['T-1']);
  expect(rowOf(d, 'T-1')).toMatchObject({ stage: 'verify', claimedBy: 'v@x.io' }); // the viewer built it: even so it is not under yours
  for (const section of ['yours', 'team', 'ready', 'upNext']) expect(ids(d, section), section).not.toContain('T-1');
  expect(gitRun(repo, 'for-each-ref', '--format=%(refname)', 'refs/heads').split('\n').filter((l) => l !== '')).toEqual(['refs/heads/main', 'refs/heads/t/T-1']);
}, 120_000);

// RESEARCH 3.4 scenario C2: a squash merge and the host deleted the branch: nothing but the default ref's records say it merged (D-29 gone branch).
it('risk:regression a squash-merged ticket with no branch left is listed by the default ref\'s records showing review or verify (D-29)', async () => {
  const repo = base();
  buildOnBranch(repo);
  mergeIn(repo, 'squash');
  gitRun(repo, 'branch', '-D', 't/T-1');
  const d = await dash(repo);
  expect(ids(d, 'mergedWaiting')).toEqual(['T-1']);
  expect(rowOf(d, 'T-1')).toMatchObject({ stage: 'verify' });
  expect((d.upNext as { suggest?: { id: string } }).suggest?.id).not.toBe('T-1');
  // a ticket that stands at plan on the default ref with no branch is only ready: the gone-branch rule needs review or verify
  expect(ids(d, 'ready')).toEqual(['T-2']);
}, 120_000);

// D-17: the base is the default ref for every ticket but the checkout's own; the own ticket is what this worktree's files say.
it('risk:complex-branching the checkout\'s own ticket reads its stage from its own files and nobody else sees an uncommitted tick (D-17)', async () => {
  const repo = base();
  claimBranch(repo, 'T-1', 'a@x.io');
  writeFiles(repo, { 'accord/tickets/T-1/ledger.md': '## Tasks\n- task 1 done abc1234\n' });
  commitMsg(repo, 'build: T-1 task 1');
  gitRun(repo, 'switch', '-q', 'main');
  const wt = repo + '-own';
  made.push(wt);
  gitRun(repo, 'worktree', 'add', '-q', wt, 't/T-1');
  writeFiles(wt, { 'accord/tickets/T-1/ledger.md': '## Tasks\n- task 1 done abc1234\n- task 2 done abc1234\n' }); // an uncommitted tick

  const own = await dash(wt);
  const main = await dash(repo);
  expect(rowOf(own, 'T-1')?.tasksDone).toBe(2);
  expect(rowOf(main, 'T-1')?.tasksDone).toBe(1);
  // every other ticket is the same from both
  for (const id of ['T-2']) expect(rowOf(own, id), id).toEqual(rowOf(main, id));
}, 120_000);

it('risk:regression an unmerged claim shows in the same group from every worktree and a fresh claim is not taken for a merged one (D-17, T-15-07)', async () => {
  const repo = base();
  const stale = cutAt(repo, 'HEAD');
  claimBranch(repo, 'T-2', 'a@x.io'); // only the claim commit: its records equal the default ref's, and it has built nothing
  gitRun(repo, 'switch', '-q', 'main');
  const main = await dash(repo);
  const old = await dash(stale);
  expect(ids(main, 'team')).toEqual(['T-2']);
  expect(ids(main, 'mergedWaiting')).toEqual([]);
  for (const section of SECTIONS) expect(ids(old, section), section).toEqual(ids(main, section));
}, 120_000);

// Ruling R3: a ticket file only this checkout holds (an unpublished draft) keeps showing from it.
it('risk:regression a ticket file only this checkout holds keeps showing there and nowhere else (R3)', async () => {
  const repo = base();
  const stale = cutAt(repo, 'HEAD');
  writeFiles(repo, { [P('T-9')]: laneTicket('T-9') });
  expect(everyId(await dash(repo))).toContain('T-9');
  expect(everyId(await dash(stale))).not.toContain('T-9');
}, 120_000);
