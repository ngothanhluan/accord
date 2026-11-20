// Phase 8.1 G3a (D-08): the /accord-audit skill is one source and is rendered for all four tools.
import { expect, it } from 'vitest';
import { installedName, skillTargets, STAGES } from '../src/index.js';
import type { AccordConfig } from '../src/index.js';

const config = (runtime: AccordConfig['runtimes'][number]): AccordConfig => ({
  accord: '0.1.0',
  profile: 'build',
  tracker: { adapter: 'none' },
  design: { tokens: '' },
  roles: ['ba', 'dev'],
  runtimes: [runtime],
});

it('risk:regression the accord-audit skill renders for all four tools (8.1-ac-8)', () => {
  expect(STAGES).toContain('audit');
  expect(installedName('audit')).toBe('accord-audit');
  const dirs: Record<string, string> = { claude: '.claude/skills', cursor: '.agents/skills', codex: '.agents/skills', copilot: '.agents/skills' };
  const bad: string[] = [];
  for (const runtime of ['claude', 'cursor', 'codex', 'copilot'] as const) {
    const file = skillTargets(config(runtime)).find((f) => f.path === dirs[runtime] + '/accord-audit/SKILL.md');
    if (file === undefined) bad.push(runtime + ': accord-audit/SKILL.md is not rendered');
    else if (!file.text.includes('accord audit')) bad.push(runtime + ': the body does not name accord audit');
  }
  expect(bad).toEqual([]);
});
