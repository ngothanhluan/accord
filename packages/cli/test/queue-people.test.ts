// G-07-2 (A-1, A-2): `accord new ticket --queue` commits the creator's people entry with the draft when origin's default branch does not
// list it, and every form of `new ticket` reads the initials from the default branch or from fetched branches that agree. Real git in tmp
// sandboxes with a bare origin; nothing here reaches the real origin.
import { existsSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, it, vi } from 'vitest';
import { gitRun, commitMsg, run, writeFiles } from './helpers/repo.js';
import { A, copy, envOf, setTable, tableOf, useSandboxes } from './helpers/worktree.js';
import type { Clone } from './helpers/worktree.js';
import { CONFIG } from '../../../test/helpers/lane.js';

vi.mock('../src/load/proc.js', async (orig) => {
  const real = await orig<typeof import('../src/load/proc.js')>();
  return { ...real, processTable: vi.fn(real.processTable) };
});
vi.mock('../src/commands/fetch-limit.js', async (orig) => {
  const real = await orig<typeof import('../src/commands/fetch-limit.js')>();
  return { ...real, fetchLimitMs: vi.fn(real.fetchLimitMs) };
});

useSandboxes([{ tickets: ['ST-9', 'ST-10'] }]);

const NEW = 'new@example.invalid';
const NEW_LINE = `  "${NEW}": NW\n`;
const LEGACY = 'legacy_ids: [ST-9, ST-10]\n';
const TEAM = CONFIG + 'people:\n  "fixture@example.invalid": FX\n' + LEGACY;
const TEAM_NW = CONFIG + 'people:\n  "fixture@example.invalid": FX\n' + NEW_LINE + LEGACY;
const TEAM_NW_ALONE = CONFIG + 'people:\n' + NEW_LINE + LEGACY;
const today = (): string => new Date().toISOString().slice(0, 10);
const lines = (s: string): string[] => s.split('\n').filter((l) => l !== '');
const QUEUE = ['new', 'ticket', '--type', 'story', '--lane', 'M', '--queue', '--related', 'none'];

/** A clone whose default branch gives ids to the fixture person; the session person is the new one, not listed anywhere yet. */
function teamClone(): Clone {
  const c = copy({ tickets: ['ST-9', 'ST-10'] });
  writeFiles(c.root, { 'accord/config.yml': TEAM });
  commitMsg(c.root, 'team people');
  c.git('push', '-q', 'origin', 'main');
  c.git('config', 'user.email', NEW);
  return c;
}

/** `text` as accord/config.yml on `branch` of origin, pushed from another clone, which is left on main. */
function pushConfig(c: Clone, branch: string, text: string): void {
  const o = c.otherClone();
  if (branch !== 'main') gitRun(o, 'switch', '-q', '-c', branch);
  writeFiles(o, { 'accord/config.yml': text });
  commitMsg(o, 'config on ' + branch);
  gitRun(o, 'push', '-q', 'origin', branch);
}

it('risk:data-loss 7-ac-4 G-07-2 a queue from a fresh checkout commits the new person entry with the draft', async () => {
  const c = teamClone();
  const first = today();
  // the entry sits in the main checkout, never committed
  writeFiles(c.root, { 'accord/config.yml': TEAM_NW });
  const before = [c.git('rev-parse', 'HEAD'), c.git('status', '--porcelain', '--untracked-files=all')];

  const r = await run([...QUEUE, '--title', 'Note the first idea', '--note', 'the first idea in one line'], c.root);
  expect(r.code, r.err).toBe(0);
  const out = lines(r.out);
  const m = /^branch: backlog\/st-nw-1-(\d{4}-\d{2}-\d{2})$/.exec(out.find((l) => l.startsWith('branch: ')) ?? '');
  expect(m, r.out).not.toBeNull();
  expect([first, today()]).toContain(m![1]);
  const tip = gitRun(c.remote, 'rev-parse', 'refs/heads/backlog/st-nw-1-' + m![1]).trim();

  // one commit over main: the ticket and config.yml, whose only change is the added line
  expect(gitRun(c.remote, 'rev-list', '--count', 'main..' + tip).trim()).toBe('1');
  expect(gitRun(c.remote, 'diff', '--name-only', 'main', tip)).toBe('accord/config.yml\naccord/tickets/ST-NW-1.md\n');
  const changed = gitRun(c.remote, 'diff', '-U0', 'main', tip, '--', 'accord/config.yml').split('\n').filter((l) => /^[+-]/.test(l) && !/^(\+\+\+|---)/.test(l));
  expect(changed).toEqual(['+' + NEW_LINE.trimEnd()]);
  expect(out).toContain(
    `people: "${NEW}": NW - committed with the draft; remove this entry, and only it, from accord/config.yml here, leaving every other line as it is`,
  );

  // this checkout: the run changed nothing
  expect([c.git('rev-parse', 'HEAD'), c.git('status', '--porcelain', '--untracked-files=all')]).toEqual(before);
}, 240_000);

it('risk:data-loss 7-ac-4 G-07-2 a ticket session whose config lacks the person queues and stays byte for byte as it was', async () => {
  const c = teamClone();
  setTable(tableOf(A));
  expect((await run(['worktree', 'open', 'ST-9'], c.root, envOf(A))).code).toBe(0);
  const sib = c.sibling('ST-9');
  const state = (): string[] => [
    gitRun(sib, 'rev-parse', 'HEAD'),
    gitRun(sib, 'branch', '--show-current'),
    gitRun(sib, 'status', '--porcelain', '--untracked-files=all'),
    gitRun(sib, 'worktree', 'list', '--porcelain'),
    c.git('worktree', 'list', '--porcelain'),
  ];

  // a first run from the main checkout leaves a backlog branch that lists the person
  writeFiles(c.root, { 'accord/config.yml': TEAM_NW });
  const one = await run([...QUEUE, '--title', 'Note the first idea', '--note', 'the first idea in one line'], c.root);
  expect(one.code, one.err).toBe(0);
  writeFiles(c.root, { 'accord/config.yml': TEAM });

  // the ticket session: its own config has no entry; a fetched backlog branch does
  const before = state();
  const r = await run([...QUEUE, '--title', 'Export the weekly report', '--note', 'the second idea'], sib, envOf(A));
  expect(r.code, r.err).toBe(0);
  const out = lines(r.out);
  const m = /^branch: backlog\/st-nw-2-(\d{4}-\d{2}-\d{2})$/.exec(out.find((l) => l.startsWith('branch: ')) ?? '');
  expect(m, r.out).not.toBeNull();
  const tip = gitRun(c.remote, 'rev-parse', 'refs/heads/backlog/st-nw-2-' + m![1]).trim();
  expect(gitRun(c.remote, 'diff', '--name-only', 'main', tip)).toBe('accord/config.yml\naccord/tickets/ST-NW-2.md\n');
  const changed = gitRun(c.remote, 'diff', '-U0', 'main', tip, '--', 'accord/config.yml').split('\n').filter((l) => /^[+-]/.test(l) && !/^(\+\+\+|---)/.test(l));
  expect(changed).toEqual(['+' + NEW_LINE.trimEnd()]);
  expect(out).toContain(`people: "${NEW}": NW - committed with the draft`);
  expect(r.out).not.toContain('remove this entry');
  expect(state()).toEqual(before);
}, 240_000);

it('risk:complex-branching 7-ac-4 G-07-2 a second person cannot queue initials that a pushed backlog branch holds', async () => {
  const c = teamClone();
  writeFiles(c.root, { 'accord/config.yml': TEAM_NW });
  const one = await run([...QUEUE, '--title', 'Note the first idea', '--note', 'the first idea in one line'], c.root);
  expect(one.code, one.err).toBe(0);

  const o = c.otherClone();
  gitRun(o, 'config', 'user.email', 'other@example.invalid');
  writeFiles(o, { 'accord/config.yml': CONFIG + 'people:\n  "fixture@example.invalid": FX\n  "other@example.invalid": NW\n' + LEGACY });
  const refs = (): string => gitRun(c.remote, 'for-each-ref', '--format=%(refname) %(objectname)');
  const pushed = refs();
  const r = await run([...QUEUE, '--title', 'Another idea entirely', '--note', 'a note'], o);
  expect(r.code).toBe(2);
  expect(r.err).toContain(`initials NW already belong to ${NEW} on another branch`);
  expect(refs()).toBe(pushed);
}, 240_000);

it('risk:complex-branching 7-ac-4 G-07-2 an entry already on the default branch is not committed again and prints no people line', async () => {
  const c = teamClone();
  setTable(tableOf(A));
  expect((await run(['worktree', 'open', 'ST-9'], c.root, envOf(A))).code).toBe(0);
  const sib = c.sibling('ST-9');
  pushConfig(c, 'main', TEAM_NW);
  const before = [gitRun(sib, 'rev-parse', 'HEAD'), gitRun(sib, 'status', '--porcelain', '--untracked-files=all')];

  const r = await run([...QUEUE, '--title', 'Note the first idea', '--note', 'the first idea in one line'], sib, envOf(A));
  expect(r.code, r.err).toBe(0);
  const m = /^branch: backlog\/st-nw-1-(\d{4}-\d{2}-\d{2})$/m.exec(r.out);
  expect(m, r.out).not.toBeNull();
  const tip = gitRun(c.remote, 'rev-parse', 'refs/heads/backlog/st-nw-1-' + m![1]).trim();
  expect(gitRun(c.remote, 'diff', '--name-only', 'main', tip)).toBe('accord/tickets/ST-NW-1.md\n');
  expect(lines(r.out).filter((l) => l.startsWith('people:'))).toEqual([]);
  expect([gitRun(sib, 'rev-parse', 'HEAD'), gitRun(sib, 'status', '--porcelain', '--untracked-files=all')]).toEqual(before);

  // a plain run from the main checkout, which lacks the entry, takes the initials from the default branch and the next number
  c.git('fetch', '-q', 'origin');
  const plain = await run(['new', 'ticket', '--type', 'story'], c.root);
  expect(plain.code, plain.err).toBe(0);
  expect(plain.out.trim()).toBe('accord/tickets/ST-NW-2.md');
}, 240_000);

it('risk:data-loss 7-ac-4 G-07-2 Ruling: a default branch with no people key gets no entry and the output says so', async () => {
  const c = copy({ tickets: ['ST-9', 'ST-10'] });
  c.git('config', 'user.email', NEW);
  // the working tree gives ids, the default branch holds no people mapping at all
  writeFiles(c.root, { 'accord/config.yml': TEAM_NW_ALONE });

  const r = await run([...QUEUE, '--title', 'Note the first idea', '--note', 'the first idea in one line'], c.root);
  expect(r.code, r.err).toBe(0);
  const m = /^branch: backlog\/st-nw-1-(\d{4}-\d{2}-\d{2})$/m.exec(r.out);
  expect(m, r.out).not.toBeNull();
  const tip = gitRun(c.remote, 'rev-parse', 'refs/heads/backlog/st-nw-1-' + m![1]).trim();
  expect(gitRun(c.remote, 'diff', '--name-only', 'main', tip)).toBe('accord/tickets/ST-NW-1.md\n');
  expect(lines(r.out)).toContain("people: no entry committed - origin's default branch has no people mapping, and the queue never creates one");
  expect(lines(r.out).filter((l) => l.startsWith('people:') && l.includes('committed with the draft'))).toEqual([]);
}, 240_000);

it('risk:security 7-ac-4 G-07-2 new ticket skips an unreadable or invalid entry and refuses branches that disagree', async () => {
  const c = teamClone();
  const plain = (): ReturnType<typeof run> => run(['new', 'ticket', '--type', 'story'], c.root);
  const none = (what: string): void => {
    expect(existsSync(join(c.root, 'accord', 'tickets', 'ST-NW-1.md')), what).toBe(false);
    expect(c.git('status', '--porcelain', '--untracked-files=all'), what).toBe('');
  };

  // side-c holds lowercase initials and side-d a config.yml that does not parse: neither lists the person
  pushConfig(c, 'side-c', TEAM.replace('FX\n', 'FX\n  "' + NEW + '": nw\n'));
  pushConfig(c, 'side-d', 'people: [\n  bad\n');
  c.git('fetch', '-q', 'origin');
  const bad = await plain();
  expect(bad.code).toBe(2);
  expect(bad.err).toContain(`${NEW} is not registered`);
  none('invalid entries');

  // two branches give different initials, none of them the default branch
  pushConfig(c, 'side-a', TEAM.replace('FX\n', 'FX\n' + NEW_LINE));
  pushConfig(c, 'side-b', TEAM.replace('FX\n', 'FX\n  "' + NEW + '": NX\n'));
  c.git('fetch', '-q', 'origin');
  const split = await plain();
  expect(split.code).toBe(2);
  for (const word of ['origin/side-a', 'origin/side-b', 'NW', 'NX']) expect(split.err).toContain(word);
  none('disagreeing branches');

  // the default branch settles it
  pushConfig(c, 'main', TEAM_NW);
  c.git('fetch', '-q', 'origin');
  const ok = await plain();
  expect(ok.code, ok.err).toBe(0);
  expect(ok.out.trim()).toBe('accord/tickets/ST-NW-1.md');
}, 240_000);

it('risk:complex-branching 7-ac-4 G-07-2 a checkout whose config has no people key reads the initials from the default branch', async () => {
  const c = copy({ tickets: ['ST-9', 'ST-10'] });
  c.git('config', 'user.email', NEW);
  // this checkout turns the id convention on and lists nobody; origin's default branch lists the person
  const ids = 'ids:\n  pattern: "{type}-{initials}-{n}"\n' + LEGACY;
  pushConfig(c, 'main', CONFIG + ids + 'people:\n' + NEW_LINE);
  writeFileSync(join(c.root, 'accord', 'config.yml'), CONFIG + ids);
  c.git('fetch', '-q', 'origin');

  const r = await run(['new', 'ticket', '--type', 'story'], c.root);
  expect(r.code, r.err).toBe(0);
  expect(r.out.trim()).toBe('accord/tickets/ST-NW-1.md');
}, 180_000);
