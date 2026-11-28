// Phase 11 plan 09 (11-ac-5, 11-ac-6, 11-ac-7; D-05, D-06): the review stage dispatches exactly the team lenses the package prints, records each one and
// handles each `on_finding` form; the reviewer names the team lens; the verify report lists the `warn:` lines. Asserted over the RENDERED text of every
// tool a runtime loads (skillTargets, agentTargets), not the source files, except the `loads:` list, which a render strips.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
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
  roles: ['ba', 'dev'],
  runtimes: [runtime],
});

const flat = (text: string): string => text.replace(/\s+/g, ' ');
const lacks = (text: string, parts: readonly string[]): string[] => parts.filter((p) => !text.includes(p));

interface Rendered {
  label: string;
  text: string;
  raw: string;
  paths: ReadonlySet<string>;
  dir: string;
}

/** Every rendered `file` beside the accord stages (`<dir>/accord/<file>`), one per skill directory a runtime loads. */
function rendered(file: string): Rendered[] {
  return RUNTIMES.flatMap((runtime) => {
    const targets = skillTargets(config(runtime));
    const paths = new Set(targets.map((t) => t.path));
    return skillDirs(config(runtime)).map((dir) => {
      const path = besidePath('review', file, dir);
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

/** A tool or a skill named by its own name: stage text names roles only (999.6). */
const OTHER_NAMES = /impeccable|ui-ux-pro-max|superpowers|playwright|context7|figma|GSD/i;

it('risk:regression the review stage dispatches exactly the lenses the package prints, in round 1 and the final review, and records each (11-ac-5, D-05)', () => {
  const bad: string[] = [];
  for (const f of rendered('review.md')) {
    if (f.text === '') {
      bad.push(f.label + ' is missing');
      continue;
    }
    const step3 = between(f.text, '3. **Reviewers.**', '4. **Classify.**');
    for (const p of lacks(step3, ['`## Team lenses`', './review-lenses.md', '`## Security triggers`', './review-security.md'])) bad.push(f.label + ' step 3 lacks: ' + p);
    const step7 = between(f.text, '7. **Final review.**', '8. **Record.**');
    for (const p of lacks(step7, ['the lenses its package prints', './review-lenses.md'])) bad.push(f.label + ' step 7 lacks: ' + p);
    if (Buffer.byteLength(f.raw, 'utf8') > 6000) bad.push(f.label + ' is ' + Buffer.byteLength(f.raw, 'utf8') + ' bytes, over 6000');
  }
  for (const f of rendered('review-lenses.md')) {
    if (f.text === '') {
      bad.push(f.label + ' is missing');
      continue;
    }
    for (const p of lacks(f.text, [
      '`## Team lenses`',
      '`### Lens <name>`',
      'exactly the lenses it prints',
      'one `accord-reviewer`',
      'lens `<name>`',
      'the path of the review package',
      'in parallel',
      'Lens: <name> ran',
      '`refused:`',
      'the command it prints',
      'round 1',
      'final review',
    ])) {
      bad.push(f.label + ' lacks: ' + p);
    }
    for (const link of new Set([...f.text.matchAll(/`\.\/([a-z-]+\.md)`/g)].map((m) => m[1]))) {
      if (!f.paths.has(besidePath('review', link, f.dir))) bad.push(f.label + ' links ./' + link + ' which is not rendered beside it');
    }
    if (OTHER_NAMES.test(f.text)) bad.push(f.label + ' names another tool or skill');
  }
  for (const f of rendered('review.md')) {
    if (OTHER_NAMES.test(f.text)) bad.push(f.label + ' names another tool or skill');
  }
  expect(bad).toEqual([]);
});

it('risk:regression the review stage says how each on_finding is handled: warn is listed, ask goes to the owner, block is fixed, a risk finding is always fixed (11-ac-7, D-06)', () => {
  const bad: string[] = [];
  for (const f of rendered('review-lenses.md')) {
    for (const p of lacks(f.text, [
      'a `warn` finding is listed and not fixed',
      'verify report',
      'an `ask` finding is not sent to an executor',
      '`ask:` lines',
      'one finding at a time',
      'fix it, defer it with its `## Deferred` line, or accept it with `verdict: accepted-by-owner "<the owner\'s sentence>"`',
      './ask.md',
      'a `block` finding is fixed like any finding',
      'a `risk:` finding is always fixed',
      'whatever the lens says',
    ])) {
      bad.push(f.label + ' lacks: ' + p);
    }
  }
  expect(bad).toEqual([]);
});

it('risk:regression the accord skill lists review-lenses.md in its loads, names it at the review row, and every tool renders it beside review.md (D-05)', () => {
  const bad: string[] = [];
  const source = readFileSync(fileURLToPath(new URL('../skills/accord/SKILL.md', import.meta.url)), 'utf8');
  const loads = /^loads: \[(.*)\]$/m.exec(source)?.[1].split(', ') ?? [];
  if (!loads.includes('accord/review-lenses.md')) bad.push('SKILL.md does not list accord/review-lenses.md in loads');
  if (loads.join(',') !== [...loads].sort().join(',')) bad.push('the loads list is not sorted');
  const row = between(flat(source), '- lane M, row `review`:', '- lane M, rows `verify`');
  if (!row.includes('./review-lenses.md')) bad.push('the review row of SKILL.md does not name ./review-lenses.md');
  for (const f of rendered('review-lenses.md')) if (f.text === '') bad.push(f.label + ' is not rendered');
  expect(bad).toEqual([]);
});
