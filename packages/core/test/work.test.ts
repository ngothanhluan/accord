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

  it('splits (new) off files: onto newFiles; a leading (new) marks nothing', () => {
    const t = (v: string) => parsePlan('p', `## Task 1: A\nfiles: ${v}\n`).plan.tasks[0];
    expect([t('src/a.ts, src/b.ts (new)').files, t('src/a.ts, src/b.ts (new)').newFiles]).toEqual([['src/a.ts', 'src/b.ts'], ['src/b.ts']]);
    expect([t('(new) src/a.ts').files, t('(new) src/a.ts').newFiles]).toEqual([['src/a.ts'], []]);
    expect([t('(new)').files, t('(new)').newFiles]).toEqual([[], []]);
  });

  it('reads plan_hash as written; the body hash ignores line endings, the BOM, and the frontmatter', () => {
    const hash = 'plan_hash: fnv1a64:0123456789abcdef';
    expect(parsePlan('p', PLAN.replace(/plan_hash: .*\n/, hash + '\n')).plan.planHash).toBe('fnv1a64:0123456789abcdef');
    const body = parsePlan('p', PLAN).plan.bodyHash;
    expect(parsePlan('p', PLAN.replace(/\n/g, '\r\n')).plan.bodyHash).toBe(body);
    expect(parsePlan('p', '﻿' + PLAN.replace(/\n/g, '\r\n')).plan.bodyHash).toBe(body);
    expect(parsePlan('p', PLAN.replace('verify: export#writes-csv', 'verify: export#other')).plan.bodyHash).not.toBe(body);
    expect(parsePlan('p', PLAN.replace(/plan_hash: .*\n/, hash + '\n')).plan.bodyHash).toBe(body);
    expect(parsePlan('p', PLAN.replace(/plan_hash: .*\n/, '')).plan.bodyHash).toBe(body);
  });

  it('the helper PLAN carries the hash of its own body', () => {
    expect(PLAN).toContain(`plan_hash: "${parsePlan('p', PLAN).plan.bodyHash}"`);
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

  it('reads baseline: from the frontmatter and keeps task lines as file lines', () => {
    const text = '---\nbaseline: 3f2a9c1\n---\n\n## Task 1: A\ncovers: @ac-1\n';
    const { plan, findings } = parsePlan('p', text);
    expect(findings).toEqual([]);
    expect(plan.baseline).toBe('3f2a9c1');
    expect(plan.tasks.map((t) => [t.n, t.line, t.covers])).toEqual([[1, 5, ['@ac-1']]]);
    expect(parsePlan('p', '﻿' + text.replace(/\n/g, '\r\n')).plan).toEqual(plan);
  });

  it('omits baseline when there is no frontmatter or it is not a string', () => {
    expect(parsePlan('p', '## Task 1: A\n').plan).not.toHaveProperty('baseline');
    expect(parsePlan('p', '---\nbaseline: [1]\n---\n## Task 1: A\n').plan).not.toHaveProperty('baseline');
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
      rulingsSection: ['- Ruling: kept the signature — callers — one branch'],
    });
    // No Rulings section: the field is omitted, never undefined (D-54).
    expect(parseLedger('l', '- task 1 done abc1234\n')).not.toHaveProperty('rulingsSection');
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

  it('treats only "#" and "# text" as comments; "#123-x" is an id', () => {
    expect(parseBaseline('# note\n#\n#123-x\n')).toEqual(['#123-x']);
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

it('risk:parsing verify markers map the test id before them and stay out of verify', () => {
  const { plan } = parsePlan('p.md', '## Task 1: A\nverify: (@ac-4), a#x (@ac-1), b#y, c#z (@ac-2) (@ac-3)\n');
  expect(plan.tasks[0].verify).toEqual(['a#x', 'b#y', 'c#z']);
  expect(plan.tasks[0].maps).toEqual([
    { test: 'a#x', ac: '@ac-1' },
    { test: 'c#z', ac: '@ac-2' },
    { test: 'c#z', ac: '@ac-3' },
  ]);
});
