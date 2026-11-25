// Phase 15 D-12 to D-15, D-33 (15-09): `accord worktree push <id>` sends the claim branch's commits to refs/accord/<id>, a ref that is not a branch and starts no CI, and only
// where `progress.push` allows it. Every origin here is a bare repository in a temporary folder: no test touches a network or a real host.
import { chmodSync, writeFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { CONFIG } from '../../../test/helpers/lane.js';
import { commitMsg, gitRun, run, writeFiles } from './helpers/repo.js';
import { nextLine } from '../src/commands/next-action.js';
import { claimWorktree, doneOnRemote, dropOnRemote, has, lines, makeClone, ticketWorktree, verifyStage, withAction, type Clone } from './helpers/worktree.js';

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

const onOrigin = (c: Clone, ref: string): string | undefined => {
  try {
    return gitRun(c.remote, 'rev-parse', '--verify', '-q', ref).trim();
  } catch {
    return undefined;
  }
};
/** A progress ref written straight into the bare origin: what a teammate's `worktree push` leaves there. */
const setProgress = (c: Clone, id: string, value: string): void => void gitRun(c.remote, 'update-ref', `refs/accord/${id}`, value);
/** The bare origin refuses every deletion of a progress ref (a hook), as a host with a protected namespace would. */
const refuseProgressDeletes = (c: Clone): void => {
  const hook = `${c.remote}/hooks/pre-receive`;
  writeFileSync(hook, '#!/bin/sh\nwhile read old new ref; do case "$ref" in refs/accord/*) echo "progress refs are protected" >&2; exit 1;; esac; done\nexit 0\n');
  chmodSync(hook, 0o755);
};

it('risk:security a progress ref with no claim branch makes no claim, and one that is not ahead of the claim branch is not read (D-15, T-15-23)', async () => {
  const c = makeClone();
  try {
    // no claim branch anywhere: the ref only exists
    setProgress(c, 'ST-9', onOrigin(c, 'refs/heads/main') as string);
    const b = teammate(c);
    expect(await rowOf(b, 'ST-9')).toBeUndefined();
    expect(has(b, 'refs/remotes/origin-accord/ST-9')).toBe(true);

    // a claim branch, and a progress ref that does not descend from its tip: the claim branch's records win
    claimed(c, '');
    const o = teammate(c);
    gitRun(o, 'switch', '-q', '-c', 'elsewhere', 'origin/main');
    verifyStage(o, 'ST-9', { review: false });
    gitRun(o, 'push', '-q', '-f', 'origin', 'HEAD:refs/accord/ST-9');
    const row = await rowOf(teammate(c), 'ST-9');
    expect(row?.claimedBy).toBe('fixture@example.invalid');
    expect(row?.tasksDone ?? 0).toBe(0);
  } finally {
    c.cleanupAll();
  }
}, 180_000);

/** Ticket ST-9 done on origin's main with its branch worktree still here, and `refs/accord/ST-9` on origin at the branch's verified tip. */
function doneWithProgress(c: Clone): { local: string; tip: string } {
  ticketWorktree(c, 'ST-9');
  const local = gitRun(c.sibling('ST-9'), 'rev-parse', 'HEAD').trim();
  doneOnRemote(c, ['ST-9']);
  const tip = onOrigin(c, 'refs/heads/t/ST-9') as string;
  setProgress(c, 'ST-9', tip);
  return { local, tip };
}

it('risk:data-loss clean deletes refs/accord/<id> on origin and the local copy with the done ticket branches and prints the line (D-15)', async () => {
  const c = makeClone();
  try {
    const { local, tip } = doneWithProgress(c);
    const r = await run(['worktree', 'clean'], c.root);
    expect(r.code).toBe(0);
    expect(lines(r.out)).toEqual([
      withAction(`removed ${c.sibling('ST-9')}`),
      withAction(`deleted t/ST-9 (was ${local})`),
      withAction(`deleted origin/t/ST-9 (was ${tip})`),
      withAction(`deleted origin refs/accord/ST-9 (was ${tip})`),
    ]);
    expect(onOrigin(c, 'refs/accord/ST-9')).toBeUndefined();
    expect(has(c.root, 'refs/remotes/origin-accord/ST-9')).toBe(false);
    expect((await run(['worktree', 'clean'], c.root)).out).toBe('');
  } finally {
    c.cleanupAll();
  }
}, 180_000);

it('risk:data-loss clean deletes the progress ref when the host already deleted the origin branch, and drops a copy origin no longer holds (D-15)', async () => {
  const c = makeClone();
  try {
    const { tip } = doneWithProgress(c);
    gitRun(c.remote, 'update-ref', '-d', 'refs/heads/t/ST-9');
    const r = await run(['worktree', 'clean'], c.root);
    expect(lines(r.out).filter((l) => l.includes('refs/accord'))).toEqual([withAction(`deleted origin refs/accord/ST-9 (was ${tip})`)]);
    expect(onOrigin(c, 'refs/accord/ST-9')).toBeUndefined();
    expect(has(c.root, 'refs/remotes/origin-accord/ST-9')).toBe(false);
  } finally {
    c.cleanupAll();
  }

  // another clone cleaned it first and this clone's fetch does not prune: the stale copy goes, with a plain line
  const d = makeClone();
  try {
    const { tip } = doneWithProgress(d);
    gitRun(d.root, 'fetch', '-q', 'origin', '+refs/accord/*:refs/remotes/origin-accord/*');
    gitRun(d.remote, 'update-ref', '-d', 'refs/accord/ST-9');
    const r = await run(['worktree', 'clean'], d.root);
    expect(lines(r.out)).toContain(`pruned refs/remotes/origin-accord/ST-9 (was ${tip})`);
    expect(has(d.root, 'refs/remotes/origin-accord/ST-9')).toBe(false);
  } finally {
    d.cleanupAll();
  }
}, 180_000);

it('risk:data-loss origin refusing the progress ref delete is one kept line, exit 0, and the ref stays (D-15)', async () => {
  const c = makeClone();
  try {
    const { tip } = doneWithProgress(c);
    refuseProgressDeletes(c);
    const r = await run(['worktree', 'clean'], c.root);
    expect(r.code).toBe(0);
    const kept = lines(r.out).filter((l) => l.startsWith('kept origin refs/accord/ST-9: git push failed: '));
    expect(kept).toHaveLength(1);
    expect(kept[0]).toContain('progress refs are protected');
    expect(lines(r.out)).toContain(withAction(`deleted origin/t/ST-9 (was ${tip})`));
    expect(onOrigin(c, 'refs/accord/ST-9')).toBe(tip);
    expect(has(c.root, 'refs/remotes/origin-accord/ST-9')).toBe(true);
  } finally {
    c.cleanupAll();
  }
}, 180_000);

it('risk:data-loss clean --dry-run prints the progress ref deletion and deletes nothing (D-15)', async () => {
  const c = makeClone();
  try {
    const { tip } = doneWithProgress(c);
    gitRun(c.root, 'fetch', '-q', 'origin', '+refs/accord/*:refs/remotes/origin-accord/*');
    const r = await run(['worktree', 'clean', '--dry-run'], c.root);
    expect(r.code).toBe(0);
    expect(lines(r.out)).toContain(withAction(`deleted origin refs/accord/ST-9 (was ${tip})`));
    expect(onOrigin(c, 'refs/accord/ST-9')).toBe(tip);
    expect(has(c.root, 'refs/remotes/origin-accord/ST-9')).toBe(true);
  } finally {
    c.cleanupAll();
  }
}, 180_000);

it('risk:data-loss clean keeps a progress ref with commits after the ticket verified commit (D-15)', async () => {
  const c = makeClone();
  try {
    const { tip } = doneWithProgress(c);
    const o = c.otherClone();
    gitRun(o, 'switch', '-q', '-c', 'more', 'origin/t/ST-9');
    writeFiles(o, { 'later.txt': 'later\n' });
    commitMsg(o, 'later work');
    gitRun(o, 'push', '-q', '-f', 'origin', 'HEAD:refs/accord/ST-9');
    const later = gitRun(o, 'rev-parse', 'HEAD').trim();
    const r = await run(['worktree', 'clean'], c.root);
    expect(lines(r.out)).toContain(withAction('kept origin refs/accord/ST-9: it has commits after its verified commit'));
    expect(lines(r.out)).toContain(withAction(`deleted origin/t/ST-9 (was ${tip})`));
    expect(onOrigin(c, 'refs/accord/ST-9')).toBe(later);
  } finally {
    c.cleanupAll();
  }
}, 180_000);

it('risk:data-loss clean deletes the progress ref of a dropped ticket with its branches, and keeps one that holds commits no branch has (D-15)', async () => {
  const c = makeClone();
  try {
    const tip = claimWorktree(c, 'ST-9');
    dropOnRemote(c, ['ST-9']);
    setProgress(c, 'ST-9', onOrigin(c, 'refs/heads/t/ST-9') as string);
    const r = await run(['worktree', 'clean'], c.root);
    expect(lines(r.out)).toEqual([
      withAction(`removed ${c.sibling('ST-9')}`),
      withAction(`deleted origin/t/ST-9 (was ${tip})`),
      withAction(`deleted origin refs/accord/ST-9 (was ${tip})`),
      withAction(`deleted t/ST-9 (was ${tip})`),
    ]);
    expect(onOrigin(c, 'refs/accord/ST-9')).toBeUndefined();
    expect(has(c.root, 'refs/remotes/origin-accord/ST-9')).toBe(false);
  } finally {
    c.cleanupAll();
  }

  const d = makeClone();
  try {
    const tip = claimWorktree(d, 'ST-9');
    dropOnRemote(d, ['ST-9']);
    const o = d.otherClone();
    gitRun(o, 'switch', '-q', '-c', 'more', 'origin/t/ST-9');
    writeFiles(o, { 'later.txt': 'later\n' });
    const later = commitMsg(o, 'later work');
    gitRun(o, 'push', '-q', 'origin', 'HEAD:refs/accord/ST-9');
    const r = await run(['worktree', 'clean'], d.root);
    expect(lines(r.out)).toContain(withAction(`deleted origin/t/ST-9 (was ${tip})`));
    expect(lines(r.out)).toContain(withAction('kept origin refs/accord/ST-9: it has commits not on t/ST-9'));
    expect(onOrigin(d, 'refs/accord/ST-9')).toBe(later);
  } finally {
    d.cleanupAll();
  }
}, 180_000);

const IDLE = new Date(Date.now() - 21 * 24 * 3600 * 1000);
/** A local claim branch t/T-1 never pushed, its tip 21 days old, in a clone whose origin is a bare repository. */
function unpushedClaim(): Clone {
  const c = makeClone({ tickets: ['T-1'] });
  gitRun(c.root, 'switch', '-q', '-c', 't/T-1');
  commitMsg(c.root, 'claim: T-1', IDLE, true);
  gitRun(c.root, 'switch', '-q', 'main');
  return c;
}
const unpushedGaps = async (c: Clone): Promise<string[]> => (await run(['audit'], c.root)).out.split('\n').filter((l) => l.startsWith('gap: claim-unpushed:'));

it('risk:regression audit counts a claim whose tip is on the progress ref as pushed, and still reports one the ref does not hold (D-15)', async () => {
  const c = unpushedClaim();
  try {
    expect(await unpushedGaps(c)).toHaveLength(1);
    gitRun(c.root, 'push', '-q', 'origin', 't/T-1:refs/accord/T-1');
    gitRun(c.root, 'fetch', '-q', 'origin', '+refs/accord/*:refs/remotes/origin-accord/*');
    expect(await unpushedGaps(c)).toEqual([]);

    // the ref is behind the tip: the newest commit has not reached origin
    gitRun(c.root, 'switch', '-q', 't/T-1');
    commitMsg(c.root, 'build: T-1 task 1', IDLE, true);
    gitRun(c.root, 'switch', '-q', 'main');
    expect(await unpushedGaps(c)).toHaveLength(1);
  } finally {
    c.cleanupAll();
  }
}, 180_000);

it('risk:regression a clone configured to fetch one branch keeps that refspec: the fetch adds the progress refs and no other branch (D-15)', async () => {
  const c = makeClone();
  try {
    const b = teammate(c);
    gitRun(b, 'config', '--replace-all', 'remote.origin.fetch', '+refs/heads/main:refs/remotes/origin/main');
    const wt = claimed(c, REF);
    expect((await run(['worktree', 'push', 'ST-9'], wt)).code).toBe(0);
    expect((await run(['dashboard', '--json'], b)).code).toBe(0);
    expect(has(b, 'refs/remotes/origin-accord/ST-9')).toBe(true);
    expect(has(b, 'refs/remotes/origin/t/ST-9')).toBe(false);
    expect(gitRun(b, 'config', '--get-all', 'remote.origin.fetch').trim()).toBe('+refs/heads/main:refs/remotes/origin/main');
  } finally {
    c.cleanupAll();
  }
}, 180_000);
