// ST-LN-7: `accord worktree open` against real git in tmp sandboxes with a bare remote.
import { existsSync, readFileSync, rmSync } from 'node:fs';
import { afterEach, expect, it } from 'vitest';
import { laneTicket } from '../../../test/helpers/lane.js';
import { gitRun, run, writeFiles } from './helpers/repo.js';
import { makeClone, type Clone } from './helpers/worktree.js';

const clones: Clone[] = [];
const clone = (opts?: Parameters<typeof makeClone>[0]) => {
  const c = makeClone(opts);
  clones.push(c);
  return c;
};
afterEach(() => {
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
