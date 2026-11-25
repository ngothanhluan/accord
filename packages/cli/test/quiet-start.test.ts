// Phase 08.9.2 D-02, L-02, L-03: with `hook_mode: quiet` in the checkout's accord/config.yml a session start prints one line (and the off line) and starts no git process,
// unless the session opens on a ticket's branch, where it starts in full. A value that is not exactly `quiet` means full. The launcher's byte-identical answer (08.9.2-16) is the last two cases.
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { platform, tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { afterEach, expect, it, vi } from 'vitest';
import { QUIET_LINE } from '../src/commands/hook-early.js';
import { OFF_LINE } from '../src/commands/off.js';
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

/** A committed sandbox whose default branch carries `modeLine` after the config (a line such as `hook_mode: quiet`; '' leaves the key out). */
function repoWith(modeLine: string): string {
  const repo = makeLaneRepo();
  dirs.push(repo);
  if (modeLine !== '') {
    const file = join(repo, 'accord', 'config.yml');
    const text = readFileSync(file, 'utf8');
    writeFiles(repo, { 'accord/config.yml': (text.endsWith('\n') ? text : text + '\n') + modeLine + '\n' });
  }
  commitAll(repo);
  return repo;
}

/** A linked worktree of `repo` on a new branch `branch`, in its own temporary folder. */
function linkedWorktree(repo: string, branch: string): string {
  const parent = mkdtempSync(join(tmpdir(), 'accord-cli-wt-'));
  dirs.push(parent);
  const wt = join(parent, 'wt');
  gitRun(repo, 'worktree', 'add', '-q', '-b', branch, wt);
  return wt;
}

const startInput = (cwd: string, source = 'startup'): string => JSON.stringify({ cwd, session_id: 's-1', source });

/** One hook call with the git spawn counter on; `calls` is every git process accord itself started. */
async function counted(event: string, cwd: string, source: string): Promise<{ code: number; out: string; err: string; calls: string[][] }> {
  spawnLog.calls = [];
  spawnLog.on = true;
  try {
    const r = await run(['hook', event], cwd, {}, startInput(cwd, source));
    return { ...r, calls: spawnLog.calls.map((c) => [...c]) };
  } finally {
    spawnLog.on = false;
  }
}

// Phase 08.9.2 D-02, L-03, Ruling-structural: a quiet start is one line (two on a start), no ruleset, and no git process, in the checkout and in a linked worktree on a branch naming no ticket.
it('risk:resource a quiet session start prints one line and starts no git process (L-03)', async () => {
  const repo = repoWith('hook_mode: quiet');
  const wt = linkedWorktree(repo, 'linked');

  for (const folder of [repo, wt]) {
    const where = folder === repo ? 'the checkout' : 'the linked worktree';
    const start = await counted('session-start', folder, 'startup');
    expect(start.out, `session-start in ${where}`).toBe(QUIET_LINE + '\n' + OFF_LINE + '\n');
    expect(start.out).not.toContain(RULES);
    expect(start.err, where).toBe('');
    expect(start.code, where).toBe(0);
    expect(start.calls, `git processes of session-start in ${where}`).toEqual([]);

    const resume = await counted('session-resume', folder, 'compact');
    expect(resume.out, `session-resume in ${where}`).toBe(QUIET_LINE + '\n');
    expect(resume.err, where).toBe('');
    expect(resume.code, where).toBe(0);
    expect(resume.calls, `git processes of session-resume in ${where}`).toEqual([]);
  }

  // a detached HEAD names no branch, so it is quiet too
  gitRun(repo, 'checkout', '-q', '--detach');
  const detached = await counted('session-start', repo, 'startup');
  expect(detached.out).toBe(QUIET_LINE + '\n' + OFF_LINE + '\n');
  expect(detached.calls).toEqual([]);
});

// Phase 08.9.2 L-02: a session that opens on a ticket's branch, in its worktree or in the main checkout, is a session on that ticket and starts in full.
it('risk:regression a quiet repository starts in full on a ticket\'s branch (L-02)', async () => {
  const repo = repoWith('hook_mode: quiet');
  const wt = linkedWorktree(repo, 't/T-1');
  const inWorktree = await counted('session-start', wt, 'startup');
  expect(inWorktree.out.startsWith(RULES)).toBe(true);
  expect(inWorktree.out).not.toContain(QUIET_LINE);
  expect(inWorktree.calls.length).toBeGreaterThan(0);

  // a branch whose name only mentions the id inside a longer word is not the ticket's branch
  const longer = linkedWorktree(repo, 't/T-1x');
  const near = await counted('session-start', longer, 'startup');
  expect(near.out).toBe(QUIET_LINE + '\n' + OFF_LINE + '\n');
  expect(near.calls).toEqual([]);

  // the main checkout switched to the ticket's branch: the worktree above holds it, so free the name first
  gitRun(repo, 'worktree', 'remove', '--force', wt);
  gitRun(repo, 'checkout', '-q', 't/T-1');
  const inCheckout = await counted('session-start', repo, 'startup');
  expect(inCheckout.out.startsWith(RULES)).toBe(true);
  expect(inCheckout.out).not.toContain(QUIET_LINE);
  expect(inCheckout.calls.length).toBeGreaterThan(0);
});

// Phase 08.9.2 D-02: only the exact word quiet silences a start; a misspelling, another case, a longer word, a colon with no space after it and an absent key mean full. The quoted spellings and a trailing comment are quiet.
it('risk:parsing a hook_mode that is not exactly quiet means full (D-02)', async () => {
  for (const line of ['hook_mode: loud', 'hook_mode: Quiet', 'hook_mode: quiet-ish', 'hook_mode:quiet', 'hook_mode: full', '']) {
    const repo = repoWith(line);
    const start = await run(['hook', 'session-start'], repo, {}, startInput(repo));
    expect(start.out.startsWith(RULES), `"${line}" is full`).toBe(true);
    expect(start.out, `"${line}" is full`).not.toContain(QUIET_LINE);
  }
  for (const line of ['hook_mode: quiet', 'hook_mode: "quiet"', "hook_mode: 'quiet'", 'hook_mode: quiet # team']) {
    const repo = repoWith(line);
    const start = await run(['hook', 'session-start'], repo, {}, startInput(repo));
    expect(start.out, `"${line}" is quiet`).toBe(QUIET_LINE + '\n' + OFF_LINE + '\n');
  }
});

type Launch = (io: Record<string, unknown>) => number;
const launcherHref = pathToFileURL(fileURLToPath(new URL('../../core/launcher/accord.mjs', import.meta.url))).href;
const VERSION = '1.2.3';

/** One launcher call with the real fs and a spawn stub; the launcher file is said to sit in `<checkout>/.claude/`, and the cache holds a bundle of VERSION so a spawn is the bundle's. */
async function launcherCall(checkout: string, cache: string, event: string): Promise<{ code: number; out: string; err: string; spawns: string[][]; stdinReads: number }> {
  const { launch } = (await import(/* @vite-ignore */ launcherHref)) as { launch: Launch };
  const fs = await import('node:fs');
  const spawns: string[][] = [];
  let stdinReads = 0;
  let out = '';
  let err = '';
  const code = launch({
    argv: [VERSION, 'hook', event],
    env: { LOCALAPPDATA: cache, XDG_CACHE_HOME: cache },
    platform: platform(),
    homedir: cache,
    execPath: process.execPath,
    pid: process.pid,
    launcherPath: join(checkout, '.claude', 'accord.mjs'),
    readStdin: () => {
      stdinReads += 1;
      return startInput(checkout);
    },
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
  return { code, out, err, spawns, stdinReads };
}

/** An empty cache base holding the bundle file of VERSION (the launcher only checks that it exists). */
function cacheWithBundle(): string {
  const cache = mkdtempSync(join(tmpdir(), 'accord-quiet-cache-'));
  dirs.push(cache);
  const bundle = join(cache, 'accord', 'versions', VERSION, 'node_modules', 'ACCORD_PACKAGE_NAME', 'dist');
  mkdirSync(bundle, { recursive: true });
  writeFileSync(join(bundle, 'cli.js'), '');
  return cache;
}

// Phase 08.9.2 L-03: the launcher prints the quiet answer itself, byte for byte as the CLI, and starts no process, reads no stdin and touches no cache.
it('risk:resource the launcher prints the quiet line itself and matches the CLI byte for byte (L-03)', async () => {
  const repo = repoWith('hook_mode: quiet');
  const wt = linkedWorktree(repo, 'linked');
  const cache = mkdtempSync(join(tmpdir(), 'accord-quiet-cache-'));
  dirs.push(cache);

  for (const folder of [repo, wt]) {
    const where = folder === repo ? 'the checkout' : 'the linked worktree';
    for (const [event, source] of [['session-start', 'startup'], ['session-resume', 'compact']] as const) {
      const cli = await run(['hook', event], folder, {}, startInput(folder, source));
      const launched = await launcherCall(folder, cache, event);
      expect(launched.out, `${event} in ${where}`).toBe(cli.out);
      expect(launched.out, `${event} in ${where}`).toBe(event === 'session-start' ? QUIET_LINE + '\n' + OFF_LINE + '\n' : QUIET_LINE + '\n');
      expect(launched.err, where).toBe('');
      expect(launched.code, where).toBe(0);
      expect(launched.spawns, `processes the launcher started for ${event} in ${where}`).toEqual([]);
      expect(launched.stdinReads, `stdin reads for ${event} in ${where}`).toBe(0);
    }
  }
  expect(existsSync(join(cache, 'accord')), 'the cache is untouched').toBe(false);

  // a detached HEAD names no branch: quiet in the launcher as in the CLI
  gitRun(repo, 'checkout', '-q', '--detach');
  const detached = await launcherCall(repo, cache, 'session-start');
  expect(detached.out).toBe(QUIET_LINE + '\n' + OFF_LINE + '\n');
  expect(detached.spawns).toEqual([]);

  // a spelling that is not exactly quiet is full for the launcher too: it hands the call to the bundle
  const full = repoWith('hook_mode:quiet');
  const handed = await launcherCall(full, cacheWithBundle(), 'session-start');
  expect(handed.out).toBe('');
  expect(handed.spawns).toHaveLength(1);
  // an unreadable config is full, never toward silence
  const noConfig = repoWith('');
  rmSync(join(noConfig, 'accord', 'config.yml'));
  const unreadable = await launcherCall(noConfig, cacheWithBundle(), 'session-start');
  expect(unreadable.spawns).toHaveLength(1);
});

// Phase 08.9.2 L-02: the launcher hands to the CLI every branch that holds a ticket id as a whole token, so each branch the CLI would wake reaches it; a branch with no whole-token id stays quiet.
it('risk:regression the launcher hands a ticket-looking branch to the CLI (L-02)', async () => {
  const repo = repoWith('hook_mode: quiet');
  writeFiles(repo, { 'accord/tickets/ST-1.md': '# stub\n' });
  commitAll(repo);

  for (const [branch, handed] of [['t/T-1', true], ['notes-about-st-1-and-more', true], ['mist-12', false]] as const) {
    const wt = linkedWorktree(repo, branch);
    const cache = cacheWithBundle();
    const launched = await launcherCall(wt, cache, 'session-start');
    expect(launched.spawns.length, `${branch} reaches the bundle once or never`).toBe(handed ? 1 : 0);
    if (handed) {
      expect(launched.spawns[0].slice(1), branch).toEqual(['hook', 'session-start']);
      expect(launched.out, branch).toBe('');
    } else {
      expect(launched.out, branch).toBe(QUIET_LINE + '\n' + OFF_LINE + '\n');
    }
  }
});
