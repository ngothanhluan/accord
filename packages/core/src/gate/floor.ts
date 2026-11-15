// ST-LN-50 D-01, D-08, D-09, GATE-06: the one list that says which rules a team may lower. Every gate and lint rule id is in exactly one class:
//   LOCKED      the floor: intent and acceptance criteria before code, independent verification before done, the security and data-loss rules, and the
//               integrity of the ruleset, the lane and the config. No key lowers or turns off a LOCKED rule, and none raises it either: each is an error already.
//   STAGE_OWNED belongs to discuss, approach, plan or review. It takes no level; it leaves only with its stage switch (`strictness.stages`), so `status` always
//               names what is off.
//   OVERRIDABLE its level may be set to error, warning or off with `strictness.levels.<rule id>`. The three Ready-promoted hygiene rules (NO_OFF) take error or
//               warning, never off, because Ready blocks on them.
// A rule added to a table without a class here fails packages/core/test/strictness.test.ts, and that test names the LOCKED list as a literal, so a change to the
// floor is a visible diff. Pure: no I/O, no config read beyond the value handed in.
import type { AccordConfig } from '../model/snapshot.js';
import type { Strictness } from '../config/strictness.js';

export type RuleLevel = 'error' | 'warning' | 'off';
export type StageName = 'discuss' | 'approach' | 'plan' | 'review';

/** The floor, by what each rule guards; the reason a refused key prints is the group's. */
const FLOOR: Record<string, readonly string[]> = {
  'intent and acceptance criteria before code': [
    'gate.ticket-unknown', 'gate.intent-empty', 'gate.ears-missing', 'gate.section-empty', 'gate.ready-missing', 'gate.sections-changed',
    'gate.approval-missing', 'gate.approval-stale', 'gate.lane-missing', 'gate.research-field-missing', 'gate.research-budget-unanswered',
    'lint.heading-missing', 'lint.id-mismatch', 'lint.ac-tag-missing', 'lint.ac-tag-multiple', 'lint.ac-tag-duplicate', 'lint.step-empty',
    'lint.no-scenarios', 'lint.test-tag-duplicate',
  ],
  'independent verification before done': [
    'gate.no-scenarios', 'gate.tags-differ', 'gate.verification-missing', 'gate.result-not-pass', 'gate.commit-missing', 'gate.sha-too-short',
    'gate.ac-hash-missing', 'gate.ac-changed', 'gate.tick-unbound', 'gate.tick-stale-hash', 'gate.tick-stale-commit', 'gate.stale-review',
    'gate.test-tag-missing', 'gate.tests-unconfigured', 'gate.report-missing', 'gate.test-unknown', 'gate.test-not-passed', 'gate.test-untraced',
    'gate.suite-not-passed', 'gate.evidence-unresolved', 'gate.note-missing', 'gate.note-unresolved', 'gate.note-pasted',
    'gate.research-record-missing', 'gate.research-spent-missing', 'gate.research-over-budget', 'gate.research-shipped',
  ],
  'the security and data-loss rules': ['gate.sensitive-touched', 'gate.out-of-scope', 'gate.interface-sign', 'gate.branch-unknown', 'lint.lane-s-lane-m-records'],
  'which rules apply, which lane a ticket is in and what the config says': [
    'gate.ruleset-changed', 'gate.ruleset-missing', 'gate.lane-r-plan', 'lint.subject-duplicate', 'lint.config-floor',
  ],
};

/** Every LOCKED rule id, sorted by code point. */
export const LOCKED: readonly string[] = Object.values(FLOOR).flat().sort();

const WHY = new Map<string, string>(Object.entries(FLOOR).flatMap(([why, ids]) => ids.map((id) => [id, why] as const)));

/** The stage a STAGE_OWNED rule belongs to. A stage switch (plans 03.1-21 to 03.1-25) is the only thing that takes the rule away. */
export const STAGE_OF: Readonly<Record<string, StageName>> = {
  'gate.discuss-missing': 'discuss',
  'gate.discuss-unmapped': 'discuss',
  'gate.approach-empty': 'approach',
  // the plan gate and the plan record: every row of PLAN_RULES that is not on the floor, the plan-size rules among them, and the lint rules about the plan
  'gate.plan-missing': 'plan',
  'gate.plan-empty': 'plan',
  'gate.plan-size': 'plan',
  'gate.plan-size-missing': 'plan',
  'gate.plan-baseline-missing': 'plan',
  'gate.plan-baseline-unknown': 'plan',
  'gate.task-covers-missing': 'plan',
  'gate.task-verify-missing': 'plan',
  'gate.task-after-missing': 'plan',
  'gate.task-after-unknown': 'plan',
  'gate.task-code-block': 'plan',
  'gate.task-too-long': 'plan',
  'gate.task-file-unknown': 'plan',
  'gate.plan-ac-uncovered': 'plan',
  'gate.plan-decision-uncited': 'plan',
  'gate.plan-ref-unknown': 'plan',
  'gate.plan-test-unmapped': 'plan',
  'gate.plan-test-repeated': 'plan',
  'gate.plan-map-invalid': 'plan',
  'gate.plan-deferral': 'plan',
  'gate.plan-verify-at': 'plan',
  'gate.plan-verify-comma': 'plan',
  'gate.plan-rounds': 'plan',
  'gate.tests-baseline-missing': 'plan',
  'gate.task-incomplete': 'plan',
  'lint.plan-step-untagged': 'plan',
  'lint.plan-tags-differ': 'plan',
  'lint.plan-empty': 'plan',
  'lint.review-without-plan': 'plan',
  'gate.review-missing': 'review',
  'gate.review-unconverged': 'review',
  'gate.review-rounds': 'review',
  'gate.review-scope': 'review',
  'gate.review-scope-skipped': 'review',
  'gate.finding-evidence': 'review',
  'gate.finding-grounds': 'review',
  'gate.fix-file-unexplained': 'review',
  'gate.review-trailing': 'review',
  'gate.review-uncommitted': 'review',
  'gate.review-commit-code': 'review',
  'gate.commit-after-review': 'review',
};

/** The rules a team may set a level on: hygiene, design, dependency, author and token rules. */
export const OVERRIDABLE: readonly string[] = [
  'gate.design-missing',
  'gate.depends-unmerged',
  'gate.commit-trailer',
  'gate.reference-unknown',
  'gate.author-match',
  'gate.author-skipped',
  'lint.depends-unknown',
  'lint.depends-cycle',
  'lint.depends-dropped',
  'lint.research-reference',
  'lint.dropped-reason',
  'lint.id-convention',
  'lint.initials-duplicate',
  'lint.tracker-empty',
  'lint.tick-orphan',
  'lint.assumption-unconfirmed',
  'lint.sentinel',
  'lint.open-question',
  'lint.vague-wording',
  'lint.intent-oversize',
  'lint.requirements-oversize',
  'lint.scenarios-oversize',
  'lint.ears-unclassified',
  'lint.note-orphan',
  'lint.notes-not-last',
  'lint.test-tag-missing',
  'lint.test-tag-on-ui',
  'lint.test-id-unknown',
  'lint.report-missing',
  'lint.test-untraced',
  'lint.token-hardcoded',
  'lint.tokens-missing',
  'lint.prototype-derivation',
  'lint.model-retired',
];

const OVERRIDABLE_SET: ReadonlySet<string> = new Set(OVERRIDABLE);

/** The Ready-promoted hygiene rules (READY_PROMOTE in rules.ts): error or warning, never off, because `accord gate ready` blocks on them. */
export const NO_OFF: readonly string[] = ['lint.assumption-unconfirmed', 'lint.open-question', 'lint.sentinel'];

const isKnown = (id: string): boolean => WHY.has(id) || Object.hasOwn(STAGE_OF, id) || OVERRIDABLE_SET.has(id);

/** Why a key `id: value` may not stand, or undefined when it may. The one place the three refusals are worded. */
export function levelRefusal(id: string, value: RuleLevel): string | undefined {
  const why = WHY.get(id);
  if (why !== undefined) return `${id} is on the floor: ${why}; no level changes it`;
  if (Object.hasOwn(STAGE_OF, id)) return `${id} follows strictness.stages (${STAGE_OF[id]}), not a level; it goes only when its stage is switched off`;
  if (!isKnown(id)) return `no such rule ${id}; the rule ids are the ones accord lint and accord gate print`;
  if (value === 'off' && NO_OFF.includes(id)) return `${id} is promoted to an error at gate ready, so it takes error or warning, not off`;
  return undefined;
}

/**
 * The level a rule runs at: the table's, unless the team set one on an OVERRIDABLE rule. A LOCKED, a STAGE_OWNED or an unknown id keeps the table level
 * whatever `strictness.levels` holds, so the floor holds even for a hand-edited config; a NO_OFF rule given `off` keeps the table level. The only place a level
 * changes: the engines call it where they stamp a finding, and no rule's check ever reads the config for its own level.
 */
export function effectiveLevel(id: string, tableLevel: 'error' | 'warning', strictness: Strictness): RuleLevel {
  const set = Object.hasOwn(strictness.levels, id) ? strictness.levels[id] : undefined;
  if (set === undefined || !OVERRIDABLE_SET.has(id)) return tableLevel;
  if (set === 'off' && NO_OFF.includes(id)) return tableLevel;
  return set;
}

/** Every key of `strictness.levels` the engines will ignore, each with why: lint reports them as lint.config-floor and `accord config` refuses them. */
export function floorProblems(config: AccordConfig | undefined): { pointer: string; reason: string }[] {
  const levels = config?.strictness?.levels;
  if (levels === undefined || levels === null || typeof levels !== 'object') return [];
  return Object.entries(levels).flatMap(([id, value]) => {
    const reason = levelRefusal(id, value);
    return reason === undefined ? [] : [{ pointer: `/strictness/levels/${id}`, reason }];
  });
}
