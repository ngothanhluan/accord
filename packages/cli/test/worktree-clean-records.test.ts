// Phase 08.9 D-07, split from worktree-clean.test.ts: recorded and forgotten worktrees, the clean lock and the session-start hook of `accord worktree clean` (ST-LN-55).
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { afterEach, expect, it, vi } from 'vitest';
import * as limit from '../src/commands/fetch-limit.js';
import * as proc from '../src/load/proc.js';
import { ALIVE, exclude, forget, gone, recorded, runWhole, startInput } from './helpers/done.js';
import { spawnLog } from './helpers/git-spawns.js';
import { commitMsg, gitRun, run, writeFiles } from './helpers/repo.js';
import { claimWorktree, copy, DEAD, doneOnRemote, dropOnRemote, has, lines, LIVE, sha, useSandboxes, withAction, writeHolds } from './helpers/worktree.js';

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
  { tickets: ['ST-9', 'ST-10', 'ST-11', 'ST-12'] },
]);

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
  const removed = L.indexOf(withAction(`removed ${c.sibling('ST-9')}`));
  expect(removed).toBeGreaterThan(-1);
  expect(L.indexOf('tell the owner the lines above')).toBeGreaterThan(removed);
  expect(gone(c.sibling('ST-9'))).toBe(true);
}, 120_000);

it('risk:regression worktree open on an existing branch and new ticket in a worktree both record the worktree', async () => {
  const c = copy({ tickets: ['ST-9', 'ST-10'] });
  c.git('branch', 't/ST-10', 'origin/main');
  const a = await run(['worktree', 'open', 'ST-10'], c.root);
  expect(a.code).toBe(0);
  const b = await run(['new', 'ticket', 'ST-11', '--lane', 'M', '--worktree', '--no-dup-check'], c.root);
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
  expect(L).toContain(withAction(`kept ${a}: its detached HEAD ${X} is on no branch`));
  expect(L).toContain(withAction(`removed ${b}`));
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
  expect(L).toContain(withAction(`kept ${c.sibling('ST-9')}: checked out on other`));
  expect(L).toContain(withAction(`kept ${c.sibling('ST-10')}: held by another session`));
  expect(L).toContain(withAction(`kept ${c.sibling('ST-12')}: held by another session`));
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
  expect(lines(r.out)).toContain(withAction(`kept ${c.sibling('ST-9')}: its ticket is dropped and its branch t/ST-9 is already on origin/main`));
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
  expect(L).toContain(withAction(`kept ${p}: its folder is missing and its detached HEAD ${X} is on no branch`));
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
  expect(lines(taken.out)).toContain(withAction(`removed ${c.sibling('ST-9')}`));
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
  const stopped = L.indexOf(withAction('clean stopped: its time budget is spent; the rest waits for the next session start'));
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
  expect(lines(r.out)).toContain(withAction(`kept ${b.sibling('ST-9')}: .env`));
  expect(readFileSync(`${b.sibling('ST-9')}/.env`, 'utf8')).toBe('SECRET=1\n');
  expect(b.git('worktree', 'list', '--porcelain')).toContain(`worktree ${b.sibling('ST-9')}\n`);
}, 120_000);

it('risk:data-loss a hook run for another repository with another accord version pin skips the clean and removes nothing', async () => {
  const a = copy();
  const b = copy();
  const cfg = `${b.root}/accord/config.yml`;
  const text = readFileSync(cfg, 'utf8');
  const pinned = text.replace(/^accord: .*$/m, 'accord: "9.9.9"');
  expect(pinned).not.toBe(text);
  writeFileSync(cfg, pinned);
  claimWorktree(b, 'ST-9');
  doneOnRemote(b, ['ST-9']);
  const r = await run(['hook', 'session-start'], a.root, {}, JSON.stringify({ session_id: 'sess-B', cwd: b.root, source: 'startup' }));
  expect(r.code).toBe(0);
  const L = lines(r.out);
  expect(L.some((l) => l.startsWith('clean skipped: ') && l.includes('9.9.9'))).toBe(true);
  expect(L.some((l) => l.startsWith('removed') || l.startsWith('deleted'))).toBe(false);
  expect(existsSync(b.sibling('ST-9'))).toBe(true);
  expect(b.git('worktree', 'list', '--porcelain')).toContain(`worktree ${b.sibling('ST-9')}\n`);
  expect(has(b.root, 'refs/heads/t/ST-9')).toBe(true);
  expect(has(b.remote, 'refs/heads/t/ST-9')).toBe(true);
}, 120_000);
