// ST-LN-7: `accord worktree open` against real git in tmp sandboxes with a bare remote.
import { existsSync, readFileSync } from 'node:fs';
import { afterEach, expect, it } from 'vitest';
import { laneTicket } from '../../../test/helpers/lane.js';
import { run, writeFiles } from './helpers/repo.js';
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
