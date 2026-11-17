// ST-LN-36 36-ac-3: the review skill dispatches the security reviewer on a triggered round, asserted over the RENDERED
// text of every tool a runtime loads (skillTargets), not the source files.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { expect, it } from 'vitest';
import { skillTargets } from '../src/index.js';
import type { AccordConfig } from '../src/index.js';

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
/** The phrases a text lacks, so a failing case names each one. */
const lacks = (text: string, parts: readonly string[]): string[] => parts.filter((p) => !text.includes(p));

it('ac-3 the review skill runs a security reviewer on the security package when the package lists a trigger, in every tool (ST-LN-36 36-ac-3)', () => {
  const bad: string[] = [];
  for (const runtime of RUNTIMES) {
    const security = filesOf(runtime, 'accord-review', 'security.md');
    if (security.length === 0) bad.push(runtime + ': accord-review/security.md is missing');
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
    const skill = filesOf(runtime, 'accord-review', 'SKILL.md');
    if (skill.length === 0) bad.push(runtime + ': accord-review/SKILL.md is missing');
    for (const f of skill) {
      if (!f.text.includes('./security.md')) bad.push(f.path + ' lacks the pointer ./security.md');
      if (Buffer.byteLength(f.text) > 6000) bad.push(f.path + ' is over 6000 bytes');
    }
    const record = filesOf(runtime, 'accord-review', 'record.md');
    if (record.length === 0) bad.push(runtime + ': accord-review/record.md is missing');
    for (const f of record)
      for (const p of lacks(flat(f.text), ['Security: no pattern matched', 'Security: lens security ran', 'no `Security:` line', './security.md']))
        bad.push(f.path + ' lacks ' + p);
  }
  expect(bad).toEqual([]);
});

it('ac-2 lane S review rounds add the security reviewer as lane M does, in every tool (ST-LN-36 36-ac-2)', () => {
  const bad: string[] = [];
  for (const runtime of RUNTIMES) {
    const security = filesOf(runtime, 'accord', 'security.md');
    if (security.length === 0) bad.push(runtime + ': accord/security.md is missing');
    const laneS = filesOf(runtime, 'accord', 'lane-s.md');
    if (laneS.length === 0) bad.push(runtime + ': accord/lane-s.md is missing');
    for (const f of laneS)
      for (const p of lacks(flat(f.text), [
        'when the round\'s package lists a security trigger, add a security reviewer',
        './security.md',
        'in every round write the round\'s `Security:` line',
        '`Security: no pattern matched` when the package lists none',
      ]))
        bad.push(f.path + ' lacks ' + p);
  }
  expect(bad).toEqual([]);
});

it('ac-4 the config skill asks the owner before it writes a Removed line for a default pattern (ST-LN-36 36-ac-4)', () => {
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
        'never delete a default\'s line',
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
    const lane = filesOf(runtime, 'accord', 'lane.md');
    if (lane.length === 0) bad.push(runtime + ': accord/lane.md is missing');
    for (const f of lane) for (const p of lacks(flat(f.text), ['auth, money, migration or data deletion'])) bad.push(f.path + ' lacks ' + p);
    const critique = filesOf(runtime, 'accord-plan', 'critique.md');
    if (critique.length === 0) bad.push(runtime + ': accord-plan/critique.md is missing');
    for (const f of critique)
      for (const p of lacks(flat(f.text), ['when the ticket touches auth, money, migration, or data deletion, or the plan touches a path under `sensitive:` in `accord/config.yml`']))
        bad.push(f.path + ' lacks ' + p);
  }
  expect(bad).toEqual([]);
});
