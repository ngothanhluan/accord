// GATE-06 no bypass, GATE-07 profile matrix: one row per gate rule id with its level and profiles.
// The engine stamps `rule` and `level` from the row (D-57, D-59, D-87), so a level literal for a
// `gate.*` rule appears nowhere else — a check returns GateDraft, whose type omits `level` (T-04-04).
// D-88 keeps the one profile difference in v0.1 as data beside the table, never as a branch in a rule.
import type { Finding, Level } from '../model/finding.js';
import type { RepoSnapshot } from '../model/snapshot.js';
import { MAINTAIN_DOWNGRADE, PRESETS } from '../config/strictness.js';
import type { Strictness } from '../config/strictness.js';
import {
  acChanged,
  acHashMissing,
  authorMatch,
  authorSkipped,
  commitMissing,
  commitMessage,
  commitTrailer,
  doneTicketEdited,
  noScenarios,
  repoRecordMissing,
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
  verificationUnfinished,
} from './done.js';
import {
  acUncovered,
  sliceAcMissing,
  sliceAcUncovered,
  sliceDiffLarge,
  sliceLarge,
  sliceMany,
  repoBaselineMissing,
  repoBaselineUnknown,
  repoSlices,
  repoTestsMissing,
  repoUnknown,
  sliceOrder,
  sliceTasks,
  decisionUncited,
  deferral,
  testsBaselineMissing,
  verifyComma,
  laneMissing,
  mapInvalid,
  planBaselineMissing,
  planBaselineUnknown,
  planEmpty,
  planLarge,
  planMissing,
  planSize,
  planSizeMissing,
  planUnfinished,
  refUnknown,
  taskCoversMissing,
  taskFileUnknown,
  taskModelMissing,
  taskModelUnknown,
  taskRepoMixed,
  sliceRepoMixed,
  taskVerifyMissing,
  taskAfterMissing,
  taskAfterCycle,
  taskAfterUnknown,
  taskCodeBlock,
  taskTooLong,
  testRepeated,
  testUnmapped,
  verifyAt,
} from './plan.js';
import {
  approachEmpty,
  approvalMissing,
  approvalStale,
  changeType,
  dependsUnmerged,
  designMissing,
  discussMissing,
  discussUnmapped,
  earsMissing,
  intentEmpty,
  sectionEmpty,
  ticketTitle,
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
import {
  laneRPlan,
  researchBudgetUnanswered,
  researchFieldMissing,
  researchOverBudget,
  researchReadyMissing,
  researchRecordMissing,
  researchSectionsChanged,
  researchShipped,
  researchSpentMissing,
} from './lane-r.js';
import { branchUnknown, interfaceSign, outOfScope, sensitiveTouched } from './scope.js';
import { planRounds, reviewRounds } from './rounds.js';
import { rulesetChanged, rulesetMissing } from './ruleset.js';
import { findingEvidence } from '../round/evidence.js';
import { fixNotAddressed, fixOutsideOpen, fixPlacesMissing } from '../round/fix.js';
import { findingGrounds, fixFileUnexplained } from '../round/grounds.js';
import { reviewScope, reviewScopeSkipped } from '../round/scope.js';
import { securityUnreviewed } from '../round/security.js';
import { slopUnresolved } from '../slop/gate.js';
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

/** A value computed once per gate run, by key: rows that read one shared answer (the three fix record rows) take it here instead of each computing it. */
export type RunOnce = <T>(key: string, compute: () => T) => T;

export interface GateRule {
  id: `gate.${string}`; // D-59: mirrors the loader's `load.<name>` and lint's `lint.<name>` ids
  level: Level; // D-56
  profiles: readonly ('build' | 'maintain')[]; // D-57
  check: (snapshot: RepoSnapshot, id: string, once?: RunOnce) => GateDraft[]; // pure; reads the snapshot only; the engine passes `once`
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

/**
 * ST-LN-96 D-02, t1-ac-2: a hand edit of `ruleset` can happen at any stage and in any lane, so both rows follow TICKET_UNKNOWN in every table that holds it. They read the
 * claim fact the host supplies for every ticket with a lane and are silent without one (after a squash).
 */
const RULESET_CHANGED: GateRule = { id: 'gate.ruleset-changed', level: 'error', profiles: ['build', 'maintain'], check: rulesetChanged };
const RULESET_MISSING: GateRule = { id: 'gate.ruleset-missing', level: 'error', profiles: ['build', 'maintain'], check: rulesetMissing };

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

/** ST-LN-94 94-ac-1, D-13: Ready and lane R's Done both ask for the question, timebox and token budget and the owner's quoted answer. */
const RESEARCH_FIELD_MISSING: GateRule = { id: 'gate.research-field-missing', level: 'error', profiles: ['build', 'maintain'], check: researchFieldMissing };
const RESEARCH_BUDGET_UNANSWERED: GateRule = {
  id: 'gate.research-budget-unanswered',
  level: 'error',
  profiles: ['build', 'maintain'],
  check: researchBudgetUnanswered,
};

export const READY_RULES: readonly GateRule[] = [
  TICKET_UNKNOWN,
  RULESET_CHANGED,
  RULESET_MISSING,
  { id: 'gate.design-missing', level: 'error', profiles: ['build', 'maintain'], check: designMissing },
  { id: 'gate.intent-empty', level: 'error', profiles: ['build', 'maintain'], check: intentEmpty },
  { id: 'gate.ticket-title', level: 'error', profiles: ['build', 'maintain'], check: ticketTitle },
  { id: 'gate.change-type', level: 'error', profiles: ['build', 'maintain'], check: changeType },
  { id: 'gate.ears-missing', level: 'error', profiles: ['build', 'maintain'], check: earsMissing },
  { id: 'gate.approach-empty', level: 'error', profiles: ['build', 'maintain'], check: approachEmpty },
  { id: 'gate.discuss-missing', level: 'error', profiles: ['build', 'maintain'], check: discussMissing },
  { id: 'gate.discuss-unmapped', level: 'error', profiles: ['build', 'maintain'], check: discussUnmapped },
  SECTION_EMPTY,
  RESEARCH_FIELD_MISSING,
  RESEARCH_BUDGET_UNANSWERED,
  APPROVAL_MISSING,
  APPROVAL_STALE,
  { id: 'gate.depends-unmerged', level: 'error', profiles: ['build', 'maintain'], check: dependsUnmerged },
];

/** Spec §7: the plan gate. Every row is an error except the last, which only asks: an incomplete plan never reaches an executor. */
export const PLAN_RULES: readonly GateRule[] = [
  TICKET_UNKNOWN,
  RULESET_CHANGED,
  RULESET_MISSING,
  { id: 'gate.lane-missing', level: 'error', profiles: ['build', 'maintain'], check: laneMissing },
  APPROVAL_MISSING,
  APPROVAL_STALE,
  { id: 'gate.plan-unfinished', level: 'error', profiles: ['build', 'maintain'], check: planUnfinished },
  { id: 'gate.plan-missing', level: 'error', profiles: ['build', 'maintain'], check: planMissing },
  { id: 'gate.plan-empty', level: 'error', profiles: ['build', 'maintain'], check: planEmpty },
  { id: 'gate.plan-size', level: 'error', profiles: ['build', 'maintain'], check: planSize },
  { id: 'gate.plan-size-missing', level: 'error', profiles: ['build', 'maintain'], check: planSizeMissing },
  { id: 'gate.plan-large', level: 'warning', profiles: ['build', 'maintain'], check: planLarge },
  { id: 'gate.plan-baseline-missing', level: 'error', profiles: ['build', 'maintain'], check: planBaselineMissing },
  { id: 'gate.plan-baseline-unknown', level: 'error', profiles: ['build', 'maintain'], check: planBaselineUnknown },
  { id: 'gate.task-covers-missing', level: 'error', profiles: ['build', 'maintain'], check: taskCoversMissing },
  { id: 'gate.task-verify-missing', level: 'error', profiles: ['build', 'maintain'], check: taskVerifyMissing },
  { id: 'gate.task-after-missing', level: 'error', profiles: ['build', 'maintain'], check: taskAfterMissing },
  { id: 'gate.task-after-unknown', level: 'error', profiles: ['build', 'maintain'], check: taskAfterUnknown },
  { id: 'gate.task-code-block', level: 'error', profiles: ['build', 'maintain'], check: taskCodeBlock },
  { id: 'gate.task-too-long', level: 'error', profiles: ['build', 'maintain'], check: taskTooLong },
  { id: 'gate.task-file-unknown', level: 'error', profiles: ['build', 'maintain'], check: taskFileUnknown },
  { id: 'gate.task-model-missing', level: 'error', profiles: ['build', 'maintain'], check: taskModelMissing },
  { id: 'gate.task-model-unknown', level: 'error', profiles: ['build', 'maintain'], check: taskModelUnknown },
  { id: 'gate.task-after-cycle', level: 'error', profiles: ['build', 'maintain'], check: taskAfterCycle },
  { id: 'gate.plan-ac-uncovered', level: 'error', profiles: ['build', 'maintain'], check: acUncovered },
  { id: 'gate.slice-tasks', level: 'error', profiles: ['build', 'maintain'], check: sliceTasks },
  { id: 'gate.slice-ac-missing', level: 'error', profiles: ['build', 'maintain'], check: sliceAcMissing },
  { id: 'gate.slice-ac-uncovered', level: 'error', profiles: ['build', 'maintain'], check: sliceAcUncovered },
  { id: 'gate.slice-order', level: 'error', profiles: ['build', 'maintain'], check: sliceOrder },
  { id: 'gate.repo-unknown', level: 'error', profiles: ['build', 'maintain'], check: repoUnknown },
  { id: 'gate.repo-tests-missing', level: 'error', profiles: ['build', 'maintain'], check: repoTestsMissing },
  { id: 'gate.repo-baseline-missing', level: 'error', profiles: ['build', 'maintain'], check: repoBaselineMissing },
  { id: 'gate.repo-baseline-unknown', level: 'error', profiles: ['build', 'maintain'], check: repoBaselineUnknown },
  { id: 'gate.task-repo-mixed', level: 'error', profiles: ['build', 'maintain'], check: taskRepoMixed },
  { id: 'gate.slice-repo-mixed', level: 'error', profiles: ['build', 'maintain'], check: sliceRepoMixed },
  { id: 'gate.repo-slices', level: 'error', profiles: ['build', 'maintain'], check: repoSlices },
  { id: 'gate.slice-many', level: 'warning', profiles: ['build', 'maintain'], check: sliceMany },
  { id: 'gate.slice-large', level: 'warning', profiles: ['build', 'maintain'], check: sliceLarge },
  { id: 'gate.plan-decision-uncited', level: 'error', profiles: ['build', 'maintain'], check: decisionUncited },
  { id: 'gate.plan-ref-unknown', level: 'error', profiles: ['build', 'maintain'], check: refUnknown },
  { id: 'gate.plan-test-unmapped', level: 'error', profiles: ['build', 'maintain'], check: testUnmapped },
  { id: 'gate.plan-test-repeated', level: 'error', profiles: ['build', 'maintain'], check: testRepeated },
  { id: 'gate.plan-map-invalid', level: 'error', profiles: ['build', 'maintain'], check: mapInvalid },
  { id: 'gate.plan-deferral', level: 'error', profiles: ['build', 'maintain'], check: deferral },
  { id: 'gate.plan-verify-at', level: 'error', profiles: ['build', 'maintain'], check: verifyAt },
  { id: 'gate.plan-verify-comma', level: 'error', profiles: ['build', 'maintain'], check: verifyComma },
  { id: 'gate.plan-rounds', level: 'error', profiles: ['build', 'maintain'], check: planRounds },
  { id: 'gate.tests-baseline-missing', level: 'warning', profiles: ['build', 'maintain'], check: testsBaselineMissing },
];

const REVIEW_MISSING: GateRule = { id: 'gate.review-missing', level: 'error', profiles: ['build', 'maintain'], check: reviewMissing };
const REVIEW_UNCONVERGED: GateRule = { id: 'gate.review-unconverged', level: 'error', profiles: ['build', 'maintain'], check: reviewUnconverged };
/** ST-LN-17 AC-3: the cap and the stop from round 3 in review.md, for lane M and lane S alike. */
const REVIEW_ROUNDS: GateRule = { id: 'gate.review-rounds', level: 'error', profiles: ['build', 'maintain'], check: reviewRounds };
/** ST-LN-57: the record against git (version, heads, marks, final review) and D-10's notice that those checks were skipped. */
const REVIEW_SCOPE: GateRule = { id: 'gate.review-scope', level: 'error', profiles: ['build', 'maintain'], check: reviewScope };
const REVIEW_SCOPE_SKIPPED: GateRule = { id: 'gate.review-scope-skipped', level: 'warning', profiles: ['build', 'maintain'], check: reviewScopeSkipped };
/** ST-LN-57 ac-2: from round 3 a new Must or Should outside the last fix's files needs a test or command, or a deferral. */
const FINDING_EVIDENCE: GateRule = { id: 'gate.finding-evidence', level: 'error', profiles: ['build', 'maintain'], check: findingEvidence };
/** ST-LN-57 ac-4: from round 3 a new Should rests on a ticket line, a failing test or a command. */
const FINDING_GROUNDS: GateRule = { id: 'gate.finding-grounds', level: 'error', profiles: ['build', 'maintain'], check: findingGrounds };
/** ST-LN-57 ac-5: a file a fix changed is the location of a finding or named by a Ruling. */
const FIX_FILE_UNEXPLAINED: GateRule = { id: 'gate.fix-file-unexplained', level: 'error', profiles: ['build', 'maintain'], check: fixFileUnexplained };
/** ST-LN-56 56-ac-1: from FIX_RECORD_FROM a finding recorded `fixed in <sha>` lists the places the same claim or pattern was checked; one row for both Done tables. */
const FIX_PLACES_MISSING: GateRule = { id: 'gate.fix-places-missing', level: 'error', profiles: ['build', 'maintain'], check: fixPlacesMissing };
/** ST-LN-56 56-ac-2: from FIX_RECORD_FROM a fix closes only on the re-review's `addressed:` mark, and the last round's fix has had no re-review; one row for both Done tables. */
const FIX_NOT_ADDRESSED: GateRule = { id: 'gate.fix-not-addressed', level: 'error', profiles: ['build', 'maintain'], check: fixNotAddressed };
/** ST-LN-56 56-ac-2 (D-10): from FIX_RECORD_FROM a re-review finding outside the fix diff goes to Deferred and starts no round; one row for both Done tables. */
const FIX_OUTSIDE_OPEN: GateRule = { id: 'gate.fix-outside-open', level: 'error', profiles: ['build', 'maintain'], check: fixOutsideOpen };
/** ST-LN-36 36-ac-2 (D-05 (3), D-10): from SECURITY_TRIGGER_FROM a review round whose package had security triggers needs `Security: lens security ran`, and every round but a final review a `Security:` line; one row for both Done tables. */
const SECURITY_UNREVIEWED: GateRule = { id: 'gate.security-unreviewed', level: 'error', profiles: ['build', 'maintain'], check: securityUnreviewed };
/** Phase 8.1 D-17 (8.1-ac-13): from SLOP_FROM a slop hit of the ticket's cumulative diff is fixed or named by a `slop:<kind> <path>:<line> — <reason>` line in the last review round; one row for both Done tables, none for lane R (no review). */
const SLOP_UNRESOLVED: GateRule = { id: 'gate.slop-unresolved', level: 'error', profiles: ['build', 'maintain'], check: slopUnresolved };
const SUITE_NOT_PASSED: GateRule = { id: 'gate.suite-not-passed', level: 'error', profiles: ['build', 'maintain'], check: suiteNotPassed };
const COMMIT_TRAILER: GateRule = { id: 'gate.commit-trailer', level: 'error', profiles: ['build', 'maintain'], check: commitTrailer };
/** Phase 8.1 D-06, D-07: under commits.message every ticket-branch commit passes the rule (merge commits, default-branch commits and Revert subjects excepted); a ticket claimed before COMMIT_MESSAGE_FROM is not judged; one row for all three Done tables. */
const COMMIT_MESSAGE: GateRule = { id: 'gate.commit-message', level: 'error', profiles: ['build', 'maintain'], check: commitMessage };
/** ST-LN-62: Done reads the branch diff of every ticket with `lane:`; no diff, an empty diff, or in lane S a diff without the ticket file, fails closed. */
const BRANCH_UNKNOWN: GateRule = { id: 'gate.branch-unknown', level: 'error', profiles: ['build', 'maintain'], check: branchUnknown };

/** ST-LN-62 D-04: a sign of a new interface in a path no sensitive entry matches, in every lane that carries `lane:`. */
const INTERFACE_SIGN: GateRule = { id: 'gate.interface-sign', level: 'error', profiles: ['build', 'maintain'], check: interfaceSign };

/** GATE-02/GATE-03/GATE-11 (docs/design.md §5). Every row is an error on both profiles: Done is the
 * gate that must not be talked past, and GATE-06 forbids a level that depends on a flag. */
export const DONE_RULES: readonly GateRule[] = [
  TICKET_UNKNOWN,
  // Phase 15 D-23: a pull request that changes a ticket done on the base branch is refused with this one finding, and gateDone runs only this row for such a ticket (D-24, D-25).
  // It takes no claimPinBefore cut-off: it adds a refusal only for a pull request that changes a done ticket, so a ticket claimed under an older pin loses nothing it had.
  { id: 'gate.done-ticket-edited', level: 'error', profiles: ['build', 'maintain'], check: doneTicketEdited },
  RULESET_CHANGED,
  RULESET_MISSING,
  { id: 'gate.verification-unfinished', level: 'error', profiles: ['build', 'maintain'], check: verificationUnfinished },
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
  // Phase 08.9.3 D-07, D-13, Pitfall 9: the other repository's part of the ticket, from the verifier's record in verification.md; each behind REPOS_FROM through claimPinBefore
  { id: 'gate.repo-record-missing', level: 'error', profiles: ['build', 'maintain'], check: repoRecordMissing },
  COMMIT_TRAILER,
  COMMIT_MESSAGE,
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
  REVIEW_ROUNDS,
  REVIEW_SCOPE,
  REVIEW_SCOPE_SKIPPED,
  FINDING_EVIDENCE,
  FINDING_GROUNDS,
  FIX_FILE_UNEXPLAINED,
  FIX_PLACES_MISSING,
  FIX_NOT_ADDRESSED,
  FIX_OUTSIDE_OPEN,
  SECURITY_UNREVIEWED,
  SLOP_UNRESOLVED,
  SUITE_NOT_PASSED,
  { id: 'gate.test-untraced', level: 'error', profiles: ['build', 'maintain'], check: testUntracedAtDone },
  // GATE-05 (D-79): warnings, and never more. docs/design.md §4 makes the reviewer not a role, so the
  // two identities match on nearly every honest ticket; an error here would block every solo developer.
  { id: 'gate.author-match', level: 'warning', profiles: ['build', 'maintain'], check: authorMatch },
  { id: 'gate.author-skipped', level: 'warning', profiles: ['build', 'maintain'], check: authorSkipped },
  // Phase 15 D-06: the measured size of the slice `--slice n` judged, over the review budget; the split is shown and nothing blocks.
  { id: 'gate.slice-diff-large', level: 'warning', profiles: ['build', 'maintain'], check: sliceDiffLarge },
];

/**
 * ST-LN-94 D-10, research Pitfall 8: the plan gate of a lane R ticket. gatePlan picks it for lane R as gateDone picks DONE_S_RULES for
 * lane S, so every PLAN_RULES row (the plan.ts rules, the plan rounds, the plan format rules) is out of R's reach through one choice.
 */
export const PLAN_R_RULES: readonly GateRule[] = [
  TICKET_UNKNOWN,
  RULESET_CHANGED,
  RULESET_MISSING,
  { id: 'gate.lane-r-plan', level: 'error', profiles: ['build', 'maintain'], check: laneRPlan },
];

/**
 * ST-LN-31 and ST-LN-94: lanes S and R both hash their sections at Ready, so one row each serves both Done tables (GATE-06). Each half is silent
 * for the other lane.
 */
const READY_MISSING: GateRule = {
  id: 'gate.ready-missing',
  level: 'error',
  profiles: ['build', 'maintain'],
  check: (s, id) => [...readyMissing(s, id), ...researchReadyMissing(s, id)],
};
const SECTIONS_CHANGED: GateRule = {
  id: 'gate.sections-changed',
  level: 'error',
  profiles: ['build', 'maintain'],
  check: (s, id) => [...sectionsChanged(s, id), ...researchSectionsChanged(s, id)],
};

/** ST-LN-31 D-04, D-12: the lane S Done table, with the suite rule; no plan, task, criteria or approval rows. */
export const DONE_S_RULES: readonly GateRule[] = [
  TICKET_UNKNOWN,
  { id: 'gate.done-ticket-edited', level: 'error', profiles: ['build', 'maintain'], check: doneTicketEdited },
  RULESET_CHANGED,
  RULESET_MISSING,
  SECTION_EMPTY,
  READY_MISSING,
  SECTIONS_CHANGED,
  REVIEW_MISSING,
  REVIEW_UNCONVERGED,
  REVIEW_ROUNDS,
  REVIEW_SCOPE,
  REVIEW_SCOPE_SKIPPED,
  FINDING_EVIDENCE,
  FINDING_GROUNDS,
  FIX_FILE_UNEXPLAINED,
  FIX_PLACES_MISSING,
  FIX_NOT_ADDRESSED,
  FIX_OUTSIDE_OPEN,
  SECURITY_UNREVIEWED,
  SLOP_UNRESOLVED,
  { id: 'gate.review-trailing', level: 'error', profiles: ['build', 'maintain'], check: reviewTrailing },
  { id: 'gate.review-uncommitted', level: 'error', profiles: ['build', 'maintain'], check: reviewUncommitted },
  { id: 'gate.review-commit-code', level: 'error', profiles: ['build', 'maintain'], check: reviewCommitCode },
  { id: 'gate.commit-after-review', level: 'error', profiles: ['build', 'maintain'], check: commitAfterReview },
  SUITE_NOT_PASSED,
  COMMIT_TRAILER,
  COMMIT_MESSAGE,
  BRANCH_UNKNOWN,
  { id: 'gate.out-of-scope', level: 'error', profiles: ['build', 'maintain'], check: outOfScope },
  { id: 'gate.sensitive-touched', level: 'error', profiles: ['build', 'maintain'], check: sensitiveTouched },
  INTERFACE_SIGN,
];

/**
 * ST-LN-94 D-10, D-11, 94-ac-2, 94-ac-3, research Pitfall 8: the lane R Done table. gateDone picks it for lane R, so no lane M Done row (plan,
 * tasks, ticks, review, verification, suite, scope, interface signs) reaches an R ticket, whatever stray records it holds. It is done on a
 * listed research record with its Spent line, spent within the ticket's allowance or answered by the owner (D-14), and a branch that changes
 * nothing outside accord/ (UAT decision 3, 2026-11-14).
 */
export const DONE_R_RULES: readonly GateRule[] = [
  TICKET_UNKNOWN,
  { id: 'gate.done-ticket-edited', level: 'error', profiles: ['build', 'maintain'], check: doneTicketEdited },
  RULESET_CHANGED,
  RULESET_MISSING,
  RESEARCH_FIELD_MISSING,
  RESEARCH_BUDGET_UNANSWERED,
  READY_MISSING,
  SECTIONS_CHANGED,
  { id: 'gate.research-record-missing', level: 'error', profiles: ['build', 'maintain'], check: researchRecordMissing },
  { id: 'gate.research-spent-missing', level: 'error', profiles: ['build', 'maintain'], check: researchSpentMissing },
  { id: 'gate.research-over-budget', level: 'error', profiles: ['build', 'maintain'], check: researchOverBudget },
  { id: 'gate.research-shipped', level: 'error', profiles: ['build', 'maintain'], check: researchShipped },
  BRANCH_UNKNOWN,
  COMMIT_TRAILER,
  COMMIT_MESSAGE,
];

/** D-89: the three LINT-06 hygiene rules Ready promotes from warning to blocking. */
export const READY_PROMOTE: readonly string[] = ['lint.sentinel', 'lint.open-question', 'lint.assumption-unconfirmed'];

/** D-88/GATE-07: the token and size rules, softened on `maintain`: the data of PRESETS.maintain (config/strictness.ts). Disjoint from READY_PROMOTE. */
export { MAINTAIN_DOWNGRADE };

/**
 * GATE-07: the whole profile matrix, applied once in the shared engine body so every gate inherits it.
 * `build` has no preset level, so a finding changes there only by a team key. On `maintain` a finding of one of the four MAINTAIN_DOWNGRADE rules takes the level the resolved strictness holds for it:
 * the preset's warning, or the team's own `strictness.levels` key, which wins over the preset (D-09). The lint stamp has already applied that level to a table
 * finding; this pass is what reaches a finding stamped elsewhere (a loader finding is stamped error, D-58). A rule the team turned off is left alone here: its table findings
 * were dropped at the stamp. GATE-12 is then a one-cell table edit (D-88). `levels` defaults to the profile's preset.
 */
export function downgradeMaintain(
  findings: Finding[],
  profile: 'build' | 'maintain',
  levels: Strictness['levels'] = PRESETS[profile].levels,
): Finding[] {
  return findings.map((f) => {
    const level = MAINTAIN_DOWNGRADE.includes(f.rule) && Object.hasOwn(levels, f.rule) ? levels[f.rule] : undefined;
    return level === 'error' || level === 'warning' ? { ...f, level } : f;
  });
}
