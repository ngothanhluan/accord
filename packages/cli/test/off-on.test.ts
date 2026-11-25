// Phase 08.9.2 D-03, L-01: `accord off` is a personal switch. It writes a marker in the git common folder and the panel flag in the checkout's local settings,
// and every accord hook then answers nothing, through the launcher and through the CLI, with no process started, in the checkout and in every linked worktree.
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { afterEach, expect, it, vi } from 'vitest';
import { spawnLog } from './helpers/git-spawns.js';
import { cleanup, commitAll, gitRun, makeLaneRepo, run } from './helpers/repo.js';

vi.mock('node:child_process', async (orig) => (await import('./helpers/git-spawns.js')).wrapChildProcess(await orig<typeof import('node:child_process')>()));

const dirs: string[] = [];
afterEach(() => {
  while (dirs.length > 0) cleanup(dirs.pop() as string);
  spawnLog.on = false;
  spawnLog.after = undefined;
  spawnLog.fail = undefined;
  spawnLog.calls = [];
});

const PANEL = 'accord-panel@accord';
const read = (file: string): string => readFileSync(file, 'utf8');

/** A sandbox with its single commit, so a linked worktree can be added to it. */
function committedRepo(): string {
  const repo = makeLaneRepo();
  dirs.push(repo);
  commitAll(repo);
  return repo;
}

/** A linked worktree of `repo` in its own temporary folder. */
function linkedWorktree(repo: string, branch = 'linked'): string {
  const parent = mkdtempSync(join(tmpdir(), 'accord-cli-wt-'));
  dirs.push(parent);
  const wt = join(parent, 'wt');
  gitRun(repo, 'worktree', 'add', '-q', '-b', branch, wt);
  return wt;
}

/** One stdin per hook event, each a case that takes the full path (the repository is read) while accord is on. */
function hookCalls(cwd: string): Array<{ event: string; stdin: Record<string, unknown> }> {
  return [
    { event: 'session-start', stdin: { cwd, session_id: 's-1', source: 'startup' } },
    { event: 'session-resume', stdin: { cwd, session_id: 's-1', source: 'resume' } },
    { event: 'pre-tool-use', stdin: { cwd, tool_name: 'Agent', tool_input: { subagent_type: 'accord-executor' } } },
    { event: 'subagent-start', stdin: { cwd, agent_type: 'accord-scout' } },
    { event: 'prompt-expansion', stdin: { cwd, session_id: 's-1', command_name: 'accord', command_args: 'continue T-1' } },
  ];
}

// Phase 08.9.2 D-03: the marker lives in the common git folder, the panel flag in the checkout's own local settings, and no `env` key is written.
it('risk:regression accord off writes the marker in the common git folder and the panel flag in local settings (D-03)', async () => {
  const repo = makeLaneRepo();
  dirs.push(repo);
  const off = await run(['off'], repo);
  expect(off.err).toBe('');
  expect(off.code).toBe(0);

  const marker = JSON.parse(read(join(repo, '.git', 'accord-off'))) as { since: string; panel: { prior: unknown; createdMap: unknown } };
  expect(typeof marker.since).toBe('string');
  expect(Number.isNaN(Date.parse(marker.since))).toBe(false);
  expect(marker.panel).toEqual({ prior: 'absent', createdMap: true });

  const local = JSON.parse(read(join(repo, '.claude', 'settings.local.json'))) as Record<string, unknown>;
  expect((local.enabledPlugins as Record<string, unknown>)[PANEL]).toBe(false);
  expect(Object.keys(local)).not.toContain('env');
});

// Phase 08.9.2 D-03, Ruling-structural: with the marker present every hook prints nothing, exits 0 and starts no git process, in the checkout and in a linked worktree.
it('risk:regression every accord hook is silent while accord is off in the main checkout and a linked worktree (D-03)', async () => {
  const repo = committedRepo();
  const wt = linkedWorktree(repo);

  // control: with accord on, a session start prints its rules
  const before = await run(['hook', 'session-start'], repo, {}, JSON.stringify({ cwd: repo, session_id: 's-1', source: 'startup' }));
  expect(before.out.startsWith('# accord rules\n')).toBe(true);

  expect((await run(['off'], repo)).code).toBe(0);

  for (const folder of [repo, wt]) {
    for (const { event, stdin } of hookCalls(folder)) {
      spawnLog.calls = [];
      spawnLog.on = true;
      let r: { code: number; out: string; err: string };
      try {
        r = await run(['hook', event], folder, {}, JSON.stringify(stdin));
      } finally {
        spawnLog.on = false;
      }
      expect(r.out, `${event} in ${folder === repo ? 'the checkout' : 'the linked worktree'}`).toBe('');
      expect(r.err, event).toBe('');
      expect(r.code, event).toBe(0);
      expect(spawnLog.calls, event).toEqual([]);
    }
  }
});

type Launch = (io: Record<string, unknown>) => number;
const launcherHref = pathToFileURL(fileURLToPath(new URL('../../core/launcher/accord.mjs', import.meta.url))).href;

/** One launcher call with the real fs and a spawn stub; the launcher file is said to sit in `<checkout>/.claude/`. */
async function launcherCall(checkout: string, argv: string[], cache: string): Promise<{ code: number; out: string; err: string; spawned: number; stdinReads: number }> {
  const { launch } = (await import(/* @vite-ignore */ launcherHref)) as { launch: Launch };
  const fs = await import('node:fs');
  let spawned = 0;
  let stdinReads = 0;
  let out = '';
  let err = '';
  const code = launch({
    argv,
    env: { LOCALAPPDATA: cache, XDG_CACHE_HOME: cache },
    platform: process.platform,
    homedir: cache,
    execPath: process.execPath,
    pid: process.pid,
    launcherPath: join(checkout, '.claude', 'accord.mjs'),
    readStdin: () => {
      stdinReads += 1;
      return JSON.stringify({ cwd: checkout, session_id: 's-1', source: 'startup' });
    },
    fs: { existsSync: fs.existsSync, mkdirSync: fs.mkdirSync, readdirSync: fs.readdirSync, readFileSync: fs.readFileSync, renameSync: fs.renameSync, rmSync: fs.rmSync, statSync: fs.statSync },
    spawnSync: () => {
      spawned += 1;
      return { status: 1, stdout: '', stderr: 'stub: no install' };
    },
    now: Date.now,
    sleep: () => undefined,
    stdout: { write: (t: string) => (out += t) },
    stderr: { write: (t: string) => (err += t) },
  });
  return { code, out, err, spawned, stdinReads };
}

// Phase 08.9.2 Ruling-structural, D-03: the launcher reads the same marker with plain file reads, before stdin or any cache path, so no process starts.
it('risk:resource the launcher finds the same marker with no process started (Ruling-structural)', async () => {
  const repo = committedRepo();
  const wt = linkedWorktree(repo);
  const cache = mkdtempSync(join(tmpdir(), 'accord-cache-'));
  dirs.push(cache);

  // control: with accord on, the launcher goes on to the cache and starts a process for the same call
  const on = await launcherCall(repo, ['1.2.3', 'hook', 'session-start'], cache);
  expect(on.spawned).toBeGreaterThan(0);
  expect(on.stdinReads).toBe(1);

  expect((await run(['off'], repo)).code).toBe(0);

  for (const checkout of [repo, wt]) {
    for (const argv of [['1.2.3', 'hook', 'session-start'], ['1.2.3', 'hook', 'pre-tool-use'], ['hook', 'session-start']]) {
      const r = await launcherCall(checkout, argv, cache);
      expect(r, `${argv.join(' ')} in ${checkout === repo ? 'the checkout' : 'the linked worktree'}`).toEqual({ code: 0, out: '', err: '', spawned: 0, stdinReads: 0 });
    }
  }
});
