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

it('risk:regression the scout cites a file of another repository as <name>:<path>:<line> (D-05)', () => {
  expect(rendered('scout').length).toBeGreaterThan(0);
  expect(lacking('scout', ['`<name>:<path>:<line>`', 'a key of `repos:`'])).toEqual([]);
});

it('risk:regression the reviewer judges the ## Repository <name> sections of its package as part of the change (D-05)', () => {
  expect(rendered('reviewer').length).toBeGreaterThan(0);
  expect(lacking('reviewer', ['`## Repository <name>` sections', 'part of the change'])).toEqual([]);
});

// D-04, T-08.9.3-37: no agent runs git outside its Work dir. The executor's Work-dir sentence is the one `git -C` of the agent files, and none says `git clone`.
it('risk:security across every rendered agent file `git -C` occurs once, in the executor, and `git clone` never (D-04)', () => {
  const files = RUNTIMES.flatMap((runtime) => agentTargets(config(runtime)).map((f) => ({ runtime, path: f.path, text: f.text })));
  expect(files.length).toBeGreaterThan(0);
  const count = (needle: string, text: string): number => text.split(needle).length - 1;
  for (const runtime of RUNTIMES) {
    const own = files.filter((f) => f.runtime === runtime);
    expect(own.filter((f) => count('git -C', f.text) > 0).map((f) => roleOf(f.path) + ':' + count('git -C', f.text))).toEqual(own.length === 0 ? [] : ['executor:1']);
    expect(own.filter((f) => f.text.includes('git clone')).map((f) => f.path)).toEqual([]);
  }
});
