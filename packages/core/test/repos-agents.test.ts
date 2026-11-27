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
