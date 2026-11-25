// Phase 15 plan 13 (D-03, D-09, D-11, SC-2): the planner cuts slices by the review budget under every review mode, and the plan stage asks the owner on more than three.
// Asserted over the RENDERED text of every tool a runtime loads (skillTargets and agentTargets), not the source files.
import { expect, it } from 'vitest';
import { agentTargets, skillDirs, skillTargets } from '../src/index.js';
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

/** Every rendered file of the plan stage (`child` undefined: the stage file), one per skill directory a runtime loads. */
function rendered(child?: string): Array<{ label: string; text: string }> {
  return RUNTIMES.flatMap((runtime) => {
    const targets = skillTargets(config(runtime));
    return skillDirs(config(runtime)).map((dir) => {
      const path = stagePath('plan', child, dir);
      return { label: `${runtime}: ${path}`, text: flat(targets.find((t) => t.path === path)?.text ?? '') };
    });
  });
}

const planners = (): Array<{ label: string; text: string }> =>
  RUNTIMES.flatMap((runtime) =>
    agentTargets(config(runtime))
      .filter((f) => f.path.endsWith('/accord-planner.md'))
      .map((f) => ({ label: `${runtime}: ${f.path}`, text: flat(f.text) })),
  );

it('risk:regression plan.md step 3 is one pointer to plan-slices.md and no longer a prose step for review: human only (D-09)', () => {
  const bad: string[] = [];
  for (const f of rendered()) {
    if (f.text === '') {
      bad.push(f.label + ' is missing');
      continue;
    }
    const step3 = f.text.slice(f.text.indexOf('3. **Slices.**'), f.text.indexOf('4. **Gate.**'));
    if (!step3.includes('./plan-slices.md')) bad.push(f.label + ' step 3 names no ./plan-slices.md');
    if (step3.includes('review: human')) bad.push(f.label + ' step 3 still holds review: human');
    if (f.text.includes('it is one branch, no slices')) bad.push(f.label + ' still says outcome is one branch, no slices');
    if (f.text.split('./plan-slices.md').length !== 2) bad.push(f.label + ' names ./plan-slices.md other than once');
  }
  expect(bad).toEqual([]);
});

it('risk:regression slices are cut only past review.slice_lines, under every review mode, in the section format gate plan reads (D-09)', () => {
  const bad: string[] = [];
  for (const f of rendered('slices')) {
    if (f.text === '') {
      bad.push(f.label + ' is missing');
      continue;
    }
    for (const p of lacks(f.text, [
      'only when its expected size is over one review',
      'the sum of its slice estimates',
      'more than `review.slice_lines` in `accord/config.yml` (default 1000)',
      'every line a reviewer reads, code, tests, docs and skills, added plus deleted',
      'under every `review:` mode, `outcome` included',
      'A plan within the budget has no `## Slice` section',
      '## Slice 1: <title>',
      'tasks: 1, 2',
      'covers: @ac-1, D-02',
      'estimate: code 300, test 600, docs 150',
      'Every slice delivers at least one criterion',
      'Every criterion of the ticket is delivered by some slice',
      'a task never follows (`after:`) a task of a later slice, because slices merge in order',
      '`accord gate plan <id>` checks all of this',
    ]))
      bad.push(f.label + ' lacks: ' + p);
  }
  expect(bad).toEqual([]);
});

it('risk:regression the planner agent cuts slices by review.slice_lines under every review mode and no longer by review mode human (D-09)', () => {
  const bad: string[] = [];
  const files = planners();
  if (files.length === 0) bad.push('no planner is rendered');
  for (const f of files) {
    for (const p of lacks(f.text, [
      '`review.slice_lines`',
      'under every review mode, `outcome` included',
      '`## Slice <n>: <title>`',
      '`tasks: 1, 2`',
      '`covers: @ac-1, D-02`',
      '`estimate: code 300, test 600, docs 150`',
      'Within the budget, write no slice section',
    ]))
      bad.push(f.label + ' lacks: ' + p);
    if (f.text.includes('Under review mode `human`')) bad.push(f.label + ' still says Under review mode `human`');
    if (f.text.includes('Under `outcome`, one branch and no slices')) bad.push(f.label + ' still says outcome has no slices');
  }
  expect(bad).toEqual([]);
});

it('risk:regression each slice leaves the default branch working with no feature flag, and the tasks stay in one slice when no such cut exists (D-11)', () => {
  const bad: string[] = [];
  for (const f of [...rendered('slices'), ...planners()]) {
    for (const p of lacks(f.text, ['leaves the default branch working once', 'with no feature flag', 'the tasks stay in one slice'])) bad.push(f.label + ' lacks: ' + p);
  }
  expect(bad).toEqual([]);
});

it('risk:regression on gate.slice-many the session asks the owner whether to make the ticket an epic, and gate.slice-large stops nothing (D-03)', () => {
  const bad: string[] = [];
  for (const f of rendered('slices')) {
    for (const p of lacks(f.text, [
      '`gate.slice-many`',
      'more than three slices',
      'Ask the owner as `./ask.md` says whether to make the ticket an epic',
      'the owner decides',
      '`gate.slice-large`',
      'Read it; it stops nothing',
    ]))
      bad.push(f.label + ' lacks: ' + p);
  }
  expect(bad).toEqual([]);
});

it('risk:regression the rendered plan stage stays within 5980 bytes and 120 lines after the slice pointer (D-09)', () => {
  const bad: string[] = [];
  for (const runtime of RUNTIMES) {
    const targets = skillTargets(config(runtime));
    for (const dir of skillDirs(config(runtime))) {
      const raw = targets.find((t) => t.path === stagePath('plan', undefined, dir))?.text ?? '';
      const bytes = new TextEncoder().encode(raw).length;
      if (raw === '' || bytes > 5980) bad.push(`${runtime}: ${dir} plan stage is ${bytes} bytes`);
      if (raw.split('\n').length > 120) bad.push(`${runtime}: ${dir} plan stage is over 120 lines`);
    }
  }
  expect(bad).toEqual([]);
});
