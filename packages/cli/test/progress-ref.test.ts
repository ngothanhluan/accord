// Phase 15 D-12 to D-15, D-33 (15-09): `accord worktree push <id>` sends the claim branch's commits to refs/accord/<id>, a ref that is not a branch and starts no CI, and only
// where `progress.push` allows it. Every origin here is a bare repository in a temporary folder: no test touches a network or a real host.
import { expect, it } from 'vitest';
import { CONFIG } from '../../../test/helpers/lane.js';
import { commitMsg, gitRun, run, writeFiles } from './helpers/repo.js';
import { nextLine } from '../src/commands/next-action.js';
import { makeClone, verifyStage, type Clone } from './helpers/worktree.js';

/** The claim worktree of ST-9 with the claim branch pushed, then `accord/config.yml` set to `extra` in one local commit (not pushed). */
function claimed(c: Clone, extra: string): string {
  c.git('worktree', 'add', '-q', '-b', 't/ST-9', c.sibling('ST-9'), 'origin/main');
  const wt = c.sibling('ST-9');
  writeFiles(wt, { 'src/export.ts': 'export const write = 1;\n' });
  commitMsg(wt, 'claim: ST-9');
  gitRun(wt, 'push', '-q', '-u', 'origin', 't/ST-9');
  if (extra !== '') {
    writeFiles(wt, { 'accord/config.yml': CONFIG + extra });
    commitMsg(wt, 'config: progress push');
  }
  writeFiles(wt, { 'notes.txt': 'notes\n' });
  commitMsg(wt, 'build: ST-9 task 1');
  return wt;
}

const REF = 'progress:\n  push: ref\n';
const NOTE = (value: string) => `progress not pushed: progress.push is ${value} for this origin; it reaches origin at verify\n`;
const FAILED = 'push of refs/accord/ST-9 failed; its progress stays local until the next push - ' + nextLine('push-failed');
const head = (dir: string) => gitRun(dir, 'rev-parse', 'HEAD').trim();
const branchOnOrigin = (c: Clone) => gitRun(c.remote, 'rev-parse', 'refs/heads/t/ST-9').trim();
const refOnOrigin = (c: Clone): string | undefined => {
  try {
    return gitRun(c.remote, 'rev-parse', '--verify', '-q', 'refs/accord/ST-9').trim();
  } catch {
    return undefined;
  }
};

it('risk:regression with progress.push ref a stage push lands on refs/accord/<id> and the claim branch on origin does not move (D-12, D-14)', async () => {
  const c = makeClone();
  try {
    const wt = claimed(c, REF);
    const claimTip = branchOnOrigin(c);
    expect(claimTip).not.toBe(head(wt));

    const r = await run(['worktree', 'push', 'ST-9'], wt);
    expect(r).toEqual({ code: 0, out: 'pushed: refs/accord/ST-9\n', err: '' });
    expect(refOnOrigin(c)).toBe(head(wt));
    expect(branchOnOrigin(c)).toBe(claimTip);
  } finally {
    c.cleanupAll();
  }
}, 120_000);

it('risk:regression with progress.push absent a stage push sends nothing to origin and prints one note line, exit 0 (D-12, D-33)', async () => {
  const c = makeClone();
  try {
    const wt = claimed(c, '');
    const claimTip = branchOnOrigin(c);
    expect(await run(['worktree', 'push', 'ST-9'], wt)).toEqual({ code: 0, out: NOTE('off'), err: '' });
    expect(refOnOrigin(c)).toBeUndefined();
    expect(branchOnOrigin(c)).toBe(claimTip);
  } finally {
    c.cleanupAll();
  }
}, 120_000);

it('risk:regression progress.push off sends nothing and auto sends nothing to a host no test proved (D-12, D-13, D-33)', async () => {
  for (const value of ['off', 'auto']) {
    const c = makeClone();
    try {
      const wt = claimed(c, `progress:\n  push: ${value}\n`);
      const claimTip = branchOnOrigin(c);
      expect(await run(['worktree', 'push', 'ST-9'], wt)).toEqual({ code: 0, out: NOTE(value), err: '' });
      expect(refOnOrigin(c)).toBeUndefined();
      expect(branchOnOrigin(c)).toBe(claimTip);
    } finally {
      c.cleanupAll();
    }
  }
}, 120_000);

it('risk:regression a ref push that fails prints the failure line and git text and exits 0, and the next push carries the progress (D-15)', async () => {
  const c = makeClone();
  try {
    const wt = claimed(c, REF);
    c.git('remote', 'set-url', 'origin', c.remote + '-missing');
    const r = await run(['worktree', 'push', 'ST-9'], wt);
    expect(r.code).toBe(0);
    expect(r.err).toBe('');
    expect(r.out.startsWith(FAILED + '\n')).toBe(true);
    expect(r.out.slice(FAILED.length + 1)).toContain('does not appear to be a git repository');
    expect(refOnOrigin(c)).toBeUndefined();

    c.git('remote', 'set-url', 'origin', c.remote);
    expect(await run(['worktree', 'push', 'ST-9'], wt)).toEqual({ code: 0, out: 'pushed: refs/accord/ST-9\n', err: '' });
    expect(refOnOrigin(c)).toBe(head(wt));
  } finally {
    c.cleanupAll();
  }
}, 120_000);

it('risk:regression the ref is forced, so a push after a reworded commit replaces it (R8)', async () => {
  const c = makeClone();
  try {
    const wt = claimed(c, REF);
    expect((await run(['worktree', 'push', 'ST-9'], wt)).code).toBe(0);
    const first = head(wt);
    gitRun(wt, 'commit', '-q', '--amend', '-m', 'build: ST-9 task 1 reworded');
    expect(head(wt)).not.toBe(first);
    expect(await run(['worktree', 'push', 'ST-9'], wt)).toEqual({ code: 0, out: 'pushed: refs/accord/ST-9\n', err: '' });
    expect(refOnOrigin(c)).toBe(head(wt));
  } finally {
    c.cleanupAll();
  }
}, 120_000);

it('risk:regression --branch pushes the claim branch whatever progress.push says and leaves no ref (D-13)', async () => {
  for (const extra of ['', 'progress:\n  push: off\n', REF]) {
    const c = makeClone();
    try {
      const wt = claimed(c, extra);
      expect(await run(['worktree', 'push', 'ST-9', '--branch'], wt)).toEqual({ code: 0, out: 'pushed: t/ST-9\n', err: '' });
      expect(branchOnOrigin(c)).toBe(head(wt));
      expect(refOnOrigin(c)).toBeUndefined();
    } finally {
      c.cleanupAll();
    }
  }
}, 120_000);

it('risk:data-loss --force-with-lease applies to the --branch push only, and the ref push is not refused for it (R8)', async () => {
  const c = makeClone();
  try {
    const wt = claimed(c, REF);
    expect((await run(['worktree', 'push', 'ST-9', '--branch'], wt)).code).toBe(0);
    gitRun(wt, 'commit', '-q', '--amend', '-m', 'build: ST-9 task 1 reworded');
    // a plain branch push of a reworded commit is refused; the lease replaces it
    const plain = await run(['worktree', 'push', 'ST-9', '--branch'], wt);
    expect(plain.out).toContain('[rejected]');
    expect(branchOnOrigin(c)).not.toBe(head(wt));
    expect(await run(['worktree', 'push', 'ST-9', '--branch', '--force-with-lease'], wt)).toEqual({ code: 0, out: 'pushed: t/ST-9\n', err: '' });
    expect(branchOnOrigin(c)).toBe(head(wt));
    expect(await run(['worktree', 'push', 'ST-9', '--force-with-lease'], wt)).toEqual({ code: 0, out: 'pushed: refs/accord/ST-9\n', err: '' });
    expect(refOnOrigin(c)).toBe(head(wt));
  } finally {
    c.cleanupAll();
  }
}, 120_000);

it('risk:security a commit with a forbidden line is not sent to the progress ref either (D-15)', async () => {
  const c = makeClone();
  try {
    const wt = claimed(c, REF + 'commits:\n  trailers: forbid\n');
    writeFiles(wt, { 'more.txt': 'more\n' });
    commitMsg(wt, 'build: ST-9 task 2\n\nCo-Authored-By: Bot <bot@example.com>');
    const r = await run(['worktree', 'push', 'ST-9'], wt);
    expect(r.code).toBe(0);
    expect(r.out.startsWith(FAILED + '\n')).toBe(true);
    expect(r.out).toContain('Co-Authored-By');
    expect(refOnOrigin(c)).toBeUndefined();
  } finally {
    c.cleanupAll();
  }
}, 120_000);

it('risk:security a ticket id that is not a plain id never reaches a ref name (T-15-20)', async () => {
  const c = makeClone();
  try {
    const wt = claimed(c, REF);
    const r = await run(['worktree', 'push', 'ST-9/../x'], wt);
    expect(r.code).toBe(2);
    expect(refOnOrigin(c)).toBeUndefined();
  } finally {
    c.cleanupAll();
  }
}, 120_000);

// Phase 15 D-15 (15-10): a teammate's `accord dashboard` fetches refs/accord/* into refs/remotes/origin-accord/* itself, and shows the progress from there.
type Row = { id: string; claimedBy?: string; stage?: string; tasksDone?: number; tasksTotal?: number };
const rowOf = async (dir: string, id: string): Promise<Row | undefined> => {
  const d = JSON.parse((await run(['dashboard', '--json'], dir)).out) as { yours: { rows: Row[] }; team: { rows: Row[] } };
  return [...d.yours.rows, ...d.team.rows].find((r) => r.id === id);
};
/** A teammate's clone: its own address, so a claim by `fixture@example.invalid` is the team's, not its own. */
const teammate = (c: Clone): string => {
  const b = c.otherClone();
  gitRun(b, 'config', 'user.email', 'b@example.com');
  return b;
};

it('risk:regression a teammate dashboard shows the progress pushed to refs/accord/<id> with nothing to configure, and a second push moves it (D-15, SC-5)', async () => {
  const c = makeClone();
  try {
    const wt = claimed(c, REF);
    const b = teammate(c);
    const before = await rowOf(b, 'ST-9');
    expect(before?.claimedBy).toBe('fixture@example.invalid');
    expect(before?.tasksDone ?? 0).toBe(0);

    verifyStage(wt, 'ST-9', { review: false });
    expect(await run(['worktree', 'push', 'ST-9'], wt)).toEqual({ code: 0, out: 'pushed: refs/accord/ST-9\n', err: '' });
    expect(branchOnOrigin(c)).not.toBe(head(wt));
    const first = await rowOf(b, 'ST-9');
    expect(first?.claimedBy).toBe('fixture@example.invalid');
    expect(first?.tasksDone).toBe(2);
    expect(gitRun(b, 'rev-parse', 'refs/remotes/origin-accord/ST-9').trim()).toBe(head(wt));
    expect(gitRun(b, 'config', '--get-all', 'remote.origin.fetch').trim()).toBe('+refs/heads/*:refs/remotes/origin/*');

    writeFiles(wt, { 'accord/tickets/ST-9/review.md': 'verdict: converged\n' });
    commitMsg(wt, 'review: ST-9');
    expect((await run(['worktree', 'push', 'ST-9'], wt)).code).toBe(0);
    const second = await rowOf(b, 'ST-9');
    expect(second?.stage).not.toBe(first?.stage);
    expect(gitRun(b, 'rev-parse', 'refs/remotes/origin-accord/ST-9').trim()).toBe(head(wt));
  } finally {
    c.cleanupAll();
  }
}, 180_000);
