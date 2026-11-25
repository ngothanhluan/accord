// Phase 08.9.2 review WR-05: while the person's off marker exists the write guard of accord/tickets/<id>/verification.md keeps answering (the marker is per clone, not per person or session, and the
// guard is the one hook that holds the core value: nothing is done without an independent verifier), in the CLI and in the launcher; every other hook stays silent. The line a session start
// prints says an agent runs the switch only when the person asks.
import { mkdtempSync } from 'node:fs';
import { platform, tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { afterEach, expect, it, vi } from 'vitest';
import { OFF_LINE } from '../src/commands/off.js';
import { spawnLog } from './helpers/git-spawns.js';
import { cleanup, commitAll, makeLaneRepo, run } from './helpers/repo.js';

vi.mock('node:child_process', async (orig) => (await import('./helpers/git-spawns.js')).wrapChildProcess(await orig<typeof import('node:child_process')>()));

const dirs: string[] = [];
afterEach(() => {
  while (dirs.length > 0) cleanup(dirs.pop() as string);
  spawnLog.on = false;
  spawnLog.calls = [];
});

function offRepo(): Promise<string> {
  const repo = makeLaneRepo();
  dirs.push(repo);
  commitAll(repo);
  return run(['off'], repo).then((r) => {
    expect(r.code).toBe(0);
    return repo;
  });
}

const VERIFICATION = 'accord/tickets/T-1/verification.md';
const write = (cwd: string, file: string, more: Record<string, unknown> = {}): string => JSON.stringify({ cwd, tool_name: 'Write', tool_input: { file_path: file, content: 'x' }, ...more });

type Launch = (io: Record<string, unknown>) => number;
const launcherHref = pathToFileURL(fileURLToPath(new URL('../../core/launcher/accord.mjs', import.meta.url))).href;

/** One launcher call with the real fs, the given stdin and a spawn stub; the launcher file is said to sit in `<checkout>/.claude/`. */
async function launcherCall(checkout: string, stdin: string): Promise<{ code: number; out: string; spawned: number }> {
  const cache = mkdtempSync(join(tmpdir(), 'accord-off-guard-cache-'));
  dirs.push(cache);
  const { launch } = (await import(/* @vite-ignore */ launcherHref)) as { launch: Launch };
  const fs = await import('node:fs');
  let spawned = 0;
  let out = '';
  const code = launch({
    argv: ['1.2.3', 'hook', 'pre-tool-use'],
    env: { LOCALAPPDATA: cache, XDG_CACHE_HOME: cache },
    platform: platform(),
    homedir: cache,
    execPath: process.execPath,
    pid: process.pid,
    launcherPath: join(checkout, '.claude', 'accord.mjs'),
    readStdin: () => stdin,
    fs: { existsSync: fs.existsSync, mkdirSync: fs.mkdirSync, readdirSync: fs.readdirSync, readFileSync: fs.readFileSync, renameSync: fs.renameSync, rmSync: fs.rmSync, statSync: fs.statSync },
    spawnSync: () => {
      spawned += 1;
      return { status: 1, stdout: '', stderr: 'stub: no install' };
    },
    now: Date.now,
    sleep: () => undefined,
    stdout: { write: (t: string) => (out += t) },
    stderr: { write: () => undefined },
  });
  return { code, out, spawned };
}

// Phase 08.9.2 review WR-05: the CLI denies a verification.md write of the main session or another agent while accord is off, allows the verifier's, and stays silent for everything else.
it('risk:security the verification write guard keeps answering while accord is off (WR-05)', async () => {
  const repo = await offRepo();
  const call = async (stdin: string): Promise<{ code: number; out: string; err: string; git: number }> => {
    spawnLog.calls = [];
    spawnLog.on = true;
    try {
      const r = await run(['hook', 'pre-tool-use'], repo, {}, stdin);
      return { ...r, git: spawnLog.calls.length };
    } finally {
      spawnLog.on = false;
    }
  };
  for (const tool of ['Write', 'Edit', 'MultiEdit']) {
    const denied = await call(JSON.stringify({ cwd: repo, tool_name: tool, tool_input: { file_path: join(repo, VERIFICATION) } }));
    expect(denied.code, tool).toBe(0);
    expect(JSON.parse(denied.out).hookSpecificOutput.permissionDecision, `${tool} of the main session is denied while off`).toBe('deny');
    expect(denied.git, `${tool} starts no git process`).toBe(0);
  }
  const other = await call(write(repo, VERIFICATION, { agent_type: 'accord-executor' }));
  expect(JSON.parse(other.out).hookSpecificOutput.permissionDecision, 'another agent is denied').toBe('deny');
  const verifier = await call(write(repo, VERIFICATION, { agent_type: 'accord-verifier' }));
  expect({ out: verifier.out, err: verifier.err }, 'the verifier writes it, in silence').toEqual({ out: '', err: '' });
  const elsewhere = await call(write(repo, 'src/export.ts'));
  expect({ out: elsewhere.out, err: elsewhere.err }, 'a write to any other file is silent').toEqual({ out: '', err: '' });
  const dispatch = await call(JSON.stringify({ cwd: repo, tool_name: 'Agent', tool_input: { subagent_type: 'accord-executor' } }));
  expect({ out: dispatch.out, err: dispatch.err }, 'the executor model guard is off with the rest').toEqual({ out: '', err: '' });
});

// Phase 08.9.2 review WR-05: the launcher hands exactly a verification.md write to the CLI while off, with no other process for any other call.
it('risk:security the launcher hands a verification write to the CLI while accord is off and nothing else (WR-05)', async () => {
  const repo = await offRepo();
  const handed = await launcherCall(repo, write(repo, VERIFICATION));
  expect(handed.spawned, 'a verification.md write reaches the CLI').toBe(1);
  const edited = await launcherCall(repo, JSON.stringify({ cwd: repo, tool_name: 'Edit', tool_input: { file_path: VERIFICATION.replace(/\//g, '\\') } }));
  expect(edited.spawned, 'a backslash path too').toBe(1);
  for (const stdin of [write(repo, 'src/export.ts'), JSON.stringify({ cwd: repo, tool_name: 'Agent', tool_input: { subagent_type: 'accord-executor' } }), 'not json', '']) {
    expect(await launcherCall(repo, stdin), JSON.stringify(stdin)).toEqual({ code: 0, out: '', spawned: 0 });
  }
});

// Phase 08.9.2 review WR-05: the session start line gives the switch to the person and tells an agent to run it only when asked.
it('risk:security the off line tells an agent to run the switch only when the person asks (WR-05)', () => {
  expect(OFF_LINE).toContain('node .claude/accord.mjs off');
  expect(OFF_LINE).toContain('node .claude/accord.mjs on');
  expect(OFF_LINE).toMatch(/an agent runs (it|either|them) only when the person asks/);
});
