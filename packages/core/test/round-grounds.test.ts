// ST-LN-91 D-11: the grounds rule (ST-LN-57, lowered to round 2 and widened to Must and Should) for plan-review.md and
// approach-review.md, which read their own round-1 pin from the host's recordPins; version 1 lines read their marks.
import { expect, it } from 'vitest';
import { GROUNDS_V2_FROM, loadSnapshot, nextRound, parseRounds } from '../src/index.js';
import type { RecordPin, RepoSnapshot } from '../src/index.js';
import { groundsProblems } from '../src/round/grounds.js';
import { facts, v2Review } from '../../../test/helpers/review-v2.js';
import { CONFIG, LANE_BODY, building, done } from '../../../test/helpers/lane.js';

type Kind = 'plan' | 'approach';
const FILE: Record<Kind, string> = { plan: 'plan-review.md', approach: 'approach-review.md' };
const CORRECTED = LANE_BODY.replace('## Corrections\n', '## Corrections\n- The delimiter stays a comma, not a semicolon.\n');
const round = (n: number, mode: string, ...lines: string[]): string => `## Round ${n} (${mode})\n\n${lines.join('\n')}\n\n`;
const should = (...marks: string[]): string => `1. Should — Task 3 drops a header — open${marks.map((m) => ' — ' + m).join('')}`;
const must = (...marks: string[]): string => `1. Must — Task 3 drops a header — open${marks.map((m) => ' — ' + m).join('')}`;

/** A lane M ticket with a plan record of `kind`: round 1 holds a Must, round 2 the given lines; `pin` is the host's recordPins fact. */
function snap(kind: Kind, round2: string[], o: { pin?: RecordPin; body?: string; first?: string[] } = {}): RepoSnapshot {
  const files: Record<string, string> = { 'accord/config.yml': CONFIG };
  building(files, 'T-1', o.body === undefined ? undefined : { body: o.body });
  files['accord/tickets/T-1/ledger.md'] = '## Rulings\n- task 1 done abc1234\n- task 2 done abc1234\n';
  files['accord/tickets/T-1/' + FILE[kind]] = 'Round record: 1\n\n' + round(1, 'whole', ...(o.first ?? [must('rests on: ac-2')])) + round(2, 'diff', ...round2);
  const base = loadSnapshot({ files, tree: Object.keys(files) });
  return o.pin === undefined ? base : { ...base, recordPins: { 'T-1': { [kind]: o.pin } } };
}
const answer = (s: RepoSnapshot, kind: Kind) => nextRound(s, 'T-1', kind);
const cut = { pin: GROUNDS_V2_FROM } as const;

it('risk:parsing version 1 plan lines read their number state carry and trailing marks (ST-LN-91 ac-1)', () => {
  const text = (...lines: string[]): string => 'Round record: 1\n\n## Round 1 (whole)\n\n' + lines.join('\n') + '\n';
  const read = (kind: Kind | 'review', line: string) => parseRounds('x.md', text(line), kind).cycles[0].rounds[0].findings[0];

  expect(read('plan', '2. Should — Task 3 drops x — open — rests on: ac-1')).toMatchObject({ severity: 'Should', n: 2, state: 'open', restsOn: { kind: 'ac', ref: 'ac-1' } });
  expect(read('plan', '1. Must — y — unverified: no citation')).toMatchObject({ n: 1, state: 'open' });
  expect(read('plan', '3. Nice — z — deferred')).toMatchObject({ n: 3, state: 'deferred' });
  expect(read('approach', '1. Should — repeats 1.2: w — open')).toMatchObject({ n: 1, state: 'open', carried: { round: 1, n: 2 } });
  expect(read('plan', '4. Should — a — fixed — risk: security')).toMatchObject({ n: 4, state: 'fixed', risk: 'security' });
  expect(read('plan', '5. Should — b — fixed — rests on: Correction "stays a comma"')).toMatchObject({ restsOn: { kind: 'Correction', ref: 'stays a comma' } });

  // a line of ST-LN-81's record reads its severity, line and text as before and gains no mark
  const real = '2. Should — `shared/scout.md` step 1 writes the reply to `scout.md` once the ticket exists, while intent step 2 saves only when it does not exist — fixed';
  const f = read('plan', real);
  expect(f).toMatchObject({ severity: 'Should', line: 5, text: real, n: 2, state: 'fixed' });
  for (const key of ['carried', 'risk', 'test', 'command', 'restsOn'] as const) expect(f[key], key).toBeUndefined();
  // a line that carries no number and splits no further reads exactly as before
  expect(read('plan', 'Must — a bare finding')).toEqual({ severity: 'Must', line: 5, text: 'Must — a bare finding' });
  // a review record's version 1 lines are untouched
  expect(read('review', '1. Must — y — open — rests on: ac-1')).toEqual({ severity: 'Must', line: 5, text: '1. Must — y — open — rests on: ac-1' });
});

it('risk:complex-branching from pin 0.4.1 a round 2 plan or approach finding needs a ticket line or a risk tag (ST-LN-91 ac-1)', () => {
  for (const kind of ['plan', 'approach'] as const) {
    // an unmarked round-2 Should and Must are refused and name the round and the finding
    for (const bare of [should(), must()]) {
      const s = snap(kind, [bare], { pin: cut });
      const a = answer(s, kind);
      expect(a.kind, kind + bare).toBe('refused');
      const reason = a.reasons.join('\n');
      expect(reason).toContain('round 2');
      expect(reason).toContain('finding 1');
      expect(reason).toContain('rests on');
      expect(groundsProblems(s, 'T-1', kind)).toHaveLength(1);
    }

    // every ground clears it
    for (const mark of [
      'rests on: ac-1',
      'rests on: D-01',
      'rests on: Veto "No new dependency."',
      'rests on: Correction "The delimiter stays a comma"',
      'rests on: Intent "export their report as CSV"',
      'test: x',
      'command: npm test',
      'risk: data-loss',
      'risk: security',
    ]) {
      const s = snap(kind, [should(mark)], { pin: cut, body: CORRECTED });
      expect(answer(s, kind).kind, kind + mark).toBe('next');
    }
    // a line the ticket does not hold, a quote of two words, a Correction the ticket lacks
    for (const mark of ['rests on: ac-9', 'rests on: D-07', 'rests on: Veto "dependency"', 'rests on: Correction "stays a"', 'rests on: Correction "stays a semicolon, never a comma"']) {
      expect(answer(snap(kind, [should(mark)], { pin: cut, body: CORRECTED }), kind).kind, kind + mark).toBe('refused');
    }

    // round 1 is never asked; a Nice and a carried finding are not new
    const first = snap(kind, ['No findings'], { pin: cut, first: [must()] });
    expect(answer(first, kind).kind).toBe('next');
    expect(answer(snap(kind, ['1. Nice — a name — deferred'], { pin: cut }), kind).kind).toBe('next');
    expect(answer(snap(kind, ['1. Should — repeats 1.1: the same gap — open'], { pin: cut }), kind).kind).toBe('next');

    // an older pin, no pin and no fact keep the old rule; a lowered pin counts as the cut-off; an error fails closed
    expect(answer(snap(kind, [should()], { pin: { pin: '0.4.0' } }), kind).kind).toBe('next');
    expect(answer(snap(kind, [should()], { pin: {} }), kind).kind).toBe('next');
    expect(answer(snap(kind, [should()]), kind).kind).toBe('next');
    expect(answer(snap(kind, [should()], { pin: { pin: '0.4.0', basePin: GROUNDS_V2_FROM } }), kind).kind).toBe('refused');
    const failed = answer(snap(kind, [should('rests on: ac-1')], { pin: { error: 'git failed reading the pin of ' + FILE[kind] + ': boom' } }), kind);
    expect(failed.kind).toBe('refused');
    expect(failed.reasons.join('\n')).toContain('boom');

    // reasons come in record line order
    const two = snap(kind, ['1. Should — a — open', '2. Should — b — open'], { pin: cut });
    const lines = answer(two, kind).reasons.map((r) => Number(/^line (\d+):/.exec(r)![1]));
    expect(lines).toHaveLength(2);
    expect(lines[0]).toBeLessThan(lines[1]);
  }
});

it('risk:complex-branching a correction is a ticket line for grounds (ST-LN-91 ac-1)', () => {
  const review = (mark: string, body?: string) => {
    const files: Record<string, string> = { 'accord/config.yml': CONFIG };
    done(files, 'T-1', body === undefined ? undefined : { body });
    files['accord/tickets/T-1/ledger.md'] = '## Rulings\n- task 1 done abc1234\n- task 2 done abc1234\n';
    files['accord/tickets/T-1/review.md'] = v2Review([[{ lines: [] }, { lines: [`Should 1 [patch]: x — src/a.ts:1 — open — ${mark}`] }]]);
    const snapshot = loadSnapshot({ files, tree: Object.keys(files), roundFacts: { 'T-1': facts([[], []], { pin: GROUNDS_V2_FROM }) } });
    return groundsProblems(snapshot, 'T-1', 'review');
  };
  expect(review('rests on: Correction "The delimiter stays a comma"', CORRECTED)).toEqual([]);
  expect(review('rests on: Correction "The delimiter stays a semicolon"', CORRECTED)).toHaveLength(1);
  expect(review('rests on: Correction "stays a"', CORRECTED)).toHaveLength(1);
  expect(review('rests on: Correction "The delimiter stays a comma"')).toHaveLength(1);
});
