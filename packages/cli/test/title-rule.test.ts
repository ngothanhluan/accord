// ST-LN-22 D-08b: `accord new ticket --title` refuses a title that breaks the rule, before the similar-tickets step, and
// writes nothing. Real files in tmp sandboxes; nothing here reaches the real origin.
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, expect, it } from 'vitest';
import { TITLE_RULE_FROM } from '@accord-dev/accord-core';
import { claimedUnder, cleanup, makeEmptyRepo, makeLaneRepo, run, writeFiles } from './helpers/repo.js';
import { CONFIG, laneTicket } from '../../../test/helpers/lane.js';

const repos: string[] = [];
afterEach(() => {
  while (repos.length > 0) cleanup(repos.pop() as string);
});

function sandbox(): string {
  const repo = makeEmptyRepo();
  repos.push(repo);
  writeFiles(repo, { 'accord/config.yml': CONFIG });
  return repo;
}
const tickets = (repo: string): string[] => (existsSync(join(repo, 'accord', 'tickets')) ? readdirSync(join(repo, 'accord', 'tickets')).sort() : []);

it('D-08b accord new ticket refuses a title that breaks the rule (ST-LN-22 D-08b)', async () => {
  const repo = sandbox();
  const before = tickets(repo);
  for (const title of ['Exportation des données', 'Short title in business language', 'x'.repeat(81)]) {
    const r = await run(['new', 'ticket', 'N-1', '--lane', 'M', '--title', title, '--related', 'none'], repo);
    expect([title, r.code], r.out + r.err).toEqual([title, 2]);
    expect(r.err, title).toContain('title rule: English, in business language');
    expect(r.err, title).toContain('at most 80 characters');
    expect(r.err, title).toContain('nothing was written');
    expect(tickets(repo), title).toEqual(before);
  }
  const ok = await run(['new', 'ticket', 'N-1', '--lane', 'M', '--title', 'Export reports to CSV', '--related', 'none'], repo);
  expect(ok.code, ok.out + ok.err).toBe(0);
  expect(tickets(repo)).toEqual(['N-1.md']);
});

const lines = (s: string): string[] => s.split('\n').filter((l) => l !== '');
const RULE = 'title rule: English, in business language: what the reader gets, not how the code changes; at most 80 characters; English letters only';

it('risk:parsing the title rule comes from config.yml and is printed at creation (ST-LN-22 D-08b 7-ac-5)', async () => {
  const repo = sandbox();
  // a creation given --title prints the rule line once, before the path
  const ok = await run(['new', 'ticket', 'N-1', '--lane', 'M', '--title', 'Export reports to CSV', '--related', 'none'], repo);
  expect(ok.code, ok.out + ok.err).toBe(0);
  const out = lines(ok.out);
  expect(out.filter((l) => l.startsWith('title rule: '))).toEqual([RULE]);
  expect(out.indexOf(RULE)).toBeLessThan(out.indexOf('accord/tickets/N-1.md'));
  // a run with no --title prints no rule line: only the path it printed before
  const bare = await run(['new', 'ticket', 'N-2'], repo);
  expect(bare.code, bare.err).toBe(0);
  expect(bare.out).toBe('accord/tickets/N-2.md\n');

  // the similar-candidates refusal prints the rule line after the similar lines, before its error
  const dup = await run(['new', 'ticket', 'N-3', '--lane', 'M', '--title', 'Export reports to CSV'], repo);
  expect(dup.code, dup.out + dup.err).toBe(2);
  const shown = lines(dup.out);
  expect(shown.filter((l) => l.startsWith('similar: ')).length).toBeGreaterThan(0);
  expect(shown[shown.length - 1]).toBe(RULE);

  // accord config edits the rule, validated by the schema
  const set = await run(['config', 'set', 'titles.max_length', '60'], repo);
  expect(set.code, set.err).toBe(0);
  // digits are kept as a string, so get prints them quoted, as it does for stale_days
  expect((await run(['config', 'get', 'titles.max_length'], repo)).out).toBe('"60"\n');
  const bad = await run(['config', 'set', 'titles.language', 'french'], repo);
  expect(bad.code, bad.out).toBe(2);
  expect(bad.err).toContain('titles');
  // the configured length is the one enforced and printed
  const long = await run(['new', 'ticket', 'N-4', '--lane', 'M', '--title', 'x'.repeat(70), '--related', 'none'], repo);
  expect(long.code, long.out).toBe(2);
  expect(long.err).toContain('70 characters, more than 60');
  expect(long.err).toContain('at most 60 characters');
});

/** A lane M ticket T-1 titled `title`, claimed under accord `pin` (the claim commit holds that pin; the working tree keeps the running version's). */
function claimedWith(title: string, pin: string): string {
  const repo = makeLaneRepo({ 'accord/tickets/T-1.md': laneTicket('T-1').replace('title: "Export"', `title: "${title}"`) });
  repos.push(repo);
  claimedUnder(repo, pin);
  return repo;
}
const titleFindings = (out: string): { rule: string; level: string; reason: string }[] =>
  (JSON.parse(out).findings as { rule: string; level: string; reason: string }[]).filter((f) => f.rule === 'gate.ticket-title');

it('D-08b accord gate ready refuses a title that breaks the rule for a ticket claimed at the cut-off (ST-LN-22 D-08b)', async () => {
  const placeholder = await run(['gate', 'ready', 'T-1', '--json'], claimedWith('Short title in business language', TITLE_RULE_FROM));
  expect(placeholder.code, placeholder.out + placeholder.err).toBe(1);
  const found = titleFindings(placeholder.out);
  expect(found).toHaveLength(1);
  expect(found[0].level).toBe('error');
  expect(found[0].reason).toContain('placeholder');
  expect(found[0].reason).toContain('title rule: English, in business language');
  // the text form names the rule id too
  const text = await run(['gate', 'ready', 'T-1'], claimedWith('x'.repeat(120), TITLE_RULE_FROM));
  expect(text.code, text.out + text.err).toBe(1);
  expect(text.out).toContain('gate.ticket-title');
  // a ticket claimed before the cut-off is not judged, whatever its title
  const old = await run(['gate', 'ready', 'T-1', '--json'], claimedWith('Short title in business language', '0.7.1'));
  expect(titleFindings(old.out)).toEqual([]);
});
