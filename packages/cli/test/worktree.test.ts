// ST-LN-7: `accord worktree open` against real git in tmp sandboxes with a bare remote.
import { chmodSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { afterEach, expect, it, vi } from 'vitest';
import * as proc from '../src/load/proc.js';
import { laneTicket } from '../../../test/helpers/lane.js';
import { gitRun, run, writeFiles } from './helpers/repo.js';
import { makeClone, type Clone } from './helpers/worktree.js';

vi.mock('../src/load/proc.js', async (orig) => {
  const real = await orig<typeof import('../src/load/proc.js')>();
  return { ...real, processTable: vi.fn(real.processTable) };
});

const clones: Clone[] = [];
const clone = (opts?: Parameters<typeof makeClone>[0]) => {
  const c = makeClone(opts);
  clones.push(c);
  return c;
};
afterEach(() => {
  vi.mocked(proc.processTable).mockReset();
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
  expect(Date.now() - t0).toBeLessThan(5000);
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
  const { code, out } = await run(['worktree', 'clean'], c.root, {});
  expect(code).toBe(0);
  expect(c.git('rev-parse', 'origin/main').trim()).not.toBe(before);
  expect(c.git('rev-parse', 'origin/main').trim()).toBe(gitRun(c.remote, 'rev-parse', 'main').trim());
  expect(existsSync(c.sibling('ST-9'))).toBe(false);
  expect(lines(out).sort()).toEqual(
    [`removed ${c.sibling('ST-9')}`, `kept ${c.sibling('ST-10')}: uncommitted work`, `kept ${c.sibling('ST-12')}: held by another session`].sort(),
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
  expect(l).toHaveLength(2);

  const d = clone();
  d.git('worktree', 'add', '-q', '-b', 't/ST-9', d.sibling('ST-9'), 'origin/main');
  d.git('remote', 'remove', 'origin');
  expect((await run(['worktree', 'clean'], d.root, {})).out).toBe('');
  const e = clone();
  e.git('remote', 'set-url', 'origin', e.remote + '-missing');
  expect((await run(['worktree', 'clean'], e.root, {})).out).toBe('');
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
  expect(lines(out)).toEqual([`kept ${c.sibling('ST-10')}: uncommitted work`]);
  expect(existsSync(`${c.sibling('ST-10')}/new.txt`)).toBe(true);
  expect(existsSync(c.sibling('ST-9'))).toBe(true);

  const d = clone();
  ticketWorktree(d, 'ST-9');
  mergeOnRemote(d, 'ST-9');
  const r = await run(['worktree', 'clean'], d.sibling('ST-9'), {});
  expect(lines(r.out)).toEqual([`kept ${d.sibling('ST-9')}: this session's worktree`]);
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
  expect(lines(r.out)).toHaveLength(1);
  expect(r.out.startsWith(`kept ${c.sibling('ST-9')}: git worktree remove failed: `)).toBe(true);
  expect(c.git('worktree', 'list', '--porcelain')).toContain(`worktree ${c.sibling('ST-9')}\n`);
  expect(Object.keys(readHolds(c))).toEqual(['ST-9']);

  if (process.platform === 'win32' || process.getuid?.() === 0) return;
  const d = clone();
  ticketWorktree(d, 'ST-9', 'sub/f.txt');
  mergeOnRemote(d, 'ST-9');
  writeHolds(d, { 'ST-9': DEAD });
  vi.mocked(proc.processTable).mockReturnValue([{ pid: process.pid, ppid: 1, start: 'self' }]);
  chmodSync(`${d.sibling('ST-9')}/sub`, 0o555);
  try {
    const q = await run(['worktree', 'clean'], d.root, {});
    expect(lines(q.out)).toHaveLength(1);
    expect(q.out.startsWith(`removed ${d.sibling('ST-9')} in part: git worktree remove failed: `)).toBe(true);
    expect(q.out.trimEnd().endsWith(' - delete what is left of the folder by hand')).toBe(true);
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
  const { code, out } = await run(['worktree', 'clean'], c.root, {});
  expect(code).toBe(0);
  expect(lines(out)).toEqual([`pruned ${c.sibling('ST-9')}: ${reason}`, `removed ${c.sibling('ST-10')}`]);
  expect(out).not.toContain('repair');
  expect(c.git('worktree', 'list', '--porcelain')).not.toMatch(/^prunable/m);
  expect(c.git('rev-parse', '--verify', '-q', 'refs/heads/t/ST-9').trim()).not.toBe('');
});
