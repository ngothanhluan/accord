// Agent definitions as data: rendering, routing, and the drift gate against agents/.
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';
import { agents, agentTargets, contentHash, markerHash, renderAgent, withoutMarker } from '../src/index.js';
import type { AccordConfig, AgentKey } from '../src/index.js';
import { deniedNames } from '../../../test/helpers/denied.js';

const agentsDir = fileURLToPath(new URL('../agents/', import.meta.url));
const config = (over: Partial<AccordConfig> = {}): AccordConfig =>
  ({ accord: '0.1.0', profile: 'build', tracker: { adapter: 'none' }, design: { tokens: '' }, roles: ['ba', 'dev'], runtimes: ['claude'], ...over }) as AccordConfig;
const frontmatter = (text: string): Record<string, unknown> => parse(text.split('---\n')[1]) as Record<string, unknown>;
const bodyOf = (text: string): string => withoutMarker(text).split('\n---\n').slice(1).join('\n---\n');
const scout = (c: AccordConfig): string => agentTargets(c).find((f) => f.path === '.claude/agents/accord-scout.md')?.text ?? '';

// What each agent must name, asserted over the RENDERED agent file, as REQUIRED is over a rendered skill.
const AGENT_REQUIRED: Record<string, readonly string[]> = {
  architect: ['first rung', 'climb further', 'what it does'],
  executor: ['plan.md', 'never weaken', 'BLOCKED'],
  critic: ['text only', 'three concrete failure scenarios', 'Check that no Veto is violated', 'without asking', 'Should'],
  planner: ['(new)', 'must not change', 'wiring', 'polish'],
};

describe('agents name what the spec requires', () => {
  for (const [role, phrases] of Object.entries(AGENT_REQUIRED)) {
    it(`${role} names every required phrase`, () => {
      const text = agentTargets(config()).find((f) => f.path === `.claude/agents/accord-${role}.md`)?.text ?? '';
      expect(text.length, `accord-${role}.md is missing from the render output`).toBeGreaterThan(0);
      expect(phrases.filter((p) => !text.includes(p))).toEqual([]);
    });
  }
});

describe('rendered agents', () => {
  it('renders scout with routed defaults and no authoring key', () => {
    const fm = frontmatter(scout(config()));
    expect(fm).toEqual({
      name: 'accord-scout',
      description: expect.stringContaining('Reads the code'),
      tools: 'Read, Grep, Glob',
      model: 'haiku',
      effort: 'low',
    });
    expect(scout(config())).not.toContain('route');
  });

  it('renders the auditor read-only on its spec route', () => {
    const text = agentTargets(config()).find((f) => f.path === '.claude/agents/accord-auditor.md')?.text ?? '';
    expect(frontmatter(text)).toMatchObject({ name: 'accord-auditor', tools: 'Read', model: 'opus', effort: 'medium' });
  });

  it('renders the architect and the critic read-only on their spec routes', () => {
    for (const role of ['architect', 'critic']) {
      const text = agentTargets(config()).find((f) => f.path === `.claude/agents/accord-${role}.md`)?.text ?? '';
      expect(frontmatter(text)).toMatchObject({ name: `accord-${role}`, tools: 'Read, Grep, Glob', model: 'opus', effort: 'high' });
    }
  });

  it('a models entry with only model keeps the default effort', () => {
    const fm = frontmatter(scout(config({ models: { scout: { model: 'sonnet' } } })));
    expect(fm).toMatchObject({ model: 'sonnet', effort: 'low' });
  });

  it('the marker hash recomputes', () => {
    const text = scout(config());
    expect(markerHash(text)).toBe(contentHash(withoutMarker(text)));
  });

  it('installs for the claude runtime only', () => {
    expect(agentTargets(config({ runtimes: ['codex'] }))).toEqual([]);
  });

  it('names no other tool and stays short', () => {
    const files = agentTargets(config());
    expect(deniedNames(files)).toEqual([]);
    for (const f of files) expect(bodyOf(f.text).split('\n').length, f.path).toBeLessThanOrEqual(60);
  });

  it('every agent renders a model and an effort line', () => {
    for (const key of Object.keys(agents) as AgentKey[]) {
      const lines = renderAgent(key, { model: 'haiku', effort: 'low' }).split('\n');
      expect(lines.some((l) => l.startsWith('model:')), key).toBe(true);
      expect(lines.some((l) => l.startsWith('effort:')), key).toBe(true);
    }
  });

  it('frontmatter keys come in a fixed order', () => {
    const lines = scout(config()).split('\n');
    const keys = lines.slice(1, lines.indexOf('---', 1)).map((l) => l.split(':')[0]);
    expect(keys).toEqual(['name', 'description', 'tools', 'model', 'effort']);
  });

  it('generated module matches agents/ (drift)', () => {
    const onDisk = readdirSync(agentsDir).filter((n) => n.endsWith('.md')).sort();
    expect(Object.keys(agents), 'agent file set drifted: run npm run gen').toEqual(onDisk);
    for (const name of onDisk) {
      const text = readFileSync(new URL(name, new URL('../agents/', import.meta.url)), 'utf8').replace(/^\uFEFF/, '').replace(/\r\n/g, '\n');
      expect(agents[name as AgentKey], `${name} drifted: run npm run gen`).toBe(text);
    }
  });
});
