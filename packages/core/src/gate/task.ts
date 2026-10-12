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
  if (plan.planHash === undefined) return fail(`plan.md has no plan_hash:; run accord gate plan ${id}`);
  if (plan.planHash !== plan.bodyHash) return fail(`plan.md changed after accord gate plan last passed; run accord gate plan ${id} again`);
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
