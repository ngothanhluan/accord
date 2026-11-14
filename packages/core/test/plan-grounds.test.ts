// ST-LN-91 D-19, D-12, D-15, D-18, D-02: for a lane ticket other than lane S whose claim pin is PLAN_GROUNDS_FROM or later, the plan checker's round 1 is asked for grounds
// (a ticket line it rests on, a test, a command, a risk tag, or deferred with its failing case); a ticket claimed earlier keeps the Phase 2 rule from round 2, read from the
// plan record's round-1 pin. The rule reads the structural mark slots and the critic block's `rests on:` lines exactly as the approach record does (group 1 of the review).
import { expect, it } from 'vitest';
import { GROUNDS_V2_FROM, PLAN_CAP_FROM, PLAN_GROUNDS_FROM, gatePlan, groundsFrom, groundsOn, groundsV2, loadSnapshot, nextRound, recordProblems } from '../src/index.js';
import type { ClaimPin, RecordPin, RepoSnapshot } from '../src/index.js';
import { CONFIG, building } from '../../../test/helpers/lane.js';

const HEAD = 'Round record: 1\n\n';
const at = (v: string): string => CONFIG.replace(/accord: "[^"]*"/, `accord: "${v}"`);
const round = (n: number, ...lines: string[]): string => `## Round ${n} (${n === 1 ? 'whole' : 'diff'})\n\n${lines.join('\n')}\n\n`;
const should = (...marks: string[]): string => `1. Should — Task 3 drops a header — open${marks.map((m) => ' — ' + m).join('')}`;
const must = (...marks: string[]): string => `1. Must — Task 3 drops a header — open${marks.map((m) => ' — ' + m).join('')}`;
const CASE = 'an empty cell gives no quote';
const failing = (at_: string): string => `plan ${at_}: Task 3 drops a header — failing case: ${CASE}`;

interface Opts {
  lane?: string;
  config?: string;
  claim?: ClaimPin | 'none'; // the host's claim fact; 'none': no claim fact
  recordPin?: RecordPin; // the host's fact for the record's first round
  deferred?: string[]; // lines of the ledger's ## Deferred
  kind?: 'plan' | 'approach';
}
/** A lane ticket with a plan (or approach) record of the given rounds (each a list of lines). */
function repo(rounds: string[][], { lane, config = CONFIG, claim = { pin: PLAN_GROUNDS_FROM }, recordPin, deferred, kind = 'plan' }: Opts = {}): RepoSnapshot {
  const files: Record<string, string> = { 'accord/config.yml': config };
  building(files, 'T-1', lane === undefined ? undefined : { lane });
  files['accord/tickets/T-1/ledger.md'] =
    '## Rulings\n- task 1 done abc1234\n- task 2 done abc1234\n' + (deferred === undefined ? '' : '\n## Deferred\n' + deferred.map((d) => '- ' + d + '\n').join(''));
  files['accord/tickets/T-1/' + (kind === 'plan' ? 'plan-review.md' : 'approach-review.md')] = HEAD + rounds.map((l, i) => round(i + 1, ...l)).join('');
  let snapshot: RepoSnapshot = loadSnapshot({ files, tree: Object.keys(files) });
  if (claim !== 'none') snapshot = { ...snapshot, claimPins: { 'T-1': claim } };
  if (recordPin !== undefined) snapshot = { ...snapshot, recordPins: { 'T-1': { [kind]: recordPin } } };
  return snapshot;
}
const ask = (rounds: string[][], o: Opts = {}) => nextRound(repo(rounds, o), 'T-1', o.kind ?? 'plan');

it('risk:complex-branching accord round --plan asks grounds from the plan checker\'s round 1 for a ticket claimed at the cut-off (ST-LN-91 D-19)', () => {
  // an ungrounded round-1 Should and Must refuse the next round, naming the round and the finding
  for (const bare of [should(), must()]) {
    const a = ask([[bare]]);
    expect(a.kind, bare).toBe('refused');
    const reason = a.reasons.join('\n');
    expect(reason, bare).toContain('round 1 of cycle 1, finding 1');
    expect(reason, bare).toContain('from round 1 a Must or Should needs');
    expect(reason, bare).toContain('failing case');
  }

  // every ground clears it: a ticket line, a test, a command, a risk tag; the block form with several grounds
  for (const mark of ['rests on: ac-1', 'rests on: D-01', 'rests on: Veto "No new dependency."', 'test: export#writes-csv', 'command: npm test', 'risk: data-loss', 'risk: security']) {
    expect(ask([[should(mark)]]), mark).toMatchObject({ kind: 'next', round: 2 });
  }
  expect(ask([['1. Should — Task 3 drops a header — open', '   rests on: ac-9', '   rests on: D-01']]), 'a second valid ground in the block').toMatchObject({ kind: 'next', round: 2 });
  // a line the ticket does not hold grounds nothing
  for (const mark of ['rests on: ac-9', 'rests on: D-07', 'rests on: Veto "dependency"']) expect(ask([[should(mark)]]).kind, mark).toBe('refused');
  expect(ask([['1. Should — Task 3 drops a header — open', '   rests on: ac-9', '   rests on: D-07']]).kind, 'the block holds no valid ground').toBe('refused');

  // deferred with its ledger line and failing case: round 2 runs; without the failing case, or under another line, it is refused
  const deferred = '1. Should — Task 3 drops a header — deferred';
  expect(ask([[deferred]], { deferred: [failing('1.1')] })).toMatchObject({ kind: 'next', round: 2 });
  expect(ask([[deferred]], { deferred: [failing('1.1 cycle 1')] })).toMatchObject({ kind: 'next', round: 2 });
  for (const bad of ['plan 1.1: Task 3 drops a header', 'plan 1.1: Task 3 drops a header — failing case:', failing('1.2'), failing('2.1'), failing('1.1 cycle 2'), failing('1.1').replace('plan', 'approach')]) {
    const a = ask([[deferred]], { deferred: [bad] });
    expect(a.kind, bad).toBe('refused');
    expect(a.reasons.join('\n'), bad).toContain('from round 1 a Must or Should needs');
  }
  expect(ask([[deferred]]).kind, 'no ledger line').toBe('refused');
  expect(ask([[should()]], { deferred: [failing('1.1')] }).kind, 'the state decides: written open it still blocks').toBe('refused');

  // a Nice and a carried finding are not new Musts or Shoulds
  expect(ask([['1. Nice — a name — open']]).kind).toBe('next');
  expect(ask([['1. Should — repeats 1.1: the same gap — open']]).kind).toBe('next');
  expect(ask([['No findings']]).kind).toBe('next');

  // a risk finding written deferred is never excused, in round 1 as in every round, whatever the ledger says
  for (const risk of ['risk: data-loss', 'risk: security']) {
    const line = `1. Should — Task 3 drops a header — deferred — ${risk}`;
    for (const deferredLines of [[failing('1.1')], []]) {
      const a = ask([[line]], { deferred: deferredLines });
      expect(a.kind, risk).toBe('refused');
      expect(a.reasons.join('\n'), risk).toContain('blocks in every round and is never deferred');
    }
  }

  // the reading is the one the record uses: a mark slot accord cannot read is a record problem, not an ungrounded finding or prose
  const s = repo([['1. Should — Task 3 drops a header — open — risks: security']]);
  expect(recordProblems(s, 'T-1', 'plan').map((p) => p.reason).join('\n')).toContain('a mark accord cannot read');
  expect(nextRound(s, 'T-1', 'plan').kind).toBe('refused');
  expect(recordProblems(repo([['1. Should — Task 3 drops a header — open — risks: security']], { claim: { pin: '0.4.0' } }), 'T-1', 'plan'), 'claimed earlier: unchanged').toEqual([]);

  // rounds 2 and later keep being asked, as before
  const two = ['1. Should — Task 1 drops a header — open — rests on: ac-1', '2. Should — Task 2 drops a header — open — rests on: ac-1'];
  expect(ask([two, [should()]]).kind).toBe('refused');
  expect(ask([two, [should('rests on: ac-1')]])).toMatchObject({ kind: 'next', round: 3 });
});

it('risk:regression a ticket claimed under 0.4.0 keeps the Phase 2 grounds rule (ST-LN-91 D-19)', () => {
  const old = { claim: { pin: '0.4.0' } } as const;
  const v2 = { ...old, recordPin: { pin: GROUNDS_V2_FROM } } as const;
  // the ungrounded round-1 Should is not asked; an ungrounded round-2 Should is, naming round 2
  expect(ask([[should()]], v2)).toMatchObject({ kind: 'next', round: 2 });
  expect(ask([[must()]], v2)).toMatchObject({ kind: 'next', round: 2 });
  const refused = ask([[should('rests on: ac-1')], [should()]], v2);
  expect(refused.kind).toBe('refused');
  expect(refused.reasons.join('\n')).toContain('from round 2 a Must or Should needs');
  expect(refused.reasons.join('\n')).not.toContain('from round 1');
  // a record begun under 0.4.0: no plan grounds before GROUNDS_V2_FROM
  expect(ask([[should()], [should()]], { ...old, recordPin: { pin: '0.4.0' } }).kind).toBe('next');
  expect(ask([[should()]], old).kind, 'no record fact').toBe('next');
  // the Phase 2 read is unchanged: groundsV2 follows the record pin only, and groundsOn agrees with it for a ticket claimed earlier
  for (const [o, want] of [
    [v2, true],
    [{ ...old, recordPin: { pin: '0.4.0' } }, false],
    [old, false],
    [{ ...old, recordPin: { error: 'boom' } }, true],
    [{ ...old, recordPin: { pin: '0.4.0', basePin: GROUNDS_V2_FROM } }, true],
  ] as const) {
    const s = repo([[should()]], o);
    expect(groundsV2(s, 'T-1', 'plan')).toBe(want);
    expect(groundsOn(s, 'T-1', 'plan')).toBe(want);
    expect(groundsFrom(s, 'T-1', 'plan')).toBe(2);
  }
  // a ticket claimed at the cut-off whose record began under 0.4.0 is asked all the same
  const lowered = repo([[should()]], { recordPin: { pin: '0.4.0' } });
  expect(groundsV2(lowered, 'T-1', 'plan')).toBe(false);
  expect(groundsFrom(lowered, 'T-1', 'plan')).toBe(1);
  expect(groundsOn(lowered, 'T-1', 'plan')).toBe(true);
});

it('risk:complex-branching the round-1 grounds rule reads the claim pin and fails closed (ST-LN-91 D-19)', () => {
  // a claim fact with an error: asked from round 1
  expect(ask([[should()]], { claim: { error: 'git failed reading the claim pin: boom' } }).kind).toBe('refused');
  // a lowered claim pin caught by its merge-base pin: asked from round 1
  expect(ask([[should()]], { claim: { pin: '0.4.0', basePin: PLAN_GROUNDS_FROM } }).kind).toBe('refused');
  expect(ask([[should()]], { claim: { pin: '0.4.0', basePin: '0.4.0' } }).kind).toBe('next');
  // no claim fact: the working-tree pin decides
  expect(ask([[should()]], { claim: 'none', config: at(PLAN_GROUNDS_FROM) }).kind).toBe('refused');
  const earlier = ask([[should()]], { claim: 'none', config: at('0.4.0'), recordPin: { pin: GROUNDS_V2_FROM } });
  expect(earlier).toMatchObject({ kind: 'next', round: 2 });
  const second = ask([[should('rests on: ac-1')], [should()]], { claim: 'none', config: at('0.4.0'), recordPin: { pin: GROUNDS_V2_FROM } });
  expect(second.kind).toBe('refused');
  expect(second.reasons.join('\n')).toContain('from round 2');
  // lane L and lane P are asked as lane M is (D-18)
  for (const lane of ['L', 'P']) expect(ask([[should()]], { lane }).kind, lane).toBe('refused');
  expect(ask([[should('rests on: ac-1')]], { lane: 'L' })).toMatchObject({ kind: 'next', round: 2 });
  // an approach record keeps round 2 (D-02): the Phase 2 rule under its own record pin, whatever the claim pin
  const approach = { kind: 'approach', recordPin: { pin: GROUNDS_V2_FROM } } as const;
  expect(ask([[should()]], approach)).toMatchObject({ kind: 'next', round: 2 });
  expect(groundsFrom(repo([[should()]], approach), 'T-1', 'approach')).toBe(2);
  const second2 = ask([[should('rests on: ac-1')], [should()]], approach);
  expect(second2.kind).toBe('refused');
  expect(second2.reasons.join('\n')).toContain('from round 2');
});

it('risk:complex-branching a round-1 finding deferred under the plan checker leaves the count stop (ST-LN-91 D-19)', () => {
  const grounded = '1. Should — Task 1 drops a header — open — rests on: ac-1';
  const bare = '2. Should — Task 3 drops a header — deferred';
  const rounds = [[grounded, bare], ['1. Should — Task 1 drops a header again — open — rests on: ac-1']];
  const s = repo(rounds, { claim: { pin: PLAN_CAP_FROM }, deferred: ['plan 1.2: Task 3 drops a header — failing case: ' + CASE] });
  expect(PLAN_CAP_FROM).toBe(PLAN_GROUNDS_FROM);
  // round 1 counts one (the deferred finding left the count), round 2 counts one, not below: the count stop holds
  const stopped = gatePlan(s, 'T-1').findings.filter((f) => f.rule === 'gate.plan-rounds').map((f) => f.reason);
  expect(stopped).toHaveLength(1);
  expect(stopped[0]).toContain('the count did not fall: 1 Must and Should against 1 in round 1');
  expect(nextRound(s, 'T-1', 'plan').kind).toBe('stop');
  // without the ledger line the deferred finding blocks instead
  expect(nextRound(repo(rounds, { claim: { pin: PLAN_CAP_FROM } }), 'T-1', 'plan').kind).toBe('refused');
});
