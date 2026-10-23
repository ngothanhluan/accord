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
      result('b1', '[main abc1234] T-1 task 2: work\n 1 file changed\nfff0000 older'),
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
    expect(run.reads).toEqual([{ path: 'C:/tmp/brief.md', text: 'line one\nline two', ts: Date.parse('2026-10-01T00:05:00Z'), start: 1, total: null, wrote: false, whole: true }]);
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

it('risk:parsing a commit sha comes only from git commit summary lines, whatever options sit before commit', async () => {
  const { readSessions } = (await import(new URL('../../../scripts/benchmark.mjs', import.meta.url).href)) as { readSessions: (dirs: string[]) => { runs: Run[] } };
  const tmp = realpathSync.native(mkdtempSync(join(tmpdir(), 'bench-')));
  try {
    const folder = join(tmp, 'C--Work-y');
    const sub = join(folder, 'S1', 'subagents');
    mkdirSync(sub, { recursive: true });
    writeFileSync(join(folder, 'S1.jsonl'), jl({ type: 'assistant', timestamp: '2026-10-01T00:00:00Z', message: { content: [{ type: 'tool_use', id: 'toolu_A', name: 'Agent', input: { description: 'Build T-1 task 2', prompt: 'x' } }] } }));
    writeFileSync(join(sub, 'agent-y1.meta.json'), JSON.stringify({ agentType: 'accord-executor', description: 'Build T-1 task 2', toolUseId: 'toolu_A' }));
    const bash = (id: string, command: string) => ({ type: 'assistant', timestamp: '2026-10-01T00:01:00Z', message: { id, model: 'm', content: [{ type: 'tool_use', id, name: 'Bash', input: { command } }] } });
    const result = (id: string, content: string) => ({ type: 'user', message: { content: [{ type: 'tool_result', tool_use_id: id, content }] } });
    writeFileSync(join(sub, 'agent-y1.jsonl'), jl(
      bash('b1', 'git -c user.name=t -c "user.email=a b" commit -q -F m.txt && git log --oneline -3'),
      result('b1', '[t/T-1 aaaaaaa] one\n 1 file changed\nbbbbbbb older\nccccccc oldest'),
      bash('b2', 'git -C ../wt commit -m two'),
      result('b2', '[main (root-commit) ddddddd] two\n'),
      bash('b3', 'git log --oneline -3'),
      result('b3', 'eeeeeee not a commit command'),
    ));
    expect(readSessions([folder]).runs[0].commits).toEqual(['aaaaaaa', 'ddddddd']);
  } finally {
    rmSync(tmp, { recursive: true, force: true, maxRetries: 5 });
  }
}, 120_000);

it('risk:parsing a read keeps its first line number, total lines, whole-file flag and wrote flag, a cat of one file is a read, and a later coordinator message ends the root reads', async () => {
  type Read = { path: string; text: string; start: number | null; total: number | null; wrote: boolean; whole: boolean };
  const { readSessions, rootReads } = (await import(new URL('../../../scripts/benchmark.mjs', import.meta.url).href)) as {
    readSessions: (dirs: string[]) => { runs: (Omit<Run, 'reads'> & { reads: Read[] })[] };
    rootReads: (run: unknown, root: string) => { path: string }[];
  };
  const tmp = realpathSync.native(mkdtempSync(join(tmpdir(), 'bench-')));
  try {
    const folder = join(tmp, 'C--Work-z');
    const sub = join(folder, 'S1', 'subagents');
    mkdirSync(sub, { recursive: true });
    const at = (n: number) => `2026-10-01T00:0${n}:00Z`;
    const send = { type: 'tool_use', id: 'toolu_S', name: 'SendMessage', input: { to: 'z1', message: 'more' } };
    writeFileSync(join(folder, 'S1.jsonl'), jl(
      { type: 'assistant', timestamp: at(0), message: { content: [{ type: 'tool_use', id: 'toolu_A', name: 'Agent', input: { description: 'Build T-1 task 1', prompt: 'x' } }] } },
      { type: 'assistant', timestamp: at(6), message: { content: [send] } },
    ));
    writeFileSync(join(sub, 'agent-z1.meta.json'), JSON.stringify({ agentType: 'accord-executor', description: 'Build T-1 task 1', toolUseId: 'toolu_A' }));
    let n = 0;
    const call = (name: string, input: unknown) => ({ type: 'assistant', timestamp: at(++n > 9 ? 9 : n), message: { id: `m${n}`, model: 'm', content: [{ type: 'tool_use', id: `t${n}`, name, input }] } });
    const res = (content: string, total?: number) => ({ type: 'user', message: { content: [{ type: 'tool_result', tool_use_id: `t${n}`, content }] }, ...(total === undefined ? {} : { toolUseResult: { file: { totalLines: total } } }) });
    writeFileSync(join(sub, 'agent-z1.jsonl'), jl(
      call('Read', { file_path: 'C:/r/whole.ts' }), res('     1\tl1\n     2\tl2\n<system-reminder>\nnote\n</system-reminder>', 2),
      call('Read', { file_path: 'C:/r/cut.ts', offset: 5, limit: 2 }), res('     5\tx\n     6\ty', 100),
      call('Read', { file_path: 'C:/r/short.ts' }), res('     1\tonly', 40),
      call('Read', { file_path: 'C:/r/nototal.ts' }), res('     1\tn1\n     2\tn2'),
      call('Read', { file_path: 'C:/r/error.ts' }), res('File does not exist.'),
      call('Edit', { file_path: 'C:/r/edited.ts' }), res('ok'),
      call('Read', { file_path: 'C:/r/EDITED.ts' }), res('     1\te1', 1),
      call('Bash', { command: 'cat "C:/r/a b.txt"' }), res('quoted\n'),
      call('Bash', { command: "cat 'C:/r/q.txt'" }), res('single\n'),
      call('Bash', { command: String.raw`cat C:\r\u.txt` }), res('bare\n'),
      call('Bash', { command: 'cat -n C:/r/f.txt' }), res('flag\n'),
      call('Bash', { command: 'cat C:/r/a.txt C:/r/b.txt' }), res('two\n'),
      call('Read', { file_path: 'C:/r/late.ts' }), res('     1\tlate', 1),
    ));
    const run = readSessions([folder]).runs[0];
    const by = (p: string) => run.reads.find((r) => r.path === p);
    expect(by('C:/r/whole.ts')).toMatchObject({ text: 'l1\nl2', start: 1, total: 2, wrote: false, whole: true });
    expect(by('C:/r/cut.ts')).toMatchObject({ text: 'x\ny', start: 5, total: 100, whole: false });
    expect(by('C:/r/short.ts')).toMatchObject({ start: 1, total: 40, whole: false });
    expect(by('C:/r/nototal.ts')).toMatchObject({ start: 1, total: null, whole: true });
    expect(by('C:/r/error.ts')).toMatchObject({ start: null, whole: false });
    expect(by('C:/r/EDITED.ts')).toMatchObject({ wrote: true });
    expect(by('C:/r/a b.txt')).toMatchObject({ text: 'quoted', start: 1, whole: true });
    expect(by('C:/r/q.txt')).toMatchObject({ text: 'single' });
    expect(by('C:/r/u.txt')).toMatchObject({ text: 'bare' });
    expect(run.reads.some((r) => ['C:/r/f.txt', 'C:/r/a.txt', 'C:/r/b.txt'].includes(r.path))).toBe(false);
    // The root reads drop a read with no numbered first line, one after a write, and one after the coordinator's next message.
    const seen = rootReads(run, 'C:/r').map((r) => r.path);
    expect(seen).toContain('whole.ts');
    expect(seen).not.toContain('error.ts');
    expect(seen).not.toContain('EDITED.ts');
    expect(seen).not.toContain('late.ts');
  } finally {
    rmSync(tmp, { recursive: true, force: true, maxRetries: 5 });
  }
}, 120_000);

it("risk:parsing a run's report is its last hand-back, not a text written after a later notification", async () => {
  const { readSessions } = (await import(new URL('../../../scripts/benchmark.mjs', import.meta.url).href)) as { readSessions: (dirs: string[]) => { runs: (Run & { lastText: string })[] } };
  const { mustsOf } = (await import(new URL('../../../scripts/round.mjs', import.meta.url).href)) as { mustsOf: (a: string, t: string) => string[] };
  const tmp = realpathSync.native(mkdtempSync(join(tmpdir(), 'bench-')));
  try {
    const folder = join(tmp, 'C--Work-w');
    const sub = join(folder, 'S1', 'subagents');
    mkdirSync(sub, { recursive: true });
    writeFileSync(join(folder, 'S1.jsonl'), jl({ type: 'assistant', timestamp: '2026-10-01T00:00:00Z', message: { content: [{ type: 'tool_use', id: 'toolu_A', name: 'Agent', input: { description: 'Review T-1', prompt: 'x' } }] } }));
    writeFileSync(join(sub, 'agent-w1.meta.json'), JSON.stringify({ agentType: 'accord-reviewer', description: 'Review T-1', toolUseId: 'toolu_A' }));
    const asst = (id: string, content: unknown[]) => ({ type: 'assistant', timestamp: '2026-10-01T00:01:00Z', message: { id, model: 'm', content } });
    const text = (t: string) => ({ type: 'text', text: t });
    const message = 'DONE\n1. Must — x';
    writeFileSync(join(sub, 'agent-w1.jsonl'), jl(
      asst('m1', [text('working')]),
      asst('m2', [{ type: 'tool_use', id: 'h1', name: 'SubagentHandback', input: { message } }]),
      { type: 'user', message: { content: '[SYSTEM NOTIFICATION - NOT USER INPUT] background task finished' } },
      asst('m3', [text('The report was already delivered.')]),
    ));
    const run = readSessions([folder]).runs[0];
    expect(run.lastText).toBe(message);
    expect(run.outcome).toBe('DONE');
    expect(mustsOf('accord-reviewer', run.lastText)).toHaveLength(1);

    // no hand-back: the last text is the report
    writeFileSync(join(sub, 'agent-w1.jsonl'), jl(asst('m1', [text('working')]), asst('m2', [text('DONE\nlast')])));
    expect(readSessions([folder]).runs[0].lastText).toBe('DONE\nlast');
  } finally {
    rmSync(tmp, { recursive: true, force: true, maxRetries: 5 });
  }
}, 120_000);
