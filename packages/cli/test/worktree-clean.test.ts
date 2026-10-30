// ST-LN-55: `accord worktree clean` removes a finished ticket's worktree completely, and the session-start hook runs it.
import { existsSync, renameSync } from 'node:fs';
import { afterAll, afterEach, beforeAll, expect, it, vi } from 'vitest';
import * as proc from '../src/load/proc.js';
import { ALIVE, claimWorktree, doneOnRemote, DEAD, gone, has, LIVE, lines, readHolds, runWhole, writeHolds } from './helpers/done.js';
import { commitMsg, gitRun, run, writeFiles } from './helpers/repo.js';
import { copyClone, makeClone, makeTemplate, type Clone } from './helpers/worktree.js';

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
// One template per set of options, built once; a test takes a copy of it with `copy`. A template never holds a linked worktree.
const TEMPLATE_OPTS: Parameters<typeof makeClone>[0][] = [{ tickets: ['ST-9', 'ST-10'] }];
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
