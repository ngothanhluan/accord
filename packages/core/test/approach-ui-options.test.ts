// Phase 11 plan 16 (11-ac-10; D-07, D-09): the rendered approach stage gives a `ui: true` ticket whose `design.tokens` is empty or names no file two or three prototyped visual options and the owner's
// pick before `accord approve`; the direction comes from the skill `ui.direction` names or the built-in default `./direction.md`, which the designer role loads too. Asserted over the RENDERED text of
// every tool a runtime loads (skillTargets), not the source files.
import { expect, it } from 'vitest';
import { skillDirs, skillTargets } from '../src/index.js';
import type { AccordConfig } from '../src/index.js';
import { besidePath } from './helpers/stage-files.js';

const RUNTIMES: AccordConfig['runtimes'] = ['claude', 'codex', 'cursor', 'copilot'];
const config = (runtime: AccordConfig['runtimes'][number]): AccordConfig => ({
  accord: '0.1.0',
  profile: 'build',
  tracker: { adapter: 'none' },
  design: { tokens: '' },
  roles: ['ba', 'dev', 'designer'],
  runtimes: [runtime],
});

const flat = (text: string): string => text.replace(/\s+/g, ' ');
const lacks = (text: string, parts: readonly string[]): string[] => parts.filter((p) => !text.includes(p));
const bytes = (text: string): number => Buffer.byteLength(text, 'utf8');

/** A design tool, a skill or a plugin by its own name: stage and role text names roles and config keys only (999.6). */
const OTHER_NAMES = /impeccable|ui-ux-pro-max|superpowers|playwright|cypress|figma|sketch|tailwind|bootstrap|GSD/i;

interface Rendered {
  label: string;
  text: string;
  raw: string;
  paths: ReadonlySet<string>;
  dir: string;
}

/** Every rendered `file` beside the accord stages (`<dir>/accord/<file>`), one per skill directory a runtime loads. */
function rendered(stage: string, file: string): Rendered[] {
  return RUNTIMES.flatMap((runtime) => {
    const targets = skillTargets(config(runtime));
    const paths = new Set(targets.map((t) => t.path));
    return skillDirs(config(runtime)).map((dir) => {
      const path = besidePath(stage, file, dir);
      const raw = targets.find((t) => t.path === path)?.text ?? '';
      return { label: `${runtime}: ${path}`, text: flat(raw), raw, paths, dir };
    });
  });
}

/** The text of `text` from the first occurrence of `from` to the next occurrence of `to` (or the end). */
function between(text: string, from: string, to: string): string {
  const start = text.indexOf(from);
  if (start < 0) return '';
  const end = text.indexOf(to, start + from.length);
  return end < 0 ? text.slice(start) : text.slice(start, end);
}

it('risk:regression the rendered approach step 2 sends a ui ticket with no tokens file to ./approach-ui.md and approach-ui.md holds the whole rule (11-ac-10, D-09)', () => {
  const bad: string[] = [];
  const stages = rendered('approach', 'approach.md');
  if (stages.length === 0) bad.push('approach.md is not rendered');
  for (const f of stages) {
    if (f.text === '') {
      bad.push(f.label + ' is missing');
      continue;
    }
    const step2 = between(f.text, '2. **Options.**', '3. **Critique.**');
    for (const p of lacks(step2, ['`ui: true`', '`design.tokens`', 'empty or names no file', './approach-ui.md'])) bad.push(f.label + ' step 2 lacks: ' + p);
    if (bytes(f.raw) > 6000) bad.push(f.label + ' is ' + bytes(f.raw) + ' bytes, over 6000');
  }
  const files = rendered('approach', 'approach-ui.md');
  if (files.length === 0) bad.push('approach-ui.md is not rendered');
  for (const f of files) {
    if (f.text === '') {
      bad.push(f.label + ' is missing');
      continue;
    }
    const wanted = [
      '`ui: true`',
      '`design.tokens`',
      'empty or names no file',
      'a `ui: false` ticket',
      'skip all of it',
      'two or three',
      '`accord/assets/<id>/option-1.html`',
      '`option-3.html`',
      'one file, no build step',
      'no remote',
      'the skill the `ui.direction` key',
      './direction.md',
      'never runs its own intent, plan or done',
      'inside step 2',
      'no stage of its own',
      'show every option to the owner',
      'the owner picks',
      'before `accord approve`',
      '`accord/assets/<id>/prototype.html`',
      '`accord gate ready`',
      '`- Chosen:`',
      'look: option-<k>',
    ];
    // a phrase may open a sentence: compare in lower case
    for (const p of lacks(f.text.toLowerCase(), wanted.map((w) => w.toLowerCase()))) bad.push(f.label + ' lacks: ' + p);
    if (OTHER_NAMES.test(f.raw)) bad.push(f.label + ' names a design tool or a skill');
    if (bytes(f.raw) > 6000) bad.push(f.label + ' is ' + bytes(f.raw) + ' bytes, over 6000');
    for (const link of new Set([...f.text.matchAll(/`\.\/([a-z-]+\.md)`/g)].map((m) => m[1]))) {
      if (!f.paths.has(besidePath('approach', link, f.dir))) bad.push(f.label + ' links ./' + link + ' which is not rendered beside it');
    }
  }
  expect(bad).toEqual([]);
});

it('risk:regression direction.md is the built-in direction default: two or three directions in palette, type and spacing, each derived from the project, one HTML file each (D-07)', () => {
  const bad: string[] = [];
  const files = rendered('approach', 'direction.md');
  if (files.length === 0) bad.push('direction.md is not rendered');
  for (const f of files) {
    if (f.text === '') {
      bad.push(f.label + ' is missing');
      continue;
    }
    const wanted = [
      '`ui.direction`',
      'two or three directions',
      'palette, type and spacing',
      './prototype.md',
      'derived from what the project already has',
      'one HTML file',
      'no build step',
      'no remote',
      '`Derived from:`',
      'the designer role loads it too',
    ];
    for (const p of lacks(f.text.toLowerCase(), wanted.map((w) => w.toLowerCase()))) bad.push(f.label + ' lacks: ' + p);
    if (OTHER_NAMES.test(f.raw)) bad.push(f.label + ' names a design tool or a skill');
    if (bytes(f.raw) > 6000) bad.push(f.label + ' is ' + bytes(f.raw) + ' bytes, over 6000');
    for (const link of new Set([...f.text.matchAll(/`\.\/([a-z-]+\.md)`/g)].map((m) => m[1]))) {
      if (!f.paths.has(besidePath('approach', link, f.dir))) bad.push(f.label + ' links ./' + link + ' which is not rendered beside it');
    }
  }
  expect(bad).toEqual([]);
});

it('risk:regression the designer role carries the built-in direction default (D-07)', () => {
  const bad: string[] = [];
  for (const runtime of RUNTIMES) {
    const targets = skillTargets(config(runtime));
    const dirs = skillDirs(config(runtime));
    if (dirs.length === 0) bad.push(runtime + ': no skill directory');
    for (const dir of dirs) {
      const skill = targets.find((t) => t.path === `${dir}/accord-designer/SKILL.md`)?.text ?? '';
      const direction = targets.find((t) => t.path === `${dir}/accord-designer/direction.md`)?.text ?? '';
      const label = `${runtime}: ${dir}/accord-designer`;
      if (skill === '') {
        bad.push(label + '/SKILL.md is missing');
        continue;
      }
      if (direction === '') bad.push(label + '/direction.md is missing');
      const text = flat(skill);
      const step3 = between(text, '3. Read `profile:`', '4. Run `accord gate ready');
      for (const p of lacks(step3, ['`./direction.md`', 'no file at `design.tokens`', 'the approach asks for options'])) bad.push(label + ' step 3 lacks: ' + p);
      for (const p of lacks(text, ['`./prototype.md`'])) bad.push(label + ' lacks: ' + p);
      const first = /`(accord [a-z]+ [a-z]+)/.exec(text)?.[1];
      if (first !== 'accord gate ready') bad.push(label + ' first command is ' + String(first));
      if (bytes(skill) > 6000) bad.push(label + ' SKILL.md is ' + bytes(skill) + ' bytes, over 6000');
      if (skill.split('\n').length > 120) bad.push(label + ' SKILL.md is over 120 lines');
      if (OTHER_NAMES.test(skill)) bad.push(label + ' names a design tool or a skill');
    }
  }
  expect(bad).toEqual([]);
});
