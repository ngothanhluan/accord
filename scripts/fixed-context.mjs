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
