// ST-LN-96 t1-ac-1: claimPinBefore reads the ticket's own `ruleset` first, then the claim fact, then the working-tree pin.
import { describe, expect, it } from 'vitest';
import { APPROACH_CAP_FROM, claimPinBefore, DISCUSS_FROM, loadSnapshot, PLAN_CAP_FROM, PLAN_FORMAT_FROM, PLAN_GROUNDS_FROM, RULESET_FROM } from '../src/index.js';
import type { RepoSnapshot } from '../src/index.js';
import { CONFIG, laneTicket } from '../../../test/helpers/lane.js';

const at = (v: string): string => CONFIG.replace(/accord: "[^"]*"/, `accord: "${v}"`);

interface Opts {
  ruleset?: string; // the ticket's frontmatter value; absent: no key
  pin?: string; // claim pin; absent: no claim fact
  basePin?: string;
  fact?: { error: string }; // a failed claim read
  config?: string; // the working-tree config
}
const build = ({ ruleset, pin, basePin, fact, config = CONFIG }: Opts = {}): RepoSnapshot => {
  const files: Record<string, string> = {
    'accord/config.yml': config,
    'accord/tickets/T-1.md': laneTicket('T-1', ruleset === undefined ? {} : { frontmatter: [`ruleset: "${ruleset}"`] }),
  };
  const snapshot = loadSnapshot({ files, tree: Object.keys(files).sort() });
  const claimed = fact ?? (pin === undefined ? undefined : { pin, ...(basePin === undefined ? {} : { basePin }) });
  return claimed === undefined ? snapshot : { ...snapshot, claimPins: { 'T-1': claimed } };
};
const before = (from: string, o: Opts = {}): boolean => claimPinBefore(build(o), 'T-1', from);

describe('claimPinBefore reads ruleset', () => {
  it("risk:complex-branching claimPinBefore reads the ticket's ruleset before the claim commit (ST-LN-96 t1-ac-1)", () => {
    // the field wins over a claim fact that says the opposite, in both directions
    expect(before(DISCUSS_FROM, { ruleset: '0.4.0', pin: '0.4.1' })).toBe(true);
    expect(before(DISCUSS_FROM, { ruleset: '0.4.1', pin: '0.4.0' })).toBe(false);
    // ... over the working-tree pin when there is no claim fact (a squash-merged ticket: no claim commit reachable from main)
    expect(before(DISCUSS_FROM, { ruleset: '0.4.0', config: at('0.4.1') })).toBe(true);
    // ... and over a failed claim read (ordering: the field is first, the error only matters without it)
    expect(before(DISCUSS_FROM, { ruleset: '0.4.0', fact: { error: 'git failed' } })).toBe(true);
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

  it('risk:complex-branching a ruleset that is not a plain x.y.z falls through to the claim fact (ST-LN-96 t1-ac-1)', () => {
    const rc = '0.5.0-rc.1';
    expect(before(DISCUSS_FROM, { ruleset: rc, pin: '0.4.0' })).toBe(true);
    expect(before(DISCUSS_FROM, { ruleset: rc, pin: '0.4.1' })).toBe(false);
    expect(before(DISCUSS_FROM, { ruleset: rc, config: at('0.4.0') })).toBe(true);
    expect(before(DISCUSS_FROM, { ruleset: rc, fact: { error: 'git failed' } })).toBe(false);
  });

  it('risk:complex-branching each of the five Phase 3 constants answers through the field, and a ruleset at the cut-off is not before it (ST-LN-96 t1-ac-1)', () => {
    for (const from of [DISCUSS_FROM, APPROACH_CAP_FROM, PLAN_FORMAT_FROM, PLAN_CAP_FROM, PLAN_GROUNDS_FROM]) {
      expect(before(from, { ruleset: '0.4.0', pin: from }), from).toBe(true);
      expect(before(from, { ruleset: from, pin: '0.4.0' }), from).toBe(false);
    }
    expect(RULESET_FROM).toBe('0.5.0');
    expect(before(RULESET_FROM, { ruleset: '0.5.0', pin: '0.4.0' })).toBe(false); // adjacency: pinBefore is strict
    expect(before(RULESET_FROM, { ruleset: '0.4.9', pin: '0.5.0' })).toBe(true);
  });

  it('risk:security with no ruleset and no claim commit the working-tree pin decides, so the new rules apply at the running version (ST-LN-96 t1-ac-1)', () => {
    expect(before(DISCUSS_FROM, {})).toBe(false);
    expect(before(DISCUSS_FROM, { ruleset: undefined, config: CONFIG })).toBe(false);
  });
});
