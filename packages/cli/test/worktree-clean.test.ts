// ST-LN-7, ST-LN-20, ST-LN-34, ST-LN-55: `accord worktree clean` of merged, pruned and dropped tickets, and the session-start hook that runs it, against real git in tmp sandboxes with a bare remote.
// Phase 08.9 D-07: the clean tests that done tickets name by `@test:` (the `ac-N` tests of ST-LN-7, ST-LN-20, ST-LN-34 and ST-LN-55); the other clean tests live in worktree-clean-records, -dropped, -merged, -removal and -squash.
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { afterEach, expect, it, vi } from 'vitest';
import * as limit from '../src/commands/fetch-limit.js';
import * as proc from '../src/load/proc.js';
import { laneTicket } from '../../../test/helpers/lane.js';
import { ALIVE, exclude, forget, gone, link, listing, recorded, startInput } from './helpers/done.js';
import { spawnLog } from './helpers/git-spawns.js';
import { commitMsg, gitRun, run, writeFiles } from './helpers/repo.js';
import { claimWorktree, copy, DEAD, doneOnRemote, dropAndMerge, dropOnRemote, has, lines, LIVE, readHolds, sha, ticketBranches, ticketWorktree, useSandboxes, withAction, writeHolds } from './helpers/worktree.js';

vi.mock('../src/load/proc.js', async (orig) => {
  const real = await orig<typeof import('../src/load/proc.js')>();
  return { ...real, processTable: vi.fn(real.processTable) };
});
vi.mock('../src/commands/fetch-limit.js', async (orig) => {
  const real = await orig<typeof import('../src/commands/fetch-limit.js')>();
  return { ...real, fetchLimitMs: vi.fn(real.fetchLimitMs), cleanBudgetMs: vi.fn(real.cleanBudgetMs) };
});
vi.mock('node:child_process', async (orig) => (await import('./helpers/git-spawns.js')).wrapChildProcess(await orig<typeof import('node:child_process')>()));

afterEach(() => {
  vi.mocked(limit.cleanBudgetMs).mockReset();
  spawnLog.on = false;
  spawnLog.after = undefined;
  spawnLog.fail = undefined;
  spawnLog.calls = [];
});

useSandboxes([
  {},
  { tickets: ['ST-9', 'ST-10'] },
  { tickets: ['ST-9', 'ST-10', 'ST-11'] },
  { tickets: ['ST-9', 'ST-10', 'ST-11', 'ST-12'] },
]);

it('ac-5 bare accord fetches then removes merged worktrees and names what it keeps', async () => {
  const c = copy({ tickets: ['ST-9', 'ST-10', 'ST-11', 'ST-12'] });
  for (const id of ['ST-9', 'ST-10', 'ST-11', 'ST-12']) ticketWorktree(c, id);
  const t = doneOnRemote(c, ['ST-9', 'ST-10', 'ST-12']);
  mkdirSync(`${c.sibling('ST-9')}/node_modules`);
  writeFileSync(`${c.sibling('ST-9')}/node_modules/x`, 'x');
  writeFileSync(`${c.sibling('ST-10')}/new.txt`, 'new');
  writeHolds(c, { 'ST-9': DEAD, 'ST-12': LIVE });
  vi.mocked(proc.processTable).mockReturnValue([
    { pid: process.pid, ppid: 1, start: 'self' },
    { pid: 4242, ppid: 1, start: 'S2' },
  ]);
  const before = c.git('rev-parse', 'origin/main').trim();
  const sha9 = sha(c, 't/ST-9');
  const { code, out } = await run(['worktree', 'clean'], c.root, {});
  expect(code).toBe(0);
  expect(c.git('rev-parse', 'origin/main').trim()).not.toBe(before);
  expect(c.git('rev-parse', 'origin/main').trim()).toBe(gitRun(c.remote, 'rev-parse', 'main').trim());
  expect(existsSync(c.sibling('ST-9'))).toBe(false);
  expect(lines(out).sort()).toEqual(
    [
      withAction(`removed ${c.sibling('ST-9')}`),
      withAction(`kept ${c.sibling('ST-10')}: uncommitted work`),
      withAction(`kept ${c.sibling('ST-12')}: held by another session`),
      withAction(`deleted t/ST-9 (was ${sha9})`),
      withAction(`deleted origin/t/ST-9 (was ${t['ST-9']})`),
      withAction(`kept t/ST-10: checked out in ${c.sibling('ST-10')}`),
      withAction(`kept t/ST-12: checked out in ${c.sibling('ST-12')}`),
    ].sort(),
  );
  expect(existsSync(`${c.sibling('ST-10')}/new.txt`)).toBe(true);
  expect(existsSync(c.sibling('ST-11'))).toBe(true);
  expect(out).not.toContain(c.sibling('ST-11'));
  expect(Object.keys(readHolds(c))).toEqual(['ST-12']);
});

it('ac-1 bare accord deletes merged ticket branches with or without a worktree and names the checked out one it keeps', async () => {
  const c = copy({ tickets: ['ST-9', 'ST-10', 'ST-11', 'ST-12'] });
  ticketBranches(c, ['ST-9', 'ST-11', 'ST-12']);
  ticketWorktree(c, 'ST-10');
  const t = doneOnRemote(c, ['ST-9', 'ST-10', 'ST-12']);
  c.git('switch', '-q', 't/ST-12');
  const sha9 = sha(c, 't/ST-9');
  const sha10 = sha(c, 't/ST-10');
  const { code, out } = await run(['worktree', 'clean'], c.root, {});
  expect(code).toBe(0);
  expect(lines(out).sort()).toEqual(
    [
      withAction(`removed ${c.sibling('ST-10')}`),
      withAction(`deleted t/ST-9 (was ${sha9})`),
      withAction(`deleted origin/t/ST-9 (was ${t['ST-9']})`),
      withAction(`deleted t/ST-10 (was ${sha10})`),
      withAction(`deleted origin/t/ST-10 (was ${t['ST-10']})`),
      withAction(`kept t/ST-12: checked out in ${c.root}`),
    ].sort(),
  );
  expect(() => c.git('rev-parse', '--verify', '-q', 'refs/heads/t/ST-9')).toThrow();
  expect(() => c.git('rev-parse', '--verify', '-q', 'refs/heads/t/ST-10')).toThrow();
  expect(sha(c, 't/ST-11')).not.toBe('');
  expect(sha(c, 't/ST-12')).not.toBe('');
  expect(out).not.toContain('t/ST-11');
  expect(c.git('branch', '--show-current').trim()).toBe('t/ST-12');
});

it('ac-3 clean deletes the worktree and both branches of a ticket dropped on the default branch', async () => {
  const c = copy();
  const S = claimWorktree(c, 'ST-10', { 'accord/tickets/ST-10.md': laneTicket('ST-10'), 'src/a.ts': 'a\n' });
  await dropAndMerge(c, 'ST-10');
  const r = await run(['worktree', 'clean'], c.root);
  expect(r.code).toBe(0);
  expect(lines(r.out)).toEqual([withAction(`removed ${c.sibling('ST-10')}`), withAction(`deleted origin/t/ST-10 (was ${S})`), withAction(`deleted t/ST-10 (was ${S})`)]);
  expect(existsSync(c.sibling('ST-10'))).toBe(false);
  expect(has(c.root, 'refs/heads/t/ST-10')).toBe(false);
  expect(has(c.remote, 'refs/heads/t/ST-10')).toBe(false);
  expect(has(c.remote, 'refs/heads/drop/ST-10')).toBe(true);
}, 120_000);

it('ac-4 clean keeps a dropped ticket whose local branch has commits not on origin', async () => {
  const c = copy();
  const S = claimWorktree(c, 'ST-10', { 'accord/tickets/ST-10.md': laneTicket('ST-10'), 'src/a.ts': 'a\n' });
  writeFiles(c.sibling('ST-10'), { 'more.txt': 'more\n' });
  const L = commitMsg(c.sibling('ST-10'), 'unpushed');
  // H3: the drop lands on the remote main by git; the drop command and its exit 0 are checked by the ac-3 test above and by #32.
  dropOnRemote(c, ['ST-10']);
  const r = await run(['worktree', 'clean'], c.root);
  expect(r.code).toBe(0);
  expect(lines(r.out)).toEqual([withAction('kept t/ST-10: 1 commits not on origin')]);
  expect(existsSync(c.sibling('ST-10'))).toBe(true);
  expect(sha(c, 't/ST-10')).toBe(L);
  expect(gitRun(c.remote, 'rev-parse', 't/ST-10').trim()).toBe(S);
}, 120_000);

it('ac-2 a session start resume or clear cleans a done ticket worktree and branches and keeps one a live session holds', async () => {
  for (const [event, source] of [
    ['session-start', 'startup'],
    ['session-resume', 'resume'],
    ['session-resume', 'clear'],
  ]) {
    const c = copy({ tickets: ['ST-9', 'ST-10'] });
    claimWorktree(c, 'ST-9');
    claimWorktree(c, 'ST-10');
    doneOnRemote(c, ['ST-9', 'ST-10']);
    writeHolds(c, { 'ST-9': { ...DEAD, folder: c.sibling('ST-9') }, 'ST-10': { ...LIVE, folder: c.sibling('ST-10') } });
    vi.mocked(proc.processTable).mockReturnValue(ALIVE);
    const r = await run(['hook', event], c.root, {}, startInput(c, source));
    expect(r.code).toBe(0);
    expect(r.out.startsWith('# accord rules\n')).toBe(true);
    expect(gone(c.sibling('ST-9'))).toBe(true);
    expect(has(c.root, 'refs/heads/t/ST-9')).toBe(false);
    expect(has(c.remote, 'refs/heads/t/ST-9')).toBe(false);
    expect(Object.keys(readHolds(c))).not.toContain('ST-9');
    const L = lines(r.out);
    const removed = L.indexOf(withAction(`removed ${c.sibling('ST-9')}`));
    expect(removed).toBeGreaterThan(-1);
    expect(L).toContain(withAction(`kept ${c.sibling('ST-10')}: held by another session`));
    expect(L.indexOf('tell the owner the lines above')).toBeGreaterThan(removed);
    expect(existsSync(c.sibling('ST-10'))).toBe(true);
    expect(c.git('worktree', 'list', '--porcelain')).toContain(`worktree ${c.sibling('ST-10')}\n`);
  }
}, 300_000);

it('ac-1 clean removes a done ticket worktree completely and keeps and names one holding an ignored env file', async () => {
  const c = copy({ tickets: ['ST-9', 'ST-10'] });
  exclude(c, ['dist/', '.DS_Store', 'Thumbs.db', '.env']);
  for (const id of ['ST-9', 'ST-10']) {
    claimWorktree(c, id);
    const s = c.sibling(id);
    link(`${s}/accord`, `${s}/node_modules/@x/ws`);
    writeFiles(s, { 'node_modules/.bin/tool.cmd': 'x', 'dist/index.js': 'x', 'sub/.DS_Store': 'x', 'Thumbs.db': 'x' });
  }
  writeFiles(c.sibling('ST-10'), { '.env': 'SECRET=1\n' });
  const before = listing(c.sibling('ST-10'));
  doneOnRemote(c, ['ST-9', 'ST-10']);
  const r = await run(['worktree', 'clean'], c.root);
  expect(r.code).toBe(0);
  expect(gone(c.sibling('ST-9'))).toBe(true);
  const L = lines(r.out);
  expect(L).toContain(withAction(`removed ${c.sibling('ST-9')}`));
  expect(c.git('worktree', 'list', '--porcelain')).toContain(`worktree ${c.sibling('ST-10')}\n`);
  expect(listing(c.sibling('ST-10'))).toEqual(before);
  expect(L).toContain(withAction(`kept ${c.sibling('ST-10')}: .env`));
  expect(L.some((l) => l.startsWith(`removed ${c.sibling('ST-10')}`))).toBe(false);
}, 120_000);

it('ac-3 a session start in a worktree and a clear in the main checkout delete the recorded folder of a done ticket that git forgot', async () => {
  const c = copy({ tickets: ['ST-9', 'ST-10', 'ST-11'] });
  for (const id of ['ST-9', 'ST-10', 'ST-11']) expect((await run(['worktree', 'open', id], c.root)).code).toBe(0);
  expect(recorded(c)).toEqual(['ST-9', 'ST-10', 'ST-11'].map((id) => ({ id, path: c.sibling(id) })));
  vi.mocked(proc.processTable).mockReturnValue(ALIVE);
  forget(c, 'ST-9');
  mkdirSync(`${c.sibling('ST-9')}/a/b`, { recursive: true });
  link(`${c.root}/accord`, `${c.sibling('ST-9')}/node_modules/outside`);
  doneOnRemote(c, ['ST-9']);
  const w = c.sibling('ST-10');
  const a = await run(['hook', 'session-start'], w, {}, JSON.stringify({ session_id: 'sess-W', cwd: w, source: 'startup' }));
  expect(a.code).toBe(0);
  expect(gone(c.sibling('ST-9'))).toBe(true);
  expect(lines(a.out)).toContain(withAction(`removed ${c.sibling('ST-9')}`));
  expect(existsSync(`${c.root}/accord/config.yml`)).toBe(true);
  expect(recorded(c).map((e) => e.path)).not.toContain(c.sibling('ST-9'));
  expect(recorded(c).map((e) => e.path)).toContain(c.sibling('ST-10'));
  forget(c, 'ST-11');
  mkdirSync(`${c.sibling('ST-11')}/a/b`, { recursive: true });
  doneOnRemote(c, ['ST-11']);
  const b = await run(['hook', 'session-resume'], c.root, {}, JSON.stringify({ session_id: 'sess-M', cwd: c.root, source: 'clear' }));
  expect(b.code).toBe(0);
  expect(gone(c.sibling('ST-11'))).toBe(true);
  expect(recorded(c).map((e) => e.path)).not.toContain(c.sibling('ST-11'));
}, 120_000);
