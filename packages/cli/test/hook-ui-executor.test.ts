// Phase 11 G3 (D-07, 11-ac-8): the PreToolUse dispatch hook holds the session to the executor `accord brief` names: `accord-executor-ui` for a `ui: true` ticket while `ui.build` is set,
// `accord-executor` for every other ticket. The UI executor keeps the fix-round model check the executor has. Both early answers (the launcher's and hook-early.ts) hand the UI executor to the CLI.
import { afterEach, describe, expect, it } from 'vitest';
import { approve, CONFIG, laneTicket, P, PLAN } from '../../../test/helpers/lane.js';
import { cleanup, commitMsg, gitRun, makeLaneRepo, run } from './helpers/repo.js';

const UI_BUILD = 'ui:\n  build: impeccable\n';
const ALLOWED = { code: 0, out: '{}\n', err: '' };

const REFUSE_PLAIN = (id: string): string => `accord: ${id} is ui: true and ui.build is set: dispatch accord-executor-ui, the agent accord brief names`;
const REFUSE_UI = (id: string): string => `accord: ${id} is not a ui ticket with ui.build set: dispatch accord-executor`;

const folders: string[] = [];
afterEach(() => {
  while (folders.length > 0) cleanup(folders.pop() as string);
});

/** A lane M repository whose ticket T-1 is `ui: true` or not, with `ui.build` set or not, on its claim branch (`t/T-1`) or, with `branch` false, on the default branch. */
function repoOf(o: { ui: boolean; build: boolean; branch?: boolean; extra?: Record<string, string> }): string {
  const ticket = laneTicket('T-1').replace('ui: false', o.ui ? 'ui: true' : 'ui: false');
  const files: Record<string, string> = { [P('T-1')]: ticket };
  approve(files, 'T-1');
  const repo = makeLaneRepo({ 'accord/config.yml': CONFIG + (o.build ? UI_BUILD : ''), [P('T-1')]: files[P('T-1')] as string, 'accord/tickets/T-1/plan.md': PLAN, ...o.extra });
  folders.push(repo);
  if (o.branch !== false) gitRun(repo, 'checkout', '-q', '-b', 't/T-1');
  commitMsg(repo, 'fixture');
  return repo;
}

const dispatch = (repo: string, agent: string, o: Record<string, unknown> = {}) =>
  run(['hook', 'pre-tool-use'], repo, {}, JSON.stringify({ session_id: 's-1', cwd: repo, hook_event_name: 'PreToolUse', tool_name: 'Agent', tool_input: { subagent_type: agent, description: 'build task 1', prompt: 'Brief: b.md', ...o } }));

/** The permission decision and reason of a hook answer; an allowed call has neither. */
const decision = (out: string): { decision?: string; reason?: string } => {
  const h = JSON.parse(out).hookSpecificOutput as { permissionDecision?: string; permissionDecisionReason?: string } | undefined;
  return { decision: h?.permissionDecision, reason: h?.permissionDecisionReason };
};

describe('the dispatch hook refuses the wrong executor for the active ticket (11-ac-8, D-07)', () => {
  it('risk:security the hook refuses the plain executor for a ui ticket while ui.build is set, and names the agent to dispatch (11-ac-8, D-07)', async () => {
    const repo = repoOf({ ui: true, build: true });
    const r = await dispatch(repo, 'accord-executor');
    expect(r.code).toBe(0);
    expect(r.err).toBe('');
    expect(decision(r.out)).toEqual({ decision: 'deny', reason: REFUSE_PLAIN('T-1') });
    // the Task tool name is held to the same rule
    const task = await run(['hook', 'pre-tool-use'], repo, {}, JSON.stringify({ cwd: repo, tool_name: 'Task', tool_input: { subagent_type: 'accord-executor' } }));
    expect(decision(task.out).reason).toBe(REFUSE_PLAIN('T-1'));
    expect(await dispatch(repo, 'accord-executor-ui')).toEqual(ALLOWED);
  }, 120_000);

  it('risk:security the hook refuses the UI executor for a ticket that is not ui or while ui.build is unset, past both early answers (11-ac-8, D-07)', async () => {
    for (const o of [
      { ui: false, build: true },
      { ui: false, build: false },
      { ui: true, build: false },
    ]) {
      const repo = repoOf(o);
      const r = await dispatch(repo, 'accord-executor-ui');
      expect(r.code, JSON.stringify(o)).toBe(0);
      expect(decision(r.out), JSON.stringify(o)).toEqual({ decision: 'deny', reason: REFUSE_UI('T-1') });
      // the plain executor is the right one for each of these
      expect(await dispatch(repo, 'accord-executor'), JSON.stringify(o)).toEqual(ALLOWED);
    }
  }, 120_000);

  it('risk:security the hook lets both executors through with no active ticket, other agents always, and any unreadable repository (11-ac-8, D-07)', async () => {
    const none = repoOf({ ui: true, build: true, branch: false });
    expect(await dispatch(none, 'accord-executor')).toEqual(ALLOWED);
    expect(await dispatch(none, 'accord-executor-ui')).toEqual(ALLOWED);

    const repo = repoOf({ ui: true, build: true });
    expect(await dispatch(repo, 'accord-reviewer')).toEqual(ALLOWED);
    expect(await dispatch(repo, 'Explore')).toEqual(ALLOWED);

    // a pin that does not match the running version cannot be read as a snapshot: fail open, one stderr line
    const { readFileSync, writeFileSync } = await import('node:fs');
    const config = `${repo}/accord/config.yml`;
    writeFileSync(config, readFileSync(config, 'utf8').replace(/accord: "[^"]*"/, 'accord: "0.0.1"'));
    for (const agent of ['accord-executor', 'accord-executor-ui']) {
      const r = await dispatch(repo, agent);
      expect(r.code).toBe(0);
      expect(r.out).toBe('{}\n');
      expect(r.err).toMatch(/; allowed\n$/);
    }
  }, 120_000);
});
