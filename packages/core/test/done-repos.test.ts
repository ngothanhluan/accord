// Phase 08.9.3 D-07, D-12, D-13: the other repository's part of a ticket is recorded in verification.md (`## Repository <name>`) and checked by `gate done` in CI and locally; the same record lets a scenario proved by a test
// in that repository (`@test:<name>:<id>`) pass. Real loader, real gate, in-memory files: only the rules of this plan are asserted on, never a whole Done verdict.
import { describe, expect, it } from 'vitest';
import { gateDone, loadSnapshot, REPOS_FROM } from '../src/index.js';
import type { GateResult, RepoSnapshot } from '../src/index.js';
import { parseVerification } from '../src/load/verification.js';
import { approved } from './helpers/approve.js';
import { CONFIG, junit, laneTicket, REPORT, sized } from '../../../test/helpers/lane.js';

const REMOTE = 'https://github.com/acme/tools.git';
const TESTS = 'node -e "process.exit(0)"';
const REPOS = ['repos:', '  tools:', `    remote: ${REMOTE}`, `    tests: ${TESTS}`, ''].join('\n');
const BASE = 'a'.repeat(40);
const HEAD = 'b'.repeat(40);
const MERGED = 'c'.repeat(40);

// A ticket of three criteria: @ac-1 is proved by a test of tools, @ac-2 and @ac-3 by tests of this repository (@ac-3 is the criterion of a third slice, for the plans of D-13).
const AC3 = ['', '  @ac-3 @test:export#escapes-commas', '  Scenario: a third thing', '    Given a report', '    When the owner exports it', '    Then a csv file is written', '```'].join('\n');
const BODY = sized(8)
  .replace('@ac-1 @test:export#writes-csv', '@ac-1 @test:tools:Tools.Tests#adds')
  .replace('    Then the cell is quoted\n```', '    Then the cell is quoted\n' + AC3);

const task = (n: number, files: string): string => `## Task ${n}: Step ${n}\ncovers: @ac-${n}\nfiles: ${files}\nverify: export#escapes-commas (@ac-2)\nafter: none\nDo step ${n}.\n`;
const slice = (n: number, tasks: string, repo?: string): string => `## Slice ${n}: Part ${n}\n${repo === undefined ? '' : `repo: ${repo}\n`}tasks: ${tasks}\ncovers: @ac-${n}\n`;
const planOf = (tasks: string[], slices: string[]): string => ['---', 'baseline: abc1234', `baseline_tools: ${BASE}`, '---', '', '# Plan', '', ...tasks, ...slices].join('\n');
/** Slice 1 in tools, slice 2 in this repository: the ticket of the tracer. */
const TOOLS_FIRST = planOf([task(1, 'tools:src/a.cs'), task(2, 'src/svc.ts')], [slice(1, '1', 'tools'), slice(2, '2')]);

/** One `## Repository tools` section: the suite line, then one group per slice. A group is the labels it holds, in order; `undefined` leaves a label out. */
interface Group {
  n?: number | string;
  pr?: string;
  head?: string;
  merged?: string;
  extra?: string[]; // lines written after the labels, as written
}
const group = (g: Group): string[] => [
  `Slice: ${g.n ?? 1}`,
  ...(g.pr === undefined ? [] : [`PR: ${g.pr}`]),
  ...(g.head === undefined ? [] : [`Verified head: ${g.head}`]),
  ...(g.merged === undefined ? [] : [`Merged: ${g.merged}`]),
  ...(g.extra ?? []),
];
const FULL: Group = { n: 1, pr: '#41', head: HEAD, merged: MERGED };
const section = (groups: Group[], suite: string | null = `passed ${TESTS}`, name = 'tools'): string[] => [
  `## Repository ${name}`,
  ...(suite === null ? [] : [`Suite: ${suite}`]),
  ...groups.flatMap(group),
  '',
];
const BLOCKS = ['## @ac-1 export writes', 'Result: pass', 'Evidence: the tools case adds passed.', '', '## @ac-2 commas', 'Result: pass', 'Evidence: the case escapes-commas passed.', ''];
const verification = (...repo: string[][]): string => ['---', 'ticket: "T-1"', `commit: "${'e'.repeat(40)}"`, 'reviewed_on: "2026-11-27"', '---', '', ...BLOCKS, ...repo.flat()].join('\n');

interface Opts {
  plan?: string;
  verification?: string | null; // null: no verification.md
  config?: string;
  claim?: { pin: string } | { error: string } | null;
  slice?: number; // gateDone's --slice
  extra?: Partial<RepoSnapshot>;
}
const snapshotOf = ({ plan = TOOLS_FIRST, verification: v = verification(section([FULL])), config = CONFIG + REPOS, claim = { pin: REPOS_FROM }, extra = {} }: Opts = {}): RepoSnapshot => {
  const files: Record<string, string> = approved(
    {
      'accord/config.yml': config,
      'accord/tickets/T-1.md': laneTicket('T-1', { body: BODY }),
      [REPORT]: junit({ 'export#writes-csv': 'passed', 'export#escapes-commas': 'passed' }),
      'accord/tickets/T-1/plan.md': plan,
      ...(v === null ? {} : { 'accord/tickets/T-1/verification.md': v }),
    },
    'T-1',
  );
  const snapshot = loadSnapshot({ files, tree: Object.keys(files).sort() });
  return { ...(claim === null ? snapshot : { ...snapshot, claimPins: { 'T-1': claim } }), ...extra };
};
const done = (o: Opts = {}): GateResult => gateDone(snapshotOf(o), 'T-1', o.slice === undefined ? {} : { slice: o.slice });
const rule = (r: GateResult, id: string) => r.findings.filter((f) => f.rule === id);
const RECORD = /^gate\.repo-record-/;
const records = (r: GateResult) => r.findings.filter((f) => RECORD.test(f.rule));
const tests = (r: GateResult) => r.findings.filter((f) => f.rule === 'gate.test-unknown' || f.rule === 'gate.test-not-passed');

describe('verification.md holds the other repository, as a section of its body (D-07)', () => {
  it('risk:security parseVerification reads a `## Repository tools` section into repos and leaves the evidence blocks as they were (D-07)', () => {
    const text = verification(section([FULL]));
    const { verification: v, findings } = parseVerification('T-1', 'accord/tickets/T-1/verification.md', text);
    expect(findings).toEqual([]);
    expect(v.blocks.map((b) => b.acTag)).toEqual(['ac-1', 'ac-2']);
    expect(v.frontmatter).toEqual({ ticket: 'T-1', commit: 'e'.repeat(40), reviewed_on: '2026-11-27' });
    expect(v.repos).toHaveLength(1);
    const [tools] = v.repos ?? [];
    expect(tools.name).toBe('tools');
    expect(tools.suite).toMatchObject({ result: 'passed', command: TESTS });
    expect(tools.slices).toHaveLength(1);
    expect(tools.slices[0]).toMatchObject({ n: 1, pr: 41, verifiedHead: HEAD, merged: MERGED });
  });

  it('risk:security a ticket with no Repository section keeps the Verification it had: no repos key at all (D-07)', () => {
    const { verification: v } = parseVerification('T-1', 'accord/tickets/T-1/verification.md', verification());
    expect(Object.keys(v)).not.toContain('repos');
  });
});

describe('a two-repository ticket passes Done on a complete record (D-07, D-12)', () => {
  it('risk:security a complete tools record, with config repos.tools.tests the same command, raises no record finding and no test finding (D-07, D-12)', () => {
    const r = done();
    expect(records(r)).toEqual([]);
    expect(tests(r)).toEqual([]);
  });

  it('risk:security without the `## Repository tools` section the ticket fails on the missing record, naming tools slice 1, and the @test:tools id names that record (D-07, D-12)', () => {
    const r = done({ verification: verification() });
    const missing = rule(r, 'gate.repo-record-missing');
    expect(missing).toHaveLength(1);
    expect(missing[0].level).toBe('error');
    expect(missing[0].reason).toContain('tools');
    expect(missing[0].reason).toContain('slice 1');
    expect(missing[0].reason).toContain('## Repository tools');
    const unknown = rule(r, 'gate.test-unknown');
    expect(unknown).toHaveLength(1);
    expect(unknown[0].reason).toContain('@test:tools:Tools.Tests#adds');
    expect(unknown[0].reason).toContain('## Repository tools');
  });
});

// --- what each slice's run requires (D-13), and what makes a record incomplete ---

/** Slices [1 in tools, 2 here, 3 here]. */
const TOOLS_1 = planOf([task(1, 'tools:src/a.cs'), task(2, 'src/svc.ts'), task(3, 'src/svc2.ts')], [slice(1, '1', 'tools'), slice(2, '2'), slice(3, '3')]);
/** Slices [1 here, 2 in tools, 3 here]. */
const TOOLS_2 = planOf([task(1, 'src/svc.ts'), task(2, 'tools:src/a.cs'), task(3, 'src/svc2.ts')], [slice(1, '1'), slice(2, '2', 'tools'), slice(3, '3')]);
/** Slices [1 in tools, 2 in tools, 3 here]. */
const TOOLS_12 = planOf([task(1, 'tools:src/a.cs'), task(2, 'tools:src/b.cs'), task(3, 'src/svc.ts')], [slice(1, '1', 'tools'), slice(2, '2', 'tools'), slice(3, '3')]);
const incomplete = (r: GateResult) => rule(r, 'gate.repo-record-incomplete');
/** The 1-based line of the first line of `text` that is exactly `needle`. */
const lineOf = (text: string, needle: string): number => text.split('\n').indexOf(needle) + 1;

describe('each slice run asks for the record its deploy order allows (D-13)', () => {
  it('the ticket of these cases has three criteria', () => {
    expect(BODY).toContain('@ac-3');
    expect(BODY).toContain('@test:tools:Tools.Tests#adds');
  });

  it('risk:complex-branching slices [1 tools, 2 here, 3 here] and --slice 2: the tools group needs PR, Verified head and Merged; without Merged one finding names Merged and slice 1 (D-13)', () => {
    const v = verification(section([{ n: 1, pr: '#41', head: HEAD }]));
    const f = incomplete(done({ plan: TOOLS_1, verification: v, slice: 2 }));
    expect(f).toHaveLength(1);
    expect(f[0].level).toBe('error');
    expect(f[0].reason).toContain('Merged:');
    expect(f[0].reason).toContain('slice 1');
    expect(incomplete(done({ plan: TOOLS_1, verification: verification(section([FULL])), slice: 2 }))).toEqual([]);
  });

  it("risk:complex-branching slices [1 here, 2 tools, 3 here] and --slice 2, the tools slice's own run: PR and Verified head are enough, Merged is not asked; without PR one finding (D-13)", () => {
    const own = verification(section([{ n: 2, pr: '#41', head: HEAD }]));
    const r = done({ plan: TOOLS_2, verification: own, slice: 2 });
    expect(records(r)).toEqual([]);
    const noPr = incomplete(done({ plan: TOOLS_2, verification: verification(section([{ n: 2, head: HEAD }])), slice: 2 }));
    expect(noPr).toHaveLength(1);
    expect(noPr[0].reason).toContain('PR:');
    expect(noPr[0].reason).toContain('slice 2');
  });

  it('risk:complex-branching --slice 1 of [1 here, 2 tools, 3 here] asks for no tools record at all, and the whole ticket asks for it in full (D-13)', () => {
    const none = done({ plan: TOOLS_2, verification: verification(), slice: 1 });
    expect(records(none)).toEqual([]);
    const full = done({ plan: TOOLS_2, verification: verification() });
    expect(rule(full, 'gate.repo-record-missing')).toHaveLength(1);
    expect(rule(full, 'gate.repo-record-missing')[0].reason).toContain('slice 2');
  });

  it('risk:complex-branching a run with no slice flag, or for the last slice, asks every tools group in full: slices [1 tools, 2 tools, 3 here] with slice 2 short of Merged (D-13)', () => {
    const v = verification(section([FULL, { n: 2, pr: '#42', head: HEAD }]));
    for (const slice of [undefined, 3]) {
      const f = incomplete(done({ plan: TOOLS_12, verification: v, ...(slice === undefined ? {} : { slice }) }));
      expect(f, String(slice)).toHaveLength(1);
      expect(f[0].reason).toContain('slice 2');
      expect(f[0].reason).toContain('Merged:');
    }
    // the run for slice 2 (another repository's, below the last): slice 1 merged, slice 2's own group needs PR and Verified head only
    expect(records(done({ plan: TOOLS_12, verification: v, slice: 2 }))).toEqual([]);
  });

  it('risk:complex-branching the Suite line is asked for each repository with a slice in the run scope, the own-run slice included (D-13)', () => {
    const noSuite = verification(section([{ n: 2, pr: '#41', head: HEAD }], null));
    const f = incomplete(done({ plan: TOOLS_2, verification: noSuite, slice: 2 }));
    expect(f).toHaveLength(1);
    expect(f[0].reason).toContain('Suite:');
    // slice 1 of the same plan has no tools slice in scope: no Suite line is asked
    expect(records(done({ plan: TOOLS_2, verification: noSuite, slice: 1 }))).toEqual([]);
  });
});

describe('a record that does not read, or is not whole, never passes (D-07, D-13)', () => {
  const cases: { title: string; v: string; fragment: string; at: string }[] = [
    { title: 'PR without the #', v: verification(section([{ ...FULL, pr: '41' }])), fragment: 'PR:', at: 'PR: 41' },
    { title: 'a Verified head of 7 characters', v: verification(section([{ ...FULL, head: 'abc1234' }])), fragment: 'Verified head', at: 'Verified head: abc1234' },
    { title: 'a Merged that is a branch name', v: verification(section([{ ...FULL, merged: 'main' }])), fragment: 'Merged', at: 'Merged: main' },
    { title: 'a suite recorded failed', v: verification(section([FULL], `failed ${TESTS}`)), fragment: 'failed', at: `Suite: failed ${TESTS}` },
    { title: 'a suite command that is not repos.tools.tests', v: verification(section([FULL], 'passed dotnet test')), fragment: 'repos.tools.tests', at: 'Suite: passed dotnet test' },
    { title: 'a suite line with no command', v: verification(section([FULL], 'passed')), fragment: 'Suite:', at: 'Suite: passed' },
  ];
  for (const c of cases) {
    it(`risk:security ${c.title}: one incomplete finding naming its line (D-07)`, () => {
      const f = incomplete(done({ verification: c.v }));
      expect(f).toHaveLength(1);
      expect(f[0].level).toBe('error');
      expect(f[0].reason).toContain(c.fragment);
      expect(f[0].line).toBe(lineOf(c.v, c.at));
      expect(rule(done({ verification: c.v }), 'gate.repo-record-missing')).toEqual([]);
    });
  }

  it('risk:security two Slice: 1 groups are one finding, naming the second (D-07)', () => {
    const v = verification(section([FULL, FULL]));
    const f = incomplete(done({ verification: v }));
    expect(f).toHaveLength(1);
    expect(f[0].reason).toContain('second "Slice: 1" group');
    expect(f[0].line).toBe(v.split('\n').lastIndexOf('Slice: 1') + 1);
  });

  it('risk:security a label that starts no line is not read: a list item, and a line inside a fence (D-07)', () => {
    const v = verification(['## Repository tools', `Suite: passed ${TESTS}`, 'Slice: 1', '- PR: #41', `Verified head: ${HEAD}`, '```', `Merged: ${MERGED}`, '```', '']);
    const reasons = incomplete(done({ verification: v })).map((f) => f.reason);
    expect(reasons).toHaveLength(2);
    expect(reasons.some((r) => r.includes('no "PR:" line'))).toBe(true);
    expect(reasons.some((r) => r.includes('no "Merged:" line'))).toBe(true);
  });

  it('risk:security a PR line that repeats in its group, and a Slice line that does not read, are findings and never attach later lines to an earlier group (D-07)', () => {
    const repeat = verification(['## Repository tools', `Suite: passed ${TESTS}`, 'Slice: 1', 'PR: #41', 'PR: #42', `Verified head: ${HEAD}`, `Merged: ${MERGED}`, '']);
    const r = incomplete(done({ verification: repeat }));
    expect(r).toHaveLength(1);
    expect(r[0].reason).toContain('repeats');
    const loose = verification(['## Repository tools', `Suite: passed ${TESTS}`, 'Slice: 1', 'PR: #41', `Verified head: ${HEAD}`, 'Slice: one', `Merged: ${MERGED}`, '']);
    const reasons = incomplete(done({ verification: loose })).map((f) => f.reason);
    // Merged follows a Slice line that did not read, so it belongs to no group: slice 1 lacks it, and both lines are named
    expect(reasons.some((x) => x.includes('"Slice: one"'))).toBe(true);
    expect(reasons.some((x) => x.includes('no "Merged:" line'))).toBe(true);
    expect(reasons.some((x) => x.includes(`"Merged: ${MERGED}" follows no "Slice: <n>" line that reads`))).toBe(true);
  });
});

describe('a ticket claimed before 0.22.0 is judged as before (D-13, T-08.9.3-27)', () => {
  it('risk:regression claimed at 0.21.1: no record finding, and @test:tools:<id> is looked up in this repository report as it was', () => {
    const r = done({ claim: { pin: '0.21.1' }, verification: verification() });
    expect(records(r)).toEqual([]);
    const unknown = rule(r, 'gate.test-unknown');
    expect(unknown).toHaveLength(1);
    expect(unknown[0].reason).toBe("@test:tools:Tools.Tests#adds not found in reports/junit.xml; ids are classname#name with spaces as '-'");
  });

  it('risk:regression a failed claim read applies the rules (fail closed)', () => {
    const r = done({ claim: { error: 'git said no' }, verification: verification() });
    expect(rule(r, 'gate.repo-record-missing')).toHaveLength(1);
  });
});
