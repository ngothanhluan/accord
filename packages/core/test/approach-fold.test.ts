// The approach fold: the planner's direction mode, the critic's approach rounds and its Decision checks.
import { expect, it } from 'vitest';
import { agentTargets, skillTargets } from '../src/index.js';
import type { AccordConfig } from '../src/index.js';

const config = (): AccordConfig =>
  ({ accord: '0.1.0', profile: 'build', tracker: { adapter: 'none' }, design: { tokens: '' }, roles: ['ba', 'dev'], runtimes: ['claude'] }) as AccordConfig;
const agent = (role: string): string => agentTargets(config()).find((f) => f.path === `.claude/agents/accord-${role}.md`)?.text ?? '';
const skillFile = (dir: string, file: string): string => skillTargets(config()).find((f) => f.path === `.claude/skills/${dir}/${file}`)?.text ?? '';
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

const G = 'Write the ladder Ruling of `./critique.md` into `accord/tickets/<id>/ledger.md`. When a new session or a revision needs the planner again, dispatch it in `direction` mode with the name of the option `## Approach` names: it keeps that option, and nobody picks again.';
const C = "From round 2, even after a Must, the round is `diff`: write `git diff <the previous round's commit> -- accord/tickets/<id>.md`, which holds the amended `## Approach`, into a file outside the working tree, and dispatch one `accord-critic` in a fresh context, mode `approach`, with the paths of the ticket, that file, and `approach-review.md`, never the planner's report.";
const D = 'Mark `fixed` each finding the critic lists after `fixed:`, and `withdrawn` each one it lists after `withdrawn:`.';
const E = 'A Nice, a `defer to plan` one included, is marked `deferred`, goes to the ledger under `## Deferred`, and never to the planner.';
const H = "An option is ruled out when a `## Closed <option>: ruled out by <round>.<n>` heading after the last `: the owner's no` heading names it.";
const J = 'The option under critique is always the one `## Approach` names: a resumed session or a revision keeps it, and only step 3 below or the owner moves to another.';
const M = "No part of the ladder Ruling names a file or a path: each option's description and the reason after `Recommended because` are plain words, never a `path:line`, because a Ruling that names a path stands as the reason for any fix commit to that path; the impact list stays in `## Approach`.";
const N = "When another option of the ladder Ruling takes the place of the one `## Approach` names and this session no longer holds the planner's report, dispatch `accord-planner` in its `direction` mode with the ticket path, that option's name and its entry of the ladder Ruling, and write the draft it returns into `## Approach` as step 2 of the skill says.";
const LADDER = "Ruling: the approach ladder is 1. <option>: <what it does>; 2. <option>: <what it does>; 3. <option>: <what it does>; <option> is Recommended because <the planner's line> — kept so a resumed or revised round critiques the option ## Approach names and nobody picks again — a ruled-out option comes back";

const holds = (text: string, parts: string[]): void => {
  expect(text, 'rendered text is empty').not.toBe('');
  expect(parts.filter((p) => !text.includes(flat(p)))).toEqual([]);
};

it('ac-2 the planner direction pass returns the approach draft and writes no file', () => {
  const planner = flat(agent('planner'));
  holds(planner, ['`direction` mode', 'you write no file, neither `plan.md` nor the ticket', 'the impact list', '`path:line`', 'two or three options, the lightest that works first', 'first rung of the ladder', 'three failure scenarios in total', 'how it is undone', 'the `## Approach` draft the main session writes into the ticket']);
  const skill = flat(skillFile('accord-approach', 'SKILL.md'));
  const from = skill.indexOf('2. **Options.**');
  const to = skill.indexOf('3. **Critique.**');
  expect(from).toBeGreaterThanOrEqual(0);
  expect(to).toBeGreaterThan(from);
  holds(skill.slice(from, to), ['Dispatch `accord-planner` in its `direction` mode', 'It writes no file', 'three failure scenarios in total', "Write into `## Approach` only the chosen option's name, what it does, and the impact list"]);
  expect(skill).not.toContain('accord-architect');
});

it('ac-3 approach critique defers detail to the plan and reads only the approach diff from round 2', () => {
  const critic = flat(agent('critic'));
  holds(critic, ['is marked `defer to plan` and rated Nice, never a Must or a Should', 'read `## Approach` only at the changed lines, never in full', 'From round 2 of `approach` mode you also get the paths of a file holding `git diff` of the ticket since the previous round', '`accord/tickets/<id>/approach-review.md`', 'raise new findings only on the changed lines', 'or `approach-review.md` in `approach` mode', '`fixed: <round>.<n>, <round>.<n>`', '`withdrawn: <round>.<n>, <round>.<n>`']);
  const loop = flat(skillFile('accord-approach', 'critique.md'));
  holds(loop, [C, D, E, '`accord round <id> --approach`']);
  holds(flat(skillFile('accord-approach', 'SKILL.md')), ['./critique.md', '`accord round <id> --approach`']);
});

it('risk:complex-branching a resumed or revised approach round keeps its option and skips every ruled-out one', () => {
  holds(flat(agent('planner')), ['you keep that option and its name, revise only it, and pick no other', 'that option alone with no `Recommended` line', 'draft the named one from that entry and the code']);
  holds(flat(skillFile('accord-approach', 'SKILL.md')), [G, 'the first option of the ladder Ruling that is not yet ruled out', '`## Closed <option>: the owner picked <other option>`', "`## Closed <option>: the owner's no`"]);
  holds(flat(skillFile('accord-approach', 'critique.md')), [LADDER, H, J, M, N, '`## Closed <option>: ruled out by <round>.<n>`', 'the name of the option `## Approach` names']);
});

it('risk:data-loss every approach commit carries the ledger when it changed, so the pushed branch holds the deferred findings', () => {
  const skill = flat(skillFile('accord-approach', 'SKILL.md'));
  holds(skill, ['Commit `accord/tickets/<id>.md` and `accord/tickets/<id>/approach-review.md`, with the ledger if it changed.', 'Then commit the ticket, with `approved_hash:` and `ac_hash:` in it, and the ledger if it changed.']);
  holds(flat(skillFile('accord-approach', 'critique.md')), ['commit both files, with the ledger if it changed,', 'Otherwise commit `accord/tickets/<id>.md` and `approach-review.md`, with the ledger if it changed, with the subject']);
});
