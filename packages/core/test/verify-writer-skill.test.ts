// ST-LN-39 39-ac-2 and D-08: the verify skill tells every tool who writes verification.md, that Claude Code enforces it with a
// hook and that Cursor, Codex and Copilot do not, with the two known gaps, asserted over the RENDERED text of each runtime.
import { expect, it } from 'vitest';
import { skillDirs, skillTargets } from '../src/index.js';
import type { AccordConfig } from '../src/index.js';
import { stagePath } from './helpers/stage-files.js';

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
const lacks = (text: string, parts: readonly string[]): string[] => parts.filter((p) => !text.includes(p));
const bytes = (text: string): number => Buffer.byteLength(text, 'utf8');
const lines = (text: string): number => text.split('\n').length - (text.endsWith('\n') ? 1 : 0);

it('risk:regression the verify skill says the verifier-only rule is not enforced in cursor codex and copilot (ST-LN-39 39-ac-2)', () => {
  const bad: string[] = [];
  for (const runtime of RUNTIMES) {
    const files = skillTargets(config(runtime));
    const dirs = skillDirs(config(runtime));
    const writers = files.filter((f) => dirs.some((dir) => f.path === stagePath('verify', 'writer', dir)));
    const skills = files.filter((f) => dirs.some((dir) => f.path === stagePath('verify', undefined, dir)));
    if (writers.length === 0) bad.push(runtime + ': ' + stagePath('verify', 'writer') + ' is missing');
    if (skills.length === 0) bad.push(runtime + ': ' + stagePath('verify') + ' is missing');
    for (const f of writers) {
      const missing = lacks(flat(f.text), [
        'accord-verifier',
        'resume mode',
        'In Claude Code',
        'PreToolUse',
        'Cursor, Codex and Copilot',
        'not enforced in this tool',
        'shell command',
        'SendMessage',
      ]);
      if (missing.length > 0) bad.push(runtime + ' ' + f.path + ' lacks: ' + missing.join(' | '));
    }
    for (const f of skills) {
      if (!flat(f.text).includes('./verify-writer.md')) bad.push(runtime + ' ' + f.path + ': step 3 does not point to ./verify-writer.md');
      if (bytes(f.text) > 6000) bad.push(runtime + ' ' + f.path + ': ' + bytes(f.text) + ' bytes, above 6000');
      if (lines(f.text) > 120) bad.push(runtime + ' ' + f.path + ': ' + lines(f.text) + ' lines, above 120');
    }
  }
  expect(bad).toEqual([]);
});
