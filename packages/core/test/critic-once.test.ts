// Phase 10 D-01, 10-ac-3, 10-ac-11: the approach critic and the plan checker run one round for a ticket claimed at or after CRITIC_ONCE_FROM; a ticket claimed
// earlier keeps the cap rules it was claimed under. The cap reads the ticket's claim pin through claimPinBefore, and `strictness.rounds.<kind>` replaces only `cap`.
import { expect, it } from 'vitest';
import { APPROACH_CAP, APPROACH_ONCE, CRITIC_ONCE_FROM, capRulesOf, loadSnapshot } from '../src/index.js';
import type { ClaimPin, RepoSnapshot } from '../src/index.js';
import { CONFIG, building } from '../../../test/helpers/lane.js';

interface Opts {
  approach?: string;
  claim?: ClaimPin; // the host's claim fact; absent: no claim fact
  config?: string;
}
function repo({ approach, claim, config = CONFIG }: Opts = {}): RepoSnapshot {
  const files: Record<string, string> = { 'accord/config.yml': config };
  building(files, 'T-1');
  if (approach !== undefined) files['accord/tickets/T-1/approach-review.md'] = approach;
  let snapshot: RepoSnapshot = loadSnapshot({ files, tree: Object.keys(files) });
  if (claim !== undefined) snapshot = { ...snapshot, claimPins: { 'T-1': claim } };
  return snapshot;
}
const once = { pin: '0.24.0' };
const before = { pin: '0.23.1' };

it('risk:regression the one-round cut-off is 0.24.0 (10-ac-3, D-01)', () => {
  expect(CRITIC_ONCE_FROM).toBe('0.24.0');
});

it('risk:regression an approach claimed at the cut-off gets one round and no stop of its own (10-ac-3, D-01)', () => {
  expect(capRulesOf(repo({ claim: once }), 'T-1', 'approach')).toBe(APPROACH_ONCE);
  expect(APPROACH_ONCE).toEqual({ cap: 1, fall: true, allowances: false, capStop: false });
});

it('risk:regression an approach claimed before the cut-off keeps the two rounds it was claimed under (10-ac-11)', () => {
  expect(capRulesOf(repo({ claim: before }), 'T-1', 'approach')).toBe(APPROACH_CAP);
});
