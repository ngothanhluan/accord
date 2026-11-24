// Phase 08.9 D-07, split from worktree-clean.test.ts: dropped tickets, their research records and the rebase guard of `accord worktree clean` (ST-LN-34).
import { chmodSync, existsSync, writeFileSync } from 'node:fs';
import { afterEach, expect, it, vi } from 'vitest';
import * as limit from '../src/commands/fetch-limit.js';
import * as proc from '../src/load/proc.js';
import { laneTicket } from '../../../test/helpers/lane.js';
import { spawnLog } from './helpers/git-spawns.js';
import { commitMsg, gitRun, run, writeFiles } from './helpers/repo.js';
import { claimWorktree, clone, copy, dropAndMerge, dropOnRemote, has, lines, LIVE, sha, useSandboxes, withAction, writeHolds } from './helpers/worktree.js';

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
  { tickets: ['ST-9', 'ST-10', 'ST-11'] },
  { tickets: ['ST-9', 'ST-10', 'ST-11', 'ST-12'] },
]);

it('risk:data-loss clean keeps a dropped ticket whose origin branch has commits not here or has diverged', async () => {
  const c = copy();
  claimWorktree(c, 'ST-9');
  const o = c.otherClone();
  gitRun(o, 'switch', '-q', 't/ST-9');
  writeFiles(o, { 'o.txt': 'o\n' });
  commitMsg(o, 'elsewhere');
  gitRun(o, 'push', '-q');
  dropOnRemote(c, ['ST-9']);
  const kept = [withAction('kept t/ST-9: origin/t/ST-9 has commits not here')];
  expect(lines((await run(['worktree', 'clean'], c.root)).out)).toEqual(kept);
  expect(existsSync(c.sibling('ST-9'))).toBe(true);
  expect(has(c.root, 'refs/heads/t/ST-9')).toBe(true);
  expect(has(c.remote, 'refs/heads/t/ST-9')).toBe(true);
}, 120_000);

it('risk:data-loss clean keeps a dropped ticket whose local and origin branches have diverged', async () => {
  const c = copy();
  claimWorktree(c, 'ST-9');
  const o = c.otherClone();
  gitRun(o, 'switch', '-q', 't/ST-9');
  writeFiles(o, { 'o.txt': 'o\n' });
  commitMsg(o, 'elsewhere');
  gitRun(o, 'push', '-q');
  dropOnRemote(c, ['ST-9']);
  const kept = [withAction('kept t/ST-9: origin/t/ST-9 has commits not here')];
  writeFiles(c.sibling('ST-9'), { 'l.txt': 'l\n' });
  commitMsg(c.sibling('ST-9'), 'local');
  expect(lines((await run(['worktree', 'clean'], c.root)).out)).toEqual(kept);
  expect(existsSync(c.sibling('ST-9'))).toBe(true);
  expect(has(c.root, 'refs/heads/t/ST-9')).toBe(true);
  expect(has(c.remote, 'refs/heads/t/ST-9')).toBe(true);
}, 120_000);

it('risk:data-loss clean deletes a dropped ticket branch that exists on one side only when nothing is lost', async () => {
  const c = copy({ tickets: ['ST-9', 'ST-10', 'ST-11'] });
  const S9 = claimWorktree(c, 'ST-9');
  c.git('worktree', 'remove', c.sibling('ST-9'));
  c.git('branch', '-D', 't/ST-9');
  const S10 = claimWorktree(c, 'ST-10');
  gitRun(c.sibling('ST-10'), 'push', '-q', 'origin', 't/ST-10:refs/heads/keep');
  c.git('push', '-q', 'origin', '--delete', 't/ST-10');
  claimWorktree(c, 'ST-11');
  writeFiles(c.sibling('ST-11'), { 'x.txt': 'x\n' });
  commitMsg(c.sibling('ST-11'), 'x');
  c.git('worktree', 'remove', c.sibling('ST-11'));
  c.git('push', '-q', 'origin', '--delete', 't/ST-11');
  dropOnRemote(c, ['ST-9', 'ST-10', 'ST-11']);
  const r = await run(['worktree', 'clean'], c.root);
  expect(r.code).toBe(0);
  expect(lines(r.out).sort()).toEqual(
    [withAction(`deleted origin/t/ST-9 (was ${S9})`), withAction(`removed ${c.sibling('ST-10')}`), withAction(`deleted t/ST-10 (was ${S10})`), withAction('kept t/ST-11: 2 commits not on origin')].sort(),
  );
  expect(has(c.remote, 'refs/heads/t/ST-9')).toBe(false);
  expect(has(c.root, 'refs/heads/t/ST-11')).toBe(true);
}, 120_000);

it('risk:data-loss clean keeps everything of a dropped ticket that a guard keeps or whose worktree remove fails', async () => {
  const c = copy({ tickets: ['ST-9', 'ST-10', 'ST-11', 'ST-12'] });
  for (const id of ['ST-9', 'ST-10', 'ST-11', 'ST-12']) claimWorktree(c, id);
  writeFiles(c.sibling('ST-9'), { 'new.txt': 'n\n' });
  c.git('worktree', 'lock', c.sibling('ST-10'));
  c.git('worktree', 'remove', c.sibling('ST-11'));
  c.git('switch', '-q', 't/ST-11');
  writeHolds(c, { 'ST-12': LIVE });
  vi.mocked(proc.processTable).mockReturnValue([
    { pid: process.pid, ppid: 1, start: 'self' },
    { pid: 4242, ppid: 1, start: 'S2' },
  ]);
  dropOnRemote(c, ['ST-9', 'ST-10', 'ST-11', 'ST-12']);
  const r = await run(['worktree', 'clean'], c.root);
  expect(r.code).toBe(0);
  const out = lines(r.out).sort();
  expect(out).toHaveLength(4);
  expect(out).toContain(withAction(`kept ${c.sibling('ST-9')}: uncommitted work`));
  expect(out.some((l) => l.startsWith(`kept ${c.sibling('ST-10')}: git worktree remove failed: `))).toBe(true);
  expect(out).toContain(withAction(`kept t/ST-11: checked out in ${c.root}`));
  expect(out).toContain(withAction(`kept ${c.sibling('ST-12')}: held by another session`));
  for (const id of ['ST-9', 'ST-10', 'ST-11', 'ST-12']) {
    expect(has(c.root, `refs/heads/t/${id}`)).toBe(true);
    expect(has(c.remote, `refs/heads/t/${id}`)).toBe(true);
  }
  for (const id of ['ST-9', 'ST-10', 'ST-12']) expect(existsSync(c.sibling(id))).toBe(true);
  c.git('worktree', 'unlock', c.sibling('ST-10'));
}, 120_000);

it('risk:data-loss a failed fetch keeps every dropped ticket and says so once', async () => {
  const c = clone({ tickets: ['ST-9', 'ST-10'] });
  claimWorktree(c, 'ST-9');
  claimWorktree(c, 'ST-10');
  dropOnRemote(c, ['ST-9', 'ST-10']);
  c.git('fetch', '-q', 'origin');
  c.git('remote', 'set-url', 'origin', c.remote + '-missing');
  const r = await run(['worktree', 'clean'], c.root);
  expect(r.code).toBe(0);
  const l = lines(r.out);
  expect(l).toHaveLength(2);
  expect(l[0].startsWith('fetch from origin failed, judging against the refs already in this clone')).toBe(true);
  expect(l[1]).toBe(withAction('kept dropped tickets: fetch from origin failed'));
  for (const id of ['ST-9', 'ST-10']) {
    expect(existsSync(c.sibling(id))).toBe(true);
    expect(has(c.root, `refs/heads/t/${id}`)).toBe(true);
  }
  expect(has(c.remote, 'refs/heads/t/ST-9')).toBe(true);
}, 120_000);

it('risk:data-loss a stale lease keeps the local branch of a dropped ticket and names the origin branch', async () => {
  const c = clone();
  const S = claimWorktree(c, 'ST-9');
  dropOnRemote(c, ['ST-9']);
  const o = c.otherClone();
  gitRun(o, 'switch', '-q', '-c', 'elsewhere');
  writeFiles(o, { 'e.txt': 'e\n' });
  const S2 = commitMsg(o, 'elsewhere');
  gitRun(o, 'push', '-q', 'origin', 'elsewhere');
  const hook = `${c.root}/.git/hooks/pre-push`;
  writeFileSync(hook, `#!/bin/sh\ngit --git-dir="${c.remote.replaceAll('\\', '/')}" update-ref refs/heads/t/ST-9 ${S2}\nexit 0\n`);
  chmodSync(hook, 0o755);
  const r = await run(['worktree', 'clean'], c.root);
  expect(r.code).toBe(0);
  const l = lines(r.out);
  expect(l).toHaveLength(3);
  expect(l[0]).toBe(withAction(`removed ${c.sibling('ST-9')}`));
  expect(l[1].startsWith('kept origin/t/ST-9: git push failed: ')).toBe(true);
  expect(l[2]).toBe(withAction('kept t/ST-9: its origin branch was not deleted'));
  expect(sha(c, 't/ST-9')).toBe(S);
  expect(gitRun(c.remote, 'rev-parse', 't/ST-9').trim()).toBe(S2);
}, 120_000);

it('risk:data-loss a second clone deletes its local branch of a dropped ticket another clone cleaned', async () => {
  const c = copy();
  const S = claimWorktree(c, 'ST-9');
  const o2 = c.otherClone();
  gitRun(o2, 'branch', 't/ST-9', 'origin/t/ST-9');
  dropOnRemote(c, ['ST-9']);
  // H3: what the first clone's clean leaves on the remote; that clean and its exit 0 are the ac-3 test's (#105).
  c.git('push', '-q', 'origin', '--delete', 't/ST-9');
  expect(lines((await run(['worktree', 'clean'], o2)).out)).toEqual([`pruned refs/remotes/origin/t/ST-9 (was ${S})`, withAction(`deleted t/ST-9 (was ${S})`)]);
  expect(has(o2, 'refs/heads/t/ST-9')).toBe(false);
}, 120_000);

it('risk:data-loss a second clone keeps its local branch of a cleaned dropped ticket that has commits not on origin', async () => {
  const c = copy();
  const S = claimWorktree(c, 'ST-9');
  const o3 = c.otherClone();
  gitRun(o3, 'switch', '-q', 't/ST-9');
  writeFiles(o3, { 'x.txt': 'x\n' });
  commitMsg(o3, 'mine');
  gitRun(o3, 'switch', '-q', 'main');
  dropOnRemote(c, ['ST-9']);
  c.git('push', '-q', 'origin', '--delete', 't/ST-9');
  expect(lines((await run(['worktree', 'clean'], o3)).out)).toEqual([`pruned refs/remotes/origin/t/ST-9 (was ${S})`, withAction('kept t/ST-9: 2 commits not on origin')]);
  expect(has(o3, 'refs/heads/t/ST-9')).toBe(true);
}, 120_000);

it('risk:data-loss clean keeps the local branch of a dropped ticket that moved after clean read it', async () => {
  const c = copy();
  const S = claimWorktree(c, 'ST-9');
  dropOnRemote(c, ['ST-9']);
  const o = c.otherClone();
  gitRun(o, 'switch', '-q', '-c', 'elsewhere');
  writeFiles(o, { 'e.txt': 'e\n' });
  const S2 = commitMsg(o, 'elsewhere');
  gitRun(o, 'push', '-q', 'origin', 'elsewhere');
  const hook = `${c.root}/.git/hooks/pre-push`;
  writeFileSync(hook, `#!/bin/sh\ngit update-ref refs/heads/t/ST-9 ${S2}\nexit 0\n`);
  chmodSync(hook, 0o755);
  const r = await run(['worktree', 'clean'], c.root);
  expect(r.code).toBe(0);
  const l = lines(r.out);
  expect(l).toHaveLength(3);
  expect(l[0]).toBe(withAction(`removed ${c.sibling('ST-9')}`));
  expect(l[1]).toBe(withAction(`deleted origin/t/ST-9 (was ${S})`));
  expect(l[2].startsWith('kept t/ST-9: git update-ref failed: ')).toBe(true);
  expect(sha(c, 't/ST-9')).toBe(S2);
  expect(has(c.remote, 'refs/heads/t/ST-9')).toBe(false);
}, 120_000);

const REC = (topic: string): string => '# ' + topic + '\n\nDate: 2026-10-30. Repository at `5c083d3`. Feeds the ticket.\n';

it('risk:data-loss clean keeps a dropped ticket branch whose listed research record the default branch history never held', async () => {
  const NEW = 'accord/research/2026-10-30-new.md';
  const GONE = 'accord/research/2026-10-29-gone.md';
  const CARRIED = 'accord/research/2026-10-30-carried.md';
  const FIX = ' - make the record on t/ST-10 equal to the copy on main, or put it on main, then push';
  const c = copy();
  const S = claimWorktree(c, 'ST-10', {
    'accord/tickets/ST-10.md': laneTicket('ST-10', { frontmatter: ['research: ["' + GONE + '", "' + NEW + '"]'] }),
    [NEW]: REC('new'),
  });
  dropOnRemote(c, ['ST-10']);
  let r = await run(['worktree', 'clean'], c.root);
  expect(r.code).toBe(0);
  const kept = [withAction('kept t/ST-10: research record ' + NEW + ' is not on main as t/ST-10 holds it' + FIX)];
  expect(lines(r.out)).toEqual(kept);
  expect(existsSync(c.sibling('ST-10'))).toBe(true);
  expect(has(c.root, 'refs/heads/t/ST-10')).toBe(true);
  expect(has(c.remote, 'refs/heads/t/ST-10')).toBe(true);

  const o = c.otherClone();
  writeFiles(o, { [NEW]: REC('other') });
  commitMsg(o, 'other');
  gitRun(o, 'push', '-q', 'origin', 'main');
  r = await run(['worktree', 'clean'], c.root);
  expect(lines(r.out)).toEqual(kept);
  expect(existsSync(c.sibling('ST-10'))).toBe(true);
  expect(has(c.root, 'refs/heads/t/ST-10')).toBe(true);
  expect(has(c.remote, 'refs/heads/t/ST-10')).toBe(true);

  writeFiles(o, { [NEW]: REC('new') });
  commitMsg(o, 'same');
  gitRun(o, 'push', '-q', 'origin', 'main');
  r = await run(['worktree', 'clean'], c.root);
  expect(lines(r.out)).toEqual([withAction(`removed ${c.sibling('ST-10')}`), withAction(`deleted origin/t/ST-10 (was ${S})`), withAction(`deleted t/ST-10 (was ${S})`)]);
  expect(existsSync(c.sibling('ST-10'))).toBe(false);
  expect(has(c.root, 'refs/heads/t/ST-10')).toBe(false);
  expect(has(c.remote, 'refs/heads/t/ST-10')).toBe(false);

  const S11 = claimWorktree(c, 'ST-11', {
    'accord/tickets/ST-11.md': laneTicket('ST-11', { frontmatter: ['research: ["' + CARRIED + '"]'] }),
    [CARRIED]: REC('carried'),
  });
  await dropAndMerge(c, 'ST-11');
  expect(gitRun(c.remote, 'cat-file', 'blob', 'main:' + CARRIED)).toBe(REC('carried'));
  const o2 = c.otherClone();
  writeFiles(o2, { [CARRIED]: REC('carried edited') });
  commitMsg(o2, 'edit');
  gitRun(o2, 'push', '-q', 'origin', 'main');
  r = await run(['worktree', 'clean'], c.root);
  expect(r.code).toBe(0);
  expect(lines(r.out)).toEqual([withAction(`removed ${c.sibling('ST-11')}`), withAction(`deleted origin/t/ST-11 (was ${S11})`), withAction(`deleted t/ST-11 (was ${S11})`)]);
  expect(existsSync(c.sibling('ST-11'))).toBe(false);
  expect(has(c.root, 'refs/heads/t/ST-11')).toBe(false);
  expect(has(c.remote, 'refs/heads/t/ST-11')).toBe(false);
}, 120_000);

it('risk:data-loss clean keeps a dropped ticket branch whose listed non-Markdown research record the default branch never held', async () => {
  const TXT = 'accord/research/2026-10-30-measure.txt';
  const c = copy();
  claimWorktree(c, 'ST-10', {
    'accord/tickets/ST-10.md': laneTicket('ST-10', { frontmatter: ['research: ["' + TXT + '"]'] }),
    [TXT]: 'Date: 2026-10-30\nRepository at `5c083d3`\nmeasure\n',
  });
  dropOnRemote(c, ['ST-10']);
  const r = await run(['worktree', 'clean'], c.root);
  expect(r.code).toBe(0);
  expect(lines(r.out)).toEqual([withAction('kept t/ST-10: research record ' + TXT + ' is not on main as t/ST-10 holds it - make the record on t/ST-10 equal to the copy on main, or put it on main, then push')]);
  expect(existsSync(c.sibling('ST-10'))).toBe(true);
  expect(has(c.root, 'refs/heads/t/ST-10')).toBe(true);
  expect(has(c.remote, 'refs/heads/t/ST-10')).toBe(true);
}, 120_000);

it('risk:data-loss clean keeps a dropped ticket branch that a detached worktree is rebasing', async () => {
  const c = clone();
  claimWorktree(c, 'ST-9');
  try {
    gitRun(c.sibling('ST-9'), 'rebase', '-q', '--force-rebase', '--exec', 'false', 'HEAD~1');
  } catch {
    // the exec line fails on purpose, leaving the rebase stopped
  }
  expect(gitRun(c.sibling('ST-9'), 'branch', '--show-current').trim()).toBe('');
  dropOnRemote(c, ['ST-9']);
  const r = await run(['worktree', 'clean'], c.root);
  expect(r.code).toBe(0);
  expect(lines(r.out)).toEqual([withAction(`kept t/ST-9: being rebased in ${c.sibling('ST-9')}`)]);
  expect(existsSync(c.sibling('ST-9'))).toBe(true);
  expect(has(c.root, 'refs/heads/t/ST-9')).toBe(true);
  expect(has(c.remote, 'refs/heads/t/ST-9')).toBe(true);
  gitRun(c.sibling('ST-9'), 'rebase', '--abort');
}, 120_000);
