// ST-LN-50 t2-ac-5 (stage half), D-08 and its Ruling: with `strictness.stages.<lane>.plan: off` an approved lane ticket builds as one task, task 1, the whole ticket.
// Its tests are tied to its scenarios by `ticketTaskVerdict`, and the verification floor (gate.test-tag-missing, LOCKED) stays.
import { describe, expect, it } from 'vitest';
import { gateDone, loadSnapshot, setFrontmatterKey, ticketTaskVerdict } from '../src/index.js';
import { acHash } from '../src/gate/hash.js';
import type { RepoSnapshot } from '../src/index.js';
import { progressOf } from '../src/status/stage.js';
import { approved } from './helpers/approve.js';
import { CONFIG, junit, laneTicket, PLAN, REPORT } from '../../../test/helpers/lane.js';

const T1 = 'accord/tickets/T-1.md';
const PLAN_OFF = CONFIG + 'strictness:\n  stages:\n    M:\n      plan: off\n';
const REVIEW_OFF = CONFIG + 'strictness:\n  stages:\n    M:\n      plan: off\n      review: off\n';
const snap = (files: Record<string, string>): RepoSnapshot => loadSnapshot({ files, tree: Object.keys(files).sort() });
const progress = (files: Record<string, string>) => progressOf(snap(files), snap(files).tickets['T-1']);

/** An approved lane M ticket with no plan.md. */
const base = (config: string, extra: Record<string, string> = {}): Record<string, string> => ({
  ...approved({ 'accord/config.yml': config, [T1]: laneTicket('T-1') }, 'T-1'),
  ...extra,
});

describe('plan off (ST-LN-50 t2-ac-5)', () => {
  it('risk:complex-branching the plan stage off puts an approved ticket at build with one task (ST-LN-50 t2-ac-5)', () => {
    // today: no plan.md holds the ticket at plan
    expect(progress(base(CONFIG))).toMatchObject({ stage: 'plan', tasksTotal: 0 });

    // plan off: build, one task, none done, task 1 next
    expect(progress(base(PLAN_OFF))).toEqual({ stage: 'build', tasksTotal: 1, tasksDone: 0, next: 1 });

    // plan.md that exists anyway is ignored: still one task (the Ruling), and its two tasks do not count
    expect(progress(base(PLAN_OFF, { 'accord/tickets/T-1/plan.md': PLAN }))).toEqual({ stage: 'build', tasksTotal: 1, tasksDone: 0, next: 1 });

    // plan on: its two tasks count, as today
    expect(progress(base(CONFIG, { 'accord/tickets/T-1/plan.md': PLAN }))?.tasksTotal).toBe(2);

    // task 1 done: review (default), verify with review also off
    const ledger = { 'accord/tickets/T-1/ledger.md': '## Tasks\n- task 1 done abc1234\n' };
    expect(progress(base(PLAN_OFF, ledger))).toMatchObject({ stage: 'review', tasksTotal: 1, tasksDone: 1 });
    expect(progress(base(REVIEW_OFF, ledger))).toMatchObject({ stage: 'verify', tasksTotal: 1, tasksDone: 1 });

    // the key is per lane: the same ticket as lane L is at plan
    const lane = { 'accord/config.yml': PLAN_OFF, ...approved({ [T1]: laneTicket('T-1', { lane: 'L' }), 'accord/config.yml': PLAN_OFF }, 'T-1') };
    expect(progress(lane)).toMatchObject({ stage: 'plan' });
  });

  it('risk:complex-branching plan off is not held at plan by a host that supplies plan facts (ST-LN-50 t2-ac-5)', () => {
    const files = base(PLAN_OFF);
    const s = { ...snap(files), planFacts: {} };
    expect(progressOf(s, s.tickets['T-1'])?.stage).toBe('build');
  });
});

describe('ticketTaskVerdict (ST-LN-50 t2-ac-5)', () => {
  const MAPS = [
    { ac: '@ac-1', test: 'export#writes-csv' },
    { ac: '@ac-2', test: 'export#escapes-commas' },
  ];
  const withReport = (cases: Parameters<typeof junit>[0] | null, body?: string): RepoSnapshot => {
    const files: Record<string, string> = {
      'accord/config.yml': PLAN_OFF,
      [T1]: laneTicket('T-1', body === undefined ? {} : { body }),
      ...(cases === null ? {} : { [REPORT]: junit(cases) }),
    };
    return snap(files);
  };
  const PASS = { 'export#writes-csv': 'passed', 'export#escapes-commas': 'passed' } as const;

  it('risk:security maps covering every non-@ui scenario with passing tests give pass (ST-LN-50 t2-ac-5)', () => {
    expect(ticketTaskVerdict(withReport(PASS), 'T-1', MAPS)).toEqual({ verdict: 'pass', reasons: [] });
  });

  it('risk:security an unmapped scenario, a failed test and an absent test fail, each named (ST-LN-50 t2-ac-5)', () => {
    expect(ticketTaskVerdict(withReport(PASS), 'T-1', [MAPS[0]])).toEqual({
      verdict: 'fail',
      reasons: ['@ac-2 has no --test: every scenario that is not @ui needs one test'],
    });
    expect(ticketTaskVerdict(withReport({ ...PASS, 'export#escapes-commas': 'failed' }), 'T-1', MAPS).reasons).toEqual([
      'export#escapes-commas is recorded failed in reports/junit.xml',
    ]);
    expect(ticketTaskVerdict(withReport({ 'export#writes-csv': 'passed' }), 'T-1', MAPS).reasons).toEqual(['export#escapes-commas is not in reports/junit.xml']);
    expect(ticketTaskVerdict(withReport(null), 'T-1', MAPS).reasons).toEqual(['no test report is loaded; set tests.report and run the tests']);
  });

  it('risk:security a mapping to no scenario, or two tests on one scenario, fails (ST-LN-50 t2-ac-5)', () => {
    expect(ticketTaskVerdict(withReport(PASS), 'T-1', [...MAPS, { ac: '@ac-9', test: 'export#writes-csv' }]).reasons).toEqual([
      '@ac-9 is not a scenario of the ticket',
    ]);
    expect(ticketTaskVerdict(withReport(PASS), 'T-1', [...MAPS, { ac: '@ac-1', test: 'export#escapes-commas' }]).reasons).toEqual([
      '@ac-1 is named by more than one --test',
    ]);
  });

  it('risk:complex-branching a @ui scenario needs no test (ST-LN-50 t2-ac-5)', () => {
    const body = laneTicket('T-1').split('---\n')[2].replace('@ac-2 @test:export#escapes-commas', '@ac-2 @ui');
    expect(ticketTaskVerdict(withReport(PASS, body), 'T-1', [MAPS[0]])).toEqual({ verdict: 'pass', reasons: [] });
  });
});

// D-08 and its Ruling: the plan rules leave with the plan stage, the verification floor does not.
describe('gate done without a plan (ST-LN-50 t2-ac-5)', () => {
  const COMMIT = '1234567890abcdef1234567890abcdef12345678';
  const VERIFICATION = [
    '---',
    'ticket: "T-1"',
    'commit: "1234567"',
    'reviewed_on: "2026-10-12"',
    '---',
    '',
    '## @ac-1 export writes a csv',
    '',
    'Result: pass',
    '',
    'Evidence: export#writes-csv passed in reports/junit.xml',
    '',
    '## @ac-2 commas are escaped',
    '',
    'Result: pass',
    '',
    'Evidence: export#escapes-commas passed in reports/junit.xml',
    '',
  ].join('\n');
  const PASS = { 'export#writes-csv': 'passed', 'export#escapes-commas': 'passed' } as const;

  /** A lane M ticket with no plan.md and no ledger line that passes Done with the plan stage off; `over` replaces files afterwards, `ticket` the ticket text. */
  function files(config: string, over: Record<string, string> = {}, ticket = laneTicket('T-1')): Record<string, string> {
    const f = approved(
      {
        'accord/config.yml': config,
        [T1]: ticket,
        'accord/tickets/T-1/review.md': '## Round 1\nverdict: converged\n',
        'accord/tickets/T-1/verification.md': VERIFICATION,
        [REPORT]: junit(PASS),
      },
      'T-1',
    );
    const hash = acHash(loadSnapshot({ files: f, tree: [] }).tickets['T-1'].scenarios) as string;
    let text = setFrontmatterKey(f[T1], 'ac_hash', hash);
    text = setFrontmatterKey(text, 'verified', ['ac-1', 'ac-2']);
    text = setFrontmatterKey(text, 'verified_hash', hash);
    text = setFrontmatterKey(text, 'verified_commit', '1234567');
    return { ...f, [T1]: text, ...over };
  }
  const done = (f: Record<string, string>) =>
    gateDone(
      loadSnapshot({
        files: f,
        tree: Object.keys(f).sort(),
        git: { commit: COMMIT, authors: { [COMMIT]: 'dev@example.test', 'accord/tickets/T-1/verification.md': 'reviewer@example.test' } },
        branchFacts: { 'T-1': { base: 'b'.repeat(40), changes: [{ path: T1, kind: 'modified', lines: 1 }], synced: [] } },
      }),
      'T-1',
    );
  const errors = (f: Record<string, string>): string[] => done(f).findings.filter((x) => x.level === 'error').map((x) => x.rule);
  const PLAN_RULE = /^gate\.(plan-|task-|tests-baseline-missing)/;

  it('risk:security a ticket built without a plan still meets the verification floor (ST-LN-50 t2-ac-5)', () => {
    // plan on, no plan.md: the plan rules fire, so the switch is what removes them
    expect(errors(files(CONFIG)).filter((r) => PLAN_RULE.test(r))).toContain('gate.task-incomplete');

    // plan off: no plan-stage finding at all, no ledger line needed, and the verdict is pass
    const ok = done(files(PLAN_OFF));
    expect(ok.findings.filter((x) => PLAN_RULE.test(x.rule))).toEqual([]);
    expect(ok.verdict).toBe('pass');

    // a scenario with its @test: tag removed fails the floor
    const untagged = laneTicket('T-1').replace(' @test:export#escapes-commas', '');
    expect(errors(files(PLAN_OFF, {}, untagged))).toContain('gate.test-tag-missing');

    // no verification fails the floor
    const noVerification = files(PLAN_OFF);
    delete noVerification['accord/tickets/T-1/verification.md'];
    expect(errors(noVerification)).toContain('gate.verification-missing');

    // a failing test fails the floor
    expect(errors(files(PLAN_OFF, { [REPORT]: junit({ ...PASS, 'export#escapes-commas': 'failed' }) }))).toContain('gate.test-not-passed');
  });
});
