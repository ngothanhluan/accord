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
import { designMissing, earsMissing, intentEmpty, ticketUnknown } from './ready.js';
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
 * GATE-02: neither gate may pass an id the snapshot does not carry. One row referenced by both tables,
 * never two copies, so a level or profile change can never reach one gate and miss the other (GATE-06).
 */
const TICKET_UNKNOWN: GateRule = {
  id: 'gate.ticket-unknown',
  level: 'error',
  profiles: ['build', 'maintain'],
  check: ticketUnknown,
};

export const READY_RULES: readonly GateRule[] = [
  TICKET_UNKNOWN,
  { id: 'gate.design-missing', level: 'error', profiles: ['build', 'maintain'], check: designMissing },
  { id: 'gate.intent-empty', level: 'error', profiles: ['build', 'maintain'], check: intentEmpty },
  { id: 'gate.ears-missing', level: 'error', profiles: ['build', 'maintain'], check: earsMissing },
];

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
  // GATE-05 (D-79): warnings, and never more. docs/design.md §4 makes the reviewer not a role, so the
  // two identities match on nearly every honest ticket; an error here would block every solo developer.
  { id: 'gate.author-match', level: 'warning', profiles: ['build', 'maintain'], check: authorMatch },
  { id: 'gate.author-skipped', level: 'warning', profiles: ['build', 'maintain'], check: authorSkipped },
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
