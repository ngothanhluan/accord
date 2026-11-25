// Phase 08.9.2 L-02, Ruling-wake-session, Ruling-off-accord: typing /accord in a quiet (or switched-off) session that is not woken yet wakes it. The UserPromptExpansion hook answers with
// additionalContext holding the ruleset and the anchor (or the session line), runs the worktree clean once in the foreground, and writes <git dir>/accord-wake/<session_id>; a second /accord
// does nothing more. A session id that is not a plain name names no file. A full-mode repository never reads or writes a wake file.
import { existsSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, expect, it, vi } from 'vitest';
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
