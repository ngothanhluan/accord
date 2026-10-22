import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';

type Rec = { path: string; base: string; branch?: string };
type Clean = { refused: boolean; removed: string[]; failed: unknown[] };

it('risk:data-loss clean removes only the worktrees the round marked', async () => {
  const { addWorktree, cleanWorktrees } = (await import(new URL('../../../scripts/benchmark.mjs', import.meta.url).href)) as {
    addWorktree: (repo: string, o: { path: string; base: string; branch?: string }) => Rec;
    cleanWorktrees: (repo: string, o?: { force?: boolean }) => Clean;
  };
  const tmp = realpathSync.native(mkdtempSync(join(tmpdir(), 'bench-')));
  const t = tmp.replaceAll('\\', '/');
  try {
    const repo = t + '/repo';
    mkdirSync(repo);
    const git = (...a: string[]) => execFileSync('git', a, { cwd: repo, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
    writeFileSync(repo + '/a.txt', 'a\n');
    git('init', '-q');
    git('add', '.');
    writeFileSync(t + '/msg.txt', 'init\n');
    git('-c', 'user.name=t', '-c', 'user.email=t@example.invalid', '-c', 'commit.gpgsign=false', 'commit', '-q', '--no-verify', '-F', t + '/msg.txt', '--cleanup=verbatim');
    const H = git('rev-parse', 'HEAD');
    writeFileSync(repo + '/keep.txt', 'keep\n');
    const [A, B, C, D] = ['a', 'b', 'c', 'd'].map((n) => `${t}/${n}`);

    expect(addWorktree(repo, { path: A, base: H, branch: 'bench/executor-1-low' })).toEqual({ path: A, base: H, branch: 'bench/executor-1-low' });
    const rb = addWorktree(repo, { path: B, base: H });
    expect(rb.path).toBe(B);
    expect(rb.base).toBe(H);
    expect(existsSync(A) && existsSync(B)).toBe(true);

    git('worktree', 'add', '-q', '-b', 'other', C, H);
    writeFileSync(C + '/wip.txt', 'wip\n');

    mkdirSync(D);
    writeFileSync(D + '/d.txt', 'd\n');
    expect(() => addWorktree(repo, { path: D, base: H, branch: 'bench/x-1-low' })).toThrow('already exists');
    expect(git('branch', '--list', 'bench/x-1-low')).toBe('');

    expect(cleanWorktrees(repo)).toEqual({ refused: true, removed: [], failed: [] });
    expect(existsSync(A) && existsSync(B)).toBe(true);

    mkdirSync(repo + '/docs/benchmark', { recursive: true });
    writeFileSync(repo + '/docs/benchmark/round-1.md', 'report\n');
    const out = cleanWorktrees(repo);
    expect(out.refused).toBe(false);
    expect(out.failed).toEqual([]);
    expect([...out.removed].sort()).toEqual([A, B]);
    expect(existsSync(A) || existsSync(B)).toBe(false);
    expect(git('branch', '--list', 'bench/*')).toBe('');
    expect(existsSync(C + '/wip.txt') && existsSync(D + '/d.txt') && existsSync(repo + '/keep.txt')).toBe(true);
    expect(git('branch', '--list', 'other')).toContain('other');
    const listed = git('worktree', 'list', '--porcelain').split('\n').filter((l) => l.startsWith('worktree ')).map((l) => l.slice(9));
    expect(listed).toEqual([repo, C]);
  } finally {
    rmSync(tmp, { recursive: true, force: true, maxRetries: 5 });
  }
}, 120_000);
