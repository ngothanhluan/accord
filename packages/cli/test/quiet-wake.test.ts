// Phase 08.9.2 L-02, Ruling-wake-session, Ruling-off-accord: typing /accord in a quiet (or switched-off) session that is not woken yet wakes it. The UserPromptExpansion hook answers with
// additionalContext holding the ruleset and the anchor (or the session line), runs the worktree clean once in the foreground, and writes <git dir>/accord-wake/<session_id>; a second /accord
// does nothing more. A session id that is not a plain name names no file. A full-mode repository never reads or writes a wake file.
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { platform, tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { afterEach, expect, it, vi } from 'vitest';
import { QUIET_LINE } from '../src/commands/hook-early.js';
import { spawnLog } from './helpers/git-spawns.js';
import { cleanup, commitAll, gitRun, makeLaneRepo, run, writeFiles } from './helpers/repo.js';

vi.mock('node:child_process', async (orig) => (await import('./helpers/git-spawns.js')).wrapChildProcess(await orig<typeof import('node:child_process')>()));

const dirs: string[] = [];
afterEach(() => {
  while (dirs.length > 0) cleanup(dirs.pop() as string);
  spawnLog.on = false;
  spawnLog.after = undefined;
  spawnLog.fail = undefined;
  spawnLog.calls = [];
});

const RULES = '# accord rules\n';
const OFF_NOTE = 'accord is switched off for you in this clone; offer node .claude/accord.mjs on';

/** A committed sandbox with an origin that cannot be fetched (so the wake's clean prints one line to tell the owner); `modeLine` is appended to the config ('' leaves the key out). */
function repoWith(modeLine: string): string {
  const repo = makeLaneRepo();
  dirs.push(repo);
  if (modeLine !== '') {
    const file = join(repo, 'accord', 'config.yml');
    const text = readFileSync(file, 'utf8');
    writeFiles(repo, { 'accord/config.yml': (text.endsWith('\n') ? text : text + '\n') + modeLine + '\n' });
  }
  commitAll(repo);
  const parent = mkdtempSync(join(tmpdir(), 'accord-cli-origin-'));
  dirs.push(parent);
  gitRun(repo, 'remote', 'add', 'origin', join(parent, 'no-such-remote'));
  return repo;
}

/** The UserPromptExpansion stdin for a typed `/accord <args>`; `id` undefined leaves session_id out. */
function typed(cwd: string, id: string | undefined, args = ''): string {
  return JSON.stringify({ cwd, ...(id === undefined ? {} : { session_id: id }), hook_event_name: 'UserPromptExpansion', command_name: 'accord', command_args: args });
}

/** One hook call with the git spawn counter on. */
async function counted(event: string, cwd: string, stdin: string): Promise<{ code: number; out: string; err: string; calls: string[][] }> {
  spawnLog.calls = [];
  spawnLog.on = true;
  try {
    const r = await run(['hook', event], cwd, {}, stdin);
    return { ...r, calls: spawnLog.calls.map((c) => [...c]) };
  } finally {
    spawnLog.on = false;
  }
}

/** The additionalContext of a UserPromptExpansion answer; fails the test when the answer is not that object. */
function contextOf(out: string): string {
  const parsed = JSON.parse(out) as { hookSpecificOutput?: { hookEventName?: string; additionalContext?: string } };
  expect(parsed.hookSpecificOutput?.hookEventName, out).toBe('UserPromptExpansion');
  return String(parsed.hookSpecificOutput?.additionalContext);
}

// Phase 08.9.2 L-02: /accord in a quiet session that is not woken yet answers with the rules, the session line and the clean's report, and writes the wake file; the second /accord is `{}` and starts no fetch.
it('risk:regression typing accord wakes a quiet session with rules anchor and one clean (L-02)', async () => {
  const repo = repoWith('hook_mode: quiet');
  const file = join(repo, '.git', 'accord-wake', 's-wake');

  const first = await counted('prompt-expansion', repo, typed(repo, 's-wake'));
  expect(first.code).toBe(0);
  expect(first.err).toBe('');
  const context = contextOf(first.out);
  expect(context.startsWith(RULES), 'the ruleset comes first').toBe(true);
  expect(context, 'the session line follows').toMatch(/\naccord: (no lane tickets yet|\d+ in progress)/);
  expect(context, 'the clean ran and its report is for the owner').toContain('tell the owner the lines above');
  expect(first.calls.some((c) => c.includes('fetch')), 'the clean fetched once').toBe(true);
  expect(existsSync(file), 'the wake file is written').toBe(true);
  const wake = JSON.parse(readFileSync(file, 'utf8')) as { since: string; delivered: boolean };
  expect(Number.isNaN(Date.parse(wake.since))).toBe(false);
  expect(wake.delivered).toBe(true);

  const second = await counted('prompt-expansion', repo, typed(repo, 's-wake'));
  expect(second.out).toBe('{}\n');
  expect(second.calls, 'a woken session runs no second clean').toEqual([]);
});

// Phase 08.9.2 Ruling-off-accord: with accord off for the person, /accord wakes the session the same way and offers `accord on`; the marker stays until `on` runs.
it('risk:regression accord off then typing accord wakes that session and offers accord on (Ruling-off-accord)', async () => {
  const repo = repoWith('');
  expect((await run(['off'], repo)).code).toBe(0);
  const marker = join(repo, '.git', 'accord-off');
  expect(existsSync(marker)).toBe(true);

  const woke = await counted('prompt-expansion', repo, typed(repo, 's-off'));
  expect(woke.code).toBe(0);
  const context = contextOf(woke.out);
  expect(context.startsWith(RULES)).toBe(true);
  expect(context).toContain(OFF_NOTE);
  expect(existsSync(join(repo, '.git', 'accord-wake', 's-off'))).toBe(true);
  expect(existsSync(marker), 'the wake never removes the off marker').toBe(true);
});

// Phase 08.9.2 L-02, T-08.9.2-29: a session id that is not ^[A-Za-z0-9_-]{1,128}$ names no file; the prompt is allowed and nothing is woken. (Green at BASE by design: it pins that the wake does not widen into a path.)
it('risk:security a session id that is not a plain name wakes nothing and names no file (L-02)', async () => {
  const repo = repoWith('hook_mode: quiet');
  for (const id of ['../x', 'a/b', 'a\\b', '', 'x'.repeat(129), undefined]) {
    const r = await counted('prompt-expansion', repo, typed(repo, id));
    expect(r.out, `session id ${JSON.stringify(id)}`).toBe('{}\n');
    expect(r.code).toBe(0);
    expect(existsSync(join(repo, '.git', 'accord-wake')), `no folder for ${JSON.stringify(id)}`).toBe(false);
    expect(existsSync(join(repo, '.git', 'x')), `nothing written beside the folder for ${JSON.stringify(id)}`).toBe(false);
  }
});

// Phase 08.9.2 D-07: a full-mode repository (accord on, hook_mode absent) answers /accord as today and reads or writes no wake file. (Green at BASE by design.)
it('risk:regression a full-mode repository never reads or writes a wake file (D-07)', async () => {
  const repo = repoWith('');
  const first = await counted('prompt-expansion', repo, typed(repo, 's-full'));
  expect(first.out).toBe('{}\n');
  expect(first.code).toBe(0);
  expect(existsSync(join(repo, '.git', 'accord-wake'))).toBe(false);

  // a stale wake file of another session changes nothing in full mode: the next session start is the full one
  writeFiles(repo, { '.git/accord-wake/s-stale': '{"since":"2020-01-01T00:00:00.000Z","delivered":true}\n' });
  const start = await run(['hook', 'session-start'], repo, {}, JSON.stringify({ cwd: repo, session_id: 's-full', source: 'startup' }));
  expect(start.out.startsWith(RULES)).toBe(true);
  expect(existsSync(join(repo, '.git', 'accord-wake', 's-full'))).toBe(false);
});

/** The stdin of a session hook for session `id`; `more` adds the event's own fields. */
const sessionInput = (cwd: string, id: string, more: Record<string, unknown> = {}): string => JSON.stringify({ cwd, session_id: id, ...more });

/** Wakes the session `id` of `repo` with a typed /accord and checks that the wake file exists. */
async function wakeSession(repo: string, id: string): Promise<void> {
  const woke = await run(['hook', 'prompt-expansion'], repo, {}, typed(repo, id));
  expect(woke.code).toBe(0);
  expect(existsSync(join(repo, '.git', 'accord-wake', id)), `session ${id} is woken`).toBe(true);
}

// Phase 08.9.2 Ruling-wake-session: once /accord woke a quiet session every later hook of that session takes the full path (rules first); another session of the same clone stays quiet.
it('risk:regression a woken quiet session takes the full path for every later hook (Ruling-wake-session)', async () => {
  const repo = repoWith('hook_mode: quiet');
  await wakeSession(repo, 's-w');

  const resumed = await run(['hook', 'session-resume'], repo, {}, sessionInput(repo, 's-w', { source: 'compact' }));
  expect(resumed.out.startsWith(RULES), 'the woken session resumes in full').toBe(true);
  expect(resumed.out).not.toContain(QUIET_LINE);

  const other = await run(['hook', 'session-resume'], repo, {}, sessionInput(repo, 's-other', { source: 'compact' }));
  expect(other.out, 'another session is still quiet').toBe(QUIET_LINE + '\n');
});

// Phase 08.9.2 Ruling-wake-session, override Ruling: after /accord in an off session the accord agents it dispatches get the ruleset; other sessions of the off clone get nothing.
it('risk:regression a woken off session gives accord agents their rules (Ruling-wake-session)', async () => {
  const repo = repoWith('');
  expect((await run(['off'], repo)).code).toBe(0);
  await wakeSession(repo, 's-w');

  const woken = await run(['hook', 'subagent-start'], repo, {}, sessionInput(repo, 's-w', { agent_type: 'accord-executor' }));
  const out = JSON.parse(woken.out) as { hookSpecificOutput?: { hookEventName?: string; additionalContext?: string } };
  expect(out.hookSpecificOutput?.hookEventName).toBe('SubagentStart');
  expect(out.hookSpecificOutput?.additionalContext?.startsWith(RULES)).toBe(true);

  const other = await run(['hook', 'subagent-start'], repo, {}, sessionInput(repo, 's-other', { agent_type: 'accord-executor' }));
  expect(other.out, 'another session of the off clone stays silent').toBe('');
  expect(existsSync(join(repo, '.git', 'accord-off')), 'the marker stays').toBe(true);
});

type Launch = (io: Record<string, unknown>) => number;
const launcherHref = pathToFileURL(fileURLToPath(new URL('../../core/launcher/accord.mjs', import.meta.url))).href;
const VERSION = '1.2.3';

/** One launcher call with the real fs and a spawn stub; the launcher file is said to sit in `<checkout>/.claude/`, and the cache holds a bundle of VERSION so a spawn is the bundle's. */
async function launched(checkout: string, event: string, stdin: Record<string, unknown>): Promise<{ out: string; err: string; spawns: string[][] }> {
  const cache = mkdtempSync(join(tmpdir(), 'accord-wake-cache-'));
  dirs.push(cache);
  const bundle = join(cache, 'accord', 'versions', VERSION, 'node_modules', 'ACCORD_PACKAGE_NAME', 'dist');
  mkdirSync(bundle, { recursive: true });
  writeFileSync(join(bundle, 'cli.js'), '');
  const { launch } = (await import(/* @vite-ignore */ launcherHref)) as { launch: Launch };
  const fs = await import('node:fs');
  const spawns: string[][] = [];
  let out = '';
  let err = '';
  launch({
    argv: [VERSION, 'hook', event],
    env: { LOCALAPPDATA: cache, XDG_CACHE_HOME: cache },
    platform: platform(),
    homedir: cache,
    execPath: process.execPath,
    pid: process.pid,
    launcherPath: join(checkout, '.claude', 'accord.mjs'),
    readStdin: () => JSON.stringify({ cwd: checkout, ...stdin }),
    fs: { existsSync: fs.existsSync, mkdirSync: fs.mkdirSync, readdirSync: fs.readdirSync, readFileSync: fs.readFileSync, renameSync: fs.renameSync, rmSync: fs.rmSync, statSync: fs.statSync },
    spawnSync: (_cmd: string, args: string[]) => {
      spawns.push(args);
      return { status: 0, stdout: '', stderr: '' };
    },
    now: Date.now,
    sleep: () => undefined,
    stdout: { write: (t: string) => (out += t) },
    stderr: { write: (t: string) => (err += t) },
  });
  return { out, err, spawns };
}

// Phase 08.9.2 Ruling-wake-session, Ruling-off-accord: the launcher reads the wake file with no process. A woken session reaches the bundle even in a quiet or off clone; any other session
// gets the quiet line or silence and no spawn; an off clone lets a typed /accord (and only that command) through.
it('risk:resource the launcher reads the wake file with no process and hands a woken session to the CLI (Ruling-wake-session)', async () => {
  const quiet = repoWith('hook_mode: quiet');
  writeFiles(quiet, { '.git/accord-wake/s-w': '{"since":"2026-11-25T00:00:00.000Z","delivered":true}\n' });

  const resumed = await launched(quiet, 'session-resume', { session_id: 's-w', source: 'compact' });
  expect(resumed.spawns, 'a woken quiet session reaches the bundle once').toHaveLength(1);
  expect(resumed.out).toBe('');
  const other = await launched(quiet, 'session-resume', { session_id: 's-other', source: 'compact' });
  expect(other.out, 'another session gets the quiet line').toBe(QUIET_LINE + '\n');
  expect(other.spawns).toEqual([]);

  const off = repoWith('');
  expect((await run(['off'], off)).code).toBe(0);
  writeFiles(off, { '.git/accord-wake/s-w': '{"since":"2026-11-25T00:00:00.000Z","delivered":true}\n' });

  const typedAccord = await launched(off, 'prompt-expansion', { session_id: 's-n', command_name: 'accord', command_args: '' });
  expect(typedAccord.spawns, 'an off clone lets a typed /accord through').toHaveLength(1);
  const otherCommand = await launched(off, 'prompt-expansion', { session_id: 's-n', command_name: 'accord-upgrade', command_args: '' });
  expect(otherCommand.spawns, 'any other command stays silent').toEqual([]);
  const startWoken = await launched(off, 'session-start', { session_id: 's-w', source: 'startup' });
  expect(startWoken.spawns, 'an off session start of a woken id reaches the bundle').toHaveLength(1);
  const startOther = await launched(off, 'session-start', { session_id: 's-other', source: 'startup' });
  expect(startOther.spawns).toEqual([]);
  expect(startOther.out).toBe('');
  const badId = await launched(off, 'session-start', { session_id: '../s-w', source: 'startup' });
  expect(badId.spawns, 'an id that is not a plain name names no wake file').toEqual([]);
});

// Phase 08.9.2 review WR-02: the wake file lives in the common git folder, so a /accord typed in a linked worktree wakes the session for the launcher of the main checkout too, and the reverse.
it('risk:regression a wake typed in a linked worktree reaches the launcher of the main checkout (WR-02)', async () => {
  const repo = repoWith('hook_mode: quiet');
  const folder = mkdtempSync(join(tmpdir(), 'accord-wake-wt-'));
  dirs.push(folder);
  const worktree = join(folder, 'wt');
  gitRun(repo, 'worktree', 'add', '-q', '-b', 'scratch/wake', worktree);

  // a session of the main checkout types /accord after it moved into the worktree: the CLI sees the worktree, the launcher the main checkout
  const woke = await run(['hook', 'prompt-expansion'], worktree, {}, typed(worktree, 's-wt'));
  expect(woke.code).toBe(0);
  expect(existsSync(join(repo, '.git', 'accord-wake', 's-wt')), 'the wake file is in the common git folder').toBe(true);
  expect(existsSync(join(repo, '.git', 'worktrees')) && readdirSync(join(repo, '.git', 'worktrees')).some((w) => existsSync(join(repo, '.git', 'worktrees', w, 'accord-wake'))), 'none in the per-worktree folder').toBe(false);

  const launcher = await launched(repo, 'session-resume', { session_id: 's-wt', source: 'compact' });
  expect(launcher.spawns, 'the launcher of the main checkout hands the woken session to the bundle').toHaveLength(1);
  const other = await launched(repo, 'session-resume', { session_id: 's-other', source: 'compact' });
  expect(other.spawns, 'another session stays quiet').toEqual([]);

  // and the CLI of the worktree reads a wake file the main checkout's session wrote
  expect((await run(['hook', 'prompt-expansion'], repo, {}, typed(repo, 's-main'))).code).toBe(0);
  const resumed = await run(['hook', 'session-resume'], worktree, {}, sessionInput(worktree, 's-main', { source: 'compact' }));
  expect(resumed.out.startsWith(RULES), 'the worktree CLI treats the main checkout session as woken').toBe(true);
});
