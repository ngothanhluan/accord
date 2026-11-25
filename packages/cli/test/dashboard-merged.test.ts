// Phase 15 D-17, D-29, D-21: one dashboard picture per repository. A ticket whose claim branch merged before verify sits under `mergedWaiting`, never as ready or as the pick-up
// suggestion, and a worktree cut before the merge prints the same rows as the main checkout. Real git in tmp sandboxes (the repo's own helpers); the merge state is read from git, never written.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, expect, it } from 'vitest';
import { CONFIG, discussFiles, PLAN, ready } from '../../../test/helpers/lane.js';
import type { Files } from '../../../test/helpers/lane.js';
import { cleanup, commitMsg, gitRun, makeEmptyRepo, mergeMsg, run, writeFiles } from './helpers/repo.js';

type Json = Record<string, unknown>;
type Row = { id: string; stage?: string; next?: string; claimedBy?: string };

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

