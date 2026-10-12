// Spec §8-§11: Done for a lane ticket needs every task recorded, a converged review, and a traced, green suite.
import { describe, expect, it } from 'vitest';
import { lintSnapshot, loadSnapshot, setFrontmatterKey } from '../src/index.js';
import { gateDone } from '../src/gate/index.js';
import type { GateResult } from '../src/gate/index.js';
import { acHash } from '../src/gate/hash.js';
import { approved } from './helpers/approve.js';
import { CONFIG, junit, laneTicket, PLAN, REPORT } from '../../../test/helpers/lane.js';

const COMMIT = '1234567890abcdef1234567890abcdef12345678';
type Cases = Record<string, 'passed' | 'failed' | 'skipped'>;
const CASES: Cases = { 'export#writes-csv': 'passed', 'export#escapes-commas': 'passed' };
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

/** A lane ticket that passes Done, with `over` replacing any file afterwards. */
function doneFiles(over: Record<string, string> = {}, cases: Cases = CASES, ticket = laneTicket('T-1')): Record<string, string> {
  const files = approved(
    {
      'accord/config.yml': CONFIG,
      'accord/tickets/T-1.md': ticket,
      'accord/tickets/T-1/plan.md': PLAN,
      'accord/tickets/T-1/ledger.md': '## Tasks\n- task 1 done 1234567\n- task 2 done 1234567\n',
      'accord/tickets/T-1/review.md': '## Round 1\nverdict: converged\n',
      'accord/tickets/T-1/verification.md': VERIFICATION,
      [REPORT]: junit(cases),
    },
    'T-1',
  );
  const hash = acHash(loadSnapshot({ files, tree: [] }).tickets['T-1'].scenarios) as string;
  let text = setFrontmatterKey(files['accord/tickets/T-1.md'], 'ac_hash', hash);
  text = setFrontmatterKey(text, 'verified', ['ac-1', 'ac-2']);
  text = setFrontmatterKey(text, 'verified_hash', hash);
  text = setFrontmatterKey(text, 'verified_commit', '1234567');
  return { ...files, 'accord/tickets/T-1.md': text, ...over };
}
const snap = (files: Record<string, string>) =>
  loadSnapshot({
    files,
    tree: Object.keys(files).sort(),
    git: {
      commit: COMMIT,
      authors: { [COMMIT]: 'dev@example.test', 'accord/tickets/T-1/verification.md': 'reviewer@example.test' },
    },
  });
const done = (files: Record<string, string>) => gateDone(snap(files), 'T-1');
const errors = (r: GateResult) => r.findings.filter((f) => f.level === 'error').map((f) => f.rule);

describe('Done for lane tickets', () => {
  it('passes with every task recorded, a converged review, and a traced green suite', () => {
    const r = done(doneFiles());
    expect(errors(r)).toEqual([]);
    expect(r.verdict).toBe('pass');
  });

  it('a Corrections line appended after Done stales the approval until the owner approves again', () => {
    const files = doneFiles();
    const t = 'accord/tickets/T-1.md';
    const corrected = { ...files, [t]: files[t].replace('## Corrections\n', '## Corrections\n- C-01 Quote tabs too.\n') };
    expect(errors(done(corrected))).toEqual(['gate.approval-stale']);
    expect(errors(done(approved(corrected, 'T-1')))).toEqual([]);
    const unapproved = { ...files, [t]: files[t].replace(/^approved_hash: .*\n/m, '') };
    expect(errors(done(unapproved))).toEqual(['gate.approval-missing']);
  });

  it('a task without a completion line fails on gate.task-incomplete', () => {
    const r = done(doneFiles({ 'accord/tickets/T-1/ledger.md': '## Tasks\n- task 1 done 1234567\n' }));
    expect(errors(r)).toEqual(['gate.task-incomplete']);
    expect(r.findings.find((f) => f.rule === 'gate.task-incomplete')?.reason).toBe(
      'task 2 has no completion line in accord/tickets/T-1/ledger.md; run accord task-done T-1 2',
    );
  });

  it('a plan with no tasks fails on gate.task-incomplete, as a missing plan does', () => {
    const r = done(doneFiles({ 'accord/tickets/T-1/plan.md': '# Plan\n\nNothing yet.\n' }));
    expect(errors(r)).toContain('gate.task-incomplete');
    expect(r.findings.find((f) => f.rule === 'gate.task-incomplete')?.reason).toBe(
      'the plan has no tasks; Done needs every planned task recorded in accord/tickets/T-1/ledger.md',
    );
  });

  it('a missing review fails on gate.review-missing; an open one on gate.review-unconverged', () => {
    const missing = doneFiles();
    delete missing['accord/tickets/T-1/review.md'];
    expect(errors(done(missing))).toEqual(['gate.review-missing']);
    expect(errors(done(doneFiles({ 'accord/tickets/T-1/review.md': 'verdict: open\n' })))).toEqual([
      'gate.review-unconverged',
    ]);
  });

  it('accepted-by-owner is a verdict Done accepts', () => {
    expect(errors(done(doneFiles({ 'accord/tickets/T-1/review.md': 'verdict: accepted-by-owner\n' })))).toEqual([]);
  });

  it("accepted-by-owner with the owner's sentence quoted on the same line satisfies Done (spec §10)", () => {
    const review = 'verdict: accepted-by-owner "ship it as is"\n';
    expect(errors(done(doneFiles({ 'accord/tickets/T-1/review.md': review })))).toEqual([]);
  });

  it('a lane ticket with no tests.report configured fails on gate.suite-not-passed', () => {
    const r = done(doneFiles({ 'accord/config.yml': CONFIG.replace(/tests:\n {2}report: .*\n/, '') }));
    expect(errors(r)).toContain('gate.suite-not-passed');
    expect(r.findings.find((f) => f.rule === 'gate.suite-not-passed')?.reason).toBe(
      "no test report is configured; Done for a lane ticket needs the full suite's report in tests.report",
    );
  });

  it('a lane ticket whose configured report is missing fails on gate.suite-not-passed', () => {
    const files = doneFiles();
    delete files[REPORT];
    const r = done(files);
    expect(errors(r)).toContain('gate.suite-not-passed');
    expect(r.findings.find((f) => f.rule === 'gate.suite-not-passed')?.reason).toBe(
      `no report at ${REPORT}; Done for a lane ticket needs the full suite's report`,
    );
  });

  it('a failed case anywhere in the report fails on gate.suite-not-passed', () => {
    const r = done(doneFiles({}, { ...CASES, 'util#risk:parsing-bom': 'failed' }));
    expect(errors(r)).toEqual(['gate.suite-not-passed']);
    expect(r.findings.find((f) => f.rule === 'gate.suite-not-passed')?.reason).toBe(
      '1 test case failed in the report: util#risk:parsing-bom',
    );
  });

  it('an untraced case fails on gate.test-untraced unless the baseline lists it', () => {
    const cases = { ...CASES, 'util#formats-dates': 'passed' } as Cases;
    expect(errors(done(doneFiles({}, cases)))).toEqual(['gate.test-untraced']);
    expect(errors(done(doneFiles({ 'accord/tests-baseline.txt': 'util#formats-dates\n' }, cases)))).toEqual([]);
  });

  it('a risk: case is traced by its name', () => {
    expect(errors(done(doneFiles({}, { ...CASES, 'util#risk:parsing-bom': 'passed' })))).toEqual([]);
  });

  it('review mode human still requires Verification notes', () => {
    const r = done(doneFiles({ 'accord/config.yml': CONFIG.replace('mode: outcome', 'mode: human') }));
    expect(errors(r)).toContain('gate.note-missing');
  });

  it('a ticket without lane gets none of the lane Done rules', () => {
    const r = done(doneFiles({}, CASES, laneTicket('T-1', { lane: '' })));
    const lane = ['gate.task-incomplete', 'gate.review-missing', 'gate.review-unconverged', 'gate.suite-not-passed'];
    for (const rule of [...lane, 'gate.test-untraced']) {
      expect(errors(r)).not.toContain(rule);
    }
    // review.mode outcome makes notes optional for lane tickets only.
    expect(errors(r)).toContain('gate.note-missing');
  });
});

describe('lint.test-untraced (spec §9)', () => {
  const untraced = (files: Record<string, string>) =>
    lintSnapshot(snap(files)).findings.filter((f) => f.rule === 'lint.test-untraced');

  it('warns once a lane ticket exists', () => {
    expect(untraced(doneFiles({}, { ...CASES, 'util#formats-dates': 'passed' }))).toEqual([
      {
        file: 'reports/junit.xml',
        rule: 'lint.test-untraced',
        level: 'warning',
        reason: 'test "util#formats-dates" is named by no scenario\'s @test:, carries no risk:, and is not in accord/tests-baseline.txt',
      },
    ]);
  });

  it('is silent in a repository with no lane ticket', () => {
    const files = doneFiles({}, { ...CASES, 'util#formats-dates': 'passed' }, laneTicket('T-1', { lane: '' }));
    expect(untraced(files)).toEqual([]);
  });
});
