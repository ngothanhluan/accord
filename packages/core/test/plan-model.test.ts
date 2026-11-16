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
  baseline?: string[]; // the paths of the plan baseline commit; absent: the host supplied none
}
const build = ({ plan = two('src/c.ts (new, like src/json.ts)'), claim, baseline = ['src/export.ts', 'src/json.ts'] }: Opts = {}) => {
  const files: Record<string, string> = approved(
    {
      'accord/config.yml': CONFIG,
      'accord/tickets/T-1.md': laneTicket('T-1'),
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
