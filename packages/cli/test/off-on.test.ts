// Phase 08.9.2 D-03, L-01: `accord off` is a personal switch. It writes a marker in the git common folder and the panel flag in the checkout's local settings,
// and every accord hook then answers nothing, through the launcher and through the CLI, with no process started, in the checkout and in every linked worktree.
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { platform, tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { afterEach, expect, it, vi } from 'vitest';
import { spawnLog } from './helpers/git-spawns.js';
import { gitDirsOf } from '../src/load/gitdir.js';
import { cleanup, commitAll, gitRun, makeEmptyRepo, makeLaneRepo, run, writeFiles } from './helpers/repo.js';

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
    // 08.9.2-11 Ruling-off-accord: a typed /accord wakes an off session, so it is no silent case any more (quiet-wake.test.ts holds it); a stale matcher name, which the hook allows, stays silent
    { event: 'prompt-expansion', stdin: { cwd, session_id: 's-1', command_name: 'accord-new', command_args: 'continue T-1' } },
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
    platform: platform(),
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
      // review WR-05: a pre-tool-use call reads stdin once, to see whether it is a verification.md write (off-write-guard.test.ts); no other event reads it, and none starts a process
      expect(r, `${argv.join(' ')} in ${checkout === repo ? 'the checkout' : 'the linked worktree'}`).toEqual({ code: 0, out: '', err: '', spawned: 0, stdinReads: argv.includes('pre-tool-use') ? 1 : 0 });
    }
  }
});

const localOf = (repo: string): string => join(repo, '.claude', 'settings.local.json');
const markerOf = (repo: string): string => join(repo, '.git', 'accord-off');
const pretty = (o: unknown): string => JSON.stringify(o, null, 2) + '\n';
const parsed = (file: string): Record<string, unknown> => JSON.parse(read(file)) as Record<string, unknown>;

// Phase 08.9.2 D-03, L-01: `on` undoes what `off` recorded and nothing else; a person's keys, their order and anything they added meanwhile stay.
it('risk:data-loss accord on removes only what accord off wrote (D-03)', async () => {
  const base = { permissions: { allow: ['Bash(ls)'] }, env: { A: '1' }, enabledPlugins: { 'other@x': true } };
  const falseBefore = { ...base, enabledPlugins: { 'other@x': true, [PANEL]: false } };
  const trueBefore = { ...base, enabledPlugins: { [PANEL]: true, 'other@x': true } };
  const noMap = { env: { A: '1' }, permissions: { allow: [] } };
  const cases: Array<{ name: string; before: Record<string, unknown> | undefined; kept: Record<string, unknown> }> = [
    { name: 'flag absent in an existing map', before: base, kept: base },
    { name: 'flag already false', before: falseBefore, kept: falseBefore },
    { name: 'flag true before', before: trueBefore, kept: trueBefore },
    { name: 'no map at all', before: noMap, kept: noMap },
    { name: 'no file at all', before: undefined, kept: {} },
  ];
  for (const c of cases) {
    const repo = makeLaneRepo();
    dirs.push(repo);
    if (c.before !== undefined) writeFiles(repo, { '.claude/settings.local.json': pretty(c.before) });
    expect((await run(['off'], repo)).code, c.name).toBe(0);
    expect(existsSync(markerOf(repo)), c.name).toBe(true);
    const on = await run(['on'], repo);
    expect(on.err, c.name).toBe('');
    expect(on.code, c.name).toBe(0);
    expect(on.out, c.name).toContain('accord is on again for you in this clone');
    expect(existsSync(markerOf(repo)), c.name).toBe(false);
    const after = parsed(localOf(repo));
    expect(after, c.name).toEqual(c.kept);
    expect(JSON.stringify(after), `${c.name}: key order`).toBe(JSON.stringify(c.kept));
  }

  // keys the person adds while accord is off are theirs: `on` leaves them, and keeps a map it created once it holds anything else
  const repo = makeLaneRepo();
  dirs.push(repo);
  expect((await run(['off'], repo)).code).toBe(0);
  const mid = parsed(localOf(repo));
  writeFiles(repo, { '.claude/settings.local.json': pretty({ ...mid, later: true, enabledPlugins: { ...(mid.enabledPlugins as object), 'mine@y': true } }) });
  expect((await run(['on'], repo)).code).toBe(0);
  expect(parsed(localOf(repo))).toEqual({ later: true, enabledPlugins: { 'mine@y': true } });
});

// Phase 08.9.2 D-03, T-08.9.2-15: a local settings file that is no JSON object is never rewritten, and no marker is written either.
it('risk:parsing off refuses a local settings file that is not an object and changes nothing (D-03)', async () => {
  for (const text of ['[1, 2]\n', '"text"\n', 'not json\n', '{"enabledPlugins": [1]}\n', '{"enabledPlugins": {"accord-panel@accord": "no"}}\n']) {
    const repo = makeLaneRepo();
    dirs.push(repo);
    writeFiles(repo, { '.claude/settings.local.json': text });
    const r = await run(['off'], repo);
    expect(r.code, text).toBe(2);
    expect(r.err.trim().split('\n'), text).toHaveLength(1);
    expect(r.out, text).toBe('');
    expect(read(localOf(repo)), text).toBe(text);
    expect(existsSync(markerOf(repo)), text).toBe(false);
  }
});

// Phase 08.9.2 D-03: off and on are stated exceptions to the pin check, work with no accord folder, and a second off keeps the first marker.
it('risk:regression off and on are idempotent and run without an accord folder or a matching pin (D-03)', async () => {
  const repo = makeLaneRepo();
  dirs.push(repo);
  expect((await run(['off'], repo)).code).toBe(0);
  const first = read(markerOf(repo));
  await new Promise((r) => setTimeout(r, 5));
  expect((await run(['off'], repo)).code).toBe(0);
  expect(read(markerOf(repo))).toBe(first);
  expect(parsed(localOf(repo))).toEqual({ enabledPlugins: { [PANEL]: false } });
  expect((await run(['on'], repo)).code).toBe(0);
  expect(existsSync(markerOf(repo))).toBe(false);

  const none = await run(['on'], repo);
  expect(none.code).toBe(0);
  expect(none.out).toBe('accord is not off in this clone\n');
  expect(parsed(localOf(repo))).toEqual({}); // the second `on` left the file as the first one did

  // a pin that is not this CLI's version stops every other command, but not these two
  const pinned = makeLaneRepo();
  dirs.push(pinned);
  const config = read(join(pinned, 'accord', 'config.yml'));
  writeFiles(pinned, { 'accord/config.yml': config.replace(/accord: "[^"]*"/, 'accord: "0.0.1"') });
  expect((await run(['status'], pinned)).code).toBe(2);
  expect((await run(['off'], pinned)).code).toBe(0);
  expect((await run(['on'], pinned)).code).toBe(0);

  const bare = makeEmptyRepo();
  dirs.push(bare);
  expect(existsSync(join(bare, 'accord'))).toBe(false);
  expect((await run(['off'], bare)).code).toBe(0);
  expect(existsSync(markerOf(bare))).toBe(true);
  expect((await run(['on'], bare)).code).toBe(0);

  // the git folders are read from files: a `.git` file with a relative gitdir, a per-worktree folder with no commondir, one with a commondir
  const tmp = mkdtempSync(join(tmpdir(), 'accord-gitdir-'));
  dirs.push(tmp);
  mkdirSync(join(tmp, 'real'));
  mkdirSync(join(tmp, 'co'));
  writeFileSync(join(tmp, 'co', '.git'), 'gitdir: ../real\n');
  expect(gitDirsOf(join(tmp, 'co'))).toEqual({ gitDir: join(tmp, 'real'), commonDir: join(tmp, 'real') });
  mkdirSync(join(tmp, 'common', 'worktrees', 'w'), { recursive: true });
  writeFileSync(join(tmp, 'common', 'worktrees', 'w', 'commondir'), '../..\r\n');
  mkdirSync(join(tmp, 'linked'));
  writeFileSync(join(tmp, 'linked', '.git'), `gitdir: ${join(tmp, 'common', 'worktrees', 'w').replace(/\\/g, '/')}\r\n`);
  expect(gitDirsOf(join(tmp, 'linked'))).toEqual({ gitDir: join(tmp, 'common', 'worktrees', 'w'), commonDir: join(tmp, 'common') });
  writeFileSync(join(tmp, 'co', '.git'), 'gitdir: ../missing\n');
  expect(gitDirsOf(join(tmp, 'co'))).toBeUndefined();
  writeFileSync(join(tmp, 'co', '.git'), 'not a pointer\n');
  expect(gitDirsOf(join(tmp, 'co'))).toBeUndefined();
});

/** A person's own global ignore file may already name the local settings file (Claude Code adds it); the sandbox must not depend on that. */
const noGlobalIgnore = (repo: string): void => {
  gitRun(repo, 'config', 'core.excludesFile', join(repo, '.git', 'no-global-ignore'));
};

// Phase 08.9.2 D-03, T-08.9.2-17: accord may create the local settings file before Claude Code does, so off keeps it out of commits through the clone's own exclude file.
it('risk:security off keeps the local settings out of git (D-03)', async () => {
  const repo = makeLaneRepo();
  dirs.push(repo);
  noGlobalIgnore(repo);
  const exclude = join(repo, '.git', 'info', 'exclude');
  const first = await run(['off'], repo);
  expect(first.out).toContain('info/exclude');
  const lines = (): string[] => (existsSync(exclude) ? read(exclude).split(/\r?\n/) : []);
  expect(lines().filter((l) => l === '.claude/settings.local.json')).toHaveLength(1);
  expect(gitRun(repo, 'status', '--porcelain')).not.toContain('settings.local.json');
  const second = await run(['off'], repo);
  expect(second.out).not.toContain('info/exclude');
  expect(lines().filter((l) => l === '.claude/settings.local.json')).toHaveLength(1);
  expect((await run(['on'], repo)).code).toBe(0);
  expect(lines()).toContain('.claude/settings.local.json'); // `on` leaves the harmless line

  // a repository that already ignores the file gets no extra line
  const ignoring = makeLaneRepo({ '.gitignore': '.claude/settings.local.json\n' });
  dirs.push(ignoring);
  noGlobalIgnore(ignoring);
  const r = await run(['off'], ignoring);
  expect(r.out).not.toContain('info/exclude');
  const own = join(ignoring, '.git', 'info', 'exclude');
  expect(existsSync(own) ? read(own) : '').not.toContain('settings.local.json');
});
