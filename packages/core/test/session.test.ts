import { describe, expect, it } from 'vitest';
import { deniedNames } from '../../../test/helpers/denied.js';
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
  it('is under 2048 bytes', () => expect(Buffer.byteLength(text)).toBeLessThan(2048));
  it('names no other tool', () => expect(deniedNames([{ path: 'ruleset.md', text }])).toEqual([]));
});

describe('sessionLine', () => {
  it('says so when there is no lane row', () => {
    expect(sessionLine([])).toBe('accord: no lane tickets yet · type /accord <request> to start one');
  });
  it('counts a readied plan-stage row as ready', () => {
    expect(sessionLine([row({})])).toBe('accord: 0 in progress, 1 ready to pick up · type /accord');
  });
  it('counts a build row with tasks done as in progress', () => {
    const r = row({ stage: 'build', tasksDone: 1, tasksTotal: 2 });
    expect(sessionLine([r])).toBe('accord: 1 in progress, 0 ready to pick up · type /accord');
  });
  it('counts a dropped row nowhere', () => {
    expect(sessionLine([row({ status: 'dropped' })])).toBe(
      'accord: no lane tickets yet · type /accord <request> to start one',
    );
  });
});
