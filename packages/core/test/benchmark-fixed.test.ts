/* eslint-disable @typescript-eslint/no-explicit-any -- transcript lines are untyped JSON of Claude Code */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { appendFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { assistantLine, attachmentLine, HOOK, makeWorld, writeSession, type World } from './helpers/fixed-world.js';

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

type Row = FirstCall;
type Stub = { name: string; tools: string[] | null; model: string; agents: string[] };
type Text = { id: string; owner: string; label: string; text: string; rows: string[] };
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

it('risk:complex-branching each text is sized on the models of the rows it reaches and the baseline has one stub per tool list and model', async () => {
  const fc = (await import(new URL('../../../scripts/fixed-context.mjs', import.meta.url).href)) as Two;
  const RULES = '# accord rules\n\nhold these';
  const CLAUDE = 'own line\n<!-- accord:start -->\npointer block\n<!-- accord:end -->\n';
  const MEMORY = 'C:/h/.claude/projects/C--w-repo/memory/MEMORY.md';
  const agent = (name: string, model: string, tools: string[] | null) => ({ name, model, tools, body: `body of ${name}`, hash: 'h' });
  const setup = {
    repo: 'C:/w/repo', mainCheckout: 'C:/w/repo', probeDir: 'C:/w/accord-probe', home: 'C:/h',
    mcp: [{ name: 'proj-db' }],
    accordSkills: [{ name: 'accord', description: 'd' }],
    agents: [
      agent('accord-scout', 'sonnet', ['Read', 'Grep', 'Glob']), agent('accord-critic', 'opus', ['Read', 'Grep', 'Glob']),
      agent('accord-executor', 'sonnet', null), agent('accord-ghost', 'sonnet', null),
    ],
  };
  const call = (o: Partial<Row>): Row => ({
    id: 'x', model: 'm', version: '2.1.314', ts: 0, cwd: '', branch: '', input: 0, usage: { input: 0, cacheRead: 0, cacheWrite: 0 },
    instructions: [], skillListing: [], agentListing: [], hookContexts: [], mcpServers: [], sessionStartHook: false, prompt: '', ...o,
  });
  const allOn = {
    main: call({
      model: 'm-opus', sessionStartHook: true, skillListing: ['- accord: a', '- gsd-a: b'], agentListing: ['- accord-scout: s', '- other: o'],
      instructions: [{ path: 'C:\\w\\accord-probe\\CLAUDE.md', type: 'Project' }, { path: MEMORY, type: 'AutoMem' }],
      mcpServers: ['claude.ai Docs X', 'plugin_alpha_srv', 'proj_db'],
    }),
    agents: {
      'accord-scout': call({ model: 'm-sonnet', hookContexts: [RULES], instructions: [{ path: 'C:/w/accord-probe/CLAUDE.md', type: 'Project' }] }),
      'accord-critic': call({
        model: 'm-opus', hookContexts: [RULES],
        instructions: [{ path: 'C:/w/accord-probe/CLAUDE.md', type: 'Project' }, { path: MEMORY, type: 'AutoMem' }],
      }),
      'accord-executor': call({
        model: 'm-sonnet', hookContexts: [RULES], skillListing: ['- accord: a'],
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
  expect(text('agent:accord-critic')).toMatchObject({ owner: 'accord', text: 'body of accord-critic', rows: ['accord-critic'] });
  expect(text('rules')).toMatchObject({ owner: 'accord', text: RULES, rows: ['main', 'accord-critic', 'accord-executor', 'accord-scout'] });
  expect(text('skill-listing')).toMatchObject({ owner: 'accord', text: '- accord: a', rows: ['main', 'accord-executor'] });
  expect(text('agent-listing')).toMatchObject({ owner: 'accord', text: '- accord-scout: s', rows: ['main'] });
  expect(text('doc:CLAUDE.md').owner).toBe('CLAUDE.md and memory');
  expect(text('doc:CLAUDE.md').text).toContain('own line');
  expect(text('doc:CLAUDE.md').text).not.toContain('accord:start');
  expect(text('doc:CLAUDE.md').rows).toEqual(['main', 'accord-critic', 'accord-executor', 'accord-scout']);
  expect(text('pointer:CLAUDE.md').owner).toBe('accord');
  expect(text('pointer:CLAUDE.md').text).toBe('<!-- accord:start -->\npointer block\n<!-- accord:end -->');
  expect(text('doc:~/.claude/projects/C--w-repo/memory/MEMORY.md').rows).toEqual(['main', 'accord-critic']);
  expect(text('prompt')).toMatchObject({ owner: 'probe', rows: ['main'], text: fc.dispatchPrompt(setup.agents.map((a) => a.name)) });
  expect(text('baseline-prompt')).toMatchObject({ owner: 'probe', rows: ['main'], text: fc.dispatchPrompt(['stub-1', 'stub-2', 'stub-3']) });
  expect(text('brief')).toMatchObject({ owner: 'probe', text: fc.PROBE_BRIEF, rows: ['accord-critic', 'accord-executor', 'accord-scout'] });

  const two = fc.phaseTwo(setup, allOn, read);
  expect(two.map((p) => p.id)).toEqual([...two.map((p) => p.id)].sort());
  const models = (id: string) => two.filter((p) => p.id.startsWith(`text:${id}:`)).map((p) => p.model).sort();
  expect(models('agent:accord-critic')).toEqual(['m-opus']);
  expect(models('rules')).toEqual(['m-opus', 'm-sonnet']);
  expect(models('skill-listing')).toEqual(['m-opus', 'm-sonnet']);
  expect(models('agent-listing')).toEqual(['m-opus']);
  expect(models('doc:~/.claude/projects/C--w-repo/memory/MEMORY.md')).toEqual(['m-opus']);
  expect(models('doc:CLAUDE.md')).toEqual(['m-opus', 'm-sonnet']);
  expect(models('brief')).toEqual(['m-opus', 'm-sonnet']);
  expect(models('prompt')).toEqual(['m-opus']);
  expect(models('baseline-prompt')).toEqual(['m-opus']);
  expect(two.filter((p) => p.id.startsWith('ref:')).map((p) => p.id)).toEqual(['ref:m-opus', 'ref:m-sonnet']);
  const probe = (id: string): TwoProbe => two.find((p) => p.id === id) as TwoProbe;
  expect(probe('text:agent:accord-critic:m-opus')).toMatchObject({
    where: 'empty', source: 'disk', text: 'body of accord-critic',
    depends: { 'text:agent:accord-critic': createHash('sha256').update('body of accord-critic').digest('hex') },
  });
  expect(probe('text:rules:m-opus').source).toBe('probe');
  expect(probe('text:doc:CLAUDE.md:m-sonnet').source).toBe('disk');
  expect(probe('text:pointer:CLAUDE.md:m-opus').source).toBe('disk');
  expect(probe('baseline')).toMatchObject({ where: 'empty', model: 'm-opus', stubs, depends: { stubs: JSON.stringify(stubs) } });
  expect(probe('ref:m-sonnet').where).toBe('empty');

  expect(fc.connectorsOf(setup, allOn)).toEqual({ connectors: ['claude.ai Docs X'], others: ['plugin_alpha_srv'] });
  expect(two.filter((p) => p.id.startsWith('connector:'))).toEqual([]);
  const withForm = fc.phaseTwo(setup, allOn, read, { ...fc.PROBE_FORMS, connector: 'mcp__{server}' }).filter((p) => p.id.startsWith('connector:'));
  expect(withForm).toEqual([
    { id: 'connector:claude.ai Docs X', where: 'probe', depends: {}, settings: { permissions: { deny: ['mcp__claude_ai_Docs_X'] } } },
  ]);
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
