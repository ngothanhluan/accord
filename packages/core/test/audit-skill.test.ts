// Phase 8.1 G3a (D-08): the /accord-audit skill is one source and is rendered for all four tools.
import { expect, it } from 'vitest';
import { installedName, skills, skillTargets, STAGES } from '../src/index.js';
import type { AccordConfig, SkillKey } from '../src/index.js';

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

// Phase 8.1 G3a (D-09, D-13): the conventions draft the skill drives, read from the loaded reference the skill names.
it('risk:regression the draft flow asks line by line shows evidence and never edits code (D-13)', () => {
  const draft = (skills['audit/draft.md' as SkillKey] ?? '').replace(/\s+/g, ' ');
  expect(draft).not.toBe('');
  const missing = [
    '`accord audit`',
    '`accord conventions write`',
    '10-20',
    'file:line',
    '`enforced by:`',
    '`prose`',
    '`/accord-queue`',
    'one line at a time',
    'never edit code or linter configuration',
    'never merge',
  ].filter((p) => !draft.includes(p));
  expect(missing).toEqual([]);
  const skill = (skills['audit/SKILL.md' as SkillKey] ?? '').replace(/\s+/g, ' ');
  expect(skill).toContain('`./draft.md`');
  expect(skill).toContain('draft.md');
});
