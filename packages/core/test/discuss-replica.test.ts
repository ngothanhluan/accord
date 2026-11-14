// 91r-ac-1: the discuss replica harness (scripts/discuss-replica.mjs). It reads git and Claude Code transcripts, prepares a
// worktree and a brief outside the repository, and renders the report; it never starts a model run. Every repository here
// is a throwaway one in the OS temp folder.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { expect, it } from 'vitest';

type Sink = { text: string; write: (s: string) => boolean };
type Row = Record<string, unknown>;
type Run = { desc: string; usage: { input: number; cacheRead: number; cacheWrite: number; output: number } };
type Replica = {
  main: (argv: string[], io: { cwd: string; stdout: Sink; stderr: Sink }) => Promise<number>;
  renderDiscussReplica: (row: Row) => string;
  renderDiscussReplicaJson: (row: Row) => string;
  renderNotRun: (reason: string) => { md: string; json: string };
  countSteps: (runs: Run[], ticket?: string) => Record<string, { weighted: number; runs: number }>;
};
const load = async () => (await import(new URL('../../../scripts/discuss-replica.mjs', import.meta.url).href)) as Replica;
const sink = (): Sink => {
  const out: Sink = { text: '', write: (s: string) => ((out.text += s), true) };
  return out;
};

const ORIGINAL = {
  rounds: [
    { n: 1, Must: 1, Should: 5 },
    { n: 2, Must: 0, Should: 2 },
    { n: 3, Must: 0, Should: 0 },
  ],
  steps: [
    { step: 'direction', weighted: 1222140 },
    { step: 'critic-1', weighted: 297050 },
    { step: 'critic-2', weighted: 175587 },
    { step: 'critic-3', weighted: 146777 },
  ],
};
const ROW = (over: Row = {}): Row => ({
  ticket: 'ST-LN-81',
  answers: 'live',
  grayAreas: [
    { group: 'behaviour and output', count: 2 },
    { group: 'test strategy', count: 1 },
  ],
  decisions: ['D-04', 'D-05', 'D-06'],
  rounds: [
    { n: 1, Must: 1, Should: 2 },
    { n: 2, Must: 0, Should: 1 },
  ],
  steps: [
    { step: 'discuss', weighted: 400000 },
    { step: 'direction', weighted: 900000 },
    { step: 'critic-1', weighted: 250000 },
    { step: 'revise-1', weighted: 300000 },
    { step: 'critic-2', weighted: 150000 },
  ],
  original: ORIGINAL,
  ...over,
});

it('risk:regression the discuss replica report states its one-ticket caveat first and compares with the original (ST-LN-91 91r-ac-1)', async () => {
  const { renderDiscussReplica, renderDiscussReplicaJson } = await load();
  const md = renderDiscussReplica(ROW());
  const paragraphs = md.split('\n\n');
  expect(paragraphs[0]).toMatch(/^# /);
  expect(paragraphs[1]).toContain('one merged ticket');
  expect(paragraphs[1]).toContain('the discuss stage and the approach critic');
  expect(paragraphs[1]).toContain('not a whole ticket');
  expect(paragraphs[1]).toContain('answered live by the owner');
  const at = (s: string) => {
    const i = md.indexOf(s);
    expect(i, s).toBeGreaterThan(-1);
    return i;
  };
  // gray areas by group, then the Decisions, then the rounds, then the tokens
  expect(at('## Gray areas')).toBeLessThan(at('## Decisions'));
  expect(at('## Decisions')).toBeLessThan(at('## Approach critic rounds'));
  expect(at('## Approach critic rounds')).toBeLessThan(at('## Weighted tokens per step'));
  expect(md).toContain('- behaviour and output: 2');
  expect(md).toContain('- test strategy: 1');
  expect(md).toContain('D-04, D-05, D-06');
  expect(md).toContain('| Round | Replica Must | Replica Should | Original Must | Original Should |');
  expect(md).toContain('| 1 | 1 | 2 | 1 | 5 |');
  expect(md).toContain('| 2 | 0 | 1 | 0 | 2 |');
  expect(md).toContain('| 3 | - | - | 0 | 0 |');
  expect(md).toContain('| Step | Replica weighted k | Original weighted k |');
  expect(md).toContain('| discuss | 400k | - |');
  expect(md).toContain('| direction | 900k | 1222k |');
  expect(md).toContain('| critic-3 | - | 147k |');
  expect(md).toContain('| Total | 2000k | 1842k |');
  expect(md.trimEnd().split('\n').slice(-2)).toEqual([
    'Fewer approach critic rounds than the original: yes (2 against 3)',
    'Fewer weighted tokens than the original: no (2000k against 1842k)',
  ]);
  const json = JSON.parse(renderDiscussReplicaJson(ROW())) as Record<string, unknown>;
  expect(json).toMatchObject({ ticket: 'ST-LN-81', fewerRounds: true, fewerTokens: false, replicaWeighted: 2000000, originalWeighted: 1841554 });

  // a step with no counted run is named, and the token line claims no yes or no
  const steps = (ROW().steps as Row[]).map((s) => (s.step === 'revise-1' ? { step: 'revise-1', weighted: null } : s));
  const partial = renderDiscussReplica(ROW({ steps }));
  expect(partial).toContain('| revise-1 | not measured | - |');
  expect(partial.trimEnd().split('\n').at(-1)).toBe('Fewer weighted tokens than the original: not measured (no counted run for revise-1)');
  expect(partial).not.toMatch(/Fewer weighted tokens than the original: (yes|no)/);
  expect((JSON.parse(renderDiscussReplicaJson(ROW({ steps }))) as { fewerTokens: unknown }).fewerTokens).toBeNull();
  // fewer tokens, the other way
  const cheap = (ROW().steps as Row[]).map((s) => ({ ...s, weighted: 100000 }));
  expect(renderDiscussReplica(ROW({ steps: cheap })).trimEnd().split('\n').at(-1)).toBe('Fewer weighted tokens than the original: yes (500k against 1842k)');
  // answers from the record are said so
  expect(renderDiscussReplica(ROW({ answers: 'record' })).split('\n\n')[1]).toContain('taken from the ticket\'s recorded Decisions and Corrections');
});

it('risk:regression the not-run path claims no result (ST-LN-91 91r-ac-1)', async () => {
  const { main, renderNotRun } = await load();
  const tmp = realpathSync.native(mkdtempSync(join(tmpdir(), 'drep-')));
  try {
    const out = join(tmp, 'out');
    const stdout = sink();
    expect(await main(['--not-run', 'the owner chose not to spend the tokens', '--out', out], { cwd: tmp, stdout, stderr: sink() })).toBe(0);
    const md = readFileSync(join(out, 'discuss-replica.md'), 'utf8');
    const json = JSON.parse(readFileSync(join(out, 'discuss-replica.json'), 'utf8')) as { notRun: boolean; reason: string };
    expect(md.split('\n\n')[1]).toContain('one merged ticket');
    expect(md).toContain('The replica was not run: the owner chose not to spend the tokens');
    expect(md).not.toMatch(/^Fewer /m);
    expect(json).toMatchObject({ notRun: true, reason: 'the owner chose not to spend the tokens' });
    expect(stdout.text).toContain('discuss-replica.md');
    expect(renderNotRun('a\n  b').md).toContain('The replica was not run: a b');
    const err = sink();
    expect(await main(['--not-run', '  '], { cwd: tmp, stdout: sink(), stderr: err })).toBe(2);
    expect(err.text).toContain('--not-run needs a reason');
  } finally {
    rmSync(tmp, { recursive: true, force: true, maxRetries: 5 });
  }
});

it('risk:security the discuss replica report and its JSON hold no prompt text and no home path (ST-LN-91 91r-ac-1)', async () => {
  const { renderDiscussReplica, renderDiscussReplicaJson } = await load();
  const dirty = ROW({
    prompt: 'PROMPT-MARKER-TEXT',
    reply: 'REPLY-MARKER',
    transcript: 'C:\\Users\\Someone\\.claude\\projects\\x\\agent.jsonl',
    grayAreas: [
      { group: 'behaviour and output', count: 2, text: 'PROMPT-MARKER-TEXT' },
      { group: 'C:/Users/Someone/PROMPT-MARKER-TEXT', count: 1 },
    ],
    decisions: ['D-04', 'PROMPT-MARKER-TEXT', 'C:\\Users\\x'],
    steps: [
      { step: 'discuss', weighted: 1, file: 'C:/Users/Someone/x.jsonl' },
      { step: 'C:\\Users\\Someone\\x', weighted: 1 },
    ],
    original: { ...ORIGINAL, file: 'C:/Users/Someone/PROMPT-MARKER-TEXT.jsonl' },
  });
  for (const text of [renderDiscussReplica(dirty), renderDiscussReplicaJson(dirty)]) {
    expect(text).not.toContain('PROMPT-MARKER-TEXT');
    expect(text).not.toContain('REPLY-MARKER');
    expect(text).not.toContain('Users');
    expect(text).not.toContain('\\');
  }
});

it('risk:parsing countSteps weights only the runs the brief named, per step (ST-LN-91 91r-ac-1)', async () => {
  const { countSteps } = await load();
  const u = (input: number, cacheRead = 0, cacheWrite = 0, output = 0) => ({ input, cacheRead, cacheWrite, output });
  const runs: Run[] = [
    { desc: 'bench discuss-replica ST-LN-81 discuss', usage: u(1000, 10000, 800, 100) },
    { desc: 'bench discuss-replica ST-LN-81 critic-1', usage: u(10) },
    { desc: 'bench discuss-replica ST-LN-81 critic-1', usage: u(5) },
    { desc: 'bench discuss-replica ST-LN-810 discuss', usage: u(999) },
    { desc: 'Approach critique round 1', usage: u(999) },
    { desc: 'bench discuss-replica ST-LN-81 something else', usage: u(999) },
  ];
  // 1000 + 0.1*10000 + 1.25*800 + 5*100 = 3500
  expect(countSteps(runs)).toEqual({ discuss: { weighted: 3500, runs: 1 }, 'critic-1': { weighted: 15, runs: 2 } });
  expect(countSteps(runs, 'ST-LN-810')).toEqual({ discuss: { weighted: 999, runs: 1 } });
});

// ---- estimate, prepare and score on a throwaway repository and a fake backup -----------------------------------------------

const jl = (...lines: unknown[]) => lines.map((l) => JSON.stringify(l)).join('\n') + '\n';
const REVIEW = 'Round record: 1\n\n## Round 1 (whole)\n1. Must — a — fixed\n2. Should — b — fixed\n3. Nice — c — deferred\n\n## Round 2 (diff)\n1. Should — d — fixed\n';

function fixture() {
  const tmp = realpathSync.native(mkdtempSync(join(tmpdir(), 'drep-')));
  if (!tmp.startsWith(realpathSync.native(tmpdir()))) throw new Error('refusing to run git outside a temporary sandbox: ' + tmp);
  const repo = join(tmp, 'repo');
  mkdirSync(repo);
  const git = (...args: string[]) =>
    execFileSync('git', ['-c', 'user.email=fixture@example.invalid', '-c', 'user.name=fixture', '-c', 'commit.gpgsign=false', ...args], { cwd: repo, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  git('init', '-q');
  const put = (files: Record<string, string>) => {
    for (const [rel, text] of Object.entries(files)) {
      mkdirSync(dirname(join(repo, ...rel.split('/'))), { recursive: true });
      writeFileSync(join(repo, ...rel.split('/')), text);
    }
  };
  const commit = (subject: string, files: Record<string, string>) => {
    put(files);
    git('add', '-A');
    git('commit', '-q', '--no-verify', '-m', subject, '-m', 'body naming approach: T-1 in a later commit');
    return git('rev-parse', 'HEAD').trim();
  };
  commit('claim: T-1', { 'accord/tickets/T-1.md': 'ticket claimed\n' });
  const base = commit('intent: T-1 approved by the owner', { 'accord/tickets/T-1.md': 'ticket at base\n## Decisions\n- D-01 x — "y"\n' });
  commit('approach: T-1 draft option', { 'accord/tickets/T-1.md': 'ticket with approach\n' });
  commit('approach: T-1 round 1, 1 Must, 1 Should', { 'accord/tickets/T-1/approach-review.md': REVIEW.split('\n## Round 2')[0] });
  const merge = commit('approve: T-1 intent, criteria and approach', { 'accord/tickets/T-1/approach-review.md': REVIEW });

  // a fake backup: one session that dispatched a scout, the direction planner and two approach critics
  const folder = join(tmp, 'backup', 'C--Work-x-t-1');
  const sub = join(folder, 'S1', 'subagents');
  mkdirSync(sub, { recursive: true });
  const runs = [
    { id: 's1', agent: 'accord-scout', desc: 'Scout facts for T-1', model: 'claude-sonnet-5-5', effort: 'low', ts: '01', usage: [1000, 0, 0, 200], text: '## Files\n- a.ts\n' },
    { id: 'p1', agent: 'accord-planner', desc: 'Direction for T-1', model: 'claude-opus-5-5', effort: 'high', ts: '02', usage: [10000, 0, 0, 2000], text: 'PROMPT-MARKER reply' },
    { id: 'c1', agent: 'accord-critic', desc: 'Approach critique round 1', model: 'claude-opus-5-5', effort: 'high', ts: '03', usage: [3000, 0, 0, 0], text: '1. Must — a' },
    { id: 'c2', agent: 'accord-critic', desc: 'Approach critique round 2', model: 'claude-opus-5-5', effort: 'high', ts: '04', usage: [2000, 0, 0, 0], text: 'No findings' },
  ];
  writeFileSync(
    join(folder, 'S1.jsonl'),
    jl(...runs.map((r) => ({ type: 'assistant', timestamp: `2026-10-01T00:${r.ts}:00Z`, cwd: 'C:\\Work\\x-t-1', message: { content: [{ type: 'tool_use', id: `toolu_${r.id}`, name: 'Agent', input: { description: r.desc, subagent_type: r.agent, prompt: 'PROMPT-MARKER-TEXT' } }] } }))),
  );
  for (const r of runs) {
    writeFileSync(join(sub, `agent-${r.id}.meta.json`), JSON.stringify({ agentType: r.agent, description: r.desc, toolUseId: `toolu_${r.id}` }));
    const [input, cacheWrite, cacheRead, output] = r.usage;
    writeFileSync(
      join(sub, `agent-${r.id}.jsonl`),
      jl({ type: 'assistant', timestamp: `2026-10-01T00:${r.ts}:30Z`, requestedModel: r.model, effort: r.effort, message: { id: `m-${r.id}`, model: r.model, usage: { input_tokens: input, cache_creation_input_tokens: cacheWrite, cache_read_input_tokens: cacheRead, output_tokens: output }, content: [{ type: 'text', text: r.text }] } }),
    );
  }
  const file = (id: string) => `C--Work-x-t-1/S1/subagents/agent-${id}.jsonl`;
  const config = join(tmp, 'config.json');
  const write = (over: Record<string, unknown> = {}) =>
    writeFileSync(config, JSON.stringify({ backup: 'fake', ticket: 'T-1', base, merge, original: { scout: [file('s1')], planner: [file('p1')], critic: [file('c1'), file('c2')] }, ...over }));
  write();
  return { tmp, repo, base, merge, backup: join(tmp, 'backup'), config, write, file, bench: join(tmp, 'bench'), git };
}

// direction 10000 + 5*2000 = 20000; critic 1: 3000; critic 2: 2000; scout 1000 + 5*200 = 2000
it('risk:regression --estimate prints the original runs and rounds and the cost and writes nothing (ST-LN-91 91r-ac-1)', async () => {
  const { main } = await load();
  const f = fixture();
  try {
    const stdout = sink();
    const err = sink();
    const code = await main(['--estimate', '--backup', f.backup, '--config', f.config, '--bench', f.bench], { cwd: f.repo, stdout, stderr: err });
    expect(err.text).toBe('');
    expect(code).toBe(0);
    const out = stdout.text;
    expect(out).toContain(`base ${f.base.slice(0, 8)}`);
    expect(out).toContain('| Step | Original run | Weighted k |');
    expect(out).toContain('| direction | accord-planner agent-p1 | 20k |');
    expect(out).toContain('| critic-1 | accord-critic agent-c1 | 3k |');
    expect(out).toContain('| critic-2 | accord-critic agent-c2 | 2k |');
    expect(out).toContain('| Original round | Must | Should | Must + Should |');
    expect(out).toContain('| 1 | 1 | 1 | 2 |');
    expect(out).toContain('| 2 | 0 | 1 | 1 |');
    // discuss 20 + direction 20 + critic-1 3 + revise-1 20 (no original revision run: one direction run) + critic-2 2
    expect(out).toContain('| revise-1 |');
    expect(out).toMatch(/^Estimated weighted cost: 65k$/m);
    expect(out).not.toContain('PROMPT-MARKER');
    expect(existsSync(f.bench)).toBe(false);
    expect(f.git('status', '--porcelain').trim()).toBe('');
    // a base that is not the parent of the first approach commit is refused
    f.write({ base: f.merge });
    const bad = sink();
    expect(await main(['--estimate', '--backup', f.backup, '--config', f.config], { cwd: f.repo, stdout: sink(), stderr: bad })).toBe(2);
    expect(bad.text).toContain('is not the parent of the first approach commit');
    // a run the backup does not hold is refused
    f.write({ original: { planner: [f.file('nope')], critic: [f.file('c1')] } });
    const gone = sink();
    expect(await main(['--estimate', '--backup', f.backup, '--config', f.config], { cwd: f.repo, stdout: sink(), stderr: gone })).toBe(2);
    expect(gone.text).toContain('agent-nope');
  } finally {
    rmSync(f.tmp, { recursive: true, force: true, maxRetries: 5 });
  }
});

it('risk:regression --plan prepares the worktree and the brief at the base commit and dispatches nothing (ST-LN-91 91r-ac-1)', async () => {
  const { main } = await load();
  const f = fixture();
  try {
    const argv = ['--plan', '--answers', 'record', '--backup', f.backup, '--config', f.config, '--bench', f.bench];
    const stdout = sink();
    const err = sink();
    expect(await main(argv, { cwd: f.repo, stdout, stderr: err })).toBe(0);
    expect(err.text).toBe('');
    const wt = join(f.bench, 'discuss-replica', 'T-1');
    expect(execFileSync('git', ['rev-parse', 'HEAD'], { cwd: wt, encoding: 'utf8' }).trim()).toBe(f.base);
    // the original scout's report stands in for the scout.md the base commit lacks
    expect(readFileSync(join(wt, 'accord', 'tickets', 'T-1', 'scout.md'), 'utf8')).toBe('## Files\n- a.ts\n');
    const brief = readFileSync(join(f.bench, 'briefs', 'discuss-replica', 'T-1.md'), 'utf8');
    const bench = f.bench.replace(/\\/g, '/');
    expect(brief).toContain(`Replica worktree: ${bench}/discuss-replica/T-1`);
    expect(brief).toContain('Answers: record');
    for (const step of ['discuss', 'scout-<n>', 'direction', 'critic-1', 'revise-1', 'critic-2']) expect(brief).toContain(`bench discuss-replica T-1 ${step}`);
    const order = ['discuss', 'scout-<n>', 'direction', 'critic-1', 'revise-1', 'critic-2'].map((s) => brief.indexOf(`bench discuss-replica T-1 ${s}`));
    expect(order).toEqual([...order].sort((a, b) => a - b));
    expect(brief).toContain('at most two approach critic rounds');
    expect(brief).toContain('No accord command runs in the replica worktree');
    expect(brief).toContain(`show ${f.merge}:accord/tickets/T-1.md`);
    expect(brief).toMatch(/subagent_type: accord-planner\n- mode: discuss\n- model: opus\n- effort: high/);
    expect(brief).toMatch(/subagent_type: accord-scout\n- mode: question\n- model: sonnet\n- effort: low/);
    expect(brief).toContain(`Ticket: ${bench}/discuss-replica/T-1/accord/tickets/T-1.md`);
    expect(brief).not.toContain('C:/Work/x-t-1');
    expect(brief).not.toContain('PROMPT-MARKER');
    expect(stdout.text).toMatch(/^Estimated weighted cost: 65k$/m);
    expect(stdout.text).toContain('Nothing is dispatched');
    expect(f.git('status', '--porcelain').trim()).toBe('');
    // a second run reuses the worktree; one moved off the base is refused; a bad --answers is a usage error
    expect(await main(argv, { cwd: f.repo, stdout: sink(), stderr: sink() })).toBe(0);
    execFileSync('git', ['-c', 'user.email=fixture@example.invalid', '-c', 'user.name=fixture', 'commit', '-q', '--allow-empty', '--no-verify', '-m', 'moved'], { cwd: wt });
    const moved = sink();
    expect(await main(argv, { cwd: f.repo, stdout: sink(), stderr: moved })).toBe(2);
    expect(moved.text).toContain('is not at');
    const usage = sink();
    expect(await main(['--plan', '--answers', 'maybe', '--backup', f.backup, '--config', f.config], { cwd: f.repo, stdout: sink(), stderr: usage })).toBe(2);
    expect(usage.text).toContain('--answers is live or record');
  } finally {
    rmSync(f.tmp, { recursive: true, force: true, maxRetries: 5 });
  }
});

it('risk:parsing the score reads the replica runs by description and the replica files, and names a missing step not measured (ST-LN-91 91r-ac-1)', async () => {
  const { main } = await load();
  const f = fixture();
  try {
    const out = join(f.tmp, 'out');
    const wt = join(f.bench, 'discuss-replica', 'T-1');
    const tickets = join(wt, 'accord', 'tickets', 'T-1');
    mkdirSync(tickets, { recursive: true });
    writeFileSync(join(tickets, 'discuss.md'), '# Discuss: T-1\n\n## Gray areas\n- behaviour and output — PROMPT-MARKER one — D-02\n- test strategy — two — D-03, D-04 (default)\n');
    writeFileSync(join(tickets, 'approach-review.md'), 'Round record: 1\n\n## Round 1 (whole)\n1. Should — x — fixed\n\n## Round 2 (diff)\nNo findings\n');
    const common = ['--backup', f.backup, '--config', f.config, '--bench', f.bench, '--out', out, '--answers', 'live'];
    const folder = join(f.tmp, 'new', 'C--Work-accord');
    const sub = join(folder, 'S9', 'subagents');
    mkdirSync(sub, { recursive: true });
    const steps = ['discuss', 'direction', 'critic-1', 'critic-2'];
    writeFileSync(join(folder, 'S9.jsonl'), jl(...steps.map((s, i) => ({ type: 'assistant', timestamp: `2026-11-14T00:0${i}:00Z`, message: { content: [{ type: 'tool_use', id: `toolu_${i}`, name: 'Agent', input: { description: `bench discuss-replica T-1 ${s}`, subagent_type: 'x', prompt: 'x' } }] } }))));
    steps.forEach((s, i) => {
      writeFileSync(join(sub, `agent-n${i}.meta.json`), JSON.stringify({ agentType: 'x', description: `bench discuss-replica T-1 ${s}`, toolUseId: `toolu_${i}` }));
      writeFileSync(join(sub, `agent-n${i}.jsonl`), jl({ type: 'assistant', timestamp: `2026-11-14T00:0${i}:30Z`, message: { id: `n${i}`, model: 'claude-opus-5-5', usage: { input_tokens: 1000, cache_creation_input_tokens: 0, cache_read_input_tokens: 0, output_tokens: 0 }, content: [{ type: 'text', text: 'REPLY-MARKER' }] } }));
    });
    expect(await main([...common, '--transcripts', join(f.tmp, 'new')], { cwd: f.repo, stdout: sink(), stderr: sink() })).toBe(0);
    const md = readFileSync(join(out, 'discuss-replica.md'), 'utf8');
    expect(md).toContain('- behaviour and output: 1');
    expect(md).toContain('- test strategy: 1');
    expect(md).toContain('D-02, D-03, D-04');
    expect(md).toContain('| 1 | 0 | 1 | 1 | 1 |');
    expect(md).toContain('| revise-1 | not measured | - |');
    expect(md.trimEnd().split('\n').slice(-2)).toEqual([
      'Fewer approach critic rounds than the original: no (2 against 2)',
      'Fewer weighted tokens than the original: not measured (no counted run for revise-1)',
    ]);
    for (const text of [md, readFileSync(join(out, 'discuss-replica.json'), 'utf8')]) {
      expect(text).not.toContain('MARKER');
      expect(text).not.toContain('Users');
      expect(text).not.toContain('\\');
    }
    // round 1 with nothing open: revise-1 and critic-2 were not needed, and the token line is measured
    writeFileSync(join(tickets, 'approach-review.md'), 'Round record: 1\n\n## Round 1 (whole)\nNo findings\n');
    expect(await main([...common, '--transcripts', join(f.tmp, 'new')], { cwd: f.repo, stdout: sink(), stderr: sink() })).toBe(0);
    const done = readFileSync(join(out, 'discuss-replica.md'), 'utf8');
    expect(done).toContain('| revise-1 | not run (the loop had ended) | - |');
    expect(done.trimEnd().split('\n').at(-1)).toBe('Fewer weighted tokens than the original: yes (4k against 25k)');
  } finally {
    rmSync(f.tmp, { recursive: true, force: true, maxRetries: 5 });
  }
});
