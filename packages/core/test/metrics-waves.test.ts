// ST-LN-92 D-02: after the release, the first ticket built in waves reports its wall time against its summed per-task time, both
// read from commit times. A task's end is its last commit's author time (a rebase at its merge rewrites the committer time and keeps
// the author time); the plan and records commits are never rebased, so their committer times bound the wall time. A report, not a gate.
import { spawnSync, execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, it } from 'vitest';

type Commit = { sha: string; parents: string[]; authorTime: number; commitTime: number; files: string[] };
type WaveTime = { tasks: { n: number; seconds: number }[]; wall: number; summed: number; ratio: number | null };
type Count = { waveTime: (input: { id: string; commits: Commit[]; done: Record<string, string> }) => WaveTime };
const load = async () => (await import(new URL('../../../scripts/metrics-count.mjs', import.meta.url).href)) as Count;
const script = fileURLToPath(new URL('../../../scripts/metrics.mjs', import.meta.url));
const repoRoot = fileURLToPath(new URL('../../../', import.meta.url));

const PLAN = 'accord/tickets/T-1/plan.md';
const LEDGER = 'accord/tickets/T-1/ledger.md';
const TICKET = 'accord/tickets/T-1.md';
const c = (sha: string, authorTime: number, commitTime: number, files: string[], parents = ['p']): Commit => ({ sha, parents, authorTime, commitTime, files });

// Tasks 2 and 3 start together after the plan commit at 0 and are merged in task order (task 3 rebased at its merge, so its
// committer times are 1005, its author times 850 and 900); task 4 starts after task 3's ledger commit at 1010.
const wave = (): Commit[] => [
  c('a0', 0, 0, [PLAN]),
  c('a2', 600, 1000, ['src/b.ts']),
  c('l2', 1000, 1000, [LEDGER, TICKET]),
  c('a3', 850, 1005, ['src/c.ts']),
  c('b3', 900, 1005, ['src/c.ts', 'src/c.test.ts']),
  c('l3', 1010, 1010, [LEDGER, TICKET]),
  c('a4', 1500, 1500, ['src/d.ts']),
  c('l4', 1600, 1600, [LEDGER]),
];
const WAVE_DONE = { '2': 'a2', '3': 'b3', '4': 'a4' };

it('risk:calculation wave time sums each task from its wave\'s start and compares it with the wall time (ST-LN-92 D-02)', async () => {
  const { waveTime } = await load();
  const parallel = waveTime({ id: 'T-1', commits: wave(), done: WAVE_DONE });
  expect(parallel).toEqual({ tasks: [{ n: 2, seconds: 600 }, { n: 3, seconds: 900 }, { n: 4, seconds: 490 }], wall: 1600, summed: 1990, ratio: 1.24 });

  // Sequential: each task's first commit comes after the previous task's ledger commit.
  const sequential = waveTime({
    id: 'T-1',
    commits: [c('a0', 0, 0, [PLAN]), c('a1', 100, 100, ['src/a.ts']), c('l1', 110, 110, [LEDGER]), c('a2', 300, 300, ['src/b.ts']), c('l2', 320, 320, [LEDGER, TICKET])],
    done: { '1': 'a1', '2': 'a2' },
  });
  expect(sequential).toEqual({ tasks: [{ n: 1, seconds: 100 }, { n: 2, seconds: 190 }], wall: 320, summed: 290, ratio: 0.91 });
  expect(sequential.ratio).toBeLessThanOrEqual(1);

  // A merge of the default branch inside the range is skipped: it is neither a task's commit nor a records commit.
  const merged = wave();
  merged.splice(3, 0, c('m1', 950, 1003, ['README.md', LEDGER], ['l2', 'main']));
  expect(waveTime({ id: 'T-1', commits: merged, done: WAVE_DONE })).toEqual(parallel);

  // Rebased: both tasks built from 0 and merged at 2000; committer times would read task 2 as 1 second long.
  const rebased = waveTime({
    id: 'T-1',
    commits: [c('a0', 0, 0, [PLAN]), c('a1', 200, 2000, ['src/a.ts']), c('l1', 2000, 2000, [LEDGER]), c('a2', 300, 2001, ['src/b.ts']), c('l2', 2010, 2010, [LEDGER])],
    done: { '1': 'a1', '2': 'a2' },
  });
  expect(rebased.tasks).toEqual([{ n: 1, seconds: 200 }, { n: 2, seconds: 300 }]);
  expect(rebased.tasks).not.toEqual([{ n: 1, seconds: 2000 }, { n: 2, seconds: 1 }]);
  expect(rebased).toMatchObject({ wall: 2010, summed: 500, ratio: 0.25 });

  // An abbreviated ledger sha (task-done writes 12 characters) names the same commit.
  expect(waveTime({ id: 'T-1', commits: wave().map((x) => ({ ...x, sha: x.sha + '0000000000' })), done: { '2': 'a20000', '3': 'b30000', '4': 'a40000' } })).toEqual(parallel);
});

// A throwaway repository in the OS temp folder; git never runs anywhere else (the guard of packages/cli/test/helpers/repo.ts).
function sandbox() {
  const root = realpathSync.native(mkdtempSync(join(tmpdir(), 'metrics-waves-')));
  if (!root.startsWith(realpathSync.native(tmpdir()))) throw new Error('refusing to run git outside a temporary sandbox: ' + root);
  const git = (env: NodeJS.ProcessEnv, ...args: string[]) =>
    execFileSync('git', ['-c', 'user.email=fixture@example.invalid', '-c', 'user.name=fixture', '-c', 'commit.gpgsign=false', ...args], {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, ...env },
    });
  git({}, 'init', '-q', '--initial-branch=main');
  const write = (files: Record<string, string>) => {
    for (const [rel, text] of Object.entries(files)) {
      const abs = join(root, ...rel.split('/'));
      mkdirSync(dirname(abs), { recursive: true });
      writeFileSync(abs, text);
    }
  };
  const at = (s: number) => new Date(Date.UTC(2026, 0, 1) + s * 1000).toISOString();
  // A task's rebase keeps its author time and moves its committer time, so the two are set apart.
  const commit = (message: string, author: number, committer = author): string => {
    git({ GIT_AUTHOR_DATE: at(author), GIT_COMMITTER_DATE: at(committer) }, 'add', '-A');
    git({ GIT_AUTHOR_DATE: at(author), GIT_COMMITTER_DATE: at(committer) }, 'commit', '-q', '--no-verify', '-m', message);
    return git({}, 'rev-parse', 'HEAD').trim();
  };
  return { root, git, write, at, commit };
}

/** A ticket branch: claim, plan, task 1, its ledger commit, a merge of main, task 2 (rebased at its merge), its ledger commit. */
function ticketBranch() {
  const s = sandbox();
  s.write({ 'README.md': 'one\n' });
  s.commit('base', 0);
  s.git({}, 'checkout', '-q', '-b', 't/T-1');
  s.write({ [TICKET]: '---\nid: T-1\n---\n' });
  s.commit('claim: T-1', 10);
  s.write({ [PLAN]: '# Plan\n\n## Task 1: a\n\n## Task 2: b\n' });
  s.commit('plan: T-1', 100);
  s.write({ 'src/a.ts': 'export const a = 1;\n' });
  const t1 = s.commit('feat: task 1', 400);
  s.write({ [LEDGER]: `- task 1 done ${t1.slice(0, 12)}\n`, [TICKET]: '---\nid: T-1\n---\n@test:a\n' });
  s.commit('records: task 1 done', 500);
  s.git({}, 'checkout', '-q', 'main');
  s.write({ 'README.md': 'two\n' });
  s.commit('main moves', 550);
  s.git({}, 'checkout', '-q', 't/T-1');
  s.git({ GIT_AUTHOR_DATE: s.at(600), GIT_COMMITTER_DATE: s.at(600) }, 'merge', '-q', '--no-ff', '--no-edit', 'main');
  s.write({ 'src/b.ts': 'export const b = 2;\n' });
  const t2 = s.commit('feat: task 2', 700, 900);
  s.write({ [LEDGER]: `- task 1 done ${t1.slice(0, 12)}\n- task 2 done ${t2.slice(0, 12)}\n` });
  s.commit('records: task 2 done', 1000);
  return s;
}

const run = (cwd: string, ...args: string[]) => spawnSync(process.execPath, [script, ...args], { cwd, encoding: 'utf8' });

it('risk:regression the wave-time report is a report, not a gate (ST-LN-92 D-02)', () => {
  const s = ticketBranch();
  try {
    // Summed 500 against a wall of 900: the wave was slower than one task after another, and the report still exits 0.
    const r = run(s.root, '--wave-time', 'T-1', '--stdout', '--json');
    expect(r.stderr).toBe('');
    expect(r.status).toBe(0);
    expect(JSON.parse(r.stdout).ratio).toBeLessThan(1);
  } finally {
    rmSync(s.root, { recursive: true, force: true, maxRetries: 5 });
  }
  // No accord command reads it: no source file names the script, and the published package ships no scripts folder.
  for (const pkg of ['core', 'cli']) {
    const src = join(repoRoot, 'packages', pkg, 'src');
    const naming = readdirSync(src, { recursive: true, withFileTypes: true })
      .filter((d) => d.isFile())
      .map((d) => join(d.parentPath, d.name))
      .filter((file) => readFileSync(file, 'utf8').includes('scripts/metrics'));
    expect(naming).toEqual([]);
  }
  const files = (JSON.parse(readFileSync(join(repoRoot, 'packages', 'cli', 'package.json'), 'utf8')) as { files?: string[] }).files ?? [];
  expect(files.filter((f) => /(^|\/)scripts(\/|$)/.test(f.replace(/^\.\//, '')))).toEqual([]);
});

it('risk:regression --wave-time reads a real ticket branch through git only (ST-LN-92 D-02)', () => {
  const s = ticketBranch();
  try {
    const json = run(s.root, '--wave-time', 'T-1', '--stdout', '--json');
    expect(json.stderr).toBe('');
    expect(json.status).toBe(0);
    const report = JSON.parse(json.stdout);
    // Task 1: 400 - 100 (the plan commit); task 2: 700 (its author time, not the 900 of its rebase) - 500 (task 1's ledger commit);
    // the wall from the plan commit at 100 to task 2's ledger commit at 1000. The merge of main at 600 is skipped.
    expect(report).toMatchObject({ id: 'T-1', tasks: [{ n: 1, seconds: 300 }, { n: 2, seconds: 200 }], wall: 900, summed: 500, ratio: 0.56 });
    expect(report.commit).toBe(s.git({}, 'rev-parse', 'HEAD').trim());

    const md = run(s.root, '--wave-time', 'T-1', '--stdout');
    expect(md.status).toBe(0);
    expect(md.stdout).toContain('| 1 | 300 |');
    expect(md.stdout).toContain('| 2 | 200 |');
    expect(md.stdout).toMatch(/wall: 900/);
    expect(md.stdout).toMatch(/summed: 500/);
    expect(md.stdout).toMatch(/ratio: 0\.56/);

    // --at reads the ledger and the history at that commit: before task 2's ledger commit only task 1 is recorded.
    const early = JSON.parse(run(s.root, '--wave-time', 'T-1', '--at', 'HEAD~1', '--stdout', '--json').stdout);
    expect(early).toMatchObject({ tasks: [{ n: 1, seconds: 300 }], wall: 400, summed: 300 });

    // An id outside the loader's pattern, or a ticket with no ledger, is a usage error, not a report.
    expect(run(s.root, '--wave-time', '../T-1', '--stdout').status).toBe(2);
    const none = run(s.root, '--wave-time', 'T-2', '--stdout');
    expect(none.status).toBe(2);
    expect(none.stderr).toMatch(/accord\/tickets\/T-2\/ledger\.md/);
  } finally {
    rmSync(s.root, { recursive: true, force: true, maxRetries: 5 });
  }
});
