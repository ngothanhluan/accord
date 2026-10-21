import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';

type Turn = { id: string; model: string; requestedModel: string; perTurnEffort: string };
type Run = { turns: Turn[]; edits: { path: string }[]; handbacks: { text: string }[]; commits: string[]; reads: unknown[]; sends: unknown[]; usage: unknown; dispatch: unknown; outcome: string };
const jl = (...lines: unknown[]) => lines.map((l) => JSON.stringify(l)).join('\n') + '\n';

it('risk:parsing turns usage dispatch sends commits edits reads and task-done refusals are read from a transcript folder', async () => {
  const { readSessions } = (await import(new URL('../../../scripts/benchmark.mjs', import.meta.url).href)) as {
    readSessions: (dirs: string[]) => { runs: Run[]; refusals: unknown[] };
  };
  const tmp = realpathSync.native(mkdtempSync(join(tmpdir(), 'bench-')));
  try {
    const folder = join(tmp, 'C--Work-x');
    const sub = join(folder, 'S1', 'subagents');
    mkdirSync(join(sub, 'workflows'), { recursive: true });
    const asst = (ts: string | undefined, content: unknown[], extra: Record<string, unknown> = {}) => ({
      type: 'assistant', timestamp: ts, ...extra, message: { content },
    });
    const sendUse = { type: 'tool_use', id: 'toolu_S', name: 'SendMessage', input: { to: 'x1', summary: 'one more fix', message: 'fix b too' } };
    writeFileSync(join(folder, 'S1.jsonl'), jl(
      asst('2026-10-01T00:00:00Z', [{ type: 'tool_use', id: 'toolu_A', name: 'Agent', input: { description: 'Build T-1 task 2', subagent_type: 'accord-executor', model: 'sonnet', effort: 'low', prompt: 'Brief: C:/tmp/brief.md' } }], { cwd: 'C:\\Work\\x' }),
      asst('2026-10-01T00:30:00Z', [sendUse]),
      { type: 'api-request-blob', message: { role: 'assistant', content: [sendUse] } },
      asst(undefined, [{ type: 'tool_use', id: 'toolu_T', name: 'Bash', input: { command: 'accord task-done T-1 2' } }]),
      { type: 'user', timestamp: '2026-10-01T00:40:00Z', message: { content: [{ type: 'tool_result', tool_use_id: 'toolu_T', content: 'task 2 of T-1 is not done:\n  a.test.ts#b is not in r.xml\n' }] } },
    ));
    writeFileSync(join(sub, 'agent-x1.meta.json'), JSON.stringify({ agentType: 'accord-executor', description: 'Build T-1 task 2', toolUseId: 'toolu_A' }));
    const edit = { type: 'tool_use', id: 'e1', name: 'Edit', input: { file_path: 'C:\\Work\\x\\src\\a.test.ts' } };
    const bash = { type: 'tool_use', id: 'b1', name: 'Bash', input: { command: 'git commit -q -F m.txt && git log --oneline -1' } };
    const m = (id: string, ts: string | undefined, content: unknown[], usage: unknown, effort?: string) => ({
      type: 'assistant', timestamp: ts, perTurnEffort: effort, requestedModel: 'claude-sonnet-5-5',
      message: { id, model: 'claude-sonnet-5-5', usage, content },
    });
    const u = { input_tokens: 5, cache_read_input_tokens: 100, cache_creation_input_tokens: 7 };
    const result = (id: string, content: string) => ({ type: 'user', message: { content: [{ type: 'tool_result', tool_use_id: id, content }] } });
    writeFileSync(join(sub, 'agent-x1.jsonl'), jl(
      m('m1', '2026-10-01T00:01:00Z', [{ type: 'text', text: 'ok' }], { ...u, output_tokens: 10 }, 'low'),
      m('m1', '2026-10-01T00:02:00Z', [edit], { ...u, output_tokens: 40 }, 'low'),
      m('m2', '2026-10-01T00:03:00Z', [{ type: 'tool_use', id: 'e2', name: 'Write', input: { file_path: 'C:/Work/x/src/a.ts', content: 'x'.repeat(400) } }], { input_tokens: 1, output_tokens: 1 }, 'medium'),
      m('m3', '2026-10-01T00:04:00Z', [bash], { output_tokens: 50 }),
      { type: 'api-request-blob', message: { id: 'm9', role: 'assistant', content: [edit, bash] } },
      result('b1', 'abc1234 T-1 task 2: work'),
      m('m4', '2026-10-01T00:05:00Z', [{ type: 'tool_use', id: 'r1', name: 'Read', input: { file_path: 'C:/tmp/brief.md' } }], { output_tokens: 50 }),
      result('r1', '     1\tline one\n     2\tline two\n<system-reminder>\nnote\n</system-reminder>'),
      m('m5', '2026-10-01T00:20:00Z', [{ type: 'tool_use', id: 'h1', name: 'SubagentHandback', input: { message: 'DONE\ncommits: abc1234 T-1 task 2: work' } }], { output_tokens: 50 }),
    ));
    writeFileSync(join(sub, 'workflows', 'agent-zz.meta.json'), JSON.stringify({ agentType: 'accord-critic', description: 'never' }));
    writeFileSync(join(sub, 'workflows', 'agent-zz.jsonl'), jl(m('mz', undefined, [], { output_tokens: 1 })));

    const s = readSessions([folder]);
    expect(s.runs.length).toBe(1);
    const run = s.runs[0];
    expect(run).toMatchObject({ file: 'C--Work-x/S1/subagents/agent-x1.jsonl', id: 'x1', agent: 'accord-executor', ticket: 'T-1', task: 2, fix: false });
    expect(run.dispatch).toMatchObject({ model: 'sonnet', effort: 'low', prompt: 'Brief: C:/tmp/brief.md', cwd: 'C:\\Work\\x', ts: Date.parse('2026-10-01T00:00:00Z') });
    expect(run.turns.map((t: Turn) => [t.id, t.model, t.requestedModel, t.perTurnEffort]).slice(0, 2)).toEqual([
      ['m1', 'claude-sonnet-5-5', 'claude-sonnet-5-5', 'low'],
      ['m2', 'claude-sonnet-5-5', 'claude-sonnet-5-5', 'medium'],
    ]);
    expect(run.turns.map((t: Turn) => t.id)).toEqual(['m1', 'm2', 'm3', 'm4', 'm5']);
    expect(run.usage).toEqual({ input: 6, cacheRead: 100, cacheWrite: 7, output: 302, estimated: true });
    expect(run.edits.map((e: { path: string }) => e.path)).toEqual(['C:/Work/x/src/a.test.ts', 'C:/Work/x/src/a.ts']);
    expect(run.commits).toEqual(['abc1234']);
    expect(run.reads).toEqual([{ path: 'C:/tmp/brief.md', text: 'line one\nline two', ts: Date.parse('2026-10-01T00:05:00Z') }]);
    expect(run.handbacks.length).toBe(1);
    expect(run.handbacks[0].text.startsWith('DONE')).toBe(true);
    expect(run.outcome).toBe('DONE');
    expect(run.sends).toEqual([{ ts: Date.parse('2026-10-01T00:30:00Z'), to: 'x1', summary: 'one more fix', message: 'fix b too' }]);
    expect(s.refusals).toEqual([{ file: 'C--Work-x/S1.jsonl', ts: Date.parse('2026-10-01T00:40:00Z'), ticket: 'T-1', task: 2, reasons: ['a.test.ts#b is not in r.xml'] }]);
    expect(Object.keys(run).some((key) => /advisor/i.test(key))).toBe(false);
  } finally {
    rmSync(tmp, { recursive: true, force: true, maxRetries: 5 });
  }
}, 120_000);
