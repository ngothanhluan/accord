import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, realpathSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, it } from 'vitest';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const fixtures = join(root, 'packages/core/test/fixtures/benchmark');

it('ac-4 the compliance check finds the four known breaches', async () => {
  const { readSessions } = (await import(new URL('../../../scripts/benchmark.mjs', import.meta.url).href)) as {
    readSessions: (dirs: string[]) => { runs: unknown[]; refusals: unknown[] };
  };
  const { compliance, render } = (await import(new URL('../../../scripts/compliance.mjs', import.meta.url).href)) as {
    compliance: (input: unknown) => unknown;
    render: (result: unknown) => string;
  };
  const s = readSessions([join(fixtures, 'projects', 'C--Work-accord')]);
  const commits = JSON.parse(readFileSync(join(fixtures, 'commits.json'), 'utf8')) as { sha: string; at: number; message: string }[];
  const read = (p: string) => (existsSync(p) ? readFileSync(p, 'utf8') : '');
  const tickets = Object.fromEntries(
    ['BUG-LN-3', 'ST-LN-7'].map((id) => [id, { review: read(join(root, 'accord/tickets', id, 'review.md')), ledger: read(join(root, 'accord/tickets', id, 'ledger.md')) }]),
  );
  const schemas = readFileSync(join(fixtures, 'schemas.test.ts.txt'), 'utf8');
  const out = render(
    compliance({
      runs: s.runs,
      refusals: s.refusals,
      commits: [],
      tickets,
      settings: { tierUp: 4, executorModel: 'sonnet' },
      commitInfo: (short: string) => commits.find((c) => c.sha.startsWith(short)),
      testFile: (p: string) => (p === 'packages/core/test/schemas.test.ts' ? schemas : undefined),
    }),
  );
  const lines = out.split('\n');
  const one = (...parts: string[]) => {
    const hit = lines.filter((l) => parts.every((p) => l.includes(p)));
    expect(hit, parts.join(' | ')).toHaveLength(1);
    return hit[0];
  };
  one('- tier-up: ', 'BUG-LN-3 review round 4', 'asked for sonnet where escalation.fix_round_tier_up asks for opus', 'C--Work-accord/c3d77780-626d-4476-ae0d-3058eca7e240/subagents/agent-aae0cafc466e597f4.jsonl');
  one('- trailer: ', 'ST-LN-7 task 1', 'commit 0496cf0', 'Co-Authored-By');
  const testFirst = one('- test-first: ', 'ST-LN-7 task 4', 'C--Work-accord/4c922939-083e-4f93-af28-1fbb994a4bf3/subagents/agent-ae0a4407a746836a7.jsonl');
  expect(testFirst).not.toMatch(/[A-Za-z]:[\\/]/);
  expect(testFirst).not.toContain('<home>');
  one('- verify-id: ', 'ST-LN-7 task 2', 'inside describe(', 'C--Work-accord/4c922939-083e-4f93-af28-1fbb994a4bf3.jsonl');
  expect(out).toContain('| tier-up | 1 |');
  for (const rule of ['trailer', 'test-first', 'verify-id']) expect(out).toContain(`| ${rule} |`);

  const script = readFileSync(join(root, 'scripts/compliance.mjs'), 'utf8');
  for (const named of ['BUG-LN-3', 'ST-LN-7', '0496cf0', 'ca75fa2', 'aae0caf', 'ae0a440']) expect(script).not.toContain(named);

  const files = [...(readdirSync(join(fixtures, 'projects'), { recursive: true }) as string[]).map((f) => join(fixtures, 'projects', f)), join(fixtures, 'commits.json')].filter((f) => statSync(f).isFile());
  expect(files.length).toBeGreaterThan(5);
  for (const f of files) {
    for (const line of readFileSync(f, 'utf8').split('\n')) {
      expect(line).not.toMatch(/[A-Za-z]:[\\/]+Users[\\/]/i);
      expect(line).not.toMatch(/\/[a-z]\/Users\//i);
      expect(line).not.toMatch(/[\w.+-]+@[\w-]+(\.[\w-]+)+/);
      expect(line).not.toMatch(/"thinking"/);
    }
  }
});

const TICKET_A = '---\nid: "T-1"\n---\n\n## Intent\nfirst\n';
const TICKET_B = TICKET_A.replace('first', 'second');

it('ac-5 the compliance check scores every run against the other rules', async () => {
  const bench = (await import(new URL('../../../scripts/benchmark.mjs', import.meta.url).href)) as {
    ticketAt: (repo: string, id: string, ms: number) => string | undefined;
    branchCommits: (repo: string) => { sha: string; at: number; message: string }[];
  };
  const { compliance, render } = (await import(new URL('../../../scripts/compliance.mjs', import.meta.url).href)) as {
    compliance: (input: unknown) => unknown;
    render: (result: unknown) => string;
  };
  const repo = realpathSync.native(mkdtempSync(join(tmpdir(), 'bench-')));
  try {
    const git = (args: string[], date?: string) =>
      execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@example.invalid', '-c', 'commit.gpgsign=false', ...args], {
        cwd: repo,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
        env: date ? { ...process.env, GIT_AUTHOR_DATE: date, GIT_COMMITTER_DATE: date } : process.env,
      });
    const commit = (file: string, text: string, message: string, date: string) => {
      mkdirSync(dirname(join(repo, file)), { recursive: true });
      writeFileSync(join(repo, file), text);
      writeFileSync(join(repo, '.git', 'MSG'), message);
      git(['add', file]);
      git(['commit', '-q', '--no-verify', '-F', '.git/MSG', '--cleanup=verbatim'], date);
    };
    git(['init', '-q']);
    git(['checkout', '-q', '-b', 'main']);
    commit('accord/tickets/T-1.md', TICKET_A, 'T-1: a\n', '2026-01-01T00:00:00Z');
    git(['checkout', '-q', '-b', 't/T-1']);
    commit('accord/tickets/T-1.md', TICKET_B, 'T-1 task 1: b\n\nCo-Authored-By: X <x@example.com>\n', '2026-01-02T00:00:00Z');
    git(['checkout', '-q', 'main']);
    commit('n.txt', 'n\n', 'T-2 task 3: n\n\nGenerated with a tool\n', '2026-01-03T00:00:00Z');

    expect(bench.ticketAt(repo, 'T-1', Date.parse('2026-01-01T12:00:00Z'))).toBe(TICKET_A);
    expect(bench.ticketAt(repo, 'T-1', Date.parse('2026-01-02T12:00:00Z'))).toBe(TICKET_B);
    expect(bench.ticketAt(repo, 'T-1', Date.parse('2025-12-31T00:00:00Z'))).toBeUndefined();
    const commits = bench.branchCommits(repo);
    expect(commits.map((c) => c.message.split('\n')[0]).sort()).toEqual(['T-1 task 1: b', 'T-1: a', 'T-2 task 3: n']);
    expect(new Set(commits.map((c) => c.sha)).size).toBe(commits.length);

    const t0 = Date.parse('2026-01-01T12:00:00Z');
    const t2 = Date.parse('2026-01-02T12:00:00Z');
    const run = (o: Record<string, unknown>) => ({ agent: 'accord-executor', desc: 'd', ticket: 'T-1', task: 1, fix: false, commits: [], edits: [], reads: [], sends: [], handbacks: [], file: 'r.jsonl', ...o });
    const prompt = 'Brief: C:/s/b1.md';
    const reads = [{ path: 'C:/s/b1.md', text: TICKET_A + '\n---\n\n## Task 1: a\n' }];
    const done = { ts: t0, text: 'DONE' };
    const runs = [
      run({ task: 1, file: 'r1.jsonl', dispatch: { ts: t0, prompt }, reads }),
      run({ task: 2, file: 'r2.jsonl', dispatch: { ts: t2, prompt }, reads }),
      run({ task: 3, file: 'r3.jsonl', handbacks: [done], sends: [{ ts: t0 + 60_000, summary: 'one more fix' }] }),
      run({ task: 4, file: 'r4.jsonl', handbacks: [{ ts: t0, text: 'NEEDS_CONTEXT' }], sends: [{ ts: t0 + 60_000, summary: 'answer' }] }),
      run({ task: 5, file: 'r5.jsonl', sends: [{ ts: t0, summary: 'early' }] }),
      run({ task: 6, file: 'r6.jsonl', desc: 'bench r1 executor-1-low', handbacks: [done], sends: [{ ts: t0 + 60_000, summary: 'x' }] }),
      run({ agent: 'accord-planner', task: null, file: 'p7.jsonl', dispatch: { ts: t2, prompt: 'Plan this ticket.\n' + TICKET_A } }),
      run({ agent: 'accord-critic', task: null, file: 'c8.jsonl', dispatch: { ts: t2, prompt: 'Plan this ticket.\n' + TICKET_B } }),
    ];
    const rounds = (n: number) => Array.from({ length: n }, (_, i) => `## Round ${i + 1}\n\nbody\n`).join('\n');
    const tickets = {
      A: { review: rounds(6), ledger: '- Ruling: something else — x — none\n' },
      B: { review: rounds(6), ledger: '- Ruling: review past the cap: one more round — owner: "ok" — none\n' },
      C: { review: rounds(5), ledger: '' },
    };
    const out = render(
      compliance({
        runs, refusals: [], commits, tickets, settings: { tierUp: 4, executorModel: 'sonnet' },
        commitInfo: () => undefined, testFile: () => undefined, ticketAt: (id: string, ms: number) => bench.ticketAt(repo, id, ms),
      }),
    );
    const lines = out.split('\n');
    const some = (...parts: string[]) => lines.filter((l) => l.startsWith('- ') && parts.every((p) => l.includes(p)));
    expect(some('- trailer: ', 'T-1 task 1', 'Co-Authored-By')).toHaveLength(1);
    expect(some('- trailer: ', 'T-2 task 3', 'Generated with')).toHaveLength(1);
    expect(some('- round-cap: ', 'A review', 'round 6')).toHaveLength(1);
    expect(some('- reassigned: ', 'T-1 task 3', 'one more fix')).toHaveLength(1);
    expect(some('- brief-quote: ', 'T-1 task 2', 'line 6', 'first')).toHaveLength(1);
    expect(some('- brief-quote: ', 'T-1 task ?', 'line 6', 'first', 'p7.jsonl')).toHaveLength(1);
    const table = lines.filter((l) => /^\| [a-z-]+ \| \d+ \|$/.test(l));
    expect(table).toEqual(['| tier-up | 0 |', '| trailer | 2 |', '| test-first | 0 |', '| verify-id | 0 |', '| round-cap | 1 |', '| reassigned | 1 |', '| brief-quote | 2 |']);
  } finally {
    rmSync(repo, { recursive: true, force: true, maxRetries: 5 });
  }
}, 120_000);

it('risk:data-loss a newer compliance read keeps every line of an earlier one', async () => {
  const { RULES, render, parseCompliance, mergeCompliance } = (await import(new URL('../../../scripts/compliance.mjs', import.meta.url).href)) as {
    RULES: string[];
    render: (result: Record<string, string[]>) => string;
    parseCompliance: (text: string) => Record<string, string[]>;
    mergeCompliance: (a: Record<string, string[]>, b: Record<string, string[]>) => Record<string, string[]>;
  };
  const empty = () => Object.fromEntries(RULES.map((r) => [r, [] as string[]]));
  const tierUp = '- tier-up: T-1 review round 4: the fix executor asked for sonnet where escalation.fix_round_tier_up asks for opus — a.jsonl';
  const trailerOld = '- trailer: T-1 task 1: commit abc1234 carries "Co-Authored-By: X" — commit abc1234, shown in a.jsonl';
  const trailerNew = '- trailer: T-1 task 1: commit abc1234 carries "Co-Authored-By: X" — commit abc1234';
  const cap = (n: number) => `- round-cap: T-9 review: reached round ${n} with no Ruling that allows going past the round cap — accord/tickets/T-9/review.md`;
  const testFirst = '- test-first: T-2 task 1: its first edit to a source file (src/a.ts) came before its first edit to a test file — b.jsonl';
  const first = { ...empty(), 'tier-up': [tierUp], trailer: [trailerOld], 'round-cap': [cap(6)] };
  const newer = { ...empty(), trailer: [trailerNew], 'round-cap': [cap(7)], 'test-first': [testFirst] };
  expect(parseCompliance(render(first))).toEqual(first);
  expect(parseCompliance('')).toEqual(empty());
  const out = render(mergeCompliance(parseCompliance(render(first)), newer));
  for (const row of ['| tier-up | 1 |', '| trailer | 1 |', '| round-cap | 1 |', '| test-first | 1 |']) expect(out).toContain(row);
  for (const line of [tierUp, trailerOld, cap(6), testFirst]) expect(out).toContain(line);
  expect(out).not.toContain(cap(7));
  expect(out).not.toContain(trailerNew + '\n');
});

type Cmp = (input: unknown) => Record<string, string[]>;
const load = async () =>
  (await import(new URL('../../../scripts/compliance.mjs', import.meta.url).href)) as {
    compliance: Cmp;
    quoteProblem: (text: string, id: string, committed: string | undefined) => { line: number; text: string } | { missing: true } | undefined;
  };
const COMMITTED = '---\nid: "T-1"\nstatus: open\n---\n\n## Intent\n<!-- a\nmulti-line comment -->\n- Why: x\n- Not: y\n\n## Decisions\n- D-01 z\n';

it('risk:parsing a brief that quotes part of a ticket is flagged only for lines the committed file lacks', async () => {
  const { quoteProblem } = await load();
  expect(quoteProblem(COMMITTED.split('\n').slice(0, 6).join('\n'), 'T-1', COMMITTED)).toBeUndefined();
  expect(quoteProblem('## Intent\n- Why: x\n- Not: y', 'T-1', COMMITTED)).toBeUndefined();
  expect(quoteProblem(COMMITTED + '\n---\n# Task brief\n', 'T-1', COMMITTED)).toBeUndefined();
  expect(quoteProblem('## Intent\n- Why: CHANGED', 'T-1', COMMITTED)).toEqual({ line: 2, text: '- Why: CHANGED' });
});

it('risk:regression brief-quote compares with the ticket the run read, not the session branch, and skips its own ticket read', async () => {
  const { compliance } = await load();
  const T2 = COMMITTED.replace('T-1', 'T-2').replace('- Why: x', '- Why: other');
  const run = (o: Record<string, unknown>) => ({ agent: 'accord-critic', desc: 'Critic plan', ticket: 'T-2', task: null, fix: false, commits: [], edits: [], sends: [], handbacks: [], file: 'r.jsonl', ...o });
  const common = { refusals: [], commits: [], tickets: {}, settings: { tierUp: 4, executorModel: 'sonnet' }, commitInfo: () => undefined, testFile: () => undefined, ticketAt: (id: string) => (id === 'T-1' ? COMMITTED : T2) };
  const path = 'C:/w/accord/tickets/T-1.md';
  const out = compliance({
    ...common,
    runs: [
      // the branch says T-2, the brief named and the run read T-1: no false line
      run({ file: 'a.jsonl', dispatch: { ts: 1, prompt: `Read ${path}\n${COMMITTED}` }, reads: [{ path, text: COMMITTED }] }),
      // the agent's own read of its ticket (upper-case id) is not a quote
      run({ file: 'b.jsonl', ticket: 'T-1', dispatch: { ts: 1, prompt: `Read ${path}` }, reads: [{ path, text: COMMITTED.replace('x', 'q') }] }),
    ],
  });
  expect(out['brief-quote']).toEqual([]);
});

it('risk:parsing test-first words an order seen apart from no test edit seen', async () => {
  const { compliance } = await load();
  const run = (file: string, paths: string[]) => ({ agent: 'accord-executor', desc: 'Build T-1 task 1', ticket: 'T-1', task: 1, fix: false, commits: [], reads: [], sends: [], handbacks: [], file, dispatch: { cwd: 'C:/w', ts: 1 }, edits: paths.map((p) => ({ path: `C:/w/${p}` })) });
  const out = compliance({ runs: [run('a.jsonl', ['src/a.ts', 'test/a.test.ts']), run('b.jsonl', ['src/a.ts'])], refusals: [], commits: [], tickets: {}, settings: { tierUp: 4, executorModel: 'sonnet' }, commitInfo: () => undefined, testFile: () => undefined });
  const [a, b] = out['test-first'];
  expect(a).toContain('first edit to a source file (src/a.ts) came before its first edit to a test file');
  expect(a).toContain('a.jsonl');
  expect(b).toContain('first edit to a source file (src/a.ts), no test edit seen through Edit or Write');
  expect(b).not.toContain('came before');
});

it('risk:regression the tier-up line names the task of the fix executor', async () => {
  const { compliance } = await load();
  const out = compliance({
    runs: [{ agent: 'accord-executor', desc: 'Fix T-1 final review', ticket: 'T-1', task: null, fix: true, commits: ['abc1234'], start: 0, end: 10, edits: [], reads: [], sends: [], handbacks: [], file: 'f.jsonl', dispatch: { model: 'sonnet' } }],
    refusals: [], commits: [], tickets: { 'T-1': { review: '## Round 4\n\nShould 1: x — fixed in abc1234\n', ledger: '' } }, settings: { tierUp: 4, executorModel: 'sonnet' },
    commitInfo: () => ({ sha: 'abc1234'.padEnd(40, '0'), at: 5, message: 'T-1 task 3: fix' }), testFile: () => undefined,
  });
  expect(out['tier-up']).toHaveLength(1);
  expect(out['tier-up'][0]).toContain("task 3");
  expect(out['tier-up'][0]).toContain('T-1 review round 4');
});
