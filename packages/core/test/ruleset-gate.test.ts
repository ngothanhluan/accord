// ST-LN-96 t1-ac-2: a `ruleset` that differs from the pin at the ticket's reachable claim commit, or a removed one, fails every gate in every lane.
import { describe, expect, it } from 'vitest';
import { gateDone, gatePlan, gateReady, loadSnapshot, RULESET_FROM } from '../src/index.js';
import type { GateResult, RepoSnapshot } from '../src/index.js';
import { CONFIG, LANE_S_BODY, laneTicket } from '../../../test/helpers/lane.js';

const SHA = 'a'.repeat(40);

interface Opts {
  ruleset?: string; // the ticket's frontmatter value; absent: no key
  pin?: string; // claim pin; absent: no claim fact
  claimRuleset?: string; // the ruleset the ticket file held at the claim commit; absent: the claim fact carries none
  fact?: { error: string }; // a failed claim read
  lane?: string;
}
const build = ({ ruleset, pin, claimRuleset, fact, lane }: Opts = {}): RepoSnapshot => {
  const files: Record<string, string> = {
    'accord/config.yml': CONFIG,
    'accord/tickets/T-1.md': laneTicket('T-1', {
      ...(lane === undefined ? {} : { lane }),
      ...(lane === 'S' ? { body: LANE_S_BODY } : {}),
      ...(ruleset === undefined ? {} : { frontmatter: [`ruleset: "${ruleset}"`] }),
    }),
  };
  const snapshot = loadSnapshot({ files, tree: Object.keys(files).sort() });
  const claimed = fact ?? (pin === undefined ? undefined : { sha: SHA, pin, ...(claimRuleset === undefined ? {} : { ruleset: claimRuleset }) });
  return claimed === undefined ? snapshot : { ...snapshot, claimPins: { 'T-1': claimed } };
};
const GATES = { ready: gateReady, plan: gatePlan, done: gateDone } as const;
const found = (which: keyof typeof GATES, rule: string, o: Opts): GateResult['findings'] =>
  GATES[which](build(o), 'T-1').findings.filter((f) => f.rule === rule);
const changed = (which: keyof typeof GATES, o: Opts) => found(which, 'gate.ruleset-changed', o);
const missing = (which: keyof typeof GATES, o: Opts) => found(which, 'gate.ruleset-missing', o);

describe('gate.ruleset-changed', () => {
  it('risk:complex-branching a ruleset that differs from the claim pin fails every gate and names both values (ST-LN-96 t1-ac-2)', () => {
    for (const which of ['ready', 'plan', 'done'] as const) {
      const f = changed(which, { ruleset: '0.4.0', pin: '0.5.0' });
      expect(f, which).toHaveLength(1);
      expect(f[0].level).toBe('error');
      expect(f[0].file).toBe('accord/tickets/T-1.md');
      expect(f[0].pointer).toBe('/ruleset');
      expect(f[0].reason).toContain('0.4.0');
      expect(f[0].reason).toContain('0.5.0');
      expect(f[0].reason).toContain(SHA.slice(0, 12));
      expect(gateReady(build({ ruleset: '0.4.0', pin: '0.5.0' }), 'T-1').verdict).toBe('fail');
    }
  });

  it('risk:complex-branching an equal ruleset passes, and a failed or absent claim read is silent (ST-LN-96 t1-ac-2)', () => {
    for (const which of ['ready', 'plan', 'done'] as const) {
      expect(changed(which, { ruleset: '0.5.0', pin: '0.5.0' }), which).toEqual([]);
      expect(changed(which, { ruleset: '0.4.0' }), which + ' no fact').toEqual([]);
      expect(changed(which, { ruleset: '0.4.0', fact: { error: 'git failed' } }), which + ' error fact').toEqual([]);
      expect(changed(which, { pin: '0.5.0' }), which + ' no field').toEqual([]);
    }
  });

  it('risk:complex-branching lane S and lane R tickets get the same finding in every gate (ST-LN-96 t1-ac-2)', () => {
    for (const lane of ['S', 'R']) {
      for (const which of ['ready', 'plan', 'done'] as const) {
        const f = changed(which, { lane, ruleset: '0.4.0', pin: '0.5.0' });
        // lane S has no plan gate of its own and keeps PLAN_RULES; every other cell holds the rule
        expect(f, lane + ' ' + which).toHaveLength(1);
        expect(f[0].reason, lane + ' ' + which).toContain('0.4.0');
        expect(f[0].reason, lane + ' ' + which).toContain('0.5.0');
      }
    }
  });

  it('risk:complex-branching adjacency: a pin equal to RULESET_FROM is not before it, and any difference fails (ST-LN-96 t1-ac-2)', () => {
    expect(changed('ready', { ruleset: RULESET_FROM, pin: RULESET_FROM })).toEqual([]);
    expect(changed('ready', { ruleset: '0.5.1', pin: RULESET_FROM })).toHaveLength(1);
    expect(changed('ready', { ruleset: RULESET_FROM, pin: '0.4.1' })).toHaveLength(1);
  });
});

// A rebase rewrites the claim commit onto the new base, so the config pin at it is main's new pin; the ruleset the claim commit's own ticket file holds is
// what the claim wrote, and a rebase replays it unchanged.
describe('gate.ruleset-changed with the claim-time ticket ruleset', () => {
  it('risk:complex-branching the check compares with the claim-time ticket ruleset when the fact carries it (ST-LN-96 t1-ac-1)', () => {
    for (const which of ['ready', 'plan', 'done'] as const) {
      // rebased onto an upgraded main: the pin at the rewritten claim commit is 0.5.1, the claim wrote 0.5.0, the ticket still says 0.5.0
      expect(changed(which, { ruleset: '0.5.0', pin: '0.5.1', claimRuleset: '0.5.0' }), which + ' rebased').toEqual([]);
      // a hand edit after the claim still differs from what the claim wrote, even when it equals the pin at the claim commit
      const f = changed(which, { ruleset: '0.5.1', pin: '0.5.1', claimRuleset: '0.5.0' });
      expect(f, which + ' hand-edited').toHaveLength(1);
      expect(f[0].level).toBe('error');
      expect(f[0].pointer).toBe('/ruleset');
      expect(f[0].reason).toContain('"0.5.1"');
      expect(f[0].reason).toContain('"0.5.0"');
      expect(f[0].reason).toContain(SHA.slice(0, 12));
    }
    for (const lane of ['S', 'R']) {
      expect(changed('done', { lane, ruleset: '0.5.0', pin: '0.5.1', claimRuleset: '0.5.0' }), 'lane ' + lane).toEqual([]);
      expect(changed('done', { lane, ruleset: '0.4.0', pin: '0.5.1', claimRuleset: '0.5.0' }), 'lane ' + lane + ' edited').toHaveLength(1);
    }
  });

  it('risk:complex-branching a fact with no claim-time ruleset still compares with the config pin at the claim commit (ST-LN-96 t1-ac-2)', () => {
    for (const which of ['ready', 'plan', 'done'] as const) {
      const f = changed(which, { ruleset: '0.4.0', pin: '0.5.0' });
      expect(f, which).toHaveLength(1);
      expect(f[0].reason, which).toContain('0.4.0');
      expect(f[0].reason, which).toContain('0.5.0');
      expect(changed(which, { ruleset: '0.5.0', pin: '0.5.0' }), which + ' equal').toEqual([]);
    }
  });
});

describe('gate.ruleset-missing', () => {
  it('risk:complex-branching a ticket claimed from RULESET_FROM with no ruleset fails every gate (ST-LN-96 t1-ac-2)', () => {
    for (const which of ['ready', 'plan', 'done'] as const) {
      const f = missing(which, { pin: '0.5.0' });
      expect(f, which).toHaveLength(1);
      expect(f[0].level).toBe('error');
      expect(f[0].file).toBe('accord/tickets/T-1.md');
      expect(f[0].pointer).toBe('/ruleset');
      expect(f[0].reason).toContain('0.5.0');
      expect(f[0].reason).toContain(SHA.slice(0, 12));
      expect(missing(which, { lane: 'S', pin: '0.5.0' }), 'lane S ' + which).toHaveLength(1);
    }
  });

  it('risk:complex-branching a claim pin before RULESET_FROM, no fact or a failed read leaves a missing ruleset alone (ST-LN-96 t1-ac-2)', () => {
    for (const which of ['ready', 'plan', 'done'] as const) {
      expect(missing(which, { pin: '0.4.1' }), which).toEqual([]);
      expect(missing(which, {}), which + ' no fact').toEqual([]);
      expect(missing(which, { fact: { error: 'git failed' } }), which + ' error fact').toEqual([]);
      expect(missing(which, { ruleset: '0.5.0', pin: '0.5.0' }), which + ' has field').toEqual([]);
    }
  });
});
