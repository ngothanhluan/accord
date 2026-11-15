// ST-LN-50 t2-ac-9, D-11: `accord init` only proposes; the onboarding skill (`accord/onboard.md`, reached by `/accord onboard`) asks the user about
// each proposal and writes only the confirmed ones, through `accord config set`. The text is read with whitespace collapsed, so a phrase wrapped
// across two lines is still found. The real-command check for every `accord ...` the skill names is skill-commands.test.ts in the cli package.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { renderSkill, skillTargets } from '../src/index.js';
import type { AccordConfig, SkillKey } from '../src/index.js';

const skillsDir = fileURLToPath(new URL('../skills/', import.meta.url));
const flat = (text: string): string => text.replace(/\s+/g, ' ');
const source = (path: string): string => readFileSync(skillsDir + path, 'utf8');

const config = (runtimes: AccordConfig['runtimes']): AccordConfig => ({
  accord: '0.5.0',
  profile: 'build',
  tracker: { adapter: 'none' },
  design: { tokens: '' },
  roles: ['ba', 'dev'],
  runtimes,
});

describe('the onboarding skill confirms each proposal and writes only what the user confirms', () => {
  it('risk:regression the onboarding skill asks per proposal and writes only what the user confirms (ST-LN-50 t2-ac-9)', () => {
    const onboard = flat(source('accord/onboard.md'));
    const missing = [
      'accord init',
      '`proposal:`',
      'accord config set',
      'accord config get',
      'git diff -- accord/config.yml',
      '/accord <request>',
      'one proposal at a time',
      'its evidence',
      'what happens on yes and what happens on no',
      "only after the user's yes",
      'a value the user gives',
      'never edit `accord/config.yml` by hand',
      'does not commit',
      'Changing a value later',
      'ids, commit subjects, sync, strictness, template sections or the tracker',
      '`changed:`',
    ].filter((phrase) => !onboard.includes(phrase));
    expect(missing).toEqual([]);
    // It never commits for the user, so no git write is named.
    expect(onboard).not.toMatch(/git (commit|add|push)/);

    const accord = source('accord/SKILL.md');
    const loads = /^loads: \[(.*)\]$/m.exec(accord)?.[1].split(', ') ?? [];
    expect(loads).toContain('accord/onboard.md');
    const body = flat(accord);
    for (const phrase of ['## Onboard: `/accord onboard`', '`./onboard.md`', '`proposal:`']) expect(body).toContain(phrase);
  });

  // WR-14: the consequence table is what the agent relays before the yes, so it must not claim more than the code keeps working.
  it('risk:regression the consequence table does not promise what git.merge rebase and a changed branch template break (WR-14)', () => {
    const onboard = flat(source('accord/onboard.md'));
    const missing = [
      "nothing for `merge` and `squash`; under `rebase` a ticket's branch is rebased and force-pushed with a lease at verify",
      'new branches; an in-flight branch with the old name stops being found once the new value reaches the default branch, so change it between tickets',
    ].filter((phrase) => !onboard.includes(phrase));
    expect(missing).toEqual([]);
    expect(onboard).not.toContain('everything, nothing is rewritten');
    expect(onboard).not.toContain('| branches that already exist |');
  });

  it('risk:regression the onboarding skill is the same in all four tools (ST-LN-50 t2-ac-9)', () => {
    const expected = renderSkill('accord/onboard.md' as SkillKey);
    const files = skillTargets(config(['claude', 'codex', 'cursor', 'copilot']));
    const claude = files.find((f) => f.path === '.claude/skills/accord/onboard.md');
    const agents = files.find((f) => f.path === '.agents/skills/accord/onboard.md');
    expect(claude, '.claude/skills/accord/onboard.md is not installed').toBeDefined();
    expect(agents, '.agents/skills/accord/onboard.md is not installed').toBeDefined();
    expect(claude?.text).toBe(expected);
    expect(agents?.text).toBe(expected);
    // Each runtime alone installs it where that tool reads skills.
    for (const [runtime, path] of [['claude', '.claude/skills/accord/onboard.md'], ['codex', '.agents/skills/accord/onboard.md']] as const) {
      expect(skillTargets(config([runtime])).some((f) => f.path === path), `${runtime}: ${path}`).toBe(true);
    }
    // The route stays inside the caps the accord skill keeps.
    const accord = source('accord/SKILL.md');
    expect(Buffer.byteLength(accord, 'utf8')).toBeLessThanOrEqual(6000);
    expect(accord.split('\n').length).toBeLessThanOrEqual(120);
  });
});
