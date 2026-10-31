// The pure half of the fixed-context measurement (ST-LN-79): the probe constants, the command forms the Task 1
// spike proved, and the reader of a probe transcript's first call.
// Imports nothing, reads no file, spawns nothing and reads no clock (the house pattern of round.mjs).

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
