// Spec §7-§11: the lane-ticket records under accord/tickets/<id>/ and the rules that read them. Every path
// is built from the snapshot's own ticket id, so no absolute path and no backslash reaches a reason (D-51).
import { normaliseKey } from '../load/snapshot.js';
import { UNTRACED, untracedTests } from '../lint/tests.js';
import { reportLoaded, reportPath } from './done.js';
import type { RepoSnapshot, Ticket, TicketWork } from '../model/snapshot.js';
import type { GateRule } from './rules.js';

export const planFile = (id: string): string => 'accord/tickets/' + id + '/plan.md';
export const ledgerFile = (id: string): string => 'accord/tickets/' + id + '/ledger.md';
export const reviewFile = (id: string): string => 'accord/tickets/' + id + '/review.md';

/** Spec §10: the two review verdicts Done accepts. */
export const VERDICTS: readonly string[] = ['converged', 'accepted-by-owner'];

/** `Object.hasOwn`, never `in`: the id is caller-supplied. */
export const workOf = (snapshot: RepoSnapshot, id: string): TicketWork | undefined =>
  snapshot.work !== undefined && Object.hasOwn(snapshot.work, id) ? snapshot.work[id] : undefined;

/** The ticket when it exists and carries `lane:`; every workflow-layer rule is silent otherwise. */
export const laneTicket = (snapshot: RepoSnapshot, id: string): Ticket | undefined => {
  const t = Object.hasOwn(snapshot.tickets, id) ? snapshot.tickets[id] : undefined;
  return t?.frontmatter?.lane === undefined ? undefined : t;
};

/** Spec §8: every planned task has a completion line written by `accord task-done`. */
export const tasksIncomplete: GateRule['check'] = (snapshot, id) => {
  if (laneTicket(snapshot, id) === undefined) return [];
  const work = workOf(snapshot, id);
  if (work?.plan === undefined) {
    return [{ file: planFile(id), reason: 'no plan; Done needs every planned task recorded in ' + ledgerFile(id) }];
  }
  const done = work.ledger?.done ?? {};
  return work.plan.tasks
    .filter((t) => !Object.hasOwn(done, String(t.n)))
    .map((t) => ({
      file: planFile(id),
      line: t.line,
      reason: `task ${t.n} has no completion line in ${ledgerFile(id)}; run accord task-done ${id} ${t.n}`,
    }));
};

/** Spec §10: there is no Done without a review record. */
export const reviewMissing: GateRule['check'] = (snapshot, id) => {
  if (laneTicket(snapshot, id) === undefined || workOf(snapshot, id)?.review !== undefined) return [];
  return [{ file: reviewFile(id), reason: 'no review record; Done needs ' + reviewFile(id) }];
};

/** Spec §10: the review loop ended in convergence, or the owner accepted it at the cap. */
export const reviewUnconverged: GateRule['check'] = (snapshot, id) => {
  const review = laneTicket(snapshot, id) === undefined ? undefined : workOf(snapshot, id)?.review;
  if (review === undefined || VERDICTS.includes(review.verdict ?? '')) return [];
  return [
    {
      file: review.file,
      ...(review.line === undefined ? {} : { line: review.line }),
      reason:
        review.verdict === undefined
          ? 'the review record has no verdict: line'
          : `the review verdict is "${review.verdict}"; Done needs converged or accepted-by-owner`,
    },
  ];
};

/** Spec §11: the report is the full suite's output, and any failed case fails Done. */
export const suiteNotPassed: GateRule['check'] = (snapshot, id) => {
  const report = reportPath(snapshot);
  if (laneTicket(snapshot, id) === undefined || report === undefined || !reportLoaded(snapshot)) return [];
  const tests = snapshot.tests ?? {};
  const failed = Object.keys(tests)
    .filter((k) => tests[k] === 'failed')
    .sort();
  if (failed.length === 0) return [];
  const shown = failed.slice(0, 5).join(', ') + (failed.length > 5 ? ', ...' : '');
  return [
    {
      file: normaliseKey(report),
      reason: `${failed.length} test case${failed.length === 1 ? '' : 's'} failed in the report: ${shown}`,
    },
  ];
};

/** Spec §9 at Done: the warning lint gives becomes an error for a lane ticket. */
export const testUntracedAtDone: GateRule['check'] = (snapshot, id) => {
  const report = reportPath(snapshot);
  if (laneTicket(snapshot, id) === undefined || report === undefined || !reportLoaded(snapshot)) return [];
  return untracedTests(snapshot).map((t) => ({ file: normaliseKey(report), reason: UNTRACED(t) }));
};
