// BUG-LN-11: `accord worktree push <id>` puts the claim branch on origin, so another clone's dashboard shows the same stage and task count.
import { readFileSync, utimesSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { junit, PLAN, REPORT } from '../../../test/helpers/lane.js';
import { commitMsg, gitRun, mergeMsg, run, writeFiles } from './helpers/repo.js';
import { makeClone, type Clone } from './helpers/worktree.js';

/** The claim worktree of ST-9, with the plan's file in place and the claim branch pushed. */
function claimed(c: Clone): string {
  c.git('worktree', 'add', '-q', '-b', 't/ST-9', c.sibling('ST-9'), 'origin/main');
  const wt = c.sibling('ST-9');
  writeFiles(wt, { 'src/export.ts': 'export const write = 1;\n' });
  commitMsg(wt, 'claim: ST-9');
  gitRun(wt, 'push', '-q', '-u', 'origin', 't/ST-9');
  return wt;
}

const onOrigin = (c: Clone) => gitRun(c.remote, 'rev-parse', 'refs/heads/t/ST-9').trim();
const head = (dir: string) => gitRun(dir, 'rev-parse', 'HEAD').trim();
const FAILED = 'push of t/ST-9 failed; its commits stay local until the next push';

/** Reword the tip commit the way build step 3 does: from a file, never -m, no trailer; the message file lies outside every working tree. */
function reword(c: Clone, dir: string, text: string): string {
  const file = `${c.root}/.git/reword.txt`;
  writeFileSync(file, text + '\n');
  gitRun(dir, 'commit', '--amend', '-q', '-F', file, '--cleanup=verbatim');
  return head(dir);
}

/** A teammate in another clone pushes a commit to the claim branch; returns its sha. */
function teammate(c: Clone): string {
  const o = c.otherClone();
  gitRun(o, 'switch', 't/ST-9');
  writeFiles(o, { 'teammate.txt': 'mate\n' });
  const mate = commitMsg(o, 'teammate');
  gitRun(o, 'push', '-q', 'origin', 't/ST-9');
  return mate;
}

/** The orchestrator ran the suite after the last commit: task-done refuses a report older than HEAD. */
function freshReport(dir: string): void {
  const later = new Date(Date.now() + 5000);
  utimesSync(join(dir, REPORT), later, later);
}

/** The dashboard row of ST-9 as `dir` shows it. */
async function row(dir: string): Promise<{ stage: string; tasksDone: number; tasksTotal: number } | undefined> {
  const r = await run(['dashboard', '--json'], dir);
  expect(r.code).toBe(0);
  const j = JSON.parse(r.out) as Record<string, { rows: { id: string; stage: string; tasksDone: number; tasksTotal: number }[] }>;
  for (const k of ['yours', 'team', 'ready', 'upNext']) {
    const found = j[k].rows.find((x) => x.id === 'ST-9');
    if (found !== undefined) return { stage: found.stage, tasksDone: found.tasksDone, tasksTotal: found.tasksTotal };
  }
  return undefined;
}

it('ac-1 a recorded task pushed with accord worktree push shows the same task count in another clone', async () => {
  const c = makeClone();
  try {
    const wt = claimed(c);
    expect((await run(['approve', 'ST-9'], wt)).code).toBe(0);
    expect((await run(['gate', 'ready', 'ST-9'], wt)).code).toBe(0);
    const baseline = commitMsg(wt, 'approach: ST-9 approved');
    writeFiles(wt, {
      'accord/tickets/ST-9/plan.md': PLAN.replace('abc1234', baseline),
      [REPORT]: junit({ 'export#writes-csv': 'passed', 'export#escapes-commas': 'passed' }),
    });
    expect((await run(['gate', 'plan', 'ST-9'], wt)).code).toBe(0);
    commitMsg(wt, 'plan: ST-9 ready');
    gitRun(wt, 'push', '-q', 'origin', 't/ST-9');

    freshReport(wt);
    expect((await run(['task-done', 'ST-9', '1'], wt)).code).toBe(0);
    const tip = commitMsg(wt, 'build: ST-9 task 1');

    const o = c.otherClone();
    expect(await row(wt)).toEqual({ stage: 'build', tasksDone: 1, tasksTotal: 2 });
    expect(await row(o)).toEqual({ stage: 'build', tasksDone: 0, tasksTotal: 2 });

    const r = await run(['worktree', 'push', 'ST-9'], wt);
    expect(r).toEqual({ code: 0, out: 'pushed: t/ST-9\n', err: '' });
    expect(onOrigin(c)).toBe(tip);

    gitRun(o, 'fetch', '-q', 'origin');
    expect(await row(o)).toEqual(await row(wt));
    expect((await row(o))?.tasksDone).toBe(1);
  } finally {
    c.cleanupAll();
  }
}, 120_000);

it('ac-2 each stage change before build pushed with accord worktree push shows the same stage in another clone', async () => {
  const c = makeClone();
  try {
    const wt = claimed(c);
    const o = c.otherClone();
    const push = async (dir: string, tip: string) => {
      expect(await run(['worktree', 'push', 'ST-9'], dir)).toEqual({ code: 0, out: 'pushed: t/ST-9\n', err: '' });
      expect(onOrigin(c)).toBe(tip);
      gitRun(o, 'fetch', '-q', 'origin');
    };

    // 1. Intent approved.
    const ticket = join(wt, 'accord/tickets/ST-9.md');
    const text = readFileSync(ticket, 'utf8');
    const edited = text.replace('Owners can export their report as CSV.', 'Owners can export their report as a CSV file.');
    expect(edited).not.toBe(text);
    writeFileSync(ticket, edited);
    await push(wt, commitMsg(wt, 'intent: ST-9 approved by the owner: "yes"'));
    expect(await row(o)).toEqual(await row(wt));
    expect((await row(o))?.stage).toBe('intent');

    // 2. Approach approved, pushed from the main checkout.
    expect((await run(['approve', 'ST-9'], wt)).code).toBe(0);
    expect((await run(['gate', 'ready', 'ST-9'], wt)).code).toBe(0);
    const approach = commitMsg(wt, 'approach: ST-9 approved by the owner: "yes"');
    gitRun(o, 'fetch', '-q', 'origin');
    expect((await row(o))?.stage).toBe('intent');
    await push(c.root, approach);
    expect(await row(o)).toEqual(await row(wt));
    expect((await row(o))?.stage).toBe('plan');

    // 3. Plan through its gate.
    writeFiles(wt, { 'accord/tickets/ST-9/plan.md': PLAN.replace('abc1234', approach) });
    expect((await run(['gate', 'plan', 'ST-9'], wt)).code).toBe(0);
    const ready = commitMsg(wt, 'plan: ST-9 ready');
    gitRun(o, 'fetch', '-q', 'origin');
    expect((await row(o))?.stage).toBe('plan');
    await push(wt, ready);
    expect(await row(o)).toEqual(await row(wt));
    expect(await row(o)).toEqual({ stage: 'build', tasksDone: 0, tasksTotal: 2 });
  } finally {
    c.cleanupAll();
  }
}, 120_000);

it('ac-3 a failed push exits 0 with the failure line and the git message and the next push carries every commit', async () => {
  // Unreachable remote.
  const c = makeClone();
  try {
    const wt = claimed(c);
    const claimTip = onOrigin(c);
    c.git('remote', 'set-url', 'origin', c.remote + '-missing');
    expect((await run(['approve', 'ST-9'], wt)).code).toBe(0);
    expect((await run(['gate', 'ready', 'ST-9'], wt)).code).toBe(0);
    const a = commitMsg(wt, 'approach: ST-9 approved');
    const r = await run(['worktree', 'push', 'ST-9'], wt);
    expect(r.code).toBe(0);
    expect(r.err).toBe('');
    expect(r.out.startsWith(FAILED + '\n')).toBe(true);
    expect(r.out.slice(FAILED.length + 1)).toContain('does not appear to be a git repository');
    expect(head(wt)).toBe(a);
    expect(onOrigin(c)).toBe(claimTip);

    writeFiles(wt, { 'notes.txt': 'notes\n' });
    const b = commitMsg(wt, 'b');
    const again = await run(['worktree', 'push', 'ST-9'], wt);
    expect(again.code).toBe(0);
    expect(again.err).toBe('');
    expect(again.out.startsWith(FAILED + '\n')).toBe(true);
    expect(again.out.slice(FAILED.length + 1)).toContain('does not appear to be a git repository');

    c.git('remote', 'set-url', 'origin', c.remote);
    writeFiles(wt, { 'more.txt': 'more\n' });
    const d = commitMsg(wt, 'd');
    expect(await run(['worktree', 'push', 'ST-9'], wt)).toEqual({ code: 0, out: 'pushed: t/ST-9\n', err: '' });
    expect(onOrigin(c)).toBe(d);
    for (const x of [a, b]) gitRun(c.remote, 'merge-base', '--is-ancestor', x, 'refs/heads/t/ST-9');
  } finally {
    c.cleanupAll();
  }

  // Rejected push.
  const k = makeClone();
  try {
    const wt = claimed(k);
    const mate = teammate(k);
    writeFiles(wt, { 'mine.txt': 'mine\n' });
    const m = commitMsg(wt, 'mine');
    const r = await run(['worktree', 'push', 'ST-9'], wt);
    expect(r.code).toBe(0);
    expect(r.err).toBe('');
    expect(r.out.startsWith(FAILED + '\n')).toBe(true);
    expect(r.out).toContain('[rejected]');
    expect(onOrigin(k)).toBe(mate);

    gitRun(wt, 'fetch', '-q', 'origin');
    mergeMsg(wt, 'origin/t/ST-9', 'merge teammate');
    expect(await run(['worktree', 'push', 'ST-9'], wt)).toEqual({ code: 0, out: 'pushed: t/ST-9\n', err: '' });
    expect(onOrigin(k)).toBe(head(wt));
    gitRun(k.remote, 'merge-base', '--is-ancestor', m, 'refs/heads/t/ST-9');
  } finally {
    k.cleanupAll();
  }
}, 120_000);

it('risk:data-loss a reworded commit already on origin is pushed with force-with-lease and a teammate commit the branch never held stays on origin', async () => {
  // 1. Own reword.
  const c = makeClone();
  try {
    const wt = claimed(c);
    writeFiles(wt, { 'notes.txt': 'notes\n' });
    commitMsg(wt, 'notes');
    expect(await run(['worktree', 'push', 'ST-9'], wt)).toEqual({ code: 0, out: 'pushed: t/ST-9\n', err: '' });
    const r = reword(c, wt, 'notes reworded');
    const plain = await run(['worktree', 'push', 'ST-9'], wt);
    expect(plain.code).toBe(0);
    expect(plain.err).toBe('');
    expect(plain.out.startsWith(FAILED + '\n')).toBe(true);
    expect(plain.out).toContain('[rejected]');
    expect(onOrigin(c)).not.toBe(r);
    expect(await run(['worktree', 'push', 'ST-9', '--force-with-lease'], wt)).toEqual({ code: 0, out: 'pushed: t/ST-9\n', err: '' });
    expect(onOrigin(c)).toBe(r);
    expect(gitRun(c.remote, 'log', '-1', '--format=%s', 'refs/heads/t/ST-9').trim()).toBe('notes reworded');
  } finally {
    c.cleanupAll();
  }

  // 2. Teammate push, no fetch.
  const d = makeClone();
  try {
    const wt = claimed(d);
    const mate = teammate(d);
    reword(d, wt, 'claim: ST-9 reworded');
    const r = await run(['worktree', 'push', 'ST-9', '--force-with-lease'], wt);
    expect(r.code).toBe(0);
    expect(r.err).toBe('');
    expect(r.out.startsWith(FAILED + '\n')).toBe(true);
    expect(r.out).toContain('stale info');
    expect(onOrigin(d)).toBe(mate);
  } finally {
    d.cleanupAll();
  }

  // 3. Teammate push, then a fetch: the lease alone would pass.
  const e = makeClone();
  try {
    const wt = claimed(e);
    const mate = teammate(e);
    gitRun(wt, 'fetch', '-q', 'origin');
    expect(gitRun(wt, 'rev-parse', 'refs/remotes/origin/t/ST-9').trim()).toBe(mate);
    const own = reword(e, wt, 'claim: ST-9 reworded');
    const r = await run(['worktree', 'push', 'ST-9', '--force-with-lease'], wt);
    expect(r.code).toBe(0);
    expect(r.err).toBe('');
    expect(r.out.startsWith(FAILED + '\n')).toBe(true);
    expect(r.out.slice(FAILED.length + 1).trim()).not.toBe('');
    expect(onOrigin(e)).toBe(mate);
    expect(head(wt)).toBe(own);
  } finally {
    e.cleanupAll();
  }
}, 120_000);
