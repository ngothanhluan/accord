// ST-LN-10 10-ac-1: from PLAN_MODEL_FROM, gate plan asks every new path of a plan task for a model file: `<path> (new, like <model path>)`, or says why
// there is none: `<path> (new, no model: <reason>)`. A bare `(new)` is refused, and so is a model that does not exist at the plan baseline.
// The claim pin decides (D-16), as for the plan format rules. The plan text is read structurally: fixed fields at fixed positions.
import { describe, expect, it } from 'vitest';
import { gatePlan, loadSnapshot, PLAN_MODEL_FROM } from '../src/index.js';
import type { GateResult } from '../src/index.js';
import { parsePlan } from '../src/load/work.js';
import { approved } from './helpers/approve.js';
import { CONFIG, junit, laneTicket, REPORT } from '../../../test/helpers/lane.js';

const BASELINE = 'abc1234';
const HEAD = ['---', `baseline: ${BASELINE}`, 'plan_hash: "fnv1a64:061c24200fe9bbf9"', '---', '', '# Plan', ''];

/** One task whose `files:` line is `files`, with the other fields the older rules read. */
const task = (n: number, files: string, after = 'none'): string =>
  [`## Task ${n}: Step ${n}`, 'covers: @ac-1, @ac-2, D-01', `files: ${files}`, 'verify: export#writes-csv (@ac-1) export#escapes-commas (@ac-2)', `after: ${after}`, ''].join('\n');
const planOf = (...tasks: string[]): string => [...HEAD, ...tasks].join('\n');
/** A plan whose task 1 is correct and whose task 2 carries `files`. */
const two = (files: string, eol = '\n'): string => planOf(task(1, 'src/export.ts'), task(2, files, '1')).replace(/\n/g, eol);

type Claim = { pin?: string; basePin?: string } | { error: string };
interface Opts {
  plan?: string;
  claim?: Claim;
  baseline?: string[]; // the paths of the plan baseline commit
  config?: string;
  lane?: string;
}
const build = ({ plan = two('src/c.ts (new, like src/json.ts)'), claim, baseline = ['src/export.ts', 'src/json.ts'], config = CONFIG, lane }: Opts = {}) => {
  const files: Record<string, string> = approved(
    {
      'accord/config.yml': config,
      'accord/tickets/T-1.md': laneTicket('T-1', lane === undefined ? {} : { lane }),
      [REPORT]: junit({ 'export#writes-csv': 'passed', 'export#escapes-commas': 'passed' }),
      'accord/tickets/T-1/plan.md': plan,
    },
    'T-1',
  );
  const snapshot = loadSnapshot({ files, tree: Object.keys(files).sort() });
  return {
    ...snapshot,
    ...(claim === undefined ? {} : { claimPins: { 'T-1': claim } }),
    baselineFiles: { [BASELINE]: baseline },
  };
};
const check = (o: Opts = {}): GateResult => gatePlan(build(o), 'T-1');
const MODEL_RULES = ['gate.task-model-missing', 'gate.task-model-unknown'];
const model = (r: GateResult) => r.findings.filter((f) => MODEL_RULES.includes(f.rule));
const of = (r: GateResult, rule: string) => r.findings.filter((f) => f.rule === rule);
const NEW: Claim = { pin: PLAN_MODEL_FROM };

describe('plan model: the clause after a new path', () => {
  it('risk:parsing a files: line reads (new, like <path>) and (new, no model: <reason>) beside bare (new) (ST-LN-10 10-ac-1)', () => {
    const text = (files: string): string => planOf(task(1, files));
    const read = (files: string) => parsePlan('plan.md', text(files)).plan.tasks[0];

    const like = read('src/a.ts, src/csv.ts (new, like src/json.ts)');
    expect(like.files).toEqual(['src/a.ts', 'src/csv.ts']);
    expect(like.newFiles).toEqual(['src/csv.ts']);
    expect(like.models).toEqual([{ path: 'src/csv.ts', like: 'src/json.ts' }]);

    const none = read('src/b.ts (new, no model: first parser of its kind)');
    expect(none.files).toEqual(['src/b.ts']);
    expect(none.newFiles).toEqual(['src/b.ts']);
    expect(none.models).toEqual([{ path: 'src/b.ts', none: 'first parser of its kind' }]);

    // A bare `(new)` holds exactly what it held before the clause existed.
    const bare = read('src/c.ts (new)');
    expect(bare.files).toEqual(['src/c.ts']);
    expect(bare.newFiles).toEqual(['src/c.ts']);
    expect(bare.models).toEqual([{ path: 'src/c.ts' }]);

    // The model path never enters files, so brief's {files}, taskFileUnknown and the undeclared-file list read what they read before.
    const same = read('src/csv.ts (new, like src/json.ts) src/c.ts (new)');
    expect(same.files).toEqual(['src/csv.ts', 'src/c.ts']);
    expect(same.newFiles).toEqual(['src/csv.ts', 'src/c.ts']);
    expect(same.models).toEqual([{ path: 'src/csv.ts', like: 'src/json.ts' }, { path: 'src/c.ts' }]);
  });

  it('ac-1 gate plan refuses a new path with no model or a model absent at the baseline, naming the task and the path (ST-LN-10 10-ac-1)', () => {
    const bare = model(check({ plan: two('src/c.ts (new)'), claim: NEW }));
    expect(bare).toHaveLength(1);
    expect(bare[0].rule).toBe('gate.task-model-missing');
    expect(bare[0].level).toBe('error');
    expect(bare[0].file).toBe('accord/tickets/T-1/plan.md');
    expect(bare[0].reason).toContain('task 2');
    expect(bare[0].reason).toContain('src/c.ts');

    const unknown = model(check({ plan: two('src/csv.ts (new, like src/nope.ts)'), claim: NEW }));
    expect(unknown).toHaveLength(1);
    expect(unknown[0].rule).toBe('gate.task-model-unknown');
    expect(unknown[0].reason).toContain('task 2');
    expect(unknown[0].reason).toContain('src/csv.ts');
    expect(unknown[0].reason).toContain('src/nope.ts');

    expect(model(check({ plan: two('src/csv.ts (new, like src/json.ts)'), claim: NEW }))).toEqual([]);
    expect(model(check({ plan: two('src/csv.ts (new, no model: first parser of its kind)'), claim: NEW }))).toEqual([]);
    expect(of(check({ plan: two('src/csv.ts (new)'), claim: NEW }), 'gate.task-model-unknown')).toEqual([]);
  });
});

describe('plan model: the clause reader and the cut-off, edge by edge', () => {
  const read = (files: string, eol = '\n', bom = '') => parsePlan('plan.md', bom + planOf(task(1, files)).replace(/\n/g, eol)).plan.tasks[0];

  // [files value, the models it reads]
  const SPELLINGS: [string, PlanModels][] = [
    ['src/x.ts (new, like)', [{ path: 'src/x.ts', unread: '(new, like)' }]],
    ['src/x.ts (new, like )', [{ path: 'src/x.ts', unread: '(new, like )' }]],
    ['src/x.ts (new, no model:)', [{ path: 'src/x.ts', unread: '(new, no model:)' }]],
    ['src/x.ts (new, no model:   )', [{ path: 'src/x.ts', unread: '(new, no model:   )' }]],
    ['src/x.ts (new, lik src/a.ts)', [{ path: 'src/x.ts', unread: '(new, lik src/a.ts)' }]],
    ['src/x.ts (New, like src/a.ts)', [{ path: 'src/x.ts', unread: '(New, like src/a.ts)' }]],
    ['src/x.ts (new, like src/a.ts', [{ path: 'src/x.ts', unread: '(new, like src/a.ts' }]],
    ['src/x.ts (new, like src/a.ts, src/b.ts)', [{ path: 'src/x.ts', unread: '(new, like src/a.ts, src/b.ts)' }]],
    ['src/x.ts (new, like src/a.ts src/b.ts)', [{ path: 'src/x.ts', unread: '(new, like src/a.ts src/b.ts)' }]],
    ['src/x.ts (new, like `src/a.ts`)', [{ path: 'src/x.ts', like: 'src/a.ts' }]],
    ['src/x.ts (new,like src/a.ts)', [{ path: 'src/x.ts', like: 'src/a.ts' }]],
    ['src/x.ts (new,   like    src/a.ts  )', [{ path: 'src/x.ts', like: 'src/a.ts' }]],
    ['src/x.ts (new, no model: first, of its kind)', [{ path: 'src/x.ts', none: 'first, of its kind' }]],
    ['src/x.ts (new,no model:first)', [{ path: 'src/x.ts', none: 'first' }]],
    [
      'src/x.ts (new, like src/m.ts) src/y.ts (new, no model: why) src/z.ts (new)',
      [{ path: 'src/x.ts', like: 'src/m.ts' }, { path: 'src/y.ts', none: 'why' }, { path: 'src/z.ts' }],
    ],
    ['(new, like src/m.ts) src/x.ts', []],
    ['(new) src/x.ts', []],
  ];
  it.each(SPELLINGS)('risk:parsing the model clause reads every edge spelling one way: %s (ST-LN-10 10-ac-1)', (files, models) => {
    const lf = read(files);
    expect(lf.models).toEqual(models);
    // the clause words never become paths, and CRLF and a BOM read the same
    expect(lf.files.every((f) => !f.includes('(') && !f.includes(')') && f !== 'like')).toBe(true);
    expect(lf.newFiles).toEqual(models.map((m) => m.path));
    for (const [eol, bom] of [['\r\n', ''], ['\n', '\uFEFF'], ['\r\n', '\uFEFF']] as const) {
      const other = read(files, eol, bom);
      expect(other.models).toEqual(lf.models);
      expect(other.files).toEqual(lf.files);
      expect(other.newFiles).toEqual(lf.newFiles);
    }
  });

  it('risk:parsing an unread clause is quoted in its finding, and a model is compared with the baseline byte for byte (ST-LN-10 10-ac-1)', () => {
    const unread = model(check({ plan: two('src/c.ts (new, like)'), claim: NEW }));
    expect(unread.map((f) => f.rule)).toEqual(['gate.task-model-missing']);
    expect(unread[0].reason).toContain('"(new, like)"');
    expect(unread[0].reason).toContain('task 2');
    expect(unread[0].reason).toContain('src/c.ts');
    // one pair of backticks is removed; no case folding, no other normalisation
    expect(model(check({ plan: two('src/c.ts (new, like `src/json.ts`)'), claim: NEW }))).toEqual([]);
    expect(model(check({ plan: two('src/c.ts (new, like src/JSON.ts)'), claim: NEW })).map((f) => f.rule)).toEqual(['gate.task-model-unknown']);
    expect(model(check({ plan: two('src/c.ts (new, like ./src/json.ts)'), claim: NEW })).map((f) => f.rule)).toEqual(['gate.task-model-unknown']);
    expect(model(check({ plan: two('src/c.ts (new, like src/json.ts)', '\r\n'), claim: NEW }))).toEqual([]);
    // a `files:` line whose first token is `(new)` marks nothing, as before
    expect(model(check({ plan: two('(new) src/export.ts'), claim: NEW }))).toEqual([]);
  });

  it('risk:complex-branching the model rules keep the older answer before 0.6.0 and fail closed on a failed claim read (ST-LN-10 10-ac-1)', () => {
    const plan = planOf(task(1, 'src/export.ts'), task(2, 'src/c.ts (new)', '1'), task(3, 'src/d.ts (new, like src/nope.ts)', '1'));
    // claimed before the cut-off: a bare (new) and an unknown model both keep the older answer
    expect(model(check({ plan, claim: { pin: '0.5.1' } }))).toEqual([]);
    expect(model(check({ plan, claim: { pin: '0.5.1', basePin: '0.5.0' } }))).toEqual([]);
    // claimed at the cut-off: both rules apply, in rule order
    expect(model(check({ plan, claim: NEW })).map((f) => f.rule)).toEqual(['gate.task-model-missing', 'gate.task-model-unknown']);
    // a failed claim read applies both rules and each finding says why
    const failed = model(check({ plan, claim: { error: 'fatal: bad object 1234567' } }));
    expect(failed.map((f) => f.rule)).toEqual(['gate.task-model-missing', 'gate.task-model-unknown']);
    for (const f of failed) {
      expect(f.reason).toContain('fatal: bad object 1234567');
      expect(f.reason).toContain('the claim pin could not be read');
    }
    // findings come in files-line order, the same on every run
    expect(JSON.stringify(check({ plan, claim: NEW }))).toBe(JSON.stringify(check({ plan, claim: NEW })));
    // lane S and a plan stage that is off have no model rule
    expect(model(check({ plan, claim: NEW, lane: 'S' }))).toEqual([]);
    expect(model(check({ plan, claim: NEW, config: CONFIG + 'strictness:\n  stages:\n    M:\n      plan: off\n' }))).toEqual([]);
    // a model that is a path this plan creates, and a path naming itself as its model, are not at the baseline
    const adjacent = planOf(task(1, 'src/a.ts (new, no model: first of its kind)'), task(2, 'src/b.ts (new, like src/a.ts)', '1'), task(3, 'src/c.ts (new, like src/c.ts)', '1'));
    const got = model(check({ plan: adjacent, claim: NEW }));
    expect(got.map((f) => f.rule)).toEqual(['gate.task-model-unknown', 'gate.task-model-unknown']);
    expect(got[0].reason).toContain('task 2');
    expect(got[1].reason).toContain('task 3');
  });

  it('risk:parsing a 100000-character files: line with many "(new, like" openings reads in under 200 ms (ST-LN-10 10-ac-1)', () => {
    const closed = 'src/p.ts (new, like src/m.ts) '.repeat(3300).slice(0, 100000);
    const unclosed = '(new, like (new, like '.repeat(4600).slice(0, 100000);
    const spaces = 'src/p.ts (new,' + ' '.repeat(100000) + 'like';
    for (const files of [closed, unclosed, spaces]) {
      const plan = planOf(task(1, files));
      const start = performance.now();
      const t = parsePlan('plan.md', plan).plan.tasks[0];
      expect(performance.now() - start).toBeLessThan(200);
      expect(t.n).toBe(1);
    }
  });
});

type PlanModels = { path: string; like?: string; none?: string; unread?: string }[];
