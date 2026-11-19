// ST-LN-93: gate plan holds a plan to twice the size its Intent expects, and the owner's fixed-form Ruling lifts it.
import { describe, expect, it } from 'vitest';
import { gatePlan, loadSnapshot, OVERRIDABLE, PLAN_LARGE_FROM, PLAN_SIZE_FROM, pinAllowsV1, pinBefore, sizeRefusal, TITLE_RULE_FROM } from '../src/index.js';
import type { GateResult } from '../src/index.js';
import { PLAN_RULES } from '../src/gate/rules.js';
import { approved } from './helpers/approve.js';
import { CONFIG, junit, LANE_S_BODY, laneTicket, PLAN, REPORT, sized } from '../../../test/helpers/lane.js';

/** The lane plan's header and its first two tasks, then one `covers: @ac-1` task per number up to n; n = 0 is the header alone. */
const tasks = (n: number): string => {
  const [head, one, two] = PLAN.split(/^(?=## Task )/m);
  const more = Array.from({ length: Math.max(0, n - 2) }, (_, i) => `## Task ${i + 3}: More\ncovers: @ac-1\nfiles: src/export.ts\nverify: export#writes-csv\nMore.\n`);
  return [head, ...[one, two].slice(0, n), ...more].join(n > 0 ? '\n' : '');
};

const ruling = (m: number, n: number, quote = '"go on"'): string =>
  `- Ruling: the owner allows ${m} plan tasks against an expected size of ${n} tasks — ${quote} — cost if wrong: a big plan\n`;

interface Opts {
  body?: string;
  lane?: string;
  plan?: string | null; // null: no plan.md
  ledger?: string;
  config?: string;
  pins?: { pin?: string; basePin?: string }; // the host fact gate plan merges: the pin at the plan baseline and at its merge base
  claim?: { pin: string } | { error: string }; // the host fact gate plan merges: the pin the ticket was claimed under
}
const check = ({ body = sized(2), lane, plan = tasks(5), ledger, config = at('0.4.0'), pins, claim }: Opts = {}): GateResult => {
  const files: Record<string, string> = approved(
    {
      'accord/config.yml': config,
      'accord/tickets/T-1.md': laneTicket('T-1', { body, ...(lane === undefined ? {} : { lane }) }),
      [REPORT]: junit({ 'export#writes-csv': 'passed', 'export#escapes-commas': 'passed' }),
    },
    'T-1',
  );
  if (plan !== null) files['accord/tickets/T-1/plan.md'] = plan;
  if (ledger !== undefined) files['accord/tickets/T-1/ledger.md'] = ledger;
  const snapshot = loadSnapshot({ files, tree: Object.keys(files).sort() });
  const withPins = pins === undefined ? snapshot : { ...snapshot, planPins: { 'T-1': pins } };
  return gatePlan(claim === undefined ? withPins : { ...withPins, claimPins: { 'T-1': claim } }, 'T-1');
};
const size = (r: GateResult) => r.findings.filter((f) => f.rule === 'gate.plan-size');
const missing = (r: GateResult) => r.findings.filter((f) => f.rule === 'gate.plan-size-missing');
// A release moves CONFIG's pin, so every case names the pin it means.
const at = (v: string): string => CONFIG.replace(/accord: "[^"]*"/, `accord: "${v}"`);

describe('plan size', () => {
  it('risk:complex-branching a plan over twice its expected size fails gate plan and names both numbers (ST-LN-93 ac-1)', () => {
    const r = check();
    expect(r.verdict).toBe('fail');
    const f = size(r);
    expect(f).toHaveLength(1);
    expect(f[0].level).toBe('error');
    expect(f[0].reason).toContain('5 tasks');
    expect(f[0].reason).toContain('2 × 2');
    expect(f[0].reason).toContain('Expected size: 2 tasks');
    expect(size(check({ plan: tasks(4) }))).toEqual([]); // exactly 2 × 2
    expect(size(check({ plan: tasks(6), body: sized(3) }))).toEqual([]); // exactly 2 × 3
    expect(size(check({ plan: tasks(7), body: sized(3) }))).toHaveLength(1); // 2 × 3 + 1
    for (const line of ['Expected size: 2 tasks.', '- Expected size: 2 tasks', 'Expected size: 2 task']) {
      const body = sized().replace('## Intent\n', `## Intent\n${line}\n`);
      expect(size(check({ body }))).toHaveLength(1);
      expect(size(check({ body, plan: tasks(4) }))).toEqual([]);
    }
  });

  it("risk:complex-branching the owner's size Ruling in the fixed form lets the plan pass (ST-LN-93 ac-2)", () => {
    expect(size(check({ ledger: ruling(5, 2) }))).toEqual([]);
    expect(size(check({ ledger: ruling(9, 2) }))).toEqual([]); // m above the task count
    expect(size(check({ ledger: '## Rulings\n' + ruling(5, 2) }))).toEqual([]);
    expect(size(check({ ledger: ruling(4, 2) }))).toHaveLength(1); // fewer than the 5 tasks
    expect(size(check({ ledger: ruling(5, 3) }))).toHaveLength(1); // another N
    expect(size(check({ ledger: '- Ruling: the owner allows 5 plan tasks against an expected size of 2 tasks — cost if wrong: a big plan\n' }))).toHaveLength(1); // no quoted sentence
    expect(size(check({ ledger: ruling(5, 2, '""') }))).toHaveLength(1); // an empty quote
    expect(size(check({ ledger: '- Ruling: the owner allows 5 plan tasks against an expected size of 2 tasks — "go on"\n' }))).toHaveLength(1); // no cost
    expect(size(check({ ledger: '- the owner allows 5 plan tasks against an expected size of 2 tasks — "go on" — cost if wrong: x\n' }))).toHaveLength(1); // not a Ruling line
    expect(size(check({ ledger: ruling(5, 2).replace('plan tasks', 'more review rounds') }))).toHaveLength(1);
  });

  it('risk:complex-branching the reason names the Ruling form that lifts it (ST-LN-93 ac-2)', () => {
    const reason = size(check())[0].reason as string;
    expect(reason).toContain('Ruling: the owner allows 5 plan tasks against an expected size of 2 tasks — "<the owner\'s sentence>" — <cost if wrong>');
  });

  it('risk:regression lane S and planless tickets get no size finding (ST-LN-93 ac-1)', () => {
    expect(size(check({ lane: 'S', body: LANE_S_BODY }))).toEqual([]);
    expect(size(check({ plan: null }))).toEqual([]);
    expect(size(check({ plan: '---\nbaseline: abc1234\n---\n# Plan\n' }))).toEqual([]);
    expect(size(check({ body: sized(), plan: tasks(30) }))).toEqual([]); // no line: gate.plan-size-missing speaks, not this
  });

  it('risk:regression an Expected size line of 0 or a non-number reads as no line (ST-LN-93 ac-1)', () => {
    for (const line of ['Expected size: 0 tasks', 'Expected size: many tasks', 'Expected size: 2.5 tasks', 'Expected size: -2 tasks']) {
      const body = sized().replace('## Intent\n', `## Intent\n${line}\n`);
      expect(size(check({ body }))).toEqual([]);
    }
  });

  it('risk:regression covers rules already name the criterion a task serves (ST-LN-93 D-10)', () => {
    const ids = PLAN_RULES.map((r) => r.id);
    expect(ids).toContain('gate.task-covers-missing');
    expect(ids).toContain('gate.plan-ref-unknown');
  });
});

describe('expected size cut-off', () => {
  const sizeless = { body: sized() };

  it('risk:complex-branching a ticket with no expected size fails gate plan from the cut-off pin and passes before it (ST-LN-93 ac-3)', () => {
    expect(missing(check({ ...sizeless, pins: { pin: '0.4.0' } }))).toEqual([]);
    const r = check({ ...sizeless, plan: tasks(2), pins: { pin: PLAN_SIZE_FROM } });
    expect(r.verdict).toBe('fail');
    const f = missing(r);
    expect(f).toHaveLength(1);
    expect(f[0].level).toBe('error');
    expect(f[0].reason).toContain('Expected size: <N> tasks');
    expect(f[0].reason).toContain('## Intent');
    expect(f[0].reason).toContain(PLAN_SIZE_FROM);
    // a baseline pin lowered below the pin at its merge base counts as at the cut-off
    expect(missing(check({ ...sizeless, pins: { pin: '0.4.0', basePin: PLAN_SIZE_FROM } }))).toHaveLength(1);
    expect(missing(check({ ...sizeless, pins: { pin: '0.4.0', basePin: '0.4.0' } }))).toEqual([]);
    // no host fact: the pin in the working-tree config decides (0.4.0 here)
    expect(missing(check({ ...sizeless }))).toEqual([]);
    expect(missing(check({ ...sizeless, config: at(PLAN_SIZE_FROM) }))).toHaveLength(1);
    // 0.4.10 counts as after 0.4.1; a pin that is not a plain x.y.z applies the rule
    expect(missing(check({ ...sizeless, pins: { pin: '0.4.10' } }))).toHaveLength(1);
    expect(missing(check({ ...sizeless, pins: { pin: '0.4.1-rc.1' } }))).toHaveLength(1);
    expect(missing(check({ ...sizeless, pins: {} }))).toHaveLength(1);
  });

  it('risk:complex-branching a ticket with an expected size, or in lane S, never gets gate.plan-size-missing (ST-LN-93 ac-3)', () => {
    for (const pin of ['0.4.0', PLAN_SIZE_FROM, '0.4.10', '0.5.0', 'next']) expect(missing(check({ pins: { pin } }))).toEqual([]);
    expect(missing(check({ lane: 'S', body: LANE_S_BODY, pins: { pin: PLAN_SIZE_FROM } }))).toEqual([]);
    expect(missing(check({ ...sizeless, plan: null, pins: { pin: PLAN_SIZE_FROM } }))).toEqual([]);
    expect(missing(check({ ...sizeless, plan: tasks(0), pins: { pin: PLAN_SIZE_FROM } }))).toEqual([]);
  });

  it('risk:regression pinBefore orders versions by number and keeps pinAllowsV1 (ST-LN-93 ac-3)', () => {
    expect(PLAN_SIZE_FROM).toBe('0.4.1');
    expect(pinBefore('0.4.1', '0.4.0')).toBe(true);
    expect(pinBefore('0.4.1', '0.4.1')).toBe(false);
    expect(pinBefore('0.4.1', '0.4.10')).toBe(false);
    expect(pinBefore('0.4.1', undefined)).toBe(false);
    expect(pinBefore('0.4.1', '0.4.0', '0.4.1')).toBe(false);
    expect(pinBefore('0.4.1', '0.4.0', 'main')).toBe(true);
    expect(pinAllowsV1('0.3.0')).toBe(true);
    expect(pinAllowsV1('0.3.1')).toBe(false);
    expect(pinAllowsV1(undefined)).toBe(false);
    expect(pinAllowsV1('0.3.0', '0.3.1')).toBe(false);
    expect(pinAllowsV1('0.3.0', 'main')).toBe(true);
  });
});

// ST-LN-28 7-ac-9 (07-25, D-17): an oversized plan is pointed at an epic of smaller stories, and a plan of 15 tasks or more gets a warning that names the same split, from a cut-off.
const SPLIT = 'split the work into an epic of smaller stories with /accord-new (lane L)';
/** The lane plan's two real tasks, then n - 2 more that each follow nothing and re-run the first test: well formed under every plan format rule. */
const many = (n: number): string => {
  const [head, one, two] = PLAN.split(/^(?=## Task )/m);
  const more = (i: number): string =>
    [`## Task ${i}: Step ${i}`, 'covers: @ac-1', 'files: src/export.ts', 'verify: export#writes-csv', 'after: none', `Do step ${i}.`, ''].join('\n');
  return [head, one, two, ...Array.from({ length: n - 2 }, (_, i) => more(i + 3))].join('\n');
};
const large = (r: GateResult) => r.findings.filter((f) => f.rule === 'gate.plan-large');

describe('an oversized plan points to an epic', () => {
  it('risk:complex-branching an oversized plan points to an epic (ST-LN-28 7-ac-9)', () => {
    // the refusal names the split and keeps the Ruling text after it
    const reason = sizeRefusal(9, 4, []) as string;
    expect(reason).toContain(SPLIT);
    expect(reason).toContain('Ruling: the owner allows 9 plan tasks against an expected size of 4 tasks');
    expect(reason.indexOf(SPLIT)).toBeLessThan(reason.indexOf('Ruling: the owner allows'));
    expect(size(check())[0].reason).toContain(SPLIT);
    // a lane M plan of 15 tasks within its size, claimed at the cut-off: the warning names the same split and fails nothing
    const claim = { pin: PLAN_LARGE_FROM };
    const fifteen = check({ body: sized(8), plan: many(15), claim });
    const warn = large(fifteen);
    expect(warn).toHaveLength(1);
    expect(warn[0].level).toBe('warning');
    expect(warn[0].file).toBe('accord/tickets/T-1/plan.md');
    expect(warn[0].reason).toContain('plan.md has 15 tasks');
    expect(warn[0].reason).toContain(SPLIT);
    expect(fifteen.verdict).toBe('pass');
    expect(size(fifteen)).toEqual([]);
    // 14 tasks give no warning, and 30 tasks over the size still fail on the size rule, with the warning beside it
    expect(large(check({ body: sized(8), plan: many(14), claim }))).toEqual([]);
    expect(check({ body: sized(8), plan: many(14), claim }).verdict).toBe('pass');
    const thirty = check({ body: sized(2), plan: many(30), claim });
    expect(thirty.verdict).toBe('fail');
    expect(size(thirty)).toHaveLength(1);
    expect(large(thirty)).toHaveLength(1);
    // lane S and a planless ticket get none
    expect(large(check({ lane: 'S', body: LANE_S_BODY, plan: many(15), claim }))).toEqual([]);
    expect(large(check({ plan: null, claim }))).toEqual([]);
  });

  it('risk:complex-branching the plan-large warning judges only tickets claimed at or after its cut-off (ST-LN-28 7-ac-9)', () => {
    const at15 = (claim?: { pin: string } | { error: string }, config?: string) => large(check({ body: sized(8), plan: many(15), claim, config }));
    expect(PLAN_LARGE_FROM).toBe(TITLE_RULE_FROM);
    // claimed under the release before the cut-off: not judged, whatever the plan
    expect(at15({ pin: '0.7.1' })).toEqual([]);
    expect(at15({ pin: '0.7.1' }, at(PLAN_LARGE_FROM))).toEqual([]); // the working-tree pin never outranks the claim fact
    // claimed at the cut-off or later: judged
    expect(at15({ pin: PLAN_LARGE_FROM })).toHaveLength(1);
    // no claim fact: the working-tree pin decides, before and at the cut-off
    expect(at15(undefined)).toEqual([]);
    expect(at15(undefined, at(PLAN_LARGE_FROM))).toHaveLength(1);
    // a failed claim read fails closed: the warning applies
    expect(at15({ error: 'git failed' })).toHaveLength(1);
    // a team may lower it, as any rule that is not on the floor
    expect(OVERRIDABLE).toContain('gate.plan-large');
  });
});
