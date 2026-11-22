// Agent definitions as data: one authored file under agents/ becomes `.claude/agents/<name>.md`, with the
// model and effort filled in from `models:` in config.yml, falling back per field to AGENT_DEFAULTS, whose values and
// reasons docs/design.md gives under Routing.
// `route` is an authoring key and never ships. Same marker-and-hash drift rule as skills (D-111).
import { Document, Scalar, isScalar } from 'yaml';
import { agents } from '../generated/agents.js';
import { normaliseText, stringNumerics } from '../load/frontmatter.js';
import { contentHash, markerHash, readSource, stamp, withoutMarker } from './render.js';
import type { AgentKey } from '../generated/agents.js';
import type { AccordConfig, Effort, RouteKey } from '../model/snapshot.js';
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

/** The agent as it lands on disk: name, description, tools and disallowedTools (when authored), model, effort, marker, body. */
export function renderAgent(key: AgentKey, route: { model: string; effort: Effort }, name?: string): string {
  const { yaml, body } = source(key);
  if (typeof yaml.route !== 'string' || !Object.hasOwn(AGENT_DEFAULTS, yaml.route)) {
    throw new Error(`agent ${key}: unknown route ${String(yaml.route)}`);
  }
  const fields: [string, unknown][] = [
    ['name', name ?? yaml.name],
    ['description', yaml.description],
    ['tools', yaml.tools],
    ['disallowedTools', yaml.disallowedTools],
    ['model', route.model],
    ['effort', route.effort],
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
    out.push({ path: agentDir + '/' + String(yaml.name) + '.md', text: renderAgent(key, route(yaml.route as RouteKey)) });
    // The final reviewer is a second render of the reviewer definition, routed separately.
    if (key === 'reviewer.md') {
      out.push({
        path: agentDir + '/accord-final-reviewer.md',
        text: renderAgent(key, route('reviewer.final'), 'accord-final-reviewer'),
      });
    }
  }
  return out.sort((a, b) => cmp(a.path, b.path));
}
