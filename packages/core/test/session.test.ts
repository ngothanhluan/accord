import { describe, expect, it } from 'vitest';
import { rulesetText, sessionLine } from '../src/index.js';
import type { StatusRow } from '../src/index.js';

const row = (over: Partial<StatusRow>): StatusRow => ({
  id: 'T-1', ui: false, errors: 0, warnings: 0, ready: 'ok', ticksVerified: 0, ticksTagged: 0, ticksBinding: 'none',
  lane: 'M', status: 'open', stage: 'plan', tasksDone: 0, tasksTotal: 0, ...over,
});

describe('rulesetText', () => {
  const text = rulesetText('npx --yes @x/accord@1.2.3');
  it('fills the invocation and leaves no placeholder', () => {
    expect(text).toContain('npx --yes @x/accord@1.2.3');
    expect(text).not.toContain('{{');
  });
  // Phase 8.1 D-06: 2048 became 2176 for the one clause of rule 8 that names `commits.message` and `accord commit check` (124 bytes), the only route of the commit rule to every agent; every session start and subagent reads this text.
  it('is under 2176 bytes', () => expect(Buffer.byteLength(text)).toBeLessThan(2176));
  it('leaves the ledger and the report shape to each agent', () => {
    expect(text).toContain('never writes the ledger unless its own instructions say so');
    expect(text).toContain('these lines go inside that report');
  });
});

describe('sessionLine', () => {
  it('says so when there is no lane row', () => {
    expect(sessionLine([])).toBe('accord: no lane tickets yet · type /accord-new <request> to start one');
  });
  it('risk:regression the session line names /accord-new for a new request and /accord for the dashboard (ST-LN-83 7-ac-1)', () => {
    expect(sessionLine([])).toBe('accord: no lane tickets yet · type /accord-new <request> to start one');
    expect(sessionLine([row({})])).toMatch(/ · type \/accord$/);
  });
  it('counts a readied plan-stage row as ready', () => {
    expect(sessionLine([row({})])).toBe('accord: 0 in progress, 1 ready to pick up · type /accord');
  });
  it('counts a build row with tasks done as in progress', () => {
    const r = row({ stage: 'build', tasksDone: 1, tasksTotal: 2 });
    expect(sessionLine([r])).toBe('accord: 1 in progress, 0 ready to pick up · type /accord');
  });
  it('risk:regression the session line counts a claimed lane R ticket at research as in progress (ST-LN-94 94-ac-5)', () => {
    const rows = [row({ id: 'R-1', lane: 'R', stage: 'research', claimedBy: 'an@example.com' }), row({ id: 'R-2', lane: 'R', stage: 'research' })];
    expect(sessionLine(rows)).toBe('accord: 1 in progress, 1 ready to pick up · type /accord');
    expect(sessionLine([row({ id: 'R-3', lane: 'R', stage: 'intent', ready: 'none' })])).toBe('accord: 0 in progress, 0 ready to pick up · type /accord');
  });
  it('counts a dropped row nowhere', () => {
    expect(sessionLine([row({ status: 'dropped' })])).toBe(
      'accord: no lane tickets yet · type /accord-new <request> to start one',
    );
  });
});
