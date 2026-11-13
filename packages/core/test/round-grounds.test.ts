// ST-LN-91 D-11: the grounds rule (ST-LN-57, lowered to round 2 and widened to Must and Should) for plan-review.md and
// approach-review.md, which read their own round-1 pin from the host's recordPins; version 1 lines read their marks.
import { expect, it } from 'vitest';
import { GROUNDS_V2_FROM, loadSnapshot, nextRound, parseRounds, planStopOf } from '../src/index.js';
import type { RecordPin, RepoSnapshot } from '../src/index.js';
import { planRounds } from '../src/gate/rounds.js';
import { parseLedger } from '../src/load/work.js';
import { groundsProblems } from '../src/round/grounds.js';
import { deferredFor } from '../src/round/next.js';
import { facts, scopeSnapshot, v2Review } from '../../../test/helpers/review-v2.js';
import { CONFIG, LANE_BODY, building, done } from '../../../test/helpers/lane.js';

type Kind = 'plan' | 'approach';
const FILE: Record<Kind, string> = { plan: 'plan-review.md', approach: 'approach-review.md' };
const CORRECTED = LANE_BODY.replace('## Corrections\n', '## Corrections\n- The delimiter stays a comma, not a semicolon.\n');
const round = (n: number, mode: string, ...lines: string[]): string => `## Round ${n} (${mode})\n\n${lines.join('\n')}\n\n`;
const should = (...marks: string[]): string => `1. Should — Task 3 drops a header — open${marks.map((m) => ' — ' + m).join('')}`;
const must = (...marks: string[]): string => `1. Must — Task 3 drops a header — open${marks.map((m) => ' — ' + m).join('')}`;

/** A lane M ticket with a plan record of `kind`: round 1 holds a Must, round 2 the given lines; `pin` is the host's recordPins fact. */
function snap(kind: Kind, round2: string[], o: { pin?: RecordPin; body?: string; first?: string[]; round3?: string[]; deferred?: string[] } = {}): RepoSnapshot {
  const files: Record<string, string> = { 'accord/config.yml': CONFIG };
  building(files, 'T-1', o.body === undefined ? undefined : { body: o.body });
  files['accord/tickets/T-1/ledger.md'] =
    '## Rulings\n- task 1 done abc1234\n- task 2 done abc1234\n' + (o.deferred === undefined ? '' : '\n## Deferred\n' + o.deferred.map((d) => '- ' + d + '\n').join(''));
  files['accord/tickets/T-1/' + FILE[kind]] =
    'Round record: 1\n\n' + round(1, 'whole', ...(o.first ?? [must('rests on: ac-2')])) + round(2, 'diff', ...round2) + (o.round3 === undefined ? '' : round(3, 'diff', ...o.round3));
  // The grounds rule reads the record pin; the ticket is claimed under 0.4.0, so the discuss and approach-cap rules, which read the claim pin (D-15), stay out of what these cases assert.
  const base: RepoSnapshot = { ...loadSnapshot({ files, tree: Object.keys(files) }), claimPins: { 'T-1': { pin: '0.4.0' } } };
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

// ST-LN-91 D-12: an ungrounded Must or Should from round 2 may be deferred with its failing case instead of blocking; a finding
// tagged risk: data-loss or risk: security blocks in every round and is never deferred.
const DEFERRED = '1. Should — Task 3 drops a header — deferred';
const CASE = 'an empty cell gives no quote';
const ledgerLine = (kind: string, at: string): string => `${kind} ${at}: Task 3 drops a header — failing case: ${CASE}`;
const cycleOf = (s: RepoSnapshot, kind: Kind) => (kind === 'plan' ? s.work!['T-1'].planRounds! : s.work!['T-1'].approachRounds!).cycles[0];

it('risk:complex-branching an ungrounded later finding deferred with its failing case does not block (ST-LN-91 ac-1)', () => {
  for (const kind of ['plan', 'approach'] as const) {
    // the finding is written deferred and the ledger holds its line with a failing case: it does not block
    const ok = snap(kind, [DEFERRED], { pin: cut, deferred: [ledgerLine(kind, '2.1')] });
    expect(answer(ok, kind).kind, kind).toBe('next');
    expect(groundsProblems(ok, 'T-1', kind), kind).toEqual([]);
    expect(answer(snap(kind, [DEFERRED], { pin: cut, deferred: [ledgerLine(kind, '2.1 cycle 1')] }), kind).kind, kind).toBe('next');

    // without the failing case, the line of another finding, round, cycle or record, or without the line: refused
    const other = kind === 'plan' ? 'approach' : 'plan';
    for (const bad of [
      `${kind} 2.1: Task 3 drops a header`,
      `${kind} 2.1: Task 3 drops a header — failing case:`,
      ledgerLine(kind, '2.2'),
      ledgerLine(kind, '1.1'),
      ledgerLine(kind, '2.1 cycle 2'),
      ledgerLine(other, '2.1'),
      ledgerLine('review', '2.1'),
    ]) {
      const a = answer(snap(kind, [DEFERRED], { pin: cut, deferred: [bad] }), kind);
      expect(a.kind, kind + bad).toBe('refused');
      expect(a.reasons.join('\n'), kind + bad).toContain('rests on');
    }
    expect(answer(snap(kind, [DEFERRED], { pin: cut }), kind).kind, kind).toBe('refused');
    // the state decides: the same line under a finding written open still blocks
    expect(answer(snap(kind, [should()], { pin: cut, deferred: [ledgerLine(kind, '2.1')] }), kind).kind, kind).toBe('refused');
    // under the older pin nothing changes
    expect(answer(snap(kind, [DEFERRED], { pin: { pin: '0.4.0' } }), kind).kind, kind).toBe('next');

    // from round 3 a deferred ungrounded Should leaves the stop; the same Should grounded and open stops the loop
    const three = snap(kind, ['1. Nice — a name — deferred'], { pin: cut, round3: [DEFERRED], deferred: [ledgerLine(kind, '3.1')] });
    expect(answer(three, kind), kind).toMatchObject({ kind: 'next', round: 4 });
    expect(planStopOf(cycleOf(three, kind), [], kind, deferredFor(three, 'T-1', kind, 0)), kind).toBeUndefined();
    if (kind === 'plan') expect(planRounds(three, 'T-1')).toEqual([]);
    const stops = snap(kind, ['1. Nice — a name — deferred'], { pin: cut, round3: [should('rests on: ac-1')] });
    expect(answer(stops, kind).kind, kind).toBe('stop');
    if (kind === 'plan') expect(planRounds(stops, 'T-1')).not.toEqual([]);
  }

  // a version 2 review record reads the same line with `review`
  const review = (state: string, ledger: string[]) => {
    const line = `Should 1 [patch]: x — src/a.ts:1 — ${state}`;
    const snapshot = scopeSnapshot({
      review: v2Review([[{ lines: [] }, { lines: [line] }]]),
      ledger: '\n## Deferred\n' + ledger.map((l) => '- ' + l + '\n').join(''),
      facts: facts([[], []], { pin: GROUNDS_V2_FROM }),
    });
    return { problems: groundsProblems(snapshot, 'T-1', 'review'), left: deferredFor(snapshot, 'T-1', 'review', 0).size };
  };
  expect(review('deferred', [`review 2.1: x — failing case: ${CASE}`])).toEqual({ problems: [], left: 1 });
  expect(review('deferred', ['review 2.1: x']).problems).toHaveLength(1);
  expect(review('deferred', []).problems).toHaveLength(1);
  expect(review('open', [`review 2.1: x — failing case: ${CASE}`]).problems).toHaveLength(1);
});

it('risk:data-loss a data-loss or security finding blocks in every round (ST-LN-91 ac-2)', () => {
  for (const kind of ['plan', 'approach'] as const) {
    for (const risk of ['risk: data-loss', 'risk: security']) {
      const tagged = (...marks: string[]): string => `1. Should — Task 3 drops a header — deferred — ${risk}${marks.map((m) => ' — ' + m).join('')}`;
      const line = (at: string): string => ledgerLine(kind, at);
      // round 2, with or without rests on and with or without its ticket line: refused, saying it is never deferred
      for (const marked of [tagged(), tagged('rests on: ac-1')]) {
        for (const deferred of [[line('2.1')], []]) {
          const a = answer(snap(kind, [marked], { pin: cut, deferred }), kind);
          expect(a.kind, kind + marked).toBe('refused');
          expect(a.reasons.join('\n'), kind + marked).toContain('never deferred');
          expect(a.reasons.join('\n'), kind + marked).toContain(risk);
        }
      }
      // round 1 as well
      const first = answer(snap(kind, ['No findings'], { pin: cut, first: [tagged()], deferred: [line('1.1')] }), kind);
      expect(first.kind, kind + risk).toBe('refused');
      expect(first.reasons.join('\n'), kind + risk).toContain('never deferred');
      // the same finding written open is not refused for grounds
      expect(answer(snap(kind, [`1. Should — Task 3 drops a header — open — ${risk}`], { pin: cut }), kind).kind, kind + risk).toBe('next');
      // a round 3 whose only Should is risk-tagged and deferred still stops the loop
      const three = snap(kind, ['1. Nice — a name — deferred'], { pin: cut, round3: [tagged()], deferred: [line('3.1')] });
      expect(planStopOf(cycleOf(three, kind), [], kind, deferredFor(three, 'T-1', kind, 0)), kind + risk).toBe(3);
      if (kind === 'plan') expect(planRounds(three, 'T-1'), risk).not.toEqual([]);
    }
  }

  // a version 2 review record too
  for (const risk of ['risk: data-loss', 'risk: security']) {
    for (const round of [1, 2]) {
      const marked = `Should 1 [patch]: x — src/a.ts:1 — deferred — ${risk}`;
      const rounds = round === 1 ? [{ lines: [marked] }] : [{ lines: [] }, { lines: [marked] }];
      const snapshot = scopeSnapshot({
        review: v2Review([rounds]),
        ledger: `\n## Deferred\n- review ${round}.1: x — failing case: ${CASE}\n`,
        facts: facts(rounds.map(() => []), { pin: GROUNDS_V2_FROM }),
      });
      const found = groundsProblems(snapshot, 'T-1', 'review');
      expect(found, risk + round).toHaveLength(1);
      expect(found[0].reason, risk + round).toContain('never deferred');
      expect(deferredFor(snapshot, 'T-1', 'review', 0).size, risk + round).toBe(0);
    }
  }
});

it('risk:regression old ledger lines are not read as deferrals (ST-LN-91 ac-1)', () => {
  const text = [
    '## Deferred',
    '- plan round 1.2 (Nice): a name that could be shorter',
    '- review 3.2: a deferral of ST-LN-57',
    '- plan 2.1: a finding — failing case: an empty cell gives no quote',
    '- approach 2.3 cycle 2: another finding',
    '',
  ].join('\n');
  expect(parseLedger('ledger.md', text).deferred).toEqual([
    { kind: 'review', round: 3, n: 2, cycle: 1 },
    { kind: 'plan', round: 2, n: 1, cycle: 1, failingCase: true },
    { kind: 'approach', round: 2, n: 3, cycle: 2 },
  ]);
});

// ST-LN-91 round-4 CR-01, WR-01: the strict reading. A ` - ` or ` -- ` inside a mark is never a separator; a risk in a form accord does not read is a record problem for a plan record on the grounds rule too.
it('risk:parsing a command or a test holding hyphens stays whole, and the finding still reads its state and grounds (ST-LN-91 CR-01 F2 P1)', () => {
  const cmd = '1. Should — Task 3 drops a header — open — command: npm test -- packages/cli/test/export.test.ts';
  for (const kind of ['plan', 'approach'] as const) {
    const s = snap(kind, [cmd], { pin: cut });
    expect(answer(s, kind).kind, kind).toBe('next');
    const f = (kind === 'plan' ? s.work!['T-1'].planRounds! : s.work!['T-1'].approachRounds!).cycles[0].rounds[1].findings[0];
    expect(f).toMatchObject({ n: 1, state: 'open', command: 'npm test -- packages/cli/test/export.test.ts' });
  }
  const test = '1. Should — Task 3 drops a header — open — test: export - fixed width rows survive';
  expect(parseRounds('x.md', 'Round record: 1\n\n## Round 2 (diff)\n\n' + test + '\n', 'plan').cycles[0].rounds[0].findings[0]).toMatchObject({ state: 'open', test: 'export - fixed width rows survive' });
});

it('risk:security a plan record on the grounds rule reads a risk structurally: a mark slot that does not parse refuses, prose never does (ST-LN-91 CR-01 CR-02 WR-05 M10 P1 P3)', () => {
  // Grounded lines (rests on: ac-1), so the risk check, not the grounds rule, decides.
  const grounded = (mark: string) => '1. Must — Task 3 logs tokens — open — rests on: ac-1 — ' + mark;
  for (const bad of ['`risk: security`', 'risks: security', 'risk: data_loss', 'risk; security', 'risk: data‑loss','rests on: "risk: security"']) {
    const refused = answer(snap('plan', [grounded(bad)], { pin: cut }), 'plan');
    expect(refused.kind, bad).toBe('refused');
    expect(refused.reasons.join('\n'), bad).toContain('a mark accord cannot read');
    // Before the grounds rule (no pin, or an older one) a plan record is read as it was.
    expect(answer(snap('plan', [grounded(bad)]), 'plan').kind, bad).toBe('next');
  }
  // Prose: the finding text, a test name, a note, a reason; none refuses, on a plan or an approach record.
  for (const prose of [
    '1. Should — Task 3 - risk: a stale read on reload — open — rests on: ac-1',
    '1. Must — Task 1: a fetch prunes early; add a `risk:data-loss` test — open — rests on: ac-1',
    '1. Should — Task 2 drops headers — withdrawn: no risk: security headers are set by the proxy — rests on: ac-1',
    '1. Should — Task 2 drops headers — open — rests on: ac-1 — security risk',
  ]) {
    expect(answer(snap('plan', [prose], { pin: cut }), 'plan').kind, prose).toBe('next');
    expect(answer(snap('plan', [prose, 'Security lens: no risk: security path is touched.', 'risks: security'], { pin: cut }), 'plan').kind, prose).toBe('next');
  }
  // A plan record's critic block reads its rests-on line as grounds (WR-03).
  const blockLines = ['1. Must — Task 3 logs tokens — open', '   failing case: a login → the token is logged', '   rests on: ac-1'];
  expect(answer(snap('plan', blockLines, { pin: cut }), 'plan').kind).toBe('next');
  expect(answer(snap('plan', [blockLines[0], blockLines[1], '   rests on: ac-9'], { pin: cut }), 'plan').kind).toBe('refused');
});
