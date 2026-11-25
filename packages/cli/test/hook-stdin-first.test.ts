// Phase 08.9.2 Ruling-structural: a hook case that needs no repository is answered from stdin before any load, so it starts no git process.
// RESEARCH F-6 measured 3.1 s for an Explore Agent call to `hook pre-tool-use` and 3.3 s for `hook subagent-start`, all of it preflight.
import { afterEach, expect, it, vi } from 'vitest';
import { subagentContext } from '@accord-dev/accord-core';
import { spawnLog } from './helpers/git-spawns.js';
import { cleanup, makeLaneRepo, run } from './helpers/repo.js';
import { cliRuleset } from '../src/load/product.js';

vi.mock('node:child_process', async (orig) => (await import('./helpers/git-spawns.js')).wrapChildProcess(await orig<typeof import('node:child_process')>()));

const dirs: string[] = [];
afterEach(() => {
  while (dirs.length > 0) cleanup(dirs.pop() as string);
  spawnLog.on = false;
  spawnLog.after = undefined;
  spawnLog.fail = undefined;
  spawnLog.calls = [];
});

/** One hook call on a lane repo with git counting on: the result and the git argument arrays it started. */
async function hookCall(event: string, stdin: Record<string, unknown>): Promise<{ code: number; out: string; err: string; git: string[][] }> {
  const repo = makeLaneRepo();
  dirs.push(repo);
  spawnLog.calls = [];
  spawnLog.on = true;
  try {
    const r = await run(['hook', event], repo, {}, JSON.stringify({ cwd: repo, ...stdin }));
    return { ...r, git: spawnLog.calls.map((c) => [...c]) };
  } finally {
    spawnLog.on = false;
  }
}

const SUBAGENT_NO_EPIC = JSON.stringify({ hookSpecificOutput: { hookEventName: 'SubagentStart', additionalContext: subagentContext(cliRuleset(), undefined) } }) + '\n';

// Phase 08.9.2 Ruling-structural, Ruling-quiet-hooks: pre-tool-use for anything but an executor dispatch, subagent-start for an agent outside EPIC_ROLES and prompt-expansion for text that is no `continue <id>` or `pick-up <id>` start no git process.
it('risk:resource stdin-only hook answers start no git process (Ruling-structural)', async () => {
  for (const call of [
    { tool_name: 'Agent', tool_input: { subagent_type: 'Explore' } },
    { tool_name: 'Task', tool_input: { subagent_type: 'Explore' } },
    { tool_name: 'Agent' },
    { tool_name: 'Read', tool_input: { file_path: 'src/a.ts' } },
  ]) {
    const r = await hookCall('pre-tool-use', call);
    expect(r.out, JSON.stringify(call)).toBe('{}\n');
    expect(r.code).toBe(0);
    expect(r.git, JSON.stringify(call)).toEqual([]);
  }

  for (const agent of ['accord-executor', 'accord-verifier']) {
    const r = await hookCall('subagent-start', { agent_type: agent });
    expect(r.out, agent).toBe(SUBAGENT_NO_EPIC);
    expect(r.git, agent).toEqual([]);
  }

  for (const args of ['', 'queue an idea', 'what is left to do']) {
    const r = await hookCall('prompt-expansion', { session_id: 's-1', command_name: 'accord', command_args: args });
    expect(r.out, args).toBe('{}\n');
    expect(r.err).toBe('');
    expect(r.git, args).toEqual([]);
  }
  const other = await hookCall('prompt-expansion', { session_id: 's-1', command_name: 'accord-upgrade', command_args: 'continue T-1' });
  expect(other.out).toBe('{}\n');
  expect(other.git).toEqual([]);

  const noSession = await hookCall('prompt-expansion', { command_name: 'accord', command_args: 'continue T-1' });
  expect(noSession.out).toBe('{}\n');
  expect(noSession.err).toBe('accord hook prompt-expansion: no session_id on stdin; allowed\n');
  expect(noSession.git).toEqual([]);
});

// Phase 08.9.2 Ruling-quiet-hooks (T-08.9.2-13): an executor dispatch (model guard), an epic role (epic block) and a typed continue still load the repository.
it('risk:regression an executor dispatch and an epic role still take the full path (Ruling-quiet-hooks)', async () => {
  const dispatch = await hookCall('pre-tool-use', { tool_name: 'Agent', tool_input: { subagent_type: 'accord-executor' } });
  expect(dispatch.out).toBe('{}\n');
  expect(dispatch.git.length).toBeGreaterThan(0);

  const scout = await hookCall('subagent-start', { agent_type: 'accord-scout' });
  expect(scout.out).toBe(SUBAGENT_NO_EPIC); // on no ticket branch there is no epic block
  expect(scout.git.length).toBeGreaterThan(0);

  const typed = await hookCall('prompt-expansion', { session_id: 's-1', command_name: 'accord', command_args: 'continue T-1' });
  expect(typed.out).toBe('{}\n'); // a session that works no ticket is not blocked
  expect(typed.git.length).toBeGreaterThan(0);
});

// Phase 08.9.2 D-07: session start keeps its rules, anchor, foreground fetch and clean; it has no early path.
it('risk:regression session start keeps its fetch and clean in the foreground (D-07)', async () => {
  const r = await hookCall('session-start', { session_id: 's-1', source: 'startup' });
  expect(r.code).toBe(0);
  expect(r.out.startsWith('# accord rules\n')).toBe(true);
  expect(r.git.length).toBeGreaterThan(0);
});
