// Shared helpers of the ST-LN-55 clean tests (worktree-clean.test.ts): a done ticket on the remote, claimed worktrees, holds.
import { existsSync, lstatSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { approvedHash, gateReady, loadSnapshot, setFrontmatterKey } from '@accord-dev/accord-core';
import { CONFIG, laneTicket, PLAN } from '../../../../test/helpers/lane.js';
import { runCli } from '../../src/run.js';
import { commitMsg, gitRun, mergeMsg, writeFiles } from './repo.js';
import type { Clone } from './worktree.js';

export const DEAD = { tool: 'Claude Code', marker: 'sess-D', pid: 4141, start: 'S1', taken: '2026-10-18T00:00:00.000Z' };
export const LIVE = { tool: 'Claude Code', marker: 'sess-H', pid: 4242, start: 'S2', taken: '2026-10-18T00:00:00.000Z' };
/** The process table in which LIVE runs and DEAD does not. */
export const ALIVE = [
  { pid: process.pid, ppid: 1, start: 'self' },
  { pid: 4242, ppid: 1, start: 'S2' },
];

export const lines = (s: string): string[] => s.split('\n').filter((l) => l !== '');

export const has = (dir: string, ref: string): boolean => {
  try {
    gitRun(dir, 'rev-parse', '--verify', '-q', ref);
    return true;
  } catch {
    return false;
  }
};

/** Gone: nothing at all at the path, a dangling link included. */
export const gone = (p: string): boolean => lstatSync(p, { throwIfNoEntry: false }) === undefined;

const holdsFile = (c: Clone) => `${c.root}/.git/accord/holds`;
export function writeHolds(c: Clone, holds: object): void {
  mkdirSync(`${c.root}/.git/accord`, { recursive: true });
  writeFileSync(holdsFile(c), JSON.stringify(holds));
}
export const readHolds = (c: Clone): Record<string, unknown> => JSON.parse(readFileSync(holdsFile(c), 'utf8')) as Record<string, unknown>;

/** A worktree `t/<id>` with one commit pushed to the remote; returns that commit. */
export function claimWorktree(c: Clone, id: string, files: Record<string, string> = { [`${id}.txt`]: id + '\n' }): string {
  c.git('worktree', 'add', '-q', '-b', `t/${id}`, c.sibling(id), 'origin/main');
  writeFiles(c.sibling(id), files);
  const sha = commitMsg(c.sibling(id), id);
  gitRun(c.sibling(id), 'push', '-q', '-u', 'origin', `t/${id}`);
  return sha;
}

/** The ticket file as verify leaves it: every criterion ticked at verified commit `v`. */
function doneTicket(id: string, v: string): string {
  const t = loadSnapshot({ files: { 'accord/config.yml': CONFIG, ['accord/tickets/' + id + '.md']: laneTicket(id) }, tree: [] });
  const a = approvedHash(t.tickets[id]);
  const h = gateReady(t, id).acHash;
  return laneTicket(id, {
    frontmatter: ['approved_hash: "' + a + '"', 'ac_hash: "' + h + '"', 'verified: [ac-1, ac-2]', 'verified_hash: "' + h + '"', 'verified_commit: "' + v + '"'],
  });
}

/** A ticket at the verify stage, committed in `dir` through commitMsg. */
function verifyStage(dir: string, id: string): void {
  let text = laneTicket(id);
  const hash = approvedHash(loadSnapshot({ files: { 'accord/config.yml': CONFIG, ['accord/tickets/' + id + '.md']: text }, tree: [] }).tickets[id]);
  text = setFrontmatterKey(text, 'approved_hash', hash);
  writeFiles(dir, {
    ['accord/tickets/' + id + '.md']: text,
    ['accord/tickets/' + id + '/plan.md']: PLAN,
    ['accord/tickets/' + id + '/ledger.md']: '## Tasks\n- task 1 done abc1234\n- task 2 done abc1234\n',
    ['accord/tickets/' + id + '/review.md']: 'verdict: converged\n',
  });
  commitMsg(dir, 'review: ' + id);
}

/** Verify's commits on each ticket branch, then its merge into the remote main, from a teammate's clone; `c` does not fetch. */
export function doneOnRemote(c: Clone, ids: string[]): void {
  const o = c.otherClone();
  const refspecs: string[] = [];
  for (const id of ids) {
    const onBranch = has(o, `refs/remotes/origin/t/${id}`);
    if (onBranch) gitRun(o, 'switch', '-q', '--detach', `origin/t/${id}`);
    verifyStage(o, id);
    const v = gitRun(o, 'rev-parse', 'HEAD').trim();
    writeFiles(o, { [`accord/tickets/${id}.md`]: doneTicket(id, v) });
    const tip = commitMsg(o, 'verify: ' + id);
    if (onBranch) {
      refspecs.push(`${tip}:refs/heads/t/${id}`);
      gitRun(o, 'switch', '-q', 'main');
      mergeMsg(o, tip, 'merge ' + id);
    }
  }
  gitRun(o, 'push', '-q', 'origin', 'main', ...refspecs);
}

/** `run` of repo.ts, but the output sinks keep every write: a PassThrough read once returns only its 64 KiB buffer. */
export async function runWhole(argv: string[], cwd: string, stdin?: string): Promise<{ code: number; out: string; err: string }> {
  let existing = resolve(cwd);
  while (!existsSync(existing) && dirname(existing) !== existing) existing = dirname(existing);
  const root = realpathSync.native(existing);
  if (!root.startsWith(realpathSync.native(tmpdir())) || root === realpathSync.native(process.cwd())) {
    throw new Error('refusing to run accord outside a temporary sandbox: ' + cwd);
  }
  let out = '';
  let err = '';
  const sink = (add: (s: string) => void) =>
    ({
      write(chunk: string | Uint8Array): boolean {
        add(typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString('utf8'));
        return true;
      },
    }) as unknown as NodeJS.WritableStream;
  const code = await runCli(argv, {
    cwd,
    stdout: sink((s) => (out += s)),
    stderr: sink((s) => (err += s)),
    env: {},
    ...(stdin === undefined ? {} : { stdin }),
  });
  return { code, out, err };
}
