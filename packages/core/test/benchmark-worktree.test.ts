import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
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

type Setup = Rec & { ready?: boolean };
const commitIn = (repo: string, t: string, name: string, date?: string) => {
  writeFileSync(`${repo}/${name}.txt`, name + '\n');
  const g = (...a: string[]) => execFileSync('git', a, { cwd: repo, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, ...(date ? { GIT_AUTHOR_DATE: date, GIT_COMMITTER_DATE: date } : {}) } }).trim();
  g('add', '.');
  writeFileSync(t + '/msg.txt', name + '\n');
  g('-c', 'user.name=t', '-c', 'user.email=t@example.invalid', '-c', 'commit.gpgsign=false', 'commit', '-q', '--no-verify', '-F', t + '/msg.txt', '--cleanup=verbatim');
  return g('rev-parse', 'HEAD');
};

it('risk:data-loss a worktree whose setup failed is set up again on a re-run and only then marked ready', async () => {
  const { prepareWorktree } = (await import(new URL('../../../scripts/benchmark.mjs', import.meta.url).href)) as {
    prepareWorktree: (repo: string, state: { worktrees: Record<string, Setup> }, key: string, spec: { path: string; base: string; branch?: string }, setup: (dir: string) => void) => string;
  };
  const tmp = realpathSync.native(mkdtempSync(join(tmpdir(), 'bench-')));
  const t = tmp.replaceAll('\\', '/');
  try {
    const repo = t + '/repo';
    mkdirSync(repo);
    execFileSync('git', ['init', '-q', '-b', 'main'], { cwd: repo });
    const H = commitIn(repo, t, 'h');
    const state = { worktrees: {} as Record<string, Setup> };
    const spec = { path: t + '/w', base: H, branch: 'bench/executor-1-low' };
    let calls = 0;
    let fail = true;
    const setup = () => { calls++; if (fail) { fail = false; throw new Error('npm ci failed'); } };

    expect(() => prepareWorktree(repo, state, 'executor-1-low', spec, setup)).toThrow('npm ci failed');
    expect(state.worktrees['executor-1-low'].ready).toBeFalsy();
    expect(prepareWorktree(repo, state, 'executor-1-low', spec, setup)).toBe(spec.path);
    expect(calls).toBe(2);
    expect(state.worktrees['executor-1-low'].ready).toBe(true);
    prepareWorktree(repo, state, 'executor-1-low', spec, setup);
    expect(calls).toBe(2);
  } finally {
    rmSync(tmp, { recursive: true, force: true, maxRetries: 5 });
  }
}, 120_000);

it("risk:regression only a commit made inside the run window and not at or under the sample base counts as the run's own", async () => {
  const { ownCommits, atBase } = (await import(new URL('../../../scripts/benchmark.mjs', import.meta.url).href)) as {
    ownCommits: (repo: string, run: { commits: string[]; start: number; end: number }, base: string) => string[];
    atBase: (dir: string, base: string) => boolean;
  };
  const tmp = realpathSync.native(mkdtempSync(join(tmpdir(), 'bench-')));
  const t = tmp.replaceAll('\\', '/');
  try {
    const repo = t + '/repo';
    mkdirSync(repo);
    execFileSync('git', ['init', '-q', '-b', 'main'], { cwd: repo });
    const OLD = commitIn(repo, t, 'old', '2026-10-01T10:00:00Z');
    const BASE = commitIn(repo, t, 'base', '2026-10-01T12:00:00Z');
    const MINE = commitIn(repo, t, 'mine', '2026-10-01T12:30:00Z');
    const run = { commits: [OLD.slice(0, 7), BASE.slice(0, 7), MINE.slice(0, 7), 'f'.repeat(7)], start: Date.parse('2026-10-01T12:00:00Z'), end: Date.parse('2026-10-01T13:00:00Z') };
    expect(ownCommits(repo, run, BASE)).toEqual([MINE]);
    expect(atBase(repo, BASE)).toBe(false);
    expect(atBase(repo, MINE)).toBe(true);
  } finally {
    rmSync(tmp, { recursive: true, force: true, maxRetries: 5 });
  }
}, 120_000);

it('risk:regression --round 1 --plan run as a process records live checkouts', () => {
  const root = fileURLToPath(new URL('../../../', import.meta.url));
  const tmp = realpathSync.native(mkdtempSync(join(tmpdir(), 'bench-')));
  try {
    const repo = join(tmp, 'repo');
    mkdirSync(join(repo, 'scripts'), { recursive: true });
    execFileSync('git', ['init', '-q', '-b', 'main'], { cwd: repo });
    execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-q', '--allow-empty', '-m', 'c'], { cwd: repo });
    cpSync(join(root, '.claude', 'agents'), join(repo, '.claude', 'agents'), { recursive: true });
    const head = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repo, encoding: 'utf8' }).trim();
    // The first worktree add needs a base this repository has; it is what makes the run save its state.
    const text = readFileSync(join(root, 'scripts', 'benchmark-samples.json'), 'utf8').replace(/"base": "[0-9a-f]{40}"/g, `"base": "${head}"`);
    writeFileSync(join(repo, 'scripts', 'benchmark-samples.json'), text);
    const bench = join(tmp, 'accord-bench');
    mkdirSync(bench);
    writeFileSync(join(bench, 'compliance.md'), 'x\n');
    const list = JSON.parse(readFileSync(join(repo, 'scripts', 'benchmark-samples.json'), 'utf8')) as { samples: { agent: string; n: number; transcript: string }[] };
    for (const s of list.samples) {
      const d = join(bench, 'samples', `${s.agent.slice('accord-'.length)}-${s.n}`);
      mkdirSync(d, { recursive: true });
      writeFileSync(join(d, 'sample.json'), JSON.stringify({ transcript: s.transcript }));
    }
    let stderr = '';
    try {
      execFileSync(process.execPath, [join(root, 'scripts', 'benchmark.mjs'), '--round', '1', '--plan'], { cwd: repo, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    } catch (e) { stderr = String((e as { stderr?: string }).stderr); }
    expect(stderr).not.toContain('before initialization');
    const state = JSON.parse(readFileSync(join(bench, 'round-1.json'), 'utf8')) as { live: { refs: object } };
    expect(typeof state.live.refs).toBe('object');
  } finally {
    rmSync(tmp, { recursive: true, force: true, maxRetries: 5 });
  }
}, 120_000);

// A suite command that exits `first` on its first call and `later` after, counting calls in a file.
function suiteScript(counter: string, first: number, later: number) {
  return `const fs=require('fs');const f=${JSON.stringify(counter)};const n=(fs.existsSync(f)?+fs.readFileSync(f,'utf8'):0)+1;fs.writeFileSync(f,String(n));process.exit(n===1?${first}:${later});\n`;
}

function planFixture(tmp: string, first: number, later: number) {
  const root = fileURLToPath(new URL('../../../', import.meta.url));
  const repo = join(tmp, 'repo');
  mkdirSync(join(repo, 'scripts'), { recursive: true });
  mkdirSync(join(repo, 'accord'), { recursive: true });
  const counter = join(tmp, 'count.txt').replaceAll('\\', '/');
  writeFileSync(join(repo, 'suite.js'), suiteScript(counter, first, later));
  writeFileSync(join(repo, 'accord', 'config.yml'), 'tests:\n  full: node suite.js\n');
  execFileSync('git', ['init', '-q', '-b', 'main'], { cwd: repo });
  execFileSync('git', ['add', '.'], { cwd: repo });
  execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-q', '-m', 'c'], { cwd: repo });
  cpSync(join(root, '.claude', 'agents'), join(repo, '.claude', 'agents'), { recursive: true });
  const head = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repo, encoding: 'utf8' }).trim();
  const text = readFileSync(join(root, 'scripts', 'benchmark-samples.json'), 'utf8').replace(/"base": "[0-9a-f]{40}"/g, `"base": "${head}"`);
  writeFileSync(join(repo, 'scripts', 'benchmark-samples.json'), text);
  const bench = join(tmp, 'accord-bench');
  mkdirSync(bench);
  writeFileSync(join(bench, 'compliance.md'), 'x\n');
  const list = JSON.parse(text) as { samples: { agent: string; n: number; transcript: string }[] };
  for (const s of list.samples) {
    const d = join(bench, 'samples', `${s.agent.slice('accord-'.length)}-${s.n}`);
    mkdirSync(d, { recursive: true });
    writeFileSync(join(d, 'sample.json'), JSON.stringify({ transcript: s.transcript }));
  }
  const plan = () => {
    try {
      execFileSync(process.execPath, [join(root, 'scripts', 'benchmark.mjs'), '--round', '1', '--plan'], { cwd: repo, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
      return { status: 0, stderr: '' };
    } catch (e) { return { status: (e as { status: number }).status, stderr: String((e as { stderr?: string }).stderr) }; }
  };
  const calls = () => Number(readFileSync(counter, 'utf8'));
  return { bench, plan, calls };
}

it('risk:regression a suite that fails once and passes on its re-run does not stop --plan and the re-run is recorded', () => {
  const tmp = realpathSync.native(mkdtempSync(join(tmpdir(), 'bench-')));
  try {
    const f = planFixture(tmp, 1, 0);
    const r = f.plan();
    expect(r.stderr).not.toContain('suite red at base');
    expect(f.calls()).toBeGreaterThanOrEqual(2);
    expect(readFileSync(join(f.bench, 'round-1.json'), 'utf8')).toContain('reruns');
  } finally {
    rmSync(tmp, { recursive: true, force: true, maxRetries: 5 });
  }
}, 120_000);

it('risk:regression a suite that fails on its re-run too is red', () => {
  const tmp = realpathSync.native(mkdtempSync(join(tmpdir(), 'bench-')));
  try {
    const f = planFixture(tmp, 1, 1);
    const r = f.plan();
    expect(r.status).toBe(2);
    expect(r.stderr).toMatch(/suite red at base for accord-executor \d/);
    expect(f.calls()).toBe(2);
  } finally {
    rmSync(tmp, { recursive: true, force: true, maxRetries: 5 });
  }
}, 120_000);

it('risk:regression scoring a run re-runs a red suite once and records it', async () => {
  const { runSuite } = (await import(new URL('../../../scripts/benchmark.mjs', import.meta.url).href)) as {
    runSuite: (dir: string, repo: string) => { rerun?: { files: string[]; ok: boolean } };
  };
  const tmp = realpathSync.native(mkdtempSync(join(tmpdir(), 'bench-')));
  try {
    const mk = (name: string, first: number, later: number) => {
      const dir = join(tmp, name);
      mkdirSync(join(dir, 'accord'), { recursive: true });
      writeFileSync(join(dir, 'suite.js'), suiteScript(join(dir, 'n.txt').replaceAll('\\', '/'), first, later));
      writeFileSync(join(dir, 'accord', 'config.yml'), 'tests:\n  full: node suite.js\n');
      return dir;
    };
    const a = mk('a', 1, 0);
    expect(runSuite(a, a).rerun?.ok).toBe(true);
    const b = mk('b', 1, 1);
    expect(() => runSuite(b, b)).toThrow();
  } finally {
    rmSync(tmp, { recursive: true, force: true, maxRetries: 5 });
  }
}, 120_000);

it('risk:parsing a red suite re-runs only the failing files, and the full suite when the report is not about files or not from this run', async () => {
  const { runSuite } = (await import(new URL('../../../scripts/benchmark.mjs', import.meta.url).href)) as {
    runSuite: (dir: string, repo: string) => { rerun?: { files: string[]; ok: boolean } };
  };
  const tmp = realpathSync.native(mkdtempSync(join(tmpdir(), 'bench-')));
  try {
    const failing = '<testcase classname="test/a.test.ts" name="x\n  y">\n<failure message="m">boom</failure>\n</testcase>\n<testcase classname="test/a.test.ts" name="z"><error message="e"/></testcase>';
    const noise = '<testcase classname="test/b.test.ts" name="s"><skipped/></testcase>\n<testcase classname="test/b.test.ts" name="p"/>';
    const unhandled = '<testcase classname="vitest unhandled errors" name="Unhandled error"><error message="u"/></testcase>';
    const mk = (name: string, cases: string, stale = false) => {
      const dir = join(tmp, name);
      mkdirSync(join(dir, 'accord'), { recursive: true });
      mkdirSync(join(dir, 'test'));
      writeFileSync(join(dir, 'test', 'a.test.ts'), '');
      const q = (s: string) => JSON.stringify(s.replaceAll('\\', '/'));
      writeFileSync(join(dir, 'full.js'), `const fs=require('fs');const c=${q(join(dir, 'full.txt'))};const n=(fs.existsSync(c)?+fs.readFileSync(c,'utf8'):0)+1;fs.writeFileSync(c,String(n));` +
        `if(n===1){fs.writeFileSync('r.xml',${JSON.stringify(`<testsuites><testsuite>${cases}</testsuite></testsuites>`)});${stale ? `fs.utimesSync('r.xml',1,1);` : ''}process.exit(1)}\n`);
      writeFileSync(join(dir, 'affected.js'), `require('fs').appendFileSync(${q(join(dir, 'aff.txt'))},JSON.stringify(process.argv.slice(2))+'\\n');\n`);
      writeFileSync(join(dir, 'accord', 'config.yml'), 'tests:\n  report: r.xml\n  full: node full.js\n  affected: node affected.js {files}\n');
      return dir;
    };
    const read = (dir: string, f: string) => (existsSync(join(dir, f)) ? readFileSync(join(dir, f), 'utf8') : '');

    const a = mk('a', `${failing}\n${noise}`);
    expect(runSuite(a, a).rerun).toEqual({ files: ['test/a.test.ts'], ok: true });
    expect(read(a, 'aff.txt')).toBe('["test/a.test.ts"]\n');
    expect(read(a, 'full.txt')).toBe('1');

    const u = mk('u', `${failing}\n${unhandled}`);
    expect(runSuite(u, u).rerun).toEqual({ files: [], ok: true });
    expect(read(u, 'aff.txt')).toBe('');
    expect(read(u, 'full.txt')).toBe('2');

    const s = mk('s', failing, true);
    expect(runSuite(s, s).rerun).toEqual({ files: [], ok: true });
    expect(read(s, 'aff.txt')).toBe('');
    expect(read(s, 'full.txt')).toBe('2');
  } finally {
    rmSync(tmp, { recursive: true, force: true, maxRetries: 5 });
  }
}, 120_000);
