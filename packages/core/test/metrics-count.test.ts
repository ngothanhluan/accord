import { expect, it } from 'vitest';

type Round = { n: number; Must: number; Should: number; Nice: number };
type Cycle = { max: number; rounds: Round[] };
type Row = { round: string; run: number; must: number; should: number; nice: number; perRound: string };
type Count = {
  countRecord: (text: string, kind: 'plan' | 'approach' | 'review') => Cycle[];
  stageTable: (cycles: Cycle[]) => { cycles: number; byRound: Row[] };
};
const load = async () => (await import(new URL('../../../scripts/metrics-count.mjs', import.meta.url).href)) as Count;
const rows = (t: { byRound: Row[] }) => t.byRound.map((r) => [r.round, r.run, r.must, r.should, r.nice, r.perRound].join('/'));

it('risk:parsing records count by the study rule (ST-LN-95 ac-1)', async () => {
  const { countRecord, stageTable } = await load();
  const text = [
    'Must — a line before any round heading is not a finding of any round',
    '## Round 1 (whole)',
    '1. Must — a — open',
    '2. Should — b — open',
    '3. Nice — c — deferred',
    '4. Should — repeats 1.1: b again — open',
    '## Round 2 (diff)',
    '1. Should — e — fixed',
    '## Closed',
    // a cycle whose numbering continues the old one: it opens a new cycle all the same
    '## Round 3 (diff)',
    '1. Must — f — open',
    '## Closed',
    '## Round 1 (whole)',
    '1. Must — g — open',
    '## Round 2 (diff)',
    '1. Should — h — open',
    '## Round 3 (diff)',
    'No findings',
    '## Round 4 (diff)',
    '1. Nice — k — deferred',
    '## Round 5 (diff)',
    '1. Nice — i — deferred',
    '## Round 6 (diff)',
    '1. Should — j — open',
  ].join('\r\n');
  const cycles = countRecord(text, 'plan');
  expect(cycles.map((c) => c.max)).toEqual([2, 3, 6]);
  expect(cycles[0].rounds).toEqual([
    { n: 1, Must: 1, Should: 2, Nice: 1 },
    { n: 2, Must: 0, Should: 1, Nice: 0 },
  ]);
  const table = stageTable(cycles);
  expect(table.cycles).toBe(3);
  // rounds run at r = cycles whose highest round is r or more; 5+ sums r = 5 and r = 6
  expect(rows(table)).toEqual([
    '1/3/2/2/1/1.3',
    '2/3/0/2/0/0.7',
    '3/2/1/0/0/0.5',
    '4/1/0/0/1/0.0',
    '5+/2/0/1/1/0.5',
  ]);
});

it('risk:parsing review records split at return from verify (ST-LN-95 ac-1)', async () => {
  const { countRecord, stageTable } = await load();
  const text = [
    'Round record: 2',
    '',
    '## Round 1 head 1111111111111111111111111111111111111111',
    '',
    'Must 1 [patch]: x — src/a.ts:1 — open',
    'Should 2 [patch]: y — src/a.ts:2 — fixed in abc1234',
    '```text',
    'Must 9 [patch]: inside a fence, not a finding — src/a.ts:9 — open',
    '## Return from verify 0000000',
    '```',
    '',
    '## Round 2 head 2222222222222222222222222222222222222222 (final review)',
    '',
    'Nice 1 [patch]: z — src/a.ts:3 — deferred',
    '',
    'verdict: converged',
    '',
    '## Return from verify abc1234',
    '',
    '## Round 3 head 3333333333333333333333333333333333333333',
    '',
    'Should 1 [patch]: w — src/b.ts:1 — open',
  ].join('\n');
  const cycles = countRecord(text, 'review');
  expect(cycles.length).toBe(2);
  expect(cycles.map((c) => c.max)).toEqual([2, 3]);
  expect(cycles[0].rounds).toEqual([
    { n: 1, Must: 1, Should: 1, Nice: 0 },
    { n: 2, Must: 0, Should: 0, Nice: 1 },
  ]);
  expect(rows(stageTable(cycles))).toEqual([
    '1/2/1/1/0/1.0',
    '2/2/0/0/1/0.0',
    '3/1/0/1/0/1.0',
    '4/0/0/0/0/0.0',
    '5+/0/0/0/0/0.0',
  ]);
});

it('risk:parsing empty and no findings records (ST-LN-95 ac-1)', async () => {
  const { countRecord, stageTable } = await load();
  expect(countRecord('', 'plan')).toEqual([]);
  expect(stageTable([]).cycles).toBe(0);
  expect(rows(stageTable([]))).toEqual(['1/0/0/0/0/0.0', '2/0/0/0/0/0.0', '3/0/0/0/0/0.0', '4/0/0/0/0/0.0', '5+/0/0/0/0/0.0']);
  const one = countRecord('## Round 1 (whole)\n\nNo findings\n', 'approach');
  expect(one).toEqual([{ max: 1, rounds: [{ n: 1, Must: 0, Should: 0, Nice: 0 }] }]);
  expect(rows(stageTable(one))).toEqual(['1/1/0/0/0/0.0', '2/0/0/0/0/0.0', '3/0/0/0/0/0.0', '4/0/0/0/0/0.0', '5+/0/0/0/0/0.0']);
});
