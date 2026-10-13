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

const reasons = (r: GateResult, rule: string) => r.findings.filter((f) => f.rule === rule).map((f) => f.reason);
const NO_MAPS = PLAN.replace(' (@ac-1)', '').replace(' (@ac-2)', '');
const EXTRA = '  @ac-3\n  Scenario: third\n    Given a\n    When b\n    Then c\n```\n\n## Vetoes';

it('ac-2 gate plan fails when a scenario has no test mapped to it anywhere in the plan', () => {
  const body = LANE_BODY.replace('```\n\n## Vetoes', '\n' + EXTRA);
  const r = plan(base(laneTicket('T-1', { body })), NO_MAPS.replace('export#writes-csv', 'export#writes-csv (@ac-1)'));
  expect(reasons(r, 'gate.plan-test-unmapped')).toEqual([
    '@ac-2 is mapped to no test; write (@ac-2) after the verify id that proves it',
    '@ac-3 is mapped to no test; write (@ac-3) after the verify id that proves it',
  ]);
});

it('ac-3 gate plan fails when a scenario is mapped more than once', () => {
  const across = PLAN.replace('export#escapes-commas (@ac-2)', 'export#escapes-commas (@ac-1)');
  const a = reasons(plan(base(), across), 'gate.plan-test-repeated');
  expect(a).toHaveLength(1);
  expect(a[0]).toContain('@ac-1');
  expect(a[0]).toContain('export#writes-csv, export#escapes-commas');
  const same = PLAN.replace('export#writes-csv (@ac-1)', 'export#writes-csv (@ac-1), export#writes-csv (@ac-1)');
  const b = reasons(plan(base(), same), 'gate.plan-test-repeated');
  expect(b).toEqual(['@ac-1 is mapped more than once: export#writes-csv, export#writes-csv']);
});

it('risk:complex-branching a map onto a missing scenario or a ui scenario fails gate plan', () => {
  const missing = plan(base(), PLAN.replace('export#escapes-commas (@ac-2)', 'export#escapes-commas (@ac-2) (@ac-9)'));
  expect(reasons(missing, 'gate.plan-map-invalid')).toEqual([
    'task 2 maps export#escapes-commas to @ac-9, which is not a scenario of T-1',
  ]);
  const ui = laneTicket('T-1', { body: LANE_BODY.replace('@ac-2 @test:export#escapes-commas', '@ac-2 @ui') });
  expect(reasons(plan(base(ui), PLAN), 'gate.plan-map-invalid')).toEqual([
    'task 2 maps export#escapes-commas to @ac-2, a @ui scenario; a @ui scenario carries no @test tag',
  ]);
  expect(reasons(plan(base(ui), NO_MAPS.replace('export#writes-csv', 'export#writes-csv (@ac-1)')), 'gate.plan-test-unmapped')).toEqual([]);
});

describe('gate plan', () => {
  it('a plan covering every criterion and decision passes', () => {
    const r = plan(base(), PLAN);
    expect(r.gate).toBe('plan');
    expect(errors(r)).toEqual([]);
    expect(r.verdict).toBe('pass');
  });

  it('an unapproved ticket fails on gate.approval-missing; an edited one on gate.approval-stale', () => {
    const files = base();
    const t = 'accord/tickets/T-1.md';
    expect(errors(plan({ ...files, [t]: laneTicket('T-1') }, PLAN))).toEqual(['gate.approval-missing']);
    const edited = { ...files, [t]: files[t].replace('csv mode', 'tsv mode') };
    expect(errors(plan(edited, PLAN))).toEqual(['gate.approval-stale']);
  });

  it('no plan fails on gate.plan-missing', () => {
    expect(errors(plan(base()))).toEqual(['gate.plan-missing']);
  });

  it('a plan with no task fails on gate.plan-empty', () => {
    expect(errors(plan(base(), '---\nbaseline: abc1234\n---\n# Plan\n'))).toEqual(['gate.plan-empty']);
  });

  it('a plan without a baseline fails on gate.plan-baseline-missing, saying what to write', () => {
    const r = plan(base(), PLAN.replace(/^---\n[\s\S]*?\n---\n\n/, ''));
    expect(errors(r)).toEqual(['gate.plan-baseline-missing']);
    expect(r.findings[0].reason).toContain('git rev-parse HEAD');
  });

  it('checks the baseline against the host ancestry facts only when they are supplied', () => {
    const files = { ...base(), 'accord/tickets/T-1/plan.md': PLAN.replace('abc1234', '3f2a9c1') };
    const gate = (ancestors?: Record<string, boolean>) =>
      gatePlan(loadSnapshot({ files, tree: Object.keys(files).sort(), ...(ancestors ? { ancestors } : {}) }), 'T-1');
    expect(errors(gate())).toEqual([]);
    expect(errors(gate({ '3f2a9c1': true }))).toEqual([]);
    const bad = gate({ '3f2a9c1': false });
    expect(errors(bad)).toEqual(['gate.plan-baseline-unknown']);
    expect(bad.findings[0].reason).toBe('baseline 3f2a9c1 is not a commit on the history of HEAD');
    expect(errors(gate({}))).toEqual(['gate.plan-baseline-unknown']);
  });

  describe('gate.task-file-unknown', () => {
    const files = { ...base(), 'accord/tickets/T-1/plan.md': PLAN };
    const gate = (baselineFiles?: Record<string, string[]>, text = PLAN) => {
      const f = { ...files, 'accord/tickets/T-1/plan.md': text };
      return gatePlan(loadSnapshot({ files: f, tree: Object.keys(f).sort(), ...(baselineFiles ? { baselineFiles } : {}) }), 'T-1');
    };
    it('passes when the path exists at baseline; names it once per task when it does not', () => {
      expect(errors(gate({ abc1234: ['src/export.ts'] }))).toEqual([]);
      const r = gate({ abc1234: [] });
      expect(r.findings.filter((f) => f.rule === 'gate.task-file-unknown').map((f) => [f.line, f.reason])).toEqual([
        [8, 'task 1 names src/export.ts, which does not exist at baseline abc1234; correct the path, or write (new) after it if the task creates it'],
        [14, 'task 2 names src/export.ts, which does not exist at baseline abc1234; correct the path, or write (new) after it if the task creates it'],
      ]);
    });
    it('a (new) path passes; no facts, or facts for another baseline, skip the rule', () => {
      expect(errors(gate({ abc1234: [] }, PLAN.replace(/files: src\/export.ts/g, 'files: src/export.ts (new)')))).toEqual([]);
      expect(errors(gate())).toEqual([]);
      expect(errors(gate({ other12: [] }))).toEqual([]);
    });
    it('gatePlan reports the plan body hash, and none without a plan', () => {
      expect(gate().planHash).toBe(loadSnapshot({ files, tree: [] }).work?.['T-1'].plan?.bodyHash);
      const none = { ...base() };
      expect(gatePlan(loadSnapshot({ files: none, tree: Object.keys(none).sort() }), 'T-1').planHash).toBeUndefined();
    });
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
      [18, 'task 2 defers work: "later"'],
    ]);
  });

  // Task 2's files: line is the one followed by its own verify: line.
  const task2Files = 'files: src/export.ts\nverify: export#escapes-commas';
  it.each([
    ['files: TBD', task2Files, 'files: TBD\nverify: export#escapes-commas', 'TBD'],
    ['verify: TODO', 'verify: export#escapes-commas', 'verify: TODO', 'TODO'],
    ['files: for now', task2Files, 'files: for now\nverify: export#escapes-commas', 'for now'],
  ])('a field whose token is a deferral word fails: %s', (_, from, to, word) => {
    const r = plan(base(), PLAN.replace(from, to));
    expect(r.findings.filter((f) => f.level === 'error').map((f) => [f.rule, f.reason])).toEqual([
      ['gate.plan-deferral', `task 2 defers work: "${word}"`],
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
