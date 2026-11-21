// ST-LN-36 36-ac-3: the review skill dispatches the security reviewer on a triggered round, asserted over the RENDERED
// text of every tool a runtime loads (skillTargets), not the source files.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { expect, it } from 'vitest';
import { skillDirs, skillTargets } from '../src/index.js';
import type { AccordConfig } from '../src/index.js';
import { besidePath, stagePath } from './helpers/stage-files.js';

const RUNTIMES: AccordConfig['runtimes'] = ['claude', 'codex', 'cursor', 'copilot'];
const config = (runtime: AccordConfig['runtimes'][number]): AccordConfig => ({
  accord: '0.1.0',
  profile: 'build',
  tracker: { adapter: 'none' },
  design: { tokens: '' },
  roles: ['ba', 'dev'],
  runtimes: [runtime],
});

const flat = (text: string): string => text.replace(/\s+/g, ' ');
/** Every render of one file of one skill under a runtime: one per skill directory the runtime loads. */
const filesOf = (runtime: AccordConfig['runtimes'][number], skill: string, file: string) =>
  skillTargets(config(runtime)).filter((f) => f.path.endsWith('/' + skill + '/' + file));
/** Every render of the file a path function names under a runtime: one per skill directory the runtime loads. */
const rendersAt = (runtime: AccordConfig['runtimes'][number], pathIn: (dir: string) => string) => {
  const cfg = config(runtime);
  const wanted = new Set(skillDirs(cfg).map(pathIn));
  return skillTargets(cfg).filter((f) => wanted.has(f.path));
};
/** The phrases a text lacks, so a failing case names each one. */
const lacks = (text: string, parts: readonly string[]): string[] => parts.filter((p) => !text.includes(p));

it('risk:security the review skill runs a security reviewer on the security package when the package lists a trigger, in every tool (ST-LN-36 36-ac-3)', () => {
  const bad: string[] = [];
  for (const runtime of RUNTIMES) {
    const security = rendersAt(runtime, (dir) => stagePath('review', 'security', dir));
    if (security.length === 0) bad.push(runtime + ': ' + stagePath('review', 'security') + ' is missing');
    for (const f of security) {
      for (const p of lacks(flat(f.text), [
        '# The security reviewer',
        '## Security triggers',
        '(none: no pattern matched)',
        'Security: no pattern matched',
        'accord review-package <id> --security',
        '--round <k>',
        'lens `security`',
        'Security: lens security ran',
        'round 1',
        'final review',
        're-review round',
        '`accord round`',
        '`accord gate done`',
        '0.7.0',
        'no `Security:` line',
        'risk: security',
      ]))
        bad.push(f.path + ' lacks ' + p);
    }
    const skill = rendersAt(runtime, (dir) => stagePath('review', undefined, dir));
    if (skill.length === 0) bad.push(runtime + ': ' + stagePath('review') + ' is missing');
    for (const f of skill) {
      if (!f.text.includes('./review-security.md')) bad.push(f.path + ' lacks the pointer ./review-security.md');
      if (Buffer.byteLength(f.text) > 6000) bad.push(f.path + ' is over 6000 bytes');
    }
    const record = rendersAt(runtime, (dir) => stagePath('review', 'record', dir));
    if (record.length === 0) bad.push(runtime + ': ' + stagePath('review', 'record') + ' is missing');
    for (const f of record)
      for (const p of lacks(flat(f.text), ['Security: no pattern matched', 'Security: lens security ran', 'no `Security:` line', './review-security.md']))
        bad.push(f.path + ' lacks ' + p);
  }
  expect(bad).toEqual([]);
});

it('risk:security lane S review rounds add the security reviewer as lane M does, in every tool (ST-LN-36 36-ac-2)', () => {
  const bad: string[] = [];
  for (const runtime of RUNTIMES) {
    const security = rendersAt(runtime, (dir) => besidePath('new', 'review-security.md', dir));
    if (security.length === 0) bad.push(runtime + ': ' + besidePath('new', 'review-security.md') + ' is missing');
    const laneS = rendersAt(runtime, (dir) => besidePath('new', 'lane-s.md', dir));
    if (laneS.length === 0) bad.push(runtime + ': ' + besidePath('new', 'lane-s.md') + ' is missing');
    for (const f of laneS)
      for (const p of lacks(flat(f.text), [
        'when the round\'s package lists a security trigger, add a security reviewer',
        './review-security.md',
        'in every round write the round\'s `Security:` line',
        '`Security: no pattern matched` when the package lists none',
      ]))
        bad.push(f.path + ' lacks ' + p);
  }
  expect(bad).toEqual([]);
});

/** What is wrong with a render list: a retired checklist path, a pointer to the old name, a folder naming a file it lacks. */
const securityRenderIssues = (files: readonly { path: string; text: string }[]): string[] => {
  const bad: string[] = [];
  const paths = new Set(files.map((f) => f.path));
  for (const f of files) {
    if (/\/accord\/security\.md$/.test(f.path)) bad.push(f.path + ' is the retired checklist path');
    if (f.text.includes('./security.md')) bad.push(f.path + ' names ./security.md');
    if (f.text.includes('./review-security.md')) {
      const beside = f.path.replace(/\/[^/]+$/, '/review-security.md');
      if (!paths.has(beside)) bad.push(f.path + ' names ./review-security.md but ' + beside + ' is not rendered');
    }
  }
  return bad;
};

it('risk:data-loss the security checklist renders as review-security.md wherever a stage reads it and never as the retired name (D-01)', () => {
  const bad: string[] = [];
  for (const runtime of RUNTIMES) {
    const files = skillTargets(config(runtime));
    bad.push(...securityRenderIssues(files).map((p) => runtime + ': ' + p));
    // not vacuous: the review, new and continue stages each name the checklist and render it beside their own file
    for (const stage of ['review', 'new', 'continue']) {
      const own = rendersAt(runtime, (dir) => stagePath(stage, undefined, dir));
      if (own.length === 0) bad.push(runtime + ': ' + stagePath(stage) + ' is missing');
      for (const f of own) if (!f.text.includes('./review-security.md')) bad.push(f.path + ' does not name ./review-security.md');
    }
    // guard the guard: a render list holding the retired path is reported
    const dir = skillDirs(config(runtime))[0] as string;
    const guarded = securityRenderIssues([...files, { path: dir + '/accord/security.md', text: 'x' }]);
    if (!guarded.some((p) => p.includes(dir + '/accord/security.md is the retired checklist path'))) bad.push(runtime + ': the guard missed the retired path');
  }
  expect(bad).toEqual([]);
});

it('risk:security the config skill asks the owner before it writes a Removed line for a default pattern (ST-LN-36 36-ac-4)', () => {
  const bad: string[] = [];
  for (const runtime of RUNTIMES) {
    const onboard = filesOf(runtime, 'accord', 'onboard.md');
    if (onboard.length === 0) bad.push(runtime + ': accord/onboard.md is missing');
    for (const f of onboard) {
      const text = flat(f.text);
      const section = text.slice(text.indexOf('## Changing a value later'));
      for (const p of lacks(section, [
        '`accord/product/security.md`',
        '`- Removed: <id> — <reason>`',
        'one standalone question',
        'names the pattern',
        'no longer get a security reviewer',
        'a `risk: security` finding still blocks',
        'writes nothing without the yes',
        'never deletes a default\'s line',
      ]))
        bad.push(f.path + ' lacks ' + p);
    }
  }
  const template = readFileSync(fileURLToPath(new URL('../templates/security.md', import.meta.url)), 'utf8').replace(/\s+/g, ' ');
  for (const p of lacks(template, ['A default is removed only by a `- Removed: <id> — <reason>` line under `## Removed`, with the owner\'s yes']))
    bad.push('templates/security.md lacks ' + p);
  expect(bad).toEqual([]);
});

it('risk:regression the lane rule names migration and the plan critic\'s trigger is unchanged (ST-LN-36 D-05)', () => {
  const bad: string[] = [];
  for (const runtime of RUNTIMES) {
    const lane = rendersAt(runtime, (dir) => besidePath('new', 'lane.md', dir));
    if (lane.length === 0) bad.push(runtime + ': ' + besidePath('new', 'lane.md') + ' is missing');
    for (const f of lane) for (const p of lacks(flat(f.text), ['auth, money, migration or data deletion'])) bad.push(f.path + ' lacks ' + p);
    const critique = rendersAt(runtime, (dir) => stagePath('plan', 'critique', dir));
    if (critique.length === 0) bad.push(runtime + ': ' + stagePath('plan', 'critique') + ' is missing');
    for (const f of critique)
      for (const p of lacks(flat(f.text), ['when the ticket touches auth, money, migration, or data deletion, or the plan touches a path under `sensitive:` in `accord/config.yml`']))
        bad.push(f.path + ' lacks ' + p);
  }
  expect(bad).toEqual([]);
});
