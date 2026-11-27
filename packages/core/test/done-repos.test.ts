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

// A ticket of two criteria: @ac-1 is proved by a test of tools, @ac-2 by a test of this repository.
const BODY = sized(8).replace('@ac-1 @test:export#writes-csv', '@ac-1 @test:tools:Tools.Tests#adds');

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
