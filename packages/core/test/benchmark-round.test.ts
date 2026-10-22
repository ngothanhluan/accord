import { mkdirSync, mkdtempSync, readdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, it } from 'vitest';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const jl = (...lines: unknown[]) => lines.map((l) => JSON.stringify(l)).join('\n') + '\n';

type Sample = Record<string, unknown> & { agent: string; n: number };
type List = { round: number; samples: Sample[] };

function listOf(agents: string[]): List {
  const samples: Sample[] = [];
  for (const agent of agents) {
    for (let n = 1; n <= 5; n++) {
      const s: Sample = {
        agent, n, transcript: 'C--Work-x/S/subagents/agent-' + n + '.jsonl', ticket: 'T-' + n,
        base: 'a'.repeat(40), main: 'a'.repeat(40), root: 'C:/Work/x', elsewhere: [], files: [], pairs: [],
      };
      if (agent === 'accord-executor') { s.task = String(n); s.kind = n <= 2 ? 'plain' : 'risk'; }
      samples.push(s);
    }
  }
  return { round: 1, samples };
}

it('ac-1 every agent sample runs at its current effort and one step either side and each differing turn is flagged', async () => {
  const round = (await import(new URL('../../../scripts/round.mjs', import.meta.url).href)) as {
    EFFORTS: string[]; ROLES: Record<string, string>;
    checkSamples: (l: unknown) => string[];
    runMatrix: (l: unknown, s: unknown) => { agent: string; model: string; effort: string; current: boolean }[];
    turnFlags: (t: unknown[], w: { model: string; effort: string }) => { turn: number; field: string }[];
    flagSection: (e: unknown[]) => string;
  };
  const { agentSettings, readSessions } = (await import(new URL('../../../scripts/benchmark.mjs', import.meta.url).href)) as {
    agentSettings: (repo: string) => Record<string, { model: string; effort: string }>;
    readSessions: (d: string[]) => { runs: { turns: unknown[] }[] };
  };
  const { EFFORTS, ROLES } = round;
  const agents = Object.keys(ROLES);
  const list = listOf(agents);
  expect(round.checkSamples(list)).toEqual([]);
  const settings = agentSettings(root);
  const rows = round.runMatrix(list, settings);
  expect(rows).toHaveLength(130);
  for (const s of list.samples) {
    const own = rows.filter((r) => r.agent === s.agent);
    const cfg = settings[s.agent];
    const i = EFFORTS.indexOf(cfg.effort);
    const want = s.agent === 'accord-scout' ? ['low', 'medium'] : EFFORTS.slice(Math.max(0, i - 1), i + 2);
    const perSample = own.length / 5;
    expect(perSample).toBe(want.length);
    const first = own.slice((s.n - 1) * want.length, s.n * want.length);
    expect(first.map((r) => r.effort)).toEqual(want);
    expect(first.every((r) => r.model === cfg.model)).toBe(true);
    const cur = first.filter((r) => r.current);
    expect(cur).toHaveLength(1);
    expect(cur[0].effort).toBe(cfg.effort);
  }
  const exec = { ...list, samples: list.samples.map((s) => (s.agent === 'accord-executor' ? { ...s, kind: 'plain' } : s)) };
  expect(round.checkSamples(exec).join('\n')).toContain('risk');
  expect(round.checkSamples({ ...list, samples: list.samples.filter((s) => s.agent !== 'accord-scout') }).join('\n')).toContain('accord-scout');
  expect(round.checkSamples(listOf([...agents, 'accord-debugger'])).join('\n')).toContain('accord-debugger');
  const badRoot = { ...list, samples: list.samples.map((s, i) => (i === 0 ? { ...s, root: 'work/x' } : s)) };
  expect(round.checkSamples(badRoot).join('\n')).toContain('root');

  const tmp = realpathSync.native(mkdtempSync(join(tmpdir(), 'bench-')));
  try {
    const folder = join(tmp, 'C--Work-y');
    const sub = join(folder, 'S', 'subagents');
    mkdirSync(sub, { recursive: true });
    writeFileSync(join(folder, 'S.jsonl'), jl({ type: 'user', message: { content: 'x' } }));
    const turn = (id: string, extra: Record<string, unknown> = {}, model = 'claude-sonnet-5-5') => ({
      type: 'assistant', timestamp: '2026-10-01T00:00:00Z', requestedModel: 'claude-sonnet-5-5', perTurnEffort: 'low', ...extra,
      message: { id, model, usage: { input_tokens: 1, output_tokens: 1 }, content: [{ type: 'text', text: id }] },
    });
    const meta = (d: string) => JSON.stringify({ agentType: 'accord-executor', description: d, toolUseId: 'toolu_none' });
    writeFileSync(join(sub, 'agent-r1.jsonl'), jl(turn('m1'), turn('m2', { perTurnEffort: 'medium' }), turn('m3', {}, 'claude-opus-5-5'), turn('m4', { requestedModel: 'claude-haiku-4-5' })));
    writeFileSync(join(sub, 'agent-r1.meta.json'), meta('bench r1 executor-1-low'));
    writeFileSync(join(sub, 'agent-r2.jsonl'), jl(turn('m1'), turn('m2')));
    writeFileSync(join(sub, 'agent-r2.meta.json'), meta('bench r1 executor-2-low'));
    const { runs } = readSessions([folder]);
    const byId = (id: string) => runs.find((r) => (r as unknown as { file: string }).file.endsWith(`agent-${id}.jsonl`))!;
    const want = { model: 'sonnet', effort: 'low' };
    const f1 = round.turnFlags(byId('r1').turns, want);
    expect(f1.map((f) => [f.turn, f.field])).toEqual([[2, 'perTurnEffort'], [3, 'message.model'], [4, 'requestedModel']]);
    expect(round.turnFlags(byId('r2').turns, want)).toEqual([]);
    const both = round.flagSection([{ tag: 'executor-1-low', flags: f1 }, { tag: 'executor-2-low', flags: [] }]);
    expect(both).toContain('Turns that differ from the dispatched setting: 3');
    expect(both).toContain('- executor-1-low turn 2: perTurnEffort is medium where the round dispatched low');
    expect(round.flagSection([{ tag: 'executor-2-low', flags: [] }])).toContain('Turns that differ from the dispatched setting: 0');
  } finally {
    rmSync(tmp, { recursive: true, force: true, maxRetries: 5 });
  }
}, 120_000);

it('risk:parsing a brief keeps the ticket text byte for byte while its root and refs are rewritten', async () => {
  const round = (await import(new URL('../../../scripts/round.mjs', import.meta.url).href)) as {
    rewriteBrief: (text: string, o: Record<string, unknown>) => { text: string; problems: string[] };
    stripReadPrefixes: (t: string) => string;
    dispatchTable: (rows: Record<string, unknown>[]) => string;
  };
  const ticket = '---\nid: "T-1"\n---\n\n## Intent\nRun in C:/Work/accord on `main` and `t/T-1`.\n';
  const tail = 'Work in C:\\Work\\accord-ln7\\src, branch t/T-1, and never touch C:/Work/accord. Run `git diff origin/main...HEAD`. The main session keeps function main( in domain.ts.\n';
  const prompt = 'Repository root: C:/Work/accord-ln7\n' + ticket + '\n---\n\n' + tail;
  const S = 'a'.repeat(40);
  const W = 'C:/Work/accord-bench/wt/reviewer-1';
  const A = 'C:/Work/accord-bench/absent/1';
  const paths = [['C:/Work/accord-ln7', W], ['C:/Work/accord', A]];
  const check = { bench: 'C:/Work/accord-bench', allowed: [] as string[] };
  const pairs = [['origin/main', S], ['t/T-1', S], ['HEAD', S]];

  const r = round.rewriteBrief(prompt, { ticket, paths, pairs, check });
  expect(r.problems).toEqual([]);
  const head = 'Repository root: ' + W + '\n';
  expect(r.text.startsWith(head)).toBe(true);
  expect(r.text.indexOf(ticket)).toBe(head.length);
  expect(r.text.endsWith('Work in C:\\Work\\accord-bench\\wt\\reviewer-1\\src, branch ' + S + ', and never touch ' + A + '. Run `git diff ' + S + '...' + S + '`. The main session keeps function main( in domain.ts.\n')).toBe(true);

  const none = round.rewriteBrief(prompt, { ticket, paths, pairs: [], check });
  expect(none.problems).toHaveLength(3);
  for (const w of ['origin/main', 'HEAD', 't/T-1']) expect(none.problems.filter((p) => p.includes(w))).toHaveLength(1);

  const one = round.rewriteBrief(prompt, { ticket, paths: [paths[0]], pairs, check });
  expect(one.problems).toEqual(['absolute path C:/Work/accord outside the bench root is left in the brief']);

  const w = round.rewriteBrief(prompt, { ticket, paths, pairs: [['origin/main', S], ['t/T-1', 'bench/executor-1-low']], check: { bench: 'C:/Work/accord-bench', allowed: ['HEAD', 'bench/executor-1-low'] } });
  expect(w.problems).toEqual([]);
  expect(w.text).toContain('branch bench/executor-1-low,');
  expect(w.text).toContain('git diff ' + S + '...HEAD`');

  const changed = round.rewriteBrief(prompt.replace('## Intent', '## Intent!'), { ticket, paths, pairs, check });
  expect(changed.problems).toHaveLength(1);
  expect(changed.problems[0]).toContain('does not hold the ticket at base byte for byte');

  expect(round.stripReadPrefixes('     1\tone\n     2\ttwo\n<system-reminder>\nx\n')).toBe('one\ntwo');
  const t = round.dispatchTable([{ tag: 'executor-1-low', agent: 'accord-executor', model: 'sonnet', effort: 'low', prompt: 'C:/b/x.md', judge: { agent: 'accord-reviewer', model: 'opus', effort: 'high' } }]);
  expect(t).toContain('| description | subagent_type | model | effort | prompt file | judge |');
  expect(t).toContain('| bench r1 executor-1-low | accord-executor | sonnet | low | C:/b/x.md | accord-reviewer opus high |');
});

it('ac-2 a run holds only when it is no worse than the current effort on the same sample', async () => {
  const r = (await import(new URL('../../../scripts/round.mjs', import.meta.url).href)) as {
    runMatrix: (l: unknown, s: unknown) => { agent: string; current: boolean; judge: { agent: string; model: string; effort: string } | null }[];
    holds: (a: string, o: Record<string, unknown>) => boolean | null;
    parseVerdict: (k: string, t: string, n: number) => unknown;
    mustsOf: (a: string, report: string, verification?: string) => string[];
    judgeBrief: (k: string, o: Record<string, unknown>) => string;
  };
  const { agentSettings } = (await import(new URL('../../../scripts/benchmark.mjs', import.meta.url).href)) as {
    agentSettings: (repo: string) => Record<string, { model: string; effort: string }>;
  };
  const { holds } = r;
  for (const [agent, key] of [['accord-executor', 'suite'], ['accord-planner', 'gate']] as const) {
    expect(holds(agent, { current: false, [key]: true, verdict: { must: 1 }, currentVerdict: { must: 1 } })).toBe(true);
    expect(holds(agent, { current: false, [key]: false, verdict: { must: 1 }, currentVerdict: { must: 1 } })).toBe(false);
    expect(holds(agent, { current: false, [key]: true, verdict: { must: 2 }, currentVerdict: { must: 1 } })).toBe(false);
    expect(holds(agent, { current: false, [key]: true, verdict: null, currentVerdict: { must: 1 } })).toBe(null);
    expect(holds(agent, { current: true, [key]: true })).toBe(true);
    expect(holds(agent, { current: true, [key]: false })).toBe(false);
  }
  for (const agent of ['accord-critic', 'accord-reviewer', 'accord-final-reviewer', 'accord-auditor', 'accord-verifier']) {
    expect(holds(agent, { current: false, verdict: { same: [true, true], newMusts: 0 } })).toBe(true);
    expect(holds(agent, { current: false, verdict: { same: [true, false], newMusts: 0 } })).toBe(false);
    expect(holds(agent, { current: false, verdict: { same: [], newMusts: 3 } })).toBe(true);
    expect(holds(agent, { current: false })).toBe(null);
    expect(holds(agent, { current: true })).toBe(true);
  }
  for (const agent of ['accord-architect', 'accord-scout']) {
    expect(holds(agent, { current: false, verdict: { wrongFacts: 0 } })).toBe(true);
    expect(holds(agent, { current: false, verdict: { wrongFacts: 1 } })).toBe(false);
    expect(holds(agent, { current: true, verdict: { wrongFacts: 1 } })).toBe(false);
  }

  expect(r.parseVerdict('must', 'findings\n1. Must — x\nMust findings: 1\n', 0)).toEqual({ must: 1 });
  expect(r.parseVerdict('match', 'M1: same\nM2: missed\nnew Musts: 1\n', 2)).toEqual({ same: [true, false], newMusts: 1 });
  expect(r.parseVerdict('match', 'M1: same\nnew Musts: 1\n', 2)).toBe(null);
  expect(r.parseVerdict('fact', 'wrong facts: 0\n', 0)).toEqual({ wrongFacts: 0 });
  for (const k of ['must', 'match', 'fact']) expect(r.parseVerdict(k, '', 0)).toBe(null);

  expect(r.mustsOf('accord-critic', '1. Must — a\n2. Should — b\n3. **Must** — c\n')).toEqual(['1. Must — a', '3. **Must** — c']);
  expect(r.mustsOf('accord-auditor', '@ac-1: one reading\n@ac-2: "x" or "y", split by "each"\n')).toEqual(['@ac-2: "x" or "y", split by "each"']);
  expect(r.mustsOf('accord-verifier', '', '## @ac-1\nResult: pass\n\n## @ac-2\nResult: fail\n\n## @ac-3\nResult: blocked\n')).toEqual(['@ac-2 fail', '@ac-3 blocked']);

  const list = JSON.parse(readFileSync(join(root, 'scripts', 'benchmark-samples.json'), 'utf8'));
  const rows = r.runMatrix(list, agentSettings(root));
  const finding = ['accord-critic', 'accord-reviewer', 'accord-final-reviewer', 'accord-auditor', 'accord-verifier'];
  for (const row of rows) {
    expect(row.judge === null).toBe(finding.includes(row.agent) && row.current);
    if (row.judge) {
      expect(row.judge.model).toBe('opus');
      expect(row.judge.effort).toBe('high');
      expect(row.judge.agent).toBe(row.agent === 'accord-executor' ? 'accord-reviewer' : 'accord-critic');
    }
  }

  const base = { agent: 'accord-reviewer', ticket: 't.md', worktree: 'w', base: 'b', reference: ['1. Must — a'], report: 'r' };
  const m = r.judgeBrief('match', base);
  expect(m).toContain('M1: 1. Must — a');
  expect(m).toContain('exactly `M<k>: same` or `M<k>: missed`');
  expect(m).toContain('new Musts: <n>');
  expect(r.judgeBrief('must', base)).toContain('Must findings: <n>');
  expect(r.judgeBrief('fact', base)).toContain('wrong facts: <n>');
  const a = r.judgeBrief('match', { ...base, agent: 'accord-auditor', reference: ['@ac-2: "x" or "y"'] });
  expect(a).toContain('M1: @ac-2: "x" or "y"');
  expect(a).toContain('read that criterion two ways too');
  const v = r.judgeBrief('match', { ...base, agent: 'accord-verifier', reference: ['@ac-2 fail'] });
  expect(v).toContain('M1: @ac-2 fail');
  expect(v).toContain('marked that criterion fail or blocked');
});

it('ac-3 the report suggests an effort for each agent and changes no agent definition', async () => {
  type R = { tag: string; agent: string; n: number; kind: string | null; effort: string; current: boolean; held: boolean | null; ms: number; usage: Record<string, unknown>; verdict: unknown; reference?: number };
  const round = (await import(new URL('../../../scripts/round.mjs', import.meta.url).href)) as {
    suggest: (r: R[], s: unknown) => Record<string, { current: string; suggested: string; heldAll: string[] }>;
    report: (r: R[], s: unknown, o: { flags: unknown[]; unjudged: unknown[]; compliance: string }) => string;
  };
  const { writeReport } = (await import(new URL('../../../scripts/benchmark.mjs', import.meta.url).href)) as { writeReport: (root: string, text: string) => string };
  const settings = { 'accord-executor': { model: 'sonnet', effort: 'medium' }, 'accord-critic': { model: 'opus', effort: 'high' }, 'accord-scout': { model: 'haiku', effort: 'low' } };
  const mk = (agent: string, effort: string, over: (n: number) => Partial<R> = () => ({})): R[] =>
    [1, 2, 3, 4, 5].map((n) => ({
      tag: `${agent}-${n}-${effort}`, agent, n, effort, current: effort === settings[agent as keyof typeof settings].effort,
      kind: agent === 'accord-executor' ? ([1, 3, 5].includes(n) ? 'plain' : 'risk') : null, held: true, ms: 60_000,
      usage: { input: 1, cacheRead: 1, cacheWrite: 1, output: 1, estimated: false }, verdict: null, ...over(n),
    }));
  const build = (low: (n: number) => Partial<R> = () => ({}), high: (n: number) => Partial<R> = () => ({})) => [
    ...mk('accord-executor', 'low', (n) => ({ ms: 120_000, usage: { input: 100, cacheRead: 200, cacheWrite: 30, output: 40, estimated: n === 1 }, ...low(n) })),
    ...mk('accord-executor', 'medium', () => ({ verdict: { must: 1 } })),
    ...mk('accord-executor', 'high', (n) => ({ verdict: { must: n === 2 ? 0 : 1 } })),
    ...mk('accord-critic', 'medium', (n) => ({ held: n !== 5 })),
    ...mk('accord-critic', 'high', (n) => ({ reference: n === 4 ? 0 : 1, ...high(n) })),
    ...mk('accord-critic', 'xhigh', (n) => (n === 3 ? { verdict: { same: [true], newMusts: 1 } } : { verdict: { same: [], newMusts: 0 } })),
    ...mk('accord-scout', 'low'), ...mk('accord-scout', 'medium'),
  ];
  const section = (t: string, h: string) => t.split(/^(?=## )/m).find((s) => s.startsWith(h))!.split('\n').slice(1).filter(Boolean);
  const out = { flags: [], unjudged: [], compliance: '## Compliance\n' };

  const text = round.report(build(), settings, out);
  expect(text).toContain('| agent | effort | runs | runs held | median min | median input | median cache read | median cache write | median output |');
  expect(text).toContain('| accord-executor | low | 5 | 5 | 2.0 | 100 | 200 | 30 | ~40 |');
  expect(text).toContain('| accord-critic | medium | 5 | 4 |');
  for (const row of ['| accord-executor | sonnet | medium | low |', '| accord-critic | opus | high | high |', '| accord-scout | haiku | low | low |',
    'accord-scout: every effort tried held on all 5 samples; nothing below low was measured.',
    'accord-executor: every effort tried held on all 5 samples; nothing below low was measured.']) expect(text).toContain(row);
  expect(section(text, '## Higher effort did better')).toEqual([
    '- accord-executor sample 2 (high): the judge found 0 Must findings where the current run had 1',
    '- accord-critic sample 3 (xhigh): reported 1 Must the current run missed']);
  expect(section(text, '## Samples that held at every effort by default')).toEqual(['- accord-critic sample 4: the current-effort run reported no Must, so every effort held there by default.']);
  expect(section(text, '## Samples not held')).toEqual(['- accord-critic medium: sample 5']);
  expect(text).toContain('Turns that differ from the dispatched setting: 0');
  expect(text).toContain('## Compliance');
  const all1 = build(undefined, () => ({ reference: 1 }));
  expect(section(round.report(all1, settings, out), '## Samples that held at every effort by default')).toEqual(['None.']);

  const worse = round.report(build((n) => (n === 2 || n === 4 ? { held: false } : {})), settings, out);
  expect(section(worse, '## Samples not held')).toEqual(['- accord-executor low: sample 2 (risk), sample 4 (risk)', '- accord-critic medium: sample 5']);

  const noHigh = build(undefined, (n) => (n === 1 ? { held: false } : {}));
  expect(round.suggest(noHigh, settings)['accord-critic']).toEqual({ current: 'high', suggested: 'high', heldAll: ['xhigh'] });
  expect(round.report(noHigh, settings, out)).toContain('accord-critic: held on all 5 samples only at xhigh.');
  const none = noHigh.map((r) => (r.agent === 'accord-critic' && r.effort === 'xhigh' && r.n === 1 ? { ...r, held: false } : r));
  expect(round.report(none, settings, out)).toContain('accord-critic: no effort tried held on all 5 samples.');

  const dir = realpathSync.native(mkdtempSync(join(tmpdir(), 'bench-')));
  try {
    mkdirSync(join(dir, '.claude', 'agents'), { recursive: true });
    mkdirSync(join(dir, 'packages', 'core', 'agents'), { recursive: true });
    writeFileSync(join(dir, '.claude', 'agents', 'accord-executor.md'), 'a');
    writeFileSync(join(dir, 'packages', 'core', 'agents', 'executor.md'), 'b');
    const list = () => readdirSync(dir, { recursive: true, withFileTypes: true }).filter((e) => e.isFile()).map((e) => join(e.parentPath, e.name).slice(dir.length + 1).replace(/\\/g, '/')).sort();
    const before = list();
    const written = writeReport(dir, text);
    expect(written).toBe('docs/benchmark/round-1.md');
    expect(list()).toEqual([...before, 'docs/benchmark/round-1.md'].sort());
    expect(readFileSync(join(dir, '.claude', 'agents', 'accord-executor.md'), 'utf8')).toBe('a');
    expect(readFileSync(join(dir, 'packages', 'core', 'agents', 'executor.md'), 'utf8')).toBe('b');
    expect(readFileSync(join(dir, written), 'utf8')).toBe(text);
  } finally {
    rmSync(dir, { recursive: true, force: true, maxRetries: 5 });
  }
});

it('risk:complex-branching runs and judges are matched by tag and every tag with no run or two runs is named', async () => {
  type Run = { desc: string; sends: unknown[] };
  const { matchRuns } = (await import(new URL('../../../scripts/round.mjs', import.meta.url).href)) as {
    matchRuns: (rows: unknown[], runs: Run[], o: { judges: boolean }) => {
      runs: Map<string, Run>; judges: Map<string, Run>; missing: string[]; duplicate: string[]; notFresh: string[]; extra: Run[];
    };
  };
  const judge = { agent: 'accord-reviewer', model: 'opus', effort: 'high' };
  const rows = [
    { tag: 'executor-1-low', judge },
    { tag: 'critic-1-high', judge: null },
    { tag: 'critic-1-xhigh', judge },
  ];
  const run = (desc: string, sends: unknown[] = []): Run => ({ desc, sends });
  const first = run('bench r1 executor-1-low');
  const jA = run('bench r1 executor-1-low judge');
  const jC = run('bench r1 critic-1-xhigh judge', [{ message: 'again' }]);
  const jB = run('bench r1 critic-1-high judge');
  const runs = [first, run('bench r1 critic-1-high'), run('bench r1 critic-1-high'), jA, jC, jB];

  const a = matchRuns(rows, runs, { judges: false });
  expect(a.missing).toEqual(['bench r1 critic-1-xhigh']);
  expect(a.duplicate).toEqual(['bench r1 critic-1-high (2 runs)']);
  expect(a.runs.get('executor-1-low')).toBe(first);

  const b = matchRuns(rows, runs, { judges: true });
  expect(b.missing).toEqual(['bench r1 critic-1-xhigh']);
  expect(b.duplicate).toEqual(['bench r1 critic-1-high (2 runs)']);
  expect(b.judges.get('executor-1-low')).toBe(jA);
  expect(b.notFresh).toEqual(['critic-1-xhigh']);
  expect(b.extra).toEqual([jB]);

  const c = matchRuns(rows, runs.filter((r) => r !== jA), { judges: true });
  expect(c.missing).toEqual(['bench r1 executor-1-low judge', 'bench r1 critic-1-xhigh']);
});
