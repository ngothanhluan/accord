// Phase 15 plan 13 (D-26, D-27, SC-10, T-15-30): the plan stage ends with a short summary of six fixed items, and nothing is pasted.
// Asserted over the RENDERED text of every tool a runtime loads (skillTargets), not the source files.
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

/** Every rendered file of the plan stage (`child` undefined: the stage file), one per skill directory a runtime loads, with its raw text. */
function rendered(child?: string): Array<{ label: string; raw: string; text: string }> {
  return RUNTIMES.flatMap((runtime) => {
    const targets = skillTargets(config(runtime));
    return skillDirs(config(runtime)).map((dir) => {
      const path = stagePath('plan', child, dir);
      const raw = targets.find((t) => t.path === path)?.text ?? '';
      return { label: `${runtime}: ${path}`, raw, text: flat(raw) };
    });
  });
}

it('risk:regression step 8 of the plan stage names plan-summary.md, and the rendered file holds the six items in the owner\'s order (D-26)', () => {
  const bad: string[] = [];
  for (const f of rendered()) {
    if (f.text === '') bad.push(f.label + ' is missing');
    const step8 = f.text.slice(f.text.indexOf('8. **Finish.**'), f.text.indexOf('9. Next:'));
    if (!step8.includes('./plan-summary.md')) bad.push(f.label + ' step 8 names no ./plan-summary.md');
    if (f.text.split('./plan-summary.md').length !== 2) bad.push(f.label + ' names ./plan-summary.md other than once');
  }
  for (const f of rendered('summary')) {
    if (f.text === '') {
      bad.push(f.label + ' is missing');
      continue;
    }
    const items = ['What the plan does', 'How it is split', 'Which criteria it covers', 'The Rulings taken', 'The risks', 'The next step'];
    for (const p of lacks(f.text, items)) bad.push(f.label + ' lacks item: ' + p);
    const at = items.map((i) => f.text.indexOf(i));
    if (at.some((n, i) => i > 0 && n <= at[i - 1])) bad.push(f.label + ' holds the six items out of order');
    for (const p of lacks(f.text, ['the number of tasks', 'each slice', 'each kept short', 'Never paste a task, the ticket or `plan.md`', "only the plan stage's", '`./build.md`']))
      bad.push(f.label + ' lacks: ' + p);
  }
  expect(bad).toEqual([]);
});

it('risk:regression the plan summary has no line cap and no count of lines (D-26)', () => {
  const bad: string[] = [];
  for (const f of rendered('summary')) {
    if (/\b[0-9]+ (?:lines|words|sentences)\b/i.test(f.text)) bad.push(f.label + ' holds a count of lines, words or sentences');
    if (!f.text.includes('no line cap')) bad.push(f.label + ' does not say it has no line cap');
  }
  expect(bad).toEqual([]);
});

it('risk:regression the Rulings taken are one of the six items, so the owner never approves a plan without seeing them (T-15-30)', () => {
  const bad: string[] = [];
  for (const f of rendered('summary')) {
    for (const p of lacks(f.text, ['every Ruling this stage wrote', '`accord/tickets/<id>/ledger.md`', 'say `none` when there is none'])) bad.push(f.label + ' lacks: ' + p);
  }
  expect(bad).toEqual([]);
});

it('risk:regression the other stages end as before: only the plan stage names a summary file (D-27)', () => {
  const bad: string[] = [];
  for (const runtime of RUNTIMES) {
    for (const f of skillTargets(config(runtime))) {
      if (!f.path.includes('/accord/') || f.path.endsWith('/accord/plan.md') || f.path.endsWith('/accord/plan-summary.md')) continue;
      if (f.text.includes('plan-summary.md')) bad.push(runtime + ': ' + f.path + ' names plan-summary.md');
    }
  }
  // the router lists it as a file the plan row loads; nothing else may name it
  expect(bad.filter((b) => !b.endsWith('/accord/SKILL.md names plan-summary.md'))).toEqual([]);
});

it('risk:regression the rendered plan stage stays within 5980 bytes and 120 lines (D-26)', () => {
  const bad: string[] = [];
  for (const f of rendered()) {
    const bytes = new TextEncoder().encode(f.raw).length;
    if (bytes > 5980) bad.push(f.label + ': ' + bytes + ' bytes');
    if (f.raw.split('\n').length > 120) bad.push(f.label + ' is over 120 lines');
  }
  expect(bad).toEqual([]);
});
