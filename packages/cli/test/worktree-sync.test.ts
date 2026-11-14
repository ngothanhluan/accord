// ST-LN-96 t1-ac-3: `git.merge` decides how `accord worktree sync` takes the remote main into a ticket branch, against real git in tmp sandboxes with a bare remote.
import { existsSync, readFileSync } from 'node:fs';
import { expect, it, vi } from 'vitest';
import { gitRun, run, writeFiles } from './helpers/repo.js';
import { copy, type Clone, lines, pushMain, ticketWorktree, useSandboxes, verifyStage } from './helpers/worktree.js';

vi.mock('../src/load/proc.js', async (orig) => {
  const real = await orig<typeof import('../src/load/proc.js')>();
  return { ...real, processTable: vi.fn(real.processTable) };
});
vi.mock('../src/commands/fetch-limit.js', async (orig) => {
  const real = await orig<typeof import('../src/commands/fetch-limit.js')>();
  return { ...real, fetchLimitMs: vi.fn(real.fetchLimitMs) };
});

useSandboxes([{}]);

type Strategy = 'merge' | 'rebase' | 'squash' | undefined;

/** A ticket ST-9 at verify in its sibling worktree, three commits on top of the shared start, config carrying `git.merge` when a strategy is given; the branch is pushed. */
function atVerify(c: Clone, strategy: Strategy, file?: string): string {
  ticketWorktree(c, 'ST-9', file);
  const sib = c.sibling('ST-9');
  if (strategy !== undefined) {
    const path = sib + '/accord/config.yml';
    writeFiles(sib, { 'accord/config.yml': readFileSync(path, 'utf8').replace(/\r\n/g, '\n') + `git:\n  merge: ${strategy}\n` });
    gitRun(sib, 'add', '-A');
    gitRun(sib, 'commit', '-q', '-m', 'config: git.merge ' + strategy);
  }
  verifyStage(sib, 'ST-9');
  gitRun(sib, 'push', '-q', 'origin', 't/ST-9');
  return sib;
}

const parents = (dir: string) => gitRun(dir, 'rev-list', '--parents', '-n', '1', 'HEAD').trim().split(' ').length - 1;
const rebasedLines = (out: string) => lines(out).filter((l) => l.startsWith('rebased:'));

it('risk:complex-branching git.merge decides how worktree sync takes main (ST-LN-96 t1-ac-3)', async () => {
  for (const strategy of [undefined, 'squash', 'rebase'] as const) {
    const c = copy();
    const sib = atVerify(c, strategy);
    const own = gitRun(sib, 'rev-list', '--count', 'origin/main..HEAD').trim();
    const tip = pushMain(c, 'next.txt', 'next\n');
    const r = await run(['worktree', 'sync', 'ST-9'], sib);
    expect(r.err, String(strategy)).toBe('');
    expect(r.code, String(strategy)).toBe(0);
    expect(existsSync(sib + '/next.txt'), String(strategy)).toBe(true);
    expect(gitRun(sib, 'status', '--porcelain'), String(strategy)).toBe('');
    if (strategy !== 'rebase') {
      expect(parents(sib), String(strategy)).toBe(2);
      expect(gitRun(sib, 'rev-parse', 'HEAD^2').trim(), String(strategy)).toBe(tip);
      expect(rebasedLines(r.out), String(strategy)).toEqual([]);
    } else {
      expect(gitRun(sib, 'rev-list', '--merges', 'origin/main..HEAD').trim()).toBe('');
      expect(gitRun(sib, 'merge-base', '--is-ancestor', tip, 'HEAD').trim()).toBe('');
      const pairs = rebasedLines(r.out);
      expect(pairs).toHaveLength(Number(own));
      for (const l of pairs) expect(l).toMatch(/^rebased: [0-9a-f]{12} -> [0-9a-f]{12}$/);
      expect(gitRun(sib, 'rev-parse', 'refs/remotes/origin/t/ST-9').trim()).toBe(gitRun(sib, 'rev-parse', 'HEAD').trim());
      expect(gitRun(c.remote, 'rev-parse', 'refs/heads/t/ST-9').trim()).toBe(gitRun(sib, 'rev-parse', 'HEAD').trim());
    }
    const head = gitRun(sib, 'rev-parse', 'HEAD').trim();
    const again = await run(['worktree', 'sync', 'ST-9'], sib);
    expect(again.code, String(strategy)).toBe(0);
    expect(again.out, String(strategy)).toBe('');
    expect(again.err, String(strategy)).toBe('');
    expect(gitRun(sib, 'rev-parse', 'HEAD').trim(), String(strategy)).toBe(head);
  }
}, 240_000);

it('risk:data-loss a rebase conflict is aborted and named (ST-LN-96 t1-ac-3)', async () => {
  const c = copy();
  writeFiles(c.root, { 'shared.txt': 'base\n' });
  c.git('add', '-A');
  c.git('commit', '-q', '-m', 'shared');
  c.git('push', '-q', 'origin', 'main');
  const sib = atVerify(c, 'rebase', 'shared.txt');
  pushMain(c, 'shared.txt', 'main\n');
  const head = gitRun(sib, 'rev-parse', 'HEAD').trim();
  for (let i = 0; i < 2; i++) {
    const r = await run(['worktree', 'sync', 'ST-9'], sib);
    expect(r.code).toBe(2);
    expect(r.err).toContain('shared.txt');
    expect(r.err).toContain('rebase');
    expect(r.err).toContain('aborted');
    expect(gitRun(sib, 'rev-parse', 'HEAD').trim()).toBe(head);
    expect(gitRun(sib, 'branch', '--show-current').trim()).toBe('t/ST-9');
    expect(gitRun(sib, 'status', '--porcelain')).toBe('');
    expect(readFileSync(sib + '/shared.txt', 'utf8').replace(/\r/g, '')).toBe('ST-9\n');
    const dir = (n: string) => gitRun(sib, 'rev-parse', '--git-path', n).trim();
    expect(existsSync(dir('rebase-merge')) || existsSync(dir('rebase-apply'))).toBe(false);
  }
}, 120_000);

it("risk:data-loss a lease push never overwrites a teammate's commit (ST-LN-96 t1-ac-3)", async () => {
  const c = copy();
  const sib = atVerify(c, 'rebase');
  pushMain(c, 'next.txt', 'next\n');
  // a teammate pushes a commit to the ticket branch that this clone has not fetched
  const o = c.otherClone();
  gitRun(o, 'fetch', '-q', 'origin');
  gitRun(o, 'switch', '-q', '-c', 't/ST-9', 'origin/t/ST-9');
  writeFiles(o, { 'theirs.txt': 'theirs\n' });
  gitRun(o, 'add', '-A');
  gitRun(o, 'commit', '-q', '-m', 'theirs');
  gitRun(o, 'push', '-q', 'origin', 't/ST-9');
  const theirs = gitRun(o, 'rev-parse', 'HEAD').trim();
  const r = await run(['worktree', 'sync', 'ST-9'], sib);
  expect(r.code).toBe(0);
  const out = lines(r.out);
  const failed = out.find((l) => l.startsWith('push of t/ST-9 failed'));
  expect(failed).toBeDefined();
  expect(failed).toContain('accord worktree push ST-9 --force-with-lease');
  expect(gitRun(c.remote, 'rev-parse', 'refs/heads/t/ST-9').trim()).toBe(theirs);
  // the local branch was rebased all the same
  expect(gitRun(sib, 'rev-list', '--merges', 'origin/main..HEAD').trim()).toBe('');
}, 120_000);

it('risk:regression worktree merge is an alias of worktree sync (ST-LN-96 t1-ac-3)', async () => {
  for (const strategy of [undefined, 'squash', 'rebase'] as const) {
    const results: { out: string; shape: string }[] = [];
    for (const name of ['sync', 'merge']) {
      const c = copy();
      const sib = atVerify(c, strategy);
      pushMain(c, 'next.txt', 'next\n');
      const r = await run(['worktree', name, 'ST-9'], sib);
      expect(r.code, `${strategy} ${name}`).toBe(0);
      // shas differ between the two sandboxes, so compare the shape: the output with each 12-hex id blanked, the parents, the file list
      results.push({
        out: r.out.replace(/[0-9a-f]{12}/g, '<sha>'),
        shape: [parents(sib), gitRun(sib, 'ls-tree', '-r', '--name-only', 'HEAD').trim(), gitRun(sib, 'log', '--format=%s', 'origin/main..HEAD').trim()].join('|'),
      });
    }
    expect(results[1], String(strategy)).toEqual(results[0]);
  }
  // an early run is refused by both names with the same words
  const c = copy();
  ticketWorktree(c, 'ST-9');
  verifyStage(c.sibling('ST-9'), 'ST-9', { review: false });
  const a = await run(['worktree', 'sync', 'ST-9'], c.sibling('ST-9'));
  const b = await run(['worktree', 'merge', 'ST-9'], c.sibling('ST-9'));
  expect([a.code, a.err]).toEqual([2, expect.stringContaining('only at verify')]);
  expect(b).toEqual(a);
}, 360_000);
