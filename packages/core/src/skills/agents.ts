// Agent definitions as data: one authored file under agents/ becomes `.claude/agents/<name>.md`, with the
// model and effort filled in from `models:` in config.yml, falling back per field to the spec §12 default.
// `route` is an authoring key and never ships. Same marker-and-hash drift rule as skills (D-111).
import { Document, Scalar, isScalar, parse } from 'yaml';
import { agents } from '../generated/agents.js';
import { splitFrontmatter, stringNumerics } from '../load/frontmatter.js';
import { stamp } from './render.js';
import type { AgentKey } from '../generated/agents.js';
import type { AccordConfig, Effort, RouteKey } from '../model/snapshot.js';
import type { SkillFile } from './targets.js';

export const agentDir = '.claude/agents';

export const AGENT_DEFAULTS: Record<RouteKey, { model: string; effort: Effort }> = {
  scout: { model: 'haiku', effort: 'low' },
  auditor: { model: 'opus', effort: 'medium' },
  architect: { model: 'opus', effort: 'high' },
  critic: { model: 'opus', effort: 'high' },
  planner: { model: 'opus', effort: 'medium' },
  executor: { model: 'sonnet', effort: 'medium' },
  reviewer: { model: 'sonnet', effort: 'high' },
  'reviewer.final': { model: 'opus', effort: 'high' },
  verifier: { model: 'sonnet', effort: 'medium' },
  debugger: { model: 'opus', effort: 'high' },
};

const options = { schema: 'core', customTags: stringNumerics } as const;
const cmp = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

function source(key: AgentKey): { yaml: Record<string, unknown>; body: string } {
  const text = agents[key];
  if (text === undefined) throw new Error('unknown agent definition: ' + key);
  const split = splitFrontmatter(text);
  return { yaml: (split.yaml === null ? {} : parse(split.yaml, options)) as Record<string, unknown>, body: split.body };
}

/** The agent as it lands on disk: name, description, tools (when authored), model, effort, marker, body. */
export function renderAgent(key: AgentKey, route: { model: string; effort: Effort }, name?: string): string {
  const { yaml, body } = source(key);
  const fields: [string, unknown][] = [
    ['name', name ?? yaml.name],
    ['description', yaml.description],
    ['tools', yaml.tools],
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
    if ((key as string) === 'reviewer.md') {
      out.push({
        path: agentDir + '/accord-final-reviewer.md',
        text: renderAgent(key, route('reviewer.final'), 'accord-final-reviewer'),
      });
    }
  }
  return out.sort((a, b) => cmp(a.path, b.path));
}
