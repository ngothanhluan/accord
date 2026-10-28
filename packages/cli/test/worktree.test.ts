// ST-LN-7: `accord worktree open` against real git in tmp sandboxes with a bare remote.
import { execFileSync } from 'node:child_process';
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, afterEach, beforeAll, expect, it, vi } from 'vitest';
import * as proc from '../src/load/proc.js';
import { approvedHash, gateReady, loadSnapshot, setFrontmatterKey } from '@accord-dev/accord-core';
import { CONFIG, gateReadyIn, LANE_BODY, LANE_S_BODY, laneTicket, P, PLAN } from '../../../test/helpers/lane.js';
import { cleanup, commitMsg, gitRun, mergeMsg, run, writeFiles } from './helpers/repo.js';
import { copyClone, makeClone, makeTemplate, type Clone } from './helpers/worktree.js';

// The pin the clones hold: their accord/config.yml is written from CONFIG (helpers/worktree.ts), so a pin bump needs no edit here.
const PIN = /^accord: "([^"]+)"$/m.exec(CONFIG)![1];

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
// H1: one template per set of opts, built once; a test takes a copy of it with `copy` (rule 5: `copyClone` checks the
// copy's origin and paths). A template never holds a linked worktree: any `worktree add` runs in the copy.
const TEMPLATE_OPTS: Parameters<typeof makeClone>[0][] = [
  {},
  { setup: ['node setup-step.js ci'] },
  { setup: ['node setup-step.js ci'], tickets: [] },
  { tickets: [] },
  { setup: ['node setup-step.js ci', 'node setup-step.js build'] },
  { setup: ['node setup-step.js ci', 'node setup-step.js fail'] },
  { tickets: ['ST-9', 'ST-10'] },
  { tickets: ['ST-10'] },
  { tickets: ['ST-9', 'ST-10', 'ST-11'] },
  { setup: ['node setup-step.js fail'], tickets: ['ST-9', 'ST-10'] },
  { tickets: ['ST-9', 'ST-10', 'ST-11', 'ST-12'] },
  { tickets: ['ST-9', 'ST-10', 'ST-11', 'ST-12', 'ST-13'] },
];
const TEMPLATES = new Map<string, Clone>();
const key = (o?: Parameters<typeof makeClone>[0]) => JSON.stringify(o ?? {});
beforeAll(() => {
  for (const o of TEMPLATE_OPTS) TEMPLATES.set(key(o), makeTemplate(o));
}, 180_000);
afterAll(() => {
  for (const t of TEMPLATES.values()) t.cleanupAll();
});
const copy = (opts?: Parameters<typeof makeClone>[0]) => {
  const tpl = TEMPLATES.get(key(opts));
  if (tpl === undefined) throw new Error(`no template for ${key(opts)}; add it to TEMPLATE_OPTS`);
  const c = copyClone(tpl);
  clones.push(c);
  return c;
};
afterEach(() => {
  vi.mocked(proc.processTable).mockReset();
  vi.mocked(limit.fetchLimitMs).mockReset();
  vi.unstubAllEnvs();
  for (const c of clones.splice(0)) c.cleanupAll();
});

const entries = (c: Clone) => c.git('worktree', 'list', '--porcelain').split('\n\n').filter((e) => e.trim() !== '');

it('ac-1 pick up adds the ticket worktree from origin main runs setup in order and prints where to continue', async () => {
  const c = copy({ setup: ['node setup-step.js ci', 'node setup-step.js build'] });
  c.git('switch', '-q', '-c', 'other');
  writeFiles(c.root, { 'more.txt': 'x\n' });
  c.git('add', '-A');
  c.git('commit', '-q', '-m', 'more');
  const { code, out } = await run(['worktree', 'open', 'ST-9'], c.root);
  expect(code).toBe(0);
  const list = c.git('worktree', 'list', '--porcelain');
  expect(list).toContain(`worktree ${c.sibling('ST-9')}\n`);
  expect(list).toContain('branch refs/heads/t/ST-9');
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
  const c = copy({ setup: ['node setup-step.js ci', 'node setup-step.js fail'] });
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
  const c = copy();
  for (const id of ['../x', 'a/b', 'ST-99']) expect((await run(['worktree', 'open', id], c.root)).code, id).toBe(2);
  expect(entries(c)).toHaveLength(1);
  expect(c.git('branch', '--format=%(refname:short)').trim()).toBe('main');
});

it('risk:complex-branching pick up refuses a ticket that origin main lacks', async () => {
  const c = copy();
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
  const c = copy({ setup: ['node setup-step.js ci'] });
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

it('risk:complex-branching continue reaches a ticket whose file is only on its branch in the sibling worktree', async () => {
  // (a) the branch is checked out in the sibling worktree, the ticket file only there
  const a = copy({ setup: ['node setup-step.js ci'], tickets: [] });
  a.git('worktree', 'add', '-q', '-b', 't/ST-9', a.sibling('ST-9'), 'origin/main');
  writeFiles(a.sibling('ST-9'), { 'accord/tickets/ST-9.md': laneTicket('ST-9') });
  gitRun(a.sibling('ST-9'), 'add', '-A');
  gitRun(a.sibling('ST-9'), 'commit', '-q', '-m', 'ticket');
  const ra = await run(['worktree', 'open', 'ST-9', '--continue'], a.root);
  expect(ra.code).toBe(0);
  expect(ra.out.split('\n').slice(0, 3)).toEqual(stopLines(a.sibling('ST-9'), 'ST-9'));
  expect(existsSync(`${a.root}/accord/tickets/ST-9.md`)).toBe(false);
});

it('risk:complex-branching continue reaches a ticket whose file is only on a local branch with no worktree', async () => {
  // (b) a local branch with the ticket file and no worktree
  const b = copy({ setup: ['node setup-step.js ci'], tickets: [] });
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
});

it('risk:complex-branching continue reaches a ticket whose branch is only on origin and tracks it', async () => {
  // (c) the branch only on origin
  const d = copy({ setup: ['node setup-step.js ci'], tickets: [] });
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
  const c = copy();
  const r1 = await run(['worktree', 'open', 'ST-9', '--continue'], c.root);
  expect(r1.code).toBe(2);
  expect(r1.err.startsWith('not claimed: ST-9')).toBe(true);
  expect(entries(c)).toHaveLength(1);
  expect(c.git('branch', '--format=%(refname:short)').trim()).toBe('main');
  expect(c.git('log', '--all', '--format=%s')).not.toContain('claim:');
  expect(existsSync(c.sibling('ST-9'))).toBe(false);
});

it('risk:complex-branching continue of an id that is no ticket names it and creates nothing', async () => {
  const c = copy();
  const r2 = await run(['worktree', 'open', 'ST-77', '--continue'], c.root);
  expect(r2.code).toBe(2);
  expect(r2.err.startsWith('not a ticket: ST-77')).toBe(true);
  expect(entries(c)).toHaveLength(1);
  expect(c.git('branch', '--format=%(refname:short)').trim()).toBe('main');
  expect(c.git('log', '--all', '--format=%s')).not.toContain('claim:');
});

it('risk:complex-branching continue prunes a worktree whose folder was deleted by hand', async () => {
  const c = copy({ setup: ['node setup-step.js ci'] });
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
  const c = copy();
  c.git('worktree', 'add', '-q', '-b', 't/ST-9', c.sibling('ST-9'), 'origin/main');
  c.git('remote', 'remove', 'origin'); // H7: no fetch in this scenario; the pick-up exit 0 is made by the ac-1 pick-up test
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
  expect(r2.err).toContain(`in ${sib}, since `);
  expect(r2.err).toMatch(/since \d{4}-\d{2}-\d{2} \d{2}:\d{2} \(UTC[+-]\d{2}:\d{2}\) - /);
  expect(r2.err).not.toContain(taken);
  expect(readFileSync(holdsFile(c), 'utf8')).toBe(bytes);
  setTable(tableOf(B));
  const r3 = await run(['worktree', 'open', 'ST-9', '--continue'], sib, envOf(B));
  expect(r3.code).toBe(0);
  expect(r3.out).toBe(HELD);
  expect(JSON.parse(readFileSync(holdsFile(c), 'utf8'))['ST-9'].marker).toBe('sess-B');
});

// H3, H7: the worktree is added by git and the remote is dropped after its last use (no fetch in these scenarios).
const heldBy = async (c: Clone) => {
  c.git('worktree', 'add', '-q', '-b', 't/ST-9', c.sibling('ST-9'), 'origin/main');
  c.git('remote', 'remove', 'origin');
  const sib = c.sibling('ST-9');
  setTable(tableOf(A));
  await run(['worktree', 'open', 'ST-9', '--continue'], sib, envOf(A));
  return sib;
};

it('risk:complex-branching the holding session re-enters its own hold and a partial table refuses', async () => {
  const c = copy();
  const sib = await heldBy(c);
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
});

it('risk:complex-branching a session with the holding marker under another pid re-enters the hold', async () => {
  const c = copy();
  const sib = await heldBy(c);
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
  const C = { pid: 7003, start: 'S-C', marker: 'sess-A' };
  await again(C, tableOf(C, A));
});

it('risk:complex-branching a session that cannot see itself in the process table is refused and the hold is unchanged', async () => {
  const c = copy();
  const sib = await heldBy(c);
  // B takes over once A has stopped; a session that cannot see itself must then not judge
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
  const c = copy();
  c.git('worktree', 'add', '-q', '-b', 't/ST-9', c.sibling('ST-9'), 'origin/main');
  c.git('remote', 'remove', 'origin');
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
  const c = copy();
  c.git('worktree', 'add', '-q', '-b', 't/ST-9', c.sibling('ST-9'), 'origin/main');
  c.git('remote', 'remove', 'origin');
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
  const c = copy({ setup: ['node setup-step.js ci', 'node setup-step.js build'] });
  c.git('worktree', 'add', '-q', '-b', 't/ST-9', c.sibling('ST-9'), 'origin/main');
  c.git('remote', 'remove', 'origin'); // H7
  setTable(tableOf(A));
  expect((await run(['worktree', 'open', 'ST-9', '--continue'], c.sibling('ST-9'), envOf(A))).code).toBe(0);
  expect(readFileSync(`${c.sibling('ST-9')}/setup.log`, 'utf8')).toBe('ci\nbuild\n');
  expect((await run(['worktree', 'open', 'ST-9', '--continue'], c.sibling('ST-9'), envOf(A))).code).toBe(0);
  expect(readFileSync(`${c.sibling('ST-9')}/setup.log`, 'utf8')).toBe('ci\nbuild\n');
});

it('risk:complex-branching a hand-made worktree with no done marker reruns setup in full and exits 2 on its failure', async () => {
  const d = copy({ setup: ['node setup-step.js ci', 'node setup-step.js fail'] });
  d.git('worktree', 'add', '-q', '-b', 't/ST-9', d.sibling('ST-9'), 'origin/main');
  d.git('remote', 'remove', 'origin'); // H7
  setTable(tableOf(A));
  const r = await run(['worktree', 'open', 'ST-9', '--continue'], d.sibling('ST-9'), envOf(A));
  expect(r.code).toBe(2);
  expect(readFileSync(`${d.sibling('ST-9')}/setup.log`, 'utf8')).toBe('ci\nfail\n');
});

it('risk:complex-branching a pick up whose setup fails leaves no done marker', async () => {
  const d = copy({ setup: ['node setup-step.js ci', 'node setup-step.js fail'] });
  await run(['worktree', 'open', 'ST-9'], d.root); // the pick-up exit 2 is made by the ac-2 pick-up test
  const marker = d.git('-C', d.sibling('ST-9'), 'rev-parse', '--path-format=absolute', '--git-dir').trim() + '/accord-setup-done';
  expect(existsSync(marker)).toBe(false);
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

/** The ticket file as verify leaves it: every criterion ticked at verified commit `v`. */
function doneTicket(id: string, v: string): string {
  const t = loadSnapshot({ files: { 'accord/config.yml': CONFIG, ['accord/tickets/' + id + '.md']: laneTicket(id) }, tree: [] });
  const a = approvedHash(t.tickets[id]);
  const h = gateReady(t, id).acHash;
  return laneTicket(id, {
    frontmatter: ['approved_hash: "' + a + '"', 'ac_hash: "' + h + '"', 'verified: [ac-1, ac-2]', 'verified_hash: "' + h + '"', 'verified_commit: "' + v + '"'],
  });
}
/** Verify's commits on each ticket branch, then its merge into the remote main, from a teammate's clone; returns each id's tick commit. */
function doneOnRemote(c: Clone, ids: string[], opts: { squash?: boolean; local?: boolean } = {}): Record<string, string> {
  const o = c.otherClone();
  const out: Record<string, string> = {};
  const onBranches: string[] = [];
  const refspecs: string[] = [];
  for (const id of ids) {
    const onBranch = has(o, `refs/remotes/origin/t/${id}`);
    if (onBranch) gitRun(o, 'switch', '-q', '--detach', `origin/t/${id}`);
    verifyStage(o, id);
    const v = gitRun(o, 'rev-parse', 'HEAD').trim();
    writeFiles(o, { [`accord/tickets/${id}.md`]: doneTicket(id, v) });
    const tip = commitMsg(o, 'verify: ' + id);
    if (onBranch) {
      onBranches.push(id);
      refspecs.push(`${tip}:refs/heads/t/${id}`);
      gitRun(o, 'switch', '-q', 'main');
      if (opts.squash) {
        gitRun(o, 'merge', '--squash', '-q', tip);
        commitMsg(o, 'merge ' + id);
      } else mergeMsg(o, tip, 'merge ' + id);
    }
    out[id] = tip;
  }
  gitRun(o, 'push', '-q', 'origin', 'main', ...refspecs); // one push for the ticket branches and main
  if (opts.local) {
    for (const id of onBranches) {
      c.git('fetch', '-q', 'origin', `t/${id}`);
      if (existsSync(c.sibling(id))) gitRun(c.sibling(id), 'merge', '--ff-only', '-q', `origin/t/${id}`);
      else c.git('update-ref', `refs/heads/t/${id}`, out[id]);
    }
  }
  return out;
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
/** The branches `ticketBranch` makes, pushed together in one `git push` (same refs, same tracking). */
function ticketBranches(c: Clone, ids: string[]) {
  for (const id of ids) {
    c.git('switch', '-q', '-c', `t/${id}`, 'main');
    writeFiles(c.root, { [`${id}.txt`]: id + '\n' });
    c.git('add', '-A');
    c.git('commit', '-q', '-m', id);
  }
  c.git('switch', '-q', 'main');
  c.git('push', '-q', '-u', 'origin', ...ids.map((id) => `t/${id}`));
}
const sha = (c: Clone, ref: string) => c.git('rev-parse', ref).trim();

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
  const c = copy({ setup: ['node setup-step.js ci'], tickets: [] });
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

// The teammate (y@example.invalid) has pushed the branches a test needs; `me` is the identity of the claims that are mine.
const ME = ['-c', 'user.email=fixture@example.invalid'];
const teammate = (c: Clone) => {
  const o = c.otherClone();
  gitRun(o, 'config', 'user.email', 'y@example.invalid');
  return o;
};
const pushedWork = (o: string, id: string, file: string) => {
  gitRun(o, 'switch', '-q', '-c', 't/' + id, 'main');
  writeFiles(o, { [file]: 'x\n' });
  gitRun(o, 'add', '-A');
  gitRun(o, 'commit', '-q', '-m', 'work');
  gitRun(o, 'push', '-q', 'origin', 't/' + id);
};

it('risk:complex-branching pick up refuses a branch another person claimed', async () => {
  const c = copy({ tickets: ['ST-9', 'ST-10', 'ST-11', 'ST-12', 'ST-13'] });
  const o = teammate(c);
  gitRun(o, 'switch', '-q', '-c', 't/ST-9', 'main');
  gitRun(o, 'commit', '-q', '--allow-empty', '-m', 'claim: ST-9');
  gitRun(o, 'push', '-q', 'origin', 't/ST-9');
  c.git('fetch', '-q', 'origin');

  const r = await run(['worktree', 'open', 'ST-9'], c.root);
  expect(r.code).toBe(2);
  expect(r.err.startsWith('claimed: ST-9 by y@example.invalid')).toBe(true);
  expect(r.err).toContain('/accord continue ST-9');
  expect(r.out).not.toContain('stop:');
  expect(entries(c)).toHaveLength(1);
  expect(() => c.git('rev-parse', '--verify', '-q', 'refs/heads/t/ST-9')).toThrow();
  expect(existsSync(c.sibling('ST-9'))).toBe(false);
});

it("risk:complex-branching pick up refuses a branch whose commits are another person's work", async () => {
  const c = copy({ tickets: ['ST-9', 'ST-10', 'ST-11', 'ST-12', 'ST-13'] });
  pushedWork(teammate(c), 'ST-11', 'x.txt');
  c.git('fetch', '-q', 'origin');

  const id = 'ST-11';
  const r = await run(['worktree', 'open', id], c.root);
  expect(r.code, id).toBe(2);
  expect(r.err.startsWith(`claimed: ${id} by y@example.invalid`), id).toBe(true);
  expect(existsSync(c.sibling(id)), id).toBe(false);
});

it("risk:complex-branching pick up refuses another person's work branch even with my claim on the default branch", async () => {
  const c = copy({ tickets: ['ST-9', 'ST-10', 'ST-11', 'ST-12', 'ST-13'] });
  const o = teammate(c);
  gitRun(o, ...ME, 'commit', '-q', '--allow-empty', '-m', 'claim: ST-12');
  gitRun(o, 'push', '-q', 'origin', 'main');
  pushedWork(o, 'ST-12', 'y.txt');
  c.git('fetch', '-q', 'origin');

  const id = 'ST-12';
  const r = await run(['worktree', 'open', id], c.root);
  expect(r.code, id).toBe(2);
  expect(r.err.startsWith(`claimed: ${id} by y@example.invalid`), id).toBe(true);
  expect(existsSync(c.sibling(id)), id).toBe(false);
});

it('risk:complex-branching pick up judges the pushed claim when my unpushed claim branch exists', async () => {
  const c = copy({ tickets: ['ST-9', 'ST-10', 'ST-11', 'ST-12', 'ST-13'] });
  const o = teammate(c);
  gitRun(o, 'switch', '-q', '-c', 't/ST-13', 'main');
  gitRun(o, 'commit', '-q', '--allow-empty', '-m', 'claim: ST-13');
  gitRun(o, 'push', '-q', 'origin', 't/ST-13');
  c.git('fetch', '-q', 'origin');
  // the user's own unpushed claim on a local branch must not hide the teammate's pushed one
  c.git('branch', 't/ST-13', c.git('-c', 'user.email=fixture@example.invalid', 'commit-tree', 'main^{tree}', '-p', 'main', '-m', 'claim: ST-13').trim());

  const r = await run(['worktree', 'open', 'ST-13'], c.root);
  expect(r.code).toBe(2);
  expect(r.err.startsWith('claimed: ST-13 by y@example.invalid')).toBe(true);
  expect(existsSync(c.sibling('ST-13'))).toBe(false);
});

it('risk:complex-branching pick up reuses a branch claimed by the same email', async () => {
  const c = copy({ tickets: ['ST-9', 'ST-10', 'ST-11', 'ST-12', 'ST-13'] });
  const o = teammate(c);
  gitRun(o, 'switch', '-q', '-c', 't/ST-10', 'main');
  gitRun(o, ...ME, 'commit', '-q', '--allow-empty', '-m', 'claim: ST-10');
  gitRun(o, 'commit', '-q', '--allow-empty', '-m', 'help');
  gitRun(o, 'push', '-q', 'origin', 't/ST-10');
  c.git('fetch', '-q', 'origin');

  const r = await run(['worktree', 'open', 'ST-10'], c.root);
  expect(r.code).toBe(0);
  expect(r.out.split('\n').slice(0, 3)).toEqual([
    'stop: open a session in this folder and type the line below it',
    c.sibling('ST-10'),
    '/accord continue ST-10',
  ]);
  expect(gitRun(c.sibling('ST-10'), 'rev-parse', 'HEAD').trim()).toBe(c.git('rev-parse', 'origin/t/ST-10').trim());
  expect(c.git('log', '--all', '--format=%s').split('\n').filter((s) => s === 'claim: ST-10')).toHaveLength(1);
});

it('risk:complex-branching continue opens a ticket another person claimed and a later pick up still refuses', async () => {
  const c = copy({ tickets: ['ST-9', 'ST-10', 'ST-11', 'ST-12', 'ST-13'] });
  const o = teammate(c);
  gitRun(o, 'switch', '-q', '-c', 't/ST-9', 'main');
  gitRun(o, 'commit', '-q', '--allow-empty', '-m', 'claim: ST-9');
  gitRun(o, 'push', '-q', 'origin', 't/ST-9');
  c.git('fetch', '-q', 'origin');

  let r = await run(['worktree', 'open', 'ST-9', '--continue'], c.root);
  expect(r.code).toBe(0);
  expect(r.out.split('\n').slice(0, 3)).toEqual([
    'stop: open a session in this folder and type the line below it',
    c.sibling('ST-9'),
    '/accord continue ST-9',
  ]);
  r = await run(['worktree', 'open', 'ST-9'], c.root);
  expect(r.code).toBe(2);
  expect(r.err.startsWith('claimed: ST-9 by y@example.invalid')).toBe(true);
  expect(entries(c)).toHaveLength(2);
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

it('ac-2 a merged branch whose remote branch is gone is deleted from another ticket branch with a stale local main', async () => {
  const c = clone();
  ticketBranch(c, 'ST-9');
  c.git('switch', '-q', '-c', 't/ST-20', 'main');
  writeFiles(c.root, { 'ST-20.txt': 'x\n' });
  c.git('add', '-A');
  c.git('commit', '-q', '-m', 'ST-20');
  doneOnRemote(c, ['ST-9']);
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
  doneOnRemote(c, ['ST-9']);
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
  doneOnRemote(c, ['ST-1', 'ST-2']);
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
  doneOnRemote(d, ['ST-9']);
  d.git('fetch', '-q', 'origin');
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
  const c = copy({ setup: ['node setup-step.js ci'] });
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
});

it('ac-2 in claude code continue from the main checkout enters a claimed worktree whose session ended with or without a worktree here', async () => {
  const c = copy({ tickets: ['ST-9', 'ST-10'] });
  c.git('worktree', 'add', '-q', '-b', 't/ST-9', c.sibling('ST-9'), 'origin/main'); // H3: the pick-up result was never asserted
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

// H1, H2, H4: the two pinned-worktree tests share this set-up; the pick-up whose origin main pins another version is its own test.
const pinnedWorktree = (c: Clone) => {
  c.git('worktree', 'add', '-q', '-b', 't/ST-9', c.sibling('ST-9'), 'origin/main');
  const cfg = `${c.sibling('ST-9')}/accord/config.yml`;
  writeFileSync(cfg, readFileSync(cfg, 'utf8').replace(`accord: "${PIN}"`, 'accord: "0.0.9"'));
  gitRun(c.sibling('ST-9'), 'commit', '-q', '-am', 'pin');
  setTable(tableOf(A));
};

it('risk:complex-branching in claude code a worktree pinned to another accord version refuses before setup and prints no enter', async () => {
  const c = copy();
  pinnedWorktree(c);
  const a = await run(['worktree', 'open', 'ST-9', '--continue'], c.root, envOf(A));
  expect(a.code).toBe(2);
  expect(a.err).toContain('pins accord 0.0.9');
  expect(a.err).toContain('merge origin/main into t/ST-9');
  expect(a.out).not.toContain('enter:');
  expect(existsSync(holdsFile(c))).toBe(false);
}, 120_000);

it('risk:complex-branching outside claude code a worktree pinned to another accord version still prints the stop lines', async () => {
  const c = copy();
  pinnedWorktree(c);
  const plain = await run(['worktree', 'open', 'ST-9', '--continue'], c.root);
  expect(plain.code).toBe(0);
  expect(lines(plain.out)).toEqual(stopLines(c.sibling('ST-9'), 'ST-9'));
}, 120_000);

it('risk:complex-branching in claude code a pick up whose origin main pins another version refuses and names the main checkout', async () => {
  const d = copy({ setup: ['node setup-step.js ci'] });
  const o = d.otherClone();
  gitRun(o, 'config', 'user.email', 'y@example.invalid');
  writeFileSync(`${o}/accord/config.yml`, readFileSync(`${o}/accord/config.yml`, 'utf8').replace(`accord: "${PIN}"`, 'accord: "0.0.9"'));
  gitRun(o, 'commit', '-q', '-am', 'pin');
  gitRun(o, 'push', '-q', 'origin', 'main');
  d.git('fetch', '-q', 'origin');
  setTable(tableOf(A));
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
  const c = copy({ tickets: ['ST-9', 'ST-10'] });
  const sib = c.sibling('ST-9');
  setTable(tableOf(A));
  expect((await run(['worktree', 'open', 'ST-9'], c.root, envOf(A))).code).toBe(0);
  verifyStage(sib, 'ST-9');
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
  const c = copy({ tickets: ['ST-9', 'ST-10'] });
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
  const c = copy({ tickets: ['ST-9', 'ST-10'] });
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
  for (const s of [chk.out, o.out, n.out]) expect(s).not.toContain('enter:');
  expect(existsSync(holdsFile(c))).toBe(false);
  expect(proc.processTable).not.toHaveBeenCalled();
  const r = await run(['worktree', 'open', 'ST-10'], c.sibling('ST-9'), E);
  expect(r.code).toBe(2);
  expect(r.err).toContain('this session works ST-9');
});

it('risk:complex-branching a claude code session without session variables gets the stop lines from a new worktree ticket', async () => {
  const c = copy({ tickets: ['ST-9', 'ST-10'] });
  const E = { CLAUDECODE: '1' };
  vi.mocked(proc.processTable).mockClear();
  const w = await run(['new', 'ticket', 'ST-12', '--lane', 'M', '--worktree'], c.root, E);
  expect(w.code).toBe(0);
  expect(w.out.trimEnd().split('\n').slice(-3)).toEqual(stopLines(c.sibling('ST-12'), 'ST-12'));
  for (const s of [w.out]) expect(s).not.toContain('enter:');
  expect(existsSync(holdsFile(c))).toBe(false);
  expect(proc.processTable).not.toHaveBeenCalled();
});

it('risk:complex-branching in claude code a pick up whose setup failed still holds its ticket and refuses a second one', async () => {
  const c = copy({ setup: ['node setup-step.js fail'], tickets: ['ST-9', 'ST-10'] });
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
}, 120_000);

it('risk:complex-branching in claude code a continue after a failed pick up setup reruns setup and is not refused', async () => {
  const c = copy({ setup: ['node setup-step.js fail'], tickets: ['ST-9', 'ST-10'] });
  // H3: the worktree and hold A the failed pick-up left, made by git and fs; H7: nothing here fetches or pushes.
  c.git('worktree', 'add', '-q', '-b', 't/ST-9', c.sibling('ST-9'), 'origin/main');
  writeHolds(c, { 'ST-9': { tool: 'Claude Code', ...A, taken: '2026-10-18T00:00:00.000Z' } });
  c.git('remote', 'remove', 'origin');
  setTable(tableOf(A));
  const again = await run(['worktree', 'open', 'ST-9', '--continue'], c.root, envOf(A));
  expect(again.code).toBe(2);
  expect(again.err).toContain('setup command failed');
  expect(again.err).not.toContain('this session works');
}, 120_000);

it('risk:complex-branching in claude code a new ticket whose push failed still holds it and refuses a second one', async () => {
  const d = copy({ tickets: ['ST-10'] });
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
  doneOnRemote(c, ['ST-9']);
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

it('risk:complex-branching the resume hook in the main checkout prints the enter line of the held worktree and no anchor from main', async () => {
  const c = clone();
  setTable(tableOf(A));
  expect((await run(['worktree', 'open', 'ST-9'], c.root, envOf(A))).code).toBe(0);
  const ticket = `${c.sibling('ST-9')}/accord/tickets/ST-9.md`;
  writeFileSync(ticket, readFileSync(ticket, 'utf8') + '\n## Corrections\n- branch-only correction\n');
  commitMsg(c.sibling('ST-9'), 'correction on the branch only');
  const resume = (s: { marker: string; pid: number }, cwd: string) =>
    run(['hook', 'session-resume'], c.root, envOf(s), JSON.stringify({ session_id: s.marker, cwd, source: 'resume' }));
  const a = await resume(A, c.root);
  expect(a.out).not.toContain('# Anchor:');
  expect(a.out).not.toContain('branch-only correction');
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


it('risk:data-loss clean removes a held done worktree and its hold and keeps the worked record', async () => {
  const c = copy({ tickets: ['ST-9', 'ST-10', 'ST-11'] });
  const sib = c.sibling('ST-9');
  const worked = () => readFileSync(`${c.root}/.git/accord/worked`, 'utf8');
  // H3: what the pick-up and the continue left, by git and fs: the worktree, hold A, and the worked record.
  c.git('worktree', 'add', '-q', '-b', 't/ST-9', sib, 'origin/main');
  writeHolds(c, { 'ST-9': { tool: 'Claude Code', ...A, taken: '2026-10-18T00:00:00.000Z' } });
  writeFileSync(`${c.root}/.git/accord/worked`, 'ST-9\tsess-A\n');

  gitRun(sib, 'push', '-q', '-u', 'origin', 't/ST-9');
  doneOnRemote(c, ['ST-9']);
  setTable(tableOf(B));
  const cl = await run(['worktree', 'clean'], c.root, envOf(B));
  expect(cl.code).toBe(0);
  expect(cl.out).toContain(`removed ${sib}`);
  expect(existsSync(sib)).toBe(false);
  expect(Object.hasOwn(readHolds(c), 'ST-9')).toBe(false);
  expect(worked()).toBe('ST-9\tsess-A\n');
}, 120_000);

it('risk:complex-branching a session whose hold was cleaned or taken over still works its ticket when resumed in the main checkout', async () => {
  const c = copy({ tickets: ['ST-9', 'ST-10', 'ST-11'] });
  const hook = (s: { marker: string }, args: string) =>
    run(['hook', 'prompt-expansion'], c.root, {}, JSON.stringify({ session_id: s.marker, command_name: 'accord', command_args: args, cwd: c.root }));
  // H3, H7: the state a clean left (no hold on ST-9, no worktree, A recorded as working it); nothing here fetches or pushes.
  writeHolds(c, {});
  writeFileSync(`${c.root}/.git/accord/worked`, 'ST-9\tsess-A\n');
  c.git('remote', 'remove', 'origin');
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
}, 120_000);

it('risk:complex-branching a session whose hold was taken over still works its ticket when resumed in the main checkout', async () => {
  const c = copy({ tickets: ['ST-9', 'ST-10', 'ST-11'] });
  const worked = () => readFileSync(`${c.root}/.git/accord/worked`, 'utf8');
  const hook = (s: { marker: string }, args: string) =>
    run(['hook', 'prompt-expansion'], c.root, {}, JSON.stringify({ session_id: s.marker, command_name: 'accord', command_args: args, cwd: c.root }));
  // H3, H7: the ST-10 worktree and hold C that C's pick-up left, by git and fs; the continue of B that takes it over is the case.
  c.git('worktree', 'add', '-q', '-b', 't/ST-10', c.sibling('ST-10'), 'origin/main');
  writeHolds(c, { 'ST-10': { tool: 'Claude Code', ...C, taken: '2026-10-18T00:00:00.000Z' } });
  writeFileSync(`${c.root}/.git/accord/worked`, 'ST-10\tsess-C\n');
  c.git('remote', 'remove', 'origin');
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

it('risk:complex-branching in claude code a pick up records the session as working its ticket', async () => {
  const c = copy();
  const worked = () => readFileSync(`${c.root}/.git/accord/worked`, 'utf8');
  setTable(tableOf(A));
  await run(['worktree', 'open', 'ST-9'], c.root, envOf(A)); // its exit and enter line are checked by the ac-1 pick-up test
  expect(worked()).toBe('ST-9\tsess-A\n');
}, 120_000);

it('risk:complex-branching a session started in a ticket worktree is recorded as working it when the start hook takes no hold', async () => {
  // The hooks read the per-machine cache folder: point it at a temp folder (`requestLatest` and `cachePath` are mocked in setup.ts).
  const cache = mkdtempSync(join(tmpdir(), 'accord-cache-'));
  vi.stubEnv('LOCALAPPDATA', cache);
  vi.stubEnv('XDG_CACHE_HOME', cache);
  const c = copy({ tickets: ['ST-9', 'ST-10'] });
  const sib = c.sibling('ST-9');
  c.git('worktree', 'add', '-q', '-b', 't/ST-9', sib, 'origin/main');
  const worked = () => readFileSync(`${c.root}/.git/accord/worked`, 'utf8');
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
  vi.unstubAllEnvs();
  cleanup(cache);
}, 120_000);

it('risk:complex-branching a session recorded as working a ticket whose worktree is gone is refused other tickets in the main checkout', async () => {
  const c = copy({ tickets: ['ST-9', 'ST-10'] });
  const hook = (s: { marker: string }, args: string) =>
    run(['hook', 'prompt-expansion'], c.root, {}, JSON.stringify({ session_id: s.marker, command_name: 'accord', command_args: args, cwd: c.root }));
  // H4: the state the first test leaves once the ST-9 worktree is removed: B, E and C recorded as working ST-9, a live hold on it, no worktree.
  mkdirSync(`${c.root}/.git/accord`, { recursive: true });
  writeFileSync(`${c.root}/.git/accord/worked`, 'ST-9\tsess-B\nST-9\tsess-E\nST-9\tsess-C\n');
  writeHolds(c, { 'ST-9': LIVE });
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

// ST-LN-34: clean deletes the worktree and branches of a ticket dropped on the default branch.
const has = (dir: string, ref: string) => {
  try {
    gitRun(dir, 'rev-parse', '--verify', '-q', ref);
    return true;
  } catch {
    return false;
  }
};

/** A worktree `t/<id>` with one commit pushed to the remote; returns that commit. */
function claimWorktree(c: Clone, id: string, files: Record<string, string> = { [`${id}.txt`]: id + '\n' }) {
  c.git('worktree', 'add', '-q', '-b', `t/${id}`, c.sibling(id), 'origin/main');
  writeFiles(c.sibling(id), files);
  const tip = commitMsg(c.sibling(id), id);
  gitRun(c.sibling(id), 'push', '-q', '-u', 'origin', `t/${id}`);
  return tip;
}

/** Put each ticket on the remote main as dropped, from another clone; `c` does not fetch. */
function dropOnRemote(c: Clone, ids: string[]) {
  const o = c.otherClone();
  for (const id of ids) {
    writeFiles(o, { [`accord/tickets/${id}.md`]: laneTicket(id, { frontmatter: ['status: dropped'], body: LANE_BODY + '\n## Dropped\ngone\n' }) });
  }
  commitMsg(o, 'drop');
  gitRun(o, 'push', '-q', 'origin', 'main');
}

async function dropAndMerge(c: Clone, id: string) {
  expect((await run(['drop', id, '--reason', 'no longer needed'], c.root)).code).toBe(0);
  const o = c.otherClone();
  mergeMsg(o, `origin/drop/${id}`, `merge drop/${id}`);
  gitRun(o, 'push', '-q', 'origin', 'main');
}

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

it('risk:complex-branching pick up refuses a ticket the default branch holds as dropped', async () => {
  const c = copy({ tickets: ['ST-9', 'ST-10'] });
  dropOnRemote(c, ['ST-9']);
  c.git('fetch', '-q', 'origin');
  const a = await run(['worktree', 'open', 'ST-9'], c.root);
  expect(a.code).toBe(2);
  expect(a.err).toContain('ST-9 is dropped on main');
  expect(a.err).toContain('make a new ticket instead');
  expect(existsSync(c.sibling('ST-9'))).toBe(false);
  expect(has(c.root, 'refs/heads/t/ST-9')).toBe(false);
}, 120_000);

it('risk:complex-branching pick up refuses a ticket the default branch holds as dropped even with a local ticket branch', async () => {
  const c = copy({ tickets: ['ST-9', 'ST-10'] });
  c.git('branch', 't/ST-10', 'origin/main');
  dropOnRemote(c, ['ST-10']);
  c.git('fetch', '-q', 'origin');
  const b = await run(['worktree', 'open', 'ST-10'], c.root);
  expect(b.code).toBe(2);
  expect(b.err).toContain('ST-10 is dropped on main');
  expect(existsSync(c.sibling('ST-10'))).toBe(false);
}, 120_000);

it('risk:complex-branching continue still opens a ticket the default branch holds as dropped', async () => {
  const c = copy({ tickets: ['ST-9', 'ST-10'] });
  c.git('branch', 't/ST-10', 'origin/main');
  dropOnRemote(c, ['ST-10']);
  c.git('fetch', '-q', 'origin');
  const k = await run(['worktree', 'open', 'ST-10', '--continue'], c.root);
  expect(k.code).toBe(0);
  expect(existsSync(c.sibling('ST-10'))).toBe(true);
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
  const c = copy();
  const tip = pushNext(c);
  expect(sha(c, 'origin/main')).not.toBe(tip);
  const r = await run(['worktree', 'open', 'ST-9'], c.root);
  expect(r.code).toBe(0);
  expect(c.git('rev-parse', 't/ST-9^').trim()).toBe(tip);
  expect(c.git('log', '-1', '--format=%s', 't/ST-9').trim()).toBe('claim: ST-9');
  expect(r.out).not.toContain('fetch from origin failed');

  const d = copy({ tickets: [] });
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
  verifyStage(c.sibling('ST-9'), 'ST-9');
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
  const c = copy();
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
  const c = copy();
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

it('risk:complex-branching worktree merge refuses a ticket before verify and merges nothing', async () => {
  const c = copy();
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
}, 120_000);

it("risk:complex-branching worktree merge refuses on a branch other than the ticket's and merges nothing", async () => {
  const d = copy();
  ticketWorktree(d, 'ST-9');
  verifyStage(d.sibling('ST-9'), 'ST-9');
  const dHead = gitRun(d.sibling('ST-9'), 'rev-parse', 'HEAD').trim();
  pushMain(d, 'next.txt', 'next\n');
  const away = await run(['worktree', 'merge', 'ST-9'], d.root);
  expect(away.code).toBe(2);
  expect(away.err).toContain('t/ST-9');
  expect(away.err).toContain('nothing was merged');
  expect(gitRun(d.sibling('ST-9'), 'rev-parse', 'HEAD').trim()).toBe(dHead);
}, 120_000);

it('risk:complex-branching worktree merge refuses over tracked changes and merges nothing', async () => {
  const e = copy();
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
  const c = copy();
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
}, 120_000);

// a rename on main whose target is an ignored file present here
it('risk:data-loss worktree merge never overwrites an ignored file that a rename on main targets', async () => {
  const d = copy();
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
}, 120_000);

// a non-ASCII path, which git quotes and octal-escapes by default
it('risk:data-loss worktree merge names a non-ASCII ignored file it would overwrite', async () => {
  const u = copy();
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

// a case-only rename on main of a file this branch tracks is no overwrite, on either kind of filesystem
it('risk:complex-branching worktree merge takes a case-only rename on main of a tracked file', async () => {
  const k = copy();
  pushMain(k, 'README.md', 'readme\n');
  k.git('fetch', '-q', 'origin');
  ticketWorktree(k, 'ST-9');
  const kSib = k.sibling('ST-9');
  verifyStage(kSib, 'ST-9');
  const kHead = gitRun(kSib, 'rev-parse', 'HEAD').trim();
  const w = k.otherClone();
  gitRun(w, 'mv', 'README.md', 'Readme.md');
  gitRun(w, 'commit', '-q', '-m', 'case rename');
  gitRun(w, 'push', '-q', 'origin', 'main');
  const kr = await run(['worktree', 'merge', 'ST-9'], kSib);
  expect(kr.err).toBe('');
  expect(kr.code).toBe(0);
  expect(gitRun(kSib, 'rev-parse', 'HEAD^1').trim()).toBe(kHead);
}, 120_000);

// a main that adds so many files that the pathspec list alone passes the Windows command-line limit of 32767 characters
it('risk:regression worktree merge of a main that adds 500 long paths passes the Windows command-line limit', async () => {
  const m = copy();
  ticketWorktree(m, 'ST-9');
  const mSib = m.sibling('ST-9');
  verifyStage(mSib, 'ST-9');
  const mHead = gitRun(mSib, 'rev-parse', 'HEAD').trim();
  const many: Record<string, string> = {};
  for (let i = 0; i < 500; i++) many[`big/${'n'.repeat(70)}-${i}.txt`] = 'x\n';
  const mo = m.otherClone();
  writeFiles(mo, many);
  gitRun(mo, 'add', '-A');
  gitRun(mo, 'commit', '-q', '-m', 'many');
  gitRun(mo, 'push', '-q', 'origin', 'main');
  const mr = await run(['worktree', 'merge', 'ST-9'], mSib);
  expect(mr.err).toBe('');
  expect(mr.code).toBe(0);
  expect(gitRun(mSib, 'rev-parse', 'HEAD^1').trim()).toBe(mHead);
}, 120_000);

it('risk:complex-branching a merge that changes the pinned accord version keeps the merge and names the pin', async () => {
  const c = clone();
  ticketWorktree(c, 'ST-9');
  const sib = c.sibling('ST-9');
  verifyStage(sib, 'ST-9');
  const head = gitRun(sib, 'rev-parse', 'HEAD').trim();
  const o = c.otherClone();
  const cfg = o + '/accord/config.yml';
  writeFileSync(cfg, readFileSync(cfg, 'utf8').replace('accord: "0.3.0"', 'accord: "9.9.9"'));
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

  const c = copy();
  missing(c);
  const base = sha(c, 'origin/main');
  const rc = await run(['worktree', 'open', 'ST-9'], c.root);
  expect(rc.code).toBe(0);
  one(rc.out, rc.err);
  expect(sha(c, 't/ST-9^')).toBe(base);

  const d = copy({ tickets: [] });
  missing(d);
  d.git('remote', 'set-url', '--push', 'origin', d.remote);
  const rd = await run(['new', 'ticket', 'ST-9', '--lane', 'M', '--worktree'], d.root);
  expect(rd.code).toBe(0);
  one(rd.out, rd.err);

  const e = copy();
  ticketWorktree(e, 'ST-9');
  missing(e);
  const re = await run(['worktree', 'open', 'ST-9', '--continue'], e.root);
  expect(re.code).toBe(0);
  one(re.out, re.err);
  expect(lines(re.out).slice(-3)).toEqual(stopLines(e.sibling('ST-9'), 'ST-9'));

  const f = copy();
  ticketWorktree(f, 'ST-9');
  verifyStage(f.sibling('ST-9'), 'ST-9');
  missing(f);
  const head = gitRun(f.sibling('ST-9'), 'rev-parse', 'HEAD').trim();
  const rf = await run(['worktree', 'merge', 'ST-9'], f.sibling('ST-9'));
  expect(rf.code).toBe(0);
  one(rf.out, rf.err);
  expect(gitRun(f.sibling('ST-9'), 'rev-parse', 'HEAD').trim()).toBe(head);

  const g = copy();
  const release = `${g.root}/.git/hang-release`;
  const ended = `${g.root}/.git/hang-ended`;
  // the remote stays silent until the test releases it, 60 s at most, then marks that it ended
  g.git('config', 'remote.origin.uploadpack', `cd / && i=0; while [ ! -f '${release}' ] && [ $i -lt 60 ]; do sleep 1; i=$((i+1)); done; : > '${ended}'; :`);
  vi.mocked(limit.fetchLimitMs).mockReturnValue(2000);
  try {
    const t0 = Date.now();
    const rg = await run(['worktree', 'open', 'ST-9'], g.root);
    expect(rg.code).toBe(0);
    expect(Date.now() - t0).toBeLessThan(15000);
    expect(one(rg.out, rg.err)).toBe(P + 'no answer within 2 seconds');
    expect(sha(g, 't/ST-9^')).toBe(sha(g, 'origin/main'));
  } finally {
    writeFileSync(release, '');
    // the killed fetch leaves its upload-pack shell running, and on Windows it keeps the clone from being removed
    for (let i = 0; i < 100 && !existsSync(ended); i++) await new Promise((r) => setTimeout(r, 100));
  }
}, 120_000);

it('ac-4 continue merges the latest origin main into a ticket branch before verify runs setup on the merge and pushes it', async () => {
  const c = copy({ setup: ['node setup-step.js ci'] });
  ticketWorktree(c, 'ST-9');
  const sib = c.sibling('ST-9');
  const before = sha(c, 't/ST-9');
  const o = c.otherClone();
  writeFiles(o, { 'setup-step.js': "require('node:fs').appendFileSync('setup.log', 'merged ' + process.argv[2] + '\\n');\n", 'a.txt': 'a\n' });
  commitMsg(o, 'a');
  writeFiles(o, { 'b.txt': 'b\n' });
  const tip = commitMsg(o, 'b');
  gitRun(o, 'push', '-q', 'origin', 'main');
  expect(sha(c, 'origin/main')).not.toBe(tip);
  const r = await run(['worktree', 'open', 'ST-9', '--continue'], c.root);
  expect(r.code).toBe(0);
  expect(gitRun(sib, 'rev-parse', 'HEAD^1').trim()).toBe(before);
  expect(gitRun(sib, 'rev-parse', 'HEAD^2').trim()).toBe(tip);
  expect(gitRun(sib, 'rev-list', '--parents', '-n', '1', 'HEAD').trim().split(' ')).toHaveLength(3);
  expect(gitRun(sib, 'branch', '--show-current').trim()).toBe('t/ST-9');
  expect(gitRun(sib, 'reflog', '-n', '10')).not.toContain('rebase');
  const head = gitRun(sib, 'rev-parse', 'HEAD').trim();
  expect(sha(c, 't/ST-9')).toBe(head);
  expect(gitRun(c.remote, 'rev-parse', 't/ST-9').trim()).toBe(head);
  expect(readFileSync(sib + '/setup.log', 'utf8')).toBe('merged ci\n');
  const out = lines(r.out);
  expect(out).toContain('merged: 2 commits of origin/main into t/ST-9');
  expect(out.some((l) => l.startsWith('behind:'))).toBe(false);
  expect(out.slice(-3)).toEqual(stopLines(sib, 'ST-9'));

  const s = copy({ setup: ['node setup-step.js ci'] });
  ticketWorktree(s, 'ST-9');
  const ss = s.sibling('ST-9');
  const marker = gitRun(ss, 'rev-parse', '--path-format=absolute', '--git-dir').trim() + '/accord-setup-done';
  writeFileSync(marker, '');
  const so = s.otherClone();
  writeFiles(so, { 'setup-step.js': 'process.exit(3);\n' });
  commitMsg(so, 'break setup');
  gitRun(so, 'push', '-q', 'origin', 'main');
  const bad = await run(['worktree', 'open', 'ST-9', '--continue'], s.root);
  expect(bad.code).toBe(2);
  expect(bad.err).toContain('setup command failed');
  expect(existsSync(marker)).toBe(false);
  expect(gitRun(s.remote, 'rev-parse', 't/ST-9').trim()).toBe(gitRun(ss, 'rev-parse', 'HEAD').trim());
  const again = await run(['worktree', 'open', 'ST-9', '--continue'], ss);
  expect(again.code).toBe(2);
  expect(again.err).toContain('setup command failed');
}, 120_000);

const BEHIND = 'behind: t/ST-9 is 2 commits behind origin/main; merge them with git merge origin/main';
const twoOnMain = (k: Clone) => {
  const x = k.otherClone();
  for (const f of ['a.txt', 'b.txt']) {
    writeFiles(x, { [f]: f + '\n' });
    commitMsg(x, f);
  }
  gitRun(x, 'push', '-q', 'origin', 'main');
};

it('risk:data-loss a continue merge that conflicts is aborted names the file and pushes nothing', async () => {
  const c = copy();
  writeFiles(c.root, { 'shared.txt': 'base\n' });
  commitMsg(c.root, 'shared');
  c.git('push', '-q', 'origin', 'main');
  ticketWorktree(c, 'ST-9', 'shared.txt');
  const sib = c.sibling('ST-9');
  const head = sha(c, 't/ST-9');
  const o = c.otherClone();
  writeFiles(o, { 'shared.txt': 'main\n' });
  commitMsg(o, 'shared main');
  gitRun(o, 'push', '-q', 'origin', 'main');
  const r = await run(['worktree', 'open', 'ST-9', '--continue'], c.root);
  expect(r.code).toBe(2);
  expect(r.err).toContain('conflict');
  expect(r.err).toContain('shared.txt');
  expect(r.err).toContain(`git -C "${sib}" merge origin/main`);
  expect(gitRun(sib, 'rev-parse', 'HEAD').trim()).toBe(head);
  expect(gitRun(sib, 'status', '--porcelain', '--untracked-files=no')).toBe('');
  expect(readFileSync(sib + '/shared.txt', 'utf8').replaceAll('\r\n', '\n')).toBe('ST-9\n'); // autocrlf on Windows checks out CRLF
  expect(() => gitRun(sib, 'rev-parse', '-q', '--verify', 'MERGE_HEAD')).toThrow();
  expect(gitRun(c.remote, 'rev-parse', 't/ST-9').trim()).toBe(head);
}, 180_000);

it('risk:data-loss continue does not merge into a worktree with uncommitted changes and says it is behind', async () => {
  const d = copy();
  ticketWorktree(d, 'ST-9');
  const dSib = d.sibling('ST-9');
  const dHead = gitRun(dSib, 'rev-parse', 'HEAD').trim();
  writeFiles(dSib, { 'ST-9.txt': 'changed\n' });
  twoOnMain(d);
  const rd = await run(['worktree', 'open', 'ST-9', '--continue'], d.root);
  expect(rd.code).toBe(0);
  expect(lines(rd.out)[0]).toBe(BEHIND);
  expect(lines(rd.out).some((l) => l.startsWith('merged:'))).toBe(false);
  expect(gitRun(dSib, 'rev-parse', 'HEAD').trim()).toBe(dHead);
  expect(readFileSync(dSib + '/ST-9.txt', 'utf8')).toBe('changed\n');
}, 180_000);

it('risk:data-loss continue does not merge into a worktree a live session holds and says it is behind', async () => {
  const h = copy();
  ticketWorktree(h, 'ST-9');
  const hHead = sha(h, 't/ST-9');
  writeHolds(h, { 'ST-9': LIVE });
  setTable(tableOf(LIVE));
  twoOnMain(h);
  const rh = await run(['worktree', 'open', 'ST-9', '--continue'], h.root, {});
  expect(rh.code).toBe(0);
  expect(lines(rh.out)[0]).toBe(BEHIND);
  expect(lines(rh.out).some((l) => l.startsWith('merged:'))).toBe(false);
  expect(sha(h, 't/ST-9')).toBe(hHead);
  expect(gitRun(h.remote, 'rev-parse', 't/ST-9').trim()).toBe(hHead);
}, 180_000);

// the remote branch has a commit this clone's branch lacks: no merge into the stale tip, nothing pushed
it('risk:data-loss continue does not merge into a branch whose origin copy has a teammate commit and pushes nothing', async () => {
  const m = copy();
  ticketWorktree(m, 'ST-9');
  const mHead = sha(m, 't/ST-9');
  twoOnMain(m);
  const mo = m.otherClone();
  gitRun(mo, 'checkout', '-q', 't/ST-9');
  writeFiles(mo, { 'mate.txt': 'mate\n' });
  const mate = commitMsg(mo, 'mate');
  gitRun(mo, 'push', '-q', 'origin', 't/ST-9');
  const rm = await run(['worktree', 'open', 'ST-9', '--continue'], m.root);
  expect(rm.code).toBe(0);
  expect(lines(rm.out)[0]).toBe(BEHIND);
  expect(lines(rm.out).some((l) => l.startsWith('merged:') || l.startsWith('push of'))).toBe(false);
  expect(sha(m, 't/ST-9')).toBe(mHead);
  expect(gitRun(m.remote, 'rev-parse', 't/ST-9').trim()).toBe(mate);
}, 180_000);

const REVIEWED = '## Round 1\n\nNo findings\n\nverdict: converged\n';
/** A lane S ticket on `t/<id>`, ready and reviewed in its sibling and pushed; returns the review commit. */
async function laneSBranch(c: Clone, id: string, file?: string, edit?: () => void): Promise<string> {
  ticketWorktree(c, id, file);
  const sx = c.sibling(id);
  writeFiles(sx, { [`accord/tickets/${id}.md`]: laneTicket(id, { lane: 'S', body: LANE_S_BODY }) });
  edit?.();
  // The core form of `accord gate ready`: it writes ac_hash into the ticket; the CLI exit 0 is made by lane-s.test.ts ac-2.
  const files = { 'accord/config.yml': readFileSync(`${sx}/accord/config.yml`, 'utf8'), [P(id)]: readFileSync(`${sx}/${P(id)}`, 'utf8') };
  expect(gateReadyIn(files, id)).toBe('pass');
  writeFiles(sx, { [P(id)]: files[P(id)] });
  writeFiles(sx, { [`accord/tickets/${id}/review.md`]: REVIEWED });
  const t = commitMsg(sx, 'review: ' + id);
  gitRun(sx, 'push', '-q', 'origin', `t/${id}`);
  return t;
}

it('risk:data-loss clean removes only a done ticket and keeps a branch with a commit after its verified commit', async () => {
  const c = copy({ tickets: ['ST-9', 'ST-10', 'ST-11'] });
  for (const x of ['ST-9', 'ST-10', 'ST-11']) ticketWorktree(c, x);
  const t = doneOnRemote(c, ['ST-9', 'ST-11'], { squash: true, local: true });
  mergeOnRemote(c, 'ST-10');
  const sib9 = c.sibling('ST-9');
  writeFiles(sib9, { 'late.txt': 'late\n' });
  const late = commitMsg(sib9, 'late');
  const r1 = await run(['worktree', 'clean'], c.root);
  expect(r1.code).toBe(0);
  expect(lines(r1.out)).toEqual([
    `removed ${c.sibling('ST-11')}`,
    `deleted t/ST-11 (was ${t['ST-11']})`,
    `deleted origin/t/ST-11 (was ${t['ST-11']})`,
    'kept t/ST-9: it has commits after its verified commit',
  ]);
  expect(existsSync(c.sibling('ST-11'))).toBe(false);
  expect(has(c.root, 'refs/heads/t/ST-11')).toBe(false);
  expect(existsSync(sib9)).toBe(true);
  expect(existsSync(c.sibling('ST-10'))).toBe(true);
  expect(sha(c, 't/ST-9')).toBe(late);
  expect(has(c.root, 'refs/heads/t/ST-10')).toBe(true);
}, 240_000);

it('risk:data-loss clean keeps a done ticket branch that a stopped rebase in its worktree is rebuilding', async () => {
  const e = copy();
  ticketWorktree(e, 'ST-9');
  doneOnRemote(e, ['ST-9'], { squash: true });
  const esib = e.sibling('ST-9');
  try {
    gitRun(esib, 'rebase', '-q', '--force-rebase', '--exec', 'false', 'HEAD~1');
  } catch {
    // the exec line fails on purpose, leaving the rebase stopped
  }
  expect(gitRun(esib, 'branch', '--show-current').trim()).toBe('');
  const r2 = await run(['worktree', 'clean'], e.root);
  expect(r2.code).toBe(0);
  expect(lines(r2.out)).toEqual([`kept t/ST-9: being rebased in ${esib}`]);
  expect(existsSync(esib)).toBe(true);
  expect(has(e.root, 'refs/heads/t/ST-9')).toBe(true);
  expect(has(e.remote, 'refs/heads/t/ST-9')).toBe(true);
  gitRun(esib, 'rebase', '--abort');
}, 240_000);

it('risk:data-loss clean deletes a done lane S branch with no verified commit only when its merge into main changes nothing', async () => {
  const f = copy();
  writeFiles(f.root, { 'shared.txt': Array.from({ length: 10 }, (_, i) => `l${i + 1}\n`).join('') });
  commitMsg(f.root, 'shared');
  gitRun(f.root, 'push', '-q', 'origin', 'main');
  const shared = (first: string, last: string) => Array.from({ length: 10 }, (_, i) => (i === 0 ? first : i === 9 ? last : `l${i + 1}`) + '\n').join('');
  const t12 = await laneSBranch(f, 'ST-12', undefined, () => writeFiles(f.sibling('ST-12'), { 'shared.txt': shared('ST-12', 'l10') }));
  await laneSBranch(f, 'ST-13');
  const fo = f.otherClone();
  gitRun(fo, 'fetch', '-q', 'origin');
  for (const x of ['ST-12', 'ST-13']) {
    gitRun(fo, 'merge', '--squash', '-q', `origin/t/${x}`);
    commitMsg(fo, 'merge ' + x);
  }
  writeFiles(fo, { 'shared.txt': shared('ST-12', 'main') });
  commitMsg(fo, 'main edit');
  gitRun(fo, 'push', '-q', 'origin', 'main');
  const rows = JSON.parse((await run(['status', '--json'], fo)).out) as { id: string; stage: string }[];
  for (const x of ['ST-12', 'ST-13']) expect(rows.find((r) => r.id === x)?.stage).toBe('done');
  expect(readFileSync(`${fo}/accord/tickets/ST-12.md`, 'utf8')).not.toContain('verified_commit:');
  expect(readFileSync(`${fo}/accord/tickets/ST-13.md`, 'utf8')).not.toContain('verified_commit:');
  expect(gitRun(fo, 'diff', '--name-only', 'origin/t/ST-12', 'main', '--', 'shared.txt').trim()).toBe('shared.txt');
  writeFiles(f.sibling('ST-13'), { 'late.txt': 'late\n' });
  commitMsg(f.sibling('ST-13'), 'late');
  const r3 = await run(['worktree', 'clean'], f.root);
  expect(r3.code).toBe(0);
  expect(lines(r3.out)).toEqual([
    `removed ${f.sibling('ST-12')}`,
    `deleted t/ST-12 (was ${t12})`,
    `deleted origin/t/ST-12 (was ${t12})`,
    'kept t/ST-13: it has changes not on origin/main',
  ]);
  expect(has(f.remote, 'refs/heads/t/ST-13')).toBe(true);
  expect(r3.out).not.toContain('verified commit');
  expect(existsSync(f.sibling('ST-13'))).toBe(true);
  expect(has(f.root, 'refs/heads/t/ST-13')).toBe(true);
  expect(has(f.root, 'refs/heads/t/ST-12')).toBe(false);
}, 240_000);

/** The remote main squash-merges the pushed lane S branch `t/ST-14`, then edits the same file, so merging the branch into main conflicts; returns the clone that did it. */
function conflictOnMain(g: Clone) {
  const go = g.otherClone();
  gitRun(go, 'fetch', '-q', 'origin');
  gitRun(go, 'merge', '--squash', '-q', 'origin/t/ST-14');
  commitMsg(go, 'merge ST-14');
  writeFiles(go, { 'added.txt': 'main\n' });
  commitMsg(go, 'main edit');
  gitRun(go, 'push', '-q', 'origin', 'main');
  return go;
}

it('risk:data-loss clean keeps a done lane S branch whose merge into main conflicts', async () => {
  const g = copy();
  const t14 = await laneSBranch(g, 'ST-14', 'added.txt');
  const sg = g.sibling('ST-14');
  const go = conflictOnMain(g);
  const grows = JSON.parse((await run(['status', '--json'], go)).out) as { id: string; stage: string }[];
  expect(grows.find((r) => r.id === 'ST-14')?.stage).toBe('done');
  let status: unknown;
  try {
    execFileSync('git', ['merge-tree', '--write-tree', 'main', 'origin/t/ST-14'], { cwd: go, stdio: 'pipe' });
  } catch (err) {
    status = (err as { status?: number }).status;
  }
  expect(status).toBe(1);
  const r4 = await run(['worktree', 'clean'], g.root);
  expect(r4.code).toBe(0);
  expect(lines(r4.out)).toEqual(['kept t/ST-14: merging it into origin/main conflicts']);
  expect(existsSync(sg)).toBe(true);
  expect(sha(g, 't/ST-14')).toBe(t14);
  expect(has(g.remote, 'refs/heads/t/ST-14')).toBe(true);
}, 240_000);

it('risk:data-loss clean keeps a done lane S origin branch whose merge into main conflicts', async () => {
  const g = copy();
  const t14 = await laneSBranch(g, 'ST-14', 'added.txt');
  const sg = g.sibling('ST-14');
  conflictOnMain(g);
  gitRun(g.root, 'worktree', 'remove', '--force', sg);
  g.git('update-ref', '-d', 'refs/heads/t/ST-14');
  const r5 = await run(['worktree', 'clean'], g.root);
  expect(r5.code).toBe(0);
  expect(lines(r5.out)).toEqual(['kept origin/t/ST-14: merging it into origin/main conflicts']);
  expect(gitRun(g.remote, 'rev-parse', 't/ST-14').trim()).toBe(t14);
}, 240_000);

it('risk:data-loss clean keeps a done ticket branch whose commit after verify conflicts with main', async () => {
  const h = copy();
  ticketWorktree(h, 'ST-15');
  doneOnRemote(h, ['ST-15'], { squash: true, local: true });
  const sh = h.sibling('ST-15');
  writeFiles(sh, { 'accord/tickets/ST-15/ledger.md': 'Correction: not on main\n' });
  const owner = commitMsg(sh, 'owner correction');
  const r6 = await run(['worktree', 'clean'], h.root);
  expect(r6.code).toBe(0);
  expect(lines(r6.out)).toEqual(['kept t/ST-15: merging it into origin/main conflicts']);
  expect(existsSync(sh)).toBe(true);
  expect(sha(h, 't/ST-15')).toBe(owner);
  expect(has(h.remote, 'refs/heads/t/ST-15')).toBe(true);
}, 240_000);

it('risk:data-loss clean keeps an origin branch whose lease is stale and names the failed push', async () => {
  const c = copy();
  ticketWorktree(c, 'ST-9');
  doneOnRemote(c, ['ST-9'], { squash: true, local: true });
  const tip = sha(c, 't/ST-9');
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
  expect(l[1]).toBe(`deleted t/ST-9 (was ${tip})`);
  expect(l[2].startsWith('kept origin/t/ST-9: git push failed: ')).toBe(true);
  expect(gitRun(c.remote, 'rev-parse', 't/ST-9').trim()).toBe(S2);
}, 240_000);

it('risk:data-loss clean after a failed fetch deletes the local branch and never the origin branch', async () => {
  const d = copy();
  ticketWorktree(d, 'ST-9');
  const tD = doneOnRemote(d, ['ST-9'], { squash: true, local: true });
  const tipD = sha(d, 't/ST-9');
  d.git('fetch', '-q', 'origin');
  d.git('remote', 'set-url', 'origin', d.remote + '-missing');
  const rd = lines((await run(['worktree', 'clean'], d.root)).out);
  expect(rd).toHaveLength(3);
  expect(rd[0].startsWith('fetch from origin failed')).toBe(true);
  expect(rd[1]).toBe(`removed ${d.sibling('ST-9')}`);
  expect(rd[2]).toBe(`deleted t/ST-9 (was ${tipD})`);
  expect(gitRun(d.remote, 'rev-parse', 't/ST-9').trim()).toBe(tD['ST-9']);
}, 240_000);

it('risk:data-loss clean deletes no origin branch that the prune already removed', async () => {
  const e = copy();
  ticketWorktree(e, 'ST-9');
  doneOnRemote(e, ['ST-9'], { squash: true, local: true });
  const tipE = sha(e, 't/ST-9');
  gitRun(e.remote, 'branch', '-D', 't/ST-9');
  const re = lines((await run(['worktree', 'clean'], e.root)).out);
  expect(re).toContain(`pruned refs/remotes/origin/t/ST-9 (was ${tipE})`);
  expect(re).toContain(`removed ${e.sibling('ST-9')}`);
  expect(re).toContain(`deleted t/ST-9 (was ${tipE})`);
  expect(re.some((x) => x.startsWith('kept origin/') || x.startsWith('deleted origin/'))).toBe(false);
}, 240_000);

it('ac-5 clean pick up continue and a new worktree ticket remove the worktree and both branches of a done ticket', async () => {
  const rows: { name: string; argv: string[]; prep?: (c: Clone) => void }[] = [
    { name: 'clean', argv: ['worktree', 'clean'] },
    { name: 'open', argv: ['worktree', 'open', 'ST-10'] },
    { name: 'continue', argv: ['worktree', 'open', 'ST-10', '--continue'], prep: (c) => ticketWorktree(c, 'ST-10') },
    { name: 'new ticket', argv: ['new', 'ticket', 'ST-11', '--lane', 'M', '--worktree'] },
  ];
  // The done-ST-9 state is built once, with no linked worktree; each outline row copies it and adds its worktrees in the copy.
  const built = copy({ tickets: ['ST-9', 'ST-10'] });
  ticketWorktree(built, 'ST-9');
  const t = doneOnRemote(built, ['ST-9'], { squash: true, local: true });
  built.git('worktree', 'remove', built.sibling('ST-9'));
  for (const row of rows) {
    const c = copyClone(built);
    clones.push(c);
    const sib9 = c.sibling('ST-9');
    c.git('worktree', 'add', '-q', sib9, 't/ST-9');
    row.prep?.(c);
    const tip = sha(c, 't/ST-9');
    expect(tip, row.name).toBe(t['ST-9']);
    expect(() => c.git('cat-file', '-e', 'origin/main:accord/tickets/ST-9/review.md'), row.name).toThrow();
    const r = await run(row.argv, c.root);
    expect(r.code, row.name + r.out).toBe(0);
    const l = lines(r.out);
    expect(l, row.name).toContain(`removed ${sib9}`);
    expect(l, row.name).toContain(`deleted t/ST-9 (was ${tip})`);
    expect(l, row.name).toContain(`deleted origin/t/ST-9 (was ${tip})`);
    expect(existsSync(sib9), row.name).toBe(false);
    expect(has(c.root, 'refs/heads/t/ST-9'), row.name).toBe(false);
    expect(has(c.remote, 'refs/heads/t/ST-9'), row.name).toBe(false);
  }
}, 240_000);

it('risk:complex-branching pick up and continue never clean the ticket they open', async () => {
  const c = clone();
  ticketWorktree(c, 'ST-9');
  doneOnRemote(c, ['ST-9'], { local: true });
  const st = await run(['status', '--json'], c.sibling('ST-9'));
  expect(JSON.stringify(JSON.parse(st.out))).toMatch(/"id":"ST-9"[^}]*"stage":"done"/);
  const r = await run(['worktree', 'open', 'ST-9', '--continue'], c.root);
  expect(r.code).toBe(0);
  expect(existsSync(c.sibling('ST-9'))).toBe(true);
  expect(has(c.root, 'refs/heads/t/ST-9')).toBe(true);
  expect(has(c.remote, 'refs/heads/t/ST-9')).toBe(true);
  expect(r.out).not.toMatch(/^(removed|deleted) /m);
  expect(r.out).not.toContain('merged:');
  expect(lines(r.out)[0].startsWith('behind:')).toBe(true);
}, 240_000);

// BUG-LN-14: a /clear frees the holds its window took.
const T = '2026-10-27T03:03:00.000Z';
const A2 = { ...A, marker: 'sess-A2' };
const clearOf = (cwd: string, s: { marker: string; pid: number }) =>
  run(['hook', 'session-resume'], cwd, envOf(s), JSON.stringify({ session_id: s.marker, cwd, source: 'clear' }));

it('ac-1 a clear in a window outside the ticket worktree removes the hold its old conversation took and another session continues the ticket', async () => {
  const c = copy({ tickets: ['ST-9', 'ST-10'] });
  const sib = c.sibling('ST-9');
  c.git('worktree', 'add', '-q', '-b', 't/ST-9', sib, 'origin/main');
  c.git('remote', 'remove', 'origin');
  writeHolds(c, { 'ST-9': { tool: 'Claude Code', ...A, taken: T }, 'ST-10': DEAD });
  setTable(tableOf(A));
  const k = await clearOf(c.root, A2);
  expect(k.code).toBe(0);
  expect(k.out.startsWith('# accord rules\n')).toBe(true);
  expect(Object.hasOwn(readHolds(c), 'ST-9')).toBe(false);
  expect(readHolds(c)['ST-10']).toEqual(DEAD);
  setTable(tableOf(B, A));
  const r = await run(['worktree', 'open', 'ST-9', '--continue'], c.root, envOf(B));
  expect(r.code).toBe(0);
  expect(r.err).not.toContain('held by another session');
  expect(lines(r.out)).toEqual([`enter: ${sib}`]);
  expect((readHolds(c)['ST-9'] as { marker: string }).marker).toBe('sess-B');
}, 120_000);

it('risk:data-loss a clear whose window the process table does not show releases nothing and says so on stdout', async () => {
  const c = copy();
  writeHolds(c, { 'ST-9': { tool: 'Claude Code', ...A, taken: T } });
  const bytes = readFileSync(holdsFile(c), 'utf8');
  setTable([{ pid: process.pid, ppid: 1, start: 'self' }]);
  const a = await clearOf(c.root, A2);
  expect(a.code).toBe(0);
  expect(a.err).toBe('');
  expect(a.out.startsWith('# accord rules\n')).toBe(true);
  expect(lines(a.out).some((l) => l.startsWith('accord: no hold released: cannot see this Claude Code session'))).toBe(true);
  expect(readFileSync(holdsFile(c), 'utf8')).toBe(bytes);
  const stdin = JSON.stringify({ session_id: 'sess-A2', cwd: c.root, source: 'clear' });
  const b = await run(['hook', 'session-resume'], c.root, { CLAUDECODE: '1' }, stdin);
  expect(b.code).toBe(0);
  expect(lines(b.out).some((l) => l.startsWith('accord: no hold released: this Claude Code session sets no'))).toBe(true);
  expect(readFileSync(holdsFile(c), 'utf8')).toBe(bytes);
  const o = await run(['hook', 'session-resume'], c.root, {}, stdin);
  expect(o.code).toBe(0);
  expect(o.out).not.toContain('no hold released');
  expect(readFileSync(holdsFile(c), 'utf8')).toBe(bytes);
}, 60_000);

it('ac-2 after a clear the window claims one other ticket and holds only that one', async () => {
  const c = copy({ tickets: ['ST-9', 'ST-10'] });
  const sib = c.sibling('ST-9');
  c.git('worktree', 'add', '-q', '-b', 't/ST-9', sib, 'origin/main');
  writeHolds(c, { 'ST-9': { tool: 'Claude Code', ...A, taken: T } });
  writeFileSync(`${c.root}/.git/accord/worked`, 'ST-9\tsess-A\n');
  setTable(tableOf(A));
  const k = await clearOf(c.root, A2);
  expect(k.code).toBe(0);
  const r = await run(['worktree', 'open', 'ST-10'], c.root, envOf(A2));
  expect(r.code).toBe(0);
  expect(r.err).not.toContain('this session works');
  expect(r.err).not.toContain('held by another session');
  expect(lines(r.out).at(-1)).toBe(`enter: ${c.sibling('ST-10')}`);
  expect(Object.keys(readHolds(c))).toEqual(['ST-10']);
  expect((readHolds(c)['ST-10'] as { marker: string }).marker).toBe('sess-A2');
}, 120_000);

it('ac-3 a start or a clear in a second window in the ticket worktree leaves the first window hold in place', async () => {
  const c = copy({ tickets: ['ST-9', 'ST-10'] });
  const sib = c.sibling('ST-9');
  c.git('worktree', 'add', '-q', '-b', 't/ST-9', sib, 'origin/main');
  c.git('remote', 'remove', 'origin');
  mkdirSync(`${sib}/sub`);
  writeHolds(c, { 'ST-9': { tool: 'Claude Code', ...A, taken: T } });
  const bytes = readFileSync(holdsFile(c), 'utf8');
  setTable(tableOf(B, A));
  const s = await run(['hook', 'session-start'], sib, envOf(B), JSON.stringify({ session_id: 'sess-B', cwd: sib, source: 'startup' }));
  expect(s.code).toBe(0);
  expect(readFileSync(holdsFile(c), 'utf8')).toBe(bytes);
  const B2 = { ...B, marker: 'sess-B2' };
  const k = await run(['hook', 'session-resume'], sib, envOf(B2), JSON.stringify({ session_id: 'sess-B2', cwd: `${sib}/sub`, source: 'clear' }));
  expect(k.code).toBe(0);
  expect(readFileSync(holdsFile(c), 'utf8')).toBe(bytes);
  const r = await run(['worktree', 'open', 'ST-9', '--continue'], sib, envOf(B2));
  expect(r.code).toBe(2);
  expect(r.err).toContain('ST-9 is held by another session');
  expect(r.err).toContain('sess-A');
  expect((readHolds(c)['ST-9'] as { marker: string }).marker).toBe('sess-A');
}, 120_000);

it('ac-5 a clear in the held ticket worktree moves its hold to the new conversation and releases the window other holds', async () => {
  const c = copy({ tickets: ['ST-9', 'ST-10'] });
  const sib = c.sibling('ST-9');
  c.git('worktree', 'add', '-q', '-b', 't/ST-9', sib, 'origin/main');
  c.git('remote', 'remove', 'origin');
  mkdirSync(`${sib}/sub`);
  writeHolds(c, { 'ST-9': { tool: 'Claude Code', ...A, taken: T }, 'ST-10': { tool: 'Claude Code', ...A, taken: T } });
  setTable(tableOf(A));
  const k = await run(['hook', 'session-resume'], sib, envOf(A2), JSON.stringify({ session_id: 'sess-A2', cwd: `${sib}/sub`, source: 'clear' }));
  expect(k.code).toBe(0);
  expect(Object.keys(readHolds(c))).toEqual(['ST-9']);
  expect(readHolds(c)['ST-9']).toMatchObject({ marker: 'sess-A2', pid: 7001, start: 'S-A', taken: T });
  const same = await run(['worktree', 'open', 'ST-9', '--continue'], sib, envOf(A2));
  expect(same.code).toBe(0);
  expect(same.out).toBe(HELD);
  setTable(tableOf(B, A));
  const other = await run(['worktree', 'open', 'ST-9', '--continue'], c.root, envOf(B));
  expect(other.code).toBe(2);
  expect(other.err).toContain('ST-9 is held by another session');
  expect(other.err).toContain('sess-A2');
}, 120_000);

it('risk:complex-branching a resume to another conversation keeps only the hold that conversation took and a compact releases nothing', async () => {
  const c = copy();
  const A3 = { ...A, marker: 'sess-A3' };
  const both = { 'ST-9': { tool: 'Claude Code', ...A, taken: T }, 'ST-10': { tool: 'Claude Code', ...A3, taken: T } };
  setTable(tableOf(A));
  const resumeTo = (s: { marker: string; pid: number }, source: string) =>
    run(['hook', 'session-resume'], c.root, envOf(s), JSON.stringify({ session_id: s.marker, cwd: c.root, source }));
  writeHolds(c, both);
  const a = await resumeTo(A3, 'resume');
  expect(a.code).toBe(0);
  expect(Object.keys(readHolds(c))).toEqual(['ST-10']);
  expect((readHolds(c)['ST-10'] as { marker: string }).marker).toBe('sess-A3');
  writeHolds(c, both);
  const bytes = readFileSync(holdsFile(c), 'utf8');
  const b = await resumeTo(A, 'compact');
  expect(b.code).toBe(0);
  expect(readFileSync(holdsFile(c), 'utf8')).toBe(bytes);
}, 60_000);

it('ac-4 a refusal names the folder and the local time with its offset of the hold', async () => {
  vi.stubEnv('TZ', 'Asia/Ho_Chi_Minh');
  expect(new Date(T).getTimezoneOffset()).toBe(-420);
  const c = copy();
  const sib = c.sibling('ST-9');
  c.git('worktree', 'add', '-q', '-b', 't/ST-9', sib, 'origin/main');
  c.git('remote', 'remove', 'origin');
  setTable(tableOf(A));
  const first = await run(['worktree', 'open', 'ST-9', '--continue'], c.root, envOf(A));
  expect(first.code).toBe(0);
  expect(lines(first.out)).toEqual([`enter: ${sib}`]);
  expect((readHolds(c)['ST-9'] as { folder: string }).folder).toBe(sib);
  writeHolds(c, { 'ST-9': { ...(readHolds(c)['ST-9'] as object), taken: T } });
  setTable(tableOf(B, A));
  const r = await run(['worktree', 'open', 'ST-9', '--continue'], c.root, envOf(B));
  expect(r.code).toBe(2);
  expect(r.err).toContain(`ST-9 is held by another session: Claude Code session sess-A (pid 7001) in ${sib}, since 2026-10-27 10:03 (UTC+07:00) - work it there, or close that session first`);
  expect(r.err).not.toContain('\\');
  vi.stubEnv('TZ', 'America/Bogota');
  const west = await run(['worktree', 'open', 'ST-9', '--continue'], c.root, envOf(B));
  expect(west.code).toBe(2);
  expect(west.err).toContain('since 2026-10-26 22:03 (UTC-05:00)');
}, 120_000);

it('risk:parsing a hold written without a folder is refused as folder not recorded with its local time', async () => {
  vi.stubEnv('TZ', 'Asia/Ho_Chi_Minh');
  const c = copy();
  const sib = c.sibling('ST-9');
  c.git('worktree', 'add', '-q', '-b', 't/ST-9', sib, 'origin/main');
  c.git('remote', 'remove', 'origin');
  writeHolds(c, { 'ST-9': LIVE });
  setTable(tableOf(B, { pid: 4242, start: 'S2' }));
  const r = await run(['worktree', 'open', 'ST-9', '--continue'], sib, envOf(B));
  expect(r.code).toBe(2);
  expect(r.err).toContain('Claude Code session sess-H (pid 4242), folder not recorded, since 2026-10-18 07:00 (UTC+07:00) - work it there');
}, 120_000);
