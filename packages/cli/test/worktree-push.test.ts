// BUG-LN-11: `accord worktree push <id>` puts the claim branch on origin, so another clone's dashboard shows the same stage and task count.
import { utimesSync } from 'node:fs';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { junit, PLAN, REPORT } from '../../../test/helpers/lane.js';
import { commitMsg, gitRun, run, writeFiles } from './helpers/repo.js';
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
