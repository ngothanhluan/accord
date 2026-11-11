// 91-ac-5: the round-2 replica harness (scripts/round2-replica.mjs). It reads transcripts and git and prints rows; it
// never starts a model run. Every repository here is a throwaway one in the OS temp folder.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { expect, it } from 'vitest';

type Sink = { text: string; write: (s: string) => boolean };
type Counts = { Must: number; Should: number; Nice: number; grounded: number; ungrounded: number };
type Row = Record<string, unknown>;
type Replica = {
  main: (argv: string[], io: { cwd: string; stdout: Sink; stderr: Sink }) => Promise<number>;
  countReply: (text: string) => Counts;
  rewritePrompt: (prompt: string, paths: { fromRoot: string; toRoot: string; fromDiff: string; toDiff: string }) => string;
  renderReplica: (rows: Row[]) => string;
  renderReplicaJson: (rows: Row[]) => string;
};
const load = async () => (await import(new URL('../../../scripts/round2-replica.mjs', import.meta.url).href)) as Replica;
const sink = (): Sink => {
  const out: Sink = { text: '', write: (s: string) => ((out.text += s), true) };
  return out;
};

it('risk:parsing a critic reply is counted by severity and grounding (ST-LN-91 ac-5)', async () => {
  const { countReply } = await load();
  const reply = [
    'fixed: 1.1',
    '',
    '1. Must — a',
    '   failing case: x → y',
    '   rests on: ac-1',
    '2. Should — b',
    '   failing case: only this',
    '3. Should — c — risk: data-loss',
    '4. Nice — d',
    'fixed: 1.1',
    '',
  ].join('\n');
  expect(countReply(reply)).toEqual({ Must: 1, Should: 2, Nice: 1, grounded: 2, ungrounded: 1 });
  expect(countReply('No findings')).toEqual({ Must: 0, Should: 0, Nice: 0, grounded: 0, ungrounded: 0 });
  expect(countReply('fixed: 1.1\n\nNo findings\n\nChecked the diff.')).toEqual({ Must: 0, Should: 0, Nice: 0, grounded: 0, ungrounded: 0 });
  // every ground the critic definition names, and the ones that are not grounds
  const grounds = [
    '1. Must — a\n   rests on: ac-3',
    '2. Should — b\n   rests on: D-07',
    '3. Should — c\n   rests on: Veto "never write the file"',
    '4. Should — d\n   rests on: Correction "use the second form"',
    '5. Should — e\n   rests on: Intent "keep one session"',
    '6. Must — f — risk: security',
    '7. Should — g\n   test: plan-test-id',
    '8. Should — h\n   command: npm test',
  ];
  expect(countReply(grounds.join('\n'))).toEqual({ Must: 2, Should: 6, Nice: 0, grounded: 8, ungrounded: 0 });
  const bare = [
    '1. **Must** — a\n   rests on: nothing in the ticket',
    '2. Should — b — risk: regression',
    '3. Should — c\n   test:',
    '4. Should — d\n   rests on: ac-x',
  ];
  expect(countReply(bare.join('\n'))).toEqual({ Must: 1, Should: 3, Nice: 0, grounded: 0, ungrounded: 4 });
  // a Nice is counted and never grounded or ungrounded; text before the first number belongs to no block
  expect(countReply('rests on: ac-1\n1. Nice — a\n   rests on: ac-1')).toEqual({ Must: 0, Should: 0, Nice: 1, grounded: 0, ungrounded: 0 });
  // a closing paragraph after the last finding grounds nothing; an indented line after a blank line still belongs to the finding
  expect(countReply('1. Should — a\n   failing case: x\n\nNot checked: test: foo, command: bar, risk: security\n')).toEqual({ Must: 0, Should: 1, Nice: 0, grounded: 0, ungrounded: 1 });
  expect(countReply('1. Should — a\n   failing case: x\n\n   rests on: ac-2\n')).toEqual({ Must: 0, Should: 1, Nice: 0, grounded: 1, ungrounded: 0 });
});

it('risk:regression the replica prompt changes only its paths (ST-LN-91 ac-5)', async () => {
  const { rewritePrompt } = await load();
  const prompt = [
    'Mode: diff. Round 2.',
    'Ticket: C:\\Work\\accord-st-ln-8\\accord\\tickets\\ST-LN-8.md',
    'Plan: C:/Work/accord-st-ln-8/accord/tickets/ST-LN-8/plan.md',
    'Diff: C:/Users/NAME~1/AppData/Local/Temp/claude/s/scratchpad/st-ln-8-plan-round2.diff',
    'Same diff, other slash: C:\\Users\\NAME~1\\AppData\\Local\\Temp\\claude\\s\\scratchpad\\st-ln-8-plan-round2.diff.',
    'Another ticket, left alone: C:/Work/accord-st-ln-80/accord/tickets/ST-LN-80.md',
    'Root: "C:/Work/accord-st-ln-8" (read-only). Ünïcode and  double  spaces stay.',
    '',
  ].join('\n');
  const out = rewritePrompt(prompt, {
    fromRoot: 'C:\\Work\\accord-st-ln-8',
    toRoot: 'C:/Work/accord-bench/round2-replica/ST-LN-8',
    fromDiff: 'C:/Users/NAME~1/AppData/Local/Temp/claude/s/scratchpad/st-ln-8-plan-round2.diff',
    toDiff: 'C:/Work/accord-bench/round2-replica/ST-LN-8.diff',
  });
  expect(out).toBe(
    [
      'Mode: diff. Round 2.',
      'Ticket: C:\\Work\\accord-bench\\round2-replica\\ST-LN-8\\accord\\tickets\\ST-LN-8.md',
      'Plan: C:/Work/accord-bench/round2-replica/ST-LN-8/accord/tickets/ST-LN-8/plan.md',
      'Diff: C:/Work/accord-bench/round2-replica/ST-LN-8.diff',
      'Same diff, other slash: C:\\Work\\accord-bench\\round2-replica\\ST-LN-8.diff.',
      'Another ticket, left alone: C:/Work/accord-st-ln-80/accord/tickets/ST-LN-80.md',
      'Root: "C:/Work/accord-bench/round2-replica/ST-LN-8" (read-only). Ünïcode and  double  spaces stay.',
      '',
    ].join('\n'),
  );
  // a prompt with none of the paths comes back byte for byte
  expect(rewritePrompt('Mode: diff.\n', { fromRoot: 'C:/a', toRoot: 'C:/b', fromDiff: 'C:/a.diff', toDiff: 'C:/b.diff' })).toBe('Mode: diff.\n');
});

const row = (ticket: string, over: Row = {}): Row => ({
  ticket,
  measured: true,
  oldRecord: 1,
  oldReply: 1,
  newMust: 0,
  newShould: 1,
  wouldBlock: 0,
  wouldDefer: 1,
  oldWeighted: 300000,
  newWeighted: 300000,
  oldPeak: 80000,
  newPeak: 70000,
  ...over,
});
const THREE = () => [
  row('ST-LN-48', { oldRecord: 3, oldReply: 3, newMust: 1, newShould: 0, wouldBlock: 1, wouldDefer: 0, oldWeighted: 357000, newWeighted: 300000 }),
  row('ST-LN-8', { oldRecord: 1, oldWeighted: 237000, newWeighted: 350000 }),
  row('ST-LN-13', { oldRecord: 1, oldWeighted: 305000, newWeighted: 300000 }),
];

it('risk:regression the replica report states fewer or not fewer under the D-04 caveat (ST-LN-91 ac-5)', async () => {
  const { renderReplica, renderReplicaJson } = await load();
  const md = renderReplica(THREE());
  const paragraphs = md.split('\n\n');
  expect(paragraphs[0]).toMatch(/^# /);
  expect(paragraphs[1]).toContain('not a whole ticket');
  expect(paragraphs[1]).toContain('round 2 of the plan critic');
  const lines = md.split('\n');
  const header = lines.findIndex((l) => l.startsWith('| Ticket |'));
  expect(lines[header]).toBe(
    '| Ticket | Old Must + Should (record) | Old Must + Should (reply) | New Must + Should | New would block | New would defer | Old weighted k | New weighted k | Old peak k | New peak k |',
  );
  const ids = lines.filter((l) => /^\| (ST|BUG)-LN-\d+ \|/.test(l)).map((l) => l.split(' | ')[0].slice(2));
  expect(ids).toEqual(['ST-LN-8', 'ST-LN-13', 'ST-LN-48']);
  expect(md).toContain('| ST-LN-8 | 1 | 1 | 1 | 0 | 1 | 237k | 350k | 80k | 70k |');
  expect(md.trimEnd().split('\n').slice(-2)).toEqual([
    'Fewer findings than the baseline: yes (1 against 5)',
    'Fewer weighted tokens than the baseline: no (950k against 899k)',
  ]);
  // JSON carries the same numbers, sorted the same way
  const json = JSON.parse(renderReplicaJson(THREE())) as { rows: { ticket: string }[]; totals: Record<string, number>; fewerFindings: boolean; fewerTokens: boolean };
  expect(json.rows.map((r) => r.ticket)).toEqual(['ST-LN-8', 'ST-LN-13', 'ST-LN-48']);
  expect(json.totals).toMatchObject({ oldRecord: 5, wouldBlock: 1, oldWeighted: 899000, newWeighted: 950000 });
  expect(json.fewerFindings).toBe(true);
  expect(json.fewerTokens).toBe(false);
  // tokens are rounded per run before the sums: 1.4k + 1.4k is 2.8k, shown as 3k, not 1k + 1k
  const small = renderReplica([row('T-1', { newWeighted: 1400, oldWeighted: 1400 }), row('T-2', { newWeighted: 1400, oldWeighted: 1400 })]);
  expect(small).toContain('| Total |');
  expect(small.trimEnd().split('\n').at(-1)).toBe('Fewer weighted tokens than the baseline: no (3k against 3k)');
});

it('risk:regression a ticket with no counted replica run is named not measured and no verdict is claimed (ST-LN-91 ac-5)', async () => {
  const { renderReplica, renderReplicaJson } = await load();
  const rows = THREE();
  rows[2] = row('ST-LN-13', { measured: false });
  const md = renderReplica(rows);
  expect(md).toMatch(/^\| ST-LN-13 \| 1 \| 1 \| not measured \| not measured \| not measured \| 300k \| not measured \| 80k \| not measured \|$/m);
  const [a, b] = md.trimEnd().split('\n').slice(-2);
  expect(a).toBe('Fewer findings than the baseline: not measured (no counted run for ST-LN-13)');
  expect(b).toBe('Fewer weighted tokens than the baseline: not measured (no counted run for ST-LN-13)');
  expect(md).not.toMatch(/than the baseline: (yes|no) \(/);
  const json = JSON.parse(renderReplicaJson(rows)) as { fewerFindings: unknown; fewerTokens: unknown; notMeasured: string[] };
  expect(json.notMeasured).toEqual(['ST-LN-13']);
  expect(json.fewerFindings).toBeNull();
  expect(json.fewerTokens).toBeNull();
  // a reply of "No findings" is a measured zero, not a missing run
  const zero = renderReplica([row('ST-LN-8', { newMust: 0, newShould: 0, wouldBlock: 0, wouldDefer: 0 })]);
  expect(zero).toMatch(/^\| ST-LN-8 \| 1 \| 1 \| 0 \| 0 \| 0 \|/m);
  expect(zero).toContain('Fewer findings than the baseline: yes (0 against 1)');
});

it('risk:security the replica report holds no prompt text and no home path (ST-LN-91 ac-5)', async () => {
  const { renderReplica, renderReplicaJson, main } = await load();
  const dirty = (ticket: string) =>
    row(ticket, { prompt: 'PROMPT-MARKER-TEXT', run: 'C:\\Users\\Someone\\.claude\\projects\\x\\agent.jsonl', transcript: 'C:/Users/Someone/x.jsonl', reply: 'REPLY-MARKER' });
  const rows = [dirty('ST-LN-8'), dirty('ST-LN-13')];
  for (const text of [renderReplica(rows), renderReplicaJson(rows)]) {
    expect(text).not.toContain('PROMPT-MARKER-TEXT');
    expect(text).not.toContain('REPLY-MARKER');
    expect(text).not.toContain('Users');
    expect(text).not.toContain('\\');
  }
  const tmp = realpathSync.native(mkdtempSync(join(tmpdir(), 'r2rep-')));
  try {
    mkdirSync(join(tmp, 'out'));
    const stdout = sink();
    const code = await main(['--not-run', 'the owner chose not to spend the tokens', '--out', join(tmp, 'out')], { cwd: tmp, stdout, stderr: sink() });
    expect(code).toBe(0);
    const md = readFileSync(join(tmp, 'out', 'round2-replica.md'), 'utf8');
    const json = JSON.parse(readFileSync(join(tmp, 'out', 'round2-replica.json'), 'utf8')) as { notRun: boolean; reason: string };
    expect(md.split('\n\n')[1]).toContain('not a whole ticket');
    expect(md).toContain('The replica was not run: the owner chose not to spend the tokens');
    expect(md).not.toMatch(/Fewer [a-z ]+ than the baseline/);
    expect(json).toMatchObject({ notRun: true, reason: 'the owner chose not to spend the tokens' });
    expect(stdout.text).toContain('round2-replica.md');
    // an empty reason is a usage error and writes nothing
    const err = sink();
    expect(await main(['--not-run', ''], { cwd: tmp, stdout: sink(), stderr: err })).toBe(2);
    expect(err.text).toContain('--not-run needs a reason');
  } finally {
    rmSync(tmp, { recursive: true, force: true, maxRetries: 5 });
  }
});

// ---- estimate and prepare, on a throwaway repository and a fake backup -----------------------------------------------------

const jl = (...lines: unknown[]) => lines.map((l) => JSON.stringify(l)).join('\n') + '\n';
const PLAN_V1 = '# Plan\n\n## Task 1\nold text\n';
const PLAN_V2 = '# Plan\n\n## Task 1\nnew text after the fix\n';
const REVIEW_R1 = '## Round 1 (whole)\n1. Should — a — open\n';
const REVIEW_R2 = REVIEW_R1 + '\n## Round 2 (diff)\n1. Should — b — open\n';

function fixture() {
  const tmp = realpathSync.native(mkdtempSync(join(tmpdir(), 'r2rep-')));
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
  put({ 'accord/tickets/T-1.md': 'ticket v1\n', 'accord/tickets/T-1/plan.md': PLAN_V1, 'accord/tickets/T-1/plan-review.md': REVIEW_R1 });
  git('add', '-A');
  git('commit', '-q', '--no-verify', '-m', 'round 1');
  const r1 = git('rev-parse', 'HEAD').trim();
  put({ 'accord/tickets/T-1.md': 'ticket v2\n', 'accord/tickets/T-1/ledger.md': 'ledger at round 2\n', 'accord/tickets/T-1/plan.md': PLAN_V2, 'accord/tickets/T-1/plan-review.md': REVIEW_R2 });
  git('add', '-A');
  git('commit', '-q', '--no-verify', '-m', 'round 2');
  const r2 = git('rev-parse', 'HEAD').trim();

  // a fake backup: one session whose Agent call dispatched the round-2 critic, and the critic's own run
  const folder = join(tmp, 'backup', 'C--Work-x-t-1');
  const sub = join(folder, 'S1', 'subagents');
  mkdirSync(sub, { recursive: true });
  const prompt = [
    'Mode: diff. Round 2.',
    'Ticket: C:\\Work\\x-t-1\\accord\\tickets\\T-1.md',
    'Plan: C:/Work/x-t-1/accord/tickets/T-1/plan.md',
    'Diff of the fix: C:/Users/NAME~1/AppData/Local/Temp/claude/s/plan-round1.diff',
    '',
  ].join('\n');
  writeFileSync(join(folder, 'S1.jsonl'), jl({ type: 'assistant', timestamp: '2026-10-01T00:00:00Z', cwd: 'C:\\Work\\x-t-1', message: { content: [{ type: 'tool_use', id: 'toolu_A', name: 'Agent', input: { description: 'Plan critic round 2 diff', subagent_type: 'accord-critic', prompt } }] } }));
  writeFileSync(join(sub, 'agent-c1.meta.json'), JSON.stringify({ agentType: 'accord-critic', description: 'Plan critic round 2 diff', toolUseId: 'toolu_A' }));
  writeFileSync(
    join(sub, 'agent-c1.jsonl'),
    jl(
      { type: 'assistant', timestamp: '2026-10-01T00:01:00Z', requestedModel: 'claude-opus-5-5', effort: 'high', message: { id: 'm1', model: 'claude-opus-5-5', usage: { input_tokens: 1000, cache_creation_input_tokens: 8000, cache_read_input_tokens: 100000, output_tokens: 2000 }, content: [{ type: 'text', text: '1. Should — b\n   rests on: ac-1\n' }] } },
    ),
  );
  const candidates = join(tmp, 'candidates.json');
  writeFileSync(
    candidates,
    JSON.stringify({ backup: 'fake', sets: { recommended: ['T-1'] }, candidates: [{ id: 'T-1', r1, r2, run: 'C--Work-x-t-1/S1/subagents/agent-c1.jsonl', model: 'opus', effort: 'high' }] }),
  );
  return { tmp, repo, r1, r2, backup: join(tmp, 'backup'), candidates, bench: join(tmp, 'bench'), git };
}

it('risk:regression --estimate prints each candidate and the cost of the set and writes nothing (ST-LN-91 ac-5)', async () => {
  const { main } = await load();
  const f = fixture();
  try {
    const stdout = sink();
    const code = await main(['--estimate', '--backup', f.backup, '--candidates', f.candidates, '--bench', f.bench], { cwd: f.repo, stdout, stderr: sink() });
    expect(code).toBe(0);
    expect(stdout.text).toContain('| Ticket | r1 | r2 | Old weighted k | Old peak k | Record round-2 Must + Should |');
    expect(stdout.text).toContain(`| T-1 | ${f.r1.slice(0, 8)} | ${f.r2.slice(0, 8)} | 31k | 109k | 1 |`);
    expect(stdout.text).toContain('Estimated weighted cost of recommended: 31k');
    expect(existsSync(f.bench)).toBe(false);
    expect(f.git('status', '--porcelain').trim()).toBe('');
  } finally {
    rmSync(f.tmp, { recursive: true, force: true, maxRetries: 5 });
  }
});

it('risk:regression --plan prepares the worktree, the diff and the rewritten prompt and prints the row without dispatching (ST-LN-91 ac-5)', async () => {
  const { main } = await load();
  const f = fixture();
  try {
    const argv = ['--plan', '--tickets', 'T-1', '--backup', f.backup, '--candidates', f.candidates, '--bench', f.bench];
    const stdout = sink();
    expect(await main(argv, { cwd: f.repo, stdout, stderr: sink() })).toBe(0);
    const bench = f.bench.replace(/\\/g, '/');
    const wt = join(f.bench, 'round2-replica', 'T-1');
    // detached at round 1, with the plan, the ticket and the ledger as round 2 holds them and the record as round 1 left it
    expect(execFileSync('git', ['rev-parse', 'HEAD'], { cwd: wt, encoding: 'utf8' }).trim()).toBe(f.r1);
    expect(readFileSync(join(wt, 'accord', 'tickets', 'T-1', 'plan.md'), 'utf8')).toBe(PLAN_V2);
    expect(readFileSync(join(wt, 'accord', 'tickets', 'T-1.md'), 'utf8')).toBe('ticket v2\n');
    expect(readFileSync(join(wt, 'accord', 'tickets', 'T-1', 'ledger.md'), 'utf8')).toBe('ledger at round 2\n');
    // (the checkout may convert line ends on Windows; the record is compared with them normalised)
    expect(readFileSync(join(wt, 'accord', 'tickets', 'T-1', 'plan-review.md'), 'utf8').replace(/\r\n/g, '\n')).toBe(REVIEW_R1);
    const diff = readFileSync(join(f.bench, 'round2-replica', 'T-1.diff'), 'utf8');
    expect(diff).toBe(f.git('diff', f.r1, f.r2, '--', 'accord/tickets/T-1/plan.md'));
    expect(diff).toContain('+new text after the fix');
    const brief = readFileSync(join(f.bench, 'briefs', 'round2-replica', 'T-1.md'), 'utf8');
    expect(brief).toBe(
      [
        'Mode: diff. Round 2.',
        `Ticket: ${bench.replace(/\//g, '\\')}\\round2-replica\\T-1\\accord\\tickets\\T-1.md`,
        `Plan: ${bench}/round2-replica/T-1/accord/tickets/T-1/plan.md`,
        `Diff of the fix: ${bench}/round2-replica/T-1.diff`,
        '',
      ].join('\n'),
    );
    expect(stdout.text).toContain('bench round2-replica T-1');
    expect(stdout.text).toContain('accord-critic');
    expect(stdout.text).toContain('| opus | high |');
    expect(stdout.text).toContain('31k');
    expect(stdout.text).toContain(`${bench}/briefs/round2-replica/T-1.md`);
    // a second run reuses the worktree; a worktree not at round 1 is refused
    expect(await main(argv, { cwd: f.repo, stdout: sink(), stderr: sink() })).toBe(0);
    execFileSync('git', ['-c', 'user.email=fixture@example.invalid', '-c', 'user.name=fixture', 'commit', '-q', '--allow-empty', '--no-verify', '-m', 'moved'], { cwd: wt });
    const err = sink();
    expect(await main(argv, { cwd: f.repo, stdout: sink(), stderr: err })).toBe(2);
    expect(err.text).toContain('is not at');
    // an unknown ticket is a usage error
    const bad = sink();
    expect(await main(['--plan', '--tickets', 'NOPE-1', '--backup', f.backup, '--candidates', f.candidates, '--bench', f.bench], { cwd: f.repo, stdout: sink(), stderr: bad })).toBe(2);
    expect(bad.text).toContain('NOPE-1');
  } finally {
    rmSync(f.tmp, { recursive: true, force: true, maxRetries: 5 });
  }
});

it('risk:parsing the score reads the new run by its description and names a ticket with no run not measured (ST-LN-91 ac-5)', async () => {
  const { main } = await load();
  const f = fixture();
  try {
    const out = join(f.tmp, 'out');
    const common = ['--tickets', 'T-1', '--backup', f.backup, '--candidates', f.candidates, '--out', out];
    // no replica run yet: not measured, never zero
    const none = sink();
    expect(await main([...common, '--transcripts', join(f.tmp, 'none-yet')], { cwd: f.repo, stdout: none, stderr: sink() })).toBe(0);
    const md0 = readFileSync(join(out, 'round2-replica.md'), 'utf8');
    expect(md0).toContain('Fewer findings than the baseline: not measured (no counted run for T-1)');
    // a replica run under the description the plan printed: one grounded Should
    const folder = join(f.tmp, 'new', 'C--Work-accord-st-ln-91');
    const sub = join(folder, 'S9', 'subagents');
    mkdirSync(sub, { recursive: true });
    writeFileSync(join(folder, 'S9.jsonl'), jl({ type: 'assistant', timestamp: '2026-11-12T00:00:00Z', cwd: 'C:\\Work\\accord-st-ln-91', message: { content: [{ type: 'tool_use', id: 'toolu_N', name: 'Agent', input: { description: 'bench round2-replica T-1', subagent_type: 'accord-critic', prompt: 'x' } }] } }));
    writeFileSync(join(sub, 'agent-n1.meta.json'), JSON.stringify({ agentType: 'accord-critic', description: 'bench round2-replica T-1', toolUseId: 'toolu_N' }));
    const reply = 'fixed: 1.1\n\n1. Should — b\n   rests on: ac-1\n2. Should — c\n   failing case: nothing\n3. Nice — d\n';
    writeFileSync(join(sub, 'agent-n1.jsonl'), jl({ type: 'assistant', timestamp: '2026-11-12T00:01:00Z', requestedModel: 'claude-opus-5-5', effort: 'high', message: { id: 'n1', model: 'claude-opus-5-5', usage: { input_tokens: 1000, cache_creation_input_tokens: 0, cache_read_input_tokens: 50000, output_tokens: 1000 }, content: [{ type: 'text', text: reply }] } }));
    expect(await main([...common, '--transcripts', join(f.tmp, 'new')], { cwd: f.repo, stdout: sink(), stderr: sink() })).toBe(0);
    const md = readFileSync(join(out, 'round2-replica.md'), 'utf8');
    // old: record 1, reply 1 (one Should); new: 2 Should, 1 would block, 1 would defer; 11k against 31k, peaks 109k and 51k
    expect(md).toContain('| T-1 | 1 | 1 | 2 | 1 | 1 | 31k | 11k | 109k | 51k |');
    expect(md.trimEnd().split('\n').slice(-2)).toEqual(['Fewer findings than the baseline: no (1 against 1)', 'Fewer weighted tokens than the baseline: yes (11k against 31k)']);
    expect(md).not.toContain('Users');
    expect(md).not.toContain('\\');
    const json = readFileSync(join(out, 'round2-replica.json'), 'utf8');
    expect(json).not.toContain('Users');
    expect(json).not.toContain('\\');
  } finally {
    rmSync(f.tmp, { recursive: true, force: true, maxRetries: 5 });
  }
});
