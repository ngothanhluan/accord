// Phase 08.9.3 plan 14 (D-04 to D-10, D-12, D-14): the agents carry another repository's part of a ticket through the files the CLI writes.
// Asserted over the RENDERED agent files of every runtime that installs agents (agentTargets), as agents.test.ts does.
import { expect, it } from 'vitest';
import { agentTargets } from '../src/index.js';
import type { AccordConfig } from '../src/index.js';

const RUNTIMES: AccordConfig['runtimes'] = ['claude', 'codex', 'cursor', 'copilot'];
const config = (runtime: AccordConfig['runtimes'][number]): AccordConfig =>
  ({ accord: '0.1.0', profile: 'build', tracker: { adapter: 'none' }, design: { tokens: '' }, roles: ['ba', 'dev'], runtimes: [runtime] }) as AccordConfig;

const flat = (text: string): string => text.replace(/\s+/g, ' ');
const roleOf = (path: string): string => path.replace('.claude/agents/accord-', '').replace('.md', '');

/** Every rendered file of `role` in every runtime that installs agents, whitespace flattened. Today only claude installs any. */
function rendered(role: string): { label: string; text: string }[] {
  return RUNTIMES.flatMap((runtime) =>
    agentTargets(config(runtime))
      .filter((f) => roleOf(f.path) === role)
      .map((f) => ({ label: runtime + ' ' + f.path, text: flat(f.text) })),
  );
}

/** The phrases of `parts` the rendered `role` files lack, over every runtime. */
function lacking(role: string, parts: readonly string[]): string[] {
  return rendered(role).flatMap((f) => parts.filter((p) => !f.text.includes(p)).map((p) => f.label + ' lacks ' + p));
}

it('risk:regression the verifier copies each record: line of accord repos status into ## Repository <name>, labels starting their line (D-07)', () => {
  expect(rendered('verifier').length).toBeGreaterThan(0);
  expect(
    lacking('verifier', ['## Repository <name>', '`record:` line of `accord repos status <id>`', 'verbatim', 'labels beginning their line']),
  ).toEqual([]);
});

it('risk:regression the verifier writes Suite: passed or Suite: failed from the run its caller reports, and nothing it was not given (D-06, D-12)', () => {
  expect(rendered('verifier').length).toBeGreaterThan(0);
  expect(
    lacking('verifier', ['`Suite: passed <command>`', '`Suite: failed <command>`', 'from the run your caller reports', 'Write nothing it did not give you']),
  ).toEqual([]);
});

it('risk:security no verifier line names git in another folder or a clone, and its read-only git rule stays (D-04)', () => {
  const bad = rendered('verifier').flatMap((f) =>
    ['git -C', 'git clone'].filter((p) => f.text.includes(p)).map((p) => f.label + ' holds ' + p),
  );
  expect(bad).toEqual([]);
  expect(lacking('verifier', ['run `git` only to read'])).toEqual([]);
});

it('risk:regression the planner writes another repository path as <name>:<path> checked at baseline_<name>, and reads its tracked files from the listing its caller names (D-05, D-08)', () => {
  expect(rendered('planner').length).toBeGreaterThan(0);
  expect(
    lacking('planner', ['`<name>:<path>`', '`baseline_<name>`', 'the listing file your caller names', 'never the clone']),
  ).toEqual([]);
});

it('risk:regression the planner keeps each task and each slice in one repository, gives a slice of another repository repo: <name>, and orders the slices with this repository last (D-09, D-14)', () => {
  expect(rendered('planner').length).toBeGreaterThan(0);
  expect(
    lacking('planner', ['`repo: <name>`', 'one repository', 'deploy order', "this repository's slice last"]),
  ).toEqual([]);
});

// The executor's Work-dir sentence as it stood before plan 08.9.3-14; the new sentence follows it and changes none of it.
const WORK_DIR_RULE =
  "Your brief's `Work dir:` names the folder you work in: run every command there as `cd <dir> && …` or `git -C <dir> …` in one command, give every file as an absolute path under it, and commit there; its `Report file:` lies under it too. You never merge, rebase or push. When your tool refuses a write, commit what you changed and return `BLOCKED: permission <path>`. A brief with no `Work dir:` line leaves you in the folder you were started in.";

it("risk:regression the executor's Work dir may be another repository's worktree and it works only there; its Work-dir sentence is as before (D-10, D-04)", () => {
  expect(rendered('executor').length).toBeGreaterThan(0);
  expect(lacking('executor', [WORK_DIR_RULE, "another repository's worktree", 'work only there'])).toEqual([]);
});
