// ST-LN-22 D-08b: `accord new ticket --title` refuses a title that breaks the rule, before the similar-tickets step, and
// writes nothing. Real files in tmp sandboxes; nothing here reaches the real origin.
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, expect, it } from 'vitest';
import { cleanup, makeEmptyRepo, run, writeFiles } from './helpers/repo.js';
import { CONFIG } from '../../../test/helpers/lane.js';

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
  for (const title of ['Xuất báo cáo', 'Short title in business language', 'x'.repeat(81)]) {
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
