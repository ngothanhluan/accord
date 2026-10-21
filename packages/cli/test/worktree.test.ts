// ST-LN-7: `accord worktree open` against real git in tmp sandboxes with a bare remote.
import { chmodSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { afterEach, expect, it, vi } from 'vitest';
import * as proc from '../src/load/proc.js';
import { approvedHash, loadSnapshot, setFrontmatterKey } from '@accord-dev/accord-core';
import { CONFIG, laneTicket, PLAN } from '../../../test/helpers/lane.js';
import { gitRun, run, writeFiles } from './helpers/repo.js';
import { makeClone, type Clone } from './helpers/worktree.js';

vi.mock('../src/load/proc.js', async (orig) => {
  const real = await orig<typeof import('../src/load/proc.js')>();
  return { ...real, processTable: vi.fn(real.processTable) };
});

import * as limit from '../src/commands/fetch-limit.js';
vi.mock('../src/commands/fetch-limit.js', async (orig) => {
  const real = await orig<typeof import('../src/commands/fetch-limit.js')>();
  return { ...real, fetchLimitMs: vi.fn(real.fetchLimitMs) };
});

const clones: Clone[] = [];
const clone = (opts?: Parameters<typeof makeClone>[0]) => {
  const c = makeClone(opts);
  clones.push(c);
  return c;
};
afterEach(() => {
  vi.mocked(proc.processTable).mockReset();
  vi.mocked(limit.fetchLimitMs).mockReset();
  for (const c of clones.splice(0)) c.cleanupAll();
});

const entries = (c: Clone) => c.git('worktree', 'list', '--porcelain').split('\n\n').filter((e) => e.trim() !== '');

it('ac-1 pick up adds the ticket worktree from origin main runs setup in order and prints where to continue', async () => {
  const c = clone({ setup: ['node setup-step.js ci', 'node setup-step.js build'] });
  c.git('switch', '-q', '-c', 'other');
  writeFiles(c.root, { 'more.txt': 'x\n' });
  c.git('add', '-A');
  c.git('commit', '-q', '-m', 'more');
  const { code, out } = await run(['worktree', 'open', 'ST-9'], c.root);
  expect(code).toBe(0);
  expect(c.git('worktree', 'list', '--porcelain')).toContain(`worktree ${c.sibling('ST-9')}\n`);
  expect(c.git('worktree', 'list', '--porcelain')).toContain('branch refs/heads/t/ST-9');
  expect(c.git('rev-parse', 't/ST-9^').trim()).toBe(c.git('rev-parse', 'origin/main').trim());
  expect(c.git('log', '-1', '--format=%s', 't/ST-9').trim()).toBe('claim: ST-9');
  expect(readFileSync(`${c.sibling('ST-9')}/setup.log`, 'utf8')).toBe('ci\nbuild\n');
  expect(out.split('\n').slice(0, 3)).toEqual([
    'stop: open a session in this folder and type the line below it',
    c.sibling('ST-9'),
    '/accord continue ST-9',
  ]);
  expect(out).not.toMatch(/claude|cursor|codex|copilot/i);
  expect(c.git('branch', '--show-current').trim()).toBe('other');
});

it('ac-2 a failing setup command exits 2 naming it and keeps the worktree', async () => {
  const c = clone({ setup: ['node setup-step.js ci', 'node setup-step.js fail'] });
  const { code, out, err } = await run(['worktree', 'open', 'ST-9'], c.root);
  expect(code).toBe(2);
  expect(err).toContain('node setup-step.js fail');
  expect(err).toContain('boom');
  expect(existsSync(c.sibling('ST-9'))).toBe(true);
  expect(readFileSync(`${c.sibling('ST-9')}/setup.log`, 'utf8')).toBe('ci\nfail\n');
  for (const s of [out, err]) {
    expect(s).not.toContain(c.sibling('ST-9'));
    expect(s).not.toContain('/accord continue');
  }
});

it('risk:security a ticket id cannot place a worktree outside its sibling folder', async () => {
  const c = clone();
  for (const id of ['../x', 'a/b', 'ST-99']) expect((await run(['worktree', 'open', id], c.root)).code, id).toBe(2);
  expect(entries(c)).toHaveLength(1);
  expect(c.git('branch', '--format=%(refname:short)').trim()).toBe('main');
});

it('risk:complex-branching pick up refuses a ticket that origin main lacks', async () => {
  const c = clone();
  writeFiles(c.root, { 'accord/tickets/ST-30.md': laneTicket('ST-30') });
  const { code, err } = await run(['worktree', 'open', 'ST-30'], c.root);
  expect(code).toBe(2);
  expect(err).toContain('ST-30 is not on origin/main');
  expect(entries(c)).toHaveLength(1);
  expect(() => c.git('rev-parse', '--verify', '-q', 'refs/heads/t/ST-30')).toThrow();
  expect(existsSync(c.sibling('ST-30'))).toBe(false);
  expect(c.git('log', '--all', '--format=%s')).not.toContain('claim:');
});

const stopLines = (path: string, id: string) => [
  'stop: open a session in this folder and type the line below it',
  path,
  `/accord continue ${id}`,
];

it('ac-3 continue from another checkout reuses the worktree holding the branch', async () => {
  const c = clone({ setup: ['node setup-step.js ci'] });
  const hand = `${c.root}-ln9`;
  c.git('worktree', 'add', '-q', '-b', 't/ST-9', hand, 'origin/main');
  const before = entries(c);
  const { code, out } = await run(['worktree', 'open', 'ST-9', '--continue'], c.root);
  expect(code).toBe(0);
  expect(out.split('\n').slice(0, 3)).toEqual(stopLines(hand, 'ST-9'));
  expect(existsSync(`${hand}/setup.log`)).toBe(false);
  expect(entries(c)).toEqual(before);
  expect(existsSync(c.sibling('ST-9'))).toBe(false);
  expect(c.git('branch', '--show-current').trim()).toBe('main');
});

it('risk:complex-branching continue reaches a ticket whose file is only on its branch here or on origin', async () => {
  // (a) the branch is checked out in the sibling worktree, the ticket file only there
  const a = clone({ setup: ['node setup-step.js ci'], tickets: [] });
  a.git('worktree', 'add', '-q', '-b', 't/ST-9', a.sibling('ST-9'), 'origin/main');
  writeFiles(a.sibling('ST-9'), { 'accord/tickets/ST-9.md': laneTicket('ST-9') });
  gitRun(a.sibling('ST-9'), 'add', '-A');
  gitRun(a.sibling('ST-9'), 'commit', '-q', '-m', 'ticket');
  const ra = await run(['worktree', 'open', 'ST-9', '--continue'], a.root);
  expect(ra.code).toBe(0);
  expect(ra.out.split('\n').slice(0, 3)).toEqual(stopLines(a.sibling('ST-9'), 'ST-9'));
  expect(existsSync(`${a.root}/accord/tickets/ST-9.md`)).toBe(false);

  // (b) a local branch with the ticket file and no worktree
  const b = clone({ setup: ['node setup-step.js ci'], tickets: [] });
  b.git('switch', '-q', '-c', 't/ST-9');
  writeFiles(b.root, { 'accord/tickets/ST-9.md': laneTicket('ST-9') });
  b.git('add', '-A');
  b.git('commit', '-q', '-m', 'ticket');
  const tip = b.git('rev-parse', 't/ST-9').trim();
  b.git('switch', '-q', 'main');
  const rb = await run(['worktree', 'open', 'ST-9', '--continue'], b.root);
  expect(rb.code).toBe(0);
  expect(b.git('worktree', 'list', '--porcelain')).toContain(`worktree ${b.sibling('ST-9')}\nHEAD ${tip}\nbranch refs/heads/t/ST-9`);
  expect(readFileSync(`${b.sibling('ST-9')}/setup.log`, 'utf8')).toBe('ci\n');
  expect(rb.out.split('\n').slice(0, 3)).toEqual(stopLines(b.sibling('ST-9'), 'ST-9'));

  // (c) the branch only on origin
  const d = clone({ setup: ['node setup-step.js ci'], tickets: [] });
  const other = d.otherClone();
  gitRun(other, 'switch', '-q', '-c', 't/ST-10');
  writeFiles(other, { 'accord/tickets/ST-10.md': laneTicket('ST-10') });
  gitRun(other, 'add', '-A');
  gitRun(other, 'commit', '-q', '-m', 'ticket');
  gitRun(other, 'push', '-q', 'origin', 't/ST-10');
  d.git('fetch', '-q', 'origin');
  expect(() => d.git('rev-parse', '--verify', '-q', 'refs/heads/t/ST-10')).toThrow();
  const rd = await run(['worktree', 'open', 'ST-10', '--continue'], d.root);
  expect(rd.code).toBe(0);
  expect(gitRun(d.sibling('ST-10'), 'rev-parse', 'HEAD').trim()).toBe(d.git('rev-parse', 'origin/t/ST-10').trim());
  expect(gitRun(d.sibling('ST-10'), 'rev-parse', '--abbrev-ref', 't/ST-10@{upstream}').trim()).toBe('origin/t/ST-10');
});

it('risk:complex-branching continue never claims a ticket', async () => {
  const c = clone();
  const r1 = await run(['worktree', 'open', 'ST-9', '--continue'], c.root);
  expect(r1.code).toBe(2);
  expect(r1.err.startsWith('not claimed: ST-9')).toBe(true);
  const r2 = await run(['worktree', 'open', 'ST-77', '--continue'], c.root);
  expect(r2.code).toBe(2);
  expect(r2.err.startsWith('not a ticket: ST-77')).toBe(true);
  expect(entries(c)).toHaveLength(1);
  expect(c.git('branch', '--format=%(refname:short)').trim()).toBe('main');
  expect(c.git('log', '--all', '--format=%s')).not.toContain('claim:');
  expect(existsSync(c.sibling('ST-9'))).toBe(false);
});

it('risk:complex-branching continue prunes a worktree whose folder was deleted by hand', async () => {
  const c = clone({ setup: ['node setup-step.js ci'] });
  c.git('worktree', 'add', '-q', '-b', 't/ST-9', c.sibling('ST-9'), 'origin/main');
  rmSync(c.sibling('ST-9'), { recursive: true, force: true });
  const reason = /^prunable (.*)$/m.exec(c.git('worktree', 'list', '--porcelain'))?.[1] ?? 'no reason given';
  const { code, out } = await run(['worktree', 'open', 'ST-9', '--continue'], c.root);
  expect(code).toBe(0);
  expect(out.split('\n').filter((l) => l !== '')).toEqual([`pruned ${c.sibling('ST-9')}: ${reason}`, ...stopLines(c.sibling('ST-9'), 'ST-9')]);
  expect(out).not.toContain('repair');
  expect(readFileSync(`${c.sibling('ST-9')}/setup.log`, 'utf8')).toBe('ci\n');
  const list = c.git('worktree', 'list', '--porcelain');
  expect(list).toContain(`worktree ${c.sibling('ST-9')}\n`);
  expect(list).toContain('branch refs/heads/t/ST-9');
  expect(list).not.toMatch(/^prunable/m);
});

const A = { pid: 7001, start: 'S-A', marker: 'sess-A' };
const B = { pid: 7002, start: 'S-B', marker: 'sess-B' };
const envOf = (s: { marker: string; pid: number }) => ({ CLAUDECODE: '1', CLAUDE_CODE_SESSION_ID: s.marker, CLAUDE_PID: String(s.pid) });
const tableOf = (s: { pid: number; start: string }, ...others: { pid: number; start: string }[]) => [
  { pid: process.pid, ppid: s.pid, start: 'self' },
  { pid: s.pid, ppid: 1, start: s.start },
  ...others.map((o) => ({ pid: o.pid, ppid: 1, start: o.start })),
];
const setTable = (rows: ReturnType<typeof tableOf>) => vi.mocked(proc.processTable).mockReturnValue(rows);
const holdsFile = (c: Clone) => `${c.root}/.git/accord/holds`;
const HELD = 'held: ST-9 by this session\n';

it('ac-4 a live holder refuses a second session and a dead holder is taken over', async () => {
  const c = clone();
  expect((await run(['worktree', 'open', 'ST-9'], c.root)).code).toBe(0);
  const sib = c.sibling('ST-9');
  setTable(tableOf(A));
  const r1 = await run(['worktree', 'open', 'ST-9', '--continue'], sib, envOf(A));
  expect(r1.code).toBe(0);
  expect(r1.out).toBe(HELD);
  const bytes = readFileSync(holdsFile(c), 'utf8');
  const taken = JSON.parse(bytes)['ST-9'].taken as string;
  expect(JSON.parse(bytes)['ST-9']).toMatchObject({ tool: 'Claude Code', marker: 'sess-A' });
  setTable(tableOf(B, A));
  const r2 = await run(['worktree', 'open', 'ST-9', '--continue'], sib, envOf(B));
  expect(r2.code).toBe(2);
  expect(r2.err).toContain('Claude Code');
  expect(r2.err).toContain('sess-A');
  expect(r2.err).toContain(taken);
  expect(readFileSync(holdsFile(c), 'utf8')).toBe(bytes);
  setTable(tableOf(B));
  const r3 = await run(['worktree', 'open', 'ST-9', '--continue'], sib, envOf(B));
  expect(r3.code).toBe(0);
  expect(r3.out).toBe(HELD);
  expect(JSON.parse(readFileSync(holdsFile(c), 'utf8'))['ST-9'].marker).toBe('sess-B');
});

it('risk:complex-branching the holding session re-enters its own hold and a partial table refuses', async () => {
  const c = clone();
  await run(['worktree', 'open', 'ST-9'], c.root);
  const sib = c.sibling('ST-9');
  setTable(tableOf(A));
  await run(['worktree', 'open', 'ST-9', '--continue'], sib, envOf(A));
  const first = readFileSync(holdsFile(c), 'utf8');
  const taken = JSON.parse(first)['ST-9'].taken as string;
  const again = async (s: { marker: string; pid: number }, rows: ReturnType<typeof tableOf>) => {
    writeFileSync(holdsFile(c), first); // each case is judged against A's hold alone
    setTable(rows);
    const r = await run(['worktree', 'open', 'ST-9', '--continue'], sib, envOf(s));
    expect(r.code).toBe(0);
    expect(r.out).toBe(HELD);
    expect(JSON.parse(readFileSync(holdsFile(c), 'utf8'))['ST-9'].taken).toBe(taken);
  };
  await again(A, tableOf(A));
  await again({ ...A, marker: 'sess-A2' }, tableOf(A));
  const C = { pid: 7003, start: 'S-C', marker: 'sess-A' };
  await again(C, tableOf(C, A));
  // B takes over once A and C have stopped; a session that cannot see itself must then not judge
  setTable(tableOf(B));
  expect((await run(['worktree', 'open', 'ST-9', '--continue'], sib, envOf(B))).code).toBe(0);
  const bytes = readFileSync(holdsFile(c), 'utf8');
  setTable([{ pid: process.pid, ppid: 1, start: 'self' }]);
  const r = await run(['worktree', 'open', 'ST-9', '--continue'], sib, envOf(A));
  expect(r.code).toBe(2);
  expect(r.err).toContain('cannot see this Claude Code session');
  expect(readFileSync(holdsFile(c), 'utf8')).toBe(bytes);
});

it('risk:complex-branching outside claude code no hold is taken and one line says so', async () => {
  const c = clone();
  await run(['worktree', 'open', 'ST-9'], c.root);
  vi.mocked(proc.processTable).mockClear();
  const sib = c.sibling('ST-9');
  const r = await run(['worktree', 'open', 'ST-9', '--continue'], sib, {});
  expect(r.code).toBe(0);
  expect(r.out).toBe('not held: ST-9 - a second session in this worktree is not refused in this tool yet\n');
  expect(existsSync(holdsFile(c))).toBe(false);
  expect(proc.processTable).not.toHaveBeenCalled();
  const r2 = await run(['worktree', 'open', 'ST-9', '--continue'], sib, { CLAUDECODE: '1' });
  expect(r2.code).toBe(2);
  expect(r2.err).toContain('CLAUDE_CODE_SESSION_ID');
  expect(existsSync(holdsFile(c))).toBe(false);
});

it('risk:concurrency a locked hold file is never overwritten', async () => {
  const c = clone();
  await run(['worktree', 'open', 'ST-9'], c.root);
  const sib = c.sibling('ST-9');
  const lock = `${holdsFile(c)}.lock`;
  mkdirSync(`${c.root}/.git/accord`, { recursive: true });
  writeFileSync(lock, '');
  setTable(tableOf(A));
  const t0 = Date.now();
  const r = await run(['worktree', 'open', 'ST-9', '--continue'], sib, envOf(A));
  // 2 s lock wait plus the fetch Continue now runs first; a hang never returns, so 15 s still proves it
  expect(Date.now() - t0).toBeLessThan(15000);
  expect(r.code).toBe(2);
  expect(r.err).toContain('holds.lock');
  expect(existsSync(holdsFile(c))).toBe(false);
  rmSync(lock);
  expect((await run(['worktree', 'open', 'ST-9', '--continue'], sib, envOf(A))).code).toBe(0);
});

it('risk:complex-branching a worktree whose setup never finished reruns setup in full', async () => {
  const c = clone({ setup: ['node setup-step.js ci', 'node setup-step.js build'] });
  c.git('worktree', 'add', '-q', '-b', 't/ST-9', c.sibling('ST-9'), 'origin/main');
  setTable(tableOf(A));
  expect((await run(['worktree', 'open', 'ST-9', '--continue'], c.sibling('ST-9'), envOf(A))).code).toBe(0);
  expect(readFileSync(`${c.sibling('ST-9')}/setup.log`, 'utf8')).toBe('ci\nbuild\n');
  expect((await run(['worktree', 'open', 'ST-9', '--continue'], c.sibling('ST-9'), envOf(A))).code).toBe(0);
  expect(readFileSync(`${c.sibling('ST-9')}/setup.log`, 'utf8')).toBe('ci\nbuild\n');

  const d = clone({ setup: ['node setup-step.js ci', 'node setup-step.js fail'] });
  expect((await run(['worktree', 'open', 'ST-9'], d.root)).code).toBe(2);
  const marker = d.git('-C', d.sibling('ST-9'), 'rev-parse', '--path-format=absolute', '--git-dir').trim() + '/accord-setup-done';
  expect(existsSync(marker)).toBe(false);
  rmSync(`${d.sibling('ST-9')}/setup.log`);
  const r = await run(['worktree', 'open', 'ST-9', '--continue'], d.sibling('ST-9'), envOf(A));
  expect(r.code).toBe(2);
  expect(readFileSync(`${d.sibling('ST-9')}/setup.log`, 'utf8')).toBe('ci\nfail\n');
});

const DEAD = { tool: 'Claude Code', marker: 'sess-D', pid: 4141, start: 'S1', taken: '2026-10-18T00:00:00.000Z' };
const LIVE = { tool: 'Claude Code', marker: 'sess-H', pid: 4242, start: 'S2', taken: '2026-10-18T00:00:00.000Z' };
const writeHolds = (c: Clone, holds: object) => {
  mkdirSync(`${c.root}/.git/accord`, { recursive: true });
  writeFileSync(holdsFile(c), JSON.stringify(holds));
};
const readHolds = (c: Clone) => JSON.parse(readFileSync(holdsFile(c), 'utf8')) as Record<string, unknown>;
const lines = (s: string) => s.split('\n').filter((l) => l !== '');

/** A worktree `t/<id>` with one commit pushed to the remote. */
function ticketWorktree(c: Clone, id: string, file = `${id}.txt`) {
  c.git('worktree', 'add', '-q', '-b', `t/${id}`, c.sibling(id), 'origin/main');
  writeFiles(c.sibling(id), { [file]: id + '\n' });
  gitRun(c.sibling(id), 'add', '-A');
  gitRun(c.sibling(id), 'commit', '-q', '-m', id);
  gitRun(c.sibling(id), 'push', '-q', 'origin', `t/${id}`);
}
/** Merge the pushed ticket branches into the remote main from another clone; `c` does not fetch. */
function mergeOnRemote(c: Clone, ...ids: string[]) {
  const other = c.otherClone();
  gitRun(other, 'fetch', '-q', 'origin');
  for (const id of ids) gitRun(other, 'merge', '-q', '--no-ff', '-m', 'merge ' + id, `origin/t/${id}`);
  gitRun(other, 'push', '-q', 'origin', 'main');
}

/** A branch `t/<id>` with one commit, pushed and tracking `origin/t/<id>`, no worktree. */
function ticketBranch(c: Clone, id: string) {
  c.git('switch', '-q', '-c', `t/${id}`, 'main');
  writeFiles(c.root, { [`${id}.txt`]: id + '\n' });
  c.git('add', '-A');
  c.git('commit', '-q', '-m', id);
  c.git('push', '-q', '-u', 'origin', `t/${id}`);
  c.git('switch', '-q', 'main');
}
const sha = (c: Clone, ref: string) => c.git('rev-parse', ref).trim();

it('ac-5 bare accord fetches then removes merged worktrees and names what it keeps', async () => {
  const c = clone({ tickets: ['ST-9', 'ST-10', 'ST-11', 'ST-12'] });
  for (const id of ['ST-9', 'ST-10', 'ST-11', 'ST-12']) ticketWorktree(c, id);
  mergeOnRemote(c, 'ST-9', 'ST-10', 'ST-12');
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
  const c = clone();
  c.git('worktree', 'add', '-q', '-b', 't/ST-9', c.sibling('ST-9'), 'origin/main');
  c.git('remote', 'set-url', 'origin', c.remote + '-missing');
  const { code, out } = await run(['worktree', 'clean'], c.root, {});
  expect(code).toBe(0);
  const l = lines(out);
  expect(l[0].startsWith('fetch from origin failed, judging against the refs already in this clone')).toBe(true);
  expect(l[1]).toBe(`removed ${c.sibling('ST-9')}`);
  expect(l).toHaveLength(3);
  expect(l[2]).toBe(`deleted t/ST-9 (was ${sha(c, 'origin/main')})`);

  const d = clone();
  d.git('worktree', 'add', '-q', '-b', 't/ST-9', d.sibling('ST-9'), 'origin/main');
  d.git('remote', 'remove', 'origin');
  expect((await run(['worktree', 'clean'], d.root, {})).out).toBe('');
  const e = clone();
  e.git('remote', 'set-url', 'origin', e.remote + '-missing');
  const eOut = lines((await run(['worktree', 'clean'], e.root, {})).out);
  expect(eOut).toHaveLength(1);
  expect(eOut[0].startsWith('fetch from origin failed, judging against the refs already in this clone')).toBe(true);
});

it('risk:data-loss clean keeps unpushed commits and new files that git status config would hide', async () => {
  const c = clone({ tickets: ['ST-9', 'ST-10'] });
  ticketWorktree(c, 'ST-9');
  ticketWorktree(c, 'ST-10');
  mergeOnRemote(c, 'ST-9', 'ST-10');
  writeFiles(c.sibling('ST-9'), { 'more.txt': 'more\n' });
  gitRun(c.sibling('ST-9'), 'add', '-A');
  gitRun(c.sibling('ST-9'), 'commit', '-q', '-m', 'unpushed');
  c.git('config', 'status.showUntrackedFiles', 'no');
  writeFileSync(`${c.sibling('ST-10')}/new.txt`, 'new');
  const { code, out } = await run(['worktree', 'clean'], c.root, {});
  expect(code).toBe(0);
  expect(lines(out)).toEqual([`kept ${c.sibling('ST-10')}: uncommitted work`, `kept t/ST-10: checked out in ${c.sibling('ST-10')}`]);
  expect(existsSync(`${c.sibling('ST-10')}/new.txt`)).toBe(true);
  expect(existsSync(c.sibling('ST-9'))).toBe(true);

  const d = clone();
  ticketWorktree(d, 'ST-9');
  mergeOnRemote(d, 'ST-9');
  const r = await run(['worktree', 'clean'], d.sibling('ST-9'), {});
  expect(lines(r.out)).toEqual([`kept ${d.sibling('ST-9')}: this session's worktree`, `kept t/ST-9: checked out in ${d.sibling('ST-9')}`]);
  expect(existsSync(d.sibling('ST-9'))).toBe(true);
});

it('risk:complex-branching a worktree remove that fails is named truthfully', async () => {
  const c = clone();
  ticketWorktree(c, 'ST-9');
  mergeOnRemote(c, 'ST-9');
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

  if (process.platform === 'win32' || process.getuid?.() === 0) return;
  const d = clone();
  ticketWorktree(d, 'ST-9', 'sub/f.txt');
  mergeOnRemote(d, 'ST-9');
  writeHolds(d, { 'ST-9': DEAD });
  vi.mocked(proc.processTable).mockReturnValue([{ pid: process.pid, ppid: 1, start: 'self' }]);
  chmodSync(`${d.sibling('ST-9')}/sub`, 0o555);
  const sha9d = sha(d, 't/ST-9');
  try {
    const q = await run(['worktree', 'clean'], d.root, {});
    expect(lines(q.out)).toHaveLength(2);
    expect(lines(q.out)[1]).toBe(`deleted t/ST-9 (was ${sha9d})`);
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

it('ac-6 a new lane m ticket gets its own worktree with the ticket committed and pushed', async () => {
  const plain = clone({ tickets: [] });
  expect((await run(['new', 'ticket', 'ST-9', '--lane', 'M'], plain.root)).code).toBe(0);
  const text = readFileSync(`${plain.root}/accord/tickets/ST-9.md`, 'utf8');
  const c = clone({ setup: ['node setup-step.js ci'], tickets: [] });
  const base = c.git('rev-parse', 'origin/main').trim();
  const { code, out } = await run(['new', 'ticket', 'ST-9', '--lane', 'M', '--worktree'], c.root);
  expect(code).toBe(0);
  expect(c.git('worktree', 'list', '--porcelain')).toContain(`worktree ${c.sibling('ST-9')}\n`);
  expect(c.git('worktree', 'list', '--porcelain')).toContain('branch refs/heads/t/ST-9');
  expect(readFileSync(`${c.sibling('ST-9')}/setup.log`, 'utf8')).toBe('ci\n');
  expect(gitRun(c.remote, 'rev-parse', 'refs/heads/t/ST-9').trim()).toBe(gitRun(c.sibling('ST-9'), 'rev-parse', 'HEAD').trim());
  expect(c.git('show', 't/ST-9:accord/tickets/ST-9.md')).toBe(text);
  expect(c.git('rev-parse', 't/ST-9^').trim()).toBe(base);
  expect(out.split('\n').slice(0, 4)).toEqual(['accord/tickets/ST-9.md', ...stopLines(c.sibling('ST-9'), 'ST-9')]);
  expect(c.git('branch', '--show-current').trim()).toBe('main');
  expect(existsSync(`${c.root}/accord/tickets/ST-9.md`)).toBe(false);
});

it('risk:data-loss a failed push keeps the claim commit and names the quoted push to run', async () => {
  const c = clone({ setup: ['node setup-step.js ci'], tickets: [] });
  c.git('remote', 'set-url', '--push', 'origin', `${c.remote}-missing`);
  const { code, out, err } = await run(['new', 'ticket', 'ST-9', '--lane', 'M', '--worktree'], c.root);
  expect(code).toBe(2);
  expect(err).toContain(`git -C "${c.sibling('ST-9')}" push -u origin t/ST-9`);
  expect(gitRun(c.sibling('ST-9'), 'log', '-1', '--format=%s').trim()).toBe('claim: ST-9');
  expect(existsSync(`${c.sibling('ST-9')}/accord/tickets/ST-9.md`)).toBe(true);
  expect(existsSync(`${c.sibling('ST-9')}/setup.log`)).toBe(false);
  expect(out + err).not.toContain('stop:');
  c.git('remote', 'set-url', '--push', 'origin', c.remote);
  gitRun(c.sibling('ST-9'), 'push', '-u', 'origin', 't/ST-9');
  const r = await run(['worktree', 'open', 'ST-9', '--continue'], c.root);
  expect(r.code).toBe(0);
  expect(r.out.split('\n').slice(0, 3)).toEqual(stopLines(c.sibling('ST-9'), 'ST-9'));
});

it('risk:regression this repository setup builds before it relinks the accord bin', async () => {
  const { loadConfig } = await import('@accord-dev/accord-core');
  const text = readFileSync(new URL('../../../accord/config.yml', import.meta.url), 'utf8');
  const { config, findings } = loadConfig('accord/config.yml', text);
  expect(findings).toEqual([]);
  expect(config?.setup).toEqual(['npm ci', 'npm run build', 'npm rebuild @accord-dev/accord --ignore-scripts']);
});

/** A recorder git can run as an ssh program: appends its arguments to a log and fails; named `ssh` so it counts as OpenSSH. */
function recorder(c: Clone, name = 'ssh') {
  const dir = `${c.root}/.git/rec-${name}`;
  mkdirSync(dir, { recursive: true });
  const log = `${dir}/log`;
  const file = `${dir}/${name}`;
  writeFileSync(file, `#!/usr/bin/env node
require('node:fs').appendFileSync(${JSON.stringify(log)}, process.argv.slice(2).join(' ') + '\\n'); process.exit(1);
`);
  chmodSync(file, 0o755);
  return { file, seen: () => (existsSync(log) ? readFileSync(log, 'utf8') : '') };
}
function worktreeAndSshRemote(c: Clone) {
  c.git('worktree', 'add', '-q', '-b', 't/ST-9', c.sibling('ST-9'), 'origin/main');
  c.git('remote', 'set-url', 'origin', 'ssh://example.invalid/repo.git');
}

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

it('risk:data-loss new ticket worktree refuses a ticket that exists only on origin main', async () => {
  const c = clone({ tickets: [] });
  const other = c.otherClone();
  writeFiles(other, { 'accord/tickets/ST-9.md': 'teammate wrote this\n' });
  gitRun(other, 'add', '-A');
  gitRun(other, 'commit', '-q', '-m', 'ticket');
  gitRun(other, 'push', '-q', 'origin', 'main');
  c.git('fetch', '-q', 'origin');
  const { code, err } = await run(['new', 'ticket', 'ST-9', '--lane', 'M', '--worktree'], c.root);
  expect(code).toBe(2);
  expect(err).toContain('accord/tickets/ST-9.md already exists on origin/main - nothing was written');
  expect(existsSync(c.sibling('ST-9'))).toBe(false);
  expect(c.git('branch', '--list', 't/ST-9').trim()).toBe('');
  expect(gitRun(c.remote, 'show', 'main:accord/tickets/ST-9.md')).toBe('teammate wrote this\n');
});

it('risk:parsing an invalid config in the new worktree stops setup, writes no done marker, exits 2', async () => {
  const c = clone({ tickets: ['ST-9'] });
  const other = c.otherClone();
  writeFiles(other, { 'accord/config.yml': readFileSync(`${c.root}/accord/config.yml`, 'utf8') + 'setup: npm ci\n' });
  gitRun(other, 'add', '-A');
  gitRun(other, 'commit', '-q', '-m', 'bad config');
  gitRun(other, 'push', '-q', 'origin', 'main');
  c.git('fetch', '-q', 'origin');
  const { code, out, err } = await run(['worktree', 'open', 'ST-9'], c.root);
  expect(code).toBe(2);
  expect(err).toContain('accord/config.yml');
  expect(out + err).not.toContain('/accord continue');
  expect(existsSync(c.sibling('ST-9'))).toBe(true);
  const dir = gitRun(c.sibling('ST-9'), 'rev-parse', '--path-format=absolute', '--git-dir').trim();
  expect(existsSync(`${dir}/accord-setup-done`)).toBe(false);
});

it('risk:data-loss a stale holds lock keeps a merged clean worktree, names it, and clean exits 0', async () => {
  const c = clone({ tickets: ['ST-9', 'ST-10'] });
  ticketWorktree(c, 'ST-9');
  ticketWorktree(c, 'ST-10');
  mergeOnRemote(c, 'ST-9', 'ST-10');
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
  rmSync(`${c.root}/.git/accord/holds.lock`);
  writeFileSync(`${c.root}/.git/accord/holds`, '[]');
  const r = await run(['worktree', 'clean'], c.root, {});
  expect(r.code).toBe(0);
  expect(existsSync(c.sibling('ST-9'))).toBe(true);
});

it('risk:complex-branching pick up refuses a branch another person claimed and reuses one claimed by the same email', async () => {
  const c = clone({ tickets: ['ST-9', 'ST-10', 'ST-11', 'ST-12', 'ST-13'] });
  const o = c.otherClone();
  const me = ['-c', 'user.email=fixture@example.invalid'];
  gitRun(o, 'config', 'user.email', 'y@example.invalid');
  gitRun(o, ...me, 'commit', '-q', '--allow-empty', '-m', 'claim: ST-12');
  gitRun(o, 'push', '-q', 'origin', 'main');
  gitRun(o, 'switch', '-q', '-c', 't/ST-9', 'main');
  gitRun(o, 'commit', '-q', '--allow-empty', '-m', 'claim: ST-9');
  gitRun(o, 'switch', '-q', '-c', 't/ST-10', 'main');
  gitRun(o, ...me, 'commit', '-q', '--allow-empty', '-m', 'claim: ST-10');
  gitRun(o, 'commit', '-q', '--allow-empty', '-m', 'help');
  for (const [id, f] of [['ST-11', 'x.txt'], ['ST-12', 'y.txt']]) {
    gitRun(o, 'switch', '-q', '-c', 't/' + id, 'main');
    writeFiles(o, { [f]: 'x\n' });
    gitRun(o, 'add', '-A');
    gitRun(o, 'commit', '-q', '-m', 'work');
  }
  gitRun(o, 'switch', '-q', '-c', 't/ST-13', 'main');
  gitRun(o, 'commit', '-q', '--allow-empty', '-m', 'claim: ST-13');
  gitRun(o, 'push', '-q', 'origin', 't/ST-9', 't/ST-10', 't/ST-11', 't/ST-12', 't/ST-13');
  c.git('fetch', '-q', 'origin');
  // the user's own unpushed claim on a local branch must not hide the teammate's pushed one
  c.git('branch', 't/ST-13', c.git('-c', 'user.email=fixture@example.invalid', 'commit-tree', 'main^{tree}', '-p', 'main', '-m', 'claim: ST-13').trim());

  let r = await run(['worktree', 'open', 'ST-9'], c.root);
  expect(r.code).toBe(2);
  expect(r.err.startsWith('claimed: ST-9 by y@example.invalid')).toBe(true);
  expect(r.err).toContain('/accord continue ST-9');
  expect(r.out).not.toContain('stop:');
  expect(entries(c)).toHaveLength(1);
  expect(() => c.git('rev-parse', '--verify', '-q', 'refs/heads/t/ST-9')).toThrow();
  expect(existsSync(c.sibling('ST-9'))).toBe(false);

  for (const id of ['ST-11', 'ST-12']) {
    r = await run(['worktree', 'open', id], c.root);
    expect(r.code, id).toBe(2);
    expect(r.err.startsWith(`claimed: ${id} by y@example.invalid`), id).toBe(true);
    expect(existsSync(c.sibling(id)), id).toBe(false);
  }

  r = await run(['worktree', 'open', 'ST-13'], c.root);
  expect(r.code).toBe(2);
  expect(r.err.startsWith('claimed: ST-13 by y@example.invalid')).toBe(true);
  expect(existsSync(c.sibling('ST-13'))).toBe(false);

  r = await run(['worktree', 'open', 'ST-10'], c.root);
  expect(r.code).toBe(0);
  expect(r.out.split('\n').slice(0, 3)).toEqual([
    'stop: open a session in this folder and type the line below it',
    c.sibling('ST-10'),
    '/accord continue ST-10',
  ]);
  expect(gitRun(c.sibling('ST-10'), 'rev-parse', 'HEAD').trim()).toBe(c.git('rev-parse', 'origin/t/ST-10').trim());
  expect(c.git('log', '--all', '--format=%s').split('\n').filter((s) => s === 'claim: ST-10')).toHaveLength(1);

  r = await run(['worktree', 'open', 'ST-9', '--continue'], c.root);
  expect(r.code).toBe(0);
  expect(r.out.split('\n').slice(0, 3)).toEqual([
    'stop: open a session in this folder and type the line below it',
    c.sibling('ST-9'),
    '/accord continue ST-9',
  ]);
  r = await run(['worktree', 'open', 'ST-9'], c.root);
  expect(r.code).toBe(2);
  expect(r.err.startsWith('claimed: ST-9 by y@example.invalid')).toBe(true);
  expect(entries(c)).toHaveLength(3);
});

it('ac-1 bare accord deletes merged ticket branches with or without a worktree and names the checked out one it keeps', async () => {
  const c = clone({ tickets: ['ST-9', 'ST-10', 'ST-11', 'ST-12'] });
  for (const id of ['ST-9', 'ST-11', 'ST-12']) ticketBranch(c, id);
  ticketWorktree(c, 'ST-10');
  mergeOnRemote(c, 'ST-9', 'ST-10', 'ST-12');
  c.git('switch', '-q', 't/ST-12');
  const sha9 = sha(c, 't/ST-9');
  const sha10 = sha(c, 't/ST-10');
  const { code, out } = await run(['worktree', 'clean'], c.root, {});
  expect(code).toBe(0);
  expect(lines(out).sort()).toEqual(
    [`removed ${c.sibling('ST-10')}`, `deleted t/ST-9 (was ${sha9})`, `deleted t/ST-10 (was ${sha10})`, `kept t/ST-12: checked out in ${c.root}`].sort(),
  );
  expect(() => c.git('rev-parse', '--verify', '-q', 'refs/heads/t/ST-9')).toThrow();
  expect(() => c.git('rev-parse', '--verify', '-q', 'refs/heads/t/ST-10')).toThrow();
  expect(sha(c, 't/ST-11')).not.toBe('');
  expect(sha(c, 't/ST-12')).not.toBe('');
  expect(out).not.toContain('t/ST-11');
  expect(c.git('branch', '--show-current').trim()).toBe('t/ST-12');
});

it('ac-2 a merged branch whose remote branch is gone is deleted from another ticket branch with a stale local main', async () => {
  const c = clone();
  ticketBranch(c, 'ST-9');
  c.git('switch', '-q', '-c', 't/ST-20', 'main');
  writeFiles(c.root, { 'ST-20.txt': 'x\n' });
  c.git('add', '-A');
  c.git('commit', '-q', '-m', 'ST-20');
  mergeOnRemote(c, 'ST-9');
  gitRun(c.remote, 'branch', '-D', 't/ST-9');
  c.git('update-ref', '-d', 'refs/remotes/origin/t/ST-9');
  const sha9 = sha(c, 't/ST-9');
  const mainBefore = sha(c, 'main');
  expect(c.git('config', 'branch.t/ST-9.merge').trim()).toBe('refs/heads/t/ST-9');
  expect(c.git('config', 'branch.t/ST-9.remote').trim()).toBe('origin');
  expect(() => c.git('rev-parse', '--verify', '-q', 'refs/remotes/origin/t/ST-9')).toThrow();
  expect(() => c.git('merge-base', '--is-ancestor', sha9, 'main')).toThrow();
  expect(() => c.git('merge-base', '--is-ancestor', sha9, 'HEAD')).toThrow();
  const { code, out } = await run(['worktree', 'clean'], c.root, {});
  expect(code).toBe(0);
  expect(lines(out)).toEqual([`deleted t/ST-9 (was ${sha9})`]);
  expect(() => c.git('rev-parse', '--verify', '-q', 'refs/heads/t/ST-9')).toThrow();
  expect(sha(c, 'main')).toBe(mainBefore);
  expect(c.git('branch', '--show-current').trim()).toBe('t/ST-20');
});

it('ac-3 a ticket branch with a commit not on the remote main is kept and not named', async () => {
  const c = clone();
  ticketBranch(c, 'ST-9');
  mergeOnRemote(c, 'ST-9');
  c.git('switch', '-q', 't/ST-9');
  writeFiles(c.root, { 'after.txt': 'x\n' });
  c.git('add', '-A');
  c.git('commit', '-q', '-m', 'after');
  const extra = sha(c, 'HEAD');
  c.git('switch', '-q', 'main');
  const { code, out } = await run(['worktree', 'clean'], c.root, {});
  expect(code).toBe(0);
  expect(lines(out)).toEqual([]);
  expect(sha(c, 't/ST-9')).toBe(extra);
});

it('risk:data-loss a merged branch the ticket branch template does not name is never deleted', async () => {
  const c = clone();
  c.git('branch', 'backlog/notes', 'main');
  c.git('branch', 't/ST-9', 'main');
  const base = sha(c, 'main');
  const { code, out } = await run(['worktree', 'clean'], c.root, {});
  expect(code).toBe(0);
  expect(lines(out)).toEqual([`deleted t/ST-9 (was ${base})`]);
  expect(sha(c, 'backlog/notes')).toBe(base);
  expect(sha(c, 'main')).toBe(base);
});

it('risk:complex-branching a branch git refuses to delete is kept with git message and the others still go', async () => {
  const c = clone();
  c.git('branch', 't/ST-1', 'main');
  c.git('branch', 't/ST-2', 'main');
  const base = sha(c, 'main');
  mkdirSync(`${c.root}/.git/refs/heads/t`, { recursive: true });
  writeFileSync(`${c.root}/.git/refs/heads/t/ST-1.lock`, '');
  const { code, out } = await run(['worktree', 'clean'], c.root, {});
  expect(code).toBe(0);
  const l = lines(out);
  expect(l).toHaveLength(2);
  expect(l[0].startsWith('kept t/ST-1: could not be judged: ')).toBe(true);
  expect(l[0].length).toBeGreaterThan('kept t/ST-1: could not be judged: '.length);
  expect(l[1]).toBe(`deleted t/ST-2 (was ${base})`);
  expect(sha(c, 't/ST-1')).toBe(base);
});

it('ac-4 stale remote refs are pruned after a good fetch and a failed fetch prunes nothing', async () => {
  const stale = (c: Clone) => {
    c.git('push', '-q', 'origin', 'main:refs/heads/t/ST-9', 'main:refs/heads/backlog/notes');
    c.git('fetch', '-q', 'origin');
    const r = c.git('branch', '-r');
    expect(r).toContain('origin/t/ST-9');
    expect(r).toContain('origin/backlog/notes');
    gitRun(c.remote, 'branch', '-D', 't/ST-9', 'backlog/notes');
  };
  const c = clone();
  stale(c);
  const main = sha(c, 'main');
  const good = await run(['worktree', 'clean'], c.root, {});
  expect(good.code).toBe(0);
  const r = c.git('branch', '-r');
  expect(r).not.toContain('origin/t/ST-9');
  expect(r).not.toContain('origin/backlog/notes');
  expect(r).toContain('origin/main');
  expect(lines(good.out)).toEqual([
    `pruned refs/remotes/origin/backlog/notes (was ${main})`,
    `pruned refs/remotes/origin/t/ST-9 (was ${main})`,
  ]);

  const d = clone();
  stale(d);
  d.git('branch', 't/ST-9', 'origin/t/ST-9');
  const tip = sha(d, 'origin/main');
  d.git('remote', 'set-url', 'origin', d.remote + '-missing');
  const bad = await run(['worktree', 'clean'], d.root, {});
  expect(bad.code).toBe(0);
  const l = lines(bad.out);
  expect(l).toHaveLength(2);
  expect(l[0].startsWith('fetch from origin failed, judging against the refs already in this clone')).toBe(true);
  expect(l[1]).toBe(`deleted t/ST-9 (was ${tip})`);
  const r2 = d.git('branch', '-r');
  expect(r2).toContain('origin/t/ST-9');
  expect(r2).toContain('origin/backlog/notes');
});

it('risk:data-loss a prune setting cannot prune before the fetch and the pruned ref is named with its sha', async () => {
  const c = clone();
  c.git('switch', '-q', '-c', 't/ST-9', 'main');
  writeFiles(c.root, { 'ST-9.txt': 'x\n' });
  c.git('add', '-A');
  c.git('commit', '-q', '-m', 'ST-9');
  c.git('push', '-q', 'origin', 't/ST-9');
  const tip = sha(c, 'HEAD');
  c.git('switch', '-q', 'main');
  c.git('branch', '-D', 't/ST-9');
  c.git('config', 'remote.origin.prune', 'true');
  gitRun(c.remote, 'branch', '-D', 't/ST-9');
  const { code, out } = await run(['worktree', 'clean'], c.root, {});
  expect(code).toBe(0);
  expect(lines(out)).toEqual([`pruned refs/remotes/origin/t/ST-9 (was ${tip})`]);
  c.git('cat-file', '-e', tip);
});

it('risk:data-loss a failed prune says only that the prune failed and still names each ref it removed', async () => {
  const c = clone();
  c.git('push', '-q', 'origin', 'main:refs/heads/t/ST-9', 'main:refs/heads/backlog/notes');
  c.git('fetch', '-q', 'origin');
  gitRun(c.remote, 'branch', '-D', 't/ST-9', 'backlog/notes');
  writeFiles(c.root, { '.git/refs/remotes/origin/t/ST-9.lock': '' });
  const main = sha(c, 'main');
  const { code, out } = await run(['worktree', 'clean'], c.root, {});
  expect(code).toBe(0);
  const l = lines(out);
  const failed = l.filter((x) => x.startsWith('prune of origin failed'));
  expect(failed).toHaveLength(1);
  expect(failed[0].startsWith('prune of origin failed: ')).toBe(true);
  expect(failed[0]).not.toContain('stale remote refs are kept');
  const left = c.git('branch', '-r');
  for (const [b, ref] of [['t/ST-9', 'refs/remotes/origin/t/ST-9'], ['backlog/notes', 'refs/remotes/origin/backlog/notes']] as const) {
    const named = l.includes(`pruned ${ref} (was ${main})`);
    expect(named).toBe(!left.includes(`origin/${b}`));
  }
});

it('risk:data-loss a local-only tag that the fetch refspecs map is named with its sha when the prune removes it', async () => {
  const c = clone();
  c.git('config', '--add', 'remote.origin.fetch', '+refs/tags/*:refs/tags/*');
  c.git('switch', '-q', '--detach', 'main');
  writeFiles(c.root, { 'mine.txt': 'x\n' });
  c.git('add', '-A');
  c.git('commit', '-q', '-m', 'mine');
  c.git('tag', 'mine');
  const tip = sha(c, 'mine');
  c.git('switch', '-q', 'main');
  const { code, out } = await run(['worktree', 'clean'], c.root, {});
  expect(code).toBe(0);
  expect(lines(out)).toEqual([`pruned refs/tags/mine (was ${tip})`]);
});

const C = { pid: 7003, start: 'S-C', marker: 'sess-C' };

it('ac-1 in claude code pick up from the main checkout takes the hold and prints enter instead of stop', async () => {
  const c = clone({ setup: ['node setup-step.js ci'] });
  setTable(tableOf(A));
  const { code, out } = await run(['worktree', 'open', 'ST-9'], c.root, envOf(A));
  expect(code).toBe(0);
  expect(lines(out)).toEqual([`enter: ${c.sibling('ST-9')}`]);
  expect(out).not.toContain('stop:');
  expect(c.git('log', '-1', '--format=%s', 't/ST-9').trim()).toBe('claim: ST-9');
  expect(c.git('rev-parse', 't/ST-9^').trim()).toBe(c.git('rev-parse', 'origin/main').trim());
  expect(readFileSync(`${c.sibling('ST-9')}/setup.log`, 'utf8')).toBe('ci\n');
  expect(readHolds(c)['ST-9']).toMatchObject({ tool: 'Claude Code', marker: 'sess-A', pid: 7001, start: 'S-A' });
  expect(c.git('branch', '--show-current').trim()).toBe('main');
  const moved = await run(['anchor'], c.sibling('ST-9'));
  expect(moved.out.startsWith('# Anchor: ST-9')).toBe(true);
  expect(moved.out).toBe((await run(['anchor', 'ST-9'], c.root)).out);
  expect((await run(['worktree', 'open', 'ST-9', '--continue'], c.sibling('ST-9'), envOf(A))).out).toBe(HELD);
});

it('ac-2 in claude code continue from the main checkout enters a claimed worktree whose session ended with or without a worktree here', async () => {
  const c = clone({ tickets: ['ST-9', 'ST-10'] });
  await run(['worktree', 'open', 'ST-9'], c.root);
  writeHolds(c, { 'ST-9': DEAD });
  setTable(tableOf(A));
  const a = await run(['worktree', 'open', 'ST-9', '--continue'], c.root, envOf(A));
  expect(a.code).toBe(0);
  expect(lines(a.out)).toEqual([`enter: ${c.sibling('ST-9')}`]);
  expect((readHolds(c)['ST-9'] as { marker: string }).marker).toBe('sess-A');
  expect((await run(['anchor'], c.sibling('ST-9'))).out).toBe((await run(['anchor', 'ST-9'], c.root)).out);

  const o = c.otherClone();
  gitRun(o, 'config', 'user.email', 'y@example.invalid');
  gitRun(o, 'switch', '-q', '-c', 't/ST-10', 'main');
  gitRun(o, 'commit', '--allow-empty', '-q', '-m', 'claim: ST-10');
  gitRun(o, 'push', '-q', 'origin', 't/ST-10');
  c.git('fetch', '-q', 'origin');
  setTable(tableOf(C));
  const b = await run(['worktree', 'open', 'ST-10', '--continue'], c.root, envOf(C));
  expect(b.code).toBe(0);
  expect(lines(b.out)).toEqual([`enter: ${c.sibling('ST-10')}`]);
  expect(gitRun(c.sibling('ST-10'), 'rev-parse', 'HEAD').trim()).toBe(c.git('rev-parse', 'origin/t/ST-10').trim());
  expect((readHolds(c)['ST-10'] as { marker: string }).marker).toBe('sess-C');
});

it('risk:complex-branching in claude code a worktree pinned to another accord version refuses before setup and prints no enter', async () => {
  const c = clone();
  c.git('worktree', 'add', '-q', '-b', 't/ST-9', c.sibling('ST-9'), 'origin/main');
  const cfg = `${c.sibling('ST-9')}/accord/config.yml`;
  writeFileSync(cfg, readFileSync(cfg, 'utf8').replace('accord: "0.1.0"', 'accord: "0.0.9"'));
  gitRun(c.sibling('ST-9'), 'commit', '-q', '-am', 'pin');
  setTable(tableOf(A));
  const a = await run(['worktree', 'open', 'ST-9', '--continue'], c.root, envOf(A));
  expect(a.code).toBe(2);
  expect(a.err).toContain('pins accord 0.0.9');
  expect(a.err).toContain('merge origin/main into t/ST-9');
  expect(a.out).not.toContain('enter:');
  expect(existsSync(holdsFile(c))).toBe(false);
  const plain = await run(['worktree', 'open', 'ST-9', '--continue'], c.root);
  expect(plain.code).toBe(0);
  expect(lines(plain.out)).toEqual(stopLines(c.sibling('ST-9'), 'ST-9'));

  const d = clone({ setup: ['node setup-step.js ci'] });
  const o = d.otherClone();
  gitRun(o, 'config', 'user.email', 'y@example.invalid');
  writeFileSync(`${o}/accord/config.yml`, readFileSync(`${o}/accord/config.yml`, 'utf8').replace('accord: "0.1.0"', 'accord: "0.0.9"'));
  gitRun(o, 'commit', '-q', '-am', 'pin');
  gitRun(o, 'push', '-q', 'origin', 'main');
  d.git('fetch', '-q', 'origin');
  const b = await run(['worktree', 'open', 'ST-9'], d.root, envOf(A));
  expect(b.code).toBe(2);
  expect(b.err).toContain('pins accord 0.0.9');
  expect(b.err).toContain('update the main checkout');
  expect(b.err).not.toContain('merge');
  expect(b.out).not.toContain('enter:');
  expect(existsSync(`${d.sibling('ST-9')}/setup.log`)).toBe(false);
  expect((readHolds(d)['ST-9'] as { marker: string }).marker).toBe('sess-A');
}, 120_000);

it('risk:concurrency in claude code continue from the main checkout refuses a ticket another live session holds and prints no enter', async () => {
  const c = clone();
  await run(['worktree', 'open', 'ST-9'], c.root);
  writeHolds(c, { 'ST-9': LIVE });
  setTable(tableOf(A, { pid: 4242, start: 'S2' }));
  const before = readFileSync(holdsFile(c), 'utf8');
  const r = await run(['worktree', 'open', 'ST-9', '--continue'], c.root, envOf(A));
  expect(r.code).toBe(2);
  expect(r.err).toContain('sess-H');
  expect(r.out).not.toContain('enter:');
  expect(readFileSync(holdsFile(c), 'utf8')).toBe(before);
});

it('ac-3 in claude code a new lane m ticket is committed pushed and held and prints enter instead of stop', async () => {
  const c = clone({ setup: ['node setup-step.js ci'], tickets: [] });
  setTable(tableOf(A));
  const { code, out } = await run(['new', 'ticket', 'ST-9', '--lane', 'M', '--worktree'], c.root, envOf(A));
  expect(code).toBe(0);
  expect(lines(out)).toEqual(['accord/tickets/ST-9.md', `enter: ${c.sibling('ST-9')}`]);
  expect(out).not.toContain('stop:');
  expect(c.git('ls-remote', 'origin', 'refs/heads/t/ST-9').split('\t')[0]).toBe(gitRun(c.sibling('ST-9'), 'rev-parse', 'HEAD').trim());
  expect(gitRun(c.sibling('ST-9'), 'log', '-1', '--format=%s').trim()).toBe('claim: ST-9');
  expect(readFileSync(`${c.sibling('ST-9')}/setup.log`, 'utf8')).toBe('ci\n');
  expect((readHolds(c)['ST-9'] as { marker: string }).marker).toBe('sess-A');
  expect(existsSync(`${c.root}/accord/tickets/ST-9.md`)).toBe(false);
  const a = await run(['anchor'], c.sibling('ST-9'));
  expect(a.code).toBe(0);
  expect(a.out.startsWith('# Anchor: ST-9')).toBe(true);
  expect(a.out).toContain('Stage: intent');
});

it('risk:data-loss in claude code a new ticket whose hold cannot be taken is still pushed and exits 2', async () => {
  const c = clone({ tickets: [] });
  setTable(tableOf(A));
  const { code, err } = await run(['new', 'ticket', 'ST-9', '--lane', 'M', '--worktree'], c.root, { CLAUDECODE: '1', CLAUDE_CODE_SESSION_ID: 'sess-X', CLAUDE_PID: '1' });
  expect(code).toBe(2);
  expect(err).toContain('CLAUDE_PID 1');
  expect(c.git('ls-remote', 'origin', 'refs/heads/t/ST-9')).toContain('refs/heads/t/ST-9');
});

const C3 = { pid: 7003, start: 'S-C', marker: 'sess-C' };
const WORKS = ['this session works ST-9', 'open a new session in the main checkout', 'without "/accord"'];

it('ac-4 in claude code a session that works a ticket refuses other tickets and new tickets and changes nothing', async () => {
  const c = clone({ tickets: ['ST-9', 'ST-10'] });
  const sib = c.sibling('ST-9');
  setTable(tableOf(A));
  expect((await run(['worktree', 'open', 'ST-9'], c.root, envOf(A))).code).toBe(0);
  gitRun(sib, 'push', '-q', '-u', 'origin', 't/ST-9');
  mergeOnRemote(c, 'ST-9');
  c.git('fetch', '-q', 'origin');
  mkdirSync(`${sib}/sub`);
  const state = () =>
    [c.root, sib]
      .flatMap((d) => [
        gitRun(d, 'worktree', 'list', '--porcelain'),
        gitRun(d, 'for-each-ref', '--format=%(refname) %(objectname)'),
        gitRun(d, 'log', '--all', '--format=%H %s'),
        gitRun(d, 'status', '--porcelain', '--untracked-files=all'),
        readdirSync(`${d}/accord/tickets`).sort().join(','),
      ])
      .concat(readFileSync(holdsFile(c), 'utf8'));
  const before = state();
  const argvs = [
    ['worktree', 'open', 'ST-10'],
    ['worktree', 'open', 'ST-10', '--continue'],
    ['worktree', 'open', 'ST-9'],
    ['new', 'ticket', 'ST-11', '--lane', 'M', '--worktree'],
    ['new', 'ticket', 'ST-11', '--lane', 'M'],
    ['worktree', 'check'],
  ];
  for (const dir of [sib, `${sib}/sub`, c.root]) {
    for (const argv of argvs) {
      const r = await run(argv, dir, envOf(A));
      expect(r.code, `${dir} ${argv.join(' ')}`).toBe(2);
      for (const w of WORKS) expect(r.err).toContain(w);
    }
    expect(state()).toEqual(before);
    expect(existsSync(c.sibling('ST-10'))).toBe(false);
    expect(existsSync(c.sibling('ST-11'))).toBe(false);
  }
  setTable(tableOf(B, A));
  for (const argv of [['worktree', 'open', 'ST-10'], ['new', 'ticket', 'ST-11', '--lane', 'M']]) {
    const r = await run(argv, `${sib}/sub`, envOf(B));
    expect(r.code).toBe(2);
    expect(r.err).toContain('ST-9');
  }
  expect(state()).toEqual(before);
  setTable(tableOf(A));
  const same = await run(['worktree', 'open', 'ST-9', '--continue'], sib, envOf(A));
  const BEHIND = 'behind: t/ST-9 is 1 commit behind origin/main; merge them with git merge origin/main\n';
  expect([same.code, same.out]).toEqual([0, BEHIND + HELD]);
  const back = await run(['worktree', 'open', 'ST-9', '--continue'], c.root, envOf(A));
  expect(back.code).toBe(0);
  expect(lines(back.out)).toEqual([lines(BEHIND)[0], `enter: ${sib}`]);
}, 180_000);

it('ac-5 outside claude code pick up continue and new ticket print the stop lines and nothing is refused', async () => {
  const c = clone({ tickets: ['ST-9', 'ST-10'] });
  vi.mocked(proc.processTable).mockClear();
  const outs: string[] = [];
  const go = async (argv: string[], dir: string) => {
    const r = await run(argv, dir, {});
    expect(r.code, argv.join(' ')).toBe(0);
    outs.push(r.out, r.err);
    return r;
  };
  expect((await go(['worktree', 'open', 'ST-9'], c.root)).out.split('\n').slice(0, 3)).toEqual(stopLines(c.sibling('ST-9'), 'ST-9'));
  expect((await go(['new', 'ticket', 'ST-11', '--lane', 'M', '--worktree'], c.root)).out.split('\n').slice(0, 4)).toEqual([
    'accord/tickets/ST-11.md',
    ...stopLines(c.sibling('ST-11'), 'ST-11'),
  ]);
  const s9 = c.sibling('ST-9');
  expect((await go(['worktree', 'open', 'ST-10'], s9)).out.split('\n').slice(0, 3)).toEqual(stopLines(c.sibling('ST-10'), 'ST-10'));
  expect((await go(['worktree', 'open', 'ST-9', '--continue'], s9)).out).toContain('not held:');
  const chk = await go(['worktree', 'check'], s9);
  expect([chk.out, chk.err]).toEqual(['', '']);
  const n = await go(['new', 'ticket', 'ST-12', '--lane', 'M', '--worktree'], s9);
  expect(n.out.trimEnd().split('\n').slice(-3)).toEqual(stopLines(c.sibling('ST-12'), 'ST-12'));
  for (const o of outs) expect(o).not.toMatch(/enter:|this session works/);
  expect(existsSync(holdsFile(c))).toBe(false);
  expect(proc.processTable).not.toHaveBeenCalled();
});

it('risk:complex-branching a linked worktree on a detached head refuses all but continue of its own ticket', async () => {
  const c = clone({ tickets: ['ST-9', 'ST-10'] });
  c.git('worktree', 'add', '-q', '--detach', c.sibling('ST-10'), 'origin/main');
  setTable(tableOf(A));
  for (const argv of [['worktree', 'open', 'ST-9', '--continue'], ['worktree', 'check']]) {
    const r = await run(argv, c.sibling('ST-10'), envOf(A));
    expect(r.code).toBe(2);
    expect(r.err).toContain('whose branch cannot be read');
    expect(r.err).toContain('open a new session in the main checkout');
  }
  const own = await run(['worktree', 'open', 'ST-10', '--continue'], c.sibling('ST-10'), envOf(A));
  expect(own.err).not.toContain('this session works');
});

it('risk:complex-branching a claude code session that sets no session variables keeps the main checkout flows and only the folder rule refuses it', async () => {
  const c = clone({ tickets: ['ST-9', 'ST-10'] });
  const E = { CLAUDECODE: '1' };
  vi.mocked(proc.processTable).mockClear();
  const chk = await run(['worktree', 'check'], c.root, E);
  expect([chk.code, chk.out, chk.err]).toEqual([0, '', '']);
  const o = await run(['worktree', 'open', 'ST-9'], c.root, E);
  expect(o.code).toBe(0);
  expect(o.out.split('\n').slice(0, 3)).toEqual(stopLines(c.sibling('ST-9'), 'ST-9'));
  const n = await run(['new', 'ticket', 'ST-11', '--lane', 'M'], c.root, E);
  expect(n.code).toBe(0);
  expect(existsSync(`${c.root}/accord/tickets/ST-11.md`)).toBe(true);
  const w = await run(['new', 'ticket', 'ST-12', '--lane', 'M', '--worktree'], c.root, E);
  expect(w.code).toBe(0);
  expect(w.out.trimEnd().split('\n').slice(-3)).toEqual(stopLines(c.sibling('ST-12'), 'ST-12'));
  for (const s of [chk.out, o.out, n.out, w.out]) expect(s).not.toContain('enter:');
  expect(existsSync(holdsFile(c))).toBe(false);
  expect(proc.processTable).not.toHaveBeenCalled();
  const r = await run(['worktree', 'open', 'ST-10'], c.sibling('ST-9'), E);
  expect(r.code).toBe(2);
  expect(r.err).toContain('this session works ST-9');
});

it('risk:complex-branching in claude code a pick up whose setup failed and a new ticket whose push failed still hold their ticket and refuse a second one', async () => {
  const c = clone({ setup: ['node setup-step.js fail'], tickets: ['ST-9', 'ST-10'] });
  setTable(tableOf(A));
  const p = await run(['worktree', 'open', 'ST-9'], c.root, envOf(A));
  expect(p.code).toBe(2);
  expect(p.err).toContain('setup command failed');
  expect(p.out).not.toContain('enter:');
  expect(c.git('log', '-1', '--format=%s', 't/ST-9').trim()).toBe('claim: ST-9');
  expect((readHolds(c)['ST-9'] as { marker: string }).marker).toBe('sess-A');
  for (const argv of [['worktree', 'open', 'ST-10'], ['new', 'ticket', 'ST-11', '--lane', 'M', '--worktree']]) {
    const r = await run(argv, c.root, envOf(A));
    expect(r.code).toBe(2);
    expect(r.err).toContain('this session works ST-9');
  }
  expect(existsSync(c.sibling('ST-10'))).toBe(false);
  expect(existsSync(c.sibling('ST-11'))).toBe(false);
  expect(c.git('branch', '--list', 't/ST-10', 't/ST-11').trim()).toBe('');
  const again = await run(['worktree', 'open', 'ST-9', '--continue'], c.root, envOf(A));
  expect(again.code).toBe(2);
  expect(again.err).toContain('setup command failed');
  expect(again.err).not.toContain('this session works');

  const d = clone({ tickets: ['ST-10'] });
  d.git('remote', 'set-url', '--push', 'origin', `${d.remote}-missing`);
  setTable(tableOf(C3));
  const n = await run(['new', 'ticket', 'ST-11', '--lane', 'M', '--worktree'], d.root, envOf(C3));
  expect(n.code).toBe(2);
  expect(n.err).toContain('the push failed');
  expect(n.out).not.toContain('enter:');
  expect((readHolds(d)['ST-11'] as { marker: string }).marker).toBe('sess-C');
  const o = await run(['worktree', 'open', 'ST-10'], d.root, envOf(C3));
  expect(o.code).toBe(2);
  expect(o.err).toContain('this session works ST-11');
  expect(existsSync(d.sibling('ST-10'))).toBe(false);
}, 120_000);

it('risk:data-loss clean keeps a merged worktree this session holds when run from the main checkout', async () => {
  const c = clone();
  ticketWorktree(c, 'ST-9');
  mergeOnRemote(c, 'ST-9');
  writeHolds(c, { 'ST-9': { tool: 'Claude Code', ...A, taken: '2026-10-18T00:00:00.000Z' } });
  setTable(tableOf(A));
  vi.mocked(proc.processTable).mockClear();
  const { code, out } = await run(['worktree', 'clean'], c.root, envOf(A));
  expect(code).toBe(0);
  expect(lines(out)).toContain(`kept ${c.sibling('ST-9')}: this session's worktree`);
  expect(lines(out)).toContain('kept t/ST-9: checked out in ' + c.sibling('ST-9'));
  expect(existsSync(c.sibling('ST-9'))).toBe(true);
  expect(Object.keys(readHolds(c))).toEqual(['ST-9']);
  expect(proc.processTable).not.toHaveBeenCalled();
}, 60_000);

it('risk:concurrency the session start hook takes a free hold in a ticket worktree and never a live one', async () => {
  const c = clone();
  c.git('worktree', 'add', '-q', '-b', 't/ST-9', c.sibling('ST-9'), 'origin/main');
  const sib = c.sibling('ST-9');
  const start = (s: { marker: string; pid: number }, cwd: string, env: NodeJS.ProcessEnv = envOf(s)) =>
    run(['hook', 'session-start'], cwd, env, JSON.stringify({ session_id: s.marker, cwd, source: 'startup' }));
  setTable(tableOf(A));
  const a = await start(A, sib);
  expect(a.code).toBe(0);
  expect(a.out.startsWith('# accord rules\n')).toBe(true);
  expect((readHolds(c)['ST-9'] as { marker: string }).marker).toBe('sess-A');
  const bytes = readFileSync(holdsFile(c), 'utf8');
  setTable(tableOf(B, A));
  const b = await start(B, sib);
  expect(b.code).toBe(0);
  expect(b.out.startsWith('# accord rules\n')).toBe(true);
  expect(lines(b.err)).toHaveLength(1);
  expect(b.err).toContain('sess-A');
  expect(readFileSync(holdsFile(c), 'utf8')).toBe(bytes);
  setTable(tableOf(B));
  await start(B, c.root);
  expect(readFileSync(holdsFile(c), 'utf8')).toBe(bytes);
  await start(B, sib, {});
  expect(readFileSync(holdsFile(c), 'utf8')).toBe(bytes);
  const n = await start(B, sib, { CLAUDECODE: '1' });
  expect(n.code).toBe(0);
  expect(n.out.startsWith('# accord rules\n')).toBe(true);
  expect(lines(n.err)).toHaveLength(1);
  expect(n.err).toContain('no hold taken on ST-9');
  expect(readFileSync(holdsFile(c), 'utf8')).toBe(bytes);
}, 60_000);

it('risk:complex-branching the resume hook in the main checkout prints the anchor and the enter line of the held worktree', async () => {
  const c = clone();
  setTable(tableOf(A));
  expect((await run(['worktree', 'open', 'ST-9'], c.root, envOf(A))).code).toBe(0);
  const resume = (s: { marker: string; pid: number }, cwd: string) =>
    run(['hook', 'session-resume'], c.root, envOf(s), JSON.stringify({ session_id: s.marker, cwd, source: 'resume' }));
  const a = await resume(A, c.root);
  expect(a.out).toContain('# Anchor: ST-9');
  const al = lines(a.out);
  expect(al.at(-1)).toBe(`enter: ${c.sibling('ST-9')}`);
  expect(al.at(-2)).toContain('EnterWorktree');
  const b = await resume(B, c.root);
  expect(b.out).not.toContain('enter:');
  expect(b.out).toMatch(/\naccord: \d+ in progress, \d+ ready to pick up · type \/accord\n$/);
  const s = await resume(A, c.sibling('ST-9'));
  expect(s.out).toContain('# Anchor: ST-9');
  expect(s.out).not.toContain('enter:');
}, 60_000);


it('risk:complex-branching a session whose hold was cleaned or taken over still works its ticket when resumed in the main checkout', async () => {
  const c = clone({ tickets: ['ST-9', 'ST-10', 'ST-11'] });
  const sib = c.sibling('ST-9');
  const worked = () => readFileSync(`${c.root}/.git/accord/worked`, 'utf8');
  const hook = (s: { marker: string }, args: string) =>
    run(['hook', 'prompt-expansion'], c.root, {}, JSON.stringify({ session_id: s.marker, command_name: 'accord', command_args: args, cwd: c.root }));
  setTable(tableOf(A));
  const o = await run(['worktree', 'open', 'ST-9'], c.root, envOf(A));
  expect(o.code).toBe(0);
  expect(o.out).toContain('enter:');
  expect((await run(['worktree', 'open', 'ST-9', '--continue'], sib, envOf(A))).out).toBe(HELD);
  expect(worked()).toBe('ST-9\tsess-A\n');

  gitRun(sib, 'push', '-q', '-u', 'origin', 't/ST-9');
  mergeOnRemote(c, 'ST-9');
  setTable(tableOf(B));
  const cl = await run(['worktree', 'clean'], c.root, envOf(B));
  expect(cl.code).toBe(0);
  expect(cl.out).toContain(`removed ${sib}`);
  expect(existsSync(sib)).toBe(false);
  expect(Object.hasOwn(readHolds(c), 'ST-9')).toBe(false);
  expect(worked()).toBe('ST-9\tsess-A\n');
  setTable(tableOf(A));
  for (const args of [['worktree', 'open', 'ST-10'], ['worktree', 'check']]) {
    const r = await run(args, c.root, envOf(A));
    expect(r.code).toBe(2);
    expect(r.err).toContain('this session works ST-9');
  }
  const h = await hook(A, 'pick-up ST-10');
  expect(h.code).toBe(0);
  expect(JSON.parse(h.out)).toMatchObject({ decision: 'block', reason: expect.stringContaining('this session works ST-9') });
  expect(existsSync(c.sibling('ST-10'))).toBe(false);

  setTable(tableOf(C));
  const oc = await run(['worktree', 'open', 'ST-10'], c.root, envOf(C));
  expect(oc.code).toBe(0);
  expect(oc.out).toContain('enter:');
  setTable(tableOf(B));
  const tk = await run(['worktree', 'open', 'ST-10', '--continue'], c.root, envOf(B));
  expect(tk.code).toBe(0);
  expect(lines(tk.out)).toEqual([`enter: ${c.sibling('ST-10')}`]);
  expect((readHolds(c)['ST-10'] as { marker: string }).marker).toBe('sess-B');
  expect(Object.values(readHolds(c)).some((x) => (x as { marker: string }).marker === 'sess-C')).toBe(false);
  setTable(tableOf(C));
  const w = worked();
  for (const args of [['worktree', 'open', 'ST-11'], ['new', 'ticket', 'ST-12', '--lane', 'M']]) {
    const r = await run(args, c.root, envOf(C));
    expect(r.code).toBe(2);
    expect(r.err).toContain('this session works ST-10');
  }
  const hc = await hook(C, 'pick-up ST-11');
  expect(JSON.parse(hc.out)).toMatchObject({ decision: 'block', reason: expect.stringContaining('this session works ST-10') });
  expect(existsSync(c.sibling('ST-11'))).toBe(false);
  expect(existsSync(`${c.root}/accord/tickets/ST-12.md`)).toBe(false);
  expect(worked()).toBe(w);
  expect((await run(['worktree', 'open', 'ST-10', '--continue'], c.root, envOf(C))).err).not.toContain('this session works');
}, 120_000);

it('risk:complex-branching a session started in a ticket worktree is recorded as working it when the start hook takes no hold', async () => {
  const c = clone({ tickets: ['ST-9', 'ST-10'] });
  const sib = c.sibling('ST-9');
  c.git('worktree', 'add', '-q', '-b', 't/ST-9', sib, 'origin/main');
  const worked = () => readFileSync(`${c.root}/.git/accord/worked`, 'utf8');
  const hook = (s: { marker: string }, args: string) =>
    run(['hook', 'prompt-expansion'], c.root, {}, JSON.stringify({ session_id: s.marker, command_name: 'accord', command_args: args, cwd: c.root }));
  const start = (env: NodeJS.ProcessEnv, marker: string) =>
    run(['hook', 'session-start'], sib, env, JSON.stringify({ session_id: marker, cwd: sib, source: 'startup' }));
  writeHolds(c, { 'ST-9': LIVE });
  setTable(tableOf(B, { pid: 4242, start: 'S2' }));
  const b = await start(envOf(B), 'sess-B');
  expect(b.code).toBe(0);
  expect(b.out.startsWith('# accord rules\n')).toBe(true);
  expect(lines(b.err)).toHaveLength(1);
  expect(b.err).toContain('sess-H');
  expect((readHolds(c)['ST-9'] as { marker: string }).marker).toBe('sess-H');
  expect(lines(worked())).toContain('ST-9\tsess-B');

  const e = await start({ CLAUDECODE: '1' }, 'sess-E');
  expect(e.code).toBe(0);
  expect(e.out.startsWith('# accord rules\n')).toBe(true);
  expect(lines(e.err)).toHaveLength(1);
  expect(e.err).toContain('no hold taken on ST-9');
  expect(lines(worked())).toContain('ST-9\tsess-E');

  expect((await start({}, 'sess-O')).code).toBe(0);
  expect(lines(worked()).some((l) => l.endsWith('sess-O'))).toBe(false);

  const resume = (env: NodeJS.ProcessEnv, marker: string) =>
    run(['hook', 'session-resume'], sib, env, JSON.stringify({ session_id: marker, cwd: sib, source: 'resume' }));
  setTable(tableOf(C));
  const bytes = readFileSync(holdsFile(c), 'utf8');
  const r = await resume(envOf(C), 'sess-C');
  expect(r.code).toBe(0);
  expect(r.out).toContain('# Anchor: ST-9');
  expect(r.out).not.toContain('enter:');
  expect(r.err).toBe('');
  expect(readFileSync(holdsFile(c), 'utf8')).toBe(bytes);
  expect(lines(worked())).toContain('ST-9\tsess-C');
  expect((await resume({}, 'sess-P')).code).toBe(0);
  expect(lines(worked()).some((l) => l.endsWith('sess-P'))).toBe(false);

  c.git('worktree', 'remove', sib);
  setTable(tableOf(C));
  const o = await run(['worktree', 'open', 'ST-10'], c.root, envOf(C));
  expect(o.code).toBe(2);
  expect(o.err).toContain('this session works ST-9');
  setTable(tableOf(B));
  const k = await run(['worktree', 'check'], c.root, envOf(B));
  expect(k.code).toBe(2);
  expect(k.err).toContain('this session works ST-9');
  const oe = await run(['worktree', 'open', 'ST-10'], c.root, { CLAUDECODE: '1', CLAUDE_CODE_SESSION_ID: 'sess-E' });
  expect(oe.code).toBe(2);
  expect(oe.err).toContain('this session works ST-9');
  expect(existsSync(c.sibling('ST-10'))).toBe(false);
  const h = await hook({ marker: 'sess-E' }, 'pick-up ST-10');
  expect(h.code).toBe(0);
  expect(JSON.parse(h.out)).toMatchObject({ decision: 'block', reason: expect.stringContaining('this session works ST-9') });
}, 120_000);

const pushNext = (c: Clone) => {
  const o = c.otherClone();
  writeFiles(o, { 'next.txt': 'next\n' });
  gitRun(o, 'add', '-A');
  gitRun(o, 'commit', '-q', '-m', 'next');
  gitRun(o, 'push', '-q', 'origin', 'main');
  return gitRun(o, 'rev-parse', 'HEAD').trim();
};

it('ac-1 pick up and a new worktree ticket cut the ticket branch from a main commit this clone had not fetched', async () => {
  const c = clone();
  const tip = pushNext(c);
  expect(sha(c, 'origin/main')).not.toBe(tip);
  const r = await run(['worktree', 'open', 'ST-9'], c.root);
  expect(r.code).toBe(0);
  expect(c.git('rev-parse', 't/ST-9^').trim()).toBe(tip);
  expect(c.git('log', '-1', '--format=%s', 't/ST-9').trim()).toBe('claim: ST-9');
  expect(r.out).not.toContain('fetch from origin failed');

  const d = clone({ tickets: [] });
  const tip2 = pushNext(d);
  const n = await run(['new', 'ticket', 'ST-9', '--lane', 'M', '--worktree'], d.root);
  expect(n.code).toBe(0);
  expect(d.git('rev-parse', 't/ST-9^').trim()).toBe(tip2);
  expect(d.git('show', 't/ST-9:accord/tickets/ST-9.md')).not.toBe('');
}, 120_000);

it('risk:concurrency pick up fetches before it judges the claim so a claim pushed since the last fetch refuses', async () => {
  const c = clone();
  const o = c.otherClone();
  gitRun(o, 'config', 'user.email', 'other@example.invalid');
  gitRun(o, 'switch', '-q', '-c', 't/ST-9');
  gitRun(o, 'commit', '-q', '--allow-empty', '-m', 'claim: ST-9');
  gitRun(o, 'push', '-q', 'origin', 't/ST-9');
  const r = await run(['worktree', 'open', 'ST-9'], c.root);
  expect(r.code).toBe(2);
  expect(r.err).toContain('claimed: ST-9 by other@example.invalid');
  expect(existsSync(c.sibling('ST-9'))).toBe(false);
  expect(() => c.git('rev-parse', '--verify', '-q', 'refs/heads/t/ST-9')).toThrow();
}, 120_000);

it('ac-2 continue says the ticket branch is 2 commits behind the remote main and leaves the branch unchanged', async () => {
  const c = clone();
  ticketWorktree(c, 'ST-9');
  const before = sha(c, 't/ST-9');
  const o = c.otherClone();
  for (const f of ['a.txt', 'b.txt']) {
    writeFiles(o, { [f]: f + '\n' });
    gitRun(o, 'add', '-A');
    gitRun(o, 'commit', '-q', '-m', f);
  }
  gitRun(o, 'push', '-q', 'origin', 'main');
  expect(sha(c, 'origin/main')).not.toBe(gitRun(o, 'rev-parse', 'HEAD').trim());
  const r = await run(['worktree', 'open', 'ST-9', '--continue'], c.root);
  expect(r.code).toBe(0);
  const out = lines(r.out);
  expect(out[0]).toBe('behind: t/ST-9 is 2 commits behind origin/main; merge them with git merge origin/main');
  expect(out.slice(1, 4)).toEqual(stopLines(c.sibling('ST-9'), 'ST-9'));
  expect(out.filter((l) => l.startsWith('behind:'))).toHaveLength(1);
  expect(sha(c, 't/ST-9')).toBe(before);
  expect(gitRun(c.sibling('ST-9'), 'rev-parse', 'HEAD').trim()).toBe(before);
  expect(gitRun(c.sibling('ST-9'), 'status', '--porcelain')).toBe('');
}, 120_000);

/** A ticket at the verify stage, committed in `dir`: approved, planned, both tasks done, review ended with a verdict. */
function verifyStage(dir: string, id: string, opts: { review?: boolean } = {}) {
  let text = laneTicket(id);
  const hash = approvedHash(loadSnapshot({ files: { 'accord/config.yml': CONFIG, ['accord/tickets/' + id + '.md']: text }, tree: [] }).tickets[id]);
  text = setFrontmatterKey(text, 'approved_hash', hash);
  const files: Record<string, string> = {
    ['accord/tickets/' + id + '.md']: text,
    ['accord/tickets/' + id + '/plan.md']: PLAN,
    ['accord/tickets/' + id + '/ledger.md']: '## Tasks\n- task 1 done abc1234\n- task 2 done abc1234\n',
  };
  if (opts.review !== false) files['accord/tickets/' + id + '/review.md'] = 'verdict: converged\n';
  writeFiles(dir, files);
  gitRun(dir, 'add', '-A');
  gitRun(dir, 'commit', '-q', '-m', 'review: ' + id);
}

/** Commit a file on the remote main from a second clone, which `c` has not fetched; returns the new tip. */
function pushMain(c: Clone, file: string, text: string): string {
  const o = c.otherClone();
  writeFiles(o, { [file]: text });
  gitRun(o, 'add', '-A');
  gitRun(o, 'commit', '-q', '-m', file);
  gitRun(o, 'push', '-q', 'origin', 'main');
  return gitRun(o, 'rev-parse', 'HEAD').trim();
}

it('ac-3 worktree merge at verify gives the ticket branch a merge commit of its head and the fetched main commit', async () => {
  const c = clone();
  ticketWorktree(c, 'ST-9');
  const sib = c.sibling('ST-9');
  verifyStage(sib, 'ST-9');
  const rows = JSON.parse((await run(['status', '--json'], sib)).out) as { id: string; stage: string }[];
  expect(rows.find((r) => r.id === 'ST-9')?.stage).toBe('verify');
  const head = gitRun(sib, 'rev-parse', 'HEAD').trim();
  const tip = pushMain(c, 'next.txt', 'next\n');
  const r = await run(['worktree', 'merge', 'ST-9'], sib);
  expect(r.code).toBe(0);
  expect(gitRun(sib, 'rev-parse', 'HEAD^1').trim()).toBe(head);
  expect(gitRun(sib, 'rev-parse', 'HEAD^2').trim()).toBe(tip);
  expect(gitRun(sib, 'rev-list', '--parents', '-n', '1', 'HEAD').trim().split(' ')).toHaveLength(3);
  expect(gitRun(sib, 'branch', '--show-current').trim()).toBe('t/ST-9');
  expect(gitRun(sib, 'status', '--porcelain')).toBe('');
  expect(existsSync(sib + '/next.txt')).toBe(true);
  expect(gitRun(sib, 'reflog', '-n', '10')).not.toContain('rebase');
  const merged = gitRun(sib, 'rev-parse', 'HEAD').trim();
  const again = await run(['worktree', 'merge', 'ST-9'], sib);
  expect(again.code).toBe(0);
  expect(again.out).toBe('');
  expect(again.err).toBe('');
  expect(gitRun(sib, 'rev-parse', 'HEAD').trim()).toBe(merged);
}, 120_000);

it('ac-4 a merge conflict is aborted names the file exits 2 and the next merge tries again', async () => {
  const c = clone();
  writeFiles(c.root, { 'shared.txt': 'base\n' });
  c.git('add', '-A');
  c.git('commit', '-q', '-m', 'shared');
  c.git('push', '-q', 'origin', 'main');
  ticketWorktree(c, 'ST-9', 'shared.txt');
  const sib = c.sibling('ST-9');
  verifyStage(sib, 'ST-9');
  pushMain(c, 'shared.txt', 'main\n');
  const head = gitRun(sib, 'rev-parse', 'HEAD').trim();
  for (let i = 0; i < 2; i++) {
    const r = await run(['worktree', 'merge', 'ST-9'], sib);
    expect(r.code).toBe(2);
    expect(r.err).toContain('conflict');
    expect(r.err).toContain('shared.txt');
    expect(gitRun(sib, 'rev-parse', 'HEAD').trim()).toBe(head);
    expect(gitRun(sib, 'status', '--porcelain')).toBe('');
    expect(readFileSync(sib + '/shared.txt', 'utf8').replace(/\r/g, '')).toBe('ST-9\n');
    expect(() => gitRun(sib, 'rev-parse', '-q', '--verify', 'MERGE_HEAD')).toThrow();
  }
}, 120_000);

it('risk:complex-branching worktree merge merges the remote-tracking main when a local branch has its short name', async () => {
  const c = clone();
  ticketWorktree(c, 'ST-9');
  const sib = c.sibling('ST-9');
  verifyStage(sib, 'ST-9');
  const head = gitRun(sib, 'rev-parse', 'HEAD').trim();
  gitRun(sib, 'branch', 'origin/main', 'HEAD');
  const tip = pushMain(c, 'next.txt', 'next\n');
  const r = await run(['worktree', 'merge', 'ST-9'], sib);
  expect(r.code).toBe(0);
  expect(gitRun(sib, 'rev-parse', 'HEAD^1').trim()).toBe(head);
  expect(gitRun(sib, 'rev-parse', 'HEAD^2').trim()).toBe(tip);
  expect(gitRun(sib, 'rev-parse', 'refs/heads/origin/main').trim()).toBe(head);
}, 120_000);

it('risk:complex-branching worktree merge refuses before verify on another branch and over tracked changes and merges nothing', async () => {
  const c = clone();
  ticketWorktree(c, 'ST-9');
  const sib = c.sibling('ST-9');
  verifyStage(sib, 'ST-9', { review: false });
  const head = gitRun(sib, 'rev-parse', 'HEAD').trim();
  pushMain(c, 'next.txt', 'next\n');
  const main0 = sha(c, 'origin/main');
  const early = await run(['worktree', 'merge', 'ST-9'], sib);
  expect(early.code).toBe(2);
  expect(early.err).toContain('only at verify');
  expect(early.err).toContain('nothing was merged');
  expect(gitRun(sib, 'rev-parse', 'HEAD').trim()).toBe(head);
  expect(sha(c, 'origin/main')).toBe(main0);

  const d = clone();
  ticketWorktree(d, 'ST-9');
  verifyStage(d.sibling('ST-9'), 'ST-9');
  const dHead = gitRun(d.sibling('ST-9'), 'rev-parse', 'HEAD').trim();
  pushMain(d, 'next.txt', 'next\n');
  const away = await run(['worktree', 'merge', 'ST-9'], d.root);
  expect(away.code).toBe(2);
  expect(away.err).toContain('t/ST-9');
  expect(away.err).toContain('nothing was merged');
  expect(gitRun(d.sibling('ST-9'), 'rev-parse', 'HEAD').trim()).toBe(dHead);

  const e = clone();
  ticketWorktree(e, 'ST-9');
  const eSib = e.sibling('ST-9');
  verifyStage(eSib, 'ST-9');
  const eHead = gitRun(eSib, 'rev-parse', 'HEAD').trim();
  pushMain(e, 'next.txt', 'next\n');
  writeFiles(eSib, { 'ST-9.txt': 'changed\n' });
  const dirty = await run(['worktree', 'merge', 'ST-9'], eSib);
  expect(dirty.code).toBe(2);
  expect(dirty.err).toContain('uncommitted changes');
  expect(readFileSync(eSib + '/ST-9.txt', 'utf8').replace(/\r/g, '')).toBe('changed\n');
  expect(gitRun(eSib, 'rev-parse', 'HEAD').trim()).toBe(eHead);
}, 120_000);

it('risk:data-loss worktree merge never overwrites an ignored file and quotes the git error that stopped it', async () => {
  const c = clone();
  ticketWorktree(c, 'ST-9');
  const sib = c.sibling('ST-9');
  verifyStage(sib, 'ST-9');
  const head = gitRun(sib, 'rev-parse', 'HEAD').trim();
  writeFiles(sib, { 'node_modules/keep.txt': 'mine\n' });
  const o = c.otherClone();
  writeFiles(o, { 'node_modules/keep.txt': 'theirs\n' });
  gitRun(o, 'add', '-f', 'node_modules/keep.txt');
  gitRun(o, 'commit', '-q', '-m', 'theirs');
  gitRun(o, 'push', '-q', 'origin', 'main');
  const r = await run(['worktree', 'merge', 'ST-9'], sib);
  expect(r.code).toBe(2);
  expect(r.err).toContain('merge of origin/main into t/ST-9 failed: ');
  expect(r.err).not.toContain('conflict');
  expect(readFileSync(sib + '/node_modules/keep.txt', 'utf8').replace(/\r/g, '')).toBe('mine\n');
  expect(gitRun(sib, 'rev-parse', 'HEAD').trim()).toBe(head);
  expect(() => gitRun(sib, 'rev-parse', '-q', '--verify', 'MERGE_HEAD')).toThrow();

  // a rename on main whose target is an ignored file present here
  const d = clone();
  pushMain(d, 'old.txt', 'old\n');
  ticketWorktree(d, 'ST-9');
  const dSib = d.sibling('ST-9');
  verifyStage(dSib, 'ST-9');
  const dHead = gitRun(dSib, 'rev-parse', 'HEAD').trim();
  writeFiles(dSib, { 'node_modules/moved.txt': 'mine\n' });
  const p = d.otherClone();
  mkdirSync(p + '/node_modules');
  gitRun(p, 'mv', 'old.txt', 'node_modules/moved.txt');
  gitRun(p, 'commit', '-q', '-m', 'rename');
  gitRun(p, 'push', '-q', 'origin', 'main');
  const rr = await run(['worktree', 'merge', 'ST-9'], dSib);
  expect(rr.code).toBe(2);
  expect(rr.err).toContain('node_modules/moved.txt');
  expect(readFileSync(dSib + '/node_modules/moved.txt', 'utf8').replace(/\r/g, '')).toBe('mine\n');
  expect(gitRun(dSib, 'rev-parse', 'HEAD').trim()).toBe(dHead);

  // a non-ASCII path, which git quotes and octal-escapes by default
  const u = clone();
  ticketWorktree(u, 'ST-9');
  const uSib = u.sibling('ST-9');
  verifyStage(uSib, 'ST-9');
  const uHead = gitRun(uSib, 'rev-parse', 'HEAD').trim();
  writeFiles(uSib, { 'node_modules/é.txt': 'mine\n' });
  const q = u.otherClone();
  writeFiles(q, { 'node_modules/é.txt': 'theirs\n' });
  gitRun(q, 'add', '-f', 'node_modules/é.txt');
  gitRun(q, 'commit', '-q', '-m', 'theirs');
  gitRun(q, 'push', '-q', 'origin', 'main');
  const ur = await run(['worktree', 'merge', 'ST-9'], uSib);
  expect(ur.code).toBe(2);
  expect(ur.err).toContain('node_modules/é.txt');
  expect(readFileSync(uSib + '/node_modules/é.txt', 'utf8').replace(/\r/g, '')).toBe('mine\n');
  expect(gitRun(uSib, 'rev-parse', 'HEAD').trim()).toBe(uHead);
}, 120_000);

it('risk:complex-branching a merge that changes the pinned accord version keeps the merge and names the pin', async () => {
  const c = clone();
  ticketWorktree(c, 'ST-9');
  const sib = c.sibling('ST-9');
  verifyStage(sib, 'ST-9');
  const head = gitRun(sib, 'rev-parse', 'HEAD').trim();
  const o = c.otherClone();
  const cfg = o + '/accord/config.yml';
  writeFileSync(cfg, readFileSync(cfg, 'utf8').replace('accord: "0.1.0"', 'accord: "9.9.9"'));
  gitRun(o, 'add', '-A');
  gitRun(o, 'commit', '-q', '-m', 'pin');
  gitRun(o, 'push', '-q', 'origin', 'main');
  const tip = gitRun(o, 'rev-parse', 'HEAD').trim();
  const r = await run(['worktree', 'merge', 'ST-9'], sib);
  expect(r.code).toBe(2);
  expect(r.err).toContain('pins accord 9.9.9');
  expect(gitRun(sib, 'rev-parse', 'HEAD^1').trim()).toBe(head);
  expect(gitRun(sib, 'rev-parse', 'HEAD^2').trim()).toBe(tip);
}, 120_000);

it('ac-5 a failed or silent fetch is one accord line at pick up new ticket continue and merge and the work goes on', async () => {
  const P = 'fetch from origin failed, going on with the refs already in this clone: ';
  const one = (out: string, err: string) => {
    const all = lines(out + err);
    const f = all.filter((l) => l.includes('fetch'));
    expect(f).toHaveLength(1);
    expect(f[0].startsWith(P)).toBe(true);
    expect(f[0].length).toBeGreaterThan(P.length);
    expect(all.some((l) => l.startsWith('fatal:'))).toBe(false);
    return f[0];
  };
  const missing = (c: Clone) => c.git('remote', 'set-url', 'origin', c.remote + '-missing');

  const c = clone();
  missing(c);
  const base = sha(c, 'origin/main');
  const rc = await run(['worktree', 'open', 'ST-9'], c.root);
  expect(rc.code).toBe(0);
  one(rc.out, rc.err);
  expect(sha(c, 't/ST-9^')).toBe(base);

  const d = clone({ tickets: [] });
  missing(d);
  d.git('remote', 'set-url', '--push', 'origin', d.remote);
  const rd = await run(['new', 'ticket', 'ST-9', '--lane', 'M', '--worktree'], d.root);
  expect(rd.code).toBe(0);
  one(rd.out, rd.err);

  const e = clone();
  ticketWorktree(e, 'ST-9');
  missing(e);
  const re = await run(['worktree', 'open', 'ST-9', '--continue'], e.root);
  expect(re.code).toBe(0);
  one(re.out, re.err);
  expect(lines(re.out).slice(-3)).toEqual(stopLines(e.sibling('ST-9'), 'ST-9'));

  const f = clone();
  ticketWorktree(f, 'ST-9');
  verifyStage(f.sibling('ST-9'), 'ST-9');
  missing(f);
  const head = gitRun(f.sibling('ST-9'), 'rev-parse', 'HEAD').trim();
  const rf = await run(['worktree', 'merge', 'ST-9'], f.sibling('ST-9'));
  expect(rf.code).toBe(0);
  one(rf.out, rf.err);
  expect(gitRun(f.sibling('ST-9'), 'rev-parse', 'HEAD').trim()).toBe(head);

  const g = clone();
  g.git('config', 'remote.origin.uploadpack', 'cd / && sleep 30 >/dev/null 2>&1; :');
  vi.mocked(limit.fetchLimitMs).mockReturnValue(2000);
  const t0 = Date.now();
  const rg = await run(['worktree', 'open', 'ST-9'], g.root);
  expect(rg.code).toBe(0);
  expect(Date.now() - t0).toBeLessThan(15000);
  expect(one(rg.out, rg.err)).toBe(P + 'no answer within 2 seconds');
  expect(sha(g, 't/ST-9^')).toBe(sha(g, 'origin/main'));
  await new Promise((r) => setTimeout(r, Math.max(0, t0 + 31000 - Date.now())));
}, 60_000);