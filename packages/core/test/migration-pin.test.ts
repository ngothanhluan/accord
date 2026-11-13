// ST-LN-91 mig-ac-1 and D-15 in core: a ticket at approach claimed under 0.4.0 answers as before at the discuss cut-off, for gate ready,
// `accord round --approach` and gate plan; the new rules read the claim pin, never the working-tree pin or the approach record's own pin.
import { expect, it } from 'vitest';
import { APPROACH_CAP_FROM, DISCUSS_FROM, gatePlan, gateReady, loadSnapshot, nextRound, roundText } from '../src/index.js';
import type { ClaimPin, RecordPin, RepoSnapshot } from '../src/index.js';
import { building, CONFIG } from '../../../test/helpers/lane.js';

const HEAD = 'Round record: 1\n\n';
const round = (n: number, ...lines: string[]) => '## Round ' + n + '\n\n' + lines.join('\n') + '\n\n';
// Rounds 2 and 3 cite the ticket line they rest on, so the Phase 2 grounds rule never decides what these cases assert.
const APPROACH_REVIEW =
  HEAD +
  round(1, '1. Must — the option drops a header — fixed') +
  round(2, '1. Should — the cache can go stale — fixed — rests on: ac-1') +
  round(3, '1. Should — a risk has no undo — open — rests on: ac-1');
// A release moves CONFIG's pin, so every case names the pin it means.
const at = (v: string): string => CONFIG.replace(/accord: "[^"]*"/, `accord: "${v}"`);

interface Pins {
  config: string; // the working-tree pin
  claim?: ClaimPin;
  record?: RecordPin; // the pin at the approach record's first round
  plan?: { pin?: string; basePin?: string };
}
/** A ticket at approach (Intent, criteria and an Approach draft written, three approach rounds recorded) under the given pins. */
function atApproach({ config, claim, record, plan }: Pins): RepoSnapshot {
  const files: Record<string, string> = { 'accord/config.yml': config };
  building(files, 'T-1');
  files['accord/tickets/T-1/ledger.md'] = '## Rulings\n- task 1 done abc1234\n- task 2 done abc1234\n';
  files['accord/tickets/T-1/approach-review.md'] = APPROACH_REVIEW;
  const snapshot = loadSnapshot({ files, tree: Object.keys(files) });
  return {
    ...snapshot,
    ...(claim === undefined ? {} : { claimPins: { 'T-1': claim } }),
    ...(record === undefined ? {} : { recordPins: { 'T-1': { approach: record } } }),
    ...(plan === undefined ? {} : { planPins: { 'T-1': plan } }),
  };
}
const answers = (s: RepoSnapshot) => ({
  ready: gateReady(s, 'T-1').findings,
  plan: gatePlan(s, 'T-1').findings,
  round: nextRound(s, 'T-1', 'approach'),
});
const discussFindings = (s: RepoSnapshot) => gateReady(s, 'T-1').findings.filter((f) => f.rule.startsWith('gate.discuss-'));

it('risk:complex-branching a ticket at approach pinned before the cut-off passes gate ready, accord round --approach and gate plan as before (ST-LN-91 mig-ac-1)', () => {
  const old = { pin: '0.4.0' };
  // Every pin at 0.4.0: the rules as they were.
  const before = answers(atApproach({ config: at('0.4.0'), claim: old, record: old, plan: old }));
  // The working tree at the cut-off, the ticket's own history still at 0.4.0: the answers must not move.
  const after = answers(atApproach({ config: at(DISCUSS_FROM), claim: old, record: old, plan: old }));

  expect(after.ready).toEqual(before.ready);
  expect(after.plan).toEqual(before.plan);
  expect(after.round).toEqual(before.round);
  expect(roundText(after.round)).toBe(roundText(before.round));
  expect(after.ready.filter((f) => f.rule.startsWith('gate.discuss-'))).toEqual([]);

  // The older rules as they print: five rounds, and the stop from round 3.
  const text = roundText(after.round);
  expect(text.startsWith('stop: report to owner\n')).toBe(true);
  expect(text).toContain('from round 3 such a round stops the loop');
  expect(text).toContain('more approach critique rounds after round 3 of cycle 1');
  expect(text).not.toContain('Findings still open:');
  expect(after.round).toMatchObject({ kind: 'stop', round: 3 });
});

it('risk:complex-branching the claim pin keeps a ticket claimed under 0.4.0 on the old discuss and approach rules (ST-LN-91 D-15)', () => {
  // Claimed under 0.4.0, upgraded since, its approach record begun after the upgrade: the claim pin alone decides the discuss rule and the cap.
  const old = atApproach({ config: at(DISCUSS_FROM), claim: { pin: '0.4.0' }, record: { pin: APPROACH_CAP_FROM }, plan: { pin: '0.4.0' } });
  expect(discussFindings(old)).toEqual([]);
  const stop = nextRound(old, 'T-1', 'approach');
  expect(stop).toMatchObject({ kind: 'stop', round: 3 });
  expect(roundText(stop)).toContain('from round 3 such a round stops the loop');
  expect(roundText(stop)).not.toContain('of 2');
  // Round 3 is not refused past a cap of two: the cap is five.
  expect(roundText(stop)).not.toContain('past the cap of 2');

  // The same ticket claimed at the cut-off: the discuss record is asked for and the approach critic gets two rounds.
  const fresh = atApproach({ config: at(DISCUSS_FROM), claim: { pin: DISCUSS_FROM }, record: { pin: APPROACH_CAP_FROM }, plan: { pin: '0.4.0' } });
  const missing = discussFindings(fresh).filter((f) => f.rule === 'gate.discuss-missing');
  expect(missing).toHaveLength(1);
  const capped = nextRound(fresh, 'T-1', 'approach');
  expect(capped).toMatchObject({ kind: 'refused', cap: 2 });
  expect(roundText(capped)).toContain('cap of 2 approach critique rounds');
  expect(capped.kind).not.toBe('stop');
});
