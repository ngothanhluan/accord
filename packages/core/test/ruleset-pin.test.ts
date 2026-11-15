// ST-LN-96 t1-ac-1: claimPinBefore reads the ticket's own `ruleset` first, then the claim fact, then the working-tree pin.
import { describe, expect, it } from 'vitest';
import { APPROACH_CAP_FROM, claimPinBefore, DISCUSS_FROM, loadSnapshot, pinBefore, PLAN_CAP_FROM, PLAN_FORMAT_FROM, PLAN_GROUNDS_FROM, RULESET_FROM } from '../src/index.js';
import type { RepoSnapshot } from '../src/index.js';
import { CONFIG, RUNNING, laneTicket } from '../../../test/helpers/lane.js';

const at = (v: string): string => CONFIG.replace(/accord: "[^"]*"/, `accord: "${v}"`);

interface Opts {
  ruleset?: string; // the ticket's frontmatter value; absent: no key
  pin?: string; // claim pin; absent: no claim fact
  basePin?: string;
  fact?: { error: string }; // a failed claim read
  factRuleset?: string; // the ruleset the host read from the branch's first commit that held one
  config?: string; // the working-tree config
  done?: boolean; // the ticket carries verified_hash and verified_commit, as a ticket that finished verify does
}
const build = ({ ruleset, pin, basePin, fact, factRuleset, config = CONFIG, done = false }: Opts = {}): RepoSnapshot => {
  const files: Record<string, string> = {
    'accord/config.yml': config,
    'accord/tickets/T-1.md': laneTicket('T-1', { frontmatter: [...(ruleset === undefined ? [] : [`ruleset: "${ruleset}"`]), ...(done ? ['verified_hash: "fnv1a64:0123456789abcdef"', 'verified_commit: "abc1234def"'] : [])] }),
  };
  const snapshot = loadSnapshot({ files, tree: Object.keys(files).sort() });
  const claimed =
    fact ?? (pin === undefined ? undefined : { pin, ...(basePin === undefined ? {} : { basePin }), ...(factRuleset === undefined ? {} : { ruleset: factRuleset }) });
  return claimed === undefined ? snapshot : { ...snapshot, claimPins: { 'T-1': claimed } };
};
const before = (from: string, o: Opts = {}): boolean => claimPinBefore(build(o), 'T-1', from);

describe('claimPinBefore reads ruleset', () => {
  it("risk:complex-branching claimPinBefore reads the ticket's ruleset when git holds no claim fact (ST-LN-96 t1-ac-1)", () => {
    // a squash or rebase merge loses the claim commit: no fact, so the field is all there is (D-02), in both directions
    expect(before(DISCUSS_FROM, { ruleset: '0.4.0', config: at('0.4.1'), done: true })).toBe(true);
    expect(before(DISCUSS_FROM, { ruleset: '0.4.1', config: at('0.4.0'), done: true })).toBe(false);
  });

  it('risk:security a hand-edited ruleset never outranks the claim fact the host read from git (CR-01)', () => {
    // the first ruleset the branch held wins over a lowered working-tree field, so `accord approve` keeps its open-finding block
    expect(before(DISCUSS_FROM, { ruleset: '0.4.0', pin: '0.5.0', factRuleset: '0.5.0' })).toBe(false);
    expect(before(APPROACH_CAP_FROM, { ruleset: '0.4.0', pin: '0.5.0', factRuleset: '0.5.0' })).toBe(false);
    // a fact that carries only a pin (a ticket claimed before RULESET_FROM, never backfilled) outranks the field too
    expect(before(DISCUSS_FROM, { ruleset: '0.4.0', pin: '0.4.1' })).toBe(false);
    // the fact says old rules: a raised field does not take them away
    expect(before(DISCUSS_FROM, { ruleset: '0.5.0', pin: '0.4.0' })).toBe(true);
    expect(before(DISCUSS_FROM, { ruleset: '0.5.0', pin: '0.4.0', factRuleset: '0.4.0' })).toBe(true);
    // a failed claim read fails closed before the field is consulted
    expect(before(DISCUSS_FROM, { ruleset: '0.4.0', fact: { error: 'git failed' } })).toBe(false);
    expect(before(DISCUSS_FROM, { fact: { error: 'git failed' } })).toBe(false);
  });

  it('risk:complex-branching a ticket without ruleset keeps the claim fact, the error and the working-tree pin chain (ST-LN-96 t1-ac-1)', () => {
    expect(before(DISCUSS_FROM, { pin: '0.4.0' })).toBe(true);
    expect(before(DISCUSS_FROM, { pin: '0.4.1' })).toBe(false);
    expect(before(DISCUSS_FROM, { pin: '0.4.1', basePin: '0.4.1' })).toBe(false);
    expect(before(DISCUSS_FROM, { pin: '0.4.0', basePin: '0.4.1' })).toBe(false); // a pin below its merge base's is not read as old
    expect(before(DISCUSS_FROM, { config: at('0.4.0') })).toBe(true); // no fact: the working-tree pin
    expect(before(DISCUSS_FROM, { config: at('0.4.1') })).toBe(false);
  });

  it('risk:complex-branching a ruleset that is not a plain x.y.z is ignored and the claim fact decides (ST-LN-96 t1-ac-1)', () => {
    const rc = '0.5.0-rc.1';
    expect(before(DISCUSS_FROM, { ruleset: rc, pin: '0.4.0' })).toBe(true);
    expect(before(DISCUSS_FROM, { ruleset: rc, pin: '0.4.1' })).toBe(false);
    expect(before(DISCUSS_FROM, { ruleset: rc, config: at('0.4.0'), done: true })).toBe(true);
    expect(before(DISCUSS_FROM, { ruleset: rc, fact: { error: 'git failed' } })).toBe(false);
  });

  it('risk:complex-branching each of the five Phase 3 constants answers through the field when no claim fact exists, and a ruleset at the cut-off is not before it (ST-LN-96 t1-ac-1)', () => {
    for (const from of [DISCUSS_FROM, APPROACH_CAP_FROM, PLAN_FORMAT_FROM, PLAN_CAP_FROM, PLAN_GROUNDS_FROM]) {
      expect(before(from, { ruleset: '0.4.0', config: at(from), done: true }), from).toBe(true);
      expect(before(from, { ruleset: from, config: at('0.4.0'), done: true }), from).toBe(false);
    }
    expect(RULESET_FROM).toBe('0.5.0');
    expect(before(RULESET_FROM, { ruleset: '0.5.0', config: at('0.4.0'), done: true })).toBe(false); // adjacency: pinBefore is strict
    expect(before(RULESET_FROM, { ruleset: '0.4.9', config: at('0.5.0'), done: true })).toBe(true);
  });

  it('risk:regression RULESET_FROM is the release that ships the rule: equal to the CLI version at 0.5.0, never after it (ST-LN-96 rel-ac-1)', () => {
    expect(pinBefore(RULESET_FROM, RUNNING)).toBe(false); // the cut-off is never ahead of the running CLI
    if (RUNNING === '0.5.0') expect(RULESET_FROM).toBe(RUNNING); // the release that ships it names itself
  });

  // CR-01 residual (round 2): `accord approve` does not require a claim, so a ticket with no claim commit reachable from HEAD is either unclaimed (its field is a hand edit that nothing
  // checks, and a later claim overwrites it) or a claimed ticket whose claim commit a squash or rebase merge dropped (D-02). The ticket itself tells them apart: a merged ticket is done, so it
  // carries the verified_hash and verified_commit that verify wrote; an unclaimed or in-flight one does not, and its working-tree pin decides.
  it('risk:security with no claim fact a hand-edited ruleset lowers the rules only on a ticket that is done (CR-01)', () => {
    for (const from of [DISCUSS_FROM, APPROACH_CAP_FROM, PLAN_FORMAT_FROM, PLAN_CAP_FROM, PLAN_GROUNDS_FROM]) {
      expect(before(from, { ruleset: '0.4.0', config: at('0.5.0') }), from).toBe(false); // in flight, never claimed: the new rules apply
      expect(before(from, { ruleset: '0.4.0', config: at('0.5.0'), done: true }), from).toBe(true); // D-02: merged by squash, the field is all there is
    }
  });

  it('risk:security with no ruleset and no claim commit the working-tree pin decides, so the new rules apply at the running version (ST-LN-96 t1-ac-1)', () => {
    expect(before(DISCUSS_FROM, {})).toBe(false);
    expect(before(DISCUSS_FROM, { ruleset: undefined, config: CONFIG })).toBe(false);
  });
});
