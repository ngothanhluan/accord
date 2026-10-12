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
const scout = (c: AccordConfig): string => agentTargets(c).find((f) => f.path === '.claude/agents/accord-scout.md')?.text ?? '';

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
    for (const f of files) expect(f.text.split('\n').length, f.path).toBeLessThanOrEqual(60 + 12);
    for (const key of Object.keys(agents) as AgentKey[]) {
      expect(renderAgent(key, { model: 'haiku', effort: 'low' }).split('\n').length).toBeLessThanOrEqual(60 + 12);
    }
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
