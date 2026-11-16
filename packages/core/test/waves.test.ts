// ST-LN-92 92-ac-1: the wave builder groups a plan's tasks into waves from their `after:` and `files:` lines. Every task an `after:` line names sits in an
// earlier wave, no two tasks of one wave share a path, and the tasks the ledger records are left out. Plans are parsed from text, as the loader reads them.
import { describe, expect, it } from 'vitest';
import { buildWaves, gatePlan, loadSnapshot, PLAN_WAVES_FROM } from '../src/index.js';
import type { Finding, PlanTask } from '../src/index.js';
import { parsePlan } from '../src/load/work.js';
import { approved } from './helpers/approve.js';
import { CONFIG, laneTicket } from '../../../test/helpers/lane.js';

const HEAD = ['---', 'baseline: abc1234', '---', '', '# Plan', ''];
/** One task with its `files:` and `after:` values. */
const task = (n: number, files: string, after: string): string =>
  [`## Task ${n}: Step ${n}`, 'covers: @ac-1', `files: ${files}`, `verify: t#case-${n} (@ac-1)`, `after: ${after}`, ''].join('\n');
const planText = (...tasks: string[]): string => [...HEAD, ...tasks].join('\n');
const tasksOf = (...tasks: string[]): PlanTask[] => parsePlan('accord/tickets/T-1/plan.md', planText(...tasks)).plan.tasks;

type Claim = { pin: string } | { error: string };
/** gate plan's gate.task-after-cycle findings on an approved lane M ticket T-1 holding `plan`, its claim pin read as `claim`. */
const cycleFindings = (plan: string, claim: Claim): Finding[] => {
  const files = approved({ 'accord/config.yml': CONFIG, 'accord/tickets/T-1.md': laneTicket('T-1'), 'accord/tickets/T-1/plan.md': plan }, 'T-1');
  const snapshot = { ...loadSnapshot({ files, tree: Object.keys(files).sort() }), claimPins: { 'T-1': claim } };
  return gatePlan(snapshot, 'T-1').findings.filter((f) => f.rule === 'gate.task-after-cycle');
};
/** The line of task `n`'s `after:` line in `plan`. */
const afterLine = (plan: string, n: number): number => parsePlan('accord/tickets/T-1/plan.md', plan).plan.tasks.find((t) => t.n === n)!.after!.line;

describe('gate plan: an after: self reference or cycle', () => {
  it('ac-1 gate plan refuses an after: self reference or cycle, naming the tasks (ST-LN-92 92-ac-1)', () => {
    const NEW: Claim = { pin: PLAN_WAVES_FROM };

    // a self reference: task 2 names itself
    const self = planText(task(1, 'src/a.ts', 'none'), task(2, 'src/b.ts', '2'), task(3, 'src/c.ts', '1'));
    const one = cycleFindings(self, NEW);
    expect(one.map((f) => [f.file, f.line, f.level, f.reason])).toEqual([['accord/tickets/T-1/plan.md', afterLine(self, 2), 'error', 'task 2 after: names itself']]);

    // a three-task cycle 2 -> 3 -> 4 -> 2: one finding naming the three tasks, at the after: line of the lowest
    const three = planText(task(1, 'src/a.ts', 'none'), task(2, 'src/b.ts', '4'), task(3, 'src/c.ts', '2'), task(4, 'src/d.ts', '3'));
    const cyc = cycleFindings(three, NEW);
    expect(cyc.map((f) => [f.line, f.reason])).toEqual([
      [afterLine(three, 2), 'tasks 2, 3, 4 name each other in their after: lines, a cycle no wave order can meet'],
    ]);

    // two separate cycles: two findings
    const two = planText(task(1, 'src/a.ts', '2'), task(2, 'src/b.ts', '1'), task(3, 'src/c.ts', '4'), task(4, 'src/d.ts', '3'));
    expect(cycleFindings(two, NEW).map((f) => [f.line, f.reason])).toEqual([
      [afterLine(two, 1), 'tasks 1, 2 name each other in their after: lines, a cycle no wave order can meet'],
      [afterLine(two, 3), 'tasks 3, 4 name each other in their after: lines, a cycle no wave order can meet'],
    ]);

    // no cycle: no finding
    expect(cycleFindings(planText(task(1, 'src/a.ts', 'none'), task(2, 'src/b.ts', '1'), task(3, 'src/c.ts', '1, 2')), NEW)).toEqual([]);

    // a ticket claimed before the cut-off answers as before
    expect(PLAN_WAVES_FROM).toBe('0.6.0');
    expect(cycleFindings(self, { pin: '0.5.1' })).toEqual([]);
    expect(cycleFindings(three, { pin: '0.5.1' })).toEqual([]);

    // a failed claim read applies the rule (fail closed) and says why
    const failed = cycleFindings(three, { error: 'fatal: bad object 1234567' });
    expect(failed).toHaveLength(1);
    expect(failed[0].reason).toContain('tasks 2, 3, 4 name each other');
    expect(failed[0].reason).toContain('fatal: bad object 1234567');
    expect(failed[0].reason).toContain('the new plan rules apply');
  });
});

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
