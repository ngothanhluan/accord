// ST-LN-36 36-ac-3: the review skill dispatches the security reviewer on a triggered round, asserted over the RENDERED
// text of every tool a runtime loads (skillTargets), not the source files.
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
