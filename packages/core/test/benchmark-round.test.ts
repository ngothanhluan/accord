import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
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
