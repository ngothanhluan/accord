// ST-LN-91 91d-ac-2: the approach critic gets two rounds for a ticket claimed from APPROACH_CAP_FROM, and round 3 is refused with the
// findings still open. The cap reads the ticket's claim pin (D-15), never the approach record's own pin.
import { expect, it } from 'vitest';
import { APPROACH_CAP_FROM, loadSnapshot, nextRound, roundText } from '../src/index.js';
import type { ClaimPin, RepoSnapshot } from '../src/index.js';
import { CONFIG, building } from '../../../test/helpers/lane.js';

const LEDGER = '## Rulings\n- task 1 done abc1234\n- task 2 done abc1234\n';
const HEAD = 'Round record: 1\n\n';
const round = (n: number, ...lines: string[]) => '## Round ' + n + '\n\n' + lines.join('\n') + '\n\n';
const at = (v: string): string => CONFIG.replace(/accord: "[^"]*"/, `accord: "${v}"`);

const R1_FIXED = '1. Must — the option drops a header — fixed';
const R1_OPEN = '2. Must — no rollback — unverified';
const R2_OPEN = '1. Should — the cache can go stale — open';

interface Opts {
  approach?: string;
  ledger?: string;
  lane?: string;
  config?: string;
  claim?: ClaimPin; // the host's claim fact; absent: no claim fact
}
function repo({ approach, ledger = LEDGER, lane, config = CONFIG, claim }: Opts = {}): RepoSnapshot {
  const files: Record<string, string> = { 'accord/config.yml': config };
  building(files, 'T-1', lane === undefined ? undefined : { lane });
  files['accord/tickets/T-1/ledger.md'] = ledger;
  if (approach !== undefined) files['accord/tickets/T-1/approach-review.md'] = approach;
  const snapshot = loadSnapshot({ files, tree: Object.keys(files) });
  return claim === undefined ? snapshot : { ...snapshot, claimPins: { 'T-1': claim } };
}
const cut = { pin: APPROACH_CAP_FROM };
const ask = (o: Opts) => nextRound(repo(o), 'T-1', 'approach');

it('risk:complex-branching the approach critic gets two rounds from the cut-off and round 3 is refused with the open findings (ST-LN-91 91d-ac-2)', () => {
  const none = ask({ claim: cut });
  expect(none).toMatchObject({ kind: 'next', round: 1, cycle: 1, cap: 2 });
  expect(roundText(none)).toBe('Round: 1 of 2\nCycle: 1\n');

  const one = HEAD + round(1, R1_FIXED, R1_OPEN);
  const second = ask({ claim: cut, approach: one });
  expect(second).toMatchObject({ kind: 'next', round: 2, cap: 2 });
  expect(roundText(second)).toBe('Round: 2 of 2\nCycle: 1\n');

  const two = one + round(2, R2_OPEN);
  const refused = ask({ claim: cut, approach: two });
  expect(refused).toMatchObject({ kind: 'refused', cap: 2, cycle: 1, round: 2 });
  const reason = refused.reasons.join('\n');
  expect(reason).toContain('cap of 2 approach critique rounds');
  expect(reason).toContain('## Approach');
  expect(refused.findings).toEqual([
    { round: 1, lines: [R1_OPEN] },
    { round: 2, lines: [R2_OPEN] },
  ]);

  const text = roundText(refused);
  expect(text.startsWith('refused:')).toBe(true);
  expect(text).toContain('Findings still open:');
  expect(text).toContain(R1_OPEN);
  expect(text).toContain(R2_OPEN);
  expect(text).not.toContain(R1_FIXED);
  expect(text).not.toContain('stop: report to owner');
  expect(text).not.toContain('To allow more rounds');

  // D-18: lane P gets the cap of two exactly as lane M does.
  expect(ask({ claim: cut, lane: 'P' })).toMatchObject({ kind: 'next', round: 1, cap: 2 });
});

it('risk:complex-branching with no claim fact the working-tree pin decides the approach cap, and a failed claim read gives two (ST-LN-91 91d-ac-2)', () => {
  expect(ask({ config: at('0.4.0') })).toMatchObject({ kind: 'next', round: 1, cap: 5 });
  expect(ask({ config: at(APPROACH_CAP_FROM) })).toMatchObject({ kind: 'next', round: 1, cap: 2 });
  expect(ask({ config: at('0.4.0'), claim: { error: 'git failed' } })).toMatchObject({ kind: 'next', round: 1, cap: 2 });
});
