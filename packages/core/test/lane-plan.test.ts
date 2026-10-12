// Spec §7: the plan covers every criterion and decision and defers nothing.
import { describe, expect, it } from 'vitest';
import { gatePlan, loadSnapshot } from '../src/index.js';
import type { GateResult } from '../src/index.js';
import { approved } from './helpers/approve.js';
import { CONFIG, junit, LANE_BODY, laneTicket, PLAN, REPORT } from '../../../test/helpers/lane.js';

const base = (text = laneTicket('T-1')) =>
  approved(
    {
      'accord/config.yml': CONFIG,
      'accord/tickets/T-1.md': text,
      [REPORT]: junit({ 'export#writes-csv': 'passed', 'export#escapes-commas': 'passed' }),
    },
    'T-1',
  );
const plan = (f: Record<string, string>, text?: string, id = 'T-1') => {
  const files = text === undefined ? f : { ...f, 'accord/tickets/T-1/plan.md': text };
  return gatePlan(loadSnapshot({ files, tree: Object.keys(files).sort() }), id);
};
const errors = (r: GateResult) => r.findings.filter((f) => f.level === 'error').map((f) => f.rule);

describe('gate plan', () => {
  it('a plan covering every criterion and decision passes', () => {
    const r = plan(base(), PLAN);
    expect(r.gate).toBe('plan');
    expect(errors(r)).toEqual([]);
    expect(r.verdict).toBe('pass');
  });

  it('no plan fails on gate.plan-missing', () => {
    expect(errors(plan(base()))).toEqual(['gate.plan-missing']);
  });

  it('a plan with no task fails on gate.plan-empty', () => {
    expect(errors(plan(base(), '# Plan\n'))).toEqual(['gate.plan-empty']);
  });

  it('names an uncovered criterion and an uncited decision', () => {
    const text = PLAN.replace('covers: @ac-1, D-01', 'covers: @ac-1').replace('covers: @ac-2', 'covers: @ac-1');
    expect(plan(base(), text).findings.filter((f) => f.level === 'error').map((f) => [f.rule, f.reason])).toEqual([
      ['gate.plan-ac-uncovered', '@ac-2 is covered by no task'],
      ['gate.plan-decision-uncited', 'D-01 is cited by no task'],
    ]);
  });

  it('names a task without covers or verify at its line', () => {
    const r = plan(base(), '## Task 1: A\nfiles: x.ts\n');
    expect(errors(r)).toEqual(
      expect.arrayContaining(['gate.task-covers-missing', 'gate.task-verify-missing']),
    );
    expect(r.findings.find((f) => f.rule === 'gate.task-verify-missing')?.line).toBe(1);
  });

  it('names covers entries the ticket does not hold', () => {
    const r = plan(base(), PLAN.replace('covers: @ac-2', 'covers: @ac-2, @ac-9, D-07, banana'));
    expect(r.findings.filter((f) => f.rule === 'gate.plan-ref-unknown').map((f) => f.reason)).toEqual([
      'task 2 covers "@ac-9", which is not a criterion or decision of T-1',
      'task 2 covers "D-07", which is not a criterion or decision of T-1',
      'task 2 covers "banana", which is not a criterion or decision of T-1',
    ]);
  });

  it.each(['TODO', 'TBD', 'placeholder', 'v1', 'for now', 'later'])('the deferral word %s fails the plan', (word) => {
    const r = plan(base(), PLAN.replace('Quote cells that contain a comma.', `Quote cells, ${word}.`));
    expect(errors(r)).toEqual(['gate.plan-deferral']);
  });

  it('v10 and "laterally" are not deferrals', () => {
    expect(errors(plan(base(), PLAN.replace('Quote cells that contain a comma.', 'Use v10 laterally.')))).toEqual([]);
  });

  it('a field line is not scanned for deferrals; the prose of the same task still is', () => {
    const paths = PLAN.replace('files: src/export.ts\nverify: export#escapes-commas', 'files: src/later.ts, src/api/v1/x.ts\nverify: export#escapes-commas');
    expect(errors(plan(base(), paths))).toEqual([]);
    const r = plan(base(), paths.replace('Quote cells that contain a comma.', 'Quote cells later.'));
    expect(r.findings.filter((f) => f.rule === 'gate.plan-deferral').map((f) => [f.line, f.reason])).toEqual([
      [13, 'task 2 defers work: "later"'],
    ]);
  });

  it('a ticket without lane fails on gate.lane-missing', () => {
    const f = base(laneTicket('T-1', { lane: '', body: LANE_BODY + '## Requirements\n\n## Plan\n' }));
    expect(errors(plan(f, PLAN))).toContain('gate.lane-missing');
  });

  it('an unknown ticket fails on gate.ticket-unknown alone', () => {
    expect(errors(plan(base(), PLAN, 'NOPE'))).toEqual(['gate.ticket-unknown']);
  });
});
