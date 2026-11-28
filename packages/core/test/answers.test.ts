// Phase 10 D-15, 10-ac-29, 10-ac-31 (a), 10-ac-11: `accepted risk: <why>` (approach and plan by the planner, review by the session) closes a finding when the ledger holds its Ruling and is listed for verify; a review finding
// `ambiguous ac-<n>: built "<reading>"` opens no fix round and becomes a verify warning. Neither is ever taken for a data-loss or security finding, nor an ambiguous answer where a Decision settles the reading. A ticket claimed
// before the cut-offs reads the segments as it did at b4477211: an open finding at approach and plan, an unreadable line in a review record.
import { expect, it } from 'vitest';
import { ACCEPTED_RISK_FROM, AMBIGUOUS_FROM, loadSnapshot, nextRound, parseRounds, recordProblems, roundText } from '../src/index.js';
import type { ClaimPin, RepoSnapshot } from '../src/index.js';
import { CONFIG, building, done } from '../../../test/helpers/lane.js';
import { v2Review } from '../../../test/helpers/review-v2.js';

type Kind = 'plan' | 'approach' | 'review';
const FILE: Record<Kind, string> = { plan: 'plan-review.md', approach: 'approach-review.md', review: 'review.md' };
const RULINGS = '## Rulings\n- task 1 done abc1234\n- task 2 done abc1234\n';
const HEAD = 'Round record: 1\n\n';
const round = (n: number, ...lines: string[]): string => `## Round ${n} (${n === 1 ? 'whole' : 'diff'})\n\n${lines.join('\n')}\n\n`;
const WHY = 'the input comes only from our own config';
const CASE = 'a hand-edited config crashes the gate';
const ruling = (record: Kind, at: string, why = WHY): string => `- Ruling: accepted risk — ${record} ${at}: ${why} — ${CASE}\n`;
/** A version 1 plan or approach finding line of round 1 with its state and marks; a plan finding rests on a ticket line from round 1 (D-19). */
const v1 = (kind: 'plan' | 'approach', state: string, ...marks: string[]): string =>
  `1. Should — ${kind === 'plan' ? 'task 1 drops a header' : 'the impact list misses a caller'} — ${state}${(kind === 'plan' ? ['rests on: ac-1', ...marks] : marks).map((m) => ' — ' + m).join('')}`;
/** A version 2 review finding line. */
const v2 = (n: number, state: string, ...marks: string[]): string => `Should ${n} [patch]: a comma is not quoted — src/export.ts:9 — ${state}${marks.map((m) => ' — ' + m).join('')}`;
const READING = 'ambiguous ac-2: built "the count excludes drafts"';

interface Opts {
  claim?: ClaimPin;
  ledger?: string;
}
function repo(kind: Kind, record: string, { claim = { pin: ACCEPTED_RISK_FROM }, ledger = '' }: Opts = {}): RepoSnapshot {
  const files: Record<string, string> = { 'accord/config.yml': CONFIG };
  if (kind === 'review') done(files, 'T-1');
  else building(files, 'T-1');
  files['accord/tickets/T-1/ledger.md'] = RULINGS + ledger;
  files[`accord/tickets/T-1/${FILE[kind]}`] = record;
  return { ...loadSnapshot({ files, tree: Object.keys(files) }), claimPins: { 'T-1': claim } };
}
const planOf = (state: string, ...marks: string[]): string => HEAD + round(1, v1('plan', state, ...marks));
const approachOf = (state: string, ...marks: string[]): string => HEAD + round(1, v1('approach', state, ...marks));
const reviewOf = (...lines: string[]): string => v2Review([[{ lines }]]);
const before = { pin: '0.23.1' };

it('risk:regression the accepted-risk and ambiguous-criterion cut-offs are 0.24.0 (10-ac-29, 10-ac-31, D-15)', () => {
  expect(ACCEPTED_RISK_FROM).toBe('0.24.0');
  expect(AMBIGUOUS_FROM).toBe('0.24.0');
});

it('risk:parsing accepted risk is read at approach, plan and review with its reason, and the ambiguous answer at review with its criterion and reading (10-ac-29, 10-ac-31, D-15)', () => {
  const [plan] = parseRounds('plan-review.md', planOf(`accepted risk: ${WHY}`), 'plan').cycles[0].rounds[0].findings;
  expect(plan).toMatchObject({ n: 1, state: 'accepted', why: WHY });
  const [bare] = parseRounds('approach-review.md', approachOf('accepted risk:'), 'approach').cycles[0].rounds[0].findings;
  expect(bare.state).toBe('accepted');
  expect(bare.why).toBeUndefined();
  const record = parseRounds('review.md', reviewOf(v2(1, `accepted risk: ${WHY}`), v2(2, READING)), 'review');
  const [accepted, ambiguous] = record.cycles[0].rounds[0].findings;
  expect(accepted).toMatchObject({ n: 1, state: 'accepted', why: WHY });
  expect(ambiguous).toMatchObject({ n: 2, state: 'ambiguous', ambiguous: { ac: 2, reading: 'the count excludes drafts' } });
  expect(record.unreadable).toEqual([]);
});

it('risk:regression a plan or approach finding the planner accepts as a risk is closed when the ledger holds its Ruling, and every answer lists it (10-ac-29, D-15)', () => {
  for (const kind of ['plan', 'approach'] as const) {
    const answer = nextRound(repo(kind, HEAD + round(1, v1(kind, `accepted risk: ${WHY}`)), { ledger: ruling(kind, '1.1') }), 'T-1', kind);
    expect(answer.kind, kind).toBe('refused');
    expect(answer.findings, kind).toEqual([]);
    const text = roundText(answer);
    expect(text, kind).toContain('Findings still open: none');
    expect(text, kind).toContain(`accepted: ${kind} 1.1: ${WHY}\n`);
  }
});

it('risk:regression a review finding the session accepts as a risk is closed with its review Ruling and listed on an accepted line (10-ac-29, D-15)', () => {
  const snapshot = repo('review', reviewOf(v2(1, `accepted risk: ${WHY}`)), { ledger: ruling('review', '1.1') });
  expect(recordProblems(snapshot, 'T-1', 'review')).toEqual([]);
  const answer = nextRound(snapshot, 'T-1', 'review');
  expect(answer.kind).toBe('next');
  expect(roundText(answer)).toContain(`accepted: review 1.1: ${WHY}\n`);
});

it('risk:regression the accepted line lists the last cycle of each of the three records on any answer (10-ac-29, D-15)', () => {
  const files: Record<string, string> = { 'accord/config.yml': CONFIG };
  done(files, 'T-1');
  files['accord/tickets/T-1/ledger.md'] = RULINGS + ruling('plan', '1.1', 'plan reason') + ruling('approach', '1.1', 'approach reason') + ruling('review', '1.1', 'review reason');
  files['accord/tickets/T-1/plan-review.md'] = planOf('accepted risk: plan reason');
  files['accord/tickets/T-1/approach-review.md'] = approachOf('accepted risk: approach reason');
  files['accord/tickets/T-1/review.md'] = reviewOf(v2(1, 'accepted risk: review reason'));
  const snapshot = { ...loadSnapshot({ files, tree: Object.keys(files) }), claimPins: { 'T-1': { pin: ACCEPTED_RISK_FROM } } };
  const text = roundText(nextRound(snapshot, 'T-1', 'review'));
  expect(text).toContain('accepted: plan 1.1: plan reason\n');
  expect(text).toContain('accepted: approach 1.1: approach reason\n');
  expect(text).toContain('accepted: review 1.1: review reason\n');
});

it('risk:regression an accepted risk with no ledger Ruling is refused naming the finding and the Ruling form (10-ac-29, D-15, T-10-09)', () => {
  for (const kind of ['plan', 'approach'] as const) {
    const answer = nextRound(repo(kind, HEAD + round(1, v1(kind, `accepted risk: ${WHY}`))), 'T-1', kind);
    expect(answer.kind, kind).toBe('refused');
    const text = roundText(answer);
    expect(text, kind).toContain('1.1');
    expect(text, kind).toContain(`Ruling: accepted risk — ${kind} 1.1: <why> — <failing case>`);
  }
  const review = roundText(nextRound(repo('review', reviewOf(v2(1, `accepted risk: ${WHY}`))), 'T-1', 'review'));
  expect(review).toContain('1.1');
  expect(review).toContain('Ruling: accepted risk — review 1.1: <why> — <failing case>');
});

it('risk:parsing an accepted risk with no reason is refused with its line (10-ac-29, D-15)', () => {
  const problems = recordProblems(repo('approach', approachOf('accepted risk:')), 'T-1', 'approach');
  expect(problems).toHaveLength(1);
  expect(problems[0].line).toBe(5);
  expect(problems[0].reason).toContain('accepted risk: <why>');
});

it('risk:security an accepted risk is never taken for a finding marked risk: security, Ruling or not (10-ac-29, D-15, T-10-09)', () => {
  for (const kind of ['plan', 'approach'] as const) {
    const snapshot = repo(kind, HEAD + round(1, v1(kind, `accepted risk: ${WHY}`, 'risk: security')), { ledger: ruling(kind, '1.1') });
    const text = roundText(nextRound(snapshot, 'T-1', kind));
    expect(text, kind).toContain('1.1');
    expect(text, kind).toContain('never taken for a data-loss or security finding');
  }
  const review = repo('review', reviewOf(v2(1, `accepted risk: ${WHY}`, 'risk: security')), { ledger: ruling('review', '1.1') });
  expect(roundText(nextRound(review, 'T-1', 'review'))).toContain('never taken for a data-loss or security finding');
});

it('risk:data-loss an accepted risk is never taken for a finding marked risk: data-loss (10-ac-29, D-15, T-10-09)', () => {
  const snapshot = repo('approach', approachOf(`accepted risk: ${WHY}`, 'risk: data-loss'), { ledger: ruling('approach', '1.1') });
  const problems = recordProblems(snapshot, 'T-1', 'approach');
  expect(problems).toHaveLength(1);
  expect(problems[0].reason).toContain('never taken for a data-loss or security finding');
  expect(roundText(nextRound(snapshot, 'T-1', 'approach')).startsWith('refused: line 5:')).toBe(true);
});

it('risk:security an accepted risk on a finding that carries a risk finding on is refused as the risk finding is (10-ac-29, D-15, T-10-09)', () => {
  const record = HEAD + round(1, '1. Must — the export overwrites the old file — fixed — risk: data-loss') + round(2, `1. Must — repeats 1.1: the overwrite still happens — accepted risk: ${WHY}`);
  const text = roundText(nextRound(repo('approach', record, { ledger: ruling('approach', '2.1') }), 'T-1', 'approach'));
  expect(text).toContain('2.1');
  expect(text).toContain('never taken for a data-loss or security finding');
});

it('risk:regression a review finding answered ambiguous opens no fix round and becomes one warn line naming the criterion and the reading (10-ac-31, D-15)', () => {
  const snapshot = repo('review', reviewOf(v2(1, READING)));
  expect(recordProblems(snapshot, 'T-1', 'review')).toEqual([]);
  const answer = nextRound(snapshot, 'T-1', 'review');
  expect(answer.kind).toBe('next');
  expect(roundText(answer)).toContain('warn: 1.1 ambiguous ac-2, built "the count excludes drafts": listed in the verify report, never blocks\n');
});

it('risk:regression two ambiguous findings of one round do not count toward the budget stop (10-ac-31, D-15)', () => {
  const rec = v2Review([[{ lines: [v2(1, READING), v2(2, READING)] }, { lines: [v2(1, READING), v2(2, READING)] }]]);
  const answer = nextRound(repo('review', rec), 'T-1', 'review');
  expect(answer.kind).toBe('next');
  expect(roundText(answer)).not.toContain('did not fall');
});

it('risk:security an ambiguous-criterion answer is refused on a finding marked risk: security (10-ac-31, D-15, T-10-10)', () => {
  const snapshot = repo('review', reviewOf(v2(1, READING, 'risk: security')));
  const text = roundText(nextRound(snapshot, 'T-1', 'review'));
  expect(text.startsWith('refused:')).toBe(true);
  expect(text).toContain('1.1');
  expect(text).toContain('never taken for a data-loss or security finding');
});

it('risk:data-loss an ambiguous-criterion answer is refused on a finding that carries a risk finding on (10-ac-31, D-15, T-10-10)', () => {
  const rec = v2Review([[{ lines: [v2(1, 'open', 'risk: data-loss')] }, { lines: [v2(1, READING, 'carried from 1.1')] }]]);
  const text = roundText(nextRound(repo('review', rec), 'T-1', 'review'));
  expect(text).toContain('2.1');
  expect(text).toContain('never taken for a data-loss or security finding');
});

it('risk:regression an ambiguous-criterion answer is refused on a finding that rests on a Decision, which settles the reading (10-ac-31, D-15, T-10-10)', () => {
  const text = roundText(nextRound(repo('review', reviewOf(v2(1, READING, 'rests on: D-01'))), 'T-1', 'review'));
  expect(text.startsWith('refused:')).toBe(true);
  expect(text).toContain('1.1');
  expect(text).toContain('D-01');
  expect(text).toContain('a Decision settles the reading');
});

it('risk:regression a ticket claimed under 0.23.1 reads accepted risk at approach and plan as an open finding and asks nothing of it (10-ac-11)', () => {
  for (const kind of ['plan', 'approach'] as const) {
    const snapshot = repo(kind, HEAD + round(1, v1(kind, `accepted risk: ${WHY}`)), { claim: before, ledger: ruling(kind, '1.1') });
    expect(recordProblems(snapshot, 'T-1', kind), kind).toEqual([]);
    expect(roundText(nextRound(snapshot, 'T-1', kind)), kind).not.toContain('accepted:');
  }
});

it('risk:regression a ticket claimed under 0.23.1 gets today\'s refusal for an accepted-risk or ambiguous review line: a line accord cannot read (10-ac-11)', () => {
  for (const state of [`accepted risk: ${WHY}`, READING]) {
    const snapshot = repo('review', reviewOf(v2(1, state)), { claim: before, ledger: ruling('review', '1.1') });
    const problems = recordProblems(snapshot, 'T-1', 'review');
    expect(problems.map((p) => p.reason).join('\n'), state).toContain('a finding of a version 2 record reads <Severity> <n>[ [class]]: <finding> — <path>[:<line>] or none — open, fixed in <sha> or deferred');
    const text = roundText(nextRound(snapshot, 'T-1', 'review'));
    expect(text.startsWith('refused: round 1 at line 3 holds no finding'), state).toBe(true);
    expect(text, state).not.toContain('accepted:');
    expect(text, state).not.toContain('warn:');
  }
});
