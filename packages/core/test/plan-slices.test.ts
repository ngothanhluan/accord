// Phase 15 D-03, D-06, D-09: `## Slice <n>` sections of plan.md are read, and `gate plan` checks them: four errors, and two warnings that block nothing.
import { describe, expect, it } from 'vitest';
import { gatePlan, loadSnapshot, OVERRIDABLE, SLICES_FROM, validate } from '../src/index.js';
import type { GateResult } from '../src/index.js';
import { parsePlan } from '../src/load/work.js';
import { approved } from './helpers/approve.js';
import { CONFIG, junit, laneTicket, LANE_S_BODY, PLAN, REPORT, sized } from '../../../test/helpers/lane.js';

const SPLIT = 'split the work into an epic of smaller stories with /accord <request> (lane L)';

/** The lane plan's two tasks, then tasks 3 to n, each `covers: @ac-1` (the ticket holds @ac-1 and @ac-2), with no slice. */
const tasks = (n: number): string => {
  const [head, one, two] = PLAN.split(/^(?=## Task )/m);
  const more = Array.from({ length: Math.max(0, n - 2) }, (_, i) => `## Task ${i + 3}: Step ${i + 3}\ncovers: @ac-1\nfiles: src/export.ts\nverify: export#writes-csv\nafter: none\nDo step ${i + 3}.\n`);
  return [head, one, two, ...more].join('\n');
};

const slice = (n: number, taskNumbers: string, covers: string, estimate?: string): string =>
  `\n## Slice ${n}: Part ${n}\ntasks: ${taskNumbers}\ncovers: ${covers}\n${estimate === undefined ? '' : `estimate: ${estimate}\n`}Part ${n} of the work.\n`;

// Four tasks: 1 and 3 and 4 cover @ac-1, 2 covers @ac-2.
const FOUR = tasks(4);

interface Opts {
  lane?: string;
  body?: string;
  plan?: string;
  config?: string;
  claim?: { pin: string } | { error: string } | null; // null: no claim fact
}
const check = ({ lane, body = sized(8), plan = FOUR, config = CONFIG, claim = { pin: SLICES_FROM } }: Opts = {}): GateResult => {
  const files: Record<string, string> = approved(
    {
      'accord/config.yml': config,
      'accord/tickets/T-1.md': laneTicket('T-1', { body, ...(lane === undefined ? {} : { lane }) }),
      [REPORT]: junit({ 'export#writes-csv': 'passed', 'export#escapes-commas': 'passed' }),
      'accord/tickets/T-1/plan.md': plan,
    },
    'T-1',
  );
  const snapshot = loadSnapshot({ files, tree: Object.keys(files).sort() });
  return gatePlan(claim === null ? snapshot : { ...snapshot, claimPins: { 'T-1': claim } }, 'T-1');
};
const rule = (r: GateResult, id: string) => r.findings.filter((f) => f.rule === id);
const slices = (r: GateResult) => r.findings.filter((f) => f.rule.startsWith('gate.slice-'));
const withBudget = (v: string): string => CONFIG.replace('mode: outcome', `mode: outcome\n  slice_lines: "${v}"`);

/** A sound plan: two slices that between them deliver both criteria. */
const SOUND = FOUR + slice(1, '1, 2', '@ac-1 @ac-2') + slice(2, '3, 4', '@ac-1');

describe('slices are read from plan.md', () => {
  it('risk:parsing a slice section reads its tasks, covers and estimate lines', () => {
    const text = '---\nbaseline: abc1234\n---\n# Plan\n' + FOUR.split('# Plan\n')[1] + slice(2, '3, 4', '@ac-2', 'code 300, test 600, docs 150');
    const { plan, findings } = parsePlan('plan.md', text);
    expect(findings).toEqual([]);
    expect(plan.slices).toHaveLength(1);
    expect(plan.slices![0]).toMatchObject({ n: 2, title: 'Part 2', tasks: [3, 4], covers: ['@ac-2'], estimate: { code: 300, test: 600, docs: 150 }, unread: [] });
    expect(plan.tasks).toHaveLength(4);
  });

  it('risk:parsing an estimate that does not read goes to unread, and skills count with docs', () => {
    const lots = parsePlan('plan.md', '## Slice 1: A\ntasks: 1\ncovers: @ac-1\nestimate: lots\n').plan.slices![0];
    expect(lots.unread).toEqual(['lots']);
    expect(lots.estimate).toEqual({});
    const mixed = parsePlan('plan.md', '## Slice 1: A\ntasks: 1, x\ncovers: @ac-1\nestimate: code 10, docs 5, skills 7, test many\n').plan.slices![0];
    expect(mixed.estimate).toEqual({ code: 10, docs: 12 });
    expect(mixed.tasks).toEqual([1]);
    expect(mixed.unread).toEqual(['x', 'test', 'many']);
  });

  it('risk:parsing a second heading of one slice number is a load finding and the first is kept', () => {
    const { plan, findings } = parsePlan('plan.md', '## Slice 2: A\ntasks: 1\ncovers: @ac-1\n\n## Slice 2: B\ntasks: 2\ncovers: @ac-2\n');
    expect(findings).toEqual([{ file: 'plan.md', line: 5, rule: 'load.slice-duplicate', reason: 'duplicate "## Slice 2"; the first occurrence is used' }]);
    expect(plan.slices).toHaveLength(1);
    expect(plan.slices![0].title).toBe('A');
  });

  it('risk:parsing a field line inside a fence is not read', () => {
    const { plan } = parsePlan('plan.md', '## Slice 1: A\n```\ntasks: 9\n```\ntasks: 1\ncovers: @ac-1\n');
    expect(plan.slices![0].tasks).toEqual([1]);
  });

  it('risk:parsing a plan with no slice heading has no slices key, and a slice written first stays out of the preamble (Ruling R9)', () => {
    const plain = parsePlan('plan.md', PLAN).plan;
    expect('slices' in plain).toBe(false);
    expect(plain.preamble).toBe('\n# Plan\n\n');
    const first = parsePlan('plan.md', 'Intro line.\n\n## Slice 1: A\ntasks: 1\ncovers: @ac-1\n\n## Task 1: One\ncovers: @ac-1\n').plan;
    expect(first.preamble).toBe('Intro line.\n\n');
    expect(first.tasks).toHaveLength(1);
  });
});

describe('the slice rules', () => {
  it('risk:complex-branching a sound sliced plan passes with no slice finding', () => {
    const r = check({ plan: SOUND });
    expect(slices(r)).toEqual([]);
    expect(r.verdict).toBe('pass');
  });

  it('risk:complex-branching gate.slice-tasks names a task in no slice, a task in two slices, a task that does not exist and slice numbers that skip', () => {
    const none = rule(check({ plan: FOUR + slice(1, '1, 2', '@ac-1 @ac-2') + slice(2, '4', '@ac-1') }), 'gate.slice-tasks');
    expect(none).toHaveLength(1);
    expect(none[0].reason).toContain('task 3');
    expect(none[0].level).toBe('error');

    const twice = rule(check({ plan: FOUR + slice(1, '1, 2', '@ac-1 @ac-2') + slice(2, '2, 3, 4', '@ac-1 @ac-2') }), 'gate.slice-tasks');
    expect(twice).toHaveLength(1);
    expect(twice[0].reason).toContain('task 2');
    expect(twice[0].reason).toContain('slices 1 and 2');

    const ghost = rule(check({ plan: FOUR + slice(1, '1, 2, 3, 4, 9', '@ac-1 @ac-2') }), 'gate.slice-tasks');
    expect(ghost).toHaveLength(1);
    expect(ghost[0].reason).toContain('task 9');

    const skip = rule(check({ plan: FOUR + slice(1, '1, 2', '@ac-1 @ac-2') + slice(3, '3, 4', '@ac-1') }), 'gate.slice-tasks');
    expect(skip).toHaveLength(1);
    expect(skip[0].reason).toContain('1, 3');
  });

  it('risk:complex-branching gate.slice-ac-missing names a slice with an empty covers line and a criterion none of its tasks covers', () => {
    const empty = rule(check({ plan: FOUR + slice(1, '1, 2', '') + slice(2, '3, 4', '@ac-1') }), 'gate.slice-ac-missing');
    expect(empty).toHaveLength(1);
    expect(empty[0].reason).toContain('slice 1');
    expect(empty[0].level).toBe('error');

    const foreign = rule(check({ plan: FOUR + slice(1, '1, 2', '@ac-1 @ac-2') + slice(2, '3, 4', '@ac-1 @ac-2') }), 'gate.slice-ac-missing');
    expect(foreign).toHaveLength(1);
    expect(foreign[0].reason).toContain('slice 2');
    expect(foreign[0].reason).toContain('@ac-2');
  });

  it('risk:complex-branching gate.slice-ac-uncovered names a criterion that no slice delivers', () => {
    const r = check({ plan: FOUR + slice(1, '1, 2', '@ac-1') + slice(2, '3, 4', '@ac-1') });
    const f = rule(r, 'gate.slice-ac-uncovered');
    expect(f).toHaveLength(1);
    expect(f[0].reason).toContain('@ac-2');
    expect(r.verdict).toBe('fail');
  });

  it('risk:complex-branching gate.slice-order names a task that follows a task of a later slice', () => {
    const plan = FOUR.replace('after: 1', 'after: 3') + slice(1, '1, 2', '@ac-1 @ac-2') + slice(2, '3, 4', '@ac-1');
    const f = rule(check({ plan }), 'gate.slice-order');
    expect(f).toHaveLength(1);
    expect(f[0].reason).toContain('task 2');
    expect(f[0].reason).toContain('task 3');
    expect(f[0].reason).toContain('slice 2');
    expect(f[0].level).toBe('error');
    expect(rule(check({ plan: SOUND }), 'gate.slice-order')).toEqual([]);
  });

  it('risk:complex-branching more than three slices is one warning naming the epic, and three is none', () => {
    const four = FOUR + slice(1, '1', '@ac-1') + slice(2, '2', '@ac-2') + slice(3, '3', '@ac-1') + slice(4, '4', '@ac-1');
    const r = check({ plan: four });
    const f = rule(r, 'gate.slice-many');
    expect(f).toHaveLength(1);
    expect(f[0].level).toBe('warning');
    expect(f[0].reason).toContain('4 slices');
    expect(f[0].reason).toContain(SPLIT);
    expect(r.verdict).toBe('pass');

    const three = FOUR + slice(1, '1', '@ac-1') + slice(2, '2', '@ac-2') + slice(3, '3, 4', '@ac-1');
    expect(rule(check({ plan: three }), 'gate.slice-many')).toEqual([]);
  });

  it('risk:complex-branching a slice over the review budget is a warning that shows the split, and the budget key lifts it', () => {
    const plan = FOUR + slice(1, '1, 2', '@ac-1 @ac-2', 'code 100') + slice(2, '3, 4', '@ac-1', 'code 300, test 600, docs 150');
    const r = check({ plan });
    const f = rule(r, 'gate.slice-large');
    expect(f).toHaveLength(1);
    expect(f[0].level).toBe('warning');
    expect(f[0].reason).toBe('slice 2 is about 1050 lines (code 300, test 600, docs 150), over the review budget of 1000');
    expect(r.verdict).toBe('pass');

    expect(rule(check({ plan, config: withBudget('1200') }), 'gate.slice-large')).toEqual([]);
    expect(rule(check({ plan, config: withBudget('1000') }), 'gate.slice-large')).toHaveLength(1);
    expect(rule(check({ plan, config: withBudget('1049') }), 'gate.slice-large')[0].reason).toContain('budget of 1049');
    // exactly the budget is not over it
    expect(rule(check({ plan: FOUR + slice(1, '1, 2', '@ac-1 @ac-2') + slice(2, '3, 4', '@ac-1', 'code 400, test 600') }), 'gate.slice-large')).toEqual([]);
    // a slice with no estimate line says nothing
    expect(rule(check({ plan: SOUND }), 'gate.slice-large')).toEqual([]);
  });

  it('risk:regression every slice rule is silent for a ticket claimed before SLICES_FROM and for a plan with no slice', () => {
    const broken = FOUR + slice(1, '1, 9', '') + slice(3, '1', '@ac-1', 'code 5000');
    expect(slices(check({ plan: broken }))).not.toEqual([]);
    expect(slices(check({ plan: broken, claim: { pin: '0.20.3' } }))).toEqual([]);
    expect(slices(check({ plan: broken, claim: null }))).toEqual([]); // the working-tree pin is the running release, below SLICES_FROM
    expect(slices(check({ plan: FOUR }))).toEqual([]);
    expect(slices(check({ plan: broken, lane: 'S', body: LANE_S_BODY }))).toEqual([]);
    // a failed claim read fails closed: the rules apply
    expect(slices(check({ plan: broken, claim: { error: 'git failed' } })).length).toBeGreaterThan(0);
  });

  it('risk:regression the errors hold under review mode human and outcome alike, and a team may lower the warnings only', () => {
    const plan = FOUR + slice(1, '1, 2', '@ac-1');
    for (const mode of ['human', 'outcome']) {
      const r = check({ plan, config: CONFIG.replace('mode: outcome', `mode: ${mode}`) });
      expect(rule(r, 'gate.slice-ac-uncovered')).toHaveLength(1);
      expect(rule(r, 'gate.slice-tasks').length).toBeGreaterThan(0);
    }
    expect(OVERRIDABLE).toContain('gate.slice-many');
    expect(OVERRIDABLE).toContain('gate.slice-large');
    for (const id of ['gate.slice-tasks', 'gate.slice-ac-missing', 'gate.slice-ac-uncovered', 'gate.slice-order']) expect(OVERRIDABLE).not.toContain(id);
  });
});

describe('review.slice_lines', () => {
  const config = (value: unknown): unknown => ({
    accord: SLICES_FROM,
    profile: 'build',
    tracker: { adapter: 'none' },
    design: { tokens: '' },
    roles: ['ba', 'dev'],
    runtimes: ['claude'],
    review: { mode: 'outcome', slice_lines: value },
  });

  it('risk:parsing the schema takes a numeric string of two to five digits and refuses 0 and words', () => {
    expect(validate('config', config('1000'))).toEqual([]);
    expect(validate('config', config('0'))).not.toEqual([]);
    expect(validate('config', config('abc'))).not.toEqual([]);
    expect(validate('config', config(1000))).not.toEqual([]);
  });
});
