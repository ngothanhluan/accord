// Spec §7-§10 records: plan.md, ledger.md, review.md, and accord/tests-baseline.txt.
import { describe, expect, it } from 'vitest';
import { loadSnapshot } from '../src/index.js';
import { parseBaseline, parseLedger, parsePlan, parseReview } from '../src/load/work.js';
import { CONFIG, laneTicket, PLAN } from '../../../test/helpers/lane.js';

describe('parsePlan', () => {
  it('reads tasks and their fields, and skips sections that are not tasks', () => {
    const { plan, findings } = parsePlan('p', '# Plan\n\n## Notes\ncovers: @ac-9\n\n' + PLAN);
    expect(findings).toEqual([]);
    expect(plan.tasks.map((t) => [t.n, t.title, t.covers, t.files, t.verify])).toEqual([
      [1, 'Writer csv mode', ['@ac-1', 'D-01'], ['src/export.ts'], ['export#writes-csv']],
      [2, 'Escaping', ['@ac-2'], ['src/export.ts'], ['export#escapes-commas']],
    ]);
  });

  it('takes the first field line, accepts a list marker, and skips fenced lines', () => {
    const text = '## Task 1: A\n```\nverify: fenced#x\n```\n- verify: real#y\nverify: second#z\n';
    expect(parsePlan('p', text).plan.tasks[0].verify).toEqual(['real#y']);
  });

  it('reports a duplicate task number and keeps the first', () => {
    const { plan, findings } = parsePlan('p', '## Task 1: A\n\n## Task 1: B\n');
    expect(plan.tasks.map((t) => t.title)).toEqual(['A']);
    expect(findings).toEqual([
      { file: 'p', line: 3, rule: 'load.task-duplicate', reason: 'duplicate "## Task 1"; the first occurrence is used' },
    ]);
  });

  it('reads CRLF and a BOM the same as LF', () => {
    expect(parsePlan('p', '﻿' + PLAN.replace(/\n/g, '\r\n')).plan).toEqual(parsePlan('p', PLAN).plan);
  });
});

describe('parseLedger, parseReview, parseBaseline', () => {
  it('maps task numbers to the commit of their first done line, and collects Rulings', () => {
    const l = parseLedger(
      'l',
      '## Tasks\n- task 1 done abc1234\n- task 2 done 1234567890\n- task 1 done fffffff\n- task 3 done xyz\n\n## Rulings\n- Ruling: kept the signature — callers — one branch\n',
    );
    expect(l).toEqual({
      file: 'l',
      done: { '1': 'abc1234', '2': '1234567890' },
      rulings: ['Ruling: kept the signature — callers — one branch'],
    });
  });

  it('takes the last verdict line', () => {
    expect(parseReview('r', '## Round 1\nverdict: open\n\n## Round 2\nverdict: converged\n')).toEqual({
      file: 'r',
      verdict: 'converged',
      line: 5,
    });
    expect(parseReview('r', 'no verdict here\n')).toEqual({ file: 'r' });
    // Spec §10: accepted-by-owner carries the owner's sentence quoted; the verdict is the first token.
    expect(parseReview('r', 'verdict: accepted-by-owner "ship it as is"\n')).toEqual({
      file: 'r',
      verdict: 'accepted-by-owner',
      line: 1,
    });
  });

  it('drops comments and blanks, sorts, and de-duplicates the baseline', () => {
    expect(parseBaseline('# header\nb#2\n\na#1\nb#2\n')).toEqual(['a#1', 'b#2']);
  });
});

describe('loadSnapshot work records', () => {
  const base = { 'accord/config.yml': CONFIG, 'accord/tickets/T-1.md': laneTicket('T-1') };
  const load = (files: Record<string, string>) => loadSnapshot({ files, tree: Object.keys(files).sort() });

  it('omits work, testsBaseline, and claims when nothing supplies them (D-54)', () => {
    const s = load(base);
    expect('work' in s).toBe(false);
    expect('testsBaseline' in s).toBe(false);
    expect('claims' in s).toBe(false);
  });

  it('keys plan, ledger, and review by ticket folder, and reads the baseline', () => {
    const s = load({
      ...base,
      'accord/tickets/T-1/plan.md': PLAN,
      'accord/tickets/T-1/ledger.md': '## Tasks\n- task 1 done abc1234\n',
      'accord/tickets/T-1/review.md': 'verdict: converged\n',
      'accord/tests-baseline.txt': 'old#1\n',
    });
    expect(s.work?.['T-1'].plan?.tasks).toHaveLength(2);
    expect(s.work?.['T-1'].ledger?.done).toEqual({ '1': 'abc1234' });
    expect(s.work?.['T-1'].review?.verdict).toBe('converged');
    expect(s.testsBaseline).toEqual(['old#1']);
  });

  it('reports a work record whose ticket is missing', () => {
    const s = load({ ...base, 'accord/tickets/GONE/plan.md': PLAN });
    expect(s.errors).toContainEqual({
      file: 'accord/tickets/GONE/plan.md',
      rule: 'load.work-orphan',
      reason: 'work record without a ticket: accord/tickets/GONE.md is missing',
    });
  });

  it('ignores records under a ticket without lane:, so 0.1.0 tickets keep their results (F1)', () => {
    const s = load({
      ...base,
      'accord/tickets/OLD.md': laneTicket('OLD', { lane: '' }),
      'accord/tickets/OLD/plan.md': '## Task 1: A\n\n## Task 1: B\n',
      'accord/tickets/OLD/review.md': 'verdict: converged\n',
    });
    expect('work' in s).toBe(false);
    expect(s.errors.filter((f) => f.file.startsWith('accord/tickets/OLD/'))).toEqual([]);
  });

  it('carries host claims through', () => {
    expect(loadSnapshot({ files: base, tree: [], claims: { 'T-1': 'a@example.test' } }).claims).toEqual({
      'T-1': 'a@example.test',
    });
  });
});
