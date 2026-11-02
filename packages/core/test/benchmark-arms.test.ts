import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, it } from 'vitest';

const root = fileURLToPath(new URL('../../../', import.meta.url));

type Arm = { model: string; effort: string };
type Def = { agent: string; arms: Arm[]; runs: number; judges: number; prices: Record<string, number>; pricesAt: string; samples: number[] };
type Row = { tag: string; agent: string; n: number; ticket: string; model: string; effort: string; k: number; judge: null; prompt?: string };
type Round = {
  armMatrix: (def: Def, samples: { agent: string; n: number; ticket: string }[]) => Row[];
  armTag: (agent: string, n: number, model: string, effort: string, k: number) => string;
  checkRound: (name: string, def: unknown) => string[];
  dispatchTable: (rows: Row[], name?: string) => string;
  describe: (tag: string, name?: string) => string;
};
const roundMod = async () => (await import(new URL('../../../scripts/round.mjs', import.meta.url).href)) as Round;

const SIX: Arm[] = ['haiku', 'sonnet'].flatMap((model) => ['low', 'medium', 'high'].map((effort) => ({ model, effort })));

// A repository `<t>/repo` with a base commit B, two tickets merged into main (T-1 changes a.txt, T-9 adds its ticket file
// and changes a.txt), a linked worktree `<t>/sub/linked` at B, and the sample and round files the script reads. Task 7
// reuses this builder.
function armsFixture(t: string) {
  const repo = t + '/repo';
  mkdirSync(repo, { recursive: true });
  const git = (cwd: string, ...a: string[]) =>
    execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@example.invalid', '-c', 'commit.gpgsign=false', ...a], { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  const msg = (text: string) => { writeFileSync(t + '/msg.txt', text); return t + '/msg.txt'; };
  const commit = (cwd: string, text: string) => git(cwd, 'commit', '-q', '--no-verify', '-F', msg(text), '--cleanup=verbatim');
  git(repo, 'init', '-q', '-b', 'main');
  mkdirSync(repo + '/accord/tickets', { recursive: true });
  writeFileSync(repo + '/a.txt', 'a\nb\nc\nd\ne\nf\ng\n');
  writeFileSync(repo + '/accord/config.yml', 'setup: []\n');
  writeFileSync(repo + '/accord/tickets/T-1.md', '---\nid: "T-1"\n---\n\n## Intent\nx\n');
  git(repo, 'add', '.');
  commit(repo, 'base');
  const B = git(repo, 'rev-parse', 'HEAD');
  git(repo, 'checkout', '-q', '-b', 't/T-1');
  writeFileSync(repo + '/a.txt', 'A\nb\nc\nd\ne\nf\ng\n');
  git(repo, 'commit', '-q', '-a', '--no-verify', '-F', msg('T-1 work'), '--cleanup=verbatim');
  git(repo, 'checkout', '-q', 'main');
  git(repo, 'merge', '--no-ff', '-q', '-F', msg("Merge branch 't/T-1'"), '--cleanup=verbatim', 't/T-1');
  git(repo, 'checkout', '-q', '-b', 't/T-9', B);
  writeFileSync(repo + '/accord/tickets/T-9.md', '---\nid: "T-9"\n---\n\n## Intent\ny\n');
  writeFileSync(repo + '/a.txt', 'a\nb\nc\nd\ne\nf\nG\n');
  git(repo, 'add', '.');
  commit(repo, 'T-9 work');
  git(repo, 'checkout', '-q', 'main');
  git(repo, 'merge', '--no-ff', '-q', '-F', msg("Merge branch 't/T-9'"), '--cleanup=verbatim', 't/T-9');
  const linked = t + '/sub/linked';
  git(repo, 'worktree', 'add', '-q', '--detach', linked, B);
  const bench = t + '/accord-bench';
  const transcript = (n: number) => `C--x/S/subagents/agent-${n}.jsonl`;
  const sample = (n: number, ticket: string) => ({ agent: 'accord-scout', n, transcript: transcript(n), ticket, base: B, main: B, root: t + '/orig', elsewhere: [], files: [], pairs: [] });
  const def = (samples: number[]) => ({ agent: 'accord-scout', arms: [{ model: 'haiku', effort: 'low' }, { model: 'sonnet', effort: 'low' }], runs: 2, judges: 0, prices: { haiku: 1, sonnet: 3 }, pricesAt: '2026-11-02', samples });
  const writeFiles = (dir: string) => {
    mkdirSync(dir + '/scripts', { recursive: true });
    writeFileSync(dir + '/scripts/benchmark-samples.json', JSON.stringify({ round: 1, samples: [sample(1, 'T-1'), sample(2, 'T-1'), sample(3, 'T-9')] }));
    writeFileSync(dir + '/scripts/benchmark-rounds.json', JSON.stringify({ rounds: { 'r9-test': def([1, 2, 3]), 'r9-none': def([2]) } }));
  };
  writeFiles(repo);
  writeFiles(linked);
  for (const n of [1, 3]) {
    const dir = `${bench}/samples/scout-${n}`;
    mkdirSync(dir, { recursive: true });
    writeFileSync(dir + '/sample.json', JSON.stringify({ transcript: transcript(n), prompt: `Scout ${t}/orig for T-1.`, cwd: t + '/orig', ts: 0, reads: {} }));
    writeFileSync(dir + '/root-reads.json', '[]');
  }
  const home = t + '/home';
  mkdirSync(home, { recursive: true });
  const cmd = (cwd: string, ...args: string[]) => {
    const r = spawnSync(process.execPath, [join(root, 'scripts', 'benchmark.mjs'), ...args], { cwd, encoding: 'utf8', env: { ...process.env, HOME: home, USERPROFILE: home } });
    return { status: r.status, stdout: r.stdout, stderr: r.stderr };
  };
  return { repo, linked, bench, B, git, cmd };
}

it('ac-1 a round plan lists every sample three times for each model and effort arm and a round for another agent is planned the same way', async () => {
  const round = await roundMod();
  const rounds = JSON.parse(readFileSync(join(root, 'scripts', 'benchmark-rounds.json'), 'utf8')).rounds as Record<string, Def>;
  const r2 = rounds['r2-scout'];
  expect(r2.agent).toBe('accord-scout');
  expect(r2.arms).toEqual(SIX);
  expect(r2.runs).toBe(3);

  const samples = [1, 2, 4].map((n) => ({ agent: 'accord-scout', n, ticket: 'T-' + n }));
  const rows = round.armMatrix({ ...r2, samples: [1, 2, 4] }, samples);
  expect(rows).toHaveLength(54);
  for (const s of samples) {
    for (const arm of SIX) {
      const own = rows.filter((r) => r.n === s.n && r.model === arm.model && r.effort === arm.effort);
      expect(own.map((r) => r.k)).toEqual([1, 2, 3]);
      expect(own.every((r) => r.agent === 'accord-scout' && r.ticket === s.ticket && r.judge === null && !('current' in r))).toBe(true);
      expect(own.map((r) => r.tag)).toEqual([1, 2, 3].map((k) => `scout-${s.n}-${arm.model}-${arm.effort}-${k}`));
    }
  }
  expect(rows.map((r) => r.n)).toEqual([...rows.map((r) => r.n)].sort((a, b) => a - b));
  const table = round.dispatchTable(rows.map((r) => ({ ...r, prompt: 'p' })), 'r2-scout');
  expect(table.split('\n')).toContain('| bench r2-scout scout-4-sonnet-high-3 | accord-scout | sonnet | high | p | - |');

  const exec: Def = {
    agent: 'accord-executor', arms: [{ model: 'sonnet', effort: 'high' }, { model: 'opus', effort: 'medium' }], runs: 2, judges: 0,
    prices: { sonnet: 3, opus: 5 }, pricesAt: '2026-11-02', samples: [7],
  };
  expect(round.checkRound('r3-exec', exec)).toEqual([]);
  const erows = round.armMatrix(exec, [{ agent: 'accord-executor', n: 7, ticket: 'T-7' }]);
  expect(erows.map((r) => r.tag)).toEqual(['executor-7-sonnet-high-1', 'executor-7-sonnet-high-2', 'executor-7-opus-medium-1', 'executor-7-opus-medium-2']);
  const etable = round.dispatchTable(erows.map((r) => ({ ...r, prompt: 'q' })), 'r3-exec').split('\n');
  expect(etable).toContain('| bench r3-exec executor-7-opus-medium-2 | accord-executor | opus | medium | q | - |');
  expect(etable).toContain('| bench r3-exec executor-7-sonnet-high-1 | accord-executor | sonnet | high | q | - |');
  expect(round.describe('scout-1-low')).toBe('bench r1 scout-1-low');
  expect(round.armTag('accord-scout', 4, 'sonnet', 'high', 3)).toBe('scout-4-sonnet-high-3');
});

it('risk:parsing a round definition with a bad name or agent or arm or price or run count or sample list is refused', async () => {
  const round = await roundMod();
  const good: Def = {
    agent: 'accord-scout', arms: [{ model: 'haiku', effort: 'low' }, { model: 'sonnet', effort: 'high' }], runs: 3, judges: 0,
    prices: { haiku: 1, sonnet: 3 }, pricesAt: '2026-11-02', samples: [1, 2],
  };
  expect(round.checkRound('r2-scout', good)).toEqual([]);
  const only = (name: string, def: unknown, want: string) => expect(round.checkRound(name, def)).toEqual([want]);
  only('r1', good, 'round name r1 must match r[a-z0-9-]+ and not be r1');
  only('x2', good, 'round name x2 must match r[a-z0-9-]+ and not be r1');
  only('r2-scout', { ...good, agent: 'accord-debugger' }, 'agent accord-debugger is not a benchmark agent');
  only('r2-scout', { ...good, agent: 'accord-architect' }, 'agent accord-architect is not a benchmark agent');
  only('r2-scout', { ...good, arms: [good.arms[0], { model: 'sonnet', effort: 'ultra' }] }, 'arm 2: effort ultra is not one of low, medium, high, xhigh, max');
  only('r2-scout', { ...good, arms: [{ model: 'hai ku', effort: 'low' }, good.arms[1]] }, 'arm 1: model hai ku is not a model name');
  only('r2-scout', { ...good, arms: [good.arms[0], good.arms[1], { model: 'haiku', effort: 'low' }] }, 'arm haiku low is listed twice');
  for (const price of [undefined, 0, -1, '3']) {
    const prices: Record<string, unknown> = { haiku: 1, sonnet: price };
    only('r2-scout', { ...good, prices }, 'model sonnet has no positive price in prices');
  }
  for (const at of ['', '2026-11', '11/02/2026', '2026-13-45']) only('r2-scout', { ...good, pricesAt: at }, 'pricesAt must be a date YYYY-MM-DD');
  for (const runs of [0, 1.5]) only('r2-scout', { ...good, runs }, 'runs must be a whole number of at least 1');
  only('r2-scout', { ...good, judges: -1 }, 'judges must be a whole number of at least 0');
  for (const samples of [[0, 1], [1, 1], [1.5], 'all', [1, '2']]) only('r2-scout', { ...good, samples }, 'samples must be a list of distinct whole numbers of at least 1');
});

it('risk:complex-branching a named plan run from a linked worktree uses the main checkout bench root and leaves out a sample that fails a step', () => {
  const tmp = realpathSync.native(mkdtempSync(join(tmpdir(), 'bench-')));
  const t = tmp.replaceAll('\\', '/');
  try {
    const f = armsFixture(t);
    const out = f.cmd(f.linked, '--round', 'r9-test', '--plan');
    expect(out.stderr).not.toContain('does not parse');
    expect(out.status).toBe(0);
    const lines = out.stdout.split('\n');
    expect(lines[0]).toBe(`bench root: ${t}/accord-bench`);
    expect(out.stdout).not.toContain(`${t}/sub/accord-bench`);
    expect(lines).toContain(`left out: accord-scout 2: no snapshot under ${t}/accord-bench`);
    const rows = lines.filter((l) => l.startsWith('| bench r9-test '));
    expect(rows).toHaveLength(8);
    expect(rows).toContain(`| bench r9-test scout-3-sonnet-low-2 | accord-scout | sonnet | low | ${t}/accord-bench/briefs/r9-test/scout-3-sonnet-low-2.md | - |`);
    expect(rows.some((l) => l.includes(' scout-2-'))).toBe(false);

    const brief = (n: number) => readFileSync(`${t}/accord-bench/briefs/r9-test/scout-${n}-haiku-low-1.md`, 'utf8');
    expect(brief(1)).toContain(`${t}/accord-bench/wt/r9-test/scout-1`);
    expect(brief(1)).not.toContain(`${t}/orig`);
    // The lane-style sample: its ticket does not exist at B, and its brief is written anyway.
    expect(brief(3)).toContain(`${t}/accord-bench/wt/r9-test/scout-3`);
    expect(f.git(`${t}/accord-bench/wt/r9-test/scout-1`, 'rev-parse', 'HEAD')).toBe(f.B);

    const stateFile = `${t}/accord-bench/round-r9-test.json`;
    const state = JSON.parse(readFileSync(stateFile, 'utf8')) as { rows: unknown[]; leftOut: Record<string, string> };
    expect(state.rows).toHaveLength(8);
    expect(state.leftOut['2']).toBe(`no snapshot under ${t}/accord-bench`);
    expect(readdirSync(`${t}/accord-bench`).filter((n) => n.endsWith('.tmp'))).toEqual([]);

    // A worktree removed by hand (as after --clean --force) is built again at base.
    f.git(f.repo, 'worktree', 'remove', '--force', `${t}/accord-bench/wt/r9-test/scout-1`);
    expect(existsSync(`${t}/accord-bench/wt/r9-test/scout-1`)).toBe(false);
    const again = f.cmd(f.linked, '--round', 'r9-test', '--plan');
    expect(again.status).toBe(0);
    expect(f.git(`${t}/accord-bench/wt/r9-test/scout-1`, 'rev-parse', 'HEAD')).toBe(f.B);

    writeFileSync(stateFile, '{"rows": [');
    const broken = f.cmd(f.linked, '--round', 'r9-test', '--plan');
    expect(broken.status).toBe(2);
    expect(broken.stderr).toContain('does not parse');
    expect(readFileSync(stateFile, 'utf8')).toBe('{"rows": [');

    const none = f.cmd(f.linked, '--round', 'r9-none', '--plan');
    expect(none.status).toBe(2);
    expect(none.stderr).toContain('no sample left');
  } finally {
    rmSync(tmp, { recursive: true, force: true, maxRetries: 5 });
  }
}, 120_000);
