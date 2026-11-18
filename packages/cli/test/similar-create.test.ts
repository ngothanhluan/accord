// ST-LN-22 D-08: `accord new ticket --title` prints the tickets most like the request before any id is assigned or
// any file is written, and creates nothing until the session has judged them. Real files in tmp sandboxes; nothing
// here reaches the real origin. The printed lines are asserted by membership: other stages may add lines to a run.
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, expect, it } from 'vitest';
import { cleanup, makeEmptyRepo, run, writeFiles } from './helpers/repo.js';
import { CONFIG } from '../../../test/helpers/lane.js';

const repos: string[] = [];
afterEach(() => {
  while (repos.length > 0) cleanup(repos.pop() as string);
});

/** A lane M ticket file with the given title, status and Intent line. */
const tk = (id: string, title: string, status: string, intent: string): string =>
  ['---', `id: "${id}"`, `title: "${title}"`, 'type: story', `status: ${status}`, 'lane: M', 'ui: false', '---', '', '## Intent', intent, ''].join('\n');

/** A sandbox holding seven tickets that share one to three words with "Export reports to CSV", and one that shares none. */
function sandbox(): string {
  const repo = makeEmptyRepo();
  repos.push(repo);
  writeFiles(repo, {
    'accord/config.yml': CONFIG,
    'accord/tickets/T-10.md': tk('T-10', 'Export reports to CSV with commas', 'draft', 'Quote cells.'),
    'accord/tickets/T-2.md': tk('T-2', 'Reports as CSV export', 'archived', 'Done long ago.'),
    'accord/tickets/T-4.md': tk('T-4', 'Dropped CSV export of reports', 'dropped', 'Not wanted.'),
    'accord/tickets/T-7.md': tk('T-7', 'Export csv', 'draft', 'Plain.'),
    'accord/tickets/T-6.md': tk('T-6', 'Reports export', 'open', 'Plain.'),
    'accord/tickets/T-3.md': tk('T-3', 'Export data', 'open', 'Plain.'),
    'accord/tickets/T-5.md': tk('T-5', 'Weekly summary', 'open', 'Show the reports weekly.'),
    'accord/tickets/T-8.md': tk('T-8', 'Print the page to PDF', 'open', 'To the printer.'),
  });
  return repo;
}
const listing = (repo: string): string[] => readdirSync(join(repo, 'accord', 'tickets')).sort();
const lines = (s: string): string[] => s.split('\n').filter((l) => l !== '');

it('ac-5 creating a ticket prints the similar tickets and writes nothing until they are judged (ST-LN-22 7-ac-5)', async () => {
  const repo = sandbox();
  const before = listing(repo);
  const r = await run(['new', 'ticket', 'N-1', '--lane', 'M', '--title', 'Export reports to CSV'], repo);
  expect(r.code, r.out + r.err).toBe(2);
  const similar = lines(r.out).filter((l) => l.startsWith('similar: '));
  expect(similar).toEqual([
    'similar: T-2 "Reports as CSV export" (archived)',
    'similar: T-4 "Dropped CSV export of reports" (dropped)',
    'similar: T-10 "Export reports to CSV with commas" (draft)',
    'similar: T-6 "Reports export" (open)',
    'similar: T-7 "Export csv" (draft)',
  ]);
  expect(r.err).toContain('--related');
  expect(r.err).toContain('nothing was written');
  expect(listing(repo)).toEqual(before);
  expect(existsSync(join(repo, 'accord', 'tickets', 'N-1.md'))).toBe(false);
});

it('ac-5 a title that shares no word with any ticket prints none and creates the ticket (ST-LN-22 7-ac-5)', async () => {
  const repo = sandbox();
  const r = await run(['new', 'ticket', 'N-1', '--lane', 'M', '--title', 'Zebra crossing paint'], repo);
  expect(r.code, r.err).toBe(0);
  const out = lines(r.out);
  expect(out).toContain('similar: none');
  expect(out.filter((l) => l.startsWith('similar: ') && l !== 'similar: none')).toEqual([]);
  expect(out).toContain('accord/tickets/N-1.md');
  expect(listing(repo)).toContain('N-1.md');
});
