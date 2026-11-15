// ST-LN-50 t2-ac-5 (level half), D-08, D-09: `strictness.levels.<rule id>` lowers an OVERRIDABLE rule through the engines' one stamping place, and no key
// reaches a LOCKED rule (the floor), a STAGE_OWNED rule or an unknown id. Every rule id sits in exactly one class, and the LOCKED list is named here as a
// literal, so adding to or removing from the floor is a visible diff of this file.
import { describe, expect, it } from 'vitest';
import { PRESETS, effectiveLevel, floorProblems, gateDone, gateReady, lintSnapshot, loadSnapshot, resolveStrictness, LOCKED, NO_OFF, OVERRIDABLE, STAGE_OF } from '../src/index.js';
import type { AccordConfig, RepoSnapshot } from '../src/index.js';
import { DONE_R_RULES, DONE_RULES, DONE_S_RULES, MAINTAIN_DOWNGRADE, PLAN_R_RULES, PLAN_RULES, READY_PROMOTE, READY_RULES } from '../src/gate/rules.js';
import { RULES } from '../src/lint/rules.js';
import { CONFIG, laneTicket } from '../../../test/helpers/lane.js';

const levels = (l: Record<string, 'error' | 'warning' | 'off'>): AccordConfig => ({ strictness: { levels: l } }) as AccordConfig;
const strictOf = (l: Record<string, 'error' | 'warning' | 'off'>) => resolveStrictness(levels(l));
const cfg = (l: Record<string, string>): string => CONFIG + 'strictness:\n  levels:\n' + Object.entries(l).map(([k, v]) => `    ${k}: ${v}\n`).join('');

/** Every rule id the engines run: the six gate tables and the lint table. */
const ALL_IDS = [...new Set([...READY_RULES, ...PLAN_RULES, ...DONE_RULES, ...DONE_S_RULES, ...DONE_R_RULES, ...PLAN_R_RULES].map((r) => r.id as string)), ...RULES.map((r) => r.id as string)];
const TABLE_LEVEL = new Map<string, 'error' | 'warning'>([...READY_RULES, ...PLAN_RULES, ...DONE_RULES, ...DONE_S_RULES, ...DONE_R_RULES, ...PLAN_R_RULES, ...RULES].map((r) => [r.id, r.level]));

// The floor, written out: intent and acceptance criteria before code, independent verification before done, the security and data-loss rules, and the
// integrity of the ruleset, the lane and the config. Sorted by code point.
const LOCKED_LIST = [
  'gate.ac-changed',
  'gate.ac-hash-missing',
  'gate.approval-missing',
  'gate.approval-stale',
  'gate.branch-unknown',
  'gate.commit-missing',
  'gate.ears-missing',
  'gate.evidence-unresolved',
  'gate.intent-empty',
  'gate.interface-sign',
  'gate.lane-missing',
  'gate.lane-r-plan',
  'gate.no-scenarios',
  'gate.note-missing',
  'gate.note-pasted',
  'gate.note-unresolved',
  'gate.out-of-scope',
  'gate.ready-missing',
  'gate.report-missing',
  'gate.research-budget-unanswered',
  'gate.research-field-missing',
  'gate.research-over-budget',
  'gate.research-record-missing',
  'gate.research-shipped',
  'gate.research-spent-missing',
  'gate.result-not-pass',
  'gate.ruleset-changed',
  'gate.ruleset-missing',
  'gate.section-empty',
  'gate.sections-changed',
  'gate.sensitive-touched',
  'gate.sha-too-short',
  'gate.stale-review',
  'gate.suite-not-passed',
  'gate.tags-differ',
  'gate.test-not-passed',
  'gate.test-tag-missing',
  'gate.test-unknown',
  'gate.test-untraced',
  'gate.tests-unconfigured',
  'gate.tick-stale-commit',
  'gate.tick-stale-hash',
  'gate.tick-unbound',
  'gate.ticket-unknown',
  'gate.verification-missing',
  'lint.ac-tag-duplicate',
  'lint.ac-tag-missing',
  'lint.ac-tag-multiple',
  'lint.config-floor',
  'lint.heading-missing',
  'lint.id-mismatch',
  'lint.lane-s-lane-m-records',
  'lint.no-scenarios',
  'lint.step-empty',
  'lint.subject-duplicate',
  'lint.test-tag-duplicate',
];

describe('the classification', () => {
  it('risk:security every rule is classified and the floor list is named (ST-LN-50 t2-ac-5)', () => {
    const classes = [LOCKED, Object.keys(STAGE_OF), OVERRIDABLE];
    // exactly one class per id
    const seen = new Map<string, number>();
    for (const c of classes) for (const id of c) seen.set(id, (seen.get(id) ?? 0) + 1);
    expect([...seen].filter(([, n]) => n !== 1).map(([id]) => id)).toEqual([]);
    // every rule id the engines run is classified, and nothing is classified that no table holds
    expect(ALL_IDS.filter((id) => !seen.has(id)).sort()).toEqual([]);
    expect([...seen.keys()].filter((id) => !ALL_IDS.includes(id)).sort()).toEqual([]);
    // the floor is a literal list
    expect([...LOCKED]).toEqual(LOCKED_LIST);
    expect([...LOCKED]).toEqual([...LOCKED].sort());
  });

  it('risk:security every LOCKED rule is an error in its table, and a stage is one of the four a team may switch (ST-LN-50 t2-ac-5)', () => {
    for (const id of LOCKED) expect(TABLE_LEVEL.get(id), id).toBe('error');
    for (const stage of Object.values(STAGE_OF)) expect(['discuss', 'approach', 'plan', 'review']).toContain(stage);
  });

  it('risk:security the three Ready-promoted hygiene rules take no off, and are overridable otherwise (ST-LN-50 t2-ac-5)', () => {
    expect([...NO_OFF].sort()).toEqual([...READY_PROMOTE].sort());
    for (const id of NO_OFF) expect(OVERRIDABLE).toContain(id);
  });

  it('risk:security the classes the plan names as research calls (ST-LN-50 t2-ac-5)', () => {
    expect(STAGE_OF['gate.review-missing']).toBe('review');
    expect(STAGE_OF['gate.plan-size']).toBe('plan');
    expect(STAGE_OF['gate.discuss-missing']).toBe('discuss');
    expect(STAGE_OF['gate.approach-empty']).toBe('approach');
    expect(OVERRIDABLE).toContain('gate.design-missing');
    expect(OVERRIDABLE).toContain('lint.sentinel');
  });
});

describe('effectiveLevel', () => {
  it('risk:security a LOCKED rule keeps its table level for every config, up or down (ST-LN-50 t2-ac-5)', () => {
    for (const id of LOCKED) {
      for (const v of ['error', 'warning', 'off'] as const) {
        expect(effectiveLevel(id, 'error', strictOf({ [id]: v })), `${id} ${v}`).toBe('error');
        // a hand-built Strictness that still carries the key (a host that skipped resolveStrictness)
        expect(effectiveLevel(id, 'error', { rounds: {}, levels: { [id]: v } }), `${id} ${v} raw`).toBe('error');
      }
    }
  });

  it('risk:security an OVERRIDABLE rule follows its key, and a STAGE_OWNED or unknown id ignores it (ST-LN-50 t2-ac-5)', () => {
    expect(effectiveLevel('gate.design-missing', 'error', strictOf({ 'gate.design-missing': 'warning' }))).toBe('warning');
    expect(effectiveLevel('gate.design-missing', 'error', strictOf({ 'gate.design-missing': 'off' }))).toBe('off');
    expect(effectiveLevel('gate.design-missing', 'error', strictOf({}))).toBe('error');
    expect(effectiveLevel('lint.vague-wording', 'warning', strictOf({ 'lint.vague-wording': 'error' }))).toBe('error');
    expect(effectiveLevel('gate.review-missing', 'error', { rounds: {}, levels: { 'gate.review-missing': 'off' } })).toBe('error');
    expect(effectiveLevel('gate.nosuch', 'error', { rounds: {}, levels: { 'gate.nosuch': 'off' } })).toBe('error');
    // the Ready-promoted three: warning and error, never off
    expect(effectiveLevel('lint.sentinel', 'warning', { rounds: {}, levels: { 'lint.sentinel': 'off' } })).toBe('warning');
    expect(effectiveLevel('lint.sentinel', 'warning', strictOf({ 'lint.sentinel': 'error' }))).toBe('error');
  });

  it('risk:parsing resolveStrictness keeps a preset first, the team keys over it, and drops the keys the floor names (ST-LN-50 t2-ac-5)', () => {
    expect(PRESETS.build.levels).toEqual({});
    expect(PRESETS.maintain.levels).toEqual({});
    expect(resolveStrictness(undefined).levels).toEqual({});
    expect(
      resolveStrictness(levels({ 'gate.design-missing': 'off', 'gate.verification-missing': 'off', 'gate.review-missing': 'off', 'gate.nosuch': 'off', 'lint.sentinel': 'off', 'lint.vague-wording': 'error' })).levels,
    ).toEqual({ 'gate.design-missing': 'off', 'lint.vague-wording': 'error' });
  });
});

describe('floorProblems', () => {
  it('risk:security names a LOCKED, a STAGE_OWNED, an unknown and a Ready-promoted-off key, each with its reason (ST-LN-50 t2-ac-5)', () => {
    const p = floorProblems(levels({ 'gate.verification-missing': 'off', 'gate.review-missing': 'off', 'gate.nosuch': 'off', 'lint.sentinel': 'off', 'gate.design-missing': 'off', 'lint.vague-wording': 'warning', 'lint.open-question': 'error' }));
    expect(p.map((x) => x.pointer)).toEqual([
      '/strictness/levels/gate.verification-missing',
      '/strictness/levels/gate.review-missing',
      '/strictness/levels/gate.nosuch',
      '/strictness/levels/lint.sentinel',
    ]);
    expect(p[0].reason).toContain('on the floor: independent verification before done');
    expect(p[1].reason).toContain('follows strictness.stages');
    expect(p[2].reason).toContain('no such rule');
    expect(p[3].reason).toContain('error or warning');
    expect(floorProblems(undefined)).toEqual([]);
    expect(floorProblems({} as AccordConfig)).toEqual([]);
  });
});

const SENTINEL_BODY = ['## Intent', 'TODO write this', ''].join('\n');

describe('the engines', () => {
  const build = (extra: Record<string, string>, ticket = laneTicket('T-1').replace('ui: false', 'ui: true')): RepoSnapshot => {
    const files = { 'accord/config.yml': extra['accord/config.yml'] ?? CONFIG, 'accord/tickets/T-1.md': ticket };
    return loadSnapshot({ files, tree: Object.keys(files).sort() });
  };
  const ready = (config: string, ticket?: string) => gateReady(build({ 'accord/config.yml': config }, ticket), 'T-1');

  it('risk:security gate ready: an overridable rule is lowered, a floor rule is not (ST-LN-50 t2-ac-5)', () => {
    expect(ready(CONFIG).findings.find((f) => f.rule === 'gate.design-missing')?.level).toBe('error');
    expect(ready(cfg({ 'gate.design-missing': 'warning' })).findings.find((f) => f.rule === 'gate.design-missing')?.level).toBe('warning');
    expect(ready(cfg({ 'gate.design-missing': 'off' })).findings.some((f) => f.rule === 'gate.design-missing')).toBe(false);
    // the floor: approval-missing stays an error whatever the config says
    expect(ready(cfg({ 'gate.approval-missing': 'off' })).findings.find((f) => f.rule === 'gate.approval-missing')?.level).toBe('error');
  });

  it('risk:security gate done: verification-missing stays an error when a hand-edited config turns it off (ST-LN-50 t2-ac-5)', () => {
    const done = gateDone(build({ 'accord/config.yml': cfg({ 'gate.verification-missing': 'off' }) }, laneTicket('T-1')), 'T-1');
    expect(done.verdict).toBe('fail');
    expect(done.findings.find((f) => f.rule === 'gate.verification-missing')?.level).toBe('error');
  });

  it('risk:security lint: levels apply to lint rules, and lint.config-floor names each refused key (ST-LN-50 t2-ac-5)', () => {
    const body = laneTicket('T-1', { body: SENTINEL_BODY });
    const sentinels = (config: string) => lintSnapshot(build({ 'accord/config.yml': config }, body)).findings.filter((f) => f.rule === 'lint.sentinel');
    expect(sentinels(CONFIG).every((f) => f.level === 'warning')).toBe(true);
    expect(sentinels(CONFIG).length).toBeGreaterThan(0);
    expect(sentinels(cfg({ 'lint.sentinel': 'error' })).every((f) => f.level === 'error')).toBe(true);

    const bad = lintSnapshot(build({ 'accord/config.yml': cfg({ 'gate.verification-missing': 'off', 'gate.design-missing': 'off' }) }, body));
    const floor = bad.findings.filter((f) => f.rule === 'lint.config-floor');
    expect(floor).toHaveLength(1);
    expect(floor[0]).toMatchObject({ file: 'accord/config.yml', level: 'error', pointer: '/strictness/levels/gate.verification-missing' });
    expect(floor[0].reason).toContain('gate.verification-missing');
  });

  it('risk:security a team that lowers lint.sentinel to warning still cannot pass Ready with a sentinel (ST-LN-50 t2-ac-5)', () => {
    const r = ready(cfg({ 'lint.sentinel': 'warning' }), laneTicket('T-1', { body: SENTINEL_BODY }));
    expect(r.findings.find((f) => f.rule === 'lint.sentinel')?.level).toBe('error');
    expect(r.verdict).toBe('fail');
  });

  it('risk:regression a repository with no strictness.levels answers as before (ST-LN-50 t2-ac-6)', () => {
    const none = lintSnapshot(build({}));
    const empty = lintSnapshot(build({ 'accord/config.yml': CONFIG + 'strictness:\n  rounds:\n    plan: "2"\n' }));
    expect(empty.findings).toEqual(none.findings);
    expect(ready(CONFIG).verdict).toBe('fail');
  });
});

// ST-LN-50 D-09, t2-ac-6: `profile` is the base preset of levels, held as data; one key overrides it; Ready's promotion comes after the team's level.
describe('the profile is the base preset (ST-LN-50 t2-ac-6)', () => {
  const MAINTAIN_PRESET = Object.fromEntries(MAINTAIN_DOWNGRADE.map((id) => [id, 'warning']));
  const withLevels = (profile: 'build' | 'maintain', l: Record<string, 'error' | 'warning' | 'off'>): AccordConfig => ({ profile, strictness: { levels: l } }) as AccordConfig;

  // A loader finding is stamped error (D-58) and reaches the maintain downgrade the way a real one does; the four ids are warnings in the lint table, so
  // this is the one way to see the preset on an error row.
  const gateLevels = (profile: 'build' | 'maintain', extra: string): Map<string, string> => {
    const config = CONFIG.replace('profile: build', `profile: ${profile}`) + extra;
    const files = { 'accord/config.yml': config, 'accord/tickets/T-1.md': laneTicket('T-1') };
    const base = loadSnapshot({ files, tree: Object.keys(files).sort() });
    const snap: RepoSnapshot = { ...base, errors: [...base.errors, ...MAINTAIN_DOWNGRADE.map((rule) => ({ file: 'accord/tickets/T-1.md', rule, reason: 'r' }))] };
    return new Map(gateReady(snap, 'T-1').findings.filter((f) => MAINTAIN_DOWNGRADE.includes(f.rule)).map((f) => [f.rule, f.level]));
  };

  it('risk:regression PRESETS.maintain holds the four MAINTAIN_DOWNGRADE ids at warning and PRESETS.build none', () => {
    expect(PRESETS.maintain.levels).toEqual(MAINTAIN_PRESET);
    expect(PRESETS.build.levels).toEqual({});
    expect(PRESETS.maintain.rounds).toEqual({});
    expect(PRESETS.build.rounds).toEqual({});
  });

  it('risk:regression resolveStrictness starts from the profile, and one team key on the same rule wins over the preset', () => {
    expect(resolveStrictness({ profile: 'maintain' } as AccordConfig).levels).toEqual(MAINTAIN_PRESET);
    expect(resolveStrictness({ profile: 'build' } as AccordConfig).levels).toEqual({});
    expect(resolveStrictness(withLevels('maintain', { 'lint.token-hardcoded': 'error' })).levels).toEqual({ ...MAINTAIN_PRESET, 'lint.token-hardcoded': 'error' });
    expect(resolveStrictness(withLevels('build', { 'lint.intent-oversize': 'warning' })).levels).toEqual({ 'lint.intent-oversize': 'warning' });
    // the preset object itself is never written to
    expect(PRESETS.maintain.levels).toEqual(MAINTAIN_PRESET);
  });

  it('risk:regression on maintain the four rules are warnings as today, and a team key on one of them makes it an error', () => {
    for (const [id, level] of gateLevels('maintain', '')) expect(level, id).toBe('warning');
    const asked = gateLevels('maintain', 'strictness:\n  levels:\n    lint.token-hardcoded: error\n');
    expect(asked.get('lint.token-hardcoded')).toBe('error');
    for (const id of MAINTAIN_DOWNGRADE.filter((x) => x !== 'lint.token-hardcoded')) expect(asked.get(id), id).toBe('warning');
  });

  it('risk:regression on build the four rules keep their rows, and a team key sets one', () => {
    for (const [id, level] of gateLevels('build', '')) expect(level, id).toBe('error');
    const asked = gateLevels('build', 'strictness:\n  levels:\n    lint.intent-oversize: warning\n');
    expect(asked.get('lint.intent-oversize')).toBe('warning');
    expect(asked.get('lint.token-hardcoded')).toBe('error');
  });

  it('risk:security Ready keeps its promotion over a team level (ST-LN-50 t2-ac-5)', () => {
    const files = (extra: string) => ({ 'accord/config.yml': CONFIG + extra, 'accord/tickets/T-1.md': laneTicket('T-1', { body: SENTINEL_BODY }) });
    const snap = (extra: string) => loadSnapshot({ files: files(extra), tree: Object.keys(files(extra)).sort() });
    const warn = 'strictness:\n  levels:\n    lint.sentinel: warning\n';
    const ready = gateReady(snap(warn), 'T-1');
    expect(ready.verdict).toBe('fail');
    expect(ready.findings.filter((f) => f.rule === 'lint.sentinel').length).toBeGreaterThan(0);
    expect(ready.findings.filter((f) => f.rule === 'lint.sentinel').every((f) => f.level === 'error')).toBe(true);
    const plain = lintSnapshot(snap(warn)).findings.filter((f) => f.rule === 'lint.sentinel');
    expect(plain.length).toBeGreaterThan(0);
    expect(plain.every((f) => f.level === 'warning')).toBe(true);
    // maintain's preset does not reach the three promoted rules either
    expect(PRESETS.maintain.levels).not.toHaveProperty('lint.sentinel');
  });
});
