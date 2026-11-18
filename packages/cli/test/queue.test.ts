// ST-LN-83 D-03, D-06: `accord new ticket --queue` writes a draft on a backlog branch off origin's default branch in a
// temporary worktree, so a session that works one ticket can queue an idea without touching that ticket. Real git in
// tmp sandboxes with a bare origin; nothing here reaches the real origin.
import { readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { expect, it, vi } from 'vitest';
import { gitRun, run } from './helpers/repo.js';
import { laneTicket } from '../../../test/helpers/lane.js';
import { A, copy, envOf, pushMain, setTable, tableOf, useSandboxes } from './helpers/worktree.js';

vi.mock('../src/load/proc.js', async (orig) => {
  const real = await orig<typeof import('../src/load/proc.js')>();
  return { ...real, processTable: vi.fn(real.processTable) };
});
vi.mock('../src/commands/fetch-limit.js', async (orig) => {
  const real = await orig<typeof import('../src/commands/fetch-limit.js')>();
  return { ...real, fetchLimitMs: vi.fn(real.fetchLimitMs) };
});

useSandboxes([{ tickets: ['ST-9', 'ST-10'] }]);

const today = (): string => new Date().toISOString().slice(0, 10);
const tempFolders = (): string[] => readdirSync(tmpdir()).filter((n) => n.startsWith('accord-queue-')).sort();
const lines = (s: string): string[] => s.split('\n').filter((l) => l !== '');

/** The section of `text` between the heading `from` and the heading `to`, the heading lines left out. */
const between = (text: string, from: string, to: string): string => text.slice(text.indexOf(from) + from.length, text.indexOf(to));

it('ac-4 queue writes a draft on a backlog branch and leaves the session ticket untouched (ST-LN-83 7-ac-4)', async () => {
  const c = copy({ tickets: ['ST-9', 'ST-10'] });
  setTable(tableOf(A));
  expect((await run(['worktree', 'open', 'ST-9'], c.root, envOf(A))).code).toBe(0);
  const sib = c.sibling('ST-9');
  const state = (): string[] => [
    gitRun(sib, 'rev-parse', 'HEAD'),
    gitRun(sib, 'branch', '--show-current'),
    gitRun(sib, 'status', '--porcelain', '--untracked-files=all'),
    gitRun(sib, 'worktree', 'list', '--porcelain'),
    gitRun(c.root, 'worktree', 'list', '--porcelain'),
  ];
  const before = state();
  const folders = tempFolders();
  const first = today();

  const r = await run(
    ['new', 'ticket', 'Q-1', '--queue', '--lane', 'M', '--title', 'Note the idea', '--note', "the owner's idea in one line"],
    sib,
    envOf(A),
  );
  expect(r.code, r.err).toBe(0);
  const out = lines(r.out);
  const branchLine = out.find((l) => l.startsWith('branch: '));
  const m = /^branch: backlog\/q-1-(\d{4}-\d{2}-\d{2})$/.exec(branchLine ?? '');
  expect(m, r.out).not.toBeNull();
  const branch = 'backlog/q-1-' + m![1];
  expect([first, today()]).toContain(m![1]);
  expect(out).toContain('base: main');
  expect(out).toContain('title: backlog: queue Q-1');
  expect(out).toContain('merge: owner');

  // origin: exactly one commit over main, which adds only the draft
  const tip = gitRun(c.remote, 'rev-parse', 'refs/heads/' + branch).trim();
  expect(gitRun(c.remote, 'rev-list', '--count', 'main..' + tip).trim()).toBe('1');
  expect(gitRun(c.remote, 'rev-list', '--parents', '-n', '1', tip).trim().split(' ')).toEqual([tip, gitRun(c.remote, 'rev-parse', 'main').trim()]);
  expect(gitRun(c.remote, 'diff', '--name-only', 'main', tip)).toBe('accord/tickets/Q-1.md\n');
  expect(gitRun(c.remote, 'log', '-1', '--format=%s', tip).trim()).toBe('backlog: queue Q-1');
  const draft = gitRun(c.remote, 'cat-file', 'blob', tip + ':accord/tickets/Q-1.md');
  expect(draft).toContain('\ntitle: "Note the idea"');
  expect(draft).toContain('\nstatus: draft');
  expect(draft).toContain('\nlane: "M"');
  const intent = between(draft, '## Intent\n', '## Acceptance criteria').split('\n').filter((l) => !l.startsWith('<!--'));
  expect(lines(intent.join('\n'))).toEqual([
    `Queued ${m![1]}, not approved; the intent interview replaces this:`,
    "- the owner's idea in one line",
  ]);

  // the session's own ticket: same HEAD, branch, status and worktree list; no temporary folder is left
  expect(state()).toEqual(before);
  expect(tempFolders()).toEqual(folders);
  expect(gitRun(c.root, 'for-each-ref', 'refs/heads/backlog')).toBe('');

  // the plain path from the same session is still refused
  const plain = await run(['new', 'ticket', 'Q-2', '--lane', 'M'], sib, envOf(A));
  expect(plain.code).toBe(2);
  expect(plain.err.startsWith('this session works')).toBe(true);
  expect(state()).toEqual(before);
}, 180_000);

it('ac-4 queue refuses an existing backlog branch and pushes nothing (ST-LN-83 7-ac-4)', async () => {
  const c = copy({ tickets: ['ST-9', 'ST-10'] });
  const d = today();
  const refs = (): string => gitRun(c.remote, 'for-each-ref', '--format=%(refname) %(objectname)');
  const queue = (...more: string[]) => run(['new', 'ticket', ...more], c.root);
  const none = (what: string): void => {
    expect(gitRun(c.root, 'status', '--porcelain', '--untracked-files=all'), what).toBe('');
    expect(gitRun(c.root, 'for-each-ref', '--format=%(refname)', 'refs/heads/backlog'), what).toBe('');
    expect(refs(), what).toBe(pushed);
  };

  // the branch is already on origin
  c.git('push', '-q', 'origin', 'main:refs/heads/backlog/q-1-' + d);
  let pushed = refs();
  const taken = await queue('Q-1', '--queue', '--lane', 'M', '--title', 'Note the idea', '--note', 'an idea');
  expect([taken.code, taken.err]).toEqual([2, expect.stringContaining('backlog/q-1-' + d)]);
  expect(taken.err).toContain('nothing was created');
  expect(refs()).toBe(pushed);
  expect(gitRun(c.root, 'status', '--porcelain', '--untracked-files=all')).toBe('');

  // the branch is already here
  c.git('branch', 'backlog/q-3-' + d);
  const local = await queue('Q-3', '--queue', '--lane', 'M', '--title', 'Note the idea', '--note', 'an idea');
  expect([local.code, local.err]).toEqual([2, expect.stringContaining('backlog/q-3-' + d)]);
  expect(refs()).toBe(pushed);

  // the default branch already holds the ticket, which this clone has not fetched
  pushMain(c, 'accord/tickets/Q-5.md', laneTicket('Q-5'));
  pushed = refs();
  const held = await queue('Q-5', '--queue', '--lane', 'M', '--title', 'Note the idea', '--note', 'an idea');
  expect([held.code, held.err]).toEqual([2, expect.stringContaining('accord/tickets/Q-5.md already exists')]);
  expect(refs()).toBe(pushed);

  // a bad flag is refused before anything is read, written or pushed
  c.git('branch', '-q', '-D', 'backlog/q-3-' + d);
  const four = ['--note', 'a', '--note', 'b', '--note', 'c', '--note', 'd'];
  const bad: [string, string[], string][] = [
    ['--queue with --worktree', ['Q-6', '--queue', '--worktree', '--lane', 'M', '--title', 'Note the idea'], '--worktree'],
    ['--queue without --title', ['Q-6', '--queue', '--lane', 'M', '--note', 'a'], '--title'],
    ['a fifth --note', ['Q-6', '--queue', '--lane', 'M', '--title', 'Note the idea', ...four, '--note', 'e'], 'four'],
    ['--note without --queue', ['Q-6', '--lane', 'M', '--title', 'Note the idea', '--note', 'a'], '--queue'],
    ['a --note with a line break', ['Q-6', '--queue', '--lane', 'M', '--title', 'Note the idea', '--note', 'a\nb'], 'one line'],
    ['--queue on a lane S template', ['Q-6', '--queue', '--lane', 'S', '--title', 'Note the idea'], '## Intent'],
  ];
  for (const [what, argv, word] of bad) {
    const r = await queue(...argv);
    expect([what, r.code, r.err.includes(word) && r.err.includes('nothing was written')], what + ': ' + r.err).toEqual([what, 2, true]);
    none(what);
  }
}, 180_000);

it('ac-4 queue merge follows config (ST-LN-83 7-ac-4)', async () => {
  const c = copy({ tickets: ['ST-9', 'ST-10'] });
  const queue = (id: string) => run(['new', 'ticket', id, '--queue', '--lane', 'M', '--title', 'Note the idea', '--note', 'an idea'], c.root);
  const mergeLine = (out: string): string | undefined => lines(out).find((l) => l.startsWith('merge: '));

  // shipped default: the key is absent, the skill leaves the pull request to a person
  const first = await queue('Q-1');
  expect(first.code, first.err).toBe(0);
  expect(mergeLine(first.out)).toBe('merge: owner');

  // accord config set writes the key, and the queue path prints it
  const set = await run(['config', 'set', 'queue.merge', 'at-once'], c.root);
  expect(set.code, set.err).toBe(0);
  const second = await queue('Q-2');
  expect(second.code, second.err).toBe(0);
  expect(mergeLine(second.out)).toBe('merge: at-once');

  // a refused value leaves the last good key in place
  expect((await run(['config', 'set', 'queue.merge', 'sometimes'], c.root)).code).toBe(2);
  const third = await queue('Q-3');
  expect(third.code, third.err).toBe(0);
  expect(mergeLine(third.out)).toBe('merge: at-once');
}, 180_000);
