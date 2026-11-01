// ST-LN-57 Task 8: ac-4 (from round 3 a Should rests on a ticket line or a failing case) and ac-5 (a file a fix changed
// needs a finding or a Ruling), with D-07, D-11 and D-14's exemption for ac-5 alone.
import { expect, it } from 'vitest';
import { gateDone } from '../src/index.js';
import type { BranchFact, RangeCommit, RepoSnapshot } from '../src/index.js';
import { mentionsPath } from '../src/round/grounds.js';
import { commit, facts, scopeSnapshot, v2Review } from '../../../test/helpers/review-v2.js';
import type { RoundSpec } from '../../../test/helpers/review-v2.js';

const GROUNDS = 'gate.finding-grounds';
const FIX_FILE = 'gate.fix-file-unexplained';
const EVIDENCE = 'gate.finding-evidence';
const reasonsOf = (snap: RepoSnapshot, rule: string): string[] => gateDone(snap, 'T-1').findings.filter((f) => f.rule === rule).map((f) => f.reason);
const line = (severity: 'Must' | 'Should' | 'Nice', n: number, where: string, state = 'open', ...marks: string[]): string =>
  `${severity} ${n} [patch]: x — ${where} — ${state}${marks.map((m) => ' — ' + m).join('')}`;
const none = (n: number): RangeCommit[][] => Array.from({ length: n }, () => []);

it('ac-4 from round 3 a should rests on a ticket line or a failing case', () => {
  const three = (round3: string[], o: { lane?: 'M' | 'S'; mark?: 'final'; two?: string[] } = {}): RepoSnapshot => {
    const rounds: RoundSpec[] = [{ lines: [] }, { lines: o.two ?? [] }, { lines: round3, ...(o.mark === undefined ? {} : { mark: o.mark }) }];
    return scopeSnapshot({ lane: o.lane ?? 'M', review: v2Review([rounds]), facts: facts(none(3)) });
  };
  const should = (...marks: string[]): string => line('Should', 1, 'src/a.ts:1', 'open', ...marks);
  const grounds = (snap: RepoSnapshot): string[] => reasonsOf(snap, GROUNDS);

  const failing = grounds(three([should()]));
  expect(failing).toHaveLength(1);
  expect(failing[0]).toContain('round 3');
  expect(failing[0]).toContain('finding 1');

  // a ticket line that exists, a failing test, a reproducing command, data loss or security
  for (const mark of [
    'rests on: ac-1',
    'rests on: D-01',
    'rests on: Veto "No new dependency."',
    'rests on: Intent "export their report as CSV"',
    'test: export#writes-csv',
    'command: npm test',
    'risk: data-loss',
    'risk: security',
  ]) {
    expect(grounds(three([should(mark)])), mark).toEqual([]);
  }
  // a Nice is asked nothing, a carried Should is not new
  expect(grounds(three([line('Nice', 1, 'src/a.ts:1')]))).toEqual([]);
  expect(grounds(three([should('carried from 2.1')], { two: [line('Nice', 1, 'src/q.ts:1', 'fixed in abc1234')] }))).toEqual([]);

  // a line the ticket does not hold, a quote of one word, or a section of lane S in lane M
  for (const mark of [
    'rests on: ac-9',
    'rests on: D-07',
    'rests on: Veto "dependency"',
    'rests on: Intent "export their spreadsheet as CSV"',
    'rests on: Understood "The export button writes a csv file."',
  ]) {
    expect(grounds(three([should(mark)])), mark).toHaveLength(1);
  }

  // rounds 1 and 2 fix every Should as today; a final review is not counted (D-07, D-13)
  const two = scopeSnapshot({ review: v2Review([[{ lines: [] }, { lines: [should()] }]]), facts: facts(none(2)) });
  expect(grounds(two)).toEqual([]);
  expect(grounds(three([should()], { mark: 'final' }))).toEqual([]);

  // lane S (D-11): a quote of Understood or Done when, no acceptance criterion
  for (const mark of ['rests on: Understood "The export button writes a csv file."', 'rests on: Done when "Pressing export saves report.csv."']) {
    expect(grounds(three([should(mark)], { lane: 'S' })), mark).toEqual([]);
  }
  expect(grounds(three([should('rests on: ac-1')], { lane: 'S' }))).toHaveLength(1);
  expect(grounds(three([should()], { lane: 'S' }))).toHaveLength(1);
});

it('ac-5 a file a fix changed needs a finding or a ruling', () => {
  const rounds: RoundSpec[] = [
    { lines: [line('Must', 1, 'src/a.ts:1', 'fixed in abc1234')] },
    { lines: [], mark: 'added' },
    { lines: [line('Must', 1, 'src/gen/y.ts:1')] },
  ];
  const ranges: RangeCommit[][] = [
    [
      commit(['src/a.ts', 'src/c.ts', 'accord/tickets/T-1/ledger.md']),
      commit(['src/m.ts'], 'merge'),
      commit(['src/e.ts'], 'episode'),
      commit(['accord/tickets/T-1/ledger.md']),
      commit(['src/gen/x.ts']),
      commit(['.claude/skills/x/SKILL.md']),
    ],
    [commit(['src/d.ts']), commit(['src/gen/y.ts'])],
    [],
  ];
  const branch: BranchFact = { base: 'b', changes: [], synced: ['.claude/skills/x/SKILL.md'], baseConfig: 'generated:\n  - src/gen/\n' };
  const rulingFor = (path: string): string => `- Ruling: ${path} holds the helper the fix needed — the header writer moved there — cost if wrong: one file reviewed twice\n`;
  const build = (o: { ledger?: string; tail?: string; facts?: ReturnType<typeof facts>; review?: string; doneOnDefault?: true } = {}): RepoSnapshot =>
    scopeSnapshot({
      review: o.review ?? v2Review([rounds], o.tail),
      ledger: o.ledger,
      facts: o.facts ?? facts(ranges),
      branch,
      ...(o.doneOnDefault === undefined ? {} : { doneOnDefault: true as const }),
    });

  // the merge's, the episode's, the records-only commit's, the generated and the synced paths need nothing (D-09, D-14)
  const named = reasonsOf(build(), FIX_FILE);
  expect(named).toHaveLength(2);
  expect(named.find((r) => r.startsWith('src/c.ts'))).toContain('round 1 of cycle 1');
  expect(named.find((r) => r.startsWith('src/d.ts'))).toContain('round 2 of cycle 1');
  expect(named.join('\n')).not.toContain('src/m.ts');
  expect(named.join('\n')).not.toContain('src/e.ts');
  expect(named.join('\n')).not.toContain('src/gen/');
  expect(named.join('\n')).not.toContain('SKILL.md');

  // a Ruling with the path and a reason explains it
  expect(reasonsOf(build({ ledger: rulingFor('src/c.ts') }), FIX_FILE)).toHaveLength(1);
  expect(reasonsOf(build({ ledger: rulingFor('src/c.ts') + rulingFor('src/d.ts') }), FIX_FILE)).toEqual([]);

  // D-14 exempts a generated path for ac-5 alone: it still counts among round 2's fix files for ac-2 (D-03)
  const snap = build({ ledger: rulingFor('src/c.ts') + rulingFor('src/d.ts') });
  expect(reasonsOf(snap, EVIDENCE)).toEqual([]);

  // D-10, an error in the facts, and a version 1 record check nothing
  expect(reasonsOf(build({ tail: '\nverdict: converged\n', doneOnDefault: true }), FIX_FILE)).toEqual([]);
  expect(reasonsOf(build({ facts: facts(ranges, { skip: 'on-default' }) }), FIX_FILE)).toEqual([]);
  expect(reasonsOf(build({ facts: { error: 'x' } }), FIX_FILE)).toEqual([]);
  const v1 = 'Round record: 1\n\n## Round 1\n\nMust 1: x\n\n## Round 2\n\nNo findings\n\n## Round 3\n\nNo findings\n';
  expect(reasonsOf(build({ review: v1 }), FIX_FILE)).toEqual([]);
});

it('risk:parsing a ruling names a path only as a whole token', () => {
  const fix = 'src/c.ts';
  const text = (ruling: string): boolean => mentionsPath(ruling, fix);
  for (const no of [
    '- Ruling: src/c.tsx moved — reason — cost',
    '- Ruling: xsrc/c.ts moved — reason — cost',
    '- Ruling: src/c.ts.bak kept — reason — cost',
    '- Ruling: src/c.ts moved',
  ]) {
    expect(text(no), no).toBe(false);
  }
  for (const yes of [
    '- Ruling: `src/c.ts` moved — reason — cost',
    '- Ruling: moved src/c.ts, a helper — reason — cost',
    '- Ruling: the helper is src/c.ts. — reason — cost',
  ]) {
    expect(text(yes), yes).toBe(true);
  }

  // through the gate: a Ruling that quotes only a longer path explains nothing
  const rounds: RoundSpec[] = [{ lines: [line('Must', 1, 'src/a.ts:1', 'fixed in abc1234')] }];
  const snap = (ledger: string): RepoSnapshot =>
    scopeSnapshot({ review: v2Review([rounds]), ledger, facts: facts([[commit(['src/a.ts', fix])]]) });
  expect(reasonsOf(snap('- Ruling: src/c.tsx moved — reason — cost\n'), FIX_FILE)).toHaveLength(1);
  expect(reasonsOf(snap('- Ruling: the helper is src/c.ts. — reason — cost\n'), FIX_FILE)).toEqual([]);
});

it('risk:regression a ticket research record the fix added and a Wording-only line need no finding or Ruling for ac-5', () => {
  const rounds: RoundSpec[] = [{ lines: [line('Must', 1, 'src/a.ts:1', 'fixed in abc1234')] }];
  const research = 'accord/research/2026-11-01-x.md';
  const branch: BranchFact = { base: 'b', changes: [{ path: research, kind: 'added', lines: 5 }], synced: [], baseConfig: '' };
  const ranges = [[commit(['src/a.ts', research, 'docs/w.md', 'src/c.ts'])]];
  const build = (ledger?: string, listed = true): RepoSnapshot => {
    const snap = scopeSnapshot({ review: v2Review([rounds]), ledger, facts: facts(ranges), branch });
    const t = snap.tickets['T-1'];
    return listed ? { ...snap, tickets: { ...snap.tickets, 'T-1': { ...t, frontmatter: { ...t.frontmatter!, research: [research] } } } } : snap;
  };
  const named = (snap: RepoSnapshot): string => reasonsOf(snap, FIX_FILE).join('\n');

  // the listed, added research record is the ticket's own file; an unlisted one is not
  expect(named(build())).not.toContain(research);
  expect(named(build(undefined, false))).toContain(research);

  // a Wording-only line names its path as explained, and only that path
  expect(named(build('- Wording-only: docs/w.md — a typo in the heading\n'))).not.toContain('docs/w.md');
  expect(named(build('- Wording-only: docs/w.md — a typo in the heading\n'))).toContain('src/c.ts');
});
