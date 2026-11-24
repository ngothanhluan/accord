// Phase 08.9 D-07, split from worktree-clean.test.ts: merged and done clean, the fetch and its ssh settings, and non-ticket branches of `accord worktree clean` (ST-LN-7, ST-LN-20, ST-LN-87).
import { chmodSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { afterEach, expect, it, vi } from 'vitest';
import * as limit from '../src/commands/fetch-limit.js';
import { nextLine } from '../src/commands/next-action.js';
import * as proc from '../src/load/proc.js';
import { spawnLog } from './helpers/git-spawns.js';
import { commitMsg, gitRun, run, writeFiles } from './helpers/repo.js';
import { clone, copy, DEAD, doneOnRemote, has, lines, pushMain, readHolds, recorder, sha, ticketWorktree, useSandboxes, withAction, worktreeAndSshRemote, writeHolds } from './helpers/worktree.js';

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
]);

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
  expect(l[1]).toBe(withAction(`removed ${c.sibling('ST-9')}`));
  expect(l).toHaveLength(3);
  expect(l[2]).toBe(withAction(`deleted t/ST-9 (was ${b9})`));
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
  expect(lines(out)).toEqual([withAction(`kept ${c.sibling('ST-10')}: uncommitted work`), withAction(`kept t/ST-10: checked out in ${c.sibling('ST-10')}`), withAction('kept t/ST-9: it has commits after its verified commit')]);
  expect(existsSync(`${c.sibling('ST-10')}/new.txt`)).toBe(true);
  expect(existsSync(c.sibling('ST-9'))).toBe(true);

  const d = copy();
  ticketWorktree(d, 'ST-9');
  doneOnRemote(d, ['ST-9']);
  const r = await run(['worktree', 'clean'], d.sibling('ST-9'), {});
  expect(lines(r.out)).toEqual([withAction(`kept ${d.sibling('ST-9')}: this session's worktree`), withAction(`kept t/ST-9: checked out in ${d.sibling('ST-9')}`)]);
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
  expect(lines(r.out)[1]).toBe(withAction(`kept t/ST-9: checked out in ${c.sibling('ST-9')}`));
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
    expect(lines(q.out)[1]).toBe(withAction(`deleted t/ST-9 (was ${sha9d})`));
    expect(lines(q.out)[2]).toBe(withAction(`deleted origin/t/ST-9 (was ${t['ST-9']})`));
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
    `pruned ${c.sibling('ST-9')}: ${reason} - ${nextLine('pruned')}`,
    withAction(`removed ${c.sibling('ST-10')}`),
    withAction(`deleted t/ST-10 (was ${base})`),
    withAction(`deleted t/ST-9 (was ${base})`),
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
    expect(out).toContain(withAction(`kept t/${id}: checked out in ${c.sibling(id)}`));
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

it('risk:data-loss accord worktree clean leaves a live task worktree and its branch (ST-LN-92 92-ac-2)', async () => {
  const c = copy();
  ticketWorktree(c, 'ST-9');
  // made with git as `accord worktree task open` would (the running version is below the 0.6.0 cut-off until the release); its commit is in no other branch
  const task = `${c.sibling('ST-9')}+t2`;
  gitRun(c.sibling('ST-9'), 'worktree', 'add', '-q', '-b', 'accord-task/ST-9/2', task, 'HEAD');
  writeFiles(task, { 'task2.txt': 'task 2\n' });
  const work = commitMsg(task, 'task 2');
  doneOnRemote(c, ['ST-9']);
  const { code, out } = await run(['worktree', 'clean'], c.root, {});
  expect(code).toBe(0);
  expect(lines(out)).toContain(withAction(`removed ${c.sibling('ST-9')}`));
  expect(existsSync(c.sibling('ST-9'))).toBe(false);
  expect(existsSync(task)).toBe(true);
  expect(c.git('rev-parse', 'refs/heads/accord-task/ST-9/2').trim()).toBe(work);
  expect(readFileSync(`${task}/task2.txt`, 'utf8')).toBe('task 2\n');
  expect(out).not.toContain('accord-task/');
});

it('risk:data-loss the clean removes merged non-ticket branches and keeps unmerged ones (ST-LN-87 7-ac-12)', async () => {
  const c = copy();
  // seven branches, each with one commit of its own, all pushed
  const names = ['backlog/a', 'fix/b', 'release/c', 'backlog/d', 'fix/e', 'ci/x', 'pr1'];
  for (const n of names) {
    c.git('switch', '-q', '-c', n, 'main');
    writeFiles(c.root, { [`${n.replace('/', '-')}.txt`]: n + '\n' });
    c.git('add', '-A');
    c.git('commit', '-q', '-m', n);
    c.git('push', '-q', 'origin', n);
    c.git('switch', '-q', 'main');
  }
  // a teammate merges all but backlog/d: a merge commit for most, a squash for fix/b
  const o = c.otherClone();
  gitRun(o, 'fetch', '-q', 'origin');
  for (const n of ['backlog/a', 'release/c', 'fix/e', 'ci/x', 'pr1']) gitRun(o, 'merge', '-q', '--no-ff', '-m', 'merge ' + n, `origin/${n}`);
  gitRun(o, 'merge', '--squash', '-q', 'origin/fix/b');
  commitMsg(o, 'squash fix/b');
  gitRun(o, 'push', '-q', 'origin', 'main');
  // release/c is checked out in an agent folder; fix/e is checked out in one that holds an uncommitted file
  const agent = `${c.root}/.claude/worktrees/agent-1`;
  const held = `${c.root}/.claude/worktrees/agent-2`;
  c.git('worktree', 'add', '-q', agent, 'release/c');
  c.git('worktree', 'add', '-q', held, 'fix/e');
  writeFileSync(`${held}/new.txt`, 'new');
  const at = Object.fromEntries(names.map((n) => [n, sha(c, `refs/heads/${n}`)]));
  const { code, out } = await run(['worktree', 'clean'], c.root, {});
  expect(code).toBe(0);
  expect(lines(out).sort()).toEqual(
    [
      withAction(`removed ${agent}`),
      withAction(`deleted backlog/a: merged into origin/main (was ${at['backlog/a']})`),
      withAction(`deleted fix/b: merged into origin/main (was ${at['fix/b']})`),
      withAction(`deleted release/c: merged into origin/main (was ${at['release/c']})`),
      withAction('kept backlog/d: it has commits origin/main lacks'),
      withAction(`kept ${held}: uncommitted work`),
      withAction(`kept fix/e: checked out in ${held}`),
    ].sort(),
  );
  for (const n of ['backlog/a', 'fix/b', 'release/c']) expect(has(c.root, `refs/heads/${n}`), n).toBe(false);
  for (const n of ['backlog/d', 'fix/e', 'ci/x', 'pr1']) expect(has(c.root, `refs/heads/${n}`), n).toBe(true);
  expect(existsSync(agent)).toBe(false);
  expect(existsSync(`${held}/new.txt`)).toBe(true);
  // no remote branch is deleted, and the two other names are never mentioned
  for (const n of names) expect(has(c.remote, `refs/heads/${n}`), `origin ${n}`).toBe(true);
  expect(out).not.toContain('ci/x');
  expect(out).not.toContain('pr1');
}, 120_000);

it('risk:data-loss the clean keeps a fresh branch with no commit of its own, and its worktree (ST-LN-87 7-ac-12)', async () => {
  const c = copy();
  // cut from origin's default branch, nothing edited yet: one branch at its tip, one cut before another commit landed there
  const rel = `${c.root}/.claude/worktrees/agent-rel`;
  const fix = `${c.root}/.claude/worktrees/agent-fix`;
  c.git('worktree', 'add', '-q', '-b', 'release/0.8.0', rel, 'origin/main');
  c.git('worktree', 'add', '-q', '-b', 'fix/old', fix, 'origin/main');
  pushMain(c, 'later.txt', 'later\n');
  const at = { rel: sha(c, 'refs/heads/release/0.8.0'), fix: sha(c, 'refs/heads/fix/old') };
  const { code, out } = await run(['worktree', 'clean'], c.root, {});
  expect(code).toBe(0);
  expect(lines(out)).toEqual(expect.arrayContaining([withAction('kept release/0.8.0: it has no commit of its own'), withAction('kept fix/old: it has no commit of its own')]));
  expect(lines(out).filter((l) => /^(deleted|removed) /.test(l))).toEqual([]);
  for (const n of ['release/0.8.0', 'fix/old']) expect(has(c.root, `refs/heads/${n}`), n).toBe(true);
  expect(sha(c, 'refs/heads/release/0.8.0')).toBe(at.rel);
  expect(sha(c, 'refs/heads/fix/old')).toBe(at.fix);
  expect(existsSync(rel)).toBe(true);
  expect(existsSync(fix)).toBe(true);
}, 120_000);

it('risk:data-loss the clean keeps a fresh branch that has no worktree, and still deletes a merged one (ST-LN-87 7-ac-12)', async () => {
  const c = copy();
  c.git('branch', 'backlog/z', 'origin/main');
  // a branch with a commit of its own that a teammate merged with a merge commit is still deleted
  c.git('switch', '-q', '-c', 'backlog/a', 'main');
  writeFiles(c.root, { 'backlog-a.txt': 'a\n' });
  c.git('add', '-A');
  c.git('commit', '-q', '-m', 'backlog/a');
  c.git('push', '-q', 'origin', 'backlog/a');
  c.git('switch', '-q', 'main');
  const o = c.otherClone();
  gitRun(o, 'fetch', '-q', 'origin');
  gitRun(o, 'merge', '-q', '--no-ff', '-m', 'merge backlog/a', 'origin/backlog/a');
  gitRun(o, 'push', '-q', 'origin', 'main');
  const z = sha(c, 'refs/heads/backlog/z');
  const a = sha(c, 'refs/heads/backlog/a');
  const { code, out } = await run(['worktree', 'clean'], c.root, {});
  expect(code).toBe(0);
  expect(lines(out).sort()).toEqual(
    [withAction('kept backlog/z: it has no commit of its own'), withAction(`deleted backlog/a: merged into origin/main (was ${a})`)].sort(),
  );
  expect(sha(c, 'refs/heads/backlog/z')).toBe(z);
  expect(has(c.root, 'refs/heads/backlog/a')).toBe(false);
}, 120_000);
