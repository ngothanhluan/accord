import { readFileSync } from 'node:fs';
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
  it('is under 2048 bytes', () => expect(Buffer.byteLength(text)).toBeLessThan(2048));
  it('leaves the ledger and the report shape to each agent', () => {
    expect(text).toContain('never writes the ledger unless its own instructions say so');
    expect(text).toContain('these lines go inside that report');
  });
});

it('ac-2 the session rules filled with the cli invocation carry the sentence limit', () => {
  const pkg = JSON.parse(readFileSync(new URL('../../cli/package.json', import.meta.url), 'utf8')) as { name: string; version: string };
  const invocation = `npx --yes ${pkg.name}@${pkg.version}`;
  const text = rulesetText(invocation);
  expect(text).toContain('at most 25 words');
  expect(Buffer.byteLength(text)).toBeLessThan(2048);
  expect(text).toContain(invocation);
  expect(text).not.toContain('{{');
  expect(text).toContain('never writes the ledger unless its own instructions say so');
  expect(text).toContain('these lines go inside that report');
  expect(text.startsWith('# accord rules\n')).toBe(true);
  expect(text).toContain('Run accord as `npx --yes @accord-dev/accord@');
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
