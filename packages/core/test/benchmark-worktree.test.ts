import { execFileSync, spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, lstatSync, readdirSync, readFileSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
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
    const text = readFileSync(join(root, 'scripts', 'benchmark-samples.json'), 'utf8').replace(/,\s*"overlay": \[[^\]]*\]/g, '').replace(/"base": "[0-9a-f]{40}"/g, `"base": "${head}"`);
    writeFileSync(join(repo, 'scripts', 'benchmark-samples.json'), text);
    const bench = join(tmp, 'accord-bench');
    mkdirSync(bench);
    writeFileSync(join(bench, 'compliance.md'), 'x\n');
    const list = JSON.parse(readFileSync(join(repo, 'scripts', 'benchmark-samples.json'), 'utf8')) as { samples: { agent: string; n: number; transcript: string }[] };
    for (const s of list.samples) {
      const d = join(bench, 'samples', `${s.agent.slice('accord-'.length)}-${s.n}`);
      mkdirSync(d, { recursive: true });
      writeFileSync(join(d, 'sample.json'), JSON.stringify({ transcript: s.transcript }));
      writeFileSync(join(d, 'root-reads.json'), '[]');
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

function planFixture(tmp: string, first: number, later: number, own?: { script: string; config: string }) {
  const root = fileURLToPath(new URL('../../../', import.meta.url));
  const repo = join(tmp, 'repo');
  mkdirSync(join(repo, 'scripts'), { recursive: true });
  mkdirSync(join(repo, 'accord'), { recursive: true });
  const counter = join(tmp, 'count.txt').replaceAll('\\', '/');
  writeFileSync(join(repo, 'suite.js'), own?.script ?? suiteScript(counter, first, later));
  writeFileSync(join(repo, 'accord', 'config.yml'), own?.config ?? 'tests:\n  full: node suite.js\n');
  execFileSync('git', ['init', '-q', '-b', 'main'], { cwd: repo });
  execFileSync('git', ['add', '.'], { cwd: repo });
  execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-q', '-m', 'c'], { cwd: repo });
  cpSync(join(root, '.claude', 'agents'), join(repo, '.claude', 'agents'), { recursive: true });
  const head = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repo, encoding: 'utf8' }).trim();
  const text = readFileSync(join(root, 'scripts', 'benchmark-samples.json'), 'utf8').replace(/,\s*"overlay": \[[^\]]*\]/g, '').replace(/"base": "[0-9a-f]{40}"/g, `"base": "${head}"`);
  writeFileSync(join(repo, 'scripts', 'benchmark-samples.json'), text);
  const bench = join(tmp, 'accord-bench');
  mkdirSync(bench);
  writeFileSync(join(bench, 'compliance.md'), 'x\n');
  const list = JSON.parse(text) as { samples: { agent: string; n: number; transcript: string }[] };
  for (const s of list.samples) {
    const d = join(bench, 'samples', `${s.agent.slice('accord-'.length)}-${s.n}`);
    mkdirSync(d, { recursive: true });
    writeFileSync(join(d, 'sample.json'), JSON.stringify({ transcript: s.transcript }));
    writeFileSync(join(d, 'root-reads.json'), '[]');
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
    expect(r.status).toBe(2);
    expect(readFileSync(join(f.bench, 'round-1.json'), 'utf8')).toContain('reruns');
  } finally {
    rmSync(tmp, { recursive: true, force: true, maxRetries: 5 });
  }
}, 120_000);

// What the verify stage leaves behind: tests.full has run in the checkout, so tests.report exists there.
const REPORT = 'node_modules/.cache/accord/junit.xml';
const reportConfig = `setup: []
tests:
  full: node suite.js
  report: ${REPORT}
`;
const verifierDirs = (bench: string) => readdirSync(join(bench, 'wt')).filter((d) => d.startsWith('verifier-'));

it('risk:regression --plan leaves the tests.report of tests.full in every verifier worktree, even from a red suite', () => {
  const tmp = realpathSync.native(mkdtempSync(join(tmpdir(), 'bench-')));
  try {
    // The suite writes its report where the config says; it is red in a verifier worktree, as the original suites could be.
    const script = `const fs=require('fs');fs.mkdirSync('node_modules/.cache/accord',{recursive:true});fs.writeFileSync('${REPORT}','<testsuites>'+process.cwd().split(/[\\/]/).pop()+'</testsuites>');process.exit(/verifier/.test(process.cwd())?1:0);
`;
    const f = planFixture(tmp, 0, 0, { script, config: reportConfig });
    f.plan();
    const dirs = verifierDirs(f.bench);
    expect(dirs.length).toBeGreaterThan(0);
    for (const d of dirs) expect(readFileSync(join(f.bench, 'wt', d, REPORT), 'utf8')).toContain('<testsuites>');
  } finally {
    rmSync(tmp, { recursive: true, force: true, maxRetries: 5 });
  }
}, 180_000);

it('risk:regression --plan exits 2 naming the report file when tests.full leaves none in a verifier worktree', () => {
  const tmp = realpathSync.native(mkdtempSync(join(tmpdir(), 'bench-')));
  try {
    const f = planFixture(tmp, 0, 0, { script: 'process.exit(0)', config: reportConfig });
    const r = f.plan();
    expect(r.status).toBe(2);
    expect(r.stderr).toContain(REPORT);
    expect(r.stderr).toMatch(/verifier/);
  } finally {
    rmSync(tmp, { recursive: true, force: true, maxRetries: 5 });
  }
}, 180_000);

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

it('risk:regression a failing file the run changed is re-run with the full suite, not alone', async () => {
  const { runSuite } = (await import(new URL('../../../scripts/benchmark.mjs', import.meta.url).href)) as {
    runSuite: (dir: string, repo: string, base?: string) => { rerun?: { files: string[]; ok: boolean } };
  };
  const tmp = realpathSync.native(mkdtempSync(join(tmpdir(), 'bench-')));
  try {
    const dir = join(tmp, 'w');
    mkdirSync(join(dir, 'accord'), { recursive: true });
    mkdirSync(join(dir, 'test'));
    const g = (...a: string[]) => execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', ...a], { cwd: dir, encoding: 'utf8' });
    const q = (x: string) => JSON.stringify(x.replaceAll('\\', '/'));
    const xml = '<testsuites><testsuite><testcase classname="test/new.test.ts" name="x"><failure message="m"/></testcase></testsuite></testsuites>';
    writeFileSync(join(dir, 'full.js'), `const fs=require('fs');const c=${q(join(dir, 'full.txt'))};const n=(fs.existsSync(c)?+fs.readFileSync(c,'utf8'):0)+1;fs.writeFileSync(c,String(n));if(n===1){fs.writeFileSync('r.xml',${JSON.stringify(xml)});process.exit(1)}\n`);
    writeFileSync(join(dir, 'affected.js'), `require('fs').appendFileSync(${q(join(dir, 'aff.txt'))},'x');\n`);
    writeFileSync(join(dir, 'accord', 'config.yml'), 'tests:\n  report: r.xml\n  full: node full.js\n  affected: node affected.js {files}\n');
    g('init', '-q');
    g('add', '-A');
    g('commit', '-q', '-m', 'base');
    const base = g('rev-parse', 'HEAD').trim();
    writeFileSync(join(dir, 'test', 'new.test.ts'), '');
    expect(runSuite(dir, dir, base).rerun).toEqual({ files: [], ok: true });
    expect(existsSync(join(dir, 'aff.txt'))).toBe(false);
    expect(readFileSync(join(dir, 'full.txt'), 'utf8')).toBe('2');
  } finally {
    rmSync(tmp, { recursive: true, force: true, maxRetries: 5 });
  }
}, 120_000);

it('risk:regression --samples and --plan exit 2 on a review-package file base that is no ancestor, before any worktree or brief', () => {
  const root = fileURLToPath(new URL('../../../', import.meta.url));
  const tmp = realpathSync.native(mkdtempSync(join(tmpdir(), 'bench-')));
  try {
    const repo = join(tmp, 'repo');
    mkdirSync(join(repo, 'scripts'), { recursive: true });
    const g = (...a: string[]) => execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', '-c', 'commit.gpgsign=false', ...a], { cwd: repo, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
    g('init', '-q', '-b', 'main');
    g('commit', '-q', '--allow-empty', '-m', 'c');
    const head = g('rev-parse', 'HEAD');
    g('checkout', '-q', '--orphan', 'other');
    g('commit', '-q', '--allow-empty', '-m', 'o');
    const orphan = g('rev-parse', 'HEAD');
    g('checkout', '-q', 'main');
    cpSync(join(root, '.claude', 'agents'), join(repo, '.claude', 'agents'), { recursive: true });
    const text = readFileSync(join(root, 'scripts', 'benchmark-samples.json'), 'utf8').replace(/,\s*"overlay": \[[^\]]*\]/g, '').replace(/"(base|main)": "[0-9a-f]{40}"/g, `"$1": "${head}"`);
    const list = JSON.parse(text) as { samples: { files: { from: string; base?: string }[] }[] };
    const pkgs = list.samples.flatMap((s) => s.files).filter((f) => f.from === 'review-package');
    for (const f of pkgs) f.base = head;
    pkgs[0].base = orphan;
    writeFileSync(join(repo, 'scripts', 'benchmark-samples.json'), JSON.stringify(list));
    const bench = join(tmp, 'accord-bench');
    mkdirSync(bench);
    writeFileSync(join(bench, 'compliance.md'), 'x\n');
    for (const arg of ['--samples', '--plan']) {
      let code = 0;
      let stderr = '';
      try {
        execFileSync(process.execPath, [join(root, 'scripts', 'benchmark.mjs'), '--round', '1', arg], { cwd: repo, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
      } catch (e) { code = (e as { status: number }).status; stderr = String((e as { stderr?: string }).stderr); }
      expect(code).toBe(2);
      expect(stderr).toContain('is not an ancestor of the sample base');
      expect(stderr).toContain(orphan);
      for (const d of ['wt', 'briefs', 'samples']) expect(existsSync(join(bench, d))).toBe(false);
    }
  } finally {
    rmSync(tmp, { recursive: true, force: true, maxRetries: 5 });
  }
}, 120_000);

it('risk:data-loss a prepared worktree gets its overlay uncommitted, and a recorded one whose base or overlay changed is rebuilt', async () => {
  type Held = Rec & { preparedAt?: number; overlay?: unknown };
  const { prepareWorktree } = (await import(new URL('../../../scripts/benchmark.mjs', import.meta.url).href)) as {
    prepareWorktree: (repo: string, state: { worktrees: Record<string, Held> }, key: string, spec: Record<string, unknown>, setup: (d: string) => void) => string;
  };
  const tmp = realpathSync.native(mkdtempSync(join(tmpdir(), 'bench-')));
  const t = tmp.replaceAll('\\', '/');
  try {
    const repo = t + '/repo';
    mkdirSync(repo);
    const git = (cwd: string, ...a: string[]) => execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@example.invalid', '-c', 'commit.gpgsign=false', ...a], { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
    git(repo, 'init', '-q');
    writeFileSync(repo + '/a.txt', 'one\n');
    git(repo, 'add', '.');
    git(repo, 'commit', '-q', '-m', 'one');
    const H1 = git(repo, 'rev-parse', 'HEAD');
    writeFileSync(repo + '/a.txt', 'two\n');
    git(repo, 'commit', '-q', '-am', 'two');
    const H2 = git(repo, 'rev-parse', 'HEAD');
    const state = { worktrees: {} as Record<string, Held> };
    const dir = t + '/wt';
    const spec = (base: string, overlay: unknown[]) => ({ path: dir, base, branch: 'bench/x-1-low', overlay });
    const none = () => {};

    const o1 = [{ path: 'a.txt', from: 'read', text: 'read text\n' }, { path: 'sub/b.txt', from: H2, text: 'from commit\n' }];
    expect(prepareWorktree(repo, state, 'x', spec(H1, o1), none)).toBe(dir);
    expect(readFileSync(dir + '/a.txt', 'utf8')).toBe('read text\n');
    expect(readFileSync(dir + '/sub/b.txt', 'utf8')).toBe('from commit\n');
    expect(git(dir, 'rev-parse', 'HEAD')).toBe(H1);
    expect(git(dir, 'status', '--porcelain').split('\n').sort()).toEqual(['?? sub/', 'M a.txt']);
    const first = state.worktrees.x.preparedAt;
    expect(first).toBeGreaterThan(0);

    // an equal spec reuses the worktree and keeps its preparation time
    prepareWorktree(repo, state, 'x', spec(H1, o1), none);
    expect(state.worktrees.x.preparedAt).toBe(first);

    // a changed overlay, then a changed base, rebuild it
    prepareWorktree(repo, state, 'x', spec(H1, [{ path: 'a.txt', from: 'read', text: 'other\n' }, { path: 'sub/b.txt', from: H1, text: 'x\n' }]), none);
    expect(readFileSync(dir + '/sub/b.txt', 'utf8')).toBe('x\n');
    expect(readFileSync(dir + '/a.txt', 'utf8')).toBe('other\n');
    prepareWorktree(repo, state, 'x', spec(H2, []), none);
    expect(git(dir, 'rev-parse', 'HEAD')).toBe(H2);
    expect(readFileSync(dir + '/a.txt', 'utf8').trim()).toBe('two');
    expect(existsSync(dir + '/sub')).toBe(false);
    expect(state.worktrees.x.base).toBe(H2);
    expect(state.worktrees.x.overlay).toBeUndefined();

    // a worktree that holds a run's commits is not rebuilt
    writeFileSync(dir + '/c.txt', 'run\n');
    git(dir, 'add', '.');
    git(dir, 'commit', '-q', '-m', 'run');
    expect(() => prepareWorktree(repo, state, 'x', spec(H1, []), none)).toThrow('holds commits');
    expect(existsSync(dir + '/c.txt')).toBe(true);
  } finally {
    rmSync(tmp, { recursive: true, force: true, maxRetries: 5 });
  }
}, 120_000);

// ---- --samples and --plan with a transcript Claude Code moved to another project folder ----
type Listed = { agent: string; n: number; transcript: string; root: string };
const OLD = 'P-old/S1/subagents/agent-x1.jsonl';
const NEW = 'P-listed/S1/subagents/agent-x1.jsonl';

function samplesFixture(tmp: string) {
  const root = fileURLToPath(new URL('../../../', import.meta.url));
  const repo = join(tmp, 'repo');
  mkdirSync(join(repo, 'scripts'), { recursive: true });
  writeFileSync(join(repo, 'pkg.txt'), 'one\ntwo\n');
  const g = (...a: string[]) => execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', '-c', 'commit.gpgsign=false', ...a], { cwd: repo, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  g('init', '-q', '-b', 'main');
  g('add', '.');
  g('commit', '-q', '-m', 'c');
  cpSync(join(root, '.claude', 'agents'), join(repo, '.claude', 'agents'), { recursive: true });
  const head = g('rev-parse', 'HEAD');
  const text = readFileSync(join(root, 'scripts', 'benchmark-samples.json'), 'utf8').replace(/,\s*"overlay": \[[^\]]*\]/g, '').replace(/"(base|main)": "[0-9a-f]{40}"/g, `"$1": "${head}"`);
  const list = JSON.parse(text) as { samples: Listed[] };
  const moved = list.samples.find((s) => s.agent === 'accord-executor' && s.n === 1)!;
  moved.transcript = NEW;
  writeFileSync(join(repo, 'scripts', 'benchmark-samples.json'), JSON.stringify(list));
  const bench = join(tmp, 'accord-bench');
  mkdirSync(bench);
  writeFileSync(join(bench, 'compliance.md'), 'x\n');
  const dirOf = (s: Listed) => join(bench, 'samples', `${s.agent.slice('accord-'.length)}-${s.n}`);
  for (const s of list.samples) {
    mkdirSync(dirOf(s), { recursive: true });
    writeFileSync(join(dirOf(s), 'sample.json'), JSON.stringify({ transcript: s === moved ? OLD : s.transcript }));
    if (s !== moved) writeFileSync(join(dirOf(s), 'root-reads.json'), '[]');
  }
  const home = join(tmp, 'home');
  const projects = join(home, '.claude', 'projects');
  mkdirSync(projects, { recursive: true });
  // The run of the moved sample, stored under a project folder the list does not name.
  const putRun = (folder: string) => {
    const d = join(projects, folder);
    const sub = join(d, 'S1', 'subagents');
    mkdirSync(sub, { recursive: true });
    const line = (o: unknown) => JSON.stringify(o) + '\n';
    writeFileSync(join(d, 'S1.jsonl'), line({ type: 'assistant', timestamp: '2026-10-01T00:00:00Z', message: { content: [{ type: 'tool_use', id: 'toolu_A', name: 'Agent', input: { description: 'Build T-1 task 1', prompt: 'x' } }] } }));
    writeFileSync(join(sub, 'agent-x1.meta.json'), JSON.stringify({ agentType: 'accord-executor', description: 'Build T-1 task 1', toolUseId: 'toolu_A' }));
    writeFileSync(join(sub, 'agent-x1.jsonl'),
      line({ type: 'assistant', timestamp: '2026-10-01T00:01:00Z', message: { id: 'm1', model: 'm', content: [{ type: 'tool_use', id: 't1', name: 'Read', input: { file_path: `${moved.root}/pkg.txt` } }] } }) +
      line({ type: 'user', message: { content: [{ type: 'tool_result', tool_use_id: 't1', content: '     1\tone\n     2\ttwo' }] }, toolUseResult: { file: { totalLines: 2 } } }));
  };
  const cmd = (...args: string[]) => {
    const r = spawnSync(process.execPath, [join(root, 'scripts', 'benchmark.mjs'), '--round', '1', ...args], { cwd: repo, encoding: 'utf8', env: { ...process.env, HOME: home, USERPROFILE: home } });
    return { status: r.status, stdout: r.stdout, stderr: r.stderr };
  };
  return { list, moved, bench, dirOf, putRun, cmd, repo };
}

it('risk:regression --samples finds a transcript Claude Code moved to another project folder by its session tail and backfills its root reads', () => {
  const tmp = realpathSync.native(mkdtempSync(join(tmpdir(), 'bench-')));
  try {
    const f = samplesFixture(tmp);
    f.putRun('P-moved');
    const out = f.cmd('--samples');
    expect(out.stderr).toContain('P-moved/S1/subagents/agent-x1.jsonl');
    expect(out.status).toBe(0);
    expect(out.stdout).toBe('0 written, 45 kept\n');
    expect(JSON.parse(readFileSync(join(f.dirOf(f.moved), 'root-reads.json'), 'utf8'))).toEqual([{ path: 'pkg.txt', start: 1, total: 2, whole: true, text: 'one\ntwo' }]);
    // the snapshot keeps naming the path it was made from
    expect(JSON.parse(readFileSync(join(f.dirOf(f.moved), 'sample.json'), 'utf8')).transcript).toBe(OLD);
  } finally {
    rmSync(tmp, { recursive: true, force: true, maxRetries: 5 });
  }
}, 120_000);

it('risk:regression a moved transcript found under two project folders is a problem and nothing is stored', () => {
  const tmp = realpathSync.native(mkdtempSync(join(tmpdir(), 'bench-')));
  try {
    const f = samplesFixture(tmp);
    f.putRun('P-moved');
    f.putRun('P-moved-too');
    const out = f.cmd('--samples');
    expect(out.status).toBe(2);
    expect(out.stderr).toContain('P-moved/S1/subagents');
    expect(out.stderr).toContain('P-moved-too/S1/subagents');
    expect(existsSync(join(f.dirOf(f.moved), 'root-reads.json'))).toBe(false);
  } finally {
    rmSync(tmp, { recursive: true, force: true, maxRetries: 5 });
  }
}, 120_000);

it('risk:regression --samples stops before any write when one sample drifts from its replay worktree', () => {
  const tmp = realpathSync.native(mkdtempSync(join(tmpdir(), 'bench-')));
  try {
    const f = samplesFixture(tmp);
    f.putRun('P-moved');
    const other = f.list.samples.find((s) => s.agent === 'accord-critic' && s.n === 1)!;
    writeFileSync(join(f.dirOf(other), 'root-reads.json'), JSON.stringify([{ path: 'pkg.txt', start: 1, total: 2, whole: true, text: 'one\nDIFFERENT' }]));
    const out = f.cmd('--samples');
    expect(out.status).toBe(2);
    expect(out.stderr).toContain('accord-critic 1: pkg.txt differs from the file the replay worktree will hold, first at line 2');
    expect(existsSync(join(f.dirOf(f.moved), 'root-reads.json'))).toBe(false);
  } finally {
    rmSync(tmp, { recursive: true, force: true, maxRetries: 5 });
  }
}, 120_000);

it('risk:regression --plan accepts a snapshot of the old transcript path for a moved sample and then refuses while its root reads are missing', () => {
  const tmp = realpathSync.native(mkdtempSync(join(tmpdir(), 'bench-')));
  try {
    const f = samplesFixture(tmp);
    const out = f.cmd('--plan');
    expect(out.status).toBe(2);
    expect(out.stderr).toBe('run --round 1 --samples first: no stored root reads for accord-executor 1\n');
    expect(existsSync(join(f.bench, 'wt'))).toBe(false);
  } finally {
    rmSync(tmp, { recursive: true, force: true, maxRetries: 5 });
  }
}, 120_000);

// ---- a branch that moved off its base is never deleted; --rerun keeps a run's commits ----
async function bench() {
  return (await import(new URL('../../../scripts/benchmark.mjs', import.meta.url).href)) as {
    prepareWorktree: (repo: string, state: { worktrees: Record<string, Setup & { preparedAt?: number }> }, key: string, spec: Record<string, unknown>, setup: (d: string) => void) => string;
    rerunWorktree: (repo: string, state: { worktrees: Record<string, Setup> }, key: string) => string | null;
  };
}
function twoCommitRepo(t: string) {
  const repo = t + '/repo';
  mkdirSync(repo);
  const git = (cwd: string, ...a: string[]) => execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@example.invalid', '-c', 'commit.gpgsign=false', ...a], { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  git(repo, 'init', '-q');
  writeFileSync(repo + '/a.txt', 'one\n');
  git(repo, 'add', '.');
  git(repo, 'commit', '-q', '-m', 'one');
  const H1 = git(repo, 'rev-parse', 'HEAD');
  writeFileSync(repo + '/a.txt', 'two\n');
  git(repo, 'commit', '-q', '-am', 'two');
  return { repo, git, H1, H2: git(repo, 'rev-parse', 'HEAD') };
}
const runCommit = (git: (cwd: string, ...a: string[]) => string, dir: string) => {
  writeFileSync(dir + '/run.txt', 'run\n');
  git(dir, 'add', '.');
  git(dir, 'commit', '-q', '-m', 'run');
  return git(dir, 'rev-parse', 'HEAD');
};

it('risk:data-loss a rebuild refuses while the run branch is past its base, whether the folder is gone or its HEAD went back to the base', async () => {
  const { prepareWorktree } = await bench();
  const tmp = realpathSync.native(mkdtempSync(join(tmpdir(), 'bench-')));
  const t = tmp.replaceAll('\\', '/');
  try {
    const { repo, git, H1, H2 } = twoCommitRepo(t);
    const state = { worktrees: {} as Record<string, Setup & { preparedAt?: number }> };
    const dir = t + '/wt';
    const spec = (base: string) => ({ path: dir, base, branch: 'bench/x-1-low' });
    const none = () => {};
    prepareWorktree(repo, state, 'x', spec(H1), none);
    const E = runCommit(git, dir);

    // HEAD detached back at the base while the branch holds the commit
    git(dir, 'checkout', '-q', '--detach', H1);
    expect(() => prepareWorktree(repo, state, 'x', spec(H2), none)).toThrow('holds commits');
    expect(git(repo, 'rev-parse', 'refs/heads/bench/x-1-low')).toBe(E);
    expect(existsSync(dir)).toBe(true);

    // the folder is gone
    git(dir, 'checkout', '-q', 'bench/x-1-low');
    rmSync(dir, { recursive: true, force: true, maxRetries: 5 });
    expect(() => prepareWorktree(repo, state, 'x', spec(H2), none)).toThrow('holds commits');
    expect(git(repo, 'rev-parse', 'refs/heads/bench/x-1-low')).toBe(E);
  } finally {
    rmSync(tmp, { recursive: true, force: true, maxRetries: 5 });
  }
}, 120_000);

it("risk:data-loss --rerun keeps the run's commits under a keep ref, rebuilds the worktree at base and supersedes the earlier run", async () => {
  const { prepareWorktree, rerunWorktree } = await bench();
  const { matchRuns, describe } = (await import(new URL('../../../scripts/round.mjs', import.meta.url).href)) as {
    matchRuns: (rows: unknown[], runs: unknown[], o: { judges: boolean }) => { missing: string[]; superseded: unknown[] };
    describe: (tag: string) => string;
  };
  const tmp = realpathSync.native(mkdtempSync(join(tmpdir(), 'bench-')));
  const t = tmp.replaceAll('\\', '/');
  try {
    const { repo, git, H1 } = twoCommitRepo(t);
    const state = { worktrees: {} as Record<string, Setup & { preparedAt?: number }> };
    const dir = t + '/wt';
    const spec = { path: dir, base: H1, branch: 'bench/x-1-low' };
    const none = () => {};
    prepareWorktree(repo, state, 'x', spec, none);
    const first = state.worktrees.x.preparedAt!;
    expect(rerunWorktree(repo, state, 'nope')).toBeNull();
    const E1 = runCommit(git, dir);
    const run = { desc: describe('x-1-low'), dispatch: { ts: first + 1 } };
    expect(matchRuns([{ tag: 'x-1-low', prepared: first }], [run], { judges: false }).missing).toEqual([]);
    await new Promise((r) => setTimeout(r, 20));

    expect(rerunWorktree(repo, state, 'x')).toBe('refs/keep/bench/x-1-low/1');
    prepareWorktree(repo, state, 'x', spec, none);
    expect(git(repo, 'rev-parse', 'refs/keep/bench/x-1-low/1')).toBe(E1);
    expect(git(repo, 'merge-base', '--is-ancestor', E1, 'refs/keep/bench/x-1-low/1')).toBe('');
    expect(git(dir, 'rev-parse', 'HEAD')).toBe(H1);
    expect(git(dir, 'status', '--porcelain')).toBe('');
    expect(git(repo, 'rev-parse', 'refs/heads/bench/x-1-low')).toBe(H1);
    expect(state.worktrees.x.preparedAt!).toBeGreaterThan(first + 1);
    const m = matchRuns([{ tag: 'x-1-low', prepared: state.worktrees.x.preparedAt }], [run], { judges: false });
    expect(m.missing).toEqual([describe('x-1-low')]);
    expect(m.superseded).toEqual([run]);

    // a second --rerun takes the next number and keeps the first
    const E2 = runCommit(git, dir);
    expect(rerunWorktree(repo, state, 'x')).toBe('refs/keep/bench/x-1-low/2');
    expect(git(repo, 'rev-parse', 'refs/keep/bench/x-1-low/2')).toBe(E2);
    expect(git(repo, 'rev-parse', 'refs/keep/bench/x-1-low/1')).toBe(E1);
  } finally {
    rmSync(tmp, { recursive: true, force: true, maxRetries: 5 });
  }
}, 120_000);

it('risk:data-loss --plan --rerun names a tag that is not a writer row of round-1.json and exits 2 before any worktree', () => {
  const tmp = realpathSync.native(mkdtempSync(join(tmpdir(), 'bench-')));
  try {
    const f = samplesFixture(tmp);
    for (const s of f.list.samples) writeFileSync(join(f.dirOf(s), 'root-reads.json'), '[]');
    writeFileSync(join(f.bench, 'round-1.json'), JSON.stringify({ rows: [{ tag: 'executor-2-low', agent: 'accord-executor' }, { tag: 'critic-1-high', agent: 'accord-critic' }] }));
    const out = f.cmd('--plan', '--rerun', 'executor-2-low,critic-1-high,executor-9-low');
    expect(out.status).toBe(2);
    expect(out.stderr).toContain('critic-1-high, executor-9-low');
    expect(out.stderr).not.toContain('executor-2-low');
    expect(existsSync(join(f.bench, 'wt'))).toBe(false);
    expect(readFileSync(join(f.bench, 'round-1.json'), 'utf8')).not.toContain('worktrees');
  } finally {
    rmSync(tmp, { recursive: true, force: true, maxRetries: 5 });
  }
}, 120_000);

it('risk:data-loss --rerun keeps a commit made on a detached HEAD and refuses over uncommitted changes, changing nothing', async () => {
  const { prepareWorktree, rerunWorktree } = await bench();
  const tmp = realpathSync.native(mkdtempSync(join(tmpdir(), 'bench-')));
  const t = tmp.replaceAll('\\', '/');
  try {
    const { repo, git, H1 } = twoCommitRepo(t);
    const state = { worktrees: {} as Record<string, Setup & { preparedAt?: number }> };
    const dir = t + '/wt';
    prepareWorktree(repo, state, 'x', { path: dir, base: H1, branch: 'bench/x-1-low' }, () => {});

    // uncommitted work: refuse, nothing changed
    writeFileSync(dir + '/dirty.txt', 'mine\n');
    expect(() => rerunWorktree(repo, state, 'x')).toThrow('uncommitted');
    expect(existsSync(dir + '/dirty.txt')).toBe(true);
    expect(state.worktrees.x).toBeDefined();
    expect(git(repo, 'for-each-ref', 'refs/keep')).toBe('');
    rmSync(dir + '/dirty.txt');

    // a commit on a detached HEAD, the branch still at base
    git(dir, 'checkout', '-q', '--detach');
    const E = runCommit(git, dir);
    expect(git(repo, 'rev-parse', 'refs/heads/bench/x-1-low')).toBe(H1);
    expect(rerunWorktree(repo, state, 'x')).toBe('refs/keep/bench/x-1-low/1');
    expect(existsSync(dir)).toBe(false);
    expect(git(repo, 'rev-parse', 'refs/keep/bench/x-1-low/1')).toBe(E);
  } finally {
    rmSync(tmp, { recursive: true, force: true, maxRetries: 5 });
  }
}, 120_000);

it('risk:data-loss --rerun with a HEAD that is neither base nor branch tip keeps both under different refs, and a folder whose HEAD cannot be read changes nothing', async () => {
  const { prepareWorktree, rerunWorktree } = await bench();
  const tmp = realpathSync.native(mkdtempSync(join(tmpdir(), 'bench-')));
  const t = tmp.replaceAll('\\', '/');
  try {
    const { repo, git, H1 } = twoCommitRepo(t);
    const state = { worktrees: {} as Record<string, Setup & { preparedAt?: number }> };
    const dir = t + '/wt';
    prepareWorktree(repo, state, 'x', { path: dir, base: H1, branch: 'bench/x-1-low' }, () => {});
    const E = runCommit(git, dir);
    git(dir, 'checkout', '-q', '--detach');
    writeFileSync(dir + '/other.txt', 'other\n');
    git(dir, 'add', '.');
    git(dir, 'commit', '-q', '-m', 'detached');
    const F = git(dir, 'rev-parse', 'HEAD');
    expect(F).not.toBe(E);
    expect(rerunWorktree(repo, state, 'x')).toBe('refs/keep/bench/x-1-low/1, refs/keep/bench/x-1-low/2');
    const kept = [1, 2].map((n) => git(repo, 'rev-parse', `refs/keep/bench/x-1-low/${n}`));
    expect([...kept].sort()).toEqual([E, F].sort());

    // a partly removed folder: the HEAD cannot be read, so nothing is removed, kept or forgotten
    prepareWorktree(repo, state, 'x', { path: dir, base: H1, branch: 'bench/x-1-low' }, () => {});
    const E2 = runCommit(git, dir);
    const record = JSON.stringify(state.worktrees.x);
    rmSync(dir + '/.git', { force: true });
    expect(() => rerunWorktree(repo, state, 'x')).toThrow('cannot be read');
    expect(git(repo, 'rev-parse', 'refs/heads/bench/x-1-low')).toBe(E2);
    expect(JSON.stringify(state.worktrees.x)).toBe(record);
    expect(git(repo, 'for-each-ref', 'refs/keep')).not.toContain('/3');
  } finally {
    rmSync(tmp, { recursive: true, force: true, maxRetries: 5 });
  }
}, 120_000);

it('risk:regression --plan --rerun keeps and rebuilds the named tag alone, before it prepares its worktree', () => {
  const tmp = realpathSync.native(mkdtempSync(join(tmpdir(), 'bench-')));
  try {
    const f = samplesFixture(tmp);
    for (const s of f.list.samples) writeFileSync(join(f.dirOf(s), 'root-reads.json'), '[]');
    const rows = [{ tag: 'executor-1-medium', agent: 'accord-executor' }, { tag: 'executor-2-medium', agent: 'accord-executor' }];
    writeFileSync(join(f.bench, 'round-1.json'), JSON.stringify({ rows }));
    // the first plan stops after the worktrees are made (the suite is red in the fixture), which is enough
    mkdirSync(join(f.repo, 'accord'));
    writeFileSync(join(f.repo, 'accord', 'config.yml'), 'setup: []\ntests:\n  full: node -e "process.exit(1)"\n  report: r.xml\n');
    f.cmd('--plan');
    const wt = (tag: string) => join(f.bench, 'wt', tag).replaceAll('\\', '/');
    const g = (cwd: string, ...a: string[]) => execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', '-c', 'commit.gpgsign=false', ...a], { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
    const commits: Record<string, string> = {};
    for (const r of rows) { expect(existsSync(wt(r.tag))).toBe(true); commits[r.tag] = runCommit(g, wt(r.tag)); }
    const out = f.cmd('--plan', '--rerun', 'executor-1-medium');
    expect(out.stdout).toContain('kept executor-1-medium');
    // the named tag: kept, rebuilt clean at base; the other keeps its commit in its worktree
    expect(g(f.repo, 'rev-parse', 'refs/keep/bench/executor-1-medium/1')).toBe(commits['executor-1-medium']);
    expect(existsSync(wt('executor-1-medium') + '/run.txt')).toBe(false);
    expect(existsSync(wt('executor-2-medium') + '/run.txt')).toBe(true);
    expect(g(f.repo, 'for-each-ref', 'refs/keep')).not.toContain('executor-2-medium');
  } finally {
    rmSync(tmp, { recursive: true, force: true, maxRetries: 5 });
  }
}, 180_000);

it('risk:regression a recorded worktree prepared without the report flag is rebuilt for a verifier row', async () => {
  const { prepareWorktree } = await bench();
  const tmp = realpathSync.native(mkdtempSync(join(tmpdir(), 'bench-')));
  const t = tmp.replaceAll('\\', '/');
  try {
    const { repo, H1 } = twoCommitRepo(t);
    const state = { worktrees: {} as Record<string, Setup & { preparedAt?: number; report?: boolean }> };
    const spec = { path: t + '/wt', base: H1 };
    prepareWorktree(repo, state, 'v', spec, () => {});
    const first = state.worktrees.v.preparedAt!;
    expect(state.worktrees.v.report).toBeUndefined();
    await new Promise((r) => setTimeout(r, 20));
    prepareWorktree(repo, state, 'v', { ...spec, report: true }, () => {});
    expect(state.worktrees.v.report).toBe(true);
    expect(state.worktrees.v.preparedAt!).toBeGreaterThan(first);
    const second = state.worktrees.v.preparedAt!;
    prepareWorktree(repo, state, 'v', { ...spec, report: true }, () => {});
    expect(state.worktrees.v.preparedAt).toBe(second);
  } finally {
    rmSync(tmp, { recursive: true, force: true, maxRetries: 5 });
  }
}, 120_000);

// On Windows `git worktree remove` exits 0 but leaves directory junctions (what `npm ci` makes for workspaces) and the folders above them; on POSIX git removes symlinks too, so this passes there without the extra removal.
it('risk:regression a rebuild and a --rerun and --clean remove a worktree whose node_modules holds workspace junctions and leave no folder and keep the outside target of a junction', async () => {
  const b = (await import(new URL('../../../scripts/benchmark.mjs', import.meta.url).href)) as {
    prepareWorktree: (repo: string, state: { worktrees: Record<string, Rec> }, key: string, spec: { path: string; base: string; branch?: string }, setup: (d: string) => void) => string;
    rerunWorktree: (repo: string, state: { worktrees: Record<string, Rec> }, key: string) => string | null;
    cleanWorktrees: (repo: string, o?: { force?: boolean }) => Clean;
  };
  const tmp = realpathSync.native(mkdtempSync(join(tmpdir(), 'bench-')));
  const t = tmp.replaceAll('\\', '/');
  try {
    const repo = t + '/repo';
    mkdirSync(repo + '/packages/x', { recursive: true });
    mkdirSync(repo + '/docs/benchmark', { recursive: true });
    writeFileSync(repo + '/packages/x/a.txt', 'a\n');
    writeFileSync(repo + '/docs/benchmark/round-1.md', 'report\n');
    writeFileSync(repo + '/.gitignore', 'node_modules\n');
    const git = (...a: string[]) => execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', ...a], { cwd: repo, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
    git('init', '-q', '-b', 'main');
    git('add', '.');
    git('commit', '-q', '-m', 'one');
    const H1 = git('rev-parse', 'HEAD');
    writeFileSync(repo + '/packages/x/b.txt', 'b\n');
    git('add', '.');
    git('commit', '-q', '-m', 'two');
    const H2 = git('rev-parse', 'HEAD');
    const outside = t + '/outside';
    mkdirSync(outside);
    writeFileSync(outside + '/keep.txt', 'keep\n');
    const setup = (d: string) => {
      mkdirSync(d + '/node_modules/@x', { recursive: true });
      symlinkSync(d + '/packages/x', d + '/node_modules/@x/x', 'junction');
      symlinkSync(outside, d + '/node_modules/@x/out', 'junction');
    };
    const gone = (p: string) => { try { lstatSync(p); return false; } catch { return true; } };
    const state = { worktrees: {} as Record<string, Rec> };
    const wt = t + '/wt/e';
    b.prepareWorktree(repo, state, 'e', { path: wt, base: H1, branch: 'bench/e' }, setup);
    b.prepareWorktree(repo, state, 'e', { path: wt, base: H2, branch: 'bench/e' }, setup);
    b.rerunWorktree(repo, state, 'e');
    b.prepareWorktree(repo, state, 'e', { path: wt, base: H2, branch: 'bench/e' }, setup);
    expect(b.cleanWorktrees(repo).failed).toEqual([]);
    expect(gone(wt)).toBe(true);
    expect(existsSync(outside + '/keep.txt')).toBe(true);
  } finally {
    rmSync(tmp, { recursive: true, force: true, maxRetries: 5 });
  }
}, 120_000);

it('risk:regression --plan exits 2 naming tests.report when a verifier sample base config has none', () => {
  const tmp = realpathSync.native(mkdtempSync(join(tmpdir(), 'bench-')));
  try {
    const f = planFixture(tmp, 0, 0);
    const r = f.plan();
    expect(r.status).toBe(2);
    expect(r.stderr).toMatch(/verifier \d.*tests\.report/);
    expect(r.stderr).not.toContain('ERR_INVALID_ARG_TYPE');
  } finally {
    rmSync(tmp, { recursive: true, force: true, maxRetries: 5 });
  }
}, 180_000);

it('risk:regression two --plan runs run tests.full once per verifier sample and its effort rows share the report', () => {
  const tmp = realpathSync.native(mkdtempSync(join(tmpdir(), 'bench-')));
  try {
    const log = join(tmp, 'verifier-runs.txt').replaceAll('\\', '/');
    const script = `const fs=require('fs');if(/verifier/.test(process.cwd()))fs.appendFileSync(${JSON.stringify(log)},process.cwd()+'\\n');fs.mkdirSync('node_modules/.cache/accord',{recursive:true});fs.writeFileSync('${REPORT}','<testsuites/>');
`;
    const f = planFixture(tmp, 0, 0, { script, config: reportConfig });
    // The fixture repository has no ticket files, so --plan stops after the report step; what it did up to there is what is counted.
    f.plan();
    f.plan();
    const dirs = verifierDirs(f.bench);
    expect(dirs.length).toBeGreaterThan(0);
    expect(readFileSync(log, 'utf8').split(/\r?\n/).filter(Boolean)).toHaveLength(new Set(dirs.map((d) => d.split('-')[1])).size);
    expect(dirs.length).toBeGreaterThan(new Set(dirs.map((d) => d.split('-')[1])).size);
    for (const d of dirs) expect(readFileSync(join(f.bench, 'wt', d, REPORT), 'utf8')).toBe('<testsuites/>');
  } finally {
    rmSync(tmp, { recursive: true, force: true, maxRetries: 5 });
  }
}, 240_000);

it('risk:data-loss a leftover folder holding a regular file is refused and the file survives, one holding only links is removed and a link target survives', async () => {
  const { removeLeftover } = (await import(new URL('../../../scripts/benchmark.mjs', import.meta.url).href)) as { removeLeftover: (dir: string) => void };
  const tmp = mkdtempSync(join(tmpdir(), 'bench-left-'));
  try {
    const outside = join(tmp, 'outside');
    mkdirSync(outside);
    writeFileSync(join(outside, 'keep.txt'), 'x');
    const top = join(tmp, 'top');
    mkdirSync(top);
    writeFileSync(join(top, 'a.txt'), 'x');
    expect(() => removeLeftover(top)).toThrow(/still holds files/);
    expect(existsSync(join(top, 'a.txt'))).toBe(true);
    const nested = join(tmp, 'nested');
    mkdirSync(join(nested, 'plain'), { recursive: true });
    writeFileSync(join(nested, 'plain', 'b.txt'), 'x');
    expect(() => removeLeftover(nested)).toThrow(/still holds files/);
    expect(existsSync(join(nested, 'plain', 'b.txt'))).toBe(true);
    const links = join(tmp, 'links');
    mkdirSync(join(links, 'node_modules', '@x'), { recursive: true });
    symlinkSync(outside, join(links, 'node_modules', '@x', 'out'), 'junction');
    removeLeftover(links);
    expect(existsSync(links)).toBe(false);
    expect(existsSync(join(outside, 'keep.txt'))).toBe(true);
  } finally {
    rmSync(tmp, { recursive: true, force: true, maxRetries: 5 });
  }
});

it('risk:regression the --plan hint says setup is repeated for a setup failure and says look, then --clean or --rerun for a refusal', async () => {
  const { planHint, addWorktree } = (await import(new URL('../../../scripts/benchmark.mjs', import.meta.url).href)) as {
    planHint: (e: unknown) => string;
    addWorktree: (repo: string, spec: { path: string; base: string }) => unknown;
  };
  expect(planHint(new Error('npm ci exited 1'))).toBe('(setup is repeated on the next --plan run)');
  const tmp = mkdtempSync(join(tmpdir(), 'bench-hint-'));
  try {
    let caught: unknown;
    try { addWorktree(tmp, { path: tmp, base: 'HEAD' }); } catch (e) { caught = e; }
    const hint = planHint(caught);
    expect(hint).toContain('look at it, then run --clean or --rerun');
    expect(hint).toContain('deleted by hand after checking it holds only links');
    expect(hint).not.toContain('setup is repeated');
  } finally {
    rmSync(tmp, { recursive: true, force: true, maxRetries: 5 });
  }
});
