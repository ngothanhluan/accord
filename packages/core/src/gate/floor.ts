// ST-LN-50 D-01, D-08, D-09, GATE-06: the one list that says which rules a team may lower. Every gate and lint rule id is in exactly one class:
//   LOCKED      the floor: intent and acceptance criteria before code, independent verification before done, the security and data-loss rules, and the
//               integrity of the ruleset, the lane and the config. No key lowers or turns off a LOCKED rule, and none raises it either: each is an error already.
//   STAGE_OWNED belongs to discuss, approach, plan or review. It takes no level; it leaves only with its stage switch (`strictness.stages`), so `status` always
//               names what is off.
//   OVERRIDABLE its level may be set to error, warning or off with `strictness.levels.<rule id>`. The three Ready-promoted hygiene rules (NO_OFF) take error or
//               warning, never off, because Ready blocks on them.
// A rule added to a table without a class here fails packages/core/test/strictness.test.ts, and that test names the LOCKED list as a literal, so a change to the
// floor is a visible diff. Pure: no I/O, no config read beyond the value handed in.
import type { AccordConfig, RepoSnapshot } from '../model/snapshot.js';
import { resolveStrictness } from '../config/strictness.js';
import { teamSectionProblems } from '../scaffold/sections.js';
import type { Strictness } from '../config/strictness.js';

export type RuleLevel = 'error' | 'warning' | 'off';
/** The stages a team may switch off (D-08), by lane M, L or P; each owns rules in STAGE_OF. */
export const SWITCHABLE_STAGES = ['discuss', 'approach', 'plan', 'review'] as const;
export type StageName = (typeof SWITCHABLE_STAGES)[number];
/** D-08 floor: no key turns one of these off for any lane: intent and acceptance criteria before code, the change itself, independent verification before done. */
export const FLOOR_STAGES = ['intent', 'build', 'verify'] as const;
/** Every stage name a `strictness.stages.<lane>` key accepts for lanes M, L and P. */
export type ConfigStage = StageName | (typeof FLOOR_STAGES)[number];

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
    'gate.ruleset-changed', 'gate.ruleset-missing', 'gate.lane-r-plan', 'lint.subject-duplicate', 'lint.config-floor', 'lint.template-section',
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
  'gate.plan-unfinished': 'plan',
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
  'gate.task-model-missing': 'plan',
  'gate.task-model-unknown': 'plan',
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
export function effectiveLevel(id: string, tableLevel: 'error' | 'warning', strictness: Omit<Strictness, 'stages'>): RuleLevel {
  const set = Object.hasOwn(strictness.levels, id) ? strictness.levels[id] : undefined;
  if (set === undefined || !OVERRIDABLE_SET.has(id)) return tableLevel;
  if (set === 'off' && NO_OFF.includes(id)) return tableLevel;
  return set;
}

/** What each stage of the floor guards; the reason a refused stage key prints. */
const FLOOR_STAGE_WHY: Readonly<Record<(typeof FLOOR_STAGES)[number], string>> = {
  intent: 'intent and acceptance criteria before code',
  build: 'the change itself',
  verify: 'independent verification before done',
};

/** D-08 Ruling: lane S has no stage off the floor, by stage; its review is lane S's only independent check before done (DONE_S_RULES holds no verification row). */
const LANE_S_WHY: Readonly<Record<string, string>> = {
  intent: 'intent and acceptance criteria before code (Understood and Done when)',
  build: 'the change itself',
  review: "its review is lane S's only independent check before done (lane S has no verify stage)",
};

/** D-08 Ruling: lane R has no stage off the floor, by stage; it has no plan, review or verify to take the place of either. */
const LANE_R_WHY: Readonly<Record<string, string>> = {
  intent: 'the question, timebox and budget before the work',
  research: 'the work itself, whose record the owner reads before done',
};

/** Why `strictness.stages.<lane>.<stage>: off` may not stand, or undefined when it may (a stage of lane M, L or P that is not on the floor, or any value but `off`). */
function stageRefusal(lane: string, stage: string, value: unknown): string | undefined {
  if (value !== 'off') return undefined;
  if (lane === 'S') return `lane S has no stage off the floor: ${stage}: ${LANE_S_WHY[stage] ?? 'every stage of lane S is on the floor'}`;
  if (lane === 'R') return `lane R has no stage off the floor: ${stage}: ${LANE_R_WHY[stage] ?? 'every stage of lane R is on the floor'}`;
  if (lane === 'M' || lane === 'L' || lane === 'P') {
    return (FLOOR_STAGES as readonly string[]).includes(stage) ? `${stage} is on the floor: ${FLOOR_STAGE_WHY[stage as (typeof FLOOR_STAGES)[number]]}` : undefined;
  }
  return undefined;
}

/**
 * Every key of `strictness.levels` and `strictness.stages` the engines will ignore, each with why: lint reports them as lint.config-floor and `accord config` refuses them.
 * Every `template.sections` entry the template skips is listed too (lint.template-section, not lint.config-floor: `configFloor` leaves the `/template/` pointers to its own rule).
 * A stage key is refused when it says `off` for a floor stage (intent, build, verify) of lane M, L or P, or for any stage of lane S or lane R.
 */
export function floorProblems(config: AccordConfig | undefined): { pointer: string; reason: string }[] {
  const levels = config?.strictness?.levels;
  const found =
    levels === undefined || levels === null || typeof levels !== 'object'
      ? []
      : Object.entries(levels).flatMap(([id, value]) => {
          const reason = levelRefusal(id, value);
          return reason === undefined ? [] : [{ pointer: `/strictness/levels/${id}`, reason }];
        });
  const stages = config?.strictness?.stages;
  const stageKeys =
    stages === undefined || stages === null || typeof stages !== 'object'
      ? []
      : Object.entries(stages).flatMap(([lane, keys]) => {
          if (keys === undefined || keys === null || typeof keys !== 'object') return [];
          return Object.entries(keys).flatMap(([stage, value]) => {
            const reason = stageRefusal(lane, stage, value);
            return reason === undefined ? [] : [{ pointer: `/strictness/stages/${lane}/${stage}`, reason }];
          });
        });
  // D-10: a team section that replaces a required one, or gives acceptance criteria another form, is the same kind of key: the engines skip it and `accord config` refuses it
  return [...found, ...stageKeys, ...teamSectionProblems(config?.template?.sections)];
}

/**
 * D-08: is `stage` turned off for ticket `id`'s lane? Only a stage of lane M, L or P that is not on the floor can be: false for a floor stage, for every stage of lane S and lane R
 * (each of them is the floor: lane S's review is its only independent check, see 03.1-21's Rulings), for a ticket without a lane and for an unknown id. Resolved from the
 * config on every call, so a stage turned back on applies from the next command and nothing is cached.
 */
export function stageOff(snapshot: RepoSnapshot, id: string, stage: ConfigStage): boolean {
  const lane = Object.hasOwn(snapshot.tickets, id) ? snapshot.tickets[id].frontmatter?.lane : undefined;
  if (lane !== 'M' && lane !== 'L' && lane !== 'P') return false;
  return (resolveStrictness(snapshot.config).stages[lane] as ReadonlySet<string>).has(stage);
}
