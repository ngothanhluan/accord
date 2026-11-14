import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { basename, dirname, join } from 'node:path';
import { expect, it } from 'vitest';
import { CONFIG, laneTicket } from '../../../test/helpers/lane.js';

type Sink = { write: (s: string) => boolean };
type Metrics = {
  main: (argv: string[], io: { cwd: string; stdout: Sink; stderr: Sink }) => Promise<number>;
  projectPrefix: (path: string) => string;
};
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

// ---- critic and planner runs from Claude Code transcripts (95-ac-2) --------------------------------------
const jl = (...lines: unknown[]) => lines.map((l) => JSON.stringify(l)).join('\n') + '\n';
const MARKER = 'MARKER-PROMPT-7f3a';
const usage = (input: number, cacheRead: number, cacheWrite: number, output: number) => ({
  input_tokens: input, cache_read_input_tokens: cacheRead, cache_creation_input_tokens: cacheWrite, output_tokens: output,
});
const msg = (id: string, ts: string, u: unknown) => ({ type: 'assistant', timestamp: ts, message: { id, model: 'claude-opus-5-5', usage: u, content: [{ type: 'text', text: 'ok' }] } });

type Fixture = { id: string; agent: string; desc: string; prompt: string; lines: unknown[] };
/** One Claude Code project folder: a main session that dispatched each run, and each run's transcript and meta. */
function project(folder: string, session: string, runs: Fixture[]): void {
  const sub = join(folder, session, 'subagents');
  mkdirSync(sub, { recursive: true });
  writeFileSync(join(folder, `${session}.jsonl`), jl(...runs.map((r) => ({
    type: 'assistant', timestamp: '2026-01-01T00:00:00Z',
    message: { content: [{ type: 'tool_use', id: `toolu_${r.id}`, name: 'Agent', input: { description: r.desc, subagent_type: r.agent, prompt: r.prompt } }] },
  }))));
  for (const r of runs) {
    writeFileSync(join(sub, `agent-${r.id}.meta.json`), JSON.stringify({ agentType: r.agent, description: r.desc, toolUseId: `toolu_${r.id}` }));
    writeFileSync(join(sub, `agent-${r.id}.jsonl`), jl(...r.lines));
  }
}

/** The repository at commit time 2026-01-02T12:00:00Z with records for ST-LN-1 only, and a transcript folder of eight runs. */
async function withTranscripts() {
  const { projectPrefix } = await load();
  const s = sandbox();
  write(s.root, { 'accord/tickets/ST-LN-1/plan-review.md': PLAN_REVIEW, 'accord/tickets/ST-LN-1/plan.md': '# plan\n' });
  const sha = commit(s, 'records', '2026-01-02T12:00:00+0000');
  const projects = realpathSync.native(mkdtempSync(join(tmpdir(), 'metrics-projects-')));
  const prefix = projectPrefix(s.root);
  project(join(projects, prefix), 'S1', [
    // later plan critic: Mode diff; m1 is written twice, its usage read as the max per message id
    { id: 'c1', agent: 'accord-critic', desc: 'Critic ST-LN-1 plan round 2', prompt: `Mode: diff. ${MARKER} Read accord/tickets/ST-LN-1/plan-review.md`, lines: [
      msg('m1', '2026-01-02T10:00:00Z', usage(10, 100000, 20000, 500)),
      msg('m1', '2026-01-02T10:03:00Z', usage(10, 100000, 20000, 800)),
      msg('m2', '2026-01-02T10:06:00Z', usage(20, 300000, 10000, 400)),
    ] },
    { id: 'c2', agent: 'accord-critic', desc: 'Critic ST-LN-1 plan criteria', prompt: `Mode: plan. Lens: criteria. ${MARKER} Read accord/tickets/ST-LN-1/plan.md`, lines: [
      msg('m1', '2026-01-02T09:00:00Z', usage(100, 0, 100000, 2000)),
      msg('m2', '2026-01-02T09:02:00Z', usage(0, 0, 0, 0)),
    ] },
    { id: 'p1', agent: 'accord-planner', desc: `Fix ST-LN-1 plan round 1 ${MARKER}`, prompt: MARKER, lines: [
      msg('m1', '2026-01-02T11:00:00Z', usage(1000, 1000000, 0, 3000)),
      msg('m2', '2026-01-02T11:01:00Z', usage(0, 0, 0, 0)),
    ] },
    // starts exactly at the commit's time: counted
    { id: 'e1', agent: 'accord-critic', desc: 'Critic ST-LN-1 approach', prompt: `Mode: approach. Ticket: ST-LN-1. ${MARKER}`, lines: [
      msg('m1', '2026-01-02T12:00:00Z', usage(1000, 0, 0, 1000)),
    ] },
    // starts one second after the commit: not counted
    { id: 'l1', agent: 'accord-critic', desc: 'Critic ST-LN-1 plan round 3', prompt: `Mode: diff. ${MARKER}`, lines: [msg('m1', '2026-01-02T12:00:01Z', usage(1, 1, 1, 1))] },
    // a benchmark arm: not counted
    { id: 'b1', agent: 'accord-critic', desc: 'bench r1 critic-1-high ST-LN-1', prompt: `Mode: diff. ${MARKER}`, lines: [msg('m1', '2026-01-02T08:00:00Z', usage(1, 1, 1, 1))] },
    // a ticket with no file at the commit: not counted
    { id: 'n1', agent: 'accord-critic', desc: 'Critic ST-LN-2 plan', prompt: `Mode: plan. Lens: build. ${MARKER}`, lines: [msg('m1', '2026-01-02T08:00:00Z', usage(1, 1, 1, 1))] },
    // neither a critic nor a planner: not counted
    { id: 'x1', agent: 'accord-executor', desc: 'Build ST-LN-1 task 1', prompt: MARKER, lines: [msg('m1', '2026-01-02T08:00:00Z', usage(1, 1, 1, 1))] },
  ]);
  // a worktree's project folder shares the main checkout's prefix
  project(join(projects, prefix + '-st-ln-1'), 'S2', [
    { id: 'p2', agent: 'accord-planner', desc: 'Plan ST-LN-1', prompt: MARKER, lines: [
      msg('m1', '2026-01-02T08:00:00Z', usage(5, 0, 200000, 100000)),
      msg('m2', '2026-01-02T08:10:00Z', usage(0, 0, 0, 0)),
    ] },
  ]);
  // another repository's folder: never read
  project(join(projects, 'C--Other-repo'), 'S3', [
    { id: 'o1', agent: 'accord-critic', desc: 'Critic ST-LN-1 plan', prompt: `Mode: plan. ${MARKER}`, lines: [msg('m1', '2026-01-02T08:00:00Z', usage(1, 1, 1, 1))] },
  ]);
  return { s, sha, projects, prefix, done: () => [s.root, projects].forEach((d) => rmSync(d, { recursive: true, force: true, maxRetries: 5 })) };
}

const tableRows = (md: string) => {
  const section = md.slice(md.indexOf('## Critic and planner runs'));
  return { section, rows: section.split('\n').filter((l) => l.startsWith('| ') && !l.startsWith('| Run class')) };
};
const byPath = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

it('risk:parsing critic and planner runs are classed weighted and timed from a transcript folder (ST-LN-95 ac-2)', async () => {
  const { main, projectPrefix } = await load();
  const f = await withTranscripts();
  try {
    expect(await main(['--at', f.sha, '--transcripts', f.projects], { cwd: f.s.root, stdout: sink(), stderr: sink() })).toBe(0);
    const md = readFileSync(join(f.s.root, 'docs', 'benchmark', 'metrics-2026-01-02.md'), 'utf8');
    const json = JSON.parse(readFileSync(join(f.s.root, 'docs', 'benchmark', 'metrics-2026-01-02.json'), 'utf8'));
    const { section, rows } = tableRows(md);
    expect(section).toContain('Transcripts: 2 folders, 5 runs counted');
    // weighted = Math.round(input + 1.25 cache-write + 0.1 cache-read + 5 output); peak = largest single-message input + cache
    expect(rows).toEqual([
      '| critic: plan round 1, lens criteria | 1 | 0.1 | 135 | 100 | 2.0 |',
      '| critic: plan later, diff | 1 | 0.1 | 84 | 310 | 6.0 |',
      '| critic: approach, first | 1 | 0.0 | 6 | 1 | 0.0 |',
      '| planner: writing | 1 | 0.8 | 750 | 200 | 10.0 |',
      '| planner: fix | 1 | 0.1 | 116 | 1001 | 1.0 |',
    ]);
    const label = projectPrefix(basename(f.s.root));
    expect(json.transcripts).toEqual({ measured: true, folders: [label, label + '-st-ln-1'], runs: 5 });
    const files: string[] = json.runs.map((r: { file: string }) => r.file);
    expect(files).toEqual([...files].sort(byPath));
    const byFile = Object.fromEntries(json.runs.map((r: { file: string }) => [r.file, r]));
    expect(byFile[`${label}/S1/subagents/agent-c1.jsonl`]).toEqual({ file: `${label}/S1/subagents/agent-c1.jsonl`, ticket: 'ST-LN-1', class: 'critic: plan later, diff', weighted: 83530, peak: 310020, minutes: 6 });
    // m2 reports no output, so the reader raises it to the 4-characters-a-token estimate of its 'ok': 1 token, x5
    expect(byFile[`${label}-st-ln-1/S2/subagents/agent-p2.jsonl`]).toMatchObject({ class: 'planner: writing', weighted: 750010, peak: 200005, minutes: 10 });
    expect(files.some((k) => /agent-(l1|b1|n1|x1|o1)\.jsonl$/.test(k))).toBe(false);
  } finally {
    f.done();
  }
}, 120_000);

it('risk:parsing parseRun gives each run the largest single-message context as peak (ST-LN-95 ac-2)', async () => {
  const { readSessions } = (await import(new URL('../../../scripts/benchmark.mjs', import.meta.url).href)) as {
    readSessions: (dirs: string[]) => { runs: { id: string; peak: unknown; usage: unknown }[] };
  };
  const f = await withTranscripts();
  try {
    const runs = readSessions([join(f.projects, f.prefix)]).runs;
    expect(runs.every((r) => typeof r.peak === 'number')).toBe(true);
    const c1 = runs.find((r) => r.id === 'c1');
    expect(c1?.peak).toBe(310020);
    expect(c1?.usage).toEqual({ input: 30, cacheRead: 400000, cacheWrite: 30000, output: 1200, estimated: false });
  } finally {
    f.done();
  }
}, 120_000);

it('risk:regression no transcripts gives not measured and exit 0 (ST-LN-95 ac-2)', async () => {
  const { main } = await load();
  const { s, first } = twoCommits();
  const empty = realpathSync.native(mkdtempSync(join(tmpdir(), 'metrics-empty-')));
  try {
    for (const transcripts of ['none', empty]) {
      expect(await main(['--at', first, '--transcripts', transcripts], { cwd: s.root, stdout: sink(), stderr: sink() })).toBe(0);
      const md = readFileSync(join(s.root, 'docs', 'benchmark', 'metrics-2026-01-02.md'), 'utf8');
      const json = JSON.parse(readFileSync(join(s.root, 'docs', 'benchmark', 'metrics-2026-01-02.json'), 'utf8'));
      const { section, rows } = tableRows(md);
      expect(section).toContain('Transcripts: not measured');
      expect(rows).toEqual(['| critic and planner runs | not measured | not measured | not measured | not measured | not measured |']);
      expect(json.transcripts.measured).toBe(false);
      expect(json.runs).toEqual([]);
    }
  } finally {
    rmSync(s.root, { recursive: true, force: true, maxRetries: 5 });
    rmSync(empty, { recursive: true, force: true, maxRetries: 5 });
  }
}, 120_000);

it('risk:security the report holds no transcript text and no home path (ST-LN-95 ac-2)', async () => {
  const { main } = await load();
  const f = await withTranscripts();
  try {
    expect(await main(['--at', f.sha, '--transcripts', f.projects], { cwd: f.s.root, stdout: sink(), stderr: sink() })).toBe(0);
    for (const ext of ['md', 'json']) {
      const text = readFileSync(join(f.s.root, 'docs', 'benchmark', `metrics-2026-01-02.${ext}`), 'utf8');
      expect(text).toContain(ext === 'json' ? 'ST-LN-1' : 'planner: fix');
      expect(text).not.toContain(MARKER);
      expect(text).not.toContain('Users');
      expect(text).not.toContain(homedir());
      expect(text).not.toContain(homedir().split('\\').join('/'));
      expect(text).not.toContain(f.prefix);
      expect(text).not.toContain('\\');
    }
  } finally {
    f.done();
  }
}, 120_000);

// ---- D-05: plans the size rule would refuse (ST-LN-93) ----------------------------------------------------
const planOf = (tasks: number) =>
  [
    '---',
    'baseline: abc1234',
    '---',
    '',
    '# Plan',
    '',
    ...Array.from({ length: tasks }, (_, i) => [`## Task ${i + 1}: step ${i + 1}`, 'covers: @ac-1', 'files: src/a.ts', 'verify: a#b (@ac-1)', 'Do it.', ''].join('\n')),
  ].join('\n');

it('risk:regression the plan size section counts plans over twice their criteria with core\'s check (ST-LN-93 D-05)', async () => {
  const { main } = await load();
  const s = sandbox();
  try {
    write(s.root, {
      'accord/config.yml': CONFIG,
      'accord/tickets/T-1.md': laneTicket('T-1'),
      'accord/tickets/T-1/plan.md': planOf(5),
      'accord/tickets/T-2.md': laneTicket('T-2'),
      'accord/tickets/T-2/plan.md': planOf(4),
      'accord/tickets/T-3.md': laneTicket('T-3', { body: '## Intent\nNo criteria here.\n\n## Acceptance criteria\n\n' }),
      'accord/tickets/T-3/plan.md': planOf(1),
    });
    const sha = commit(s, 'plans', '2026-01-02T12:00:00+0000');
    const io = () => ({ cwd: s.root, stdout: sink(), stderr: sink() });
    expect(await main(['--at', sha, '--transcripts', 'none', '--plan-size', '--label', 'sized'], io())).toBe(0);
    const md = readFileSync(join(s.root, 'docs', 'benchmark', 'metrics-sized.md'), 'utf8');
    const json = JSON.parse(readFileSync(join(s.root, 'docs', 'benchmark', 'metrics-sized.json'), 'utf8'));
    expect(md).toMatch(/^## Plan size \(D-05\)$/m);
    expect(md).toContain('Plans counted: 2');
    expect(md).toContain('Refused at more than 2 × N tasks: 1 of 2');
    expect(md).toContain('| T-1 | 5 | 2 |');
    expect(md).not.toContain('| T-2 |');
    expect(md).toContain('No criteria, not counted: T-3');
    expect(md).toContain('no expected size');
    expect(md).toContain('@ac-n');
    expect(json.planSize).toEqual({ plans: 2, refused: [{ ticket: 'T-1', tasks: 5, expected: 2 }], noCriteria: ['T-3'] });
    // Without the option nothing of it appears.
    expect(await main(['--at', sha, '--transcripts', 'none', '--label', 'plain'], io())).toBe(0);
    const plainMd = readFileSync(join(s.root, 'docs', 'benchmark', 'metrics-plain.md'), 'utf8');
    const plainJson = JSON.parse(readFileSync(join(s.root, 'docs', 'benchmark', 'metrics-plain.json'), 'utf8'));
    expect(plainMd).not.toContain('Plan size');
    expect(Object.hasOwn(plainJson, 'planSize')).toBe(false);
  } finally {
    rmSync(s.root, { recursive: true, force: true, maxRetries: 5 });
  }
}, 120_000);

// ---- 91p-ac-5, D-09: the task cap against the existing plans (ST-LN-91) ---------------------------------
const taskOf = (n: number, o: { after?: boolean; fence?: string; extra?: number } = {}) =>
  [
    `## Task ${n}: step ${n}`,
    'covers: @ac-1',
    'files: src/a.ts',
    'verify: a#b (@ac-1)',
    ...(o.after ? [`after: ${n === 1 ? 'none' : n - 1}`] : []),
    ...(o.fence === undefined ? [] : ['```' + o.fence, 'const a = 1;', '```']),
    ...Array.from({ length: o.extra ?? 0 }, (_, i) => `Line ${i + 1}.`),
    '',
  ].join('\n');
const planWith = (tasks: string[]) => ['---', 'baseline: abc1234', '---', '', '# Plan', '', ...tasks].join('\n');

it('risk:regression the plan format section counts tasks over the cap with core\'s rule (ST-LN-91 91p-ac-5)', async () => {
  const { main } = await load();
  const s = sandbox();
  try {
    // T-1: no after: lines, a ts block and a task of 130 non-blank lines (3 task lines + 3 fence lines + 124 more). T-2: after: lines, an interfaces block, short tasks.
    write(s.root, {
      'accord/config.yml': CONFIG,
      'accord/tickets/T-1.md': laneTicket('T-1'),
      'accord/tickets/T-1/plan.md': planWith([taskOf(1, { fence: 'ts', extra: 124 }), taskOf(2)]),
      'accord/tickets/T-2.md': laneTicket('T-2'),
      'accord/tickets/T-2/plan.md': planWith([taskOf(1, { after: true, fence: 'interfaces' }), taskOf(2, { after: true })]),
    });
    const sha = commit(s, 'plans', '2026-01-02T12:00:00+0000');
    const io = () => ({ cwd: s.root, stdout: sink(), stderr: sink() });
    expect(await main(['--at', sha, '--transcripts', 'none', '--plan-format', '--label', 'fmt'], io())).toBe(0);
    const md = readFileSync(join(s.root, 'docs', 'benchmark', 'metrics-fmt.md'), 'utf8');
    const json = JSON.parse(readFileSync(join(s.root, 'docs', 'benchmark', 'metrics-fmt.json'), 'utf8'));
    expect(md).toMatch(/^## Plan format \(ST-LN-91 D-09\)$/m);
    expect(md).toMatch(/^Task length cap: 120 non-blank lines; refuses 1 of 4 tasks in 1 of 2 plans$/m);
    expect(md).toContain('Plans with a fence-like line the format rule refuses: 1');
    expect(md).toContain('Plans with a task lacking after:: 1');
    expect(json.planFormat).toMatchObject({ cap: 120, tasks: 4, plans: 2, tasksOver: 1, plansOver: 1, plansFenced: 1, tasksFenced: 1, plansAfterless: 1 });
    expect(json.planFormat.lengths.max).toBe(130);
    // Without the option nothing of it appears.
    expect(await main(['--at', sha, '--transcripts', 'none', '--label', 'plain'], io())).toBe(0);
    expect(readFileSync(join(s.root, 'docs', 'benchmark', 'metrics-plain.md'), 'utf8')).not.toContain('Plan format');
    expect(Object.hasOwn(JSON.parse(readFileSync(join(s.root, 'docs', 'benchmark', 'metrics-plain.json'), 'utf8')), 'planFormat')).toBe(false);
  } finally {
    rmSync(s.root, { recursive: true, force: true, maxRetries: 5 });
  }
}, 120_000);
