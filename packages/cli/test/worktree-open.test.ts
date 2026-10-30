// ST-LN-7, ST-LN-30: `accord worktree open` (pick up, continue, the claim, setup) and `accord new ticket --worktree`, against real git in tmp sandboxes with a bare remote.
import { existsSync, readFileSync, rmSync } from 'node:fs';
import { expect, it, vi } from 'vitest';
import { laneTicket } from '../../../test/helpers/lane.js';
import { gitRun, run, writeFiles } from './helpers/repo.js';
import { A, clone, clones, type Clone, copy, copyClone, doneOnRemote, dropOnRemote, entries, envOf, has, lines, ME, pushedWork, pushNext, setTable, sha, stopLines, tableOf, teammate, ticketWorktree, useSandboxes } from './helpers/worktree.js';

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
  { setup: ['node setup-step.js ci'] },
  { setup: ['node setup-step.js ci'], tickets: [] },
  { tickets: [] },
  { setup: ['node setup-step.js ci', 'node setup-step.js build'] },
  { setup: ['node setup-step.js ci', 'node setup-step.js fail'] },
  { tickets: ['ST-9', 'ST-10'] },
  { tickets: ['ST-9', 'ST-10', 'ST-11', 'ST-12', 'ST-13'] },
]);

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
