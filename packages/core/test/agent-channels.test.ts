// Phase 8.5 D-04, 8.5-ac-18: an agent told to read the product files on its own is outside the checked CLI delivery, so every agent source that names them needs a CLI channel that carries the
// conventions, on every tool; the prose reads stay (999.51 removes them), and this test fails on any new one.
import { describe, expect, it } from 'vitest';
import { AGENT_CHANNELS, agents, ROLE_BLOCKS, skillTargets } from '../src/index.js';
import type { AccordConfig } from '../src/index.js';

const config = (over: Partial<AccordConfig> = {}): AccordConfig =>
  ({ accord: '0.1.0', profile: 'build', tracker: { adapter: 'none' }, design: { tokens: '' }, roles: ['ba', 'dev'], runtimes: ['claude'], ...over }) as AccordConfig;

/** A source names the product files when it holds `accord/product/` or the relative `product/` the reviewer's own prose uses. */
const NAMES_PRODUCT = /\bproduct\//;

/**
 * The rendered names (`accord-<key>`) of the sources that name the product files and have no CLI channel whose role's blocks hold `conventions`. A key may carry its `.md`, as the generated `agents`
 * map does. The final reviewer renders from the reviewer's source, so a reviewer that reads product files makes the final reviewer count too.
 */
function uncovered(sources: Readonly<Record<string, string>>): string[] {
  const names = Object.entries(sources)
    .filter(([, text]) => NAMES_PRODUCT.test(text))
    .flatMap(([key]) => {
      const name = 'accord-' + key.replace(/\.md$/, '');
      return name === 'accord-reviewer' ? [name, 'accord-final-reviewer'] : [name];
    });
  return names.filter((name) => {
    const channel = (AGENT_CHANNELS as Record<string, { command: string; role: keyof typeof ROLE_BLOCKS } | undefined>)[name];
    return channel === undefined || !ROLE_BLOCKS[channel.role].includes('conventions');
  });
}

describe('every agent that reads product files has a CLI channel (08.5-09)', () => {
  it('risk:regression the coverage test fails on an agent that reads product files with no CLI channel (8.5-ac-18 D-04)', () => {
    expect(uncovered({ researcher: 'Read `accord/product/` before you start.' })).toEqual(['accord-researcher']);
    expect(uncovered({ verifier: 'follow accord/product/conventions.md' })).toEqual(['accord-verifier']);
    // a source naming no product path is never listed
    expect(uncovered({ researcher: 'Look up the library and report its facts.' })).toEqual([]);
  });

  it('risk:regression every agent that reads product files has a CLI channel after this phase (8.5-ac-18 D-04)', () => {
    expect(uncovered(agents)).toEqual([]);
    expect(Object.keys(AGENT_CHANNELS).sort()).toEqual(
      ['accord-critic', 'accord-executor', 'accord-final-reviewer', 'accord-foreign-reviewer', 'accord-judge', 'accord-planner', 'accord-reviewer', 'accord-scout'],
    );
    // each channel's command is something a rendered skill file of some tool tells a session to run
    const rendered = skillTargets({ ...config(), runtimes: ['claude', 'codex', 'cursor', 'copilot'] })
      .filter((f) => f.path.endsWith('.md'))
      .map((f) => f.text.replace(/\s+/g, ' '));
    for (const [name, channel] of Object.entries(AGENT_CHANNELS))
      expect(
        rendered.some((t) => t.includes(channel.command)),
        `${name}: no rendered skill file names \`${channel.command}\``,
      ).toBe(true);
  });

  it('risk:regression the prose reads stay until 999.51 removes them (8.5-ac-18 D-04)', () => {
    expect(agents['executor.md']).toContain('accord/product/');
    expect(agents['planner.md']).toContain('accord/product/');
    // the reviewer names the folder by its relative name
    expect(agents['reviewer.md']).toContain('`product/`');
  });
});
