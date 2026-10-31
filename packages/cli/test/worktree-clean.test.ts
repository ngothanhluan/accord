// ST-LN-7, ST-LN-20, ST-LN-34, ST-LN-55: `accord worktree clean` of merged, pruned and dropped tickets, and the session-start hook that runs it, against real git in tmp sandboxes with a bare remote.
import { spawnSync } from 'node:child_process';
import { chmodSync, existsSync, lstatSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { afterEach, expect, it, vi } from 'vitest';
import * as limit from '../src/commands/fetch-limit.js';
import * as proc from '../src/load/proc.js';
import { laneTicket } from '../../../test/helpers/lane.js';
import { ALIVE, exclude, forget, gone, link, listing, recorded, runWhole } from './helpers/done.js';
import { spawnLog } from './helpers/git-spawns.js';
import { commitMsg, gitRun, run, writeFiles } from './helpers/repo.js';
import { claimWorktree, clone, copy, DEAD, doneOnRemote, dropAndMerge, dropOnRemote, has, lines, LIVE, readHolds, recorder, sha, ticketBranches, ticketWorktree, useSandboxes, worktreeAndSshRemote, writeHolds, type Clone } from './helpers/worktree.js';

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
      `removed ${c.sibling('ST-9')}`,
      `kept ${c.sibling('ST-10')}: uncommitted work`,
      `kept ${c.sibling('ST-12')}: held by another session`,
      `deleted t/ST-9 (was ${sha9})`,
      `deleted origin/t/ST-9 (was ${t['ST-9']})`,
      `kept t/ST-10: checked out in ${c.sibling('ST-10')}`,
      `kept t/ST-12: checked out in ${c.sibling('ST-12')}`,
    ].sort(),
  );
  expect(existsSync(`${c.sibling('ST-10')}/new.txt`)).toBe(true);
  expect(existsSync(c.sibling('ST-11'))).toBe(true);
  expect(out).not.toContain(c.sibling('ST-11'));
  expect(Object.keys(readHolds(c))).toEqual(['ST-12']);
});

it('risk:complex-branching a failed fetch is said and the refs in the clone are judged', async () => {
  const c = copy();
  c.git('worktree', 'add', '-q', '-b', 't/ST-9', c.sibling('ST-9'), 'origin/main');
  const b9 = sha(c, 't/ST-9');
  doneOnRemote(c, ['ST-9']);
  c.git('fetch', '-q', 'origin');
  c.git('remote', 'set-url', 'origin', c.remote + '-missing');
  const { code, out } = await run(['worktree', 'clean'], c.root, {});
  expect(code).toBe(0);
  const l = lines(out);
  expect(l[0].startsWith('fetch from origin failed, judging against the refs already in this clone')).toBe(true);
  expect(l[1]).toBe(`removed ${c.sibling('ST-9')}`);
  expect(l).toHaveLength(3);
  expect(l[2]).toBe(`deleted t/ST-9 (was ${b9})`);
});

it('risk:complex-branching clean with no origin prints nothing and a failed fetch with no ticket branch prints only that', async () => {
  const d = copy();
  d.git('worktree', 'add', '-q', '-b', 't/ST-9', d.sibling('ST-9'), 'origin/main');
  d.git('remote', 'remove', 'origin');
  expect((await run(['worktree', 'clean'], d.root, {})).out).toBe('');
  const e = copy();
  e.git('remote', 'set-url', 'origin', e.remote + '-missing');
  const eOut = lines((await run(['worktree', 'clean'], e.root, {})).out);
  expect(eOut).toHaveLength(1);
  expect(eOut[0].startsWith('fetch from origin failed, judging against the refs already in this clone')).toBe(true);
});

it('risk:data-loss clean keeps unpushed commits and new files that git status config would hide', async () => {
  const c = copy({ tickets: ['ST-9', 'ST-10'] });
  ticketWorktree(c, 'ST-9');
  ticketWorktree(c, 'ST-10');
  doneOnRemote(c, ['ST-9', 'ST-10']);
  writeFiles(c.sibling('ST-9'), { 'more.txt': 'more\n' });
  gitRun(c.sibling('ST-9'), 'add', '-A');
  gitRun(c.sibling('ST-9'), 'commit', '-q', '-m', 'unpushed');
  c.git('config', 'status.showUntrackedFiles', 'no');
  writeFileSync(`${c.sibling('ST-10')}/new.txt`, 'new');
  const { code, out } = await run(['worktree', 'clean'], c.root, {});
  expect(code).toBe(0);
  expect(lines(out)).toEqual([`kept ${c.sibling('ST-10')}: uncommitted work`, `kept t/ST-10: checked out in ${c.sibling('ST-10')}`, 'kept t/ST-9: it has commits after its verified commit']);
  expect(existsSync(`${c.sibling('ST-10')}/new.txt`)).toBe(true);
  expect(existsSync(c.sibling('ST-9'))).toBe(true);

  const d = copy();
  ticketWorktree(d, 'ST-9');
  doneOnRemote(d, ['ST-9']);
  const r = await run(['worktree', 'clean'], d.sibling('ST-9'), {});
  expect(lines(r.out)).toEqual([`kept ${d.sibling('ST-9')}: this session's worktree`, `kept t/ST-9: checked out in ${d.sibling('ST-9')}`]);
  expect(existsSync(d.sibling('ST-9'))).toBe(true);
});

it('risk:complex-branching a worktree remove that fails is named truthfully', async () => {
  const c = clone();
  ticketWorktree(c, 'ST-9');
  doneOnRemote(c, ['ST-9']);
  writeHolds(c, { 'ST-9': DEAD });
  vi.mocked(proc.processTable).mockReturnValue([{ pid: process.pid, ppid: 1, start: 'self' }]);
  c.git('worktree', 'lock', c.sibling('ST-9'));
  const r = await run(['worktree', 'clean'], c.root, {});
  expect(r.code).toBe(0);
  expect(lines(r.out)).toHaveLength(2);
  expect(r.out.startsWith(`kept ${c.sibling('ST-9')}: git worktree remove failed: `)).toBe(true);
  expect(lines(r.out)[1]).toBe(`kept t/ST-9: checked out in ${c.sibling('ST-9')}`);
  expect(c.git('worktree', 'list', '--porcelain')).toContain(`worktree ${c.sibling('ST-9')}\n`);
  expect(Object.keys(readHolds(c))).toEqual(['ST-9']);
});

it.skipIf(process.platform === 'win32' || process.getuid?.() === 0)('risk:complex-branching a worktree remove that fails part way removes it in part and names what is left', async () => {
  const d = clone();
  ticketWorktree(d, 'ST-9', 'sub/f.txt');
  const t = doneOnRemote(d, ['ST-9']);
  writeHolds(d, { 'ST-9': DEAD });
  vi.mocked(proc.processTable).mockReturnValue([{ pid: process.pid, ppid: 1, start: 'self' }]);
  chmodSync(`${d.sibling('ST-9')}/sub`, 0o555);
  const sha9d = sha(d, 't/ST-9');
  try {
    const q = await run(['worktree', 'clean'], d.root, {});
    expect(lines(q.out)).toHaveLength(3);
    expect(lines(q.out)[0]!.startsWith(`kept ${d.sibling('ST-9')}: `)).toBe(true);
    expect(lines(q.out)[1]).toBe(`deleted t/ST-9 (was ${sha9d})`);
    expect(lines(q.out)[2]).toBe(`deleted origin/t/ST-9 (was ${t['ST-9']})`);
    expect(existsSync(`${d.sibling('ST-9')}/sub/f.txt`)).toBe(true);
    expect(d.git('worktree', 'list', '--porcelain')).not.toContain(d.sibling('ST-9'));
    expect(Object.keys(readHolds(d))).toEqual([]);
  } finally {
    chmodSync(`${d.sibling('ST-9')}/sub`, 0o755);
  }
});

it('risk:complex-branching clean prunes a worktree whose folder was deleted by hand', async () => {
  const c = clone({ tickets: ['ST-9', 'ST-10'] });
  for (const id of ['ST-9', 'ST-10']) c.git('worktree', 'add', '-q', '-b', `t/${id}`, c.sibling(id), 'origin/main');
  rmSync(c.sibling('ST-9'), { recursive: true, force: true });
  const reason = /^prunable (.*)$/m.exec(c.git('worktree', 'list', '--porcelain'))?.[1] ?? 'no reason given';
  const base = sha(c, 'origin/main');
  doneOnRemote(c, ['ST-9', 'ST-10']);
  const { code, out } = await run(['worktree', 'clean'], c.root, {});
  expect(code).toBe(0);
  expect(lines(out)).toEqual([
    `pruned ${c.sibling('ST-9')}: ${reason}`,
    `removed ${c.sibling('ST-10')}`,
    `deleted t/ST-10 (was ${base})`,
    `deleted t/ST-9 (was ${base})`,
  ]);
  expect(out).not.toContain('repair');
  expect(c.git('worktree', 'list', '--porcelain')).not.toMatch(/^prunable/m);
  expect(() => c.git('rev-parse', '--verify', '-q', 'refs/heads/t/ST-9')).toThrow();
});

it('risk:security a configured core.sshCommand survives the fetch in clean and gains BatchMode', async () => {
  const c = clone();
  worktreeAndSshRemote(c);
  const rec = recorder(c);
  c.git('config', 'core.sshCommand', `"${rec.file}" mykey`);
  const { code } = await run(['worktree', 'clean'], c.root, {});
  expect(code).toBe(0);
  expect(rec.seen()).toMatch(/^mykey -o BatchMode=yes /);
});

it('risk:security a GIT_SSH program is still the one the fetch in clean calls', async () => {
  const c = clone();
  worktreeAndSshRemote(c);
  const rec = recorder(c, 'plink');
  vi.stubEnv('GIT_SSH', rec.file);
  vi.stubEnv('GIT_SSH_COMMAND', undefined);
  try {
    expect((await run(['worktree', 'clean'], c.root, {})).code).toBe(0);
  } finally {
    vi.unstubAllEnvs();
  }
  expect(rec.seen()).toContain('example.invalid');
  expect(rec.seen()).not.toContain('BatchMode');
});

it('risk:security a core.sshCommand that is not OpenSSH is called without BatchMode', async () => {
  const c = clone();
  worktreeAndSshRemote(c);
  const rec = recorder(c, 'wrapper');
  c.git('config', 'core.sshCommand', `"${rec.file}" mykey`);
  expect((await run(['worktree', 'clean'], c.root, {})).code).toBe(0);
  expect(rec.seen()).toMatch(/^mykey .*example\.invalid/);
  expect(rec.seen()).not.toContain('BatchMode');
});

it('risk:data-loss a stale holds lock keeps a merged clean worktree, names it, and clean exits 0', async () => {
  const c = copy({ tickets: ['ST-9', 'ST-10'] });
  ticketWorktree(c, 'ST-9');
  ticketWorktree(c, 'ST-10');
  doneOnRemote(c, ['ST-9', 'ST-10']);
  mkdirSync(`${c.root}/.git/accord`, { recursive: true });
  writeFileSync(`${c.root}/.git/accord/holds.lock`, '');
  const { code, out } = await run(['worktree', 'clean'], c.root, {});
  expect(code).toBe(0);
  expect(existsSync(c.sibling('ST-9'))).toBe(true);
  expect(existsSync(c.sibling('ST-10'))).toBe(true);
  expect(lines(out)).toHaveLength(4);
  for (const id of ['ST-9', 'ST-10']) {
    expect(out).toContain(`kept ${c.sibling(id)}: `);
    expect(out).toContain(`kept t/${id}: checked out in ${c.sibling(id)}`);
  }
  expect(out).toContain('holds.lock');
});

it('risk:data-loss a holds file that is not a JSON object keeps a merged clean worktree and clean exits 0', async () => {
  const c = copy({ tickets: ['ST-9', 'ST-10'] });
  ticketWorktree(c, 'ST-9');
  ticketWorktree(c, 'ST-10');
  doneOnRemote(c, ['ST-9', 'ST-10']);
  mkdirSync(`${c.root}/.git/accord`, { recursive: true });
  writeFileSync(`${c.root}/.git/accord/holds`, '[]');
  const r = await run(['worktree', 'clean'], c.root, {});
  expect(r.code).toBe(0);
  expect(existsSync(c.sibling('ST-9'))).toBe(true);
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
      `removed ${c.sibling('ST-10')}`,
      `deleted t/ST-9 (was ${sha9})`,
      `deleted origin/t/ST-9 (was ${t['ST-9']})`,
      `deleted t/ST-10 (was ${sha10})`,
      `deleted origin/t/ST-10 (was ${t['ST-10']})`,
      `kept t/ST-12: checked out in ${c.root}`,
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
  expect(lines(r.out)).toEqual([`removed ${c.sibling('ST-10')}`, `deleted origin/t/ST-10 (was ${S})`, `deleted t/ST-10 (was ${S})`]);
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
  expect(lines(r.out)).toEqual(['kept t/ST-10: 1 commits not on origin']);
  expect(existsSync(c.sibling('ST-10'))).toBe(true);
  expect(sha(c, 't/ST-10')).toBe(L);
  expect(gitRun(c.remote, 'rev-parse', 't/ST-10').trim()).toBe(S);
}, 120_000);

it('risk:data-loss clean keeps a dropped ticket whose origin branch has commits not here or has diverged', async () => {
  const c = copy();
  claimWorktree(c, 'ST-9');
  const o = c.otherClone();
  gitRun(o, 'switch', '-q', 't/ST-9');
  writeFiles(o, { 'o.txt': 'o\n' });
  commitMsg(o, 'elsewhere');
  gitRun(o, 'push', '-q');
  dropOnRemote(c, ['ST-9']);
  const kept = ['kept t/ST-9: origin/t/ST-9 has commits not here'];
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
  const kept = ['kept t/ST-9: origin/t/ST-9 has commits not here'];
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
    [`deleted origin/t/ST-9 (was ${S9})`, `removed ${c.sibling('ST-10')}`, `deleted t/ST-10 (was ${S10})`, 'kept t/ST-11: 2 commits not on origin'].sort(),
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
  expect(out).toContain(`kept ${c.sibling('ST-9')}: uncommitted work`);
  expect(out.some((l) => l.startsWith(`kept ${c.sibling('ST-10')}: git worktree remove failed: `))).toBe(true);
  expect(out).toContain(`kept t/ST-11: checked out in ${c.root}`);
  expect(out).toContain(`kept ${c.sibling('ST-12')}: held by another session`);
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
  expect(l[1]).toBe('kept dropped tickets: fetch from origin failed');
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
  expect(l[0]).toBe(`removed ${c.sibling('ST-9')}`);
  expect(l[1].startsWith('kept origin/t/ST-9: git push failed: ')).toBe(true);
  expect(l[2]).toBe('kept t/ST-9: its origin branch was not deleted');
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
  expect(lines((await run(['worktree', 'clean'], o2)).out)).toEqual([`pruned refs/remotes/origin/t/ST-9 (was ${S})`, `deleted t/ST-9 (was ${S})`]);
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
  expect(lines((await run(['worktree', 'clean'], o3)).out)).toEqual([`pruned refs/remotes/origin/t/ST-9 (was ${S})`, 'kept t/ST-9: 2 commits not on origin']);
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
  expect(l[0]).toBe(`removed ${c.sibling('ST-9')}`);
  expect(l[1]).toBe(`deleted origin/t/ST-9 (was ${S})`);
  expect(l[2].startsWith('kept t/ST-9: git update-ref failed: ')).toBe(true);
  expect(sha(c, 't/ST-9')).toBe(S2);
  expect(has(c.remote, 'refs/heads/t/ST-9')).toBe(false);
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
  expect(lines(r.out)).toEqual([`kept t/ST-9: being rebased in ${c.sibling('ST-9')}`]);
  expect(existsSync(c.sibling('ST-9'))).toBe(true);
  expect(has(c.root, 'refs/heads/t/ST-9')).toBe(true);
  expect(has(c.remote, 'refs/heads/t/ST-9')).toBe(true);
  gitRun(c.sibling('ST-9'), 'rebase', '--abort');
}, 120_000);

const startInput = (c: Clone, source = 'startup') => JSON.stringify({ session_id: 'sess-M', cwd: c.root, source });

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
    const removed = L.indexOf(`removed ${c.sibling('ST-9')}`);
    expect(removed).toBeGreaterThan(-1);
    expect(L).toContain(`kept ${c.sibling('ST-10')}: held by another session`);
    expect(L.indexOf('tell the owner the lines above')).toBeGreaterThan(removed);
    expect(existsSync(c.sibling('ST-10'))).toBe(true);
    expect(c.git('worktree', 'list', '--porcelain')).toContain(`worktree ${c.sibling('ST-10')}\n`);
  }
}, 300_000);

it('risk:complex-branching a compaction runs no clean and fetches nothing', async () => {
  const c = copy({ tickets: ['ST-9', 'ST-10'] });
  claimWorktree(c, 'ST-9');
  doneOnRemote(c, ['ST-9']);
  writeHolds(c, { 'ST-9': { ...DEAD, folder: c.sibling('ST-9') } });
  vi.mocked(proc.processTable).mockReturnValue(ALIVE);
  const before = c.git('rev-parse', 'origin/main');
  const r = await run(['hook', 'session-resume'], c.root, {}, startInput(c, 'compact'));
  expect(r.code).toBe(0);
  expect(existsSync(c.sibling('ST-9'))).toBe(true);
  expect(lines(r.out).filter((l) => l.startsWith('removed'))).toEqual([]);
  expect(r.out).not.toContain('tell the owner');
  expect(c.git('rev-parse', 'origin/main')).toBe(before);
}, 120_000);

it('risk:data-loss a session start keeps the record of a worktree whose folder is missing', async () => {
  const c = copy({ tickets: ['ST-9', 'ST-10'] });
  const p = c.sibling('ST-9');
  c.git('worktree', 'add', '-q', '--detach', p, 'origin/main');
  writeFiles(p, { 'x.txt': 'x\n' });
  const X = commitMsg(p, 'detached work');
  renameSync(p, p + '-away');
  const r = await run(['hook', 'session-start'], c.root, {}, startInput(c));
  expect(r.code).toBe(0);
  const L = lines(r.out);
  const kept = L.findIndex((l) => l.startsWith(`kept ${p}: its folder is missing`));
  expect(kept).toBeGreaterThan(-1);
  expect(L.some((l) => l.startsWith('pruned'))).toBe(false);
  expect(L.indexOf('tell the owner the lines above')).toBeGreaterThan(kept);
  expect(c.git('worktree', 'list', '--porcelain')).toContain(`worktree ${p}\n`);
  renameSync(p + '-away', p);
  expect(gitRun(p, 'rev-parse', 'HEAD').trim()).toBe(X);
}, 120_000);

it('risk:complex-branching a session start whose input folder is not a repository prints clean failed after the rules', async () => {
  const c = copy({ tickets: ['ST-9', 'ST-10'] });
  const r = await run(['hook', 'session-start'], c.root, {}, JSON.stringify({ session_id: 'sess-M', cwd: c.root + '/no-such-folder', source: 'startup' }));
  expect(r.code).toBe(0);
  expect(r.out.startsWith('# accord rules\n')).toBe(true);
  const L = lines(r.out);
  const failed = L.findIndex((l) => l.startsWith('clean failed, nothing more was removed: '));
  expect(failed).toBeGreaterThan(-1);
  expect(L.indexOf('tell the owner the lines above')).toBeGreaterThan(failed);
}, 120_000);

it('risk:data-loss a session start whose clean output passes 128 KiB still prints its last line', async () => {
  const c = copy({ tickets: ['ST-9', 'ST-10'] });
  claimWorktree(c, 'ST-9');
  doneOnRemote(c, ['ST-9']);
  vi.mocked(proc.processTable).mockReturnValue(ALIVE);
  const head = c.git('rev-parse', 'origin/main').trim();
  for (let n = 0; n < 1000; n++) {
    writeFiles(`${c.root}/.git/worktrees/gone-${n}`, { gitdir: `${c.sibling('gone-' + n)}/.git\n`, HEAD: head + '\n', commondir: '../..\n' });
  }
  const r = await runWhole(['hook', 'session-start'], c.root, startInput(c));
  expect(r.code).toBe(0);
  expect(r.out.startsWith('# accord rules\n')).toBe(true);
  expect(r.out.length).toBeGreaterThan(131072);
  const L = lines(r.out);
  expect(L.filter((l) => l.startsWith('kept ') && l.includes(': its folder is missing (')).length).toBe(1000);
  const removed = L.indexOf(`removed ${c.sibling('ST-9')}`);
  expect(removed).toBeGreaterThan(-1);
  expect(L.indexOf('tell the owner the lines above')).toBeGreaterThan(removed);
  expect(gone(c.sibling('ST-9'))).toBe(true);
}, 120_000);

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
  expect(L).toContain(`removed ${c.sibling('ST-9')}`);
  expect(c.git('worktree', 'list', '--porcelain')).toContain(`worktree ${c.sibling('ST-10')}\n`);
  expect(listing(c.sibling('ST-10'))).toEqual(before);
  expect(L).toContain(`kept ${c.sibling('ST-10')}: .env`);
  expect(L.some((l) => l.startsWith(`removed ${c.sibling('ST-10')}`))).toBe(false);
}, 120_000);

it('risk:data-loss clean keeps a worktree holding an ignored env file when status shows no untracked files', async () => {
  const c = copy();
  exclude(c, ['.env']);
  claimWorktree(c, 'ST-9');
  writeFiles(c.sibling('ST-9'), { '.env': 'SECRET=1\n' });
  doneOnRemote(c, ['ST-9']);
  c.git('config', 'status.showUntrackedFiles', 'no');
  const r = await run(['worktree', 'clean'], c.root);
  expect(r.code).toBe(0);
  expect(lines(r.out)).toContain(`kept ${c.sibling('ST-9')}: .env`);
  expect(c.git('worktree', 'list', '--porcelain')).toContain(`worktree ${c.sibling('ST-9')}\n`);
  expect(readFileSync(`${c.sibling('ST-9')}/.env`, 'utf8')).toBe('SECRET=1\n');
}, 120_000);

it('risk:data-loss the disposable list in config.yml decides which ignored folders a done worktree may hold and still be removed', async () => {
  const c = copy({ tickets: ['ST-9', 'ST-10'] });
  exclude(c, ['coverage/', 'dist/']);
  claimWorktree(c, 'ST-9');
  writeFiles(c.sibling('ST-9'), { 'coverage/x': 'x' });
  claimWorktree(c, 'ST-10');
  writeFiles(c.sibling('ST-10'), { 'dist/x': 'x' });
  doneOnRemote(c, ['ST-9', 'ST-10']);
  const cfg = `${c.root}/accord/config.yml`;
  const text = readFileSync(cfg, 'utf8').trimEnd();
  writeFileSync(cfg, text + '\ndisposable: [node_modules]\n');
  const a = await run(['worktree', 'clean'], c.root);
  expect(a.code).toBe(0);
  const A = lines(a.out);
  expect(A.some((l) => l.startsWith(`kept ${c.sibling('ST-9')}: coverage/`))).toBe(true);
  expect(A.some((l) => l.startsWith(`kept ${c.sibling('ST-10')}: dist/`))).toBe(true);
  expect(A.some((l) => l.startsWith('removed'))).toBe(false);
  const listed = c.git('worktree', 'list', '--porcelain');
  expect(listed).toContain(`worktree ${c.sibling('ST-9')}\n`);
  expect(listed).toContain(`worktree ${c.sibling('ST-10')}\n`);
  expect(readFileSync(`${c.sibling('ST-10')}/dist/x`, 'utf8')).toBe('x');
  writeFileSync(cfg, text + '\ndisposable: [node_modules, dist, coverage]\n');
  const b = await run(['worktree', 'clean'], c.root);
  expect(b.code).toBe(0);
  const B = lines(b.out);
  expect(B).toContain(`removed ${c.sibling('ST-9')}`);
  expect(B).toContain(`removed ${c.sibling('ST-10')}`);
  expect(gone(c.sibling('ST-9'))).toBe(true);
  expect(gone(c.sibling('ST-10'))).toBe(true);
}, 120_000);

it('risk:regression a folder git reports removed but leaves links and disposable files in is deleted before removed is printed', async () => {
  const c = copy();
  claimWorktree(c, 'ST-9');
  doneOnRemote(c, ['ST-9']);
  spawnLog.after = (args) => {
    if (args[0] === 'worktree' && args[1] === 'remove') {
      const p = args[2]!;
      link(`${c.root}/accord`, `${p}/node_modules/@x/ws`);
      mkdirSync(`${p}/a/b`, { recursive: true });
      writeFiles(p, { 'dist/index.js': 'x' });
    }
  };
  spawnLog.on = true;
  const r = await run(['worktree', 'clean'], c.root);
  spawnLog.on = false;
  expect(r.code).toBe(0);
  expect(gone(c.sibling('ST-9'))).toBe(true);
  const L = lines(r.out);
  expect(L).toContain(`removed ${c.sibling('ST-9')}`);
  expect(L.some((l) => l.startsWith(`kept ${c.sibling('ST-9')}`))).toBe(false);
  expect(existsSync(`${c.root}/accord/config.yml`)).toBe(true);
}, 120_000);

it('risk:complex-branching a worktree remove that fails after git unregistered the folder keeps and names the file left in it', async () => {
  const c = copy();
  claimWorktree(c, 'ST-9');
  const t = doneOnRemote(c, ['ST-9']);
  const sha9 = sha(c, 't/ST-9');
  writeHolds(c, { 'ST-9': { ...DEAD, folder: c.sibling('ST-9') } });
  vi.mocked(proc.processTable).mockReturnValue(ALIVE);
  spawnLog.fail = (args) => {
    if (args[0] !== 'worktree' || args[1] !== 'remove') return false;
    spawnLog.on = false;
    try {
      gitRun(c.root, ...args);
      writeFiles(args[2]!, { 'sub/f.txt': 'left\n' });
    } finally {
      spawnLog.on = true;
    }
    return true;
  };
  spawnLog.on = true;
  const r = await run(['worktree', 'clean'], c.root);
  spawnLog.on = false;
  expect(r.code).toBe(0);
  expect(lines(r.out)).toEqual([`kept ${c.sibling('ST-9')}: sub/f.txt`, `deleted t/ST-9 (was ${sha9})`, `deleted origin/t/ST-9 (was ${t['ST-9']})`]);
  expect(readFileSync(`${c.sibling('ST-9')}/sub/f.txt`, 'utf8')).toBe('left\n');
  expect(c.git('worktree', 'list', '--porcelain')).not.toContain(c.sibling('ST-9'));
  expect(Object.keys(readHolds(c))).toEqual([]);
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
  expect(lines(a.out)).toContain(`removed ${c.sibling('ST-9')}`);
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

it('risk:data-loss a forgotten folder holding a dist file or a recorded path that is a link is kept unchanged and named', async () => {
  const c = copy({ tickets: ['ST-9', 'ST-10', 'ST-11'] });
  for (const id of ['ST-9', 'ST-10']) expect((await run(['worktree', 'open', id], c.root)).code).toBe(0);
  forget(c, 'ST-9');
  writeFiles(c.sibling('ST-9'), { 'dist/index.js': 'modified\n' });
  link(`${c.root}/accord`, `${c.sibling('ST-9')}/node_modules/outside`);
  mkdirSync(`${c.sibling('ST-9')}/empty`);
  c.git('worktree', 'remove', '--force', c.sibling('ST-10'));
  const t = c.sibling('ST-11');
  mkdirSync(`${t}/a/b`, { recursive: true });
  link(`${c.root}/accord`, `${t}/l`);
  link(t, c.sibling('ST-10'));
  doneOnRemote(c, ['ST-9', 'ST-10']);
  const before = listing(c.sibling('ST-9'));
  const beforeT = listing(t);
  const r = await run(['worktree', 'clean'], c.root);
  expect(r.code).toBe(0);
  const L = lines(r.out);
  expect(L).toContain(`kept ${c.sibling('ST-9')}: dist/index.js`);
  expect(L).toContain(`kept ${c.sibling('ST-10')}: it is a link`);
  expect(listing(c.sibling('ST-9'))).toEqual(before);
  expect(listing(t)).toEqual(beforeT);
  expect(lstatSync(c.sibling('ST-10')).isSymbolicLink()).toBe(true);
  expect(recorded(c).map((e) => e.path)).toEqual([c.sibling('ST-9'), c.sibling('ST-10')]);
}, 120_000);

it('risk:regression worktree open on an existing branch and new ticket in a worktree both record the worktree', async () => {
  const c = copy({ tickets: ['ST-9', 'ST-10'] });
  c.git('branch', 't/ST-10', 'origin/main');
  const a = await run(['worktree', 'open', 'ST-10'], c.root);
  expect(a.code).toBe(0);
  const b = await run(['new', 'ticket', 'ST-11', '--lane', 'M', '--worktree'], c.root);
  expect(b.code).toBe(0);
  expect(recorded(c)).toEqual([
    { id: 'ST-10', path: c.sibling('ST-10') },
    { id: 'ST-11', path: c.sibling('ST-11') },
  ]);
  expect(lines(a.out).some((l) => l.startsWith('note '))).toBe(false);
  expect(lines(b.out).some((l) => l.startsWith('note '))).toBe(false);
}, 120_000);

it('risk:data-loss clean keeps a recorded detached worktree whose head is on no branch and removes one at the default branch', async () => {
  const c = copy({ tickets: ['ST-9', 'ST-10'] });
  for (const id of ['ST-9', 'ST-10']) expect((await run(['worktree', 'open', id], c.root)).code).toBe(0);
  const a = c.sibling('ST-9');
  const b = c.sibling('ST-10');
  gitRun(a, 'switch', '-q', '--detach');
  writeFiles(a, { 'x.txt': 'x\n' });
  const X = commitMsg(a, 'detached work');
  gitRun(b, 'switch', '-q', '--detach', 'origin/main');
  doneOnRemote(c, ['ST-9', 'ST-10']);
  const r = await run(['worktree', 'clean'], c.root);
  expect(r.code).toBe(0);
  const L = lines(r.out);
  expect(L).toContain(`kept ${a}: its detached HEAD ${X} is on no branch`);
  expect(L).toContain(`removed ${b}`);
  expect(c.git('worktree', 'list', '--porcelain')).toContain(`worktree ${a}\n`);
  expect(readFileSync(`${a}/x.txt`, 'utf8')).toBe('x\n');
  expect(() => c.git('cat-file', '-e', X)).not.toThrow();
  expect(recorded(c).map((e) => e.path)).toEqual([a]);
}, 120_000);

it('risk:data-loss clean never removes a recorded worktree on another branch or a folder a live hold names', async () => {
  const c = copy({ tickets: ['ST-9', 'ST-10', 'ST-11', 'ST-12'] });
  expect((await run(['worktree', 'open', 'ST-9'], c.root)).code).toBe(0);
  gitRun(c.sibling('ST-9'), 'switch', '-q', '-c', 'other');
  claimWorktree(c, 'ST-10');
  expect((await run(['worktree', 'open', 'ST-12'], c.root)).code).toBe(0);
  forget(c, 'ST-12');
  mkdirSync(`${c.sibling('ST-12')}/empty`);
  writeHolds(c, { 'ST-11': { ...LIVE, folder: c.sibling('ST-10') }, 'ST-13': { ...LIVE, folder: c.sibling('ST-12') } });
  vi.mocked(proc.processTable).mockReturnValue(ALIVE);
  doneOnRemote(c, ['ST-9', 'ST-10', 'ST-12']);
  const r = await run(['worktree', 'clean'], c.root);
  expect(r.code).toBe(0);
  const L = lines(r.out);
  expect(L).toContain(`kept ${c.sibling('ST-9')}: checked out on other`);
  expect(L).toContain(`kept ${c.sibling('ST-10')}: held by another session`);
  expect(L).toContain(`kept ${c.sibling('ST-12')}: held by another session`);
  for (const id of ['ST-9', 'ST-10', 'ST-12']) expect(existsSync(c.sibling(id))).toBe(true);
  const listed = c.git('worktree', 'list', '--porcelain');
  expect(listed).toContain(`worktree ${c.sibling('ST-9')}\n`);
  expect(listed).toContain(`worktree ${c.sibling('ST-10')}\n`);
  expect(has(c.root, 'refs/heads/other')).toBe(true);
}, 120_000);

it('risk:complex-branching clean names a recorded worktree of a dropped ticket whose branch is already on the default branch', async () => {
  const c = copy();
  expect((await run(['worktree', 'open', 'ST-9'], c.root)).code).toBe(0);
  gitRun(c.sibling('ST-9'), 'reset', '-q', '--hard', 'origin/main');
  dropOnRemote(c, ['ST-9']);
  const r = await run(['worktree', 'clean'], c.root);
  expect(r.code).toBe(0);
  expect(lines(r.out)).toContain(`kept ${c.sibling('ST-9')}: its ticket is dropped and its branch t/ST-9 is already on origin/main`);
  expect(c.git('worktree', 'list', '--porcelain')).toContain(`worktree ${c.sibling('ST-9')}\n`);
  expect(has(c.root, 'refs/heads/t/ST-9')).toBe(true);
  expect(recorded(c).map((e) => e.path)).toEqual([c.sibling('ST-9')]);
}, 120_000);

it('risk:data-loss a bare clean keeps the record of a missing folder whose detached head is on no branch', async () => {
  const c = copy({ tickets: ['ST-9', 'ST-10'] });
  const p = c.sibling('ST-9');
  const q = c.sibling('ST-10');
  c.git('worktree', 'add', '-q', '--detach', p, 'origin/main');
  writeFiles(p, { 'x.txt': 'x\n' });
  const X = commitMsg(p, 'detached work');
  c.git('worktree', 'add', '-q', '--detach', q, 'origin/main');
  renameSync(p, p + '-away');
  renameSync(q, q + '-away');
  const r = await run(['worktree', 'clean'], c.root);
  expect(r.code).toBe(0);
  const L = lines(r.out);
  expect(L).toContain(`kept ${p}: its folder is missing and its detached HEAD ${X} is on no branch`);
  expect(L.some((l) => l.startsWith(`kept ${q}: its folder is missing (`))).toBe(true);
  expect(L.some((l) => l.startsWith('pruned'))).toBe(false);
  const listed = c.git('worktree', 'list', '--porcelain');
  expect(listed).toContain(`worktree ${p}\n`);
  expect(listed).toContain(`worktree ${q}\n`);
  renameSync(p + '-away', p);
  expect(gitRun(p, 'rev-parse', 'HEAD').trim()).toBe(X);
  const r2 = await run(['worktree', 'clean'], c.root);
  expect(r2.code).toBe(0);
  const L2 = lines(r2.out);
  expect(L2.some((l) => l.startsWith(`pruned ${q}: `))).toBe(true);
  expect(L2.some((l) => l.startsWith(`kept ${p}`))).toBe(false);
  const after = c.git('worktree', 'list', '--porcelain');
  expect(after).toContain(`worktree ${p}\n`);
  expect(after).not.toContain(`worktree ${q}\n`);
}, 120_000);

it('risk:data-loss worktree open re-creates a ticket worktree whose folder was deleted while a missing folder holds a detached head on no branch', async () => {
  const c = copy({ tickets: ['ST-9', 'ST-10'] });
  const p = c.sibling('scratch');
  const s = c.sibling('ST-9');
  const q = c.sibling('elsewhere');
  c.git('worktree', 'add', '-q', '--detach', p, 'origin/main');
  writeFiles(p, { 'x.txt': 'x\n' });
  const X = commitMsg(p, 'detached work');
  renameSync(p, p + '-away');
  claimWorktree(c, 'ST-9');
  const sha9 = sha(c, 't/ST-9');
  rmSync(s, { recursive: true, force: true });
  const r = await run(['worktree', 'open', 'ST-9', '--continue'], c.root);
  expect(r.code).toBe(0);
  expect(lines(r.out).some((l) => l.startsWith('pruned'))).toBe(false);
  expect(gitRun(s, 'branch', '--show-current').trim()).toBe('t/ST-9');
  expect(gitRun(s, 'rev-parse', 'HEAD').trim()).toBe(sha9);
  const list = c.git('worktree', 'list', '--porcelain');
  expect(list.split('worktree ' + s + '\n').length).toBe(2);
  expect(list).toContain(`worktree ${p}\nHEAD ${X}\n`);
  expect(recorded(c)).toEqual([{ id: 'ST-9', path: s }]);
  c.git('worktree', 'add', '-q', '-b', 't/ST-10', q, 'origin/main');
  renameSync(q, q + '-away');
  const r2 = await run(['worktree', 'open', 'ST-10', '--continue'], c.root);
  expect(r2.code).toBe(2);
  expect(r2.err).toContain(`ST-10: its branch t/ST-10 is checked out in ${q}, whose folder is missing`);
  expect(r2.err).not.toContain('prune');
  expect(gone(c.sibling('ST-10'))).toBe(true);
  const list2 = c.git('worktree', 'list', '--porcelain');
  expect(list2).toContain(`worktree ${q}\n`);
  expect(list2).toContain(`worktree ${p}\nHEAD ${X}\n`);
  gitRun(s, 'switch', '-q', '--detach');
  writeFiles(s, { 'y.txt': 'y\n' });
  const Y = commitMsg(s, 'detached on the sibling');
  renameSync(s, s + '-away');
  const r3 = await run(['worktree', 'open', 'ST-9', '--continue'], c.root);
  expect(r3.code).toBe(2);
  expect(r3.err).toContain(`ST-9: git still registers a worktree at ${s}, whose folder is missing`);
  expect(r3.err).not.toContain('prune');
  expect(gone(s)).toBe(true);
  const list3 = c.git('worktree', 'list', '--porcelain');
  expect(list3).toContain(`worktree ${s}\nHEAD ${Y}\n`);
  expect(list3).toContain(`worktree ${p}\nHEAD ${X}\n`);
  expect(recorded(c)).toEqual([{ id: 'ST-9', path: s }]);
}, 120_000);

it('risk:data-loss clean keeps a done worktree that holds another listed worktree', async () => {
  const c = copy();
  claimWorktree(c, 'ST-9');
  const n = c.sibling('ST-9') + '/node_modules/nested';
  c.git('worktree', 'add', '-q', '-b', 'scratch', n, 'origin/main');
  doneOnRemote(c, ['ST-9']);
  const r = await run(['worktree', 'clean'], c.root);
  expect(r.code).toBe(0);
  expect(lines(r.out)).toContain(`kept ${c.sibling('ST-9')}: it holds the worktree ${n}`);
  const listed = c.git('worktree', 'list', '--porcelain');
  expect(listed).toContain(`worktree ${c.sibling('ST-9')}\n`);
  expect(listed).toContain(`worktree ${n}\n`);
  expect(existsSync(`${n}/accord/config.yml`)).toBe(true);
}, 120_000);

it('risk:data-loss clean keeps a done worktree whose disposable folder holds a nested repository', async () => {
  const c = copy();
  exclude(c, ['dist/']);
  claimWorktree(c, 'ST-9');
  const n = c.sibling('ST-9') + '/dist/pkg';
  mkdirSync(n, { recursive: true });
  gitRun(n, 'init', '-q');
  writeFiles(n, { 'a.txt': 'a\n' });
  const N = commitMsg(n, 'nested work');
  doneOnRemote(c, ['ST-9']);
  const r = await run(['worktree', 'clean'], c.root);
  expect(r.code).toBe(0);
  const L = lines(r.out);
  expect(L).toContain(`kept ${c.sibling('ST-9')}: dist/pkg/.git`);
  expect(L.some((l) => l.startsWith(`removed ${c.sibling('ST-9')}`))).toBe(false);
  expect(c.git('worktree', 'list', '--porcelain')).toContain(`worktree ${c.sibling('ST-9')}\n`);
  expect(gitRun(n, 'rev-parse', 'HEAD').trim()).toBe(N);
}, 120_000);

it('risk:data-loss clean keeps a done worktree holding an edit in a skip-worktree or assume-unchanged file', async () => {
  const c = copy({ tickets: ['ST-9', 'ST-10'] });
  claimWorktree(c, 'ST-9');
  claimWorktree(c, 'ST-10');
  const s9 = c.sibling('ST-9');
  gitRun(s9, 'update-index', '--skip-worktree', 'ST-9.txt');
  writeFileSync(`${s9}/ST-9.txt`, 'edited\n');
  const s10 = c.sibling('ST-10');
  gitRun(s10, 'update-index', '--assume-unchanged', 'ST-10.txt');
  writeFileSync(`${s10}/ST-10.txt`, 'edited\n');
  doneOnRemote(c, ['ST-9', 'ST-10']);
  const r = await run(['worktree', 'clean'], c.root);
  expect(r.code).toBe(0);
  const L = lines(r.out);
  expect(L).toContain(`kept ${s9}: ST-9.txt`);
  expect(L).toContain(`kept ${s10}: ST-10.txt`);
  expect(L.some((l) => l.startsWith('removed'))).toBe(false);
  const listed = c.git('worktree', 'list', '--porcelain');
  expect(listed).toContain(`worktree ${s9}\n`);
  expect(listed).toContain(`worktree ${s10}\n`);
  expect(readFileSync(`${s9}/ST-9.txt`, 'utf8')).toBe('edited\n');
  expect(readFileSync(`${s10}/ST-10.txt`, 'utf8')).toBe('edited\n');
}, 120_000);

it('risk:data-loss a forgotten folder holding a listed worktree or a git folder is kept unchanged', async () => {
  const c = copy({ tickets: ['ST-9', 'ST-10'] });
  for (const id of ['ST-9', 'ST-10']) {
    expect((await run(['worktree', 'open', id], c.root)).code).toBe(0);
    forget(c, id);
  }
  const inner = c.sibling('ST-9') + '/inner';
  c.git('worktree', 'add', '-q', '-b', 'scratch', inner, 'origin/main');
  mkdirSync(`${c.sibling('ST-9')}/empty`);
  mkdirSync(`${c.sibling('ST-10')}/sub/.git`, { recursive: true });
  link(`${c.root}/accord`, `${c.sibling('ST-10')}/l`);
  doneOnRemote(c, ['ST-9', 'ST-10']);
  const before9 = listing(c.sibling('ST-9'));
  const before10 = listing(c.sibling('ST-10'));
  const r = await run(['worktree', 'clean'], c.root);
  expect(r.code).toBe(0);
  const L = lines(r.out);
  expect(L).toContain(`kept ${c.sibling('ST-9')}: inner`);
  expect(L).toContain(`kept ${c.sibling('ST-10')}: sub/.git`);
  expect(listing(c.sibling('ST-9'))).toEqual(before9);
  expect(listing(c.sibling('ST-10'))).toEqual(before10);
  expect(c.git('worktree', 'list', '--porcelain')).toContain(`worktree ${inner}\n`);
}, 120_000);

it('risk:data-loss the sibling sweep deletes an unrecorded leftover of a done ticket and keeps one holding a file', async () => {
  const c = copy({ tickets: ['ST-9', 'ST-10', 'ST-11'] });
  mkdirSync(`${c.sibling('ST-9')}/a/b`, { recursive: true });
  link(`${c.root}/accord`, `${c.sibling('ST-9')}/node_modules/w`);
  mkdirSync(c.sibling('ST-10'));
  writeFileSync(`${c.sibling('ST-10')}/notes.txt`, 'keep me\n');
  mkdirSync(`${c.sibling('ST-11')}/a`, { recursive: true });
  mkdirSync(`${c.sibling('ST-99')}/a`, { recursive: true });
  doneOnRemote(c, ['ST-9', 'ST-10']);
  const r = await run(['worktree', 'clean'], c.root);
  expect(r.code).toBe(0);
  const L = lines(r.out);
  expect(gone(c.sibling('ST-9'))).toBe(true);
  expect(L).toContain(`removed ${c.sibling('ST-9')}`);
  expect(L.filter((l) => l === `kept ${c.sibling('ST-10')}: notes.txt`).length).toBe(1);
  expect(readFileSync(`${c.sibling('ST-10')}/notes.txt`, 'utf8')).toBe('keep me\n');
  expect(existsSync(c.sibling('ST-11'))).toBe(true);
  expect(existsSync(c.sibling('ST-99'))).toBe(true);
  expect(existsSync(`${c.root}/accord/config.yml`)).toBe(true);
}, 120_000);

it('risk:concurrency a clean that finds another clean running skips with one line and a stale lock is taken over', async () => {
  const c = copy();
  claimWorktree(c, 'ST-9');
  doneOnRemote(c, ['ST-9']);
  mkdirSync(`${c.root}/.git/accord`, { recursive: true });
  const lock = `${c.root}/.git/accord/clean.lock`;
  writeFileSync(lock, String(process.pid));
  const held = await run(['worktree', 'clean'], c.root);
  expect(held.code).toBe(0);
  expect(lines(held.out)).toHaveLength(1);
  expect(held.out.startsWith('clean skipped: another accord worktree clean is running')).toBe(true);
  expect(existsSync(c.sibling('ST-9'))).toBe(true);
  const ended = spawnSync(process.execPath, ['-e', ''], { encoding: 'utf8' });
  writeFileSync(lock, String(ended.pid));
  const taken = await run(['worktree', 'clean'], c.root);
  expect(taken.code).toBe(0);
  expect(lines(taken.out)).toContain(`removed ${c.sibling('ST-9')}`);
  expect(gone(c.sibling('ST-9'))).toBe(true);
  expect(gone(lock)).toBe(true);
}, 120_000);

it('risk:complex-branching the hook clean starts no removal once its time budget is spent and says the rest waits', async () => {
  const c = copy();
  claimWorktree(c, 'ST-9');
  doneOnRemote(c, ['ST-9']);
  vi.mocked(limit.cleanBudgetMs).mockReturnValue(0);
  const r = await run(['hook', 'session-start'], c.root, {}, startInput(c));
  expect(r.code).toBe(0);
  const L = lines(r.out);
  const stopped = L.indexOf('clean stopped: its time budget is spent; the rest waits for the next session start');
  expect(stopped).toBeGreaterThan(-1);
  expect(L.indexOf('tell the owner the lines above')).toBeGreaterThan(stopped);
  expect(L.some((l) => l.startsWith('removed') || l.startsWith('deleted'))).toBe(false);
  expect(existsSync(c.sibling('ST-9'))).toBe(true);
  expect(has(c.root, 'refs/heads/t/ST-9')).toBe(true);
  expect(has(c.remote, 'refs/heads/t/ST-9')).toBe(true);
}, 120_000);

it('risk:data-loss a hook run for another repository judges with that repository config even when its fetch fails', async () => {
  const a = copy();
  const b = copy();
  const cfg = `${a.root}/accord/config.yml`;
  writeFileSync(cfg, readFileSync(cfg, 'utf8').trimEnd() + '\ndisposable: [node_modules, .env]\n');
  exclude(b, ['.env']);
  claimWorktree(b, 'ST-9');
  writeFiles(b.sibling('ST-9'), { '.env': 'SECRET=1\n' });
  doneOnRemote(b, ['ST-9']);
  b.git('fetch', '-q', 'origin');
  b.git('remote', 'set-url', 'origin', b.remote + '-missing');
  const r = await run(['hook', 'session-start'], a.root, {}, JSON.stringify({ session_id: 'sess-B', cwd: b.root, source: 'startup' }));
  expect(r.code).toBe(0);
  expect(lines(r.out)).toContain(`kept ${b.sibling('ST-9')}: .env`);
  expect(readFileSync(`${b.sibling('ST-9')}/.env`, 'utf8')).toBe('SECRET=1\n');
  expect(b.git('worktree', 'list', '--porcelain')).toContain(`worktree ${b.sibling('ST-9')}\n`);
}, 120_000);
