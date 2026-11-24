// Phase 08.9 D-05: a planned task's verify names only the test files the task writes or extends, because a long
// existing regression file in a task's verify broke the 180 s time box in Phase 08.2. The rule is asserted over the
// RENDERED text of the plan stage in every runtime and the rendered planner agent, not the source files.
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
/** Every render of the plan SKILL.md under a runtime: one per skill directory the runtime loads. */
const planFiles = (runtime: AccordConfig['runtimes'][number]) => {
  const wanted = new Set(skillDirs(config(runtime)).map((dir) => stagePath('plan', undefined, dir)));
  return skillTargets(config(runtime)).filter((f) => wanted.has(f.path));
};
/** The phrases a text lacks, so a failing case names each one. */
const lacks = (text: string, parts: readonly string[]): string[] => parts.filter((p) => !text.includes(p));

const STAGE_PHRASES = ['`verify:` and `files:` name only those the task writes or extends', 'a long existing regression file runs at wave end and in CI'];
const PLANNER_PHRASES = [
  'never a long existing regression file',
  'those run at wave end and in CI',
  'A source path on `files:` still brings the tests that import it',
];

// Phase 08.9 D-05: the plan stage and the planner keep a task's test files to the ones it writes or extends.
it("risk:regression the plan stage and the planner keep a task's test files to the ones it writes or extends (D-05)", () => {
  const bad: string[] = [];
  for (const runtime of RUNTIMES) {
    const files = planFiles(runtime);
    if (files.length === 0) bad.push(`${runtime}: no rendered plan stage`);
    for (const file of files) {
      for (const phrase of lacks(flat(file.text), STAGE_PHRASES)) bad.push(`${runtime} ${file.path}: lacks "${phrase}"`);
    }
  }
  const planner = agentTargets(config('claude')).find((f) => f.path === '.claude/agents/accord-planner.md');
  if (!planner) bad.push('claude: no rendered planner agent');
  else for (const phrase of lacks(flat(planner.text), PLANNER_PHRASES)) bad.push(`planner ${planner.path}: lacks "${phrase}"`);
  expect(bad).toEqual([]);
});
