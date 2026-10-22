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

it('risk:data-loss a round run that edits or commits in a live checkout stops the round', async () => {
  const { escapes } = (await import(new URL('../../../scripts/round.mjs', import.meta.url).href)) as {
    escapes: (rows: unknown[], m: { runs: Map<string, unknown>; judges: Map<string, unknown> }, live: string[]) => string[];
  };
  const { addWorktree, liveState, onLiveRefs } = (await import(new URL('../../../scripts/benchmark.mjs', import.meta.url).href)) as {
    addWorktree: (repo: string, o: { path: string; base: string; branch?: string }) => Rec;
    liveState: (repo: string) => { refs: Record<string, string>; worktrees: { path: string; head: string }[] };
    onLiveRefs: (repo: string, sha: string) => string[];
  };
  const ed = (...ps: string[]) => ({ edits: ps.map((path) => ({ path, ts: 0 })) });
  const rows = [
    { tag: 'executor-1-low', worktree: 'C:/Work/accord-bench/wt/executor-1-low' },
    { tag: 'critic-1-high', worktree: 'C:/Work/accord-bench/wt/critic-1' },
  ];
  const runs = new Map([
    ['executor-1-low', ed('c:/work/accord-bench/wt/executor-1-low/src/a.ts', 'D:/tmp/s.mjs')],
    ['critic-1-high', ed('c:/work/accord/src/a.ts')],
  ]);
  const judges = new Map([['executor-1-low', ed('C:/Work/accord-st-ln-14/x.ts')]]);
  expect(escapes(rows, { runs, judges }, ['C:/Work/accord', 'C:/Work/accord-st-ln-14'])).toEqual([
    'executor-1-low judge: edited C:/Work/accord-st-ln-14/x.ts in the live checkout C:/Work/accord-st-ln-14',
    'critic-1-high: edited c:/work/accord/src/a.ts in the live checkout C:/Work/accord',
  ]);

  const tmp = realpathSync.native(mkdtempSync(join(tmpdir(), 'bench-')));
  const t = tmp.replaceAll('\\', '/');
  try {
    const repo = t + '/repo';
    mkdirSync(repo);
    const git = (...a: string[]) => execFileSync('git', a, { cwd: repo, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
    const commit = (name: string) => {
      writeFileSync(`${repo}/${name}.txt`, name + '\n');
      git('add', '.');
      writeFileSync(t + '/msg.txt', name + '\n');
      git('-c', 'user.name=t', '-c', 'user.email=t@example.invalid', '-c', 'commit.gpgsign=false', 'commit', '-q', '--no-verify', '-F', t + '/msg.txt', '--cleanup=verbatim');
      return git('rev-parse', 'HEAD');
    };
    git('init', '-q', '-b', 'main');
    const H = commit('h');
    git('checkout', '-q', '-b', 'bench/executor-1-low');
    const E = commit('e');
    git('checkout', '-q', 'main');
    const M = commit('m');
    git('branch', 't/T-1', M);
    expect(onLiveRefs(repo, E)).toEqual([]);
    expect(onLiveRefs(repo, M)).toEqual(['refs/heads/main', 'refs/heads/t/T-1']);
    expect(onLiveRefs(repo, 'f'.repeat(40))).toEqual([]);

    addWorktree(repo, { path: t + '/b', base: H });
    const s = liveState(repo);
    expect(s.refs['refs/heads/main']).toBe(M);
    expect(Object.keys(s.refs).some((k) => k.startsWith('refs/heads/bench/'))).toBe(false);
    expect(s.worktrees.map((w) => w.path)).toEqual([repo]);
  } finally {
    rmSync(tmp, { recursive: true, force: true, maxRetries: 5 });
  }
}, 120_000);
