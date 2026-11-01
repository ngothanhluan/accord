// The approach fold: the planner's direction mode, the critic's approach rounds and its Decision checks.
import { expect, it } from 'vitest';
import { agentTargets } from '../src/index.js';
import type { AccordConfig } from '../src/index.js';

const config = (): AccordConfig =>
  ({ accord: '0.1.0', profile: 'build', tracker: { adapter: 'none' }, design: { tokens: '' }, roles: ['ba', 'dev'], runtimes: ['claude'] }) as AccordConfig;
const agent = (role: string): string => agentTargets(config()).find((f) => f.path === `.claude/agents/accord-${role}.md`)?.text ?? '';
const flat = (text: string): string => text.replace(/\s+/g, ' ');

const SEVENTH = "- Check every Decision and every Correction of the ticket: a task that contradicts one is a Must that names the Decision's `D-nn` or quotes the Correction.";
const DIFFCHECK = "- On the changed hunks, check every Decision and every Correction of the ticket: a hunk that contradicts one is a Must that names the Decision's `D-nn` or quotes the Correction.";

it('ac-5 the critic checks every decision and correction in plan mode and in diff mode', () => {
  const critic = agent('critic').split('\n');
  const planner = agent('planner').split('\n');
  expect(critic.join(''), 'critic is empty').not.toBe('');
  expect(planner.join(''), 'planner is empty').not.toBe('');
  const block = (heading: string): string[] => {
    const at = critic.indexOf(heading);
    expect(at, `critic lacks ${heading}`).toBeGreaterThanOrEqual(0);
    const rest = critic.slice(at + 1);
    return rest.slice(0, rest.indexOf(''));
  };
  const plan = block('Mode `plan`:');
  expect(plan).toHaveLength(7);
  for (const l of plan) expect(l.startsWith('- Check'), l).toBe(true);
  expect(plan[6]).toBe(SEVENTH);
  const diff = block('Mode `diff`: you get the paths of `plan.md`, of a file holding `git diff` of `plan.md` since the last round, and of `plan-review.md`.');
  expect(diff).toContain(DIFFCHECK);
  for (const part of [plan[6], DIFFCHECK]) {
    expect(part).toContain('every Decision and every Correction');
    expect(part).toContain('Must');
    expect(part).toContain('`D-nn`');
  }
  expect(flat(critic.join('\n'))).toContain('the first, second, third, fifth and seventh checks');
  const intro = planner.indexOf("Before you reply, run these checks of the critic's plan mode on your plan and fix what fails:");
  expect(intro).toBeGreaterThanOrEqual(0);
  expect(planner.indexOf(SEVENTH), 'planner lacks SEVENTH').toBeGreaterThan(intro);
});
