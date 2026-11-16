// ST-LN-92 92-ac-1: the wave builder groups a plan's tasks into waves from their `after:` and `files:` lines. Every task an `after:` line names sits in an
// earlier wave, no two tasks of one wave share a path, and the tasks the ledger records are left out. Plans are parsed from text, as the loader reads them.
import { describe, expect, it } from 'vitest';
import { buildWaves } from '../src/index.js';
import type { PlanTask } from '../src/index.js';
import { parsePlan } from '../src/load/work.js';

const HEAD = ['---', 'baseline: abc1234', '---', '', '# Plan', ''];
/** One task with its `files:` and `after:` values. */
const task = (n: number, files: string, after: string): string =>
  [`## Task ${n}: Step ${n}`, 'covers: @ac-1', `files: ${files}`, `verify: t#case-${n} (@ac-1)`, `after: ${after}`, ''].join('\n');
const tasksOf = (...tasks: string[]): PlanTask[] => parsePlan('accord/tickets/T-1/plan.md', [...HEAD, ...tasks].join('\n')).plan.tasks;

describe('the wave builder', () => {
  it('ac-1 tasks with no dependency or shared file share a wave, every after: target sits in an earlier wave (ST-LN-92 92-ac-1)', () => {
    const tasks = tasksOf(
      task(1, 'src/a.ts', 'none'),
      task(2, 'src/b.ts', '1'),
      task(3, 'src/c.ts', '1'),
      task(4, 'src/d.ts', '2, 3'),
      task(5, 'src/a.ts', 'none'), // no dependency, but it shares src/a.ts with task 1, so it moves to the second wave
    );
    expect(buildWaves(tasks, new Set())).toEqual([[1], [2, 3, 5], [4]]);
    // task 1 recorded: it is left out, and an after: line naming it sets no order
    expect(buildWaves(tasks, new Set([1]))).toEqual([[2, 3, 5], [4]]);
  });

  it('risk:complex-branching after: to a higher-numbered task is honoured (ST-LN-92 92-ac-1)', () => {
    const tasks = tasksOf(task(1, 'src/a.ts', '3'), task(2, 'src/b.ts', 'none'), task(3, 'src/c.ts', 'none'));
    expect(buildWaves(tasks, new Set())).toEqual([[2, 3], [1]]);
  });
});
