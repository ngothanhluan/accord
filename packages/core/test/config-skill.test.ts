// Phase 8.3 D-08, D-09, D-10: `/accord-config` walks the settings area by area from `accord config areas` (data, D-13), scans nothing, and writes a value only through
// `accord config set` after the owner's yes. The per-key walk lives once in `shared/walk.md`, which the config skill loads and the onboarding skill loads too (08.3-23).
// The text is read with whitespace collapsed, so a phrase wrapped across two lines is still found. The real-command check for every `accord ...` the skill names is skill-commands.test.ts in the cli package.
import { describe, expect, it } from 'vitest';
import { skillTargets, withoutMarker } from '../src/index.js';
import type { AccordConfig, SkillFile } from '../src/index.js';

const flat = (text: string): string => text.replace(/\s+/g, ' ');
const config = (runtimes: AccordConfig['runtimes']): AccordConfig => ({
  accord: '0.10.0',
  profile: 'build',
  tracker: { adapter: 'none' },
  design: { tokens: '' },
  roles: ['ba', 'dev'],
  runtimes,
});

const ALL = skillTargets(config(['claude', 'codex', 'cursor', 'copilot']));
const at = (files: SkillFile[], path: string): string => files.find((f) => f.path === path)?.text ?? '';
const skill = at(ALL, '.claude/skills/accord-config/SKILL.md');
const walk = at(ALL, '.claude/skills/accord-config/walk.md');
const body = flat(withoutMarker(skill).replace(/^---\n[\s\S]*?\n---\n/, ''));

describe('the config skill walks areas from the CLI and writes only through accord config set', () => {
  it('risk:regression the config skill walks areas from the CLI and writes only through accord config set (D-08)', () => {
    expect(skill, 'accord-config/SKILL.md is not rendered').not.toBe('');
    expect(skill).toMatch(/^name: "?accord-config"?$/m);
    expect(skill).toMatch(/^argument-hint: ["']?\[area\]["']?$/m);
    // it opens on the session check, before any other accord command
    const firstCommand = /`accord ([^\s`]+(?: [^\s`<]+)?)/.exec(body);
    expect(firstCommand?.[1]).toBe('worktree check');
    const missing = [
      'accord worktree check',
      'this session works',
      'settings are changed from the main checkout',
      '`accord config areas`',
      '`accord config areas <area>`',
      '`./walk.md`',
      '`./ask.md`',
      'one question per area',
      'On a no, go to the next area',
      '(not walked: accord writes these)',
      'shown and skipped',
      '`accord config set`',
      'never edit `accord/config.yml` by hand',
      'commits nothing',
    ].filter((phrase) => !body.includes(phrase));
    expect(missing).toEqual([]);
    // it commits for nobody and runs no write of its own
    expect(body).not.toMatch(/git (commit|add|push)/);
    expect(body).not.toMatch(/accord config (unset|get)\b/);
    // every tool's folder holds the same two files
    for (const path of ['.agents/skills/accord-config/SKILL.md', '.agents/skills/accord-config/walk.md', '.agents/skills/accord-config/ask.md']) expect(at(ALL, path), path).not.toBe('');
    expect(at(ALL, '.agents/skills/accord-config/SKILL.md')).toBe(skill);
    expect(at(ALL, '.agents/skills/accord-config/walk.md')).toBe(walk);
    // a codex-only repository still gets the command, where codex reads skills
    expect(skillTargets(config(['codex'])).some((f) => f.path === '.agents/skills/accord-config/SKILL.md')).toBe(true);
    expect(skillTargets(config(['claude'])).some((f) => f.path === '.claude/skills/accord-config/SKILL.md')).toBe(true);
  });

  it('risk:regression the config skill scans nothing (D-09)', () => {
    expect(body).not.toBe('');
    for (const word of ['accord init', 'Grep', 'Glob', 'git log', 'ls-files']) expect(body.includes(word), word).toBe(false);
    expect(body).toContain('`/accord-onboard`');
    expect(body).toContain('scans nothing');
  });

  it('risk:regression the config command and the shared walk hold no scan (D-09)', () => {
    for (const [name, text] of [['SKILL.md', body], ['walk.md', flat(walk)]] as const) {
      for (const word of ['accord-scout', './scan.md', '--proposals']) expect(text.includes(word), `${name} holds ${word}`).toBe(false);
    }
    for (const dir of ['.claude/skills', '.agents/skills']) expect(at(ALL, dir + '/accord-config/scan.md'), dir).toBe('');
  });

  it('risk:regression the shared walk holds the whole per-key procedure (D-10)', () => {
    expect(walk, 'accord-config/walk.md is not rendered').not.toBe('');
    const text = flat(walk);
    const missing = [
      'Take the proposed value',
      'Keep',
      'Give another value',
      'pass the bare value in single quotes',
      "the printed `proposal: git.merge = \"squash\"` is run as `accord config set git.merge 'squash'`",
      '`changed:`',
      'accord trust git.sync@<digest>',
      '`commits.message.command`',
      '`pr.command`',
      '`audit.command`',
      'accord trust --revoke',
      'accord config unset',
      'accord config check',
      '`accord/product/security.md`',
      'git diff -- accord/config.yml',
      'does not commit',
      'never edit `accord/config.yml` by hand',
      'never take silence or "whatever" for a yes',
    ].filter((phrase) => !text.includes(phrase));
    expect(missing).toEqual([]);
    // no key table or area list: the areas come from `accord config areas` (D-13)
    expect(text).not.toContain('| Key |');
    // the walk lives once: the config skill points at it and holds none of its text
    expect(body).not.toContain('Take the proposed value');
    expect(body).not.toContain('pass the bare value in single quotes');
    // the accord folder never renders it: the walk belongs to the commands that run it
    expect(at(ALL, '.claude/skills/accord/walk.md')).toBe('');
  });

  // 08.3-23: `/accord-onboard` follows the same walk, so it renders once in the source and identical in both commands' folders; neither SKILL.md holds its text.
  it('risk:regression onboard and config share one walk (D-10)', () => {
    const onboard = at(ALL, '.claude/skills/accord-onboard/SKILL.md');
    expect(onboard, 'accord-onboard/SKILL.md is not rendered').not.toBe('');
    const onboardBody = flat(withoutMarker(onboard).replace(/^---\n[\s\S]*?\n---\n/, ''));
    for (const dir of ['.claude/skills', '.agents/skills']) {
      expect(at(ALL, dir + '/accord-config/walk.md'), dir).not.toBe('');
      expect(at(ALL, dir + '/accord-onboard/walk.md'), `${dir}: onboard's walk.md is config's walk.md`).toBe(at(ALL, dir + '/accord-config/walk.md'));
    }
    // both SKILL.md files list and name the one walk
    for (const [name, text] of [['accord-config', body], ['accord-onboard', onboardBody]] as const) {
      expect(text, name + ' names ./walk.md').toContain('`./walk.md`');
      expect(text, name + ' holds no copy of the walk').not.toContain('Take the proposed value');
      for (const trust of ['accord trust git.sync@<digest>', 'accord trust --revoke', 'does not run them until the person allows them once', 'pass the bare value in single quotes'])
        expect(text.includes(trust), `${name} holds the trust text: ${trust}`).toBe(false);
    }
    // the walk's only copy of the key procedure is walk.md: no other rendered file of any folder holds it
    const holders = ALL.filter((f) => f.path.startsWith('.claude/skills/') && flat(f.text).includes('Take the proposed value')).map((f) => f.path);
    expect(holders.sort()).toEqual(['.claude/skills/accord-config/walk.md', '.claude/skills/accord-onboard/walk.md']);
  });
});
