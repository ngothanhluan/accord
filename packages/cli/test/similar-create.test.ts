// ST-LN-22 D-08: `accord new ticket --title` prints the tickets most like the request before any id is assigned or
// any file is written, and creates nothing until the session has judged them. Real files in tmp sandboxes; nothing
// here reaches the real origin. The printed lines are asserted by membership: other stages may add lines to a run.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, expect, it } from 'vitest';
import { cleanup, gitRun, makeEmptyRepo, run, writeFiles } from './helpers/repo.js';
import { makeClone, pushMain } from './helpers/worktree.js';
import type { Clone } from './helpers/worktree.js';
import { CONFIG, laneTicket } from '../../../test/helpers/lane.js';

const repos: string[] = [];
const clones: Clone[] = [];
afterEach(() => {
  while (repos.length > 0) cleanup(repos.pop() as string);
  for (const c of clones.splice(0)) c.cleanupAll();
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

const NEW = ['new', 'ticket', 'N-1', '--lane', 'M', '--title', 'Export reports to CSV'];
const draft = (repo: string, id = 'N-1'): string => readFileSync(join(repo, 'accord', 'tickets', id + '.md'), 'utf8');

it('ac-5 a judged request is created linked or unlinked (ST-LN-22 7-ac-5)', async () => {
  // linked: the ids land in `related:`, in the order given
  const repo = sandbox();
  const linked = await run([...NEW, '--related', 'T-2,T-10'], repo);
  expect(linked.code, linked.err).toBe(0);
  expect(draft(repo)).toContain('\nrelated:\n  - "T-2"\n  - "T-10"\n');

  // unlinked: no key at all
  const plain = sandbox();
  const none = await run([...NEW, '--related', 'none'], plain);
  expect(none.code, none.err).toBe(0);
  expect(draft(plain)).not.toContain('related:');

  // an id that is no ticket, or no id, is refused and nothing is written
  for (const bad of ['NOPE', 'T-2,NOPE', '../x', 'T-2,']) {
    const refused = sandbox();
    const before = listing(refused);
    const r = await run([...NEW, '--related', bad], refused);
    expect(r.code, bad).toBe(2);
    expect(r.err, bad).toContain(bad.split(',').find((id) => id !== 'T-2' && id !== '') ?? 'related');
    expect(r.err).toContain('nothing was written');
    expect(listing(refused), bad).toEqual(before);
  }
});

it('ac-5 --queue prints the candidates and pushes nothing until they are judged, from the default branch too (ST-LN-22 7-ac-5)', async () => {
  const c = makeClone({ tickets: ['ST-9'] });
  clones.push(c);
  // a ticket only origin's default branch holds, found because the queue path fetches before it looks
  pushMain(c, 'accord/tickets/D-1.md', laneTicket('D-1', { frontmatter: ['status: archived'] }));
  const queue = (id: string, ...more: string[]) => run(['new', 'ticket', id, '--queue', '--lane', 'M', '--title', 'Export reports to CSV', ...more], c.root);
  const backlog = (): string => gitRun(c.remote, 'for-each-ref', 'refs/heads/backlog');

  const first = await queue('Q-1');
  expect(first.code, first.out + first.err).toBe(2);
  expect(lines(first.out).filter((l) => l.startsWith('similar: '))).toEqual(['similar: D-1 "Export" (archived)', 'similar: ST-9 "Export" (open)']);
  expect(first.err).toContain('--related');
  expect(backlog()).toBe('');

  const unlinked = await queue('Q-1', '--related', 'none');
  expect(unlinked.code, unlinked.err).toBe(0);
  expect(backlog()).toContain('refs/heads/backlog/q-1-');

  const linked = await queue('Q-2', '--related', 'D-1');
  expect(linked.code, linked.err).toBe(0);
  const branch = backlog().split('\n').find((l) => l.includes('backlog/q-2-'))?.split(/\s+/)[2] as string;
  expect(gitRun(c.remote, 'cat-file', 'blob', branch + ':accord/tickets/Q-2.md')).toContain('\nrelated:\n  - "D-1"\n');
  expect(gitRun(c.remote, 'cat-file', 'blob', branch.replace('q-2', 'q-1') + ':accord/tickets/Q-1.md')).not.toContain('related:');
}, 180_000);

it('ac-5 the duplicate check is skipped only by an explicit flag that the output names (ST-LN-22 7-ac-5)', async () => {
  const repo = sandbox();
  const skipped = await run([...NEW, '--no-dup-check'], repo);
  expect(skipped.code, skipped.err).toBe(0);
  const out = lines(skipped.out);
  expect(out).toContain('similar: skipped (--no-dup-check)');
  expect(out.filter((l) => /^similar: [A-Z]/.test(l))).toEqual([]);
  expect(listing(repo)).toContain('N-1.md');

  const both = sandbox();
  const before = listing(both);
  const r = await run([...NEW, '--no-dup-check', '--related', 'T-2'], both);
  expect(r.code).toBe(2);
  expect(r.err).toContain('--no-dup-check');
  expect(r.err).toContain('--related');
  expect(r.err).toContain('nothing was written');
  expect(listing(both)).toEqual(before);
});

it('ac-5 a lane S or M ticket is not created without a title (ST-LN-22 7-ac-5)', async () => {
  const refusals: string[][] = [
    ['--lane', 'M'],
    ['--lane', 'S'],
    ['--type', 'bug', '--lane', 'M'],
  ];
  for (const flags of refusals) {
    const key = flags.join(' ');
    const repo = sandbox();
    const before = listing(repo);
    // refused: one line naming the rule and both remedies, and nothing written
    const r = await run(['new', 'ticket', 'N-2', ...flags], repo);
    expect(r.code, key + ' ' + r.out + r.err).toBe(2);
    const refusal = lines(r.err);
    expect(refusal, key).toHaveLength(1);
    expect(refusal[0], key).toContain('--title is required for a lane S or M ticket');
    expect(refusal[0], key).toContain('--title "<short English title>"');
    expect(refusal[0], key).toContain('--no-dup-check');
    expect(refusal[0], key).toContain(' - nothing was written');
    expect(listing(repo), key).toEqual(before);
    // the scripted escape creates it and says so
    const escaped = await run(['new', 'ticket', 'N-2', ...flags, '--no-dup-check'], repo);
    expect(escaped.code, key + ' ' + escaped.err).toBe(0);
    expect(lines(escaped.out), key).toContain('similar: skipped (--no-dup-check)');
    expect(listing(repo), key).toContain('N-2.md');
    // a title keeps the check and creates it
    const titled = sandbox();
    const ok = await run(['new', 'ticket', 'N-2', ...flags, '--title', 'Archive old invoices', '--related', 'none'], titled);
    expect(ok.code, key + ' ' + ok.err).toBe(0);
    expect(listing(titled), key).toContain('N-2.md');
  }
});

it('ac-5 a lane M ticket with --worktree and no title is refused before anything is fetched or pushed (ST-LN-22 7-ac-5)', async () => {
  const c = makeClone({ tickets: [] });
  clones.push(c);
  const branches = (): string => gitRun(c.remote, 'for-each-ref', 'refs/heads');
  const before = { remote: branches(), worktrees: c.git('worktree', 'list', '--porcelain') };
  const r = await run(['new', 'ticket', 'N-2', '--lane', 'M', '--worktree'], c.root);
  expect(r.code, r.out + r.err).toBe(2);
  const refusal = lines(r.err);
  expect(refusal).toHaveLength(1);
  expect(refusal[0]).toContain('--title is required for a lane S or M ticket');
  expect(refusal[0]).toContain('--no-dup-check');
  expect(refusal[0]).toContain(' - nothing was written');
  expect(existsSync(c.sibling('N-2'))).toBe(false);
  expect({ remote: branches(), worktrees: c.git('worktree', 'list', '--porcelain') }).toEqual(before);

  const escaped = await run(['new', 'ticket', 'N-2', '--lane', 'M', '--worktree', '--no-dup-check'], c.root);
  expect(escaped.code, escaped.err).toBe(0);
  expect(lines(escaped.out)).toContain('similar: skipped (--no-dup-check)');
  expect(existsSync(join(c.sibling('N-2'), 'accord', 'tickets', 'N-2.md'))).toBe(true);

  const titled = await run(['new', 'ticket', 'N-4', '--lane', 'M', '--worktree', '--title', 'Archive old invoices', '--related', 'none'], c.root);
  expect(titled.code, titled.err).toBe(0);
  expect(existsSync(join(c.sibling('N-4'), 'accord', 'tickets', 'N-4.md'))).toBe(true);
}, 180_000);

it('ac-5 the routes the title rule does not name still create a ticket without a title (ST-LN-22 7-ac-5)', async () => {
  for (const flags of [[], ['--lane', 'R'], ['--lane', 'L'], ['--type', 'epic', '--lane', 'P']]) {
    const repo = sandbox();
    const r = await run(['new', 'ticket', 'N-3', ...flags], repo);
    expect(r.code, flags.join(' ') + ' ' + r.err).toBe(0);
    expect(listing(repo), flags.join(' ')).toContain('N-3.md');
  }
  // an epic keeps its own lane refusal
  const epic = sandbox();
  const refused = await run(['new', 'ticket', 'N-3', '--type', 'epic', '--lane', 'M'], epic);
  expect(refused.code).toBe(2);
  expect(refused.err).toContain('an epic is lane L or P, not M');
  expect(refused.err).not.toContain('--title is required');
  // the queue route keeps its own title refusal
  const queue = sandbox();
  const q = await run(['new', 'ticket', 'N-3', '--queue', '--lane', 'M'], queue);
  expect(q.code).toBe(2);
  expect(q.err).toContain('--queue needs --title');
  expect(q.err).not.toContain('--title is required');
});
