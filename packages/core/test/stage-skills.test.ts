// Spec §3 to §12: what each stage skill must name, asserted over the RENDERED SKILL.md a runtime loads. One
// row per stage; a stage whose definition is not authored yet has no row and renders nothing to check.
import { describe, expect, it } from 'vitest';
import { installedName, skillTargets } from '../src/index.js';
import type { AccordConfig } from '../src/index.js';

const config: AccordConfig = {
  accord: '0.1.0',
  profile: 'build',
  tracker: { adapter: 'none' },
  design: { tokens: '' },
  roles: ['ba', 'dev'],
  runtimes: ['claude'],
};

const REQUIRED: Record<string, readonly string[]> = {
  accord: ['accord status --json', 'accord next', 't/<id>', 'accord new ticket', '--lane M', 'Understood:', 'Done when:', 'accord anchor', 'user.email'],
  intent: ['accord anchor', 'accord-scout', 'accord-auditor', '0.2', '## Corrections', '## Open questions', 'D-01', 'accord-approach', 'top-level parts', 'smallest version'],
  approach: ['accord anchor', 'accord-architect', 'accord-critic', '## Approach', 'accord approve', 'accord gate ready', 'accord-plan', 'ladder order', 'text only', 'not yet ruled out', 'three concrete failure scenarios', 'undone', 'back to step 3'],
  plan: ['accord anchor', 'accord-planner', 'baseline:', 'covers:', 'verify:', 'accord gate plan', 'plan_hash:', 'accord-critic', 'three revision rounds', 'fewest Must', 'tests.full', 'accord-build'],
};

const files = skillTargets(config);

describe('stage skills name what the spec requires', () => {
  for (const [stage, phrases] of Object.entries(REQUIRED)) {
    it(`${stage} names every required phrase`, () => {
      const text = files.find((f) => f.path === '.claude/skills/' + installedName(stage) + '/SKILL.md')?.text ?? '';
      expect(text.length, stage + '/SKILL.md is missing from the render output').toBeGreaterThan(0);
      expect(phrases.filter((p) => !text.includes(p))).toEqual([]);
    });
  }
});
