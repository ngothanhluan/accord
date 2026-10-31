// The pure half of the fixed-context measurement (ST-LN-79): the probe constants, the command forms the Task 1
// spike proved, and the reader of a probe transcript's first call.
// Imports only node:crypto for a hash, reads no file, spawns nothing and reads no clock (the house pattern of round.mjs).
import { createHash } from 'node:crypto';

export const PROBE_BRANCH = 'probe/fixed-context';
export const PROBE_BRIEF = 'accord fixed-context probe: reply ok, use no tool';
export const PROBE_PREFIX = 'accord fixed-context probe';
export const PROBE_DESCRIPTION = 'fixed probe ';

// The prompt that makes a probe session dispatch each of the given subagent types once with the marker brief.
export const dispatchPrompt = (types) =>
  `${PROBE_PREFIX}. In one message, dispatch each of these subagent types once, with the description "${PROBE_DESCRIPTION}<type>" and the prompt "${PROBE_BRIEF}": ${types.join(', ')}. Use no other tool, then reply ok.`;

// Claude Code writes a server into tool names with every character outside [A-Za-z0-9] turned to "_".
export const serverKey = (name) => name.replace(/[^A-Za-z0-9]/g, '_');

// The forms the spike of 2026-10-31 proved with Claude Code 2.1.314 (every run from Git Bash, on Windows).
// - A dispatched agent needs no extra flag in `-p`.
// - `--setting-sources ""` turns every setting source off; `--agents` takes the path of a JSON file.
// - Agents are moved out of reach with the permission rule `Agent(<name>)`. The rule `Skill(<name>)` does not:
//   a denied skill or command stays in the skill listing, so `deny.skill` and `deny.command` are null and a skill
//   or command is moved out of reach with the setting `skillOverrides: { "<name>": <skillOverride> }` instead.
// - A claude.ai connector cannot be taken out of the main session's first call by a deny rule: neither
//   `mcp__<server>` nor `mcp__<server>__*` removes its `mcp_instructions_delta` entry, so `connector` is null.
export const PROBE_FORMS = {
  claudeVersion: '2.1.314',
  extraArgs: [],
  noSources: ['--setting-sources', ''],
  agentsArg: 'file',
  deny: { skill: null, agent: 'Agent({name})', command: null },
  skillOverride: 'off',
  connector: null,
};

const sum = (u) => u.input + u.cacheRead + u.cacheWrite;

// The first call of a transcript, from its parsed lines: the first assistant line whose model is not
// "<synthetic>", every line of the same message for the largest value of each usage field, and what loaded
// before that line. Null when the lines hold no such call.
export function firstCall(lines) {
  const at = lines.findIndex((l) => l?.type === 'assistant' && l.message?.model !== '<synthetic>');
  if (at < 0) return null;
  const first = lines[at];
  const id = first.message.id ?? first.requestId ?? first.uuid;
  const usage = { input: 0, cacheRead: 0, cacheWrite: 0 };
  for (const l of lines) {
    if (l?.type !== 'assistant' || (l.message?.id ?? l.requestId ?? l.uuid) !== id) continue;
    const u = l.message?.usage ?? {};
    usage.input = Math.max(usage.input, u.input_tokens ?? 0);
    usage.cacheRead = Math.max(usage.cacheRead, u.cache_read_input_tokens ?? 0);
    usage.cacheWrite = Math.max(usage.cacheWrite, u.cache_creation_input_tokens ?? 0);
  }
  const before = lines.slice(0, at);
  const attachments = (type) => before.filter((l) => l?.attachment?.type === type).map((l) => l.attachment);
  const servers = new Map();
  for (const a of attachments('mcp_instructions_delta')) for (const name of a.addedNames ?? []) servers.set(serverKey(name), name);
  for (const a of attachments('deferred_tools_delta')) {
    for (const tool of a.addedNames ?? []) {
      const m = /^mcp__(.+?)__.+$/.exec(tool);
      if (m && !servers.has(serverKey(m[1]))) servers.set(serverKey(m[1]), m[1]);
    }
  }
  // A block belongs to the name it starts with (`## <name>`), else to the name at its own index; otherwise it is dropped.
  const mcpBlocks = {};
  for (const a of attachments('mcp_instructions_delta')) {
    const names = a.addedNames ?? [];
    (a.addedBlocks ?? []).forEach((block, i) => {
      if (typeof block !== 'string') return;
      const name = names.find((n) => block === `## ${n}` || block.startsWith(`## ${n}\n`)) ?? names[i];
      if (name !== undefined) mcpBlocks[name] = block;
    });
  }
  const deferredTools = [...new Set(attachments('deferred_tools_delta').flatMap((a) => a.addedNames ?? []))];
  const user = lines.find((l) => l?.type === 'user');
  const content = user?.message?.content;
  const prompt = typeof content === 'string' ? content : Array.isArray(content) ? content.filter((c) => c?.type === 'text').map((c) => c.text).join('\n') : '';
  const stamp = Date.parse(first.timestamp);
  return {
    id,
    model: first.message.model,
    version: lines.find((l) => l?.version)?.version,
    ts: Number.isNaN(stamp) ? 0 : stamp,
    cwd: first.cwd ?? lines.find((l) => l?.cwd)?.cwd,
    branch: first.gitBranch ?? lines.find((l) => l?.gitBranch)?.gitBranch,
    input: sum(usage),
    usage,
    instructions: attachments('instructions').flatMap((a) => (a.files ?? []).map((f) => ({ path: f.path, type: f.type }))),
    skillListing: attachments('skill_listing').flatMap((a) => String(a.content ?? '').split('\n')),
    agentListing: attachments('agent_listing_delta').flatMap((a) => a.addedLines ?? []),
    hookContexts: attachments('hook_additional_context').flatMap((a) => a.content ?? []),
    mcpServers: [...servers.values()].sort(),
    sessionStartHook: attachments('hook_success').some(
      (a) => a.hookEvent === 'SessionStart' && a.exitCode === 0 && String(a.command ?? '').includes(' hook session-start'),
    ),
    prompt,
    mcpBlocks,
    deferredTools,
  };
}

// Which repository file a path stands for. A probe transcript names the probe worktree's copy of a file, never
// the repository file the report sizes, so a path under the probe worktree, the repository or the main checkout
// (compared case folded, in that order) stands for the same path under the repository. Other paths keep their
// file; a path under the home folder is labelled `~/<rest>` so no user name reaches the report.
export function standsFor(file, { repo, mainCheckout, probeDir, home }) {
  const slash = (p) => String(p).replace(/\\/g, '/').replace(/\/+$/, '');
  const p = slash(file);
  const under = (root) => {
    const r = slash(root);
    const lower = p.toLowerCase();
    if (lower === r.toLowerCase()) return '';
    return lower.startsWith(r.toLowerCase() + '/') ? p.slice(r.length + 1) : null;
  };
  for (const root of [probeDir, repo, mainCheckout]) {
    const rest = under(root);
    if (rest !== null) return { file: rest ? `${slash(repo)}/${rest}` : slash(repo), label: rest };
  }
  const rest = under(home);
  if (rest !== null) return { file: p, label: rest ? `~/${rest}` : '~' };
  return { file: p, label: p };
}

const sha256 = (data) => createHash('sha256').update(data).digest('hex');
const cmp = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

// What each probe depends on, as { key: value }: a probe is stale when a key it was written with has another
// value now. Keys are sorted so the stored form never depends on the order the setup was read in.
export function fingerprints(setup) {
  const out = {};
  for (const p of setup.plugins) out[`plugin:${p.id}`] = p.version ?? 'none';
  for (const m of setup.mcp) out[`mcp:${m.name}`] = m.hash;
  for (const s of setup.sets) out[`set:${s.prefix}`] = sha256(s.members.map((m) => `${m.kind}\0${m.name}\0${m.hash}`).sort(cmp).join('\n'));
  for (const a of setup.agents) out[`agent:${a.name}`] = a.hash;
  out.hook = setup.hookCommand;
  out.skills = sha256(setup.accordSkills.map((s) => `${s.name}\0${s.description}`).sort(cmp).join('\n'));
  // Which instruction files exist and what they hold; a memory topic file is read on demand, so it never makes a probe stale.
  out.docs = sha256(setup.docs.filter((d) => !d.topic).map((d) => `${d.label}\0${d.hash}`).sort(cmp).join('\n'));
  return Object.fromEntries(Object.entries(out).sort(([a], [b]) => cmp(a, b)));
}

// The probes run from the probe worktree that need no transcript to be planned: everything on, one probe per
// enabled plugin with only that plugin off, the MCP reference and one probe per listable server with only that
// server left out, and one probe per set of the owner's own skills, agents and commands moved out of reach.
// Each is { id, where, depends, settings?, mcp? }; `mcp` lists { name, entry } and is absent when no server stays.
export function phaseOne(setup, forms = PROBE_FORMS) {
  const fp = fingerprints(setup);
  const pick = (keys) => Object.fromEntries(keys.map((k) => [k, fp[k]]));
  const servers = setup.mcp.map((m) => ({ name: m.name, entry: m.entry }));
  const withServers = (list) => (list.length ? { mcp: list } : {});
  const probes = [{ id: 'all-on', where: 'probe', depends: fp }];
  for (const p of setup.plugins) {
    probes.push({ id: `plugin:${p.id}`, where: 'probe', depends: pick([`plugin:${p.id}`]), settings: { enabledPlugins: { [p.id]: false } } });
  }
  probes.push({ id: 'mcp-ref', where: 'probe', depends: pick(setup.mcp.map((m) => `mcp:${m.name}`)), ...withServers(servers) });
  for (const m of setup.mcp) {
    probes.push({ id: `mcp:${m.name}`, where: 'probe', depends: pick([`mcp:${m.name}`]), ...withServers(servers.filter((s) => s.name !== m.name)) });
  }
  for (const s of setup.sets) {
    const agents = s.members.filter((m) => m.kind === 'agent').map((m) => forms.deny.agent.replace('{name}', m.name));
    const others = s.members.filter((m) => m.kind !== 'agent');
    probes.push({
      id: `set:${s.prefix}`,
      where: 'probe',
      depends: pick([`set:${s.prefix}`]),
      settings: {
        ...(agents.length ? { permissions: { deny: agents } } : {}),
        ...(others.length ? { skillOverrides: Object.fromEntries(others.map((m) => [m.name, forms.skillOverride])) } : {}),
      },
    });
  }
  return probes.sort((a, b) => cmp(a.id, b.id));
}

// Arguments joined for Git Bash: a plain one as it is, any other (the empty string included) in single quotes.
// A path given to it is absolute: a `~` is outside the plain set, so it would be quoted and never expanded.
export const shellLine = (args) =>
  args.map((a) => (/^[A-Za-z0-9._/@+=:,-]+$/.test(a) ? a : `'${a.replace(/'/g, `'\\''`)}'`)).join(' ');

// The all-on first call of each row; a row's model key is the model that call ran on.
const rowCalls = (allOn) => ({ main: allOn.main, ...allOn.agents });
const byName = (a, b) => cmp(a.name, b.name);

// One stub agent per distinct pair of tool list and model among the accord agents that have an all-on first call, so
// the baseline carries exactly the tool definitions each row carries. A tool list is sorted; null (every tool) is its
// own value. Stubs are named stub-1, stub-2, ... in the order of their first agent by name; `model` is the agent's
// frontmatter model (what `--agents` takes), and the pair is told apart by the model the first call ran on.
export function stubsOf(setup, allOn) {
  const stubs = [];
  const at = new Map();
  for (const agent of [...setup.agents].sort(byName)) {
    const call = allOn.agents[agent.name];
    if (!call) continue;
    const tools = agent.tools ? [...agent.tools].sort(cmp) : null;
    const key = JSON.stringify([tools, call.model]);
    if (!at.has(key)) {
      at.set(key, stubs.length);
      stubs.push({ name: `stub-${stubs.length + 1}`, tools, model: agent.model, agents: [] });
    }
    stubs[at.get(key)].agents.push(agent.name);
  }
  return stubs;
}

const START = '<!-- accord:start -->';
const END = '<!-- accord:end -->';

// The name of a listing entry: the text after `- ` up to the first `:` followed by a space or ending the line
// (`- claude-security:explore: x` is `claude-security:explore`); undefined for a line that is not an entry.
export const entryName = (line) => /^- (.*?):(?: |$)/.exec(line)?.[1];

// A plugin's name is its id up to the last `@`.
const pluginName = (id) => (id.lastIndexOf('@') < 0 ? id : id.slice(0, id.lastIndexOf('@')));

// Every text the report sizes, with the item it belongs to and the rows it reaches: { id, owner, item, label, text, rows }.
// A text is charged only to rows it reaches, read from the all-on probe. `read(file)` gives a repository or home file
// as it is now, undefined when it is gone; it is never given a path under the probe worktree, whose copy stands for
// the repository file. Rows are `main` first, then the accord agents by name.
export function textsOf(setup, allOn, read) {
  const calls = rowCalls(allOn);
  const agents = Object.keys(allOn.agents).sort(cmp);
  const rowNames = ['main', ...agents];
  const reach = (has) => rowNames.filter((r) => has(calls[r]));
  const out = [];
  for (const agent of [...setup.agents].sort(byName)) {
    if (allOn.agents[agent.name]) out.push({ id: `agent:${agent.name}`, owner: 'accord', item: 'agent-definition', label: agent.name, text: agent.body, rows: [agent.name] });
  }

  const rules = agents.flatMap((a) => allOn.agents[a].hookContexts).find((c) => c.startsWith('# accord rules'));
  if (rules !== undefined) {
    out.push({ id: 'rules', owner: 'accord', item: 'rules', label: 'rules', text: rules, rows: reach((c) => c.hookContexts.includes(rules) || (c === allOn.main && c.sessionStartHook)) });
  }

  // The owner of a listing line, the first that applies, so a line is charged once: accord, an enabled plugin (the
  // entry name starts with `<plugin name>:`), a set of the owner's own skills, agents and commands, else none (Claude
  // Code's own entries and unknown ones stay out of every named part).
  const plugins = [...(setup.plugins ?? [])].sort((a, b) => cmp(a.id, b.id));
  const sets = [...(setup.sets ?? [])].sort((a, b) => cmp(a.prefix, b.prefix));
  const ownerOf = (line, field) => {
    const name = entryName(line);
    if (name === undefined) return null;
    const skills = field === 'skillListing';
    if ((skills ? setup.accordSkills : setup.agents).some((x) => x.name === name)) return 'accord';
    const plugin = plugins.find((p) => name.startsWith(`${pluginName(p.id)}:`));
    if (plugin) return `plugin:${plugin.id}`;
    const set = sets.find((s) => s.members.some((m) => m.name === name && (skills ? m.kind !== 'agent' : m.kind === 'agent')));
    return set ? `set:${set.prefix}` : null;
  };
  // The listing lines of one owner as a text: taken from the main first call when it holds any, else from the first
  // agent by name that holds any; its rows are those holding at least one of the lines.
  const listing = (id, field, who, extra) => {
    const mine = (line) => ownerOf(line, field) === who;
    const from = [allOn.main, ...agents.map((a) => allOn.agents[a])].find((c) => c[field].some(mine));
    if (from) out.push({ id, ...extra, text: from[field].filter(mine).join('\n'), rows: reach((c) => c[field].some(mine)) });
  };
  listing('skill-listing', 'skillListing', 'accord', { owner: 'accord', item: 'skill-listing', label: 'skill-listing' });
  listing('agent-listing', 'agentListing', 'accord', { owner: 'accord', item: 'agent-listing', label: 'agent-listing' });

  const seen = new Set();
  for (const r of rowNames) {
    for (const { path } of calls[r].instructions) {
      const { file, label } = standsFor(path, setup);
      if (seen.has(file.toLowerCase())) continue;
      seen.add(file.toLowerCase());
      const content = read(file);
      if (content === undefined) continue;
      const rows = reach((c) => c.instructions.some((i) => standsFor(i.path, setup).file.toLowerCase() === file.toLowerCase()));
      const from = content.indexOf(START);
      const to = from < 0 ? -1 : content.indexOf(END, from);
      let doc = content;
      if (to >= 0) {
        const end = to + END.length;
        out.push({ id: `pointer:${label}`, owner: 'accord', item: `pointer:${label}`, label, text: content.slice(from, end), rows });
        doc = content.slice(0, from) + content.slice(end);
      }
      if (doc.trim() !== '') out.push({ id: `doc:${label}`, owner: 'CLAUDE.md and memory', item: `doc:${label}`, label, text: doc, rows });
    }
  }

  // The listing entries of each enabled plugin and each own set. A text with no line is left out.
  for (const p of plugins) {
    listing(`plugin-skills:${p.id}`, 'skillListing', `plugin:${p.id}`, { owner: 'plugins', item: `plugin:${p.id}`, label: p.id });
    listing(`plugin-agents:${p.id}`, 'agentListing', `plugin:${p.id}`, { owner: 'plugins', item: `plugin:${p.id}`, label: p.id });
  }
  for (const s of sets) {
    const extra = { owner: 'own skills, agents and commands', item: `set:${s.prefix}`, label: `set ${s.prefix}` };
    listing(`set-skills:${s.prefix}`, 'skillListing', `set:${s.prefix}`, extra);
    listing(`set-agents:${s.prefix}`, 'agentListing', `set:${s.prefix}`, extra);
  }

  // The connected MCP servers: the names of every instructions block, then those the tool names of the deferred
  // tools carry; one name for each key, the block's name kept.
  const names = new Map();
  for (const r of rowNames) for (const n of Object.keys(calls[r].mcpBlocks)) names.set(serverKey(n), n);
  for (const r of rowNames) {
    for (const tool of calls[r].deferredTools) {
      const m = /^mcp__(.+?)__.+$/.exec(tool);
      if (m && !names.has(serverKey(m[1]))) names.set(serverKey(m[1]), m[1]);
    }
  }
  const agentRows = [...setup.agents].sort(byName).map((a) => a.name).filter((n) => allOn.agents[n]);
  const blockOf = (c, key) => Object.entries(c.mcpBlocks).find(([n]) => serverKey(n) === key)?.[1];
  const toolsOf = (c, key) => c.deferredTools.filter((t) => t.startsWith(`mcp__${key}__`));
  for (const n of [...names.values()].sort(cmp)) {
    const key = serverKey(n);
    const listed = setup.mcp.find((m) => serverKey(m.name) === key);
    const extra = { owner: 'MCP servers', item: `mcp:${listed ? listed.name : n}`, label: n };
    const from = [allOn.main, ...agents.map((a) => allOn.agents[a])].find((c) => blockOf(c, key) !== undefined);
    if (from) {
      // Claude Code adds a block the main session holds to a subagent after the subagent's first call.
      const rows = blockOf(allOn.main, key) !== undefined ? ['main', ...agentRows] : reach((c) => blockOf(c, key) !== undefined);
      out.push({ id: `mcp-block:${n}`, ...extra, text: blockOf(from, key), rows });
    }
    const tools = [allOn.main, ...agents.map((a) => allOn.agents[a])].find((c) => toolsOf(c, key).length);
    if (tools) out.push({ id: `mcp-tools:${n}`, ...extra, text: toolsOf(tools, key).join('\n'), rows: reach((c) => toolsOf(c, key).length > 0) });
  }

  const stubs = stubsOf(setup, allOn);
  out.push({ id: 'prompt', owner: 'probe', item: null, label: 'prompt', text: dispatchPrompt(setup.agents.map((a) => a.name)), rows: ['main'] });
  out.push({ id: 'baseline-prompt', owner: 'probe', item: null, label: 'baseline-prompt', text: dispatchPrompt(stubs.map((s) => s.name)), rows: ['main'] });
  out.push({ id: 'brief', owner: 'probe', item: null, label: 'brief', text: PROBE_BRIEF, rows: agents });
  return out;
}

// The servers the all-on main session lists that the setup cannot list: claude.ai connectors, and the rest (a
// plugin's own server, whose key starts with plugin_). Each list is sorted.
export function connectorsOf(setup, allOn) {
  const listable = new Set(setup.mcp.map((m) => serverKey(m.name)));
  const extra = allOn.main.mcpServers.filter((n) => !listable.has(serverKey(n)));
  const isConnector = (n) => n.startsWith('claude.ai ') || serverKey(n).startsWith('claude_ai_');
  return { connectors: extra.filter(isConnector).sort(cmp), others: extra.filter((n) => !isConnector(n)).sort(cmp) };
}

// The probes planned from the all-on transcript: one per claude.ai connector (when a form takes one out), the
// baseline with its stub agents, a reference and a calibration probe (the brief with `calibration` appended) per model,
// and each text appended to the baseline on each model of the rows it reaches. Each is { id, where, depends, model?, ... };
// the files and commands are written by the caller.
export function phaseTwo(setup, allOn, read, calibration, forms = PROBE_FORMS) {
  const calls = rowCalls(allOn);
  const stubs = stubsOf(setup, allOn);
  const probes = [];
  if (forms.connector !== null) {
    for (const name of connectorsOf(setup, allOn).connectors) {
      probes.push({
        id: `connector:${name}`,
        where: 'probe',
        depends: {},
        settings: { permissions: { deny: [forms.connector.replace('{server}', serverKey(name))] } },
      });
    }
  }
  probes.push({ id: 'baseline', where: 'empty', model: allOn.main.model, stubs, depends: { stubs: JSON.stringify(stubs) } });
  const modelsOf = (rows) => [...new Set(rows.map((r) => calls[r].model))].sort(cmp);
  for (const model of modelsOf(Object.keys(calls))) {
    probes.push({ id: `ref:${model}`, where: 'empty', model, depends: {} });
    probes.push({ id: `cal:${model}`, where: 'empty', model, text: calibration, depends: { calibration: sha256(calibration) } });
  }
  for (const t of textsOf(setup, allOn, read)) {
    const source = /^(agent|doc|pointer):/.test(t.id) ? 'disk' : 'probe';
    for (const model of modelsOf(t.rows)) {
      probes.push({ id: `text:${t.id}:${model}`, where: 'empty', model, text: t.text, source, depends: { [`text:${t.id}`]: sha256(t.text) } });
    }
  }
  return probes.sort((a, b) => cmp(a.id, b.id));
}

export const PHASE_TWO_NOTE = 'The connector, baseline, reference and text probes follow once the all-on probe has run.';

// The Claude Code the probes ran with: the version of the newest main first call among the sessions `state` names.
// The session that runs the script is never used, since the probes run in the owner's shell, whose Claude Code may be another build.
export function probeVersion(state, located) {
  let best;
  for (const e of [...state].sort((a, b) => cmp(a.id, b.id))) {
    const call = located.get(e.sessionId)?.main;
    if (call && (best === undefined || call.ts > best.ts)) best = call;
  }
  return best?.version;
}

// The probes needed now and which of them must be run: { probes, pending, failed, notes }. `state` is the stored
// probes (`{ id, sessionId, fingerprint }`), `located` the sessions found for them. A probe is missing without a
// stored session, a main first call, an agent first call of the setup (probes run from the probe worktree) or a stub
// first call (baseline); it is stale when its Claude Code is not `version` or a value it depends on has changed.
// A calibration pair whose `cal:` input is not above its `ref:` input gives no size: both probes are pending again.
// A set probe that is not pending but still lists a member did not move it out of reach: it is failed.
export function pendingProbes({ setup, state, located, version, read, calibration, forms = PROBE_FORMS }) {
  const entries = new Map(state.map((e) => [e.id, e]));
  const sessionOf = (id) => {
    const e = entries.get(id);
    return e ? located.get(e.sessionId) : undefined;
  };
  const allOnSession = sessionOf('all-on');
  const notes = [];
  const probes = phaseOne(setup, forms);
  if (allOnSession?.main) probes.push(...phaseTwo(setup, { main: allOnSession.main, agents: allOnSession.agents }, read, calibration, forms));
  else notes.push(PHASE_TWO_NOTE);
  probes.sort((a, b) => cmp(a.id, b.id));

  const differs = (a, b) => [...new Set([...Object.keys(a), ...Object.keys(b)])].some((key) => a[key] !== b[key]);
  const missing = (probe) => {
    const session = sessionOf(probe.id);
    if (!session?.main) return true;
    const need = probe.id === 'baseline' ? probe.stubs.map((s) => s.name) : probe.where === 'probe' ? setup.agents.map((a) => a.name) : [];
    return need.some((name) => !session.agents[name]);
  };
  const stale = (probe) => (version !== undefined && sessionOf(probe.id).main.version !== version) || differs(entries.get(probe.id).fingerprint ?? {}, probe.depends);
  const flat = new Set();
  for (const p of probes) {
    if (!p.id.startsWith('cal:')) continue;
    const ref = sessionOf(`ref:${p.id.slice('cal:'.length)}`)?.main;
    const cal = sessionOf(p.id)?.main;
    if (ref && cal && cal.input <= ref.input) flat.add(p.id).add(`ref:${p.id.slice('cal:'.length)}`);
  }

  const need = probes.filter((p) => missing(p) || stale(p) || flat.has(p.id));
  const pending = need.map((p) => p.id).sort(cmp);
  const failed = [];
  for (const s of setup.sets) {
    const id = `set:${s.prefix}`;
    const session = sessionOf(id);
    if (pending.includes(id) || !session?.main) continue;
    const calls = [session.main, ...Object.values(session.agents)];
    const listed = s.members
      .filter((m) => calls.some((c) => (m.kind === 'agent' ? c.agentListing : c.skillListing).some((line) => line.startsWith(`- ${m.name}:`))))
      .map((m) => m.name)
      .sort(cmp);
    if (listed.length) failed.push({ id, member: listed[0] });
  }
  return { probes, pending, failed: failed.sort((a, b) => cmp(a.id, b.id)), notes };
}

export const OWNERS = {
  accord: 'accord',
  claudeCode: 'Claude Code',
  plugins: 'plugins',
  mcp: 'MCP servers',
  docs: 'CLAUDE.md and memory',
  sets: 'own skills, agents and commands',
  unattributed: 'unattributed',
};

// Each row's fixed context and its parts in raw tokens per call, and every item of the setup with what it costs per
// row, from the probe transcripts. `probes` are the probes planned (pendingProbes' list, none pending), `state` the
// parsed probes.json, `located` the sessions found for it, `texts` the result of textsOf. Every figure is a
// difference of two first calls (no characters-per-token ratio); a part is charged only to the rows it reaches, and
// `unattributed` is the total less every other part (it may be negative, since leave-one-out figures need not add up).
export function measure({ setup, probes, state, located, texts }) {
  const entries = new Map((Array.isArray(state) ? state : state.probes).map((e) => [e.id, e]));
  const planned = new Set(probes.map((p) => p.id));
  const session = (id) => {
    const found = located.get(entries.get(id)?.sessionId);
    if (!found?.main) throw new Error(`The probe ${id} has no first call.`);
    return found;
  };
  // The first-call input of a row in a probe; a ref: or text: probe has the main session only.
  const input = (id, row) => {
    const s = session(id);
    const call = row === 'main' ? s.main : s.agents[row];
    if (!call) throw new Error(`The probe ${id} has no first call for ${row}.`);
    return call.input;
  };
  const allOn = session('all-on');
  const calls = rowCalls({ main: allOn.main, agents: allOn.agents });
  const rowNames = ['main', ...[...setup.agents].sort(byName).map((a) => a.name).filter((n) => calls[n])];
  const model = (row) => calls[row].model;
  const stubOf = new Map();
  for (const stub of stubsOf(setup, { main: allOn.main, agents: allOn.agents })) for (const a of stub.agents) stubOf.set(a, stub.name);

  const size = (id, row) => input(`text:${id}:${model(row)}`, 'main') - input(`ref:${model(row)}`, 'main');
  // What the task prompt of a row adds to its first call: the dispatch prompt for the main session, the brief for an agent.
  const task = (row) => size(row === 'main' ? 'prompt' : 'brief', row);

  const { connectors, others } = connectorsOf(setup, allOn);
  const probed = connectors.filter((c) => planned.has(`connector:${c}`));
  const unprobed = [...connectors.filter((c) => !planned.has(`connector:${c}`)), ...others].sort(cmp);

  const items = [];
  // A probe item: the row's all-on (or reference) input less its input with only that item left out.
  const probeItem = (id, owner, label, base, probe) => {
    const perRow = {};
    for (const row of rowNames) {
      const d = input(base, row) - input(probe, row);
      if (d !== 0) perRow[row] = d;
    }
    const item = { id, owner, label, perRow };
    items.push(item);
    return item;
  };
  for (const p of setup.plugins) {
    probeItem(`plugin:${p.id}`, OWNERS.plugins, p.accordOwn ? `${p.id} (accord's own)` : p.id, 'all-on', `plugin:${p.id}`);
  }
  for (const m of setup.mcp) probeItem(`mcp:${m.name}`, OWNERS.mcp, m.name, 'mcp-ref', `mcp:${m.name}`);
  const connectorItems = probed.map((c) => probeItem(`connector:${c}`, OWNERS.mcp, `${c} (claude.ai connector)`, 'all-on', `connector:${c}`));
  const rest = { id: 'other-servers', owner: OWNERS.mcp, label: `other connected servers: ${unprobed.length ? unprobed.join(', ') : 'none'}`, perRow: {} };
  for (const row of rowNames) {
    const d = input('all-on', row) - input('mcp-ref', row) - connectorItems.reduce((n, c) => n + (c.perRow[row] ?? 0), 0);
    if (d !== 0) rest.perRow[row] = d;
  }
  items.push(rest);
  for (const s of setup.sets) probeItem(`set:${s.prefix}`, OWNERS.sets, `set ${s.prefix} (${s.members.length} members)`, 'all-on', `set:${s.prefix}`);

  // A text item: its size in each row it reaches. The agent definitions are one item, each in its own row.
  const textItem = (id, owner, label, from) => {
    const perRow = {};
    for (const t of from) for (const row of t.rows) if (rowNames.includes(row)) perRow[row] = size(t.id, row);
    items.push({ id, owner, label, perRow });
  };
  textItem('agent-definition', OWNERS.accord, 'agent definition', texts.filter((t) => t.id.startsWith('agent:')));
  for (const [id, label] of [['rules', 'rules block'], ['skill-listing', 'skill listing entries'], ['agent-listing', 'agent listing entries']]) {
    textItem(id, OWNERS.accord, label, texts.filter((t) => t.id === id));
  }
  for (const t of texts.filter((x) => x.id.startsWith('pointer:'))) textItem(t.id, OWNERS.accord, `pointer block ${t.label}`, [t]);
  const docIds = new Set(setup.docs.map((d) => `doc:${d.label}`));
  for (const d of setup.docs) textItem(`doc:${d.label}`, OWNERS.docs, d.label, texts.filter((t) => t.id === `doc:${d.label}`));
  for (const t of texts.filter((x) => x.id.startsWith('doc:') && !docIds.has(x.id))) textItem(t.id, OWNERS.docs, t.label, [t]);

  const rows = rowNames.map((row) => {
    const sum = (owner) => items.filter((i) => i.owner === owner).reduce((n, i) => n + (i.perRow[row] ?? 0), 0);
    const total = input('all-on', row) - task(row);
    const claudeCode = row === 'main' ? input('baseline', 'main') - size('baseline-prompt', row) : input('baseline', stubOf.get(row)) - task(row);
    const parts = { accord: sum(OWNERS.accord), claudeCode, plugins: sum(OWNERS.plugins), mcp: sum(OWNERS.mcp), docs: sum(OWNERS.docs), sets: sum(OWNERS.sets) };
    const named = Object.values(parts).reduce((n, v) => n + v, 0);
    return { row, model: model(row), total, parts, unattributed: total - named };
  });
  return { rows, items };
}

export const MAIN_LABEL = 'main session (claude -p)';
const day = (ms) => new Date(ms).toISOString().slice(0, 10);

// The cost, in fresh-input tokens, of the fixed context `size` in one call: it sits at the front of the call's input, so
// it is charged first against the cache reads (weight 0.1), then the cache writes (1.25), then the fresh input (1).
// `clamped` is true when the call's whole input is smaller than `size` (a size measured today can exceed an old call's
// input); the excess is not charged.
export function weighFixed(size, call) {
  const fixed = Math.max(0, size);
  const reads = Math.min(fixed, call.cacheRead);
  const writes = Math.min(fixed - reads, call.cacheWrite);
  const fresh = Math.min(fixed - reads - writes, call.input);
  return { weighted: 0.1 * reads + 1.25 * writes + fresh, clamped: fixed > reads + writes + fresh };
}

// A row's mean cost-weighted fixed context per call, its weighted-to-raw ratio, and how many of its calls were clamped.
function rowWeights(own, total) {
  const each = own.map((c) => weighFixed(total, c));
  const mean = each.reduce((n, x) => n + x.weighted, 0) / each.length;
  return { mean, ratio: total > 0 ? mean / total : 0, clamped: each.filter((x) => x.clamped).length };
}

// The lane M tickets that reached done (`tickets`: { id, claimAt } from the repository) whose claim lies inside the
// calls' date range, each with its calls, and the share of its whole cost (fresh input 1, cache read 0.1, cache write
// 1.25, output 5) that the main session's fixed context and the accord agents' fixed context make. A ticket's calls are
// those on its branch `t/<id>` and those in a folder that records no other branch than that one. A ticket with no call
// has no cost to share and is left out. A call of a row without a figure counts in the whole cost only.
export function ticketShares({ calls, rows, tickets }) {
  if (!calls.length) return [];
  const first = Math.min(...calls.map((c) => c.ts));
  const last = Math.max(...calls.map((c) => c.ts));
  const totalOf = new Map(rows.map((r) => [r.row, r.total]));
  const folder = (c) => c.cwd.replace(/\\/g, '/').toLowerCase();
  const branchesIn = new Map();
  for (const c of calls) {
    if (!c.cwd || !c.branch) continue;
    if (!branchesIn.has(folder(c))) branchesIn.set(folder(c), new Set());
    branchesIn.get(folder(c)).add(c.branch);
  }
  const shares = [];
  for (const t of [...tickets].sort((a, b) => cmp(a.id, b.id))) {
    if (t.claimAt < first || t.claimAt > last) continue;
    const branch = `t/${t.id}`;
    const only = (c) => c.cwd && !c.branch && branchesIn.get(folder(c))?.size === 1 && branchesIn.get(folder(c)).has(branch);
    const own = calls.filter((c) => c.branch === branch || only(c));
    if (!own.length) continue;
    const whole = own.reduce((n, c) => n + c.input + 0.1 * c.cacheRead + 1.25 * c.cacheWrite + 5 * c.output, 0);
    const fixedOf = (pick) => own.filter(pick).reduce((n, c) => n + (totalOf.has(c.row) ? weighFixed(totalOf.get(c.row), c).weighted : 0), 0);
    shares.push({
      id: t.id, claimAt: t.claimAt, calls: own.length,
      main: whole > 0 ? fixedOf((c) => c.row === 'main') / whole : 0,
      agents: whole > 0 ? fixedOf((c) => c.accord) / whole : 0,
    });
  }
  return shares;
}

// The report text, from the real calls (`readCalls`' list, its newest Claude Code `version` and the number of transcript
// `folders`), the Claude Code and the date of the all-on probe, and `measure`'s rows. Reads no clock: every date comes
// from the transcripts. One row for the main session and one for each accord agent that ran; an agent that ran but has
// no definition now keeps its calls and gets `-` in every figure.
export function render({ calls, version, folders, probeVersion: probed, allOnTs, rows, items = [], tickets = [] }) {
  const first = calls.length ? day(Math.min(...calls.map((c) => c.ts))) : '-';
  const last = calls.length ? day(Math.max(...calls.map((c) => c.ts))) : '-';
  const ran = [...new Set(calls.filter((c) => c.accord).map((c) => c.row))].sort(cmp);
  const table = ['main', ...ran].map((name) => ({
    label: name === 'main' ? MAIN_LABEL : name,
    own: calls.filter((c) => c.row === name),
    measured: rows.find((r) => r.row === name),
  }));
  const out = [
    '# Fixed context per call',
    '',
    `Transcripts: ${calls.length} calls from ${first} to ${last}, read from ${folders} transcript folder(s).`,
    `Probes: the all-on probe of ${day(allOnTs)} under Claude Code ${probed}.`,
  ];
  if (version !== undefined && version !== probed) out.push(`The newest transcript call ran Claude Code ${version}; the figures are measured under Claude Code ${probed}.`);
  out.push('The main session row is measured under claude -p, with its probe prompt sized and taken out.');
  for (const { label, own, measured } of table) {
    const other = own.filter((c) => measured && c.model !== measured.model);
    if (other.length) {
      out.push(`${label}: ${other.length} of its ${own.length} calls ran on ${[...new Set(other.map((c) => c.model))].sort(cmp).join(', ')}; they are counted at the size measured on ${measured.model}.`);
    }
  }
  out.push(
    'A claude.ai connector can change its instructions on the server, which no fingerprint sees; its figure holds for the probe date.',
    "A plugin's own MCP servers count under plugins and again in the other connected servers line; unattributed absorbs the overlap.",
    'Local-scope MCP servers and .claude/settings.local.json are not measured: the probe worktree loads neither.',
    'Cursor, Codex and Copilot calls were not measured.',
    '',
    '## Fixed context per call, raw tokens',
    '',
  );
  const head = ['row', 'model', 'calls', 'fixed', ...Object.values(OWNERS)];
  const line = (cells) => `| ${cells.join(' | ')} |`;
  out.push(line(head), line(head.map(() => '---')));
  for (const { label, own, measured } of table) {
    const figures = measured
      ? [measured.total, measured.parts.accord, measured.parts.claudeCode, measured.parts.plugins, measured.parts.mcp, measured.parts.docs, measured.parts.sets, measured.unattributed].map((n) => String(Math.round(n)))
      : Array(8).fill('-');
    out.push(line([label, measured ? measured.model : '-', String(own.length), ...figures]));
  }

  // Cost-weighted: each row's mean over its calls; each owner and each item its raw tokens times the row's ratio.
  const one = (n) => { const t = n.toFixed(1); return t === '-0.0' ? '0.0' : t; };
  const weights = new Map();
  for (const { label, own, measured } of table) if (measured && own.length) weights.set(label, rowWeights(own, measured.total));
  const named = ['accord', 'claudeCode', 'plugins', 'mcp', 'docs', 'sets'];
  const weightedHead = [...head, 'largest owner'];
  out.push('', '## Fixed context per call, cost-weighted tokens', '', line(weightedHead), line(weightedHead.map(() => '---')));
  let clamped = 0;
  for (const { label, own, measured } of table) {
    const w = weights.get(label);
    if (!measured || !w) {
      out.push(line([label, measured ? measured.model : '-', String(own.length), ...Array(9).fill('-')]));
      continue;
    }
    clamped += w.clamped;
    const raw = [measured.total, measured.parts.accord, measured.parts.claudeCode, measured.parts.plugins, measured.parts.mcp, measured.parts.docs, measured.parts.sets, measured.unattributed];
    let big = 0;
    named.forEach((k, i) => { if (measured.parts[k] > measured.parts[named[big]]) big = i; });
    out.push(line([label, measured.model, String(own.length), one(w.mean), ...raw.slice(1).map((n) => one(n * w.ratio)), Object.values(OWNERS)[big]]));
  }
  out.push('', `Weights: fresh input 1, cache read 0.1, cache write 1.25. ${clamped} calls had less input than the fixed context now measured; the excess was not charged.`);

  const ownerOrder = Object.values(OWNERS);
  const itemHead = ['item', 'owner', ...table.map((t) => t.label)];
  out.push('', '## Setup items, tokens per call (raw / cost-weighted)', '', line(itemHead), line(itemHead.map(() => '---')));
  const sorted = [...items].sort((a, b) => ownerOrder.indexOf(a.owner) - ownerOrder.indexOf(b.owner) || cmp(a.label, b.label));
  for (const item of sorted) {
    const cells = table.map(({ label, measured }) => {
      const w = weights.get(label);
      const n = measured ? item.perRow[measured.row] : undefined;
      return n === undefined || !w ? '-' : `${Math.round(n)} / ${one(n * w.ratio)}`;
    });
    out.push(line([item.label, item.owner, ...cells]));
  }
  out.push('', 'What the owner could cut: each line above is the cost per call that removing the item saves in that row.');

  out.push('', "## Lane M tickets, share of the ticket's cost", '');
  if (!tickets.length) out.push("No lane M ticket reached done with its claim inside the transcripts' date range.");
  else {
    const ticketHead = ['ticket', 'claim', 'calls', 'main fixed context', 'accord subagents fixed context'];
    const pct = (n) => `${(n * 100).toFixed(1)}%`;
    out.push(line(ticketHead), line(ticketHead.map(() => '---')));
    for (const t of tickets) out.push(line([t.id, day(t.claimAt), String(t.calls), pct(t.main), pct(t.agents)]));
    out.push(
      '',
      "Weights: fresh input 1, cache read 0.1, cache write 1.25, output 5. Output tokens are estimated at 4 characters a token, since transcripts keep the usage from the stream's start.",
      "The subagent share counts accord agents only; other subagents (such as Explore or general-purpose) count in the ticket's whole cost, and their fixed context is not measured.",
    );
  }
  return out.join('\n') + '\n';
}
