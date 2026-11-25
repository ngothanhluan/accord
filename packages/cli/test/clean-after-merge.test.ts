// Phase 15 plan 07 (D-20, T-15-16): `accord worktree clean --after-merge <id>`, the finishing session's last step once its pull request merged, against real git
// in tmp sandboxes with a bare remote: it removes the ticket's worktree and branches from outside that worktree, and refuses from inside it.
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { expect, it, vi } from 'vitest';
import { run } from './helpers/repo.js';
import { A, B, copy, doneOnRemote, envOf, has, lines, readHolds, setTable, tableOf, ticketWorktree, useSandboxes, withAction, writeHolds } from './helpers/worktree.js';

vi.mock('../src/load/proc.js', async (orig) => {
  const real = await orig<typeof import('../src/load/proc.js')>();
  return { ...real, processTable: vi.fn(real.processTable) };
});
vi.mock('../src/commands/fetch-limit.js', async (orig) => {
  const real = await orig<typeof import('../src/commands/fetch-limit.js')>();
  return { ...real, fetchLimitMs: vi.fn(real.fetchLimitMs) };
});

useSandboxes([{}, { tickets: ['ST-9', 'ST-10'] }]);

const TAKEN = '2026-10-18T00:00:00.000Z';
const holdOf = (s: typeof A) => ({ tool: 'Claude Code', ...s, taken: TAKEN });

it('risk:data-loss D-20 after the merge a session outside the worktree removes it, both branches and its own hold in one command', async () => {
  const c = copy();
  ticketWorktree(c, 'ST-9');
  const tips = doneOnRemote(c, ['ST-9']);
  writeHolds(c, { 'ST-9': holdOf(A) });
  setTable(tableOf(A));
  const r = await run(['worktree', 'clean', '--after-merge', 'ST-9'], c.root, envOf(A));
  expect(r.code).toBe(0);
  const out = lines(r.out);
  expect(out).toContain('released the hold of ST-9: this session left its worktree');
  expect(out).toContain(withAction(`removed ${c.sibling('ST-9')}`));
  expect(out.some((l) => l.startsWith('deleted t/ST-9 (was '))).toBe(true);
  expect(out.some((l) => l === withAction(`deleted origin/t/ST-9 (was ${tips['ST-9']})`))).toBe(true);
  expect(existsSync(c.sibling('ST-9'))).toBe(false);
  expect(has(c.root, 'refs/heads/t/ST-9')).toBe(false);
  expect(has(c.remote, 'refs/heads/t/ST-9')).toBe(false);
  expect(readHolds(c)).toEqual({});
}, 120_000);

it('risk:data-loss T-15-16 run from inside the ticket worktree it refuses with exit 2 and removes and drops nothing', async () => {
  const c = copy();
  ticketWorktree(c, 'ST-9');
  doneOnRemote(c, ['ST-9']);
  writeHolds(c, { 'ST-9': holdOf(A) });
  setTable(tableOf(A));
  const before = c.git('worktree', 'list', '--porcelain');
  const sib = c.sibling('ST-9');
  mkdirSync(`${sib}/inner`);
  for (const cwd of [sib, `${sib}/inner`]) {
    const r = await run(['worktree', 'clean', '--after-merge', 'ST-9'], cwd, envOf(A));
    expect(r.code).toBe(2);
    expect(r.err).toContain(sib);
    expect(r.err).toContain('leave it first');
    expect(r.err).toContain('next: ');
    expect(r.out).toBe('');
  }
  expect(existsSync(sib)).toBe(true);
  expect(c.git('worktree', 'list', '--porcelain')).toBe(before);
  expect(has(c.root, 'refs/heads/t/ST-9')).toBe(true);
  expect(has(c.remote, 'refs/heads/t/ST-9')).toBe(true);
  expect(Object.keys(readHolds(c))).toEqual(['ST-9']);
}, 120_000);

it('risk:data-loss a ticket held by another live session is kept and that hold stays', async () => {
  const c = copy();
  ticketWorktree(c, 'ST-9');
  doneOnRemote(c, ['ST-9']);
  writeHolds(c, { 'ST-9': holdOf(B) });
  setTable(tableOf(A, B));
  const r = await run(['worktree', 'clean', '--after-merge', 'ST-9'], c.root, envOf(A));
  expect(r.code).toBe(0);
  expect(lines(r.out)).toContain(withAction(`kept ${c.sibling('ST-9')}: held by another session`));
  expect(r.out).not.toContain('released the hold');
  expect(existsSync(c.sibling('ST-9'))).toBe(true);
  expect(has(c.root, 'refs/heads/t/ST-9')).toBe(true);
  expect(readHolds(c)).toEqual({ 'ST-9': holdOf(B) });
}, 120_000);

it('risk:data-loss uncommitted work keeps the worktree, and only the hold of the named ticket is dropped', async () => {
  const c = copy({ tickets: ['ST-9', 'ST-10'] });
  ticketWorktree(c, 'ST-9');
  doneOnRemote(c, ['ST-9']);
  const sib = c.sibling('ST-9');
  writeFileSync(`${sib}/new.txt`, 'new');
  writeHolds(c, { 'ST-9': holdOf(A), 'ST-10': holdOf(A) });
  setTable(tableOf(A));
  const r = await run(['worktree', 'clean', '--after-merge', 'ST-9'], c.root, envOf(A));
  expect(r.code).toBe(0);
  expect(lines(r.out)).toContain(withAction(`kept ${sib}: uncommitted work`));
  expect(existsSync(`${sib}/new.txt`)).toBe(true);
  expect(Object.keys(readHolds(c))).toEqual(['ST-10']);
}, 120_000);

it('risk:regression an id that is no ticket id exits 2 before anything runs', async () => {
  const c = copy();
  ticketWorktree(c, 'ST-9');
  doneOnRemote(c, ['ST-9']);
  writeHolds(c, { 'ST-9': holdOf(A) });
  setTable(tableOf(A));
  for (const bad of ['a b', '../x', '']) {
    const r = await run(['worktree', 'clean', '--after-merge', bad], c.root, envOf(A));
    expect(r.code, bad).toBe(2);
    expect(r.out, bad).toBe('');
  }
  expect(existsSync(c.sibling('ST-9'))).toBe(true);
  expect(Object.keys(readHolds(c))).toEqual(['ST-9']);
}, 120_000);

it('risk:data-loss --dry-run with --after-merge prints the release and the removal and changes nothing', async () => {
  const c = copy();
  ticketWorktree(c, 'ST-9');
  doneOnRemote(c, ['ST-9']);
  writeHolds(c, { 'ST-9': holdOf(A) });
  setTable(tableOf(A));
  const r = await run(['worktree', 'clean', '--after-merge', 'ST-9', '--dry-run'], c.root, envOf(A));
  expect(r.code).toBe(0);
  const out = lines(r.out);
  expect(out).toContain('would release the hold of ST-9: this session left its worktree');
  expect(out).toContain(withAction(`removed ${c.sibling('ST-9')}`));
  expect(existsSync(c.sibling('ST-9'))).toBe(true);
  expect(has(c.root, 'refs/heads/t/ST-9')).toBe(true);
  expect(has(c.remote, 'refs/heads/t/ST-9')).toBe(true);
  expect(Object.keys(readHolds(c))).toEqual(['ST-9']);
}, 120_000);
