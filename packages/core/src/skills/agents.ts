// Agent definitions as data: one authored file under agents/ becomes `.claude/agents/<name>.md`, with the
// model and effort filled in from `models:` in config.yml, falling back per field to AGENT_DEFAULTS, whose values and
// reasons docs/design.md gives under Routing.
// `route` is an authoring key and never ships. Same marker-and-hash drift rule as skills (D-111).
import { Document, Scalar, isScalar } from 'yaml';
import { agents } from '../generated/agents.js';
import { normaliseText, stringNumerics } from '../load/frontmatter.js';
import { contentHash, markerHash, readSource, stamp, withoutMarker } from './render.js';
import type { AgentKey } from '../generated/agents.js';
import type { AccordConfig, AgentAdditions, Effort, McpEntry, RouteKey } from '../model/snapshot.js';
import type { SkillFile } from './targets.js';

export const agentDir = '.claude/agents';

export const AGENT_DEFAULTS: Record<RouteKey, { model: string; effort: Effort }> = {
  scout: { model: 'haiku', effort: 'low' },
  critic: { model: 'opus', effort: 'high' },
  planner: { model: 'opus', effort: 'high' },
  executor: { model: 'sonnet', effort: 'high' },
  reviewer: { model: 'sonnet', effort: 'high' },
  'reviewer.final': { model: 'opus', effort: 'high' },
  verifier: { model: 'sonnet', effort: 'medium' },
  debugger: { model: 'opus', effort: 'high' },
  researcher: { model: 'sonnet', effort: 'high' },
};

// ST-LN-80: files accord rendered before and no longer renders. `skills sync` and `accord upgrade` remove one when its
// marker is intact; an edited copy stays.
// Phase 08.6 (D-05): the auditor's agent file retires the same way: an intact copy goes, an edited one stays.
// Phase 7 (07-01): the accord skill stopped loading these reference files; the stage skills still render their own.
// Phase 8.3 (08.3-05): the accord folder renders finish, lane, lane-r, lane-s and scout again, so they leave this list in that commit; `security` and `upgrade` stay.
// Phase 8.3 (08.3-24): `review-foreign` joins them. The foreign review became the command `accord-review-pr`; `accord/review-foreign.md` rendered from v0.8.0 to v0.10.0 and under no other name in this folder.
// Phase 8.3 (08.3-23): `onboard` joins them. The onboarding text became the command `accord-onboard`; `accord/onboard.md` rendered from v0.5.0 to v0.10.0 and under no other name.
// Phase 8.3 (08.3-25): `comments` joins them. The pull request feedback text became the command `accord-resolve-pr`; `accord/comments.md` rendered from v0.4.0 to v0.10.0 and under no other name.
const RETIRED_ACCORD_REFS = ['comments', 'onboard', 'review-foreign', 'security', 'upgrade'];

// Phase 8.3 D-01: command folders accord rendered and no longer renders, by installed folder name. Each list is every file the folder rendered in any
// release (SKILL.md plus the basename of each `loads:` entry, over the tags that held it), sorted by code point. A command that stops rendering is added
// here in the same commit, so `skills sync` and `accord upgrade` remove its intact files and `skills sync` the emptied folder; an edited file stays.
// `accord-queue`: v0.8.0 to v0.10.0 (queue/SKILL.md loaded ids.md, ask.md and similar.md in each).
// `accord-continue`, `accord-pickup`: v0.8.0 to v0.10.0 plus the branch (review-security.md, and security.md under its old name), the union of their `loads:` basenames.
// `accord-approach`: v0.2.0 to v0.10.0 (ask.md; critique.md from v0.4.0; approval.md and scout.md from v0.4.1; the branch renders the same five).
// `accord-intent`: v0.2.0 to v0.10.0 (ask, ids; lane.md from v0.3.0; research.md from v0.4.0; scout.md and discuss.md from v0.4.1; the branch renders the same seven).
// `accord-new`: v0.8.0 to v0.10.0 plus the branch (queue.md and review-security.md; security.md came from `review/security.md`; epic.md from `new/epic.md`).
// `accord-plan`: v0.2.0 to v0.10.0 (ask.md, baseline.md and critique.md from v0.2.0; legacy-round1.md from v0.4.1; resume.md from v0.6.0; the branch adds plan-baseline.md, plan-critique.md and plan-legacy-round1.md).
// `accord-build`: v0.2.0 to v0.10.0 (ask.md from v0.2.0; scout.md from v0.4.1; no-plan.md from v0.5.0; baseline.md from v0.5.1; waves.md from v0.6.0; the branch adds build-no-plan.md, build-waves.md and plan-baseline.md).
// `accord-review`: v0.2.0 to v0.10.0 (record.md and ask.md from v0.2.0; security.md from v0.7.0; the branch renders review-security.md for it).
// `accord-verify`: v0.2.0 to v0.10.0 (ci.md, ids.md, worktree.md, ask.md, failure.md from v0.2.0; finish.md from v0.3.0; resume.md from v0.6.0; writer.md from v0.7.0; deferred.md from v0.8.0; the branch renders verify-ci.md, verify-deferred.md and verify-writer.md in the folder).
export const RETIRED_SKILL_FOLDERS: Readonly<Record<string, readonly string[]>> = {
  'accord-approach': ['SKILL.md', 'approval.md', 'ask.md', 'critique.md', 'scout.md'],
  'accord-build': ['SKILL.md', 'ask.md', 'baseline.md', 'build-no-plan.md', 'build-waves.md', 'no-plan.md', 'plan-baseline.md', 'scout.md', 'waves.md'],
  'accord-continue': [
    'SKILL.md', 'ask.md', 'failure.md', 'finish.md', 'ids.md', 'lane-r.md', 'lane-s.md', 'lane.md', 'review-security.md', 'scout.md', 'security.md', 'similar.md', 'worktree.md',
  ],
  'accord-intent': ['SKILL.md', 'ask.md', 'discuss.md', 'ids.md', 'lane.md', 'research.md', 'scout.md'],
  'accord-new': [
    'SKILL.md', 'ask.md', 'epic.md', 'failure.md', 'finish.md', 'ids.md', 'lane-r.md', 'lane-s.md', 'lane.md', 'queue.md', 'review-foreign.md', 'review-security.md', 'route.md', 'scout.md',
    'security.md', 'similar.md', 'worktree.md',
  ],
  'accord-pickup': ['SKILL.md', 'ask.md', 'failure.md', 'ids.md', 'worktree.md'],
  'accord-plan': ['SKILL.md', 'ask.md', 'baseline.md', 'critique.md', 'legacy-round1.md', 'plan-baseline.md', 'plan-critique.md', 'plan-legacy-round1.md', 'resume.md'],
  'accord-queue': ['SKILL.md', 'ask.md', 'ids.md', 'similar.md'],
  'accord-review': ['SKILL.md', 'ask.md', 'record.md', 'review-security.md', 'security.md'],
  'accord-verify': ['SKILL.md', 'ask.md', 'ci.md', 'deferred.md', 'failure.md', 'finish.md', 'ids.md', 'resume.md', 'verify-ci.md', 'verify-deferred.md', 'verify-writer.md', 'worktree.md', 'writer.md'],
};

export const RETIRED_FILES: readonly string[] = [
  agentDir + '/accord-architect.md',
  agentDir + '/accord-auditor.md',
  ...['.claude/skills', '.agents/skills'].flatMap((dir) => RETIRED_ACCORD_REFS.map((name) => dir + '/accord/' + name + '.md')),
  ...['.claude/skills', '.agents/skills'].flatMap((dir) =>
    Object.entries(RETIRED_SKILL_FOLDERS).flatMap(([folder, held]) => held.map((file) => dir + '/' + folder + '/' + file)),
  ),
];

// Phase 11 Security Ruling (T-11-02): the judge and the foreign reviewer route to `reviewer`, but their guarantee is that no text in a pull request can make
// them run a command (docs/design.md, Agents). So no `agents:` addition ever reaches their files: `agentTargets` renders them with no extra, whatever `agents:` holds.
export const NO_ADDITIONS: readonly AgentKey[] = ['judge.md', 'foreign-reviewer.md'];

// Phase 11 D-02 (the lock Ruling): the tools a team may never add to a role, because the role's authored rule forbids them. One row per route key, the names the
// agent's own text rules out; a tool is compared on the name before its `(` (`Bash(git push *)` is `Bash`), without regard to case. An `mcp__<server>__*` entry
// is never refused (D-03). `agentTargets` renders around a refused entry and never throws; `accord skills sync` and `lint.agents-config` report it by name.
export const AGENT_LOCKS: Readonly<Record<RouteKey, readonly string[]>> = {
  scout: [],
  critic: [],
  planner: [],
  executor: [],
  // reviewer.md: "you never edit a file"; a reviewer reads, runs tests and runs git to read, and never dispatches another agent
  reviewer: ['Edit', 'Write', 'MultiEdit', 'NotebookEdit', 'Agent', 'Task'],
  'reviewer.final': ['Edit', 'Write', 'MultiEdit', 'NotebookEdit', 'Agent', 'Task'],
  verifier: [],
  debugger: [],
  researcher: [],
};

/** The rule text of each role that a refused entry quotes: what the agent's own definition says it never does. */
const LOCK_RULE: Readonly<Record<RouteKey, string>> = {
  scout: 'the scout only reads; it never edits a file, runs a command or dispatches another agent',
  critic: 'the critic only reads; it never edits a file, runs a command or dispatches another agent',
  planner: 'the planner writes plan.md and direction.md only; it runs no command, edits no notebook and dispatches no agent',
  executor: 'the executor never dispatches another agent',
  reviewer: 'the reviewer never edits a file and never dispatches another agent',
  'reviewer.final': 'the final reviewer never edits a file and never dispatches another agent',
  verifier: 'the verifier edits no notebook and dispatches no agent',
  debugger: 'the debugger edits no notebook and dispatches no agent',
  researcher: 'the researcher only reads and searches',
};

/** One entry of `agents.<role>` that accord refuses. `index` is the entry's place in its list, for the lint pointer; `reason` is one text with its fix. */
export interface AgentProblem {
  role: RouteKey;
  field: 'tools' | 'mcp';
  index: number;
  entry: string;
  reason: string;
}

/** The tool name an entry stands for: the text before `(`, trimmed. An entry holding a comma is judged piece by piece, as the renderer's comma-joined list is read piece by piece. */
const toolNames = (entry: string): string[] => entry.split(',').map((piece) => piece.replace(/\(.*$/s, '').trim());

/** The locked name an `agents.<role>.tools` entry holds, or undefined. */
function lockedTool(role: RouteKey, entry: string): string | undefined {
  const locked = AGENT_LOCKS[role].map((name) => name.toLowerCase());
  return toolNames(entry).find((name) => locked.includes(name.toLowerCase()));
}

/** Every entry of `agents:` that breaks a role's rule, in config order. Empty for a config with no `agents:` key. Pure. */
export function agentsProblems(config: AccordConfig | undefined): AgentProblem[] {
  const out: AgentProblem[] = [];
  for (const [role, add] of Object.entries(config?.agents ?? {}) as [RouteKey, AgentAdditions | undefined][]) {
    (add?.tools ?? []).forEach((entry, index) => {
      if (lockedTool(role, entry) === undefined) return;
      out.push({ role, field: 'tools', index, entry, reason: `${LOCK_RULE[role]} - fix: remove ${entry} from agents.${role}.tools in accord/config.yml` });
    });
  }
  return out;
}

/** The text `accord skills sync` (and `accord init`) prints when `agentsProblems` is not empty: one line per problem, then that nothing was written. */
export function agentsRefusal(problems: readonly AgentProblem[]): string {
  return [...problems.map((p) => `agents.${p.role}.${p.field}: ${p.entry}: ${p.reason}`), 'nothing was written'].join('\n');
}

/** True for a copy accord rendered that nobody edited: its marker hash equals the hash of the text around it. */
export function isIntactRender(text: string): boolean {
  const onDisk = normaliseText(text);
  const stored = markerHash(onDisk);
  return stored !== undefined && stored === contentHash(withoutMarker(onDisk));
}

const options = { schema: 'core', customTags: stringNumerics } as const;
const cmp = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

function source(key: AgentKey): { yaml: Record<string, unknown>; body: string } {
  const text = agents[key];
  if (text === undefined) throw new Error('unknown agent definition: ' + key);
  const read = readSource(text);
  if ('problem' in read) throw new Error('agent definition ' + key + ': ' + read.problem);
  return read;
}

/** What a team's `agents:` entry adds to one rendered agent (Phase 11 D-01): the merged `tools` string (only when the authored source has one), `skills`, `mcpServers`. */
export interface AgentExtra {
  tools?: string;
  skills?: readonly string[];
  mcpServers?: readonly McpEntry[];
}

const serverName = (entry: McpEntry): string => (typeof entry === 'string' ? entry : (Object.keys(entry)[0] as string));

/** An authored `tools:` value as a list: a comma-separated string (the form every agent source uses) or a YAML list. */
function toolList(authored: unknown): string[] {
  if (typeof authored === 'string') return authored.split(',').map((t) => t.trim()).filter((t) => t !== '');
  if (Array.isArray(authored)) return authored.filter((t): t is string => typeof t === 'string');
  return [];
}

/**
 * The extra frontmatter for one render of one agent (D-01). `routeKey` is the key of `agents:` that addresses it; `authored` is the agent source's own frontmatter.
 * `tools` is written only when the source authored one: an agent with none inherits every tool, and a `tools:` line would turn it into a narrow allowlist
 * (the researcher, T-11-05). Where there is one, the added tools follow the authored ones, and each server not already covered gets `mcp__<server>__*`, so it is reachable.
 * Empty lists and an absent entry give an empty object, so a config with no `agents:` renders every file as before.
 */
export function agentFields(config: AccordConfig, routeKey: RouteKey, authored: Record<string, unknown>): AgentExtra {
  const add = config.agents?.[routeKey];
  if (add === undefined) return {};
  const out: AgentExtra = {};
  if (add.skills !== undefined && add.skills.length > 0) out.skills = [...add.skills];
  const servers = add.mcp ?? [];
  if (servers.length > 0) out.mcpServers = [...servers];
  if (authored.tools !== undefined && authored.tools !== null) {
    const tools = toolList(authored.tools);
    // D-02: a tool the role's rule forbids is left out, never thrown on, so gate done, init and the exempt-copies reader keep working on a bad entry; sync and lint report it.
    for (const extra of add.tools ?? []) if (lockedTool(routeKey, extra) === undefined && !tools.includes(extra)) tools.push(extra);
    for (const entry of servers) {
      const name = serverName(entry);
      if (!tools.includes('mcp__' + name + '__*') && !tools.includes('mcp__' + name)) tools.push('mcp__' + name + '__*');
    }
    if (add.tools !== undefined || servers.length > 0) out.tools = tools.join(', ');
  }
  return out;
}

/** The agent as it lands on disk: name, description, tools and disallowedTools (when authored), model, effort, skills and mcpServers (when added), marker, body. */
export function renderAgent(key: AgentKey, route: { model: string; effort: Effort }, name?: string, extra: AgentExtra = {}): string {
  const { yaml, body } = source(key);
  if (typeof yaml.route !== 'string' || !Object.hasOwn(AGENT_DEFAULTS, yaml.route)) {
    throw new Error(`agent ${key}: unknown route ${String(yaml.route)}`);
  }
  const fields: [string, unknown][] = [
    ['name', name ?? yaml.name],
    ['description', yaml.description],
    ['tools', extra.tools ?? yaml.tools],
    ['disallowedTools', yaml.disallowedTools],
    ['model', route.model],
    ['effort', route.effort],
    ['skills', extra.skills],
    ['mcpServers', extra.mcpServers],
  ];
  const doc = new Document({}, options);
  for (const [field, value] of fields) {
    if (value === undefined) continue;
    const node = doc.createNode(value);
    if (isScalar(node) && typeof value === 'string') node.type = Scalar.QUOTE_DOUBLE;
    doc.set(field, node);
  }
  return stamp('---\n' + doc.toString({ lineWidth: 0 }).replace(/\n$/, '') + '\n---\n', body);
}

/** Every agent file this configuration installs, sorted by path; empty unless the claude runtime is declared. */
export function agentTargets(config: AccordConfig): SkillFile[] {
  if (!config.runtimes.includes('claude')) return [];
  const route = (key: RouteKey): { model: string; effort: Effort } => ({ ...AGENT_DEFAULTS[key], ...config.models?.[key] });
  const out: SkillFile[] = [];
  for (const key of Object.keys(agents) as AgentKey[]) {
    const { yaml } = source(key);
    const routeKey = yaml.route as RouteKey;
    // Phase 11 D-01: the additions of `agents.<route key>`; the judge and the foreign reviewer take none (NO_ADDITIONS).
    const extra = (rk: RouteKey): AgentExtra => (NO_ADDITIONS.includes(key) ? {} : agentFields(config, rk, yaml));
    out.push({ path: agentDir + '/' + String(yaml.name) + '.md', text: renderAgent(key, route(routeKey), undefined, extra(routeKey)) });
    // The final reviewer is a second render of the reviewer definition, routed separately and given only `agents.reviewer.final`.
    if (key === 'reviewer.md') {
      out.push({
        path: agentDir + '/accord-final-reviewer.md',
        text: renderAgent(key, route('reviewer.final'), 'accord-final-reviewer', extra('reviewer.final')),
      });
    }
  }
  return out.sort((a, b) => cmp(a.path, b.path));
}
