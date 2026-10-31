/* eslint-disable @typescript-eslint/no-explicit-any -- transcript lines are untyped JSON of Claude Code */
import { execFileSync } from 'node:child_process';
import { appendFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { assistantLine, attachmentLine, CHOSEN, CLAIMED, HOOK, makeWorld, measuredWorld, MODEL_OF as ROW_MODEL, sizeOf, userLine, writeSession, type RowName, type World } from './helpers/fixed-world.js';

type Line = Record<string, any>;
type FirstCall = {
  id: string; model: string; version: string; ts: number; cwd: string; branch: string; input: number;
  usage: { input: number; cacheRead: number; cacheWrite: number };
  instructions: { path: string; type: string }[]; skillListing: string[]; agentListing: string[]; hookContexts: string[];
  mcpServers: string[]; sessionStartHook: boolean; prompt: string;
  mcpBlocks: Record<string, string>; deferredTools: string[];
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
  const deferred = attachments(main, 'deferred_tools_delta').flatMap((a) => a.addedNames as string[]);
  expect(deferred.length).toBeGreaterThan(0);
  expect(call.deferredTools).toEqual(deferred);
  expect(call.mcpBlocks).toEqual({});

  // A block belongs to the name it starts with, else to the name at its own index, else it is dropped.
  const firstAt = main.indexOf(firstLine);
  const delta = (addedNames: string[], addedBlocks: string[]): Line => ({ type: 'attachment', attachment: { type: 'mcp_instructions_delta', addedNames, addedBlocks } });
  const withBlocks = [
    ...main.slice(0, firstAt),
    delta(['srv one', 'claude.ai Docs X'], ['## claude.ai Docs X\nDocs rules', '## srv one\nOne rules']),
    delta(['srv two'], ['Two rules']),
    delta(['srv three'], ['## other\nx', 'orphan']),
    ...main.slice(firstAt),
  ];
  expect((firstCall(withBlocks) as FirstCall).mcpBlocks).toEqual({
    'claude.ai Docs X': '## claude.ai Docs X\nDocs rules', 'srv one': '## srv one\nOne rules', 'srv two': 'Two rules', 'srv three': '## other\nx',
  });

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
    late('mcp_instructions_delta', { addedNames: ['late server'], addedBlocks: ['## late server\nx'] }), late('deferred_tools_delta', { addedNames: ['mcp__late_server__t'] }),
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

type Row = FirstCall;
type Stub = { name: string; tools: string[] | null; model: string; agents: string[] };
type Text = { id: string; owner: string; item: string | null; label: string; text: string; rows: string[] };
type TwoProbe = {
  id: string; where: string; depends: Record<string, string>; model?: string; text?: string; source?: string;
  stubs?: Stub[]; settings?: { permissions: { deny: string[] } };
};
type Two = {
  PROBE_FORMS: Forms; PROBE_BRIEF: string; dispatchPrompt: (types: string[]) => string;
  stubsOf: (s: unknown, a: unknown) => Stub[];
  textsOf: (s: unknown, a: unknown, read: (f: string) => string | undefined) => Text[];
  connectorsOf: (s: unknown, a: unknown) => { connectors: string[]; others: string[] };
  phaseTwo: (s: unknown, a: unknown, read: (f: string) => string | undefined, forms?: unknown) => TwoProbe[];
};

it('risk:complex-branching each text is charged to its owner and to the rows it reaches and the baseline has one stub per tool list and model', async () => {
  const fc = (await import(new URL('../../../scripts/fixed-context.mjs', import.meta.url).href)) as Two;
  const RULES = '# accord rules\n\nhold these';
  const CLAUDE = 'own line\n<!-- accord:start -->\npointer block\n<!-- accord:end -->\n';
  const MEMORY = 'C:/h/.claude/projects/C--w-repo/memory/MEMORY.md';
  const agent = (name: string, model: string, tools: string[] | null) => ({ name, model, tools, body: `body of ${name}`, hash: 'h' });
  const member = (kind: string, name: string) => ({ kind, name, level: 'user', hash: 'h' });
  const setup = {
    repo: 'C:/w/repo', mainCheckout: 'C:/w/repo', probeDir: 'C:/w/accord-probe', home: 'C:/h',
    mcp: [{ name: 'proj-db' }],
    plugins: [{ id: 'accord-panel@accord', version: '1', accordOwn: true }, { id: 'alpha@m', version: '1', accordOwn: false }],
    sets: [{ prefix: 'gsd', members: [member('skill', 'gsd-a'), member('agent', 'gsd-r')] }, { prefix: 'tool', members: [member('command', 'tool:run')] }],
    accordSkills: [{ name: 'accord', description: 'd' }],
    agents: [
      agent('accord-scout', 'sonnet', ['Read', 'Grep', 'Glob']), agent('accord-critic', 'opus', ['Read', 'Grep', 'Glob']),
      agent('accord-executor', 'sonnet', null), agent('accord-ghost', 'sonnet', null),
    ],
  };
  const call = (o: Partial<Row>): Row => ({
    id: 'x', model: 'm', version: '2.1.314', ts: 0, cwd: '', branch: '', input: 0, usage: { input: 0, cacheRead: 0, cacheWrite: 0 },
    instructions: [], skillListing: [], agentListing: [], hookContexts: [], mcpServers: [], sessionStartHook: false, prompt: '',
    mcpBlocks: {}, deferredTools: [], ...o,
  });
  const allOn = {
    main: call({
      model: 'm-opus', sessionStartHook: true,
      skillListing: ['- accord: a', '- gsd-a: b', '- alpha:sk: c', '- tool:run: d', '- other: o'],
      agentListing: ['- accord-scout: s', '- gsd-r: r', '- alpha:helper: h', '- other: o'],
      instructions: [{ path: 'C:\\w\\accord-probe\\CLAUDE.md', type: 'Project' }, { path: MEMORY, type: 'AutoMem' }],
      mcpServers: ['claude.ai Docs X', 'plugin_alpha_srv', 'proj_db'],
      mcpBlocks: { 'claude.ai Docs X': '## claude.ai Docs X\nrules', 'proj-db': '## proj-db\nq' },
      deferredTools: ['mcp__claude_ai_Docs_X__read', 'mcp__proj_db__query', 'mcp__plugin_alpha_srv__ping', 'WebFetch'],
    }),
    agents: {
      'accord-scout': call({ model: 'm-sonnet', hookContexts: [RULES], instructions: [{ path: 'C:/w/accord-probe/CLAUDE.md', type: 'Project' }] }),
      'accord-critic': call({
        model: 'm-opus', hookContexts: [RULES], mcpBlocks: { 'agent-only': '## agent-only\nz' },
        instructions: [{ path: 'C:/w/accord-probe/CLAUDE.md', type: 'Project' }, { path: MEMORY, type: 'AutoMem' }],
      }),
      'accord-executor': call({
        model: 'm-sonnet', hookContexts: [RULES], skillListing: ['- accord: a', '- gsd-a: b'], deferredTools: ['mcp__proj_db__query'],
        instructions: [{ path: 'C:/w/accord-probe/CLAUDE.md', type: 'Project' }],
      }),
    },
  };
  const seen: string[] = [];
  const read = (file: string): string | undefined => {
    seen.push(file);
    if (file === 'C:/w/repo/CLAUDE.md') return CLAUDE;
    return file === MEMORY ? 'one memory line\n' : undefined;
  };

  const stubs = fc.stubsOf(setup, allOn);
  expect(stubs).toEqual([
    { name: 'stub-1', tools: ['Glob', 'Grep', 'Read'], model: 'opus', agents: ['accord-critic'] },
    { name: 'stub-2', tools: null, model: 'sonnet', agents: ['accord-executor'] },
    { name: 'stub-3', tools: ['Glob', 'Grep', 'Read'], model: 'sonnet', agents: ['accord-scout'] },
  ]);

  const texts = fc.textsOf(setup, allOn, read);
  expect(seen).toContain('C:/w/repo/CLAUDE.md');
  expect(seen.filter((f) => f.toLowerCase().startsWith('c:/w/accord-probe'))).toEqual([]);
  const text = (id: string): Text => texts.find((t) => t.id === id) as Text;
  const ids = texts.map((t) => t.id);
  expect(ids).toEqual(expect.arrayContaining(['doc:CLAUDE.md', 'pointer:CLAUDE.md', 'doc:~/.claude/projects/C--w-repo/memory/MEMORY.md']));
  expect(ids).not.toContain('agent:accord-ghost');
  expect(ids.some((id) => id.endsWith('accord-panel@accord'))).toBe(false);
  expect(text('agent:accord-critic')).toMatchObject({ owner: 'accord', item: 'agent-definition', text: 'body of accord-critic', rows: ['accord-critic'] });
  expect(text('rules')).toMatchObject({ owner: 'accord', item: 'rules', text: RULES, rows: ['main', 'accord-critic', 'accord-executor', 'accord-scout'] });
  expect(text('skill-listing')).toMatchObject({ owner: 'accord', item: 'skill-listing', text: '- accord: a', rows: ['main', 'accord-executor'] });
  expect(text('agent-listing')).toMatchObject({ owner: 'accord', item: 'agent-listing', text: '- accord-scout: s', rows: ['main'] });
  expect(text('doc:CLAUDE.md').owner).toBe('CLAUDE.md and memory');
  expect(text('doc:CLAUDE.md').item).toBe('doc:CLAUDE.md');
  expect(text('doc:CLAUDE.md').text).toContain('own line');
  expect(text('doc:CLAUDE.md').text).not.toContain('accord:start');
  expect(text('doc:CLAUDE.md').rows).toEqual(['main', 'accord-critic', 'accord-executor', 'accord-scout']);
  expect(text('pointer:CLAUDE.md').owner).toBe('accord');
  expect(text('pointer:CLAUDE.md').item).toBe('pointer:CLAUDE.md');
  expect(text('pointer:CLAUDE.md').text).toBe('<!-- accord:start -->\npointer block\n<!-- accord:end -->');
  expect(text('doc:~/.claude/projects/C--w-repo/memory/MEMORY.md').rows).toEqual(['main', 'accord-critic']);
  expect(text('prompt')).toMatchObject({ owner: 'probe', item: null, rows: ['main'], text: fc.dispatchPrompt(setup.agents.map((a) => a.name)) });
  expect(text('baseline-prompt')).toMatchObject({ owner: 'probe', item: null, rows: ['main'], text: fc.dispatchPrompt(['stub-1', 'stub-2', 'stub-3']) });
  expect(text('brief')).toMatchObject({ owner: 'probe', item: null, text: fc.PROBE_BRIEF, rows: ['accord-critic', 'accord-executor', 'accord-scout'] });

  // A plugin's entries are charged to the plugin, an own set's to the set, whatever else the listing holds.
  expect(text('plugin-skills:alpha@m')).toEqual({ id: 'plugin-skills:alpha@m', owner: 'plugins', item: 'plugin:alpha@m', label: 'alpha@m', text: '- alpha:sk: c', rows: ['main'] });
  expect(text('plugin-agents:alpha@m')).toMatchObject({ owner: 'plugins', item: 'plugin:alpha@m', text: '- alpha:helper: h', rows: ['main'] });
  expect(text('set-skills:gsd')).toMatchObject({ owner: 'own skills, agents and commands', item: 'set:gsd', text: '- gsd-a: b', rows: ['main', 'accord-executor'] });
  expect(text('set-agents:gsd')).toMatchObject({ item: 'set:gsd', text: '- gsd-r: r', rows: ['main'] });
  expect(text('set-skills:tool')).toMatchObject({ item: 'set:tool', text: '- tool:run: d' });
  expect(ids).not.toContain('set-agents:tool');

  // A block the main holds reaches every agent row, though no agent first call holds it; a block only an agent holds
  // stays on the agents holding it. A server with tool names and no block has no block text.
  const everyRow = ['main', 'accord-critic', 'accord-executor', 'accord-scout'];
  expect(text('mcp-block:claude.ai Docs X')).toMatchObject({ owner: 'MCP servers', item: 'mcp:claude.ai Docs X', label: 'claude.ai Docs X', text: '## claude.ai Docs X\nrules', rows: everyRow });
  expect(text('mcp-tools:claude.ai Docs X')).toMatchObject({ text: 'mcp__claude_ai_Docs_X__read', rows: ['main'] });
  expect(text('mcp-block:proj-db')).toMatchObject({ item: 'mcp:proj-db', rows: everyRow });
  expect(text('mcp-tools:proj-db')).toMatchObject({ text: 'mcp__proj_db__query', rows: ['main', 'accord-executor'] });
  expect(text('mcp-block:agent-only')).toMatchObject({ item: 'mcp:agent-only', text: '## agent-only\nz', rows: ['accord-critic'] });
  expect(text('mcp-tools:plugin_alpha_srv').item).toBe('mcp:plugin_alpha_srv');
  expect(ids).not.toContain('mcp-block:plugin_alpha_srv');

  // Claude Code's own entries and unknown ones are in no named text, and no listing line is charged twice.
  expect(text('skill-listing').text).toBe('- accord: a');
  for (const t of texts) {
    expect(t.text).not.toContain('- other: o');
    expect(t.text).not.toContain('WebFetch');
  }
  const listings = texts.filter((t) => /^(skill-listing|agent-listing|plugin-|set-)/.test(t.id));
  for (const line of [...allOn.main.skillListing, ...allOn.main.agentListing]) {
    expect(listings.filter((t) => t.text.split('\n').includes(line)).length).toBeLessThanOrEqual(1);
  }

  // The new texts follow the doc: texts and precede prompt: plugins by id, sets by prefix, servers by name.
  const added = ids.filter((id) => /^(plugin-|set-|mcp-)/.test(id));
  expect(added).toEqual([
    'plugin-skills:alpha@m', 'plugin-agents:alpha@m', 'set-skills:gsd', 'set-agents:gsd', 'set-skills:tool',
    'mcp-block:agent-only', 'mcp-block:claude.ai Docs X', 'mcp-tools:claude.ai Docs X', 'mcp-tools:plugin_alpha_srv', 'mcp-block:proj-db', 'mcp-tools:proj-db',
  ]);
  const lastDoc = Math.max(...ids.map((id, i) => (id.startsWith('doc:') ? i : -1)));
  expect(ids.indexOf('plugin-skills:alpha@m')).toBeGreaterThan(lastDoc);
  expect(ids.indexOf('mcp-tools:proj-db')).toBeLessThan(ids.indexOf('prompt'));
});

type Pending = { exit: number; pending: string[]; version: string | undefined; text: string };
type Located = Map<string, { main: FirstCall | null; agents: Record<string, FirstCall> }>;
type Three = {
  phaseOne: (s: Setup) => Probe[];
  phaseTwo: (s: Setup, a: { main: FirstCall; agents: Record<string, FirstCall> }, read: (f: string) => string | undefined) => Probe[];
};
type BenchThree = Bench & {
  fixedPending: (a: { repo: string; home: string; bench: string }) => Pending;
  locateSessions: (home: string, ids: string[]) => Located;
};
const NOTE = 'The connector, baseline, reference and text probes follow once the all-on probe has run.';
const T0 = Date.UTC(2026, 9, 30);
const RULES = '# accord rules\n\nhold these';
const MODEL_OF: Record<string, string> = { main: 'm-opus', 'accord-scout': 'm-sonnet', 'accord-critic': 'm-opus', 'accord-executor': 'm-sonnet' };
const refusalFor = (id: string, member: string, version = '9.0.0') =>
  `Refused: the probe ${id} still lists ${member} under Claude Code ${version}, so the settings that move a set out of reach no longer work on this version; run the switch spike again and update PROBE_FORMS in scripts/fixed-context.mjs before measuring.\n`;

type Extra = { main?: Line[]; agents?: Record<string, Line[]> };
/** Writes the transcripts of the given probes the way a run of them would; `extra` lines load before the first call, `only: 'main'` leaves the agents' files alone. */
function writeProbeSessions(w: World, ids: string[], version: string, o: { extra?: Record<string, Extra>; ts?: number; only?: 'main' } = {}): void {
  const state = readState(w.bench);
  for (const id of ids) {
    const { sessionId } = state.find((e) => e.id === id) as { sessionId: string };
    const call = (name: string, model: string) => assistantLine({ id: `${sessionId}-${name}`, model, version, ts: o.ts ?? T0, cwd: w.probeDir, branch: 'probe/fixed-context' });
    const own = o.extra?.[id] ?? {};
    const loads = id === 'all-on'
      ? [attachmentLine({ type: 'instructions', files: [{ path: `${w.probeDir}/CLAUDE.md`, type: 'Project' }, { path: `${w.home}/.claude/CLAUDE.md`, type: 'User' }] })]
      : [];
    const main = [...loads, ...(own.main ?? []), call('main', MODEL_OF.main)];
    let agents: Record<string, Line[]> | undefined;
    if (o.only === 'main' || /^(ref|text):/.test(id)) agents = undefined;
    else if (id === 'baseline') agents = Object.fromEntries(['stub-1', 'stub-2', 'stub-3'].map((n) => [n, [call(n, 'm-sonnet')]]));
    else {
      agents = Object.fromEntries(Object.keys(MODEL_OF).filter((n) => n !== 'main').map((n) => [n, [attachmentLine({ type: 'hook_additional_context', content: [RULES] }), ...(own.agents?.[n] ?? []), call(n, MODEL_OF[n])]]));
    }
    writeSession(w.home, 'proj', sessionId, { main, agents });
  }
}

it('risk:complex-branching a changed item reprints only its own probes and the all-on probe', async () => {
  const { fc, bench } = await loadBoth();
  const three = fc as unknown as Three;
  const b = bench as unknown as BenchThree;
  const w = makeWorld();
  try {
    const args = { repo: w.repo, home: w.home, bench: w.bench };
    const stateFile = `${w.bench}/fixed/probes.json`;
    const setup = b.readSetup({ repo: w.repo, home: w.home });
    const phaseOneIds = three.phaseOne(setup).map((p) => p.id);
    expect(b.fixedProbe(args).exit).toBe(0);

    // 1. Only the phase-one probes are needed until the all-on probe has run.
    const first = b.fixedPending(args);
    expect(first.exit).toBe(0);
    expect(first.pending).toEqual(phaseOneIds);
    expect(first.version).toBeUndefined();
    const lines = first.text.split('\n').filter(Boolean);
    expect(lines).toHaveLength(2 + phaseOneIds.length + 1);
    expect(lines[0]).toBe('# Run in Git Bash, then run: node scripts/benchmark.mjs --fixed');
    expect(lines.at(-1)).toBe(NOTE);
    expect(readState(w.bench).map((e) => e.id)).toEqual(phaseOneIds);

    // 2. Once the phase-one sessions have run, exactly the phase-two probes of the all-on transcript are needed.
    writeProbeSessions(w, phaseOneIds, '9.0.0');
    const allOnId = readState(w.bench).find((e) => e.id === 'all-on')?.sessionId as string;
    const allOn = b.locateSessions(w.home, [allOnId]).get(allOnId) as { main: FirstCall; agents: Record<string, FirstCall> };
    const disk = (f: string) => (existsSync(f) ? readFileSync(f, 'utf8') : undefined);
    const expected = three.phaseTwo(setup, allOn, disk).map((p) => p.id);
    const second = b.fixedPending(args);
    expect(second.exit).toBe(0);
    expect(second.version).toBe('9.0.0');
    expect(second.pending).toEqual(expected);
    expect(expected).toEqual(expect.arrayContaining([
      'baseline', 'ref:m-opus', 'ref:m-sonnet', 'text:agent:accord-critic:m-opus', 'text:pointer:CLAUDE.md:m-opus',
      'text:doc:CLAUDE.md:m-opus', 'text:doc:~/.claude/CLAUDE.md:m-opus',
    ]));
    for (const id of second.pending) expect(id).not.toContain('accord-probe');
    expect(second.text).not.toContain(NOTE);
    expect(existsSync(`${w.bench}/fixed/stubs.json`)).toBe(true);
    expect(existsSync(`${w.bench}/fixed/text_doc_CLAUDE.md_m-opus.md`)).toBe(true);
    const baseline = readState(w.bench).find((e) => e.id === 'baseline') as { cwd: string; command: string };
    expect(baseline.cwd).toBe(`${w.bench}/fixed/empty`);
    expect(baseline.command).toContain('--strict-mcp-config --model m-opus --agents ');

    // 3. Once those have run too, nothing is pending and the call writes nothing.
    writeProbeSessions(w, expected, '9.0.0');
    const base = readFileSync(stateFile, 'utf8');
    const settled = b.fixedPending(args);
    expect(settled).toMatchObject({ exit: 0, pending: [], version: '9.0.0', text: '' });
    expect(readFileSync(stateFile, 'utf8')).toBe(base);
    const fromBase = () => writeFileSync(stateFile, base);
    const pendingNow = () => b.fixedPending(args).pending;

    // 4. A plugin that moved to a new version.
    fromBase();
    const installed = `${w.home}/.claude/plugins/installed_plugins.json`;
    const installedText = readFileSync(installed, 'utf8');
    writeFileSync(installed, installedText.replace('"version": "2.0.0"', '"version": "2.1.0"'));
    expect(pendingNow()).toEqual(['all-on', 'plugin:beta@m']);
    writeFileSync(installed, installedText);

    // 5. A new rules file changes which instruction files exist.
    fromBase();
    mkdirSync(`${w.home}/.claude/rules`, { recursive: true });
    writeFileSync(`${w.home}/.claude/rules/style.md`, 'Keep it short.\n');
    expect(pendingNow()).toEqual(['all-on']);
    rmSync(`${w.home}/.claude/rules/style.md`);

    // 6. A newer Claude Code on the all-on transcript makes every other probe stale.
    fromBase();
    const allOnFile = `${w.home}/.claude/projects/proj/${allOnId}.jsonl`;
    const allOnBytes = readFileSync(allOnFile, 'utf8');
    writeProbeSessions(w, ['all-on'], '9.1.0', { ts: T0 + 60_000, only: 'main' });
    expect(pendingNow()).toEqual(readState(w.bench).map((e) => e.id).filter((id) => id !== 'all-on'));
    writeFileSync(allOnFile, allOnBytes);

    // 7. The own line of CLAUDE.md changed: the doc text probe and the all-on probe, not the pointer text probe.
    fromBase();
    writeFileSync(`${w.repo}/CLAUDE.md`, readFileSync(`${w.repo}/CLAUDE.md`, 'utf8').replace('One own line.', 'Another own line.'));
    writeFileSync(`${w.tmp}/commit2.txt`, 'change the own line\n');
    const git = (...a: string[]) => execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@example.invalid', '-c', 'commit.gpgsign=false', ...a], { cwd: w.repo, encoding: 'utf8' });
    git('add', '-A');
    git('commit', '-q', '--no-verify', '-F', `${w.tmp}/commit2.txt`, '--cleanup=verbatim');
    const changed = pendingNow();
    expect(changed).toEqual(['all-on', 'text:doc:CLAUDE.md:m-opus']);
    expect(changed.filter((id) => id.startsWith('text:pointer:'))).toEqual([]);

    // 8. An uncommitted edit of .claude: refused, nothing written.
    fromBase();
    appendFileSync(`${w.repo}/.claude/agents/accord-scout.md`, '\nedited\n');
    const refused = b.fixedPending(args);
    expect(refused.exit).toBe(2);
    expect(refused.text.trim()).toBe(REFUSAL);
    expect(readFileSync(stateFile, 'utf8')).toBe(base);
  } finally {
    rmSync(w.tmp, { recursive: true, force: true, maxRetries: 5 });
  }
}, 120_000);

it('risk:complex-branching a set probe that still lists a member makes fixed refuse naming the set and the probe version', async () => {
  const { fc, bench } = await loadBoth();
  const three = fc as unknown as Three;
  const b = bench as unknown as BenchThree;
  const w = makeWorld();
  try {
    const args = { repo: w.repo, home: w.home, bench: w.bench };
    const stateFile = `${w.bench}/fixed/probes.json`;
    const ids = three.phaseOne(b.readSetup({ repo: w.repo, home: w.home })).map((p) => p.id);
    expect(b.fixedProbe(args).exit).toBe(0);
    const listing = attachmentLine({ type: 'skill_listing', content: '- accord: a\n- gsd-b: b' });
    writeProbeSessions(w, ids, '9.0.0', { extra: { 'set:gsd': { main: [listing] } } });
    const saved = readFileSync(stateFile, 'utf8');
    const fromSaved = () => writeFileSync(stateFile, saved);

    // 1. A skill of the gsd set is still listed.
    const one = b.fixedPending(args);
    expect(one.exit).toBe(2);
    expect(one.text).toBe(refusalFor('set:gsd', 'gsd-b'));
    expect(readFileSync(stateFile, 'utf8')).toBe(saved);
    expect(existsSync(`${w.bench}/fixed/stubs.json`)).toBe(false);

    // 2. An agent of the my set is still listed in an agent's first call.
    fromSaved();
    writeProbeSessions(w, ['set:gsd'], '9.0.0');
    const agentLine = attachmentLine({ type: 'agent_listing_delta', addedLines: ['- my-helper: h'] });
    writeProbeSessions(w, ['set:my'], '9.0.0', { extra: { 'set:my': { agents: { 'accord-executor': [agentLine] } } } });
    const two = b.fixedPending(args);
    expect(two.exit).toBe(2);
    expect(two.text).toBe(refusalFor('set:my', 'my-helper'));
    expect(readFileSync(stateFile, 'utf8')).toBe(saved);

    // 3. A stale set probe is run again anyway, so it is not failed.
    fromSaved();
    writeProbeSessions(w, ['set:my'], '8.0.0', { ts: T0 - 1000, only: 'main' });
    const stale = b.fixedPending(args);
    expect(stale.exit).not.toBe(2);
    expect(stale.pending).toContain('set:my');

    // 4. Once it lists no member, nothing of phase one is pending.
    fromSaved();
    writeProbeSessions(w, ['set:my'], '9.0.0');
    const clean = b.fixedPending(args);
    expect(clean.exit).not.toBe(2);
    for (const id of ids) expect(clean.pending).not.toContain(id);
  } finally {
    rmSync(w.tmp, { recursive: true, force: true, maxRetries: 5 });
  }
}, 120_000);

type Call = { row: string; accord: boolean; file: string; ts: number; model: string; version: string; cwd: string; branch: string; input: number; cacheRead: number; cacheWrite: number; output: number };
type ReadCalls = {
  readCalls: (dirs: string[], o: { bench: string }) => { calls: Call[]; version: string; folders: number };
  readSessions: (dirs: string[]) => { runs: { agent: string; desc: string }[] };
};

it('risk:parsing calls are read once per message from main and subagent transcripts and probe and bench runs are left out', async () => {
  const { readCalls, readSessions } = (await import(new URL('../../../scripts/benchmark.mjs', import.meta.url).href)) as ReadCalls;
  const w = makeWorld();
  try {
    const dir = `${w.home}/.claude/projects/proj`;
    const probeBranch = 'probe/fixed-context';
    const line = (o: Parameters<typeof assistantLine>[0]) => assistantLine({ cwd: w.repo, branch: 't/ST-LN-1', ...o });
    // A real main session: message m1 streamed over two lines with the same usage, message m2, one synthetic line.
    const real = [
      line({ id: 'm1', input: 10, cacheRead: 100, cacheWrite: 5, output: 2, chars: 400, ts: T0 }),
      line({ id: 'm1', input: 10, cacheRead: 100, cacheWrite: 5, output: 2, chars: 400, ts: T0 + 1000 }),
      line({ id: 'm2', input: 20, cacheRead: 200, cacheWrite: 0, output: 50, chars: 4, ts: T0 + 2000 }),
      line({ id: 'syn', model: '<synthetic>', input: 999, ts: T0 + 3000 }),
    ];
    const scout = [
      line({ id: 's1', model: 'm-sonnet', input: 3, cacheRead: 30, ts: T0 + 4000 }),
      line({ id: 's2', model: 'm-sonnet', input: 4, cacheRead: 40, ts: T0 + 5000 }),
    ];
    const general = [line({ id: 'g1', model: 'm-opus', input: 7, version: '9.1.0', ts: T0 + 9000 })];
    // Runs of the real session that are measurement: a probe description, a line on the probe branch, a folder under bench, a bench branch.
    const probeDescribed = [line({ id: 'p1', input: 1, ts: T0 + 6000 })];
    const probeBranched = [line({ id: 'p2', input: 1, branch: probeBranch, ts: T0 + 6000 })];
    const underBench = [line({ id: 'b1', input: 1, cwd: `${w.bench}/worktrees/x`, ts: T0 + 6000 }), line({ id: 'b2', input: 1, branch: 'bench/r1-a', ts: T0 + 6500 })];
    writeSession(w.home, 'proj', 'real', {
      main: [userLine('build the thing'), ...real],
      agents: { 'accord-scout': scout, 'general-purpose': general, 'accord-reviewer': probeDescribed, 'accord-planner': probeBranched, 'accord-executor': underBench },
      descriptions: { 'accord-scout': 'scout the code', 'general-purpose': 'look around', 'accord-reviewer': 'fixed probe accord-reviewer', 'accord-planner': 'plan it', 'accord-executor': 'build it' },
    });
    // A probe session: newest lines, another version, and a run of its own.
    const probeLine = (id: string, o: Parameters<typeof assistantLine>[0] = {}) => assistantLine({ id, cwd: w.probeDir, branch: probeBranch, version: '9.9.9', ts: T0 + 20_000, ...o });
    writeSession(w.home, 'proj', 'probe-a', { main: [userLine('accord fixed-context probe. dispatch'), probeLine('pa1')], agents: { 'accord-scout': [probeLine('pa2')] } });
    // A probe session found by its first user line alone; its run is found through the session.
    writeSession(w.home, 'proj', 'probe-b', {
      main: [userLine('accord fixed-context probe. dispatch'), probeLine('pb1', { branch: 'main' })],
      agents: { 'accord-critic': [probeLine('pb2', { branch: 'main' })] },
      descriptions: { 'accord-critic': 'critique it' },
    });

    const { calls, version, folders } = readCalls([dir], { bench: w.bench });
    const rows = (row: string) => calls.filter((c) => c.row === row);
    expect(rows('main').map((c) => c.input + c.cacheRead + c.cacheWrite).sort((a, b) => a - b)).toEqual([115, 220]);
    expect(rows('accord-scout')).toHaveLength(2);
    expect(rows('accord-scout').every((c) => c.accord)).toBe(true);
    expect(rows('general-purpose')).toHaveLength(1);
    expect(rows('general-purpose')[0].accord).toBe(false);
    expect(rows('main').every((c) => !c.accord)).toBe(true);
    expect(calls).toHaveLength(5);
    // The streamed message m1 counts once, with its usage and the output raised by its text length.
    const m1 = rows('main').find((c) => c.cacheWrite === 5) as Call;
    expect(m1).toMatchObject({ input: 10, cacheRead: 100, cacheWrite: 5, output: 200, model: 'm-sonnet', cwd: w.repo, branch: 't/ST-LN-1', version: '9.0.0', ts: T0 });
    expect(m1.file.endsWith('real.jsonl')).toBe(true);
    // The recorded output counts when it is the larger.
    expect(rows('main').find((c) => c.input === 20)?.output).toBe(50);
    // The version is the newest kept call's, not the probe session's.
    expect(version).toBe('9.1.0');
    expect(folders).toBe(1);

    // The existing reader leaves out the probe runs it can see: a probe description or a line on the probe branch.
    // (probe-b's critic is found by readCalls through its session, which readSessions does not read.)
    const runs = readSessions([dir]).runs;
    expect(runs.map((r) => r.agent).sort()).toEqual(['accord-critic', 'accord-executor', 'accord-scout', 'general-purpose']);
    expect(runs.some((r) => r.desc.startsWith('fixed probe '))).toBe(false);
  } finally {
    rmSync(w.tmp, { recursive: true, force: true, maxRetries: 5 });
  }
});

type Measured = {
  rows: { row: string; model: string; total: number; parts: Record<string, number>; unattributed: number }[];
  items: { id: string; owner: string; label: string; perRow: Record<string, number> }[];
};
type Seven = {
  stubsOf: (s: unknown, a: unknown) => Stub[];
  measure: (a: { setup: unknown; probes: { id: string }[]; state: { probes: { id: string; sessionId: string }[] }; located: Located; texts: Text[] }) => Measured;
};

it('risk:complex-branching a part is charged only to the rows it reaches and unattributed is what the named parts leave', async () => {
  const fc = (await import(new URL('../../../scripts/fixed-context.mjs', import.meta.url).href)) as unknown as Seven;
  const M = 'main';
  const S = 'accord-scout';
  const E = 'accord-executor';
  const agent = (name: string, tools: string[] | null) => ({ name, model: 'sonnet', tools, body: `body of ${name}`, hash: 'h' });
  const setup = {
    repo: 'C:/w/repo', mainCheckout: 'C:/w/repo', probeDir: 'C:/w/accord-probe', home: 'C:/h',
    agents: [agent(S, ['Read', 'Grep', 'Glob']), agent(E, null)],
    accordSkills: [{ name: 'accord', description: 'd' }],
    plugins: [
      { id: 'accord-panel@accord', version: '0.3.0', accordOwn: true },
      { id: 'alpha@m', version: '1', accordOwn: false },
      { id: 'beta@m', version: '1', accordOwn: false },
    ],
    mcp: [{ name: 'srv' }],
    sets: [{ prefix: 'gsd', members: [{ kind: 'skill', name: 'gsd-a' }, { kind: 'skill', name: 'gsd-b' }, { kind: 'agent', name: 'gsd-r' }] }],
    docs: [
      { file: 'C:/w/repo/CLAUDE.md', label: 'CLAUDE.md', topic: false },
      { file: 'C:/h/.claude/projects/x/memory/note.md', label: '~/.claude/projects/x/memory/note.md', topic: true },
    ],
  };
  const call = (model: string, input: number, o: Partial<FirstCall> = {}): FirstCall => ({
    id: 'x', model, version: '2.1.314', ts: 0, cwd: '', branch: '', input, usage: { input, cacheRead: 0, cacheWrite: 0 },
    instructions: [], skillListing: [], agentListing: [], hookContexts: [], mcpServers: [], sessionStartHook: false, prompt: '', mcpBlocks: {}, deferredTools: [], ...o,
  });
  const modelOf: Record<string, string> = { [M]: 'm-opus', [S]: 'm-sonnet', [E]: 'm-sonnet' };
  const stubs = fc.stubsOf(setup, { main: call('m-opus', 0), agents: { [S]: call('m-sonnet', 0), [E]: call('m-sonnet', 0) } });
  const stubOf = (row: string) => (stubs.find((s) => s.agents.includes(row)) as Stub).name;

  const located: Located = new Map();
  const probes: { id: string; sessionId: string }[] = [];
  const add = (id: string, main: number, agents: Record<string, number> = {}, mcpServers: string[] = []) => {
    probes.push({ id, sessionId: `s-${id}` });
    located.set(`s-${id}`, {
      main: call('m-opus', main, { mcpServers }),
      agents: Object.fromEntries(Object.entries(agents).map(([n, v]) => [n, call(modelOf[n] ?? 'm-sonnet', v)])),
    });
  };
  // A probe's first-call inputs are [main, scout, executor].
  const put = (id: string, v: readonly [number, number, number], mcpServers: string[] = []) => add(id, v[0], { [S]: v[1], [E]: v[2] }, mcpServers);
  put('all-on', [50000, 20000, 21000], ['claude.ai Docs X', 'plugin_alpha_srv', 'srv']);
  put('plugin:accord-panel@accord', [50000, 20000, 21000]);
  put('plugin:alpha@m', [49000, 20000, 20500]);
  put('plugin:beta@m', [50000, 20000, 21000]);
  put('mcp-ref', [47000, 20000, 20800]);
  put('mcp:srv', [46000, 20000, 20800]);
  put('connector:claude.ai Docs X', [48500, 20000, 20900]);
  put('set:gsd', [49400, 19900, 21000]);
  // The baseline: the main row, and one stub run per row.
  probes.push({ id: 'baseline', sessionId: 's-baseline' });
  located.set('s-baseline', { main: call('m-opus', 12000), agents: { [stubOf(S)]: call('m-sonnet', 8000), [stubOf(E)]: call('m-sonnet', 9000) } });
  // Appended texts: the reference input of a model, plus the text's own tokens.
  const ref: Record<string, number> = { 'm-opus': 100, 'm-sonnet': 80 };
  for (const [m, v] of Object.entries(ref)) add(`ref:${m}`, v);
  const delta: Record<string, Record<string, number>> = {
    prompt: { 'm-opus': 40 }, 'baseline-prompt': { 'm-opus': 30 }, brief: { 'm-sonnet': 15 },
    [`agent:${S}`]: { 'm-sonnet': 500 }, [`agent:${E}`]: { 'm-sonnet': 700 },
    rules: { 'm-opus': 300, 'm-sonnet': 250 }, 'skill-listing': { 'm-opus': 400, 'm-sonnet': 350 }, 'agent-listing': { 'm-opus': 200 },
    'pointer:CLAUDE.md': { 'm-opus': 60, 'm-sonnet': 50 }, 'doc:CLAUDE.md': { 'm-opus': 90, 'm-sonnet': 80 }, 'doc:~/extra.md': { 'm-opus': 11 },
  };
  for (const [id, byModel] of Object.entries(delta)) for (const [m, d] of Object.entries(byModel)) add(`text:${id}:${m}`, ref[m] + d);
  const all = [M, S, E];
  const text = (id: string, owner: string, rows: string[]): Text => ({ id, owner, item: id, label: id.replace(/^(doc|pointer|agent):/, ''), text: id, rows });
  const texts = [
    text(`agent:${S}`, 'accord', [S]), text(`agent:${E}`, 'accord', [E]), text('rules', 'accord', all),
    text('skill-listing', 'accord', [M, E]), text('agent-listing', 'accord', [M]), text('pointer:CLAUDE.md', 'accord', all),
    text('doc:CLAUDE.md', 'CLAUDE.md and memory', all), text('doc:~/extra.md', 'CLAUDE.md and memory', [M]), text('prompt', 'probe', [M]), text('baseline-prompt', 'probe', [M]),
    text('brief', 'probe', [S, E]),
  ];

  const { rows, items } = fc.measure({ setup, probes: probes.map((p) => ({ id: p.id })), state: { probes }, located, texts });
  expect(rows.map((r) => r.row)).toEqual([M, E, S]);
  const row = (name: string) => rows.find((r) => r.row === name) as Measured['rows'][number];
  expect(row(M)).toEqual({
    row: M, model: 'm-opus', total: 49960,
    parts: { accord: 960, claudeCode: 11970, plugins: 1000, mcp: 4000, docs: 101, sets: 600 },
    unattributed: 31329,
  });
  expect(row(S)).toEqual({
    row: S, model: 'm-sonnet', total: 19985,
    parts: { accord: 800, claudeCode: 7985, plugins: 0, mcp: 0, docs: 80, sets: 100 },
    unattributed: 11020,
  });
  expect(row(E)).toEqual({
    row: E, model: 'm-sonnet', total: 20985,
    parts: { accord: 1350, claudeCode: 8985, plugins: 500, mcp: 200, docs: 80, sets: 0 },
    unattributed: 9870,
  });
  for (const r of rows) {
    const { claudeCode, accord, plugins, mcp, docs, sets } = r.parts;
    expect(claudeCode + accord + plugins + mcp + docs + sets + r.unattributed).toBe(r.total);
  }

  const item = (id: string) => items.find((i) => i.id === id) as Measured['items'][number];
  expect(item('plugin:alpha@m')).toMatchObject({ owner: 'plugins', label: 'alpha@m', perRow: { [M]: 1000, [E]: 500 } });
  expect(item('plugin:alpha@m').perRow).not.toHaveProperty(S);
  expect(item('plugin:beta@m').perRow).toEqual({});
  expect(item('plugin:accord-panel@accord')).toMatchObject({ owner: 'plugins', label: "accord-panel@accord (accord's own)", perRow: {} });
  expect(item('mcp:srv')).toMatchObject({ owner: 'MCP servers', label: 'srv', perRow: { [M]: 1000 } });
  expect(item('connector:claude.ai Docs X')).toMatchObject({
    owner: 'MCP servers', label: 'claude.ai Docs X (claude.ai connector)', perRow: { [M]: 1500, [E]: 100 },
  });
  expect(item('other-servers')).toMatchObject({ owner: 'MCP servers', label: 'other connected servers: plugin_alpha_srv', perRow: { [M]: 1500, [E]: 100 } });
  expect(item('set:gsd')).toMatchObject({ owner: 'own skills, agents and commands', label: 'set gsd (3 members)', perRow: { [M]: 600, [S]: 100 } });
  expect(item('skill-listing')).toMatchObject({ owner: 'accord', label: 'skill listing entries', perRow: { [M]: 400, [E]: 350 } });
  expect(item('skill-listing').perRow).not.toHaveProperty(S);
  expect(item('agent-definition')).toMatchObject({ owner: 'accord', label: 'agent definition', perRow: { [S]: 500, [E]: 700 } });
  expect(item('rules')).toMatchObject({ label: 'rules block', perRow: { [M]: 300, [S]: 250, [E]: 250 } });
  expect(item('agent-listing')).toMatchObject({ label: 'agent listing entries', perRow: { [M]: 200 } });
  expect(item('pointer:CLAUDE.md')).toMatchObject({ owner: 'accord', label: 'pointer block CLAUDE.md', perRow: { [M]: 60, [S]: 50, [E]: 50 } });
  expect(item('doc:CLAUDE.md')).toMatchObject({ owner: 'CLAUDE.md and memory', label: 'CLAUDE.md', perRow: { [M]: 90, [S]: 80, [E]: 80 } });
  expect(item('doc:~/.claude/projects/x/memory/note.md')).toMatchObject({ owner: 'CLAUDE.md and memory', perRow: {} });
  expect(item('doc:~/extra.md')).toMatchObject({ owner: 'CLAUDE.md and memory', label: '~/extra.md', perRow: { [M]: 11 } });
  expect(items.map((i) => i.id)).not.toContain('prompt');
  expect(items.map((i) => i.id)).not.toContain('brief');
});

const MAIN_LABEL = 'main session (claude -p)';
const LOCAL_SCOPE = 'Local-scope MCP servers and .claude/settings.local.json are not measured: the probe worktree loads neither.';
const sumOf = (...n: (number | undefined)[]) => n.reduce<number>((a, b) => a + (b ?? 0), 0);
/** The cells of the table under `heading`, one array per row, without the header and the separator. */
const tableUnder = (text: string, heading: string): string[][] => {
  const lines = text.split('\n');
  const at = lines.indexOf(heading);
  const rest = lines.slice(at + 1);
  const end = rest.findIndex((l) => l.startsWith('#'));
  const table = (end < 0 ? rest : rest.slice(0, end)).filter((l) => l.startsWith('|'));
  return table.slice(2).map((l) => l.split('|').slice(1, -1).map((c) => c.trim()));
};

/** What the raw table must hold for a row, computed from the chosen numbers alone. */
function expectedRow(row: RowName): string[] {
  const model = ROW_MODEL[row];
  const main = row === 'main';
  const d = (id: string) => sizeOf(id, model);
  const total = CHOSEN.allOn[row] - (main ? d('prompt') : d('brief'));
  const accord = sumOf(
    main ? 0 : d(`agent:${row}`), d('rules'), main || row === 'accord-executor' ? d('skill-listing') : 0,
    main ? d('agent-listing') : 0, main ? d('pointer:CLAUDE.md') : 0,
  );
  const claudeCode = main ? CHOSEN.baselineMain - d('baseline-prompt') : (CHOSEN.baselineStub[row] as number) - d('brief');
  const plugins = sumOf(...['plugin:accord-panel@accord', 'plugin:alpha@m', 'plugin:beta@m'].map((id) => CHOSEN.cut[id]?.[row]));
  const mcp = sumOf(CHOSEN.mcpRefCut[row], ...Object.values(CHOSEN.mcpCut).map((c) => c[row]));
  const docs = main ? sumOf(d('doc:CLAUDE.md'), d('doc:~/.claude/CLAUDE.md'), d('doc:MEMORY.md')) : 0;
  const sets = sumOf(...['set:aws', 'set:gsd', 'set:my', 'set:own', 'set:tool'].map((id) => CHOSEN.cut[id]?.[row]));
  const unattributed = total - accord - claudeCode - plugins - mcp - docs - sets;
  const calls = main ? 3 : 2;
  return [main ? MAIN_LABEL : row, model, String(calls), ...[total, accord, claudeCode, plugins, mcp, docs, sets, unattributed].map(String)];
}

it('ac-1 the main session and each accord agent that ran get one row split by owner', async () => {
  const m = await measuredWorld();
  const { w } = m;
  try {
    // The first call found the phase-two probes pending: exit 1, commands, no report.
    expect(m.firstRun.exit).toBe(1);
    expect(m.firstRun.reportWritten).toBe(false);
    expect(m.firstRun.text).toContain('--append-system-prompt-file');

    const r = m.bench.fixedReport(m.args);
    expect(r.exit).toBe(0);
    const raw = tableUnder(r.text, '## Fixed context per call, raw tokens');
    expect(raw.map((c) => c[0])).toEqual([MAIN_LABEL, 'accord-scout']);
    expect(raw[0]).toEqual(expectedRow('main'));
    expect(raw[1]).toEqual(expectedRow('accord-scout'));
    for (const cells of raw) {
      const n = cells.slice(3).map(Number);
      expect(n[0]).toBe(n.slice(1).reduce((a, b) => a + b, 0));
    }
    expect(readFileSync(m.reportFile, 'utf8')).toBe(r.text);

    const lines = r.text.split('\n');
    expect(lines[0]).toBe('# Fixed context per call');
    expect(lines).toContain('Transcripts: 6 calls from 2026-10-28 to 2026-10-29, read from 2 transcript folder(s).');
    expect(lines).toContain('Probes: the all-on probe of 2026-10-30 under Claude Code 9.0.0.');
    expect(lines).toContain('The main session row is measured under claude -p, with its probe prompt sized and taken out.');
    expect(lines).toContain('accord-scout: 1 of its 2 calls ran on m-haiku; they are counted at the size measured on m-sonnet.');
    expect(lines.filter((l) => l.includes(' calls ran on '))).toHaveLength(1);
    expect(lines.some((l) => l.startsWith('The newest transcript call'))).toBe(false);
    expect(lines).toContain(LOCAL_SCOPE);
    expect(lines).toContain('Cursor, Codex and Copilot calls were not measured.');
    expect(lines).toContain('A claude.ai connector can change its instructions on the server, which no fingerprint sees; its figure holds for the probe date.');
    expect(lines).toContain("A plugin's own MCP servers count under plugins and again in the other connected servers line; unattributed absorbs the overlap.");

    expect(r.text).not.toContain('local-db');
    expect(r.text).not.toMatch(/sekret-/);
    expect(r.text).not.toContain('accord-probe');
    expect(r.text).not.toContain(w.tmp);
    expect(r.text).not.toMatch(/[A-Za-z]:[\\/]+Users[\\/]/i);

    // A newer Claude Code on a real call is named beside the probe's; an accord agent with no definition keeps its calls and gets dashes.
    const later = (id: string, version: string) => ({ ...assistantLine({ id, ts: Date.UTC(2026, 9, 29, 20), cwd: w.repo, branch: 't/ST-LN-1', version }) });
    writeSession(w.home, 'real', 'real-2', { main: [userLine('more'), later('n1', '9.5.0')], agents: { 'accord-planner': [later('p1', '9.5.0')] }, descriptions: { 'accord-planner': 'plan it' } });
    const again = m.bench.fixedReport(m.args);
    expect(again.exit).toBe(0);
    expect(again.text.split('\n')).toContain('The newest transcript call ran Claude Code 9.5.0; the figures are measured under Claude Code 9.0.0.');
    const rows = tableUnder(again.text, '## Fixed context per call, raw tokens');
    expect(rows.map((c) => c[0])).toEqual([MAIN_LABEL, 'accord-planner', 'accord-scout']);
    expect(rows[0].slice(0, 3)).toEqual([MAIN_LABEL, 'm-opus', '4']);
    expect(rows[1]).toEqual(['accord-planner', '-', '1', ...Array<string>(8).fill('-')]);
  } finally {
    rmSync(w.tmp, { recursive: true, force: true, maxRetries: 5 });
  }
}, 120_000);

it('ac-3 the report printed twice on the same transcripts and setup is the same', async () => {
  const m = await measuredWorld();
  const { w } = m;
  try {
    const stateFile = `${w.bench}/fixed/probes.json`;
    const first = m.bench.fixedReport(m.args);
    expect(first.exit).toBe(0);
    const before = readFileSync(stateFile, 'utf8');
    const second = m.bench.fixedReport(m.args);
    expect(second.exit).toBe(0);
    expect(second.text).toBe(first.text);
    expect(readFileSync(stateFile, 'utf8')).toBe(before);
    expect(readFileSync(m.reportFile, 'utf8')).toBe(first.text);
  } finally {
    rmSync(w.tmp, { recursive: true, force: true, maxRetries: 5 });
  }
}, 120_000);

// ---- ST-LN-79 task 9: cost-weighted figures, the setup items and the ticket shares ----

type Bill = { input: number; cacheRead: number; cacheWrite: number; output: number };
/** The fixed context is charged to the cache reads first, then the cache writes, then the fresh input; weights 1, 0.1 and 1.25. */
function weighed(fixed: number, c: Bill): number {
  const reads = Math.min(fixed, c.cacheRead);
  const writes = Math.min(fixed - reads, c.cacheWrite);
  const fresh = Math.min(fixed - reads - writes, c.input);
  return 0.1 * reads + 1.25 * writes + fresh;
}
const wholeCost = (c: Bill) => c.input + 0.1 * c.cacheRead + 1.25 * c.cacheWrite + 5 * c.output;
const one = (n: number) => n.toFixed(1);
const pct = (n: number) => `${(n * 100).toFixed(1)}%`;
const OWNER_ORDER = ['accord', 'Claude Code', 'plugins', 'MCP servers', 'CLAUDE.md and memory', 'own skills, agents and commands'];
const order = (owner: string) => OWNER_ORDER.indexOf(owner);

it('ac-2 each figure is given raw and cost-weighted and each done lane M ticket gets two fixed context shares', async () => {
  const mainFixed = Number(expectedRow('main')[3]);
  const scoutFixed = Number(expectedRow('accord-scout')[3]);
  // m1: its cache reads cover the fixed context; m2: it reaches into its cache writes; m3: it reaches into its fresh input;
  // s1 and s2: the whole input is below it.
  const bill: Record<string, Bill> = {
    m1: { input: 5, cacheRead: 60000, cacheWrite: 1000, output: 200 },
    m2: { input: 100, cacheRead: 30000, cacheWrite: 25000, output: 300 },
    m3: { input: 100000, cacheRead: 10000, cacheWrite: 0, output: 50 },
    s1: { input: 10, cacheRead: 100, cacheWrite: 0, output: 70 },
    s2: { input: 10, cacheRead: 100, cacheWrite: 0, output: 0 },
    g1: { input: 50, cacheRead: 1000, cacheWrite: 20, output: 400 },
  };
  const elsewhere = { cwd: '/elsewhere', branch: 'main' };
  const m = await measuredWorld({
    tickets: true,
    real: {
      m1: { ...bill.m1, branch: 't/T-1' }, m2: { ...bill.m2, branch: 't/T-1' }, m3: { ...bill.m3, ...elsewhere },
      s1: { ...bill.s1, branch: 't/T-1' }, s2: { ...bill.s2, ...elsewhere }, g1: { ...bill.g1, branch: '' },
    },
  });
  const { w } = m;
  try {
    const r = m.bench.fixedReport(m.args);
    expect(r.exit).toBe(0);
    const lines = r.text.split('\n');

    // The raw table is unchanged and comes first.
    const rawTable = tableUnder(r.text, '## Fixed context per call, raw tokens');
    expect(rawTable[0]).toEqual(expectedRow('main'));
    expect(lines.indexOf('## Fixed context per call, raw tokens')).toBeLessThan(lines.indexOf('## Fixed context per call, cost-weighted tokens'));

    // The cost-weighted table: the mean over the row's calls, each owner its raw value times the row's ratio.
    const weightedTable = tableUnder(r.text, '## Fixed context per call, cost-weighted tokens');
    expect(weightedTable.map((c) => c[0])).toEqual([MAIN_LABEL, 'accord-scout']);
    const means = {
      main: (weighed(mainFixed, bill.m1) + weighed(mainFixed, bill.m2) + weighed(mainFixed, bill.m3)) / 3,
      'accord-scout': (weighed(scoutFixed, bill.s1) + weighed(scoutFixed, bill.s2)) / 2,
    };
    for (const row of ['main', 'accord-scout'] as const) {
      const raw = expectedRow(row);
      const cells = weightedTable[row === 'main' ? 0 : 1];
      const ratio = means[row] / Number(raw[3]);
      expect(cells.slice(0, 3)).toEqual(raw.slice(0, 3));
      expect(cells[3]).toBe(one(means[row]));
      expect(cells.slice(4, 11)).toEqual(raw.slice(4, 11).map((v) => one(Number(v) * ratio)));
      const owners = raw.slice(4, 10).map(Number);
      expect(cells[11]).toBe(OWNER_ORDER[owners.indexOf(Math.max(...owners))]);
    }
    expect(lines).toContain('Weights: fresh input 1, cache read 0.1, cache write 1.25. 2 calls had less input than the fixed context now measured; the excess was not charged.');

    // The items table.
    const setup = m.bench.readSetup({ repo: w.repo, home: w.home }) as { docs: { label: string }[] };
    const items = tableUnder(r.text, '## Setup items, tokens per call (raw / cost-weighted)');
    expect(lines).toContain(`| item | owner | ${MAIN_LABEL} | accord-scout |`);
    const of = (owner: string) => items.filter((c) => c[1] === owner).map((c) => c[0]);
    expect(of('plugins')).toEqual(["accord-panel@accord (accord's own)", 'alpha@m', 'beta@m']);
    expect(of('MCP servers')).toEqual(['other connected servers: none', 'proj-db', 'user-search']);
    expect(of('CLAUDE.md and memory').sort()).toEqual(setup.docs.map((d) => d.label).sort());
    expect(of('own skills, agents and commands').map((l) => l.split(' ')[1])).toEqual(['aws', 'gsd', 'my', 'own', 'tool']);
    expect(items.map((c) => order(c[1]))).toEqual(items.map((c) => order(c[1])).sort((a, b) => a - b));
    const cell = (label: string) => (items.find((c) => c[0] === label) as string[]).slice(2);
    const mainRatio = means.main / mainFixed;
    expect(cell('alpha@m')).toEqual([`1000 / ${one(1000 * mainRatio)}`, '-']);
    expect(cell('beta@m')).toEqual(['-', '-']);
    expect(cell(setup.docs.find((d) => d.label.endsWith('note.md'))?.label as string)).toEqual(['-', '-']);
    expect(cell('set gsd (3 members)')).toEqual([`600 / ${one(600 * mainRatio)}`, `100 / ${one(100 * (means['accord-scout'] / scoutFixed))}`]);
    expect(lines).toContain('What the owner could cut: each line above is the cost per call that removing the item saves in that row.');

    // The tickets table: T-1 only; its calls are m1, m2 and s1 on its branch and g1 in the folder that only ever recorded it.
    const tickets = tableUnder(r.text, "## Lane M tickets, share of the ticket's cost");
    expect(tickets.map((c) => c[0])).toEqual(['T-1']);
    const cost = wholeCost(bill.m1) + wholeCost(bill.m2) + wholeCost(bill.s1) + wholeCost(bill.g1);
    expect(tickets[0]).toEqual([
      'T-1', new Date(CLAIMED['T-1']).toISOString().slice(0, 10), '4',
      pct((weighed(mainFixed, bill.m1) + weighed(mainFixed, bill.m2)) / cost), pct(weighed(scoutFixed, bill.s1) / cost),
    ]);
    expect(lines).toContain('| ticket | claim | calls | main fixed context | accord subagents fixed context |');
    expect(lines).toContain("Weights: fresh input 1, cache read 0.1, cache write 1.25, output 5. Output tokens are estimated at 4 characters a token, since transcripts keep the usage from the stream's start.");
    expect(lines).toContain("The subagent share counts accord agents only; other subagents (such as Explore or general-purpose) count in the ticket's whole cost, and their fixed context is not measured.");

    // With no done ticket in range, the table is replaced by one sentence.
    const none = await measuredWorld();
    try {
      const text = none.bench.fixedReport(none.args).text.split('\n');
      const at = text.indexOf("## Lane M tickets, share of the ticket's cost");
      expect(text.slice(at)).toEqual(["## Lane M tickets, share of the ticket's cost", '', "No lane M ticket reached done with its claim inside the transcripts' date range.", '']);
    } finally {
      rmSync(none.w.tmp, { recursive: true, force: true, maxRetries: 5 });
    }
  } finally {
    rmSync(w.tmp, { recursive: true, force: true, maxRetries: 5 });
  }
}, 120_000);
