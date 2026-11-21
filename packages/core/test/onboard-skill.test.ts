// ST-LN-50 t2-ac-9, D-11; Phase 8.3 D-07, D-10: `accord init` only proposes; `/accord-onboard` (its own command since 08.3-23, source `skills/onboard/SKILL.md`) asks the user about
// each proposal on the shared walk (`shared/walk.md`, which `/accord-config` loads too) and writes only the confirmed ones, through `accord config set`. The text is read with
// whitespace collapsed, so a phrase wrapped across two lines is still found. The real-command check for every `accord ...` the skill names is skill-commands.test.ts in the cli package.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { CONFIG_AREAS, renderSkill, skillTargets, withoutMarker } from '../src/index.js';
import type { AccordConfig, SkillFile, SkillKey } from '../src/index.js';

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

const ALL = skillTargets(config(['claude', 'codex', 'cursor', 'copilot']));
const at = (files: SkillFile[], path: string): string => files.find((f) => f.path === path)?.text ?? '';
const skill = at(ALL, '.claude/skills/accord-onboard/SKILL.md');
const body = flat(withoutMarker(skill).replace(/^---\n[\s\S]*?\n---\n/, ''));
const walk = flat(at(ALL, '.claude/skills/accord-onboard/walk.md'));

describe('the onboarding skill confirms each proposal and writes only what the user confirms', () => {
  it('risk:regression accord-onboard renders as its own command on the shared walk (D-07)', () => {
    expect(skill, 'accord-onboard/SKILL.md is not rendered').not.toBe('');
    expect(skill).toMatch(/^name: "?accord-onboard"?$/m);
    expect(skill).toMatch(/^argument-hint: ["']?\[no arguments\]["']?$/m);
    // it opens on the session check, before any other accord command (`accord init` is the command whose output it reads, named in the opening sentence)
    const firstCommand = /`accord (?!init\b)([^\s`]+(?: [^\s`<]+)?)/.exec(body);
    expect(firstCommand?.[1]).toBe('worktree check');
    const missing = [
      'accord worktree check',
      'this session works',
      'settings are changed from the main checkout',
      'accord init',
      '`proposal:`',
      '`accord config areas`',
      'one proposal at a time',
      '`./walk.md`',
      '`./ask.md`',
      '`/accord <request>`',
      '`/accord-audit`',
      '`/accord-config`',
      "only after the user's yes",
      'never edit `accord/config.yml` by hand',
      '`accord config set`',
    ].filter((phrase) => !body.includes(phrase));
    expect(missing).toEqual([]);
    // it walks only the keys that carry a proposal, so no key is named by the skill and no area list is restated (D-13)
    expect(body).toContain('only the settings accord has a proposal for');
    expect(body).not.toMatch(/`(?:git\.merge|commits\.subjects|branch|ids|tracker)`/);
    // it commits for nobody, so no git write is named
    expect(body).not.toMatch(/git (commit|add|push)/);
    // the init flow is reached after the proposals line, whatever it says (D-10 reading of 8.1)
    expect(body).toContain('its `proposals:` line');
    // every tool's folder holds the same SKILL.md with walk.md and ask.md beside it, and a codex-only repository still gets the command
    for (const dir of ['.claude/skills', '.agents/skills']) {
      expect(at(ALL, dir + '/accord-onboard/SKILL.md'), dir).toBe(skill);
      for (const name of ['walk.md', 'ask.md']) expect(at(ALL, `${dir}/accord-onboard/${name}`), `${dir}/${name}`).toBe(renderSkill(('shared/' + name) as SkillKey));
    }
    expect(skillTargets(config(['codex'])).some((f) => f.path === '.agents/skills/accord-onboard/SKILL.md')).toBe(true);
    expect(skillTargets(config(['claude'])).some((f) => f.path === '.claude/skills/accord-onboard/SKILL.md')).toBe(true);
    // the accord folder renders no onboard.md and its SKILL.md names no onboarding file; it stays inside the caps the accord skill keeps (the caps bind the rendered file, which has no `loads:` line)
    expect(ALL.filter((f) => f.path.endsWith('/accord/onboard.md')).map((f) => f.path)).toEqual([]);
    const accord = renderSkill('accord/SKILL.md' as SkillKey);
    expect(accord).not.toContain('./onboard.md');
    expect(Buffer.byteLength(accord, 'utf8')).toBeLessThanOrEqual(6000);
    expect(accord.split('\n').length).toBeLessThanOrEqual(120);
  });

  // The walk lives once (D-10): onboard and config each load `shared/walk.md`, which renders identical in both folders, and neither SKILL.md holds its text.
  it('risk:regression the onboarding skill follows the shared walk for each proposal and writes only what the user confirms (D-10)', () => {
    const missing = [
      'accord config get',
      'git diff -- accord/config.yml',
      'what happens on yes and what happens on no',
      "only after the user's yes",
      'a value the user gives',
      'never edit `accord/config.yml` by hand',
      'does not commit',
      'its evidence',
      '`changed:`',
      'Take the proposed value',
    ].filter((phrase) => !walk.includes(phrase));
    expect(missing).toEqual([]);
    expect(body).not.toContain('Take the proposed value');
    expect(body).not.toContain('pass the bare value in single quotes');
    // a later change of any value is the config command's
    expect(body).toContain('`/accord-config`');
    // the first ticket line ends the flow
    expect(body).toContain('`/accord <request>`');
  });

  // Owner decision (2026-11-15): a repository script runs only after the person ran `accord trust`, so the skills name it and never run it on their own.
  it('risk:security the shared walk says accord trust is for the person to run, and what it binds (repository scripts trust)', () => {
    const missing = [
      '`git.sync` and `tracker.command`',
      'does not run them until the person allows them once with `accord trust`',
      'a local record inside `.git`, never committed',
      'bound to the command and the files it reaches',
      '`accord trust --revoke` withdraws it',
      'Run `accord trust` only when the user asks you to, never on your own',
      'must be committed to the default branch first',
    ].filter((p) => !walk.includes(p));
    expect(missing).toEqual([]);
    // T-08.3-38: the onboarding text sends every proposal through that walk, so a proposed script key never loses the note that nothing runs until `accord trust`
    expect(body).toContain('`./walk.md`');
    expect(body).toContain('`accord trust`');
    // ST-LN-69 7-ac-12: the refusal's own next action says accord trust is the owner's to run (packages/cli/test/next-action.test.ts); worktree.md says to do what the line says
    const worktree = flat(source('accord/worktree.md'));
    expect(worktree).toContain('do what it says');
  });

  // Round 3 WR-02, WR-03: `accord trust` alone only shows; naming a script allows it, in the checkout the line names.
  it('risk:security the skills say accord trust alone only shows, accord trust <script> allows that one, and where to run it (round 3 WR-02, WR-03)', () => {
    // round 4 WR-04: the allow names the digest the preview showed (`<script>@<digest>`), so the round 3 wording moved to the forms below
    for (const p of ['the files an allow covers and the ones that changed, and allows nothing', 'allows that one']) {
      expect(walk, p).toContain(p);
    }
    // ST-LN-69 7-ac-12: the `behind:` line and the sync refusal print where to run accord trust, with the path (packages/cli/test/worktree-sync.test.ts)
    const worktree = flat(source('accord/worktree.md'));
    expect(worktree).toContain('do what it says');
  });

  // Round 4 WR-04 and the owner's round 4 answer: an allow names the digest the preview showed, and the skills say what accord does not check.
  it('risk:security the skills say an allow names the digest accord trust showed, and that accord checks only the files it lists (round 4)', () => {
    for (const p of [
      '`accord trust` shows each script with a digest',
      '`accord trust git.sync@<digest>` or `accord trust tracker.command@<digest>`, with the digest exactly as shown, allows that one',
      'accord checks only the files `accord trust` lists; anything else the command loads is not checked, so whoever allows a script must review the pull request that changed it',
    ]) {
      expect(walk, p).toContain(p);
    }
    // ST-LN-69 7-ac-12: the digest form is printed by the `behind:` line itself (packages/cli/test/worktree-sync.test.ts)
    const worktree = flat(source('accord/worktree.md'));
    expect(worktree).toContain('do what it says');
  });

  // WR-14: the consequence the agent relays before the yes must not claim more than the code keeps working. The words live in the area data, which `accord config areas` prints (D-13).
  it('risk:regression the consequence texts do not promise what git.merge rebase and a changed branch template break (WR-14)', () => {
    const text = (key: string): string => flat(CONFIG_AREAS.flatMap((a) => a.keys).find((k) => k.key === key)?.text ?? '');
    const missing = [
      ["nothing breaks for merge and squash, and under rebase a ticket's branch is rebased and force-pushed with a lease at verify", text('git')],
      ['an in-flight branch with the old name stops being found once the new value reaches the default branch, so change it between tickets', text('branch')],
    ].filter(([phrase, from]) => !from.includes(phrase));
    expect(missing).toEqual([]);
    for (const copy of [body, walk]) {
      expect(copy).not.toContain('everything, nothing is rewritten');
      expect(copy).not.toContain('| branches that already exist |');
      // the onboarding text keeps no key table of its own: the meaning of a key comes from `accord config areas`
      expect(copy).not.toContain('| Key |');
    }
  });
});
