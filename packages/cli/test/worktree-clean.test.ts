// ST-LN-7, ST-LN-20, ST-LN-34, ST-LN-55: `accord worktree clean` of merged, pruned and dropped tickets, and the session-start hook that runs it, against real git in tmp sandboxes with a bare remote.
import { chmodSync, existsSync, mkdirSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { expect, it, vi } from 'vitest';
import * as proc from '../src/load/proc.js';
import { laneTicket } from '../../../test/helpers/lane.js';
import { ALIVE, gone, runWhole } from './helpers/done.js';
import { commitMsg, gitRun, run, writeFiles } from './helpers/repo.js';
import { claimWorktree, clone, copy, DEAD, doneOnRemote, dropAndMerge, dropOnRemote, has, lines, LIVE, readHolds, recorder, sha, ticketBranches, ticketWorktree, useSandboxes, worktreeAndSshRemote, writeHolds, type Clone } from './helpers/worktree.js';

vi.mock('../src/load/proc.js', async (orig) => {
  const real = await orig<typeof import('../src/load/proc.js')>();
  return { ...real, processTable: vi.fn(real.processTable) };
});
vi.mock('../src/commands/fetch-limit.js', async (orig) => {
  const real = await orig<typeof import('../src/commands/fetch-limit.js')>();
  return { ...real, fetchLimitMs: vi.fn(real.fetchLimitMs) };
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
    expect(lines(q.out)[1]).toBe(`deleted t/ST-9 (was ${sha9d})`);
    expect(lines(q.out)[2]).toBe(`deleted origin/t/ST-9 (was ${t['ST-9']})`);
    expect(q.out.startsWith(`removed ${d.sibling('ST-9')} in part: git worktree remove failed: `)).toBe(true);
    expect(lines(q.out)[0]!.endsWith(' - delete what is left of the folder by hand')).toBe(true);
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
