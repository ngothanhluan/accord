// Phase 15 15-20 (D-04, SC-4): the critic, which reads the whole ticket once, asks whether the acceptance criteria serve one outcome or
// several that could ship separately. Asserted over the RENDERED agent file; whether the critic applies it is an agent-behaviour check.
import { expect, it } from 'vitest';
import { agentTargets } from '../src/index.js';
import type { AccordConfig } from '../src/index.js';

const config = (): AccordConfig => ({
  accord: '0.1.0',
  profile: 'build',
  tracker: { adapter: 'none' },
  design: { tokens: '' },
  roles: ['ba', 'dev'],
  runtimes: ['claude'],
});

const QUESTION = 'do the acceptance criteria serve one outcome for the person in the Intent, or several outcomes that could ship separately?';
const critic = (): string => agentTargets(config()).find((f) => f.path === '.claude/agents/accord-critic.md')?.text ?? '';
/** The lines of one mode block: from its `Mode` line to the next blank line. */
const block = (text: string, mode: string): string[] => {
  const lines = text.split('\n');
  const start = lines.findIndex((l) => l.startsWith('Mode `' + mode + '`'));
  if (start < 0) return [];
  const end = lines.findIndex((l, i) => i > start && l.trim() === '');
  return lines.slice(start, end < 0 ? lines.length : end);
};
const cohesionLines = (lines: string[]): string[] => lines.filter((l) => l.includes('several outcomes that could ship separately'));

it('risk:regression the approach mode list asks the one-outcome question and proposes an epic for the owner to decide (D-04)', () => {
  const text = critic();
  expect(text.length, 'accord-critic.md is missing from the render output').toBeGreaterThan(0);
  const found = cohesionLines(block(text, 'approach'));
  expect(found).toHaveLength(1);
  const line = found[0] ?? '';
  expect(line).toContain(QUESTION);
  expect(line).toContain('Should');
  expect(line).toContain('proposes an epic');
  expect(line).toContain('the owner decides');
  expect(line).toContain('many scenarios of one feature are one outcome');
});

it('risk:regression plan mode runs the same check only when the approach stage is off, outside the fixed list of seven checks (D-04)', () => {
  const text = critic();
  const found = cohesionLines(text.split('\n').filter((l) => l.startsWith('- In `plan` mode')));
  expect(found).toHaveLength(1);
  const line = found[0] ?? '';
  expect(line).toContain(QUESTION);
  expect(line).toContain('only when `## Approach` is empty because the approach stage is off');
  expect(line).toContain('proposes an epic');
  expect(line).toContain('the owner decides');
  // the fixed plan list stays seven "- Check" lines, mirrored by the planner and addressed by place for older tickets
  const plan = block(text, 'plan');
  expect(cohesionLines(plan)).toEqual([]);
  expect(plan.filter((l) => l.startsWith('- Check'))).toHaveLength(7);
  expect(plan.slice(1)).toHaveLength(7);
});

it('risk:regression the check appears in those two places and nowhere else, and no number of criteria is a signal (D-04)', () => {
  const text = critic();
  expect(text.split('several outcomes that could ship separately').length - 1).toBe(2);
  expect(cohesionLines(block(text, 'diff'))).toEqual([]);
  expect(cohesionLines(block(text, 'split'))).toEqual([]);
  // a count of criteria or scenarios is never offered as the trigger
  const lines = cohesionLines(text.split('\n')).join(' ');
  expect(lines).not.toMatch(/\b(more than|over|at least|above|exceeds?)\s+(\w+\s+)?(criteria|scenarios|acceptance)/i);
  expect(lines).not.toMatch(/\b\d+\s+(criteria|scenarios)/i);
});

it('risk:regression the cohesion check adds no new agent (D-04)', () => {
  const paths = agentTargets(config()).map((f) => f.path);
  expect(paths.filter((p) => /cohesion|outcome/i.test(p))).toEqual([]);
});
