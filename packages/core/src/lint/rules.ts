// CORE-04 rule matrix (D-57): one row per rule id with its level and profiles. The engine stamps
// `rule` and `level` from the row (D-58), so a level literal for a `lint.*` rule appears nowhere else.
import type { Finding, Level } from '../model/finding.js';
import type { RepoSnapshot } from '../model/snapshot.js';
import { earsUnclassified } from './ears.js';
import {
  acTagDuplicate,
  acTagMissing,
  acTagMultiple,
  noScenarios,
  reportMissing,
  stepEmpty,
  testIdUnknown,
  testTagDuplicate,
  testTagMissing,
  testTagOnUi,
} from './gherkin.js';
import {
  assumptionUnconfirmed,
  headingMissing,
  idMismatch,
  intentOversize,
  noteOrphan,
  notesNotLast,
  openQuestion,
  planEmpty,
  planStepUntagged,
  planTagsDiffer,
  requirementsOversize,
  scenariosOversize,
  sentinel,
  tickOrphan,
  trackerEmpty,
  vagueWording,
} from './ticket.js';
import { prototypeDerivation, tokenHardcoded, tokensMissing } from './tokens.js';

/** What a check returns; the engine adds `rule` and `level` from the table row. */
export type Draft = Omit<Finding, 'level' | 'rule'>;

export interface Rule {
  id: `lint.${string}`; // D-59: mirrors the loader's `load.<name>` ids
  level: Level; // D-56
  profiles: readonly ('build' | 'maintain')[]; // D-57: both, for every rule in v0.1
  check: (snapshot: RepoSnapshot) => Draft[]; // pure; reads the snapshot only
}

export const RULES: readonly Rule[] = [
  { id: 'lint.id-mismatch', level: 'error', profiles: ['build', 'maintain'], check: idMismatch },
  { id: 'lint.test-tag-missing', level: 'warning', profiles: ['build', 'maintain'], check: testTagMissing },
  { id: 'lint.heading-missing', level: 'error', profiles: ['build', 'maintain'], check: headingMissing },
  { id: 'lint.tracker-empty', level: 'warning', profiles: ['build', 'maintain'], check: trackerEmpty },
  { id: 'lint.tick-orphan', level: 'warning', profiles: ['build', 'maintain'], check: tickOrphan },
  { id: 'lint.assumption-unconfirmed', level: 'warning', profiles: ['build', 'maintain'], check: assumptionUnconfirmed },
  { id: 'lint.sentinel', level: 'warning', profiles: ['build', 'maintain'], check: sentinel },
  { id: 'lint.open-question', level: 'warning', profiles: ['build', 'maintain'], check: openQuestion },
  { id: 'lint.vague-wording', level: 'warning', profiles: ['build', 'maintain'], check: vagueWording },
  { id: 'lint.intent-oversize', level: 'warning', profiles: ['build', 'maintain'], check: intentOversize },
  { id: 'lint.requirements-oversize', level: 'warning', profiles: ['build', 'maintain'], check: requirementsOversize },
  { id: 'lint.scenarios-oversize', level: 'warning', profiles: ['build', 'maintain'], check: scenariosOversize },
  { id: 'lint.plan-step-untagged', level: 'warning', profiles: ['build', 'maintain'], check: planStepUntagged },
  { id: 'lint.plan-tags-differ', level: 'warning', profiles: ['build', 'maintain'], check: planTagsDiffer },
  { id: 'lint.plan-empty', level: 'warning', profiles: ['build', 'maintain'], check: planEmpty },
  { id: 'lint.note-orphan', level: 'warning', profiles: ['build', 'maintain'], check: noteOrphan },
  { id: 'lint.notes-not-last', level: 'warning', profiles: ['build', 'maintain'], check: notesNotLast },
  { id: 'lint.ears-unclassified', level: 'warning', profiles: ['build', 'maintain'], check: earsUnclassified },
  { id: 'lint.ac-tag-missing', level: 'error', profiles: ['build', 'maintain'], check: acTagMissing },
  { id: 'lint.ac-tag-multiple', level: 'error', profiles: ['build', 'maintain'], check: acTagMultiple },
  { id: 'lint.ac-tag-duplicate', level: 'error', profiles: ['build', 'maintain'], check: acTagDuplicate },
  { id: 'lint.step-empty', level: 'error', profiles: ['build', 'maintain'], check: stepEmpty },
  { id: 'lint.no-scenarios', level: 'error', profiles: ['build', 'maintain'], check: noScenarios },
  { id: 'lint.test-tag-duplicate', level: 'error', profiles: ['build', 'maintain'], check: testTagDuplicate },
  { id: 'lint.test-tag-on-ui', level: 'warning', profiles: ['build', 'maintain'], check: testTagOnUi },
  { id: 'lint.test-id-unknown', level: 'warning', profiles: ['build', 'maintain'], check: testIdUnknown },
  { id: 'lint.report-missing', level: 'warning', profiles: ['build', 'maintain'], check: reportMissing },
  { id: 'lint.token-hardcoded', level: 'warning', profiles: ['build', 'maintain'], check: tokenHardcoded },
  { id: 'lint.tokens-missing', level: 'warning', profiles: ['build', 'maintain'], check: tokensMissing },
  { id: 'lint.prototype-derivation', level: 'warning', profiles: ['build', 'maintain'], check: prototypeDerivation },
];
