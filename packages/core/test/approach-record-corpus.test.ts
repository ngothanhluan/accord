// ST-LN-91 round 6 (owner decision 2026-11-13): the corpus of every record line or block a reviewer used as a probe or a failing case in review rounds 1 to 6 of PR #172.
// The table is test/helpers/approach-corpus.ts; each row states what the owner decisions require (BLOCK, LIST, PASS, PROBLEM, LEGACY, LANE-S), not what the code did when it was written.
// A fix of the record reader is held to this file: a row that goes red is a finding that came back.
import { expect, it } from 'vitest';
import { APPROACH_CAP_FROM, GROUNDS_V2_FROM, approvalBlockers, approvalFindings, approvalProblems, loadSnapshot, nextRound, recordProblems } from '../src/index.js';
import type { RepoSnapshot } from '../src/index.js';
import { PLAN_ROWS, ROWS } from '../../../test/helpers/approach-corpus.js';
import type { PlanRow, Row } from '../../../test/helpers/approach-corpus.js';
import { CONFIG, building } from '../../../test/helpers/lane.js';

const LEDGER = '## Rulings\n- task 1 done abc1234\n- task 2 done abc1234\n';
const GROUNDS = 'a ticket line it rests on';

function recordOf(r: Row): string {
  const second = r.r2 === null ? '' : '## Round 2 (diff)\n\n' + (r.r2 ?? ['No findings']).join('\n') + '\n\n';
  return 'Round record: 1\n\n## Round 1 (whole)\n\n' + r.r1.join('\n') + '\n\n' + second + (r.tail ?? '');
}

function repoOf(file: 'approach-review.md' | 'plan-review.md', text: string, lane: string | undefined, claim: string, record: string): RepoSnapshot {
  const files: Record<string, string> = { 'accord/config.yml': CONFIG };
  building(files, 'T-1', lane === undefined ? undefined : { lane });
  files['accord/tickets/T-1/ledger.md'] = LEDGER;
  files['accord/tickets/T-1/' + file] = text;
  const snapshot = loadSnapshot({ files, tree: Object.keys(files) });
  return { ...snapshot, claimPins: { 'T-1': { pin: claim } }, recordPins: { 'T-1': { [file === 'plan-review.md' ? 'plan' : 'approach']: { pin: record } } } };
}

/** The 1-based line of the first line of `text` that reads as `shown` once trimmed. */
const lineOf = (text: string, shown: string): number => text.split('\n').findIndex((l) => l.trim() === shown.trim()) + 1;
const flat = (rounds: { round: number; lines: string[] }[]): string[] => rounds.flatMap((x) => x.lines);

function check(r: Row): void {
  const text = recordOf(r);
  const s = repoOf('approach-review.md', text, r.lane, r.claim ?? APPROACH_CAP_FROM, r.record ?? GROUNDS_V2_FROM);
  const found = approvalFindings(s, 'T-1');
  const problems = approvalProblems(s, 'T-1');
  const blocking = flat(found.blocking);
  const risks = flat(found.risks);
  const first = r.r1[0].trim();
  expect(flat(approvalBlockers(s, 'T-1')), r.id + ' approvalBlockers equals the blocking list').toEqual(blocking);

  switch (r.out) {
    case 'BLOCK':
      expect(problems, r.id + ' problems').toEqual([]);
      expect(blocking, r.id + ' blocking').toEqual((r.block ?? [first]).map((x) => x.trim()));
      expect(risks, r.id + ' risks').toEqual((r.list ?? []).map((x) => x.trim()));
      break;
    case 'LIST':
      expect(problems, r.id + ' problems').toEqual([]);
      expect(blocking, r.id + ' blocking').toEqual([]);
      expect(risks, r.id + ' risks').toEqual((r.list ?? [first]).map((x) => x.trim()));
      break;
    case 'PASS':
      expect(problems, r.id + ' problems').toEqual([]);
      expect(blocking, r.id + ' blocking').toEqual([]);
      expect(risks, r.id + ' risks').toEqual([]);
      break;
    case 'PROBLEM': {
      const named = (r.problem ?? [first]).map((x) => lineOf(text, x));
      expect(named.every((n) => n > 0), r.id + ' the problem line is in the record').toBe(true);
      for (const n of named) expect(problems.some((p) => p.startsWith('line ' + n + ':')), r.id + ' names line ' + n + ': ' + JSON.stringify(problems)).toBe(true);
      expect(nextRound(s, 'T-1', 'approach').kind, r.id + ' round --approach refuses too').toBe('refused');
      break;
    }
    case 'LEGACY':
      // Claimed under 0.4.0: nothing blocks, nothing is a record problem of the mark check, the five-round cap holds, the short view lists what is still open.
      expect(problems, r.id + ' problems').toEqual([]);
      expect(blocking, r.id + ' blocking').toEqual([]);
      expect(risks, r.id + ' risks').toEqual((r.list ?? []).map((x) => x.trim()));
      expect(recordProblems(s, 'T-1', 'approach').filter((p) => p.reason.includes('a mark accord cannot read')), r.id + ' no mark check').toEqual([]);
      expect(nextRound(s, 'T-1', 'approach').cap, r.id + ' cap').toBe(5);
      break;
    case 'LANE-S':
      expect(problems, r.id + ' problems').toEqual([]);
      expect(blocking, r.id + ' blocking').toEqual([]);
      break;
  }

  if (r.grounds !== undefined) {
    const reasons = nextRound(s, 'T-1', 'approach').reasons.join('\n');
    expect(reasons.includes(GROUNDS), r.id + ' grounds ' + r.grounds + ': ' + reasons).toBe(r.grounds === 'refused');
  }
}

it('risk:security the approach corpus: every probe of review rounds 1 to 6 has the outcome the owner decisions require (ST-LN-91 round 6)', () => {
  expect(ROWS.length).toBeGreaterThan(150);
  expect(new Set(ROWS.map((r) => r.id)).size, 'row ids are unique').toBe(ROWS.length);
  // Every capped outcome is represented, so a row cannot be dropped to make a fix pass.
  for (const out of ['BLOCK', 'LIST', 'PASS', 'PROBLEM', 'LEGACY', 'LANE-S'] as const) expect(ROWS.some((r) => r.out === out), out).toBe(true);
});

// One test per row: a red row names the probe, the round and the finding that brought it.
for (const r of ROWS) {
  it('risk:security corpus ' + r.id + ' is ' + r.out + ' (' + r.src + ')', () => check(r));
}

function checkPlan(r: PlanRow): void {
  const text = 'Round record: 1\n\n' + r.rounds.map((lines, i) => '## Round ' + (i + 1) + ' (' + (i === 0 ? 'whole' : 'diff') + ')\n\n' + lines.join('\n') + '\n\n').join('');
  const s = repoOf('plan-review.md', text, undefined, APPROACH_CAP_FROM, r.record ?? GROUNDS_V2_FROM);
  const named = (r.problem ?? []).map((x) => lineOf(text, x));
  const problems = recordProblems(s, 'T-1', 'plan');
  expect(problems.map((p) => p.line), r.id + ' record problems: ' + JSON.stringify(problems)).toEqual(named);
  expect(nextRound(s, 'T-1', 'plan').kind, r.id + ' round --plan').toBe(r.round);
}
for (const r of PLAN_ROWS) {
  it('risk:security corpus plan ' + r.id + ' (' + r.src + ')', () => checkPlan(r));
}
