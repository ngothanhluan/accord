// GATE-06 no bypass, GATE-07 profile matrix: one row per gate rule id with its level and profiles.
// The engine stamps `rule` and `level` from the row (D-57, D-59, D-87), so a level literal for a
// `gate.*` rule appears nowhere else — a check returns GateDraft, whose type omits `level` (T-04-04).
// D-88 keeps the one profile difference in v0.1 as data beside the table, never as a branch in a rule.
import type { Finding, Level } from '../model/finding.js';
import type { RepoSnapshot } from '../model/snapshot.js';
import {
  acChanged,
  acHashMissing,
  authorMatch,
  authorSkipped,
  commitMissing,
  commitTrailer,
  noScenarios,
  reportMissing,
  resultNotPass,
  shaTooShort,
  staleReview,
  tagsDiffer,
  testNotPassed,
  testsUnconfigured,
  testTagMissing,
  testUnknown,
  tickStaleCommit,
  tickStaleHash,
  tickUnbound,
  verificationMissing,
} from './done.js';
import {
  acUncovered,
  decisionUncited,
  deferral,
  testsBaselineMissing,
  verifyComma,
  laneMissing,
  mapInvalid,
  planBaselineMissing,
  planBaselineUnknown,
  planEmpty,
  planMissing,
  refUnknown,
  taskCoversMissing,
  taskFileUnknown,
  taskVerifyMissing,
  testRepeated,
  testUnmapped,
  verifyAt,
} from './plan.js';
import {
  approachEmpty,
  approvalMissing,
  approvalStale,
  dependsUnmerged,
  designMissing,
  earsMissing,
  intentEmpty,
  sectionEmpty,
  ticketUnknown,
} from './ready.js';
import {
  commitAfterReview,
  readyMissing,
  reviewCommitCode,
  reviewTrailing,
  reviewUncommitted,
  sectionsChanged,
} from './lane-s.js';
import { branchUnknown, interfaceSign, outOfScope, sensitiveTouched } from './scope.js';
import { reviewMissing, reviewUnconverged, suiteNotPassed, tasksIncomplete, testUntracedAtDone } from './work.js';
import {
  evidenceUnresolved,
  noteMissing,
  notePasted,
  noteUnresolved,
  referenceUnknown,
} from './refs.js';

/** What a check returns; the engine adds `rule` and `level` from the table row. */
export type GateDraft = Omit<Finding, 'level' | 'rule'>;

export interface GateRule {
  id: `gate.${string}`; // D-59: mirrors the loader's `load.<name>` and lint's `lint.<name>` ids
  level: Level; // D-56
  profiles: readonly ('build' | 'maintain')[]; // D-57
  check: (snapshot: RepoSnapshot, id: string) => GateDraft[]; // pure; reads the snapshot only
}

/**
 * GATE-02: no gate may pass an id the snapshot does not carry. One row referenced by every table, never
 * a copy per table, so a level or profile change can never reach one gate and miss another (GATE-06).
 */
const TICKET_UNKNOWN: GateRule = {
  id: 'gate.ticket-unknown',
  level: 'error',
  profiles: ['build', 'maintain'],
  check: ticketUnknown,
};

/** Spec §4, §7, §11: Ready, Plan, and Done all refuse a lane ticket whose approval is absent or stale. */
const APPROVAL_MISSING: GateRule = {
  id: 'gate.approval-missing',
  level: 'error',
  profiles: ['build', 'maintain'],
  check: approvalMissing,
};
const APPROVAL_STALE: GateRule = {
  id: 'gate.approval-stale',
  level: 'error',
  profiles: ['build', 'maintain'],
  check: approvalStale,
};

export const SECTION_EMPTY: GateRule = {
  id: 'gate.section-empty',
  level: 'error',
  profiles: ['build', 'maintain'],
  check: sectionEmpty,
};

export const READY_RULES: readonly GateRule[] = [
  TICKET_UNKNOWN,
  { id: 'gate.design-missing', level: 'error', profiles: ['build', 'maintain'], check: designMissing },
  { id: 'gate.intent-empty', level: 'error', profiles: ['build', 'maintain'], check: intentEmpty },
  { id: 'gate.ears-missing', level: 'error', profiles: ['build', 'maintain'], check: earsMissing },
  { id: 'gate.approach-empty', level: 'error', profiles: ['build', 'maintain'], check: approachEmpty },
  SECTION_EMPTY,
  APPROVAL_MISSING,
  APPROVAL_STALE,
  { id: 'gate.depends-unmerged', level: 'error', profiles: ['build', 'maintain'], check: dependsUnmerged },
];

/** Spec §7: the plan gate. Every row is an error except the last, which only asks: an incomplete plan never reaches an executor. */
export const PLAN_RULES: readonly GateRule[] = [
  TICKET_UNKNOWN,
  { id: 'gate.lane-missing', level: 'error', profiles: ['build', 'maintain'], check: laneMissing },
  APPROVAL_MISSING,
  APPROVAL_STALE,
  { id: 'gate.plan-missing', level: 'error', profiles: ['build', 'maintain'], check: planMissing },
  { id: 'gate.plan-empty', level: 'error', profiles: ['build', 'maintain'], check: planEmpty },
  { id: 'gate.plan-baseline-missing', level: 'error', profiles: ['build', 'maintain'], check: planBaselineMissing },
  { id: 'gate.plan-baseline-unknown', level: 'error', profiles: ['build', 'maintain'], check: planBaselineUnknown },
  { id: 'gate.task-covers-missing', level: 'error', profiles: ['build', 'maintain'], check: taskCoversMissing },
  { id: 'gate.task-verify-missing', level: 'error', profiles: ['build', 'maintain'], check: taskVerifyMissing },
  { id: 'gate.task-file-unknown', level: 'error', profiles: ['build', 'maintain'], check: taskFileUnknown },
  { id: 'gate.plan-ac-uncovered', level: 'error', profiles: ['build', 'maintain'], check: acUncovered },
  { id: 'gate.plan-decision-uncited', level: 'error', profiles: ['build', 'maintain'], check: decisionUncited },
  { id: 'gate.plan-ref-unknown', level: 'error', profiles: ['build', 'maintain'], check: refUnknown },
  { id: 'gate.plan-test-unmapped', level: 'error', profiles: ['build', 'maintain'], check: testUnmapped },
  { id: 'gate.plan-test-repeated', level: 'error', profiles: ['build', 'maintain'], check: testRepeated },
  { id: 'gate.plan-map-invalid', level: 'error', profiles: ['build', 'maintain'], check: mapInvalid },
  { id: 'gate.plan-deferral', level: 'error', profiles: ['build', 'maintain'], check: deferral },
  { id: 'gate.plan-verify-at', level: 'error', profiles: ['build', 'maintain'], check: verifyAt },
  { id: 'gate.plan-verify-comma', level: 'error', profiles: ['build', 'maintain'], check: verifyComma },
  { id: 'gate.tests-baseline-missing', level: 'warning', profiles: ['build', 'maintain'], check: testsBaselineMissing },
];

const REVIEW_MISSING: GateRule = { id: 'gate.review-missing', level: 'error', profiles: ['build', 'maintain'], check: reviewMissing };
const REVIEW_UNCONVERGED: GateRule = { id: 'gate.review-unconverged', level: 'error', profiles: ['build', 'maintain'], check: reviewUnconverged };
const SUITE_NOT_PASSED: GateRule = { id: 'gate.suite-not-passed', level: 'error', profiles: ['build', 'maintain'], check: suiteNotPassed };
const COMMIT_TRAILER: GateRule = { id: 'gate.commit-trailer', level: 'error', profiles: ['build', 'maintain'], check: commitTrailer };
/** ST-LN-62: Done reads the branch diff of every ticket with `lane:`; no diff, an empty diff, or in lane S a diff without the ticket file, fails closed. */
const BRANCH_UNKNOWN: GateRule = { id: 'gate.branch-unknown', level: 'error', profiles: ['build', 'maintain'], check: branchUnknown };

/** ST-LN-62 D-04: a sign of a new interface in a path no sensitive entry matches, in every lane that carries `lane:`. */
const INTERFACE_SIGN: GateRule = { id: 'gate.interface-sign', level: 'error', profiles: ['build', 'maintain'], check: interfaceSign };

/** GATE-02/GATE-03/GATE-11 (docs/design.md §5). Every row is an error on both profiles: Done is the
 * gate that must not be talked past, and GATE-06 forbids a level that depends on a flag. */
export const DONE_RULES: readonly GateRule[] = [
  TICKET_UNKNOWN,
  { id: 'gate.no-scenarios', level: 'error', profiles: ['build', 'maintain'], check: noScenarios },
  { id: 'gate.tags-differ', level: 'error', profiles: ['build', 'maintain'], check: tagsDiffer },
  { id: 'gate.verification-missing', level: 'error', profiles: ['build', 'maintain'], check: verificationMissing },
  { id: 'gate.result-not-pass', level: 'error', profiles: ['build', 'maintain'], check: resultNotPass },
  { id: 'gate.commit-missing', level: 'error', profiles: ['build', 'maintain'], check: commitMissing },
  { id: 'gate.sha-too-short', level: 'error', profiles: ['build', 'maintain'], check: shaTooShort },
  { id: 'gate.ac-hash-missing', level: 'error', profiles: ['build', 'maintain'], check: acHashMissing },
  { id: 'gate.ac-changed', level: 'error', profiles: ['build', 'maintain'], check: acChanged },
  { id: 'gate.tick-unbound', level: 'error', profiles: ['build', 'maintain'], check: tickUnbound },
  { id: 'gate.tick-stale-hash', level: 'error', profiles: ['build', 'maintain'], check: tickStaleHash },
  { id: 'gate.tick-stale-commit', level: 'error', profiles: ['build', 'maintain'], check: tickStaleCommit },
  { id: 'gate.stale-review', level: 'error', profiles: ['build', 'maintain'], check: staleReview },
  COMMIT_TRAILER,
  BRANCH_UNKNOWN,
  INTERFACE_SIGN,
  { id: 'gate.evidence-unresolved', level: 'error', profiles: ['build', 'maintain'], check: evidenceUnresolved },
  { id: 'gate.reference-unknown', level: 'warning', profiles: ['build', 'maintain'], check: referenceUnknown },
  { id: 'gate.note-missing', level: 'error', profiles: ['build', 'maintain'], check: noteMissing },
  { id: 'gate.note-unresolved', level: 'error', profiles: ['build', 'maintain'], check: noteUnresolved },
  { id: 'gate.note-pasted', level: 'error', profiles: ['build', 'maintain'], check: notePasted },
  { id: 'gate.test-tag-missing', level: 'error', profiles: ['build', 'maintain'], check: testTagMissing },
  { id: 'gate.tests-unconfigured', level: 'error', profiles: ['build', 'maintain'], check: testsUnconfigured },
  { id: 'gate.report-missing', level: 'error', profiles: ['build', 'maintain'], check: reportMissing },
  { id: 'gate.test-unknown', level: 'error', profiles: ['build', 'maintain'], check: testUnknown },
  { id: 'gate.test-not-passed', level: 'error', profiles: ['build', 'maintain'], check: testNotPassed },
  APPROVAL_MISSING,
  APPROVAL_STALE,
  { id: 'gate.task-incomplete', level: 'error', profiles: ['build', 'maintain'], check: tasksIncomplete },
  REVIEW_MISSING,
  REVIEW_UNCONVERGED,
  SUITE_NOT_PASSED,
  { id: 'gate.test-untraced', level: 'error', profiles: ['build', 'maintain'], check: testUntracedAtDone },
  // GATE-05 (D-79): warnings, and never more. docs/design.md §4 makes the reviewer not a role, so the
  // two identities match on nearly every honest ticket; an error here would block every solo developer.
  { id: 'gate.author-match', level: 'warning', profiles: ['build', 'maintain'], check: authorMatch },
  { id: 'gate.author-skipped', level: 'warning', profiles: ['build', 'maintain'], check: authorSkipped },
];

/** ST-LN-31 D-04, D-12: the lane S Done table, with the suite rule; no plan, task, criteria or approval rows. */
export const DONE_S_RULES: readonly GateRule[] = [
  TICKET_UNKNOWN,
  SECTION_EMPTY,
  { id: 'gate.ready-missing', level: 'error', profiles: ['build', 'maintain'], check: readyMissing },
  { id: 'gate.sections-changed', level: 'error', profiles: ['build', 'maintain'], check: sectionsChanged },
  REVIEW_MISSING,
  REVIEW_UNCONVERGED,
  { id: 'gate.review-trailing', level: 'error', profiles: ['build', 'maintain'], check: reviewTrailing },
  { id: 'gate.review-uncommitted', level: 'error', profiles: ['build', 'maintain'], check: reviewUncommitted },
  { id: 'gate.review-commit-code', level: 'error', profiles: ['build', 'maintain'], check: reviewCommitCode },
  { id: 'gate.commit-after-review', level: 'error', profiles: ['build', 'maintain'], check: commitAfterReview },
  SUITE_NOT_PASSED,
  COMMIT_TRAILER,
  BRANCH_UNKNOWN,
  { id: 'gate.out-of-scope', level: 'error', profiles: ['build', 'maintain'], check: outOfScope },
  { id: 'gate.sensitive-touched', level: 'error', profiles: ['build', 'maintain'], check: sensitiveTouched },
  INTERFACE_SIGN,
];

/** D-89: the three LINT-06 hygiene rules Ready promotes from warning to blocking. */
export const READY_PROMOTE: readonly string[] = ['lint.sentinel', 'lint.open-question', 'lint.assumption-unconfirmed'];

/** D-88/GATE-07: the token and size rules, softened on `maintain`. Disjoint from READY_PROMOTE. */
export const MAINTAIN_DOWNGRADE: readonly string[] = [
  'lint.token-hardcoded',
  'lint.intent-oversize',
  'lint.requirements-oversize',
  'lint.scenarios-oversize',
];

/**
 * GATE-07: the whole profile matrix, applied once in the shared engine body so every gate inherits it.
 * `build` keeps every rule as configured; in v0.1 all four are already warnings, so the downgrade runs
 * correctly and changes no result. GATE-12 is then a one-cell table edit (D-88).
 */
export function downgradeMaintain(findings: Finding[], profile: 'build' | 'maintain'): Finding[] {
  if (profile === 'build') return findings;
  return findings.map((f) => (MAINTAIN_DOWNGRADE.includes(f.rule) ? { ...f, level: 'warning' as const } : f));
}
