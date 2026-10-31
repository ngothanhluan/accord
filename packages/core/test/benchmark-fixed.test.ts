/* eslint-disable @typescript-eslint/no-explicit-any -- transcript lines are untyped JSON of Claude Code */
import { readFileSync, rmSync } from 'node:fs';
import { expect, it } from 'vitest';
import { HOOK, makeWorld } from './helpers/fixed-world.js';

type Line = Record<string, any>;
type FirstCall = {
  id: string; model: string; version: string; ts: number; cwd: string; branch: string; input: number;
  usage: { input: number; cacheRead: number; cacheWrite: number };
  instructions: { path: string; type: string }[]; skillListing: string[]; agentListing: string[]; hookContexts: string[];
  mcpServers: string[]; sessionStartHook: boolean; prompt: string;
};
type FixedContext = {
  PROBE_PREFIX: string; serverKey: (name: string) => string; firstCall: (lines: Line[]) => FirstCall | null;
};

const read = (name: string): Line[] =>
  readFileSync(new URL(`./fixtures/benchmark-fixed/${name}`, import.meta.url), 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l) as Line);

it('risk:parsing a probe transcript gives its first call input and what loaded before it', async () => {
  const { PROBE_PREFIX, serverKey, firstCall } = (await import(new URL('../../../scripts/fixed-context.mjs', import.meta.url).href)) as FixedContext;
  const forbidden = [/[A-Za-z]:[\\/]+Users[\\/]/i, /\/[a-z]\/Users\//i, /[\w.+-]+@[\w-]+(\.[A-Za-z][\w-]*)+/, /"thinking"/];
  for (const name of ['all-on-main.jsonl', 'all-on-executor.jsonl']) {
    const text = readFileSync(new URL(`./fixtures/benchmark-fixed/${name}`, import.meta.url), 'utf8');
    for (const line of text.split('\n').filter(Boolean)) for (const re of forbidden) expect(re.test(line), `${name} matches ${re}`).toBe(false);
  }
  expect(serverKey('claude.ai Claude Docs')).toBe('claude_ai_Claude_Docs');

  const expectUsage = (lines: Line[], id: string) => {
    const own = lines.filter((l) => l.type === 'assistant' && l.message?.id === id);
    const top = (k: string) => Math.max(...own.map((l) => (l.message.usage[k] as number | undefined) ?? 0));
    return { input: top('input_tokens'), cacheRead: top('cache_read_input_tokens'), cacheWrite: top('cache_creation_input_tokens') };
  };
  const attachments = (lines: Line[], type: string): Line[] => lines.filter((l) => l.attachment?.type === type).map((l) => l.attachment as Line);

  const main = read('all-on-main.jsonl');
  const firstLine = main.find((l) => l.type === 'assistant' && l.message.model !== '<synthetic>') as Line;
  const usage = expectUsage(main, firstLine.message.id as string);
  const call = firstCall(main) as FirstCall;
  expect(call.id).toBe(firstLine.message.id);
  expect(call.model).toBe(firstLine.message.model);
  expect(call.usage).toEqual(usage);
  expect(call.input).toBe(usage.input + usage.cacheRead + usage.cacheWrite);
  expect(call.version).toBe(main[0].version);
  expect(call.cwd).toBe(firstLine.cwd);
  expect(call.branch).toBe(firstLine.gitBranch);
  expect(call.ts).toBe(Date.parse(firstLine.timestamp as string));
  expect(call.instructions).toEqual(attachments(main, 'instructions').flatMap((a) => a.files.map((f: Line) => ({ path: f.path, type: f.type }))));
  expect(call.instructions.length).toBeGreaterThan(0);
  const skillLines = attachments(main, 'skill_listing').flatMap((a) => (a.content as string).split('\n'));
  expect(call.skillListing.filter((l) => l.startsWith('- accord')).length).toBeGreaterThan(0);
  expect(call.skillListing).toEqual(skillLines);
  const agentLines = attachments(main, 'agent_listing_delta').flatMap((a) => a.addedLines as string[]);
  expect(call.agentListing.filter((l) => l.startsWith('- accord-')).length).toBeGreaterThan(0);
  expect(call.agentListing).toEqual(agentLines);
  const byKey = new Map<string, string>();
  for (const a of attachments(main, 'mcp_instructions_delta')) for (const n of a.addedNames as string[]) byKey.set(serverKey(n), n);
  for (const a of attachments(main, 'deferred_tools_delta')) {
    for (const n of a.addedNames as string[]) {
      const m = /^mcp__(.+?)__.+$/.exec(n);
      if (m && !byKey.has(serverKey(m[1]))) byKey.set(serverKey(m[1]), m[1]);
    }
  }
  expect(call.mcpServers).toEqual([...byKey.values()].sort());
  expect(call.mcpServers).toContain('claude.ai Claude Docs');
  expect(call.sessionStartHook).toBe(true);
  expect(call.prompt.startsWith(PROBE_PREFIX)).toBe(true);

  // The largest value of each usage field over the lines of the message counts, and a later message does not.
  const split = main.flatMap((l) => (l === firstLine ? [{ ...l, message: { ...l.message, usage: { ...l.message.usage, cache_read_input_tokens: usage.cacheRead + 1000, cache_creation_input_tokens: 1 } } }, l] : [l]));
  const merged = firstCall(split) as FirstCall;
  expect(merged.usage).toEqual({ ...usage, cacheRead: usage.cacheRead + 1000 });
  expect(merged.input).toBe(usage.input + usage.cacheRead + 1000 + usage.cacheWrite);

  // An attachment after the first assistant line is not read, and no assistant line gives null.
  const at = main.indexOf(firstLine);
  const late = (type: string, extra: Line) => ({ type: 'attachment', attachment: { type, ...extra } });
  const withLate = [
    ...main.slice(0, at + 1),
    late('skill_listing', { content: '- late-skill: x' }), late('agent_listing_delta', { addedLines: ['- late-agent: x'] }),
    late('instructions', { files: [{ path: 'late.md', type: 'Project' }] }), late('hook_additional_context', { content: ['late'] }),
    late('mcp_instructions_delta', { addedNames: ['late server'] }), late('deferred_tools_delta', { addedNames: ['mcp__late_server__t'] }),
    ...main.slice(at + 1),
  ];
  expect(firstCall(withLate)).toEqual(call);
  expect(firstCall(main.filter((l) => l.type !== 'assistant'))).toBeNull();

  const exec = read('all-on-executor.jsonl');
  const execCall = firstCall(exec) as FirstCall;
  expect(execCall.hookContexts[0].startsWith('# accord rules')).toBe(true);
  expect(execCall.sessionStartHook).toBe(false);
  expect(execCall.prompt.startsWith(PROBE_PREFIX)).toBe(true);
  const execFirst = exec.find((l) => l.type === 'assistant') as Line;
  const execUsage = expectUsage(exec, execFirst.message.id as string);
  expect(execCall.input).toBe(execUsage.input + execUsage.cacheRead + execUsage.cacheWrite);
  expect(execCall.model).toBe(execFirst.message.model);
});

type Setup = {
  repo: string; home: string; mainCheckout: string; probeDir: string;
  agents: { name: string; model: string; tools: string[] | null; hash: string }[];
  accordSkills: { name: string; description: string }[];
  hookCommand: string;
  plugins: { id: string; version: string | null; accordOwn: boolean }[];
  mcp: { name: string; scope: string; hash: string }[];
  sets: { prefix: string; members: { kind: string; name: string; level: string }[] }[];
  docs: { file: string; label: string; topic: boolean }[];
};

it('risk:complex-branching the setup lists each enabled plugin listable MCP server and own skill set under its owner', async () => {
  const { readSetup } = (await import(new URL('../../../scripts/benchmark.mjs', import.meta.url).href)) as {
    readSetup: (a: { repo: string; home: string }) => Setup;
  };
  const { standsFor } = (await import(new URL('../../../scripts/fixed-context.mjs', import.meta.url).href)) as {
    standsFor: (p: string, s: { repo: string; mainCheckout: string; probeDir: string; home: string }) => { file: string; label: string };
  };
  const w = makeWorld();
  try {
    const s = readSetup({ repo: w.repo, home: w.home });
    expect(s.plugins).toEqual([
      { id: 'accord-panel@accord', version: '0.3.0', accordOwn: true },
      { id: 'alpha@m', version: '1.0.0', accordOwn: false },
      { id: 'beta@m', version: '2.0.0', accordOwn: false },
    ]);
    expect(s.mcp.map((m) => [m.name, m.scope])).toEqual([['proj-db', 'project'], ['user-search', 'user']]);
    for (const m of s.mcp) expect(m.hash).toMatch(/^[0-9a-f]{64}$/);
    expect(s.sets.map((x) => [x.prefix, x.members.map((m) => `${m.kind}:${m.name}:${m.level}`)])).toEqual([
      ['aws', ['skill:aws-x:user']],
      ['gsd', ['skill:gsd-a:user', 'skill:gsd-b:user', 'agent:gsd-r:user']],
      ['my', ['agent:my-helper:project']],
      ['own', ['skill:own-notes:project']],
      ['tool', ['command:tool:run:user']],
    ]);
    expect(s.agents.map((a) => [a.name, a.model, a.tools])).toEqual([
      ['accord-critic', 'opus', ['Read', 'Grep', 'Glob']],
      ['accord-executor', 'sonnet', null],
      ['accord-scout', 'sonnet', ['Read', 'Grep', 'Glob']],
    ]);
    for (const a of s.agents) expect(a.hash).toMatch(/^[0-9a-f]{64}$/);
    expect(s.accordSkills).toEqual([{ name: 'accord', description: 'Use when starting work.' }]);
    expect(s.hookCommand).toBe(HOOK);
    expect(s.repo).toBe(w.repo);
    expect(s.mainCheckout).toBe(w.repo);
    expect(s.home).toBe(w.home);
    expect(s.probeDir).toBe(w.probeDir);
    const enc = w.repo.replace(/[^A-Za-z0-9]/g, '-');
    const own = s.docs.filter((d) => d.file.toLowerCase().startsWith(w.tmp.toLowerCase()));
    expect(own.map((d) => [d.label, d.topic])).toEqual([
      ['CLAUDE.md', false],
      ['~/.claude/CLAUDE.md', false],
      [`~/.claude/projects/${enc}/memory/MEMORY.md`, false],
      [`~/.claude/projects/${enc}/memory/note.md`, true],
    ]);
    expect(JSON.stringify(s)).not.toContain('sekret-local-456');
    expect(JSON.stringify(s)).not.toContain('local-db');

    const st = { repo: w.repo, mainCheckout: w.repo, probeDir: w.probeDir, home: w.home };
    expect(standsFor(`${w.probeDir}/CLAUDE.md`.replace(/\//g, '\\'), st)).toEqual({ file: `${w.repo}/CLAUDE.md`, label: 'CLAUDE.md' });
    expect(standsFor(`${w.home}/.claude/CLAUDE.md`, st)).toEqual({ file: `${w.home}/.claude/CLAUDE.md`, label: '~/.claude/CLAUDE.md' });
    expect(standsFor('/elsewhere/x.md', st)).toEqual({ file: '/elsewhere/x.md', label: '/elsewhere/x.md' });
    expect(standsFor(`${w.repo.toUpperCase()}/a/b.md`, st).label).toBe('a/b.md');
  } finally {
    rmSync(w.tmp, { recursive: true, force: true, maxRetries: 5 });
  }
}, 120_000);
