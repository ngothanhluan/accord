/* eslint-disable @typescript-eslint/no-explicit-any -- transcript lines are untyped JSON of Claude Code */
import { execFileSync } from 'node:child_process';
import { appendFileSync, existsSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
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

type Probe = { id: string; where: string; depends: Record<string, string>; settings?: Record<string, unknown>; mcp?: { name: string; entry: unknown }[] };
type Forms = { extraArgs: string[]; skillOverride: string; deny: { agent: string } } & Record<string, unknown>;
type Fc = {
  PROBE_FORMS: Forms; dispatchPrompt: (types: string[]) => string; shellLine: (args: string[]) => string;
  fingerprints: (s: Setup) => Record<string, string>; phaseOne: (s: Setup) => Probe[];
};
type Bench = {
  readSetup: (a: { repo: string; home: string }) => Setup;
  fixedProbe: (a: { repo: string; home: string; bench: string; forms?: Forms }) => { exit: number; text: string };
};
const REFUSAL = 'Refused: .claude or a CLAUDE.md file has uncommitted changes; the probe worktree holds the commit. Commit them and run again.';
const loadBoth = async () => ({
  fc: (await import(new URL('../../../scripts/fixed-context.mjs', import.meta.url).href)) as Fc,
  bench: (await import(new URL('../../../scripts/benchmark.mjs', import.meta.url).href)) as Bench,
});
const readState = (bench: string) =>
  (JSON.parse(readFileSync(`${bench}/fixed/probes.json`, 'utf8')) as { probes: { id: string; sessionId: string; cwd: string; command: string; fingerprint: Record<string, string> }[] }).probes;
const filesUnder = (dir: string): string[] =>
  readdirSync(dir, { recursive: true, withFileTypes: true }).filter((e) => e.isFile()).map((e) => `${e.parentPath}/${e.name}`.replace(/\\/g, '/'));

it('risk:complex-branching phase one has an all-on probe and one leave-one-out probe per plugin MCP server and own set', async () => {
  const { fc, bench } = await loadBoth();
  const w = makeWorld();
  try {
    const setup = bench.readSetup({ repo: w.repo, home: w.home });
    const probes = fc.phaseOne(setup);
    expect(probes.map((p) => p.id)).toEqual([
      'all-on', 'mcp-ref', 'mcp:proj-db', 'mcp:user-search', 'plugin:accord-panel@accord', 'plugin:alpha@m', 'plugin:beta@m',
      'set:aws', 'set:gsd', 'set:my', 'set:own', 'set:tool',
    ]);
    for (const p of probes) expect(p.where).toBe('probe');
    const by = (id: string) => probes.find((p) => p.id === id) as Probe;
    const off = fc.PROBE_FORMS.skillOverride;
    const deny = (name: string) => fc.PROBE_FORMS.deny.agent.replace('{name}', name);
    expect(by('set:gsd').settings).toEqual({ permissions: { deny: [deny('gsd-r')] }, skillOverrides: { 'gsd-a': off, 'gsd-b': off } });
    expect(by('set:my').settings).toEqual({ permissions: { deny: [deny('my-helper')] } });
    expect(by('set:aws').settings).toEqual({ skillOverrides: { 'aws-x': off } });
    expect(by('set:own').settings).toEqual({ skillOverrides: { 'own-notes': off } });
    expect(by('set:tool').settings).toEqual({ skillOverrides: { 'tool:run': off } });
    expect(by('plugin:alpha@m').settings).toEqual({ enabledPlugins: { 'alpha@m': false } });
    expect(by('mcp-ref').mcp?.map((m) => m.name)).toEqual(['proj-db', 'user-search']);
    expect(by('mcp:proj-db').mcp?.map((m) => m.name)).toEqual(['user-search']);
    expect(by('mcp:user-search').mcp?.map((m) => m.name)).toEqual(['proj-db']);
    expect(by('all-on').depends).toEqual(fc.fingerprints(setup));
    expect(Object.keys(by('all-on').depends)).toEqual(expect.arrayContaining(['hook', 'skills', 'docs', 'agent:accord-scout', 'plugin:alpha@m', 'mcp:proj-db', 'set:gsd']));
    expect(Object.keys(by('set:gsd').depends)).toEqual(['set:gsd']);
    expect(Object.keys(by('mcp-ref').depends)).toEqual(['mcp:proj-db', 'mcp:user-search']);
    expect(by('plugin:beta@m').depends).toEqual({ 'plugin:beta@m': '2.0.0' });

    const r = bench.fixedProbe({ repo: w.repo, home: w.home, bench: w.bench });
    expect(r.exit).toBe(0);
    const lines = r.text.split('\n').filter(Boolean);
    expect(lines[0]).toBe('# Run in Git Bash, then run: node scripts/benchmark.mjs --fixed');
    expect(lines[1]).toContain(' worktree add -B probe/fixed-context ');
    const commands = lines.slice(2);
    expect(commands).toHaveLength(probes.length);
    for (const line of lines) expect(line).not.toContain('{');
    const names = setup.agents.map((a) => a.name);
    const prompt = fc.shellLine([fc.dispatchPrompt(names)]);
    const state = readState(w.bench);
    expect(state.map((e) => e.id)).toEqual(probes.map((p) => p.id));
    expect(commands).toEqual(state.map((e) => e.command));
    expect(new Set(state.map((e) => e.sessionId)).size).toBe(probes.length);
    for (const e of state) {
      expect(e.command.startsWith('cd ' + fc.shellLine([w.probeDir]) + ' && ')).toBe(true);
      expect(e.command).toContain('claude -p ' + prompt + ' --session-id ' + e.sessionId);
      expect(e.fingerprint).toEqual(by(e.id).depends);
    }
    const cmd = (id: string) => (state.find((e) => e.id === id) as { command: string }).command;
    expect(cmd('set:gsd')).toContain(' --settings ' + fc.shellLine([`${w.bench}/fixed/set_gsd.settings.json`]));
    expect(cmd('set:gsd')).not.toContain('--mcp-config');
    expect(cmd('mcp:proj-db')).toContain(' --mcp-config ' + fc.shellLine([`${w.bench}/fixed/mcp_proj-db.mcp.json`]));
    expect(cmd('mcp:proj-db')).toContain(' --strict-mcp-config');
    expect(cmd('mcp-ref')).toContain(' --strict-mcp-config');
    expect(cmd('all-on')).not.toMatch(/--settings|--mcp-config|--strict-mcp-config/);
    expect(cmd('plugin:alpha@m')).toContain(' --settings ' + fc.shellLine([`${w.bench}/fixed/plugin_alpha_m.settings.json`]));
    expect(JSON.parse(readFileSync(`${w.bench}/fixed/set_gsd.settings.json`, 'utf8'))).toEqual(by('set:gsd').settings);

    // Other forms reach the command: a flag that takes a list comes after the prompt.
    const forms = { ...fc.PROBE_FORMS, extraArgs: ['--allowedTools', 'Agent'] };
    expect(bench.fixedProbe({ repo: w.repo, home: w.home, bench: w.bench, forms }).exit).toBe(0);
    const allOn = readState(w.bench).find((e) => e.id === 'all-on') as { sessionId: string; command: string };
    expect(allOn.command).toContain('claude -p ' + prompt + ' --session-id ' + allOn.sessionId);
    expect(allOn.command.endsWith(' --allowedTools Agent')).toBe(true);

    // No listable server: the reference is still measured, with the strict flag alone.
    rmSync(`${w.repo}/.mcp.json`);
    writeFileSync(`${w.home}/.claude.json`, '{}\n');
    expect(bench.fixedProbe({ repo: w.repo, home: w.home, bench: w.bench }).exit).toBe(0);
    const ref = readState(w.bench).find((e) => e.id === 'mcp-ref') as { command: string };
    expect(ref.command).toContain(' --strict-mcp-config');
    expect(ref.command).not.toContain(' --mcp-config');

    // An uncommitted edit of .claude: the probe worktree holds the commit, so nothing is written.
    rmSync(`${w.bench}/fixed`, { recursive: true, force: true });
    appendFileSync(`${w.repo}/.claude/agents/accord-scout.md`, '\nedited\n');
    const refused = bench.fixedProbe({ repo: w.repo, home: w.home, bench: w.bench });
    expect(refused.exit).toBe(2);
    expect(refused.text.trim()).toBe(REFUSAL);
    expect(existsSync(`${w.bench}/fixed`)).toBe(false);
  } finally {
    rmSync(w.tmp, { recursive: true, force: true, maxRetries: 5 });
  }
}, 120_000);

it('risk:security MCP config files stay under the bench root and no server secret is printed or stored in the repository', async () => {
  const { bench } = await loadBoth();
  const w = makeWorld();
  try {
    const r = bench.fixedProbe({ repo: w.repo, home: w.home, bench: w.bench });
    expect(r.exit).toBe(0);
    expect(r.text).not.toContain('sekret-user-123');
    expect(r.text).not.toContain('sekret-local-456');
    expect(w.bench.startsWith(w.repo + '/')).toBe(false);
    expect(readFileSync(`${w.bench}/fixed/probes.json`, 'utf8')).not.toContain('sekret-user-123');
    for (const file of filesUnder(w.repo)) expect(readFileSync(file, 'utf8'), file).not.toMatch(/sekret-(user-123|local-456)/);
    const holding = filesUnder(w.bench).filter((f) => readFileSync(f, 'utf8').includes('sekret-user-123'));
    expect(holding.length).toBeGreaterThan(0);
    for (const f of holding) expect(f.startsWith(`${w.bench}/fixed/`) && f.endsWith('.mcp.json'), f).toBe(true);
    for (const f of filesUnder(w.bench)) expect(readFileSync(f, 'utf8'), f).not.toContain('sekret-local-456');
  } finally {
    rmSync(w.tmp, { recursive: true, force: true, maxRetries: 5 });
  }
}, 120_000);

it('risk:parsing printed commands keep absolute paths Git Bash runs when the repository lies under the home folder', async () => {
  const { fc, bench } = await loadBoth();
  const w = makeWorld({ underHome: true });
  try {
    expect(w.repo.startsWith(w.home + '/')).toBe(true);
    const r = bench.fixedProbe({ repo: w.repo, home: w.home, bench: w.bench });
    expect(r.exit).toBe(0);
    const lines = r.text.split('\n').filter(Boolean);
    for (const line of lines) expect(line).not.toContain('~');
    const head = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: w.repo, encoding: 'utf8' }).trim();
    expect(lines[1]).toBe('git -C ' + fc.shellLine([w.repo]) + ' worktree add -B probe/fixed-context ' + fc.shellLine([w.probeDir]) + ' ' + head);
    const commands = lines.slice(2);
    for (const c of commands) expect(c.startsWith('cd ' + fc.shellLine([w.probeDir]) + ' && ')).toBe(true);
    const state = readState(w.bench);
    const cmd = (id: string) => (state.find((e) => e.id === id) as { command: string }).command;
    expect(cmd('set:gsd')).toContain(' --settings ' + fc.shellLine([w.bench + '/fixed/set_gsd.settings.json']));
    expect(cmd('mcp-ref')).toContain(' --mcp-config ' + fc.shellLine([w.bench + '/fixed/mcp-ref.mcp.json']));
    expect(existsSync(`${w.bench}/fixed/set_gsd.settings.json`)).toBe(true);
    expect(existsSync(`${w.bench}/fixed/mcp-ref.mcp.json`)).toBe(true);
    for (const e of state) expect(e.cwd).toBe(w.probeDir);
  } finally {
    rmSync(w.tmp, { recursive: true, force: true, maxRetries: 5 });
  }
}, 120_000);
