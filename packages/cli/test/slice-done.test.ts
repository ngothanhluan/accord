// Phase 15 D-31, D-10: `accord gate done <id> --slice <n>` judges only slice n's criteria (its `covers:` set) in every Done rule that reads scenarios, evidence blocks or ticks, and the
// tasks of slices 1..n; every other Done rule runs as for the whole ticket, and the last slice judges the full set. On real files and real git, through the real command.
import { existsSync, readFileSync, utimesSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { recordTaskDone, setFrontmatterKey, SLICES_FROM } from '@accord-dev/accord-core';
import { describe, expect, it } from 'vitest';
import { approve, CONFIG, discussFiles, discussPath, done, gateReadyIn, junit, laneTicket, LANE_BODY, P, PLAN, REPORT, type Files } from '../../../test/helpers/lane.js';
import { claimedUnder, cleanup, commitAll, commitMsg, gitRun, makeEmptyRepo, makeLaneRepo, run, writeFiles } from './helpers/repo.js';

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
  extra?: Record<string, string>; // files written in the commit that holds the code, so the slice has a size to measure
  claim?: string; // the release the ticket was claimed under: a claim commit pinning it follows the branch; absent, no claim commit
  config?: (base: string) => string; // the accord/config.yml the fixture starts with, from the lane fixture's
}

/** T-1 on its claim branch, ready and planned, the way lane-flow builds it; the reviewer's evidence and ticks bound to HEAD are left uncommitted, as the reviewer leaves them. */
function build(b: Build = {}): string {
  const repo = makeLaneRepo({ ...discussFiles('T-1'), [P('T-1')]: laneTicket('T-1', { body: BODY }), ...(b.config === undefined ? {} : { 'accord/config.yml': b.config(CONFIG) }) });
  try {
    gitRun(repo, 'config', 'user.email', 'fixture@example.invalid');
    gitRun(repo, 'config', 'user.name', 'fixture');
    gitRun(repo, 'config', 'commit.gpgsign', 'false');
    commitMsg(repo, 'base');
    gitRun(repo, 'switch', '-q', '-c', 't/T-1');
    if (b.claim !== undefined) claimedUnder(repo, b.claim);
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
      ...b.extra,
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

// Phase 15 review C-CR-01, C-WR-07, C-WR-08: the scope is read from the branch's own records, never from its name, and a slice that judges nothing is refused.
describe('gate done --slice reads the branch, not its name', () => {
  const ALL = { 'export#writes-csv': 'passed', 'export#escapes-commas': 'passed', 'export#third': 'passed' } as const;

  it('risk:security slice 1 judges the whole ticket when the ledger records a task of slice 2, so an undelivered criterion fails (C-CR-01)', async () => {
    // one branch built both tasks and ticked only ac-1: the pull request of the claim branch is "slice 1" to CI, but it carries slice 2's work
    const repo = build({ done: [1, 2], report: ALL, ticked: [1] });
    try {
      const slice = await gateDone(repo, '--slice', '1');
      expect(slice.code).toBe(1);
      expect(slice.err).toContain('slice 1 of 2: 3 criteria judged (the ledger records a task of a later slice, so the whole ticket is judged)');
      const differ = slice.found.filter((f) => f.rule === 'gate.tags-differ');
      expect(differ).toHaveLength(1);
      expect(differ[0].reason).toContain('verified lacks @ac-2 @ac-3');
      // the same verdict as the run with no flag, and the pane's log records it as the ticket's Done
      expect(errors((await gateDone(repo)).found).sort()).toEqual(errors(slice.found).sort());
      expect(existsSync(join(repo, '.accord-reports', 'T-1', 'gate.log'))).toBe(true);
    } finally {
      cleanup(repo);
    }
    // slice 1 with only task 1 recorded is still its own slice, and passes
    const own = build({ done: [1] });
    try {
      const alone = await gateDone(own, '--slice', '1');
      expect(alone.code).toBe(0);
      expect(alone.err).not.toContain('whole ticket');
    } finally {
      cleanup(own);
    }
  }, 240_000);

  it('risk:security a widened slice 1 passes once every criterion is ticked and every task is recorded (C-CR-01)', async () => {
    const ok = build({ done: [1, 2], report: ALL, ticked: [1, 2, 3] });
    try {
      const r = await gateDone(ok, '--slice', '1');
      expect(errors(r.found)).toEqual([]);
      expect(r.code).toBe(0);
    } finally {
      cleanup(ok);
    }
  }, 240_000);

  it('risk:parsing --slice auto is slice 1 for a plan of two or more slices, and no restriction for a plan with fewer or only a fenced example (C-WR-07)', async () => {
    const sliced = build();
    const one = build({ slices: '## Slice 1: only\ntasks: 1, 2\ncovers: @ac-1 @ac-2 @ac-3\n' });
    const none = build({ slices: '' });
    // a fenced example is not a slice section, whatever grep thinks of its lines
    const fenced = build({ slices: '```\n## Slice 1: a\ntasks: 1\ncovers: @ac-1\n\n## Slice 2: b\ntasks: 2\ncovers: @ac-2\n```\n' });
    // the parser accepts what the old script's grep missed: two spaces, and a space before the colon
    const spaced = build({ slices: '## Slice  1 : Writer\ntasks: 1\ncovers: @ac-1\n\n## Slice 2 : Escaping\ntasks: 2\ncovers: @ac-2 @ac-3\n' });
    try {
      const a = await gateDone(sliced, '--slice', 'auto');
      expect(a.err).toContain('slice 1 of 2: 1 criteria judged');
      expect(a.code).toBe(0);
      expect((await gateDone(spaced, '--slice', 'auto')).err).toContain('slice 1 of 2: 1 criteria judged');
      for (const [what, repo] of [['one slice', one], ['no slice', none], ['fenced', fenced]] as const) {
        const r = await gateDone(repo, '--slice', 'auto');
        expect(r.code, what + r.err).not.toBe(2);
        expect(r.err, what).not.toContain('slice 1 of');
        // the same verdict as no flag
        expect(errors(r.found).sort(), what).toEqual(errors((await gateDone(repo)).found).sort());
      }
    } finally {
      for (const r of [sliced, one, none, fenced, spaced]) cleanup(r);
    }
  }, 480_000);

  it('risk:regression a slice whose covers: line names no @ac token is refused with exit 2, not passed with zero criteria judged (C-WR-08)', async () => {
    const empty = build({ slices: ['## Slice 1: Writer', 'tasks: 1', 'covers: @D-01', '', '## Slice 2: Escaping', 'tasks: 2', 'covers: @ac-2 @ac-3', ''].join('\n') });
    const upper = build({ slices: ['## Slice 1: Writer', 'tasks: 1', 'covers: @AC-1', '', '## Slice 2: Escaping', 'tasks: 2', 'covers: @ac-2 @ac-3', ''].join('\n') });
    try {
      for (const repo of [empty, upper]) {
        const r = await run(['gate', 'done', 'T-1', '--slice', '1'], repo);
        expect(r.code).toBe(2);
        expect(r.out).toBe('');
        expect(r.err).toContain('slice 1 of T-1 names no criterion on its covers: line');
        expect((await run(['gate', 'done', 'T-1', '--slice', 'auto'], repo)).code).toBe(2);
      }
    } finally {
      cleanup(empty);
      cleanup(upper);
    }
    // the last slice judges the whole ticket, so its own covers: line is not asked
    const last = build({ slices: ['## Slice 1: Writer', 'tasks: 1', 'covers: @ac-1', '', '## Slice 2: Escaping', 'tasks: 2', 'covers: @D-02', ''].join('\n'), done: [1, 2], report: ALL, ticked: [1, 2, 3] });
    try {
      expect((await gateDone(last, '--slice', '2')).code).toBe(0);
    } finally {
      cleanup(last);
    }
  }, 480_000);
});

// Phase 15 plan 16 (D-06, SC-3): `gate done --slice n` measures slice n and warns, never blocks, when it is over the review budget.
describe('gate done --slice measures the slice', () => {
  const lines = (n: number, what: string): string => Array.from({ length: n }, (_v, i) => `${what} ${i}\n`).join('');
  // 300 code, 600 test and 150 docs lines on top of the plan's baseline; a lockfile is not counted
  const BIG = {
    'src/big.ts': lines(300, 'code'),
    'packages/x/test/big.test.ts': lines(600, 'test'),
    'docs/guide.md': lines(150, 'docs'),
    'package-lock.json': lines(500, 'lock'),
  };
  const budget = (n: string) => (base: string): string => base.replace('  mode: outcome\n', `  mode: outcome\n  slice_lines: "${n}"\n`);
  const sizeFindings = (found: Found[]): Found[] => found.filter((f) => f.rule === 'gate.slice-diff-large');

  it('risk:regression slice 1 over the budget warns gate.slice-diff-large with the split, and the verdict is the one without the warning (D-06)', async () => {
    const repo = build({ extra: BIG, claim: SLICES_FROM });
    try {
      const slice = await gateDone(repo, '--slice', '1');
      const warned = sizeFindings(slice.found);
      expect(warned).toHaveLength(1);
      expect(warned[0].level).toBe('warning');
      expect(warned[0].reason).toMatch(/^slice 1 is 10\d\d lines \(code 3\d\d, test 600, docs 150\), over the review budget of 1000$/);
      // the verdict is what the same branch gets with the warning off: the warning adds no error and changes no exit code
      const quiet = build({ extra: BIG, claim: SLICES_FROM, config: (base) => base + 'strictness:\n  levels:\n    gate.slice-diff-large: off\n' });
      try {
        const off = await gateDone(quiet, '--slice', '1');
        expect(errors(slice.found)).toEqual(errors(off.found));
        expect(slice.code).toBe(off.code);
      } finally {
        cleanup(quiet);
      }
    } finally {
      cleanup(repo);
    }
  }, 240_000);

  it('risk:regression review.slice_lines moves the budget: a budget above the size is no warning, and a size equal to the budget is none either (D-06)', async () => {
    const repo = build({ extra: BIG, claim: SLICES_FROM, config: budget('1200') });
    try {
      expect(sizeFindings((await gateDone(repo, '--slice', '1')).found)).toEqual([]);
    } finally {
      cleanup(repo);
    }
  }, 120_000);

  it('risk:regression gate done with no --slice loads no size, so the same branch gets no size warning (D-06)', async () => {
    const repo = build({ extra: BIG, claim: SLICES_FROM });
    try {
      expect(sizeFindings((await gateDone(repo)).found)).toEqual([]);
    } finally {
      cleanup(repo);
    }
  }, 120_000);

  it('risk:regression a ticket claimed before SLICES_FROM gets no size warning, however large the slice (D-06)', async () => {
    const repo = build({ extra: BIG, claim: '0.20.3' });
    try {
      expect(sizeFindings((await gateDone(repo, '--slice', '1')).found)).toEqual([]);
    } finally {
      cleanup(repo);
    }
  }, 120_000);

  it('risk:regression the warning is a team level: strictness.levels can set it to off (D-06)', async () => {
    const repo = build({ extra: BIG, claim: SLICES_FROM, config: (base) => base + 'strictness:\n  levels:\n    gate.slice-diff-large: off\n' });
    try {
      expect(sizeFindings((await gateDone(repo, '--slice', '1')).found)).toEqual([]);
    } finally {
      cleanup(repo);
    }
  }, 120_000);

  it('risk:regression a slice whose start git cannot find makes no size fact: no warning and no error (D-06)', async () => {
    // slice 2 starts at the merge base with the claim branch; with that branch renamed there is nothing to measure from
    const repo = build({ extra: BIG, claim: SLICES_FROM });
    try {
      gitRun(repo, 'branch', '-m', 't/T-1', 'work');
      const r = await run(['gate', 'done', 'T-1', '--slice', '2', '--json'], repo);
      expect(r.code, r.err).not.toBe(2);
      expect(sizeFindings((JSON.parse(r.out) as { findings: Found[] }).findings)).toEqual([]);
    } finally {
      cleanup(repo);
    }
  }, 120_000);
});
