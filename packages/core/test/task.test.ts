// Spec §8: a task is done when its verify cases passed; the ledger records it once.
import { describe, expect, it } from 'vitest';
import { loadSnapshot, recordTaskDone, taskVerdict } from '../src/index.js';
import { CONFIG, junit, laneTicket, PLAN, REPORT } from '../../../test/helpers/lane.js';

type Cases = Record<string, 'passed' | 'failed' | 'skipped'>;
const CASES: Cases = { 'export#writes-csv': 'passed', 'export#escapes-commas': 'passed' };
const snap = (over: Record<string, string> = {}, cases: Cases | null = CASES) => {
  const files: Record<string, string> = {
    'accord/config.yml': CONFIG,
    'accord/tickets/T-1.md': laneTicket('T-1'),
    'accord/tickets/T-1/plan.md': PLAN,
    ...(cases === null ? {} : { [REPORT]: junit(cases) }),
    ...over,
  };
  return loadSnapshot({ files, tree: Object.keys(files).sort() });
};

describe('taskVerdict', () => {
  it('passes when every verify case passed', () => {
    expect(taskVerdict(snap(), 'T-1', 1)).toEqual({ verdict: 'pass', reasons: [] });
  });

  it('names a failed case and a missing case, in verify order', () => {
    const s = snap(
      { 'accord/tickets/T-1/plan.md': PLAN.replace('verify: export#writes-csv', 'verify: export#writes-csv, export#gone') },
      { 'export#writes-csv': 'failed', 'export#escapes-commas': 'passed' },
    );
    expect(taskVerdict(s, 'T-1', 1)).toEqual({
      verdict: 'fail',
      reasons: ['export#writes-csv is recorded failed in reports/junit.xml', 'export#gone is not in reports/junit.xml'],
    });
  });

  it('prints a backslashed tests.report with forward slashes (D-51)', () => {
    const s = snap({
      'accord/config.yml': CONFIG.replace(`report: ${REPORT}`, 'report: "out\\\\report.xml"'),
      'out/report.xml': junit({ 'export#writes-csv': 'skipped' }),
    });
    expect(taskVerdict(s, 'T-1', 1).reasons).toEqual(['export#writes-csv is recorded skipped in out/report.xml']);
  });

  it('fails with one reason for a missing plan, task, verify line, or report', () => {
    const noPlan = snap({ 'accord/tickets/T-1/plan.md': '' });
    expect(taskVerdict(snap({}, CASES), 'T-1', 9).reasons).toEqual(['the plan has no "## Task 9"']);
    expect(taskVerdict(snap({ 'accord/tickets/T-1/plan.md': '## Task 1: A\ncovers: @ac-1\n' }), 'T-1', 1).reasons).toEqual([
      'task 1 has no verify: line',
    ]);
    expect(taskVerdict(snap({}, null), 'T-1', 1).reasons).toEqual([
      'no test report is loaded; set tests.report and run the tests',
    ]);
    expect(taskVerdict(noPlan, 'T-1', 1).reasons).toEqual(['the plan has no "## Task 1"']);
    const files = { 'accord/config.yml': CONFIG, 'accord/tickets/T-1.md': laneTicket('T-1') };
    expect(taskVerdict(loadSnapshot({ files, tree: [] }), 'T-1', 1).reasons).toEqual([
      'no plan at accord/tickets/T-1/plan.md',
    ]);
  });
});

describe('recordTaskDone', () => {
  it('creates the skeleton and appends in order', () => {
    const one = recordTaskDone(undefined, 1, 'abc1234');
    expect(one).toBe('# Ledger\n\n## Tasks\n- task 1 done abc1234\n\n## Rulings\n\n## Deferred\n');
    expect(recordTaskDone(one, 2, 'def5678')).toBe(
      '# Ledger\n\n## Tasks\n- task 1 done abc1234\n- task 2 done def5678\n\n## Rulings\n\n## Deferred\n',
    );
  });

  it('returns undefined when the task already has a line', () => {
    expect(recordTaskDone('## Tasks\n- task 1 done abc1234\n', 1, 'fff0000')).toBeUndefined();
  });

  it('adds a Tasks section to a ledger that has none', () => {
    expect(recordTaskDone('## Rulings\n- Ruling: x\n', 3, 'abc1234')).toBe(
      '## Rulings\n- Ruling: x\n\n## Tasks\n- task 3 done abc1234\n',
    );
  });

  it('reads CRLF and writes LF', () => {
    expect(recordTaskDone('## Tasks\r\n- task 1 done abc1234\r\n', 2, 'abc1234')).toBe(
      '## Tasks\n- task 1 done abc1234\n- task 2 done abc1234\n',
    );
    expect(recordTaskDone('## Tasks\r\n- task 1 done abc1234\r\n', 1, 'abc1234')).toBeUndefined();
  });
});
