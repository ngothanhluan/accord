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
  // Which instruction files exist; a memory topic file is read on demand, so it never makes a probe stale.
  out.docs = sha256(setup.docs.filter((d) => !d.topic).map((d) => d.label).sort(cmp).join('\n'));
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

// Every text the report sizes by appending it to a baseline, with the rows it reaches: { id, owner, label, text, rows }.
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
    if (allOn.agents[agent.name]) out.push({ id: `agent:${agent.name}`, owner: 'accord', label: agent.name, text: agent.body, rows: [agent.name] });
  }

  const rules = agents.flatMap((a) => allOn.agents[a].hookContexts).find((c) => c.startsWith('# accord rules'));
  if (rules !== undefined) {
    out.push({ id: 'rules', owner: 'accord', label: 'rules', text: rules, rows: reach((c) => c.hookContexts.includes(rules) || (c === allOn.main && c.sessionStartHook)) });
  }

  const listing = (id, field, names) => {
    const mine = (line) => names.some((n) => line.startsWith(`- ${n}:`));
    const from = [allOn.main, ...agents.map((a) => allOn.agents[a])].find((c) => c[field].some(mine));
    if (from) out.push({ id, owner: 'accord', label: id, text: from[field].filter(mine).join('\n'), rows: reach((c) => c[field].some(mine)) });
  };
  listing('skill-listing', 'skillListing', setup.accordSkills.map((s) => s.name));
  listing('agent-listing', 'agentListing', setup.agents.map((a) => a.name));

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
        out.push({ id: `pointer:${label}`, owner: 'accord', label, text: content.slice(from, end), rows });
        doc = content.slice(0, from) + content.slice(end);
      }
      if (doc.trim() !== '') out.push({ id: `doc:${label}`, owner: 'CLAUDE.md and memory', label, text: doc, rows });
    }
  }

  const stubs = stubsOf(setup, allOn);
  out.push({ id: 'prompt', owner: 'probe', label: 'prompt', text: dispatchPrompt(setup.agents.map((a) => a.name)), rows: ['main'] });
  out.push({ id: 'baseline-prompt', owner: 'probe', label: 'baseline-prompt', text: dispatchPrompt(stubs.map((s) => s.name)), rows: ['main'] });
  out.push({ id: 'brief', owner: 'probe', label: 'brief', text: PROBE_BRIEF, rows: agents });
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
// baseline with its stub agents, a reference per model, and each text appended to the baseline on each model of the
// rows it reaches. Each is { id, where, depends, model?, ... }; the files and commands are written by the caller.
export function phaseTwo(setup, allOn, read, forms = PROBE_FORMS) {
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
  for (const model of modelsOf(Object.keys(calls))) probes.push({ id: `ref:${model}`, where: 'empty', model, depends: {} });
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
// The all-on probe is also stale when a text read from disk changed, since it carries that text. A set probe that
// is not pending but still lists a member did not move it out of reach: it is failed.
export function pendingProbes({ setup, state, located, version, read, forms = PROBE_FORMS }) {
  const entries = new Map(state.map((e) => [e.id, e]));
  const sessionOf = (id) => {
    const e = entries.get(id);
    return e ? located.get(e.sessionId) : undefined;
  };
  const allOnSession = sessionOf('all-on');
  const notes = [];
  const probes = phaseOne(setup, forms);
  if (allOnSession?.main) probes.push(...phaseTwo(setup, { main: allOnSession.main, agents: allOnSession.agents }, read, forms));
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
  const textChanged = probes.some((p) => p.source === 'disk' && entries.has(p.id) && differs(entries.get(p.id).fingerprint ?? {}, p.depends));

  const need = probes.filter((p) => missing(p) || (stale(p) || (p.id === 'all-on' && textChanged)));
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

// The report text, from the real calls (`readCalls`' list, its newest Claude Code `version` and the number of transcript
// `folders`), the Claude Code and the date of the all-on probe, and `measure`'s rows. Reads no clock: every date comes
// from the transcripts. One row for the main session and one for each accord agent that ran; an agent that ran but has
// no definition now keeps its calls and gets `-` in every figure.
export function render({ calls, version, folders, probeVersion: probed, allOnTs, rows }) {
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
  return out.join('\n') + '\n';
}
