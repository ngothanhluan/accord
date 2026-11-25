// Phase 15 D-31, D-10: `accord gate done <id> --slice <n>` judges only slice n's criteria (its `covers:` set) in every Done rule that reads scenarios, evidence blocks or ticks, and the
// tasks of slices 1..n; every other Done rule runs as for the whole ticket, and the last slice judges the full set. On real files and real git, through the real command.
import { existsSync, readFileSync, utimesSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { recordTaskDone, setFrontmatterKey } from '@accord-dev/accord-core';
import { describe, expect, it } from 'vitest';
import { approve, CONFIG, discussFiles, discussPath, done, gateReadyIn, junit, laneTicket, LANE_BODY, P, PLAN, REPORT, type Files } from '../../../test/helpers/lane.js';
import { cleanup, commitAll, commitMsg, gitRun, makeEmptyRepo, makeLaneRepo, run, writeFiles } from './helpers/repo.js';

interface Found { rule: string; level: string; file: string; reason: string }

/** LANE_BODY with a third criterion: slice 1 delivers @ac-1, slice 2 delivers @ac-2 and @ac-3. */
const BODY = LANE_BODY.replace(
  '    Then the cell is quoted\n```',
  ['    Then the cell is quoted', '', '  @ac-3 @test:export#third', '  Scenario: a third thing', '    Given a report', '    When the owner exports it', '    Then a third thing happens', '```'].join('\n'),
);

const TWO_SLICES = ['## Slice 1: Writer', 'tasks: 1', 'covers: @ac-1', '', '## Slice 2: Escaping', 'tasks: 2', 'covers: @ac-2 @ac-3', ''].join('\n');
const planOf = (baseline: string, slices: string): string =>
  [
    '---',
    `baseline: ${baseline}`,
    '---',
    '',
    '# Plan',
    '',
    '## Task 1: Writer csv mode',
    'covers: @ac-1, D-01',
    'files: src/export.ts',
    'verify: export#writes-csv (@ac-1)',
    'after: none',
    'Add a csv branch to the writer.',
    '',
    '## Task 2: Escaping',
    'covers: @ac-2, @ac-3',
    'files: src/export.ts',
    'verify: export#escapes-commas (@ac-2), export#third (@ac-3)',
    'after: 1',
    'Quote cells that contain a comma.',
    '',
    slices,
  ].join('\n');

const evidenceBlock = (n: number, cite: string): string => `## @ac-${n} criterion ${n}\n\nResult: pass\n\nEvidence: ${cite}\n`;
const CITES: Record<number, string> = { 1: 'export#writes-csv passed in reports/junit.xml', 2: 'export#escapes-commas passed in reports/junit.xml', 3: 'export#third passed in reports/junit.xml' };

interface Build {
  slices?: string; // the plan's slice sections; the default is two slices
  report?: Record<string, 'passed' | 'failed' | 'skipped'>; // the report at the gated commit
  done?: number[]; // the tasks recorded in the ledger
  ticked?: number[]; // the criteria ticked, and the evidence blocks written
  stray?: number[]; // evidence blocks of criteria that are not ticked, written as a failing result that cites nothing
  evidence?: Record<number, string>; // the text an evidence block cites, by criterion; the default cites the criterion's passing test
}

/** T-1 on its claim branch, ready and planned, the way lane-flow builds it; the reviewer's evidence and ticks bound to HEAD are left uncommitted, as the reviewer leaves them. */
function build(b: Build = {}): string {
  const repo = makeLaneRepo({ ...discussFiles('T-1'), [P('T-1')]: laneTicket('T-1', { body: BODY }) });
  try {
    gitRun(repo, 'config', 'user.email', 'fixture@example.invalid');
    gitRun(repo, 'config', 'user.name', 'fixture');
    gitRun(repo, 'config', 'commit.gpgsign', 'false');
    commitMsg(repo, 'base');
    gitRun(repo, 'switch', '-q', '-c', 't/T-1');
    const files: Files = {};
    for (const rel of ['accord/config.yml', P('T-1'), 'src/export.ts', discussPath('T-1')]) files[rel] = readFileSync(join(repo, ...rel.split('/')), 'utf8');
    approve(files, 'T-1');
    if (gateReadyIn(files, 'T-1') !== 'pass') throw new Error('the fixture ticket is not ready');
    writeFiles(repo, { [P('T-1')]: files[P('T-1')] });
    const baseline = commitMsg(repo, 'fixture');
    writeFiles(repo, { 'accord/tickets/T-1/plan.md': planOf(baseline, b.slices ?? TWO_SLICES) });
    const planned = commitMsg(repo, 'plan: T-1 ready');
    const ledger = (b.done ?? [1]).reduce<string | undefined>((text, n) => recordTaskDone(text, n, planned.slice(0, 12)) as string, undefined);
    writeFiles(repo, {
      'src/export.ts': readFileSync(join(repo, 'src', 'export.ts'), 'utf8') + '// the code\n',
      [REPORT]: junit(b.report ?? { 'export#writes-csv': 'passed' }),
      ...(ledger === undefined ? {} : { 'accord/tickets/T-1/ledger.md': ledger }),
    });
    const head = commitMsg(repo, 'the code of T-1');
    const later = new Date(Date.now() + 5000);
    utimesSync(join(repo, REPORT), later, later);
    writeFiles(repo, { 'accord/tickets/T-1/review.md': `Round record: 2\n\n## Round 1 head ${head}\n\nNo findings\n\nSecurity: no pattern matched\n\nverdict: converged\n` });
    const sha = commitAll(repo);
    const file = join(repo, P('T-1'));
    let ticket = readFileSync(file, 'utf8');
    const hash = /^ac_hash: "(.+)"$/m.exec(ticket)?.[1] as string;
    const ticked = b.ticked ?? [1];
    ticket = setFrontmatterKey(ticket, 'verified', ticked.map((n) => 'ac-' + n));
    ticket = setFrontmatterKey(ticket, 'verified_hash', hash);
    ticket = setFrontmatterKey(ticket, 'verified_commit', sha);
    writeFileSync(file, ticket);
    const blocks = [...ticked.map((n) => evidenceBlock(n, b.evidence?.[n] ?? CITES[n])), ...(b.stray ?? []).map((n) => evidenceBlock(n, 'it looked fine to me').replace('Result: pass', 'Result: fail'))];
    writeFiles(repo, { 'accord/tickets/T-1/verification.md': ['---', 'ticket: "T-1"', `commit: "${sha}"`, 'reviewed_on: "2026-11-26"', '---', '', ...blocks].join('\n') });
    return repo;
  } catch (e) {
    cleanup(repo);
    throw e;
  }
}

const gateDone = async (repo: string, ...flags: string[]): Promise<{ code: number; out: string; err: string; found: Found[] }> => {
  const r = await run(['gate', 'done', 'T-1', ...flags, '--json'], repo);
  return { ...r, found: r.code === 2 ? [] : (JSON.parse(r.out) as { findings: Found[] }).findings };
};
const errors = (found: Found[]): string[] => found.filter((f) => f.level === 'error').map((f) => f.rule);

describe('gate done --slice', () => {
  it('risk:regression slice 1 of 2 passes gate done on its own criteria, and the same commit fails without --slice (D-31)', async () => {
    const repo = build();
    try {
      const slice = await gateDone(repo, '--slice', '1');
      expect(errors(slice.found)).toEqual([]);
      expect(slice.code).toBe(0);
      expect(slice.err).toContain('slice 1 of 2: 1 criteria judged');
      const whole = await gateDone(repo);
      expect(whole.code).toBe(1);
      const differ = whole.found.filter((f) => f.rule === 'gate.tags-differ');
      expect(differ).toHaveLength(1);
      expect(differ[0].reason).toContain('@ac-2 @ac-3');
      // The unfinished slice 2 task is not asked of slice 1's pull request either: it is built on a branch that pull request does not hold.
      expect([...new Set(errors(whole.found))].sort()).toEqual(['gate.tags-differ', 'gate.task-incomplete', 'gate.test-unknown']);
    } finally {
      cleanup(repo);
    }
  }, 120_000);

  it('risk:complex-branching slice 1 does not ask for the test of a later slice, and the whole ticket does (D-31)', async () => {
    const repo = build();
    try {
      const slice = await gateDone(repo, '--slice', '1');
      expect(slice.found.filter((f) => f.rule === 'gate.test-unknown' || f.rule === 'gate.test-not-passed')).toEqual([]);
      const whole = await gateDone(repo);
      const unknown = whole.found.filter((f) => f.rule === 'gate.test-unknown').map((f) => f.reason);
      expect(unknown).toHaveLength(2);
      expect(unknown.join(' ')).toContain('export#escapes-commas');
      expect(unknown.join(' ')).toContain('export#third');
    } finally {
      cleanup(repo);
    }
  }, 120_000);

  it("risk:complex-branching slice 1 does not read the evidence block of a later slice's criterion, and the whole ticket does (D-31)", async () => {
    const repo = build({ stray: [2] });
    try {
      const slice = await gateDone(repo, '--slice', '1');
      expect(slice.found.filter((f) => f.rule === 'gate.evidence-unresolved' || f.rule === 'gate.result-not-pass')).toEqual([]);
      expect(slice.code).toBe(0);
      const whole = await gateDone(repo);
      expect(errors(whole.found)).toEqual(expect.arrayContaining(['gate.evidence-unresolved', 'gate.result-not-pass']));
    } finally {
      cleanup(repo);
    }
  }, 120_000);

  it("risk:regression slice 1 still fails when its own criterion's evidence cites nothing that exists (D-31)", async () => {
    const repo = build({ evidence: { 1: 'it looked fine to me' } });
    try {
      const slice = await gateDone(repo, '--slice', '1');
      expect(slice.code).toBe(1);
      expect(errors(slice.found)).toContain('gate.evidence-unresolved');
    } finally {
      cleanup(repo);
    }
  }, 120_000);

  it('risk:complex-branching the last slice judges the full set: slice 2 of 2 names the criterion that is not ticked (D-31)', async () => {
    const repo = build({ done: [1, 2], report: { 'export#writes-csv': 'passed', 'export#escapes-commas': 'passed', 'export#third': 'passed' }, ticked: [1, 2] });
    try {
      const slice = await gateDone(repo, '--slice', '2');
      expect(slice.err).toContain('slice 2 of 2: 3 criteria judged');
      expect(slice.code).toBe(1);
      const differ = slice.found.filter((f) => f.rule === 'gate.tags-differ');
      expect(differ).toHaveLength(1);
      expect(differ[0].reason).toContain('evidence lacks @ac-3');
      expect(differ[0].reason).toContain('verified lacks @ac-3');
      expect(differ[0].reason).not.toContain('@ac-1');
      expect(errors(slice.found)).not.toContain('gate.task-incomplete');
    } finally {
      cleanup(repo);
    }
  }, 120_000);

  it('risk:regression the last slice passes once every criterion is ticked and every task is recorded (D-10, D-31)', async () => {
    const repo = build({ done: [1, 2], report: { 'export#writes-csv': 'passed', 'export#escapes-commas': 'passed', 'export#third': 'passed' }, ticked: [1, 2, 3] });
    try {
      const slice = await gateDone(repo, '--slice', '2');
      expect(errors(slice.found)).toEqual([]);
      expect(slice.code).toBe(0);
      expect((await gateDone(repo)).code).toBe(0);
    } finally {
      cleanup(repo);
    }
  }, 120_000);

  it('risk:security slice 1 still runs the hash rules: a tick bound to other criteria fails gate.tick-stale-hash (D-31)', async () => {
    const repo = build();
    try {
      const file = join(repo, P('T-1'));
      writeFileSync(file, setFrontmatterKey(readFileSync(file, 'utf8'), 'verified_hash', 'fnv1a64:0000000000000000'));
      const slice = await gateDone(repo, '--slice', '1');
      expect(slice.code).toBe(1);
      expect(errors(slice.found)).toContain('gate.tick-stale-hash');
    } finally {
      cleanup(repo);
    }
  }, 120_000);

  it('risk:regression a slice run below the last leaves no gate.log line, so the pane never reads it as the ticket done (D-31)', async () => {
    const repo = build();
    try {
      const log = join(repo, '.accord-reports', 'T-1', 'gate.log');
      await gateDone(repo, '--slice', '1');
      expect(existsSync(log)).toBe(false);
      await gateDone(repo);
      expect(existsSync(log)).toBe(true);
    } finally {
      cleanup(repo);
    }
  }, 120_000);

  it('risk:parsing --slice outside the plan, not a number, or on a plan with no slices is a usage error (exit 2)', async () => {
    const repo = build();
    const plain = build({ slices: '' });
    try {
      for (const value of ['0', '3', 'x', '1.5', '-1', '01x']) {
        const r = await run(['gate', 'done', 'T-1', '--slice', value], repo);
        expect(r.code, '--slice ' + value).toBe(2);
        expect(r.out).toBe('');
      }
      expect((await run(['gate', 'done', 'T-1', '--slice', '3'], repo)).err).toContain("1 to 2");
      const none = await run(['gate', 'done', 'T-1', '--slice', '1'], plain);
      expect(none.code).toBe(2);
      expect(none.err).toContain('no "## Slice" section');
      expect((await run(['gate', 'ready', 'T-1', '--slice', '1'], repo)).code).toBe(2);
      expect((await run(['gate', 'plan', 'T-1', '--slice', '1'], repo)).code).toBe(2);
    } finally {
      cleanup(repo);
      cleanup(plain);
    }
  }, 240_000);

  it('risk:regression a ticket done on the base branch runs only the done-ticket-edited row, whatever --slice says (D-23, D-31)', async () => {
    const repo = makeEmptyRepo();
    try {
      const files: Files = { 'accord/config.yml': CONFIG, [REPORT]: junit({ 'export#writes-csv': 'passed', 'export#escapes-commas': 'passed' }), 'src/export.ts': 'export {};\n' };
      done(files, 'T-1');
      files['accord/tickets/T-1/verification.md'] = ['---', 'ticket: T-1', 'commit: abc1234', 'reviewed_on: 2026-09-10', '---', '', '## @ac-1 Export writes a csv', '', 'Result: pass', '', 'Evidence: src/export.ts', '', '## @ac-2 Commas are escaped', '', 'Result: pass', '', 'Evidence: src/export.ts', ''].join('\n');
      files['accord/tickets/T-1/plan.md'] = PLAN + '\n## Slice 1: Writer\ntasks: 1\ncovers: @ac-1\n\n## Slice 2: Escaping\ntasks: 2\ncovers: @ac-2\n';
      writeFiles(repo, files);
      commitMsg(repo, 'base: T-1 done');
      gitRun(repo, 'branch', '-M', 'main');
      gitRun(repo, 'switch', '-q', '-c', 'work');
      writeFiles(repo, { [P('T-1')]: readFileSync(join(repo, P('T-1')), 'utf8') + '\nA late thought.\n' });
      commitMsg(repo, 'edit a done ticket');
      const edited = await gateDone(repo, '--slice', '1');
      expect(edited.code).toBe(1);
      expect(errors(edited.found)).toEqual(['gate.done-ticket-edited']);
    } finally {
      cleanup(repo);
    }
  }, 120_000);
});
