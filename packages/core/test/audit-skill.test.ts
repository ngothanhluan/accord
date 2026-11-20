// Phase 8.1 G3a (D-08): the /accord-audit skill is one source and is rendered for all four tools.
import { readdirSync, readFileSync } from 'node:fs';
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
    '`accord conventions write <file>`',
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

// Phase 8.1 G3b (D-10, 8.1-ac-11): the last step of the upgrade skill and of the onboard flow asks whether to run the audit; nothing runs it unasked.
const flat = (text: string): string => text.replace(/\s+/g, ' ');
/** The last numbered step of a loaded reference, flattened: from its number to the next `## ` heading or the end. */
function lastStep(path: string): string {
  const lines = (skills[path as SkillKey] ?? '').split('\n');
  let from = -1;
  lines.forEach((l, i) => {
    if (/^\d+\. /.test(l)) from = i;
  });
  if (from < 0) return '';
  const next = lines.findIndex((l, i) => i > from && /^## /.test(l));
  return flat(lines.slice(from, next < 0 ? lines.length : next).join(' '));
}

it('risk:regression the init and upgrade flows end by asking whether to audit (8.1-ac-11)', () => {
  const common = ['`accord audit`', 'one question', 'On no, run nothing', '`/accord-audit` runs it any time', 'On yes, run', 'each `gap:` line with its `- fix:`'];
  const onboard = lastStep('accord/onboard.md');
  expect(onboard).toMatch(/^6\. /);
  expect(common.filter((p) => !onboard.includes(p))).toEqual([]);
  expect(onboard).toContain('conventions draft');
  const upgrade = lastStep('accord/upgrade.md');
  expect(upgrade).toMatch(/^5\. /);
  expect(common.filter((p) => !upgrade.includes(p))).toEqual([]);
  expect(upgrade).toContain('`upgrade` replaced by `audit`');
  // the init flow is reached after the proposals line, whatever it says (D-10 reading)
  expect(flat(skills['accord/SKILL.md' as SkillKey] ?? '')).toContain('its `proposals:` line');
});

it('risk:regression no gate source names the audit (D-10)', () => {
  const dir = new URL('../src/gate/', import.meta.url);
  const named = readdirSync(dir).filter((f) => f.endsWith('.ts') && /audit/i.test(readFileSync(new URL(f, dir), 'utf8')));
  expect(named).toEqual([]);
});
