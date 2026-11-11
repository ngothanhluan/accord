import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { expect, it } from 'vitest';

type Sink = { write: (s: string) => boolean };
type Metrics = { main: (argv: string[], io: { cwd: string; stdout: Sink; stderr: Sink }) => Promise<number> };
const load = async () => (await import(new URL('../../../scripts/metrics.mjs', import.meta.url).href)) as Metrics;

// A throwaway repository in the OS temp folder; git never runs anywhere else (the guard of packages/cli/test/helpers/repo.ts).
function sandbox(): { root: string; git: (env: NodeJS.ProcessEnv, ...args: string[]) => string } {
  const root = realpathSync.native(mkdtempSync(join(tmpdir(), 'metrics-')));
  if (!root.startsWith(realpathSync.native(tmpdir()))) throw new Error('refusing to run git outside a temporary sandbox: ' + root);
  const git = (env: NodeJS.ProcessEnv, ...args: string[]) =>
    execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, ...env } });
  git({}, 'init', '-q');
  return { root, git };
}

function write(root: string, files: Record<string, string>): void {
  for (const [rel, text] of Object.entries(files)) {
    const abs = join(root, ...rel.split('/'));
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, text);
  }
}

// conventions.md: the message goes through a file with --cleanup=verbatim, a fixture identity, no signing.
function commit(s: ReturnType<typeof sandbox>, message: string, date: string): string {
  const folder = mkdtempSync(join(tmpdir(), 'metrics-msg-'));
  try {
    const file = join(folder, 'msg.txt');
    writeFileSync(file, message + '\n');
    const env = { GIT_COMMITTER_DATE: date, GIT_AUTHOR_DATE: date };
    s.git(env, 'add', '-A');
    s.git(env, '-c', 'user.email=fixture@example.invalid', '-c', 'user.name=fixture', '-c', 'commit.gpgsign=false', 'commit', '-q', '--no-verify', '-F', file, '--cleanup=verbatim');
    return s.git({}, 'rev-parse', 'HEAD').trim();
  } finally {
    rmSync(folder, { recursive: true, force: true, maxRetries: 5 });
  }
}

const sink = () => {
  const out = { text: '', write: (s: string) => ((out.text += s), true) };
  return out;
};

const PLAN_REVIEW = ['## Round 1 (whole)', '1. Must — a — open', '2. Should — b — open', '3. Nice — c — deferred', '## Round 2 (diff)', 'No findings', ''].join('\n');
const APPROACH_REVIEW = ['## Round 1 (whole)', '1. Should — x — open', ''].join('\n');
const REVIEW = ['Round record: 2', '', '## Round 1 head 1111111', '', 'Must 1 [patch]: y — src/a.ts:1 — open', 'Nice 2 [patch]: z — src/a.ts:2 — deferred', ''].join('\n');

function twoCommits() {
  const s = sandbox();
  write(s.root, {
    'accord/tickets/T-1/plan-review.md': PLAN_REVIEW,
    'accord/tickets/T-1/approach-review.md': APPROACH_REVIEW,
    'accord/tickets/T-2/review.md': REVIEW,
    'accord/tickets/T-2/plan.md': '## Round 1 (whole)\n1. Must — not a record — open\n',
  });
  const first = commit(s, 'records', '2026-01-02T12:00:00+0000');
  write(s.root, { 'accord/tickets/T-1/plan-review.md': PLAN_REVIEW + '## Round 3 (diff)\n1. Must — later — open\n' });
  commit(s, 'later round', '2026-01-03T12:00:00+0000');
  return { s, first };
}

it('risk:regression the report is dated by the commit and counts every stage at that commit (ST-LN-95 ac-1)', async () => {
  const { main } = await load();
  const { s, first } = twoCommits();
  try {
    const stdout = sink();
    const stderr = sink();
    expect(await main(['--at', first, '--transcripts', 'none'], { cwd: s.root, stdout, stderr })).toBe(0);
    const md = readFileSync(join(s.root, 'docs', 'benchmark', 'metrics-2026-01-02.md'), 'utf8');
    const json = JSON.parse(readFileSync(join(s.root, 'docs', 'benchmark', 'metrics-2026-01-02.json'), 'utf8'));
    expect(md).toContain(first);
    expect(md).toContain('2026-01-02');
    expect(json.commit).toBe(first);
    expect(json.date).toBe('2026-01-02');
    const plan = json.stages.plan;
    expect(plan.cycles).toBe(1);
    expect(plan.byRound.map((r: { run: number; must: number; should: number; nice: number }) => [r.run, r.must, r.should, r.nice])).toEqual([
      [1, 1, 1, 1], [1, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0],
    ]);
    expect(json.stages.approach.cycles).toBe(1);
    expect(json.stages.approach.byRound[0]).toMatchObject({ round: '1', run: 1, must: 0, should: 1, nice: 0 });
    expect(json.stages.review.cycles).toBe(1);
    expect(json.stages.review.byRound[0]).toMatchObject({ round: '1', run: 1, must: 1, should: 0, nice: 1 });
    expect(md).toMatch(/^## Approach$/m);
    expect(md).toMatch(/^## Plan$/m);
    expect(md).toMatch(/^## Review$/m);
    expect(md).toContain('| Round | Rounds run | Must | Should | Nice | Must + Should per round |');
  } finally {
    rmSync(s.root, { recursive: true, force: true, maxRetries: 5 });
  }
}, 120_000);

it('risk:regression a second run on the same commit writes the same bytes (ST-LN-95 ac-3)', async () => {
  const { main } = await load();
  const { s, first } = twoCommits();
  try {
    const io = { cwd: s.root, stdout: sink(), stderr: sink() };
    const files = ['metrics-2026-01-02.md', 'metrics-2026-01-02.json'].map((f) => join(s.root, 'docs', 'benchmark', f));
    expect(await main(['--at', first, '--transcripts', 'none'], io)).toBe(0);
    const once = files.map((f) => readFileSync(f));
    expect(await main(['--at', first, '--transcripts', 'none'], io)).toBe(0);
    const twice = files.map((f) => readFileSync(f));
    expect(twice[0].equals(once[0])).toBe(true);
    expect(twice[1].equals(once[1])).toBe(true);
  } finally {
    rmSync(s.root, { recursive: true, force: true, maxRetries: 5 });
  }
}, 120_000);

it('risk:security the label cannot leave docs/benchmark (ST-LN-95 ac-4)', async () => {
  const { main } = await load();
  const { s, first } = twoCommits();
  try {
    for (const label of ['../x', 'a/b']) {
      const stderr = sink();
      expect(await main(['--at', first, '--transcripts', 'none', '--label', label], { cwd: s.root, stdout: sink(), stderr })).toBe(2);
      expect(stderr.text).toMatch(/usage/i);
    }
    expect(existsSync(join(s.root, 'docs'))).toBe(false);
  } finally {
    rmSync(s.root, { recursive: true, force: true, maxRetries: 5 });
  }
}, 120_000);
