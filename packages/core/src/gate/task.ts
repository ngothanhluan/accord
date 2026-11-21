// Spec §8 `task-done`: a task is done when every report case its verify: line names is recorded passed.
// Pure: the CLI adds the two host facts core cannot see — the commit, and whether the report is fresh.
import { normaliseKey } from '../load/snapshot.js';
import type { RepoSnapshot } from '../model/snapshot.js';
import { reportLoaded, reportPath } from './done.js';
import { planFile, workOf } from './work.js';

export interface TaskVerdict {
  verdict: 'pass' | 'fail';
  reasons: string[];
}

const fail = (reason: string): TaskVerdict => ({ verdict: 'fail', reasons: [reason] });

export function taskVerdict(snapshot: RepoSnapshot, id: string, n: number): TaskVerdict {
  const plan = workOf(snapshot, id)?.plan;
  if (plan === undefined) return fail('no plan at ' + planFile(id));
  const task = plan.tasks.find((t) => t.n === n);
  if (plan.planHash === undefined) return fail('plan.md has no plan_hash: the plan stage has not finished; go back to the plan stage (plan.md of /accord)');
  if (plan.planHash !== plan.bodyHash) {
    return fail(
      "plan.md changed since its plan_hash was recorded: show the owner the diff of plan.md; if the owner made the change, the plan stage (plan.md of /accord) reviews it; otherwise restore plan.md with the owner's yes",
    );
  }
  if (task === undefined) return fail(`the plan has no "## Task ${n}"`);
  if (task.verify.length === 0) return fail(`task ${n} has no verify: line`);
  const tests = snapshot.tests;
  if (!reportLoaded(snapshot) || tests === undefined) return fail('no test report is loaded; set tests.report and run the tests');
  // D-51: the raw config value may carry a backslash; a reason never does.
  const report = normaliseKey(reportPath(snapshot) ?? '');
  const reasons = task.verify.flatMap((v) =>
    !Object.hasOwn(tests, v)
      ? [`${v} is not in ${report}`]
      : tests[v] !== 'passed'
        ? [`${v} is recorded ${tests[v]} in ${report}`]
        : [],
  );
  return reasons.length === 0 ? { verdict: 'pass', reasons: [] } : { verdict: 'fail', reasons };
}

/**
 * ST-LN-50 D-08 Ruling: with the plan stage off task 1 is the whole ticket, and its tests are named at task-done by `maps` (`ac` as `@ac-n`, like a plan
 * task's maps). The verdict is a pass when every scenario that is not @ui is mapped exactly once, every map names a scenario of the ticket, and each named test
 * passed in the report: the verification floor (gate.test-tag-missing, LOCKED) never depends on the plan stage.
 */
export function ticketTaskVerdict(snapshot: RepoSnapshot, id: string, maps: { ac: string; test: string }[]): TaskVerdict {
  const ticket = Object.hasOwn(snapshot.tickets, id) ? snapshot.tickets[id] : undefined;
  if (ticket === undefined) return fail(`no ticket ${id}`);
  const tests = snapshot.tests;
  if (!reportLoaded(snapshot) || tests === undefined) return fail('no test report is loaded; set tests.report and run the tests');
  const report = normaliseKey(reportPath(snapshot) ?? '');
  const known = new Set(ticket.scenarios.flatMap((s) => (s.acTag === undefined ? [] : ['@' + s.acTag])));
  const reasons: string[] = [];
  for (const ac of new Set(maps.map((m) => m.ac))) {
    if (!known.has(ac)) reasons.push(`${ac} is not a scenario of the ticket`);
    else if (maps.filter((m) => m.ac === ac).length > 1) reasons.push(`${ac} is named by more than one --test`);
  }
  if (reasons.length > 0) return { verdict: 'fail', reasons };
  for (const s of ticket.scenarios) {
    if (s.acTag !== undefined && !s.tags.includes('@ui') && !maps.some((m) => m.ac === '@' + s.acTag)) {
      reasons.push(`@${s.acTag} has no --test: every scenario that is not @ui needs one test`);
    }
  }
  for (const test of new Set(maps.map((m) => m.test))) {
    if (!Object.hasOwn(tests, test)) reasons.push(`${test} is not in ${report}`);
    else if (tests[test] !== 'passed') reasons.push(`${test} is recorded ${tests[test]} in ${report}`);
  }
  return reasons.length === 0 ? { verdict: 'pass', reasons: [] } : { verdict: 'fail', reasons };
}
