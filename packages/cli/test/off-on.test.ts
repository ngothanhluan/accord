// Phase 08.9.2 D-03, L-01: `accord off` is a personal switch. It writes only a marker in the git common folder (owner ruling 2026-11-25, UAT G-08.9.2-10: the panel flag
// it once also set made Claude Code drop the panel plugin, so a typed /accord-panel was unknown), and every accord hook then answers nothing, through the launcher and
// through the CLI, with no process started, in the checkout and in every linked worktree. `on` still undoes the flag a 0.20.0 or 0.20.1 `off` recorded in its marker.
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
/** A file's bytes read with no encoding, so a BOM and CRLF stay visible; undefined when the file is absent. */
const bytesOf = (file: string): Buffer | undefined => (existsSync(file) ? readFileSync(file) : undefined);

/** A person's own global ignore file may already name the local settings file (Claude Code adds it); the sandbox must not depend on that. */
const noGlobalIgnore = (repo: string): void => {
  gitRun(repo, 'config', 'core.excludesFile', join(repo, '.git', 'no-global-ignore'));
};

/** The state a 0.20.0 or 0.20.1 `accord off` left behind: the marker with its `panel` record, and the local file rewritten as two-space JSON with the panel flag false (the spread order 0.20.1 used). */
function legacyOff(repo: string, before: Record<string, unknown> | undefined): void {
  const plugins = before?.enabledPlugins as Record<string, unknown> | undefined;
  const prior = plugins !== undefined && PANEL in plugins ? plugins[PANEL] : 'absent';
  writeFiles(repo, {
    '.git/accord-off': pretty({ since: new Date().toISOString(), panel: { prior, createdMap: plugins === undefined } }),
    '.claude/settings.local.json': pretty({ ...(before ?? {}), enabledPlugins: { ...(plugins ?? {}), [PANEL]: false } }),
  });
}

const FOUR_SPACE = { enabledPlugins: { [PANEL]: true, 'other@x': true }, permissions: { allow: [] as string[] } };

// Phase 08.9.2 D-03, G-08.9.2-10 (owner ruling 2026-11-25): `off` writes only the marker; it never creates or rewrites the local settings and adds no line to the clone's exclude file,
// so Claude Code keeps loading the panel plugin and a typed /accord-panel stays a known command. The old exclude test's claim (the local file stays out of commits) is this test's stronger form: no work-tree file is made.
it('risk:regression accord off writes only the marker and leaves the local settings and git exclude untouched (D-03 G-08.9.2-10)', async () => {
  const repo = makeLaneRepo();
  dirs.push(repo);
  noGlobalIgnore(repo);
  const exclude = join(repo, '.git', 'info', 'exclude');
  const excludeBefore = bytesOf(exclude);
  const statusBefore = gitRun(repo, 'status', '--porcelain');
  const off = await run(['off'], repo);
  expect(off.err).toBe('');
  expect(off.code).toBe(0);
  expect(existsSync(localOf(repo))).toBe(false);
  const marker = parsed(markerOf(repo));
  expect(Object.keys(marker)).toEqual(['since']);
  expect(Number.isNaN(Date.parse(String(marker.since)))).toBe(false);
  expect(bytesOf(exclude)).toEqual(excludeBefore);
  expect(gitRun(repo, 'status', '--porcelain')).toBe(statusBefore);
  expect(off.out.trim().split('\n')).toHaveLength(1);
  expect(off.out).toContain('/accord-panel');
  expect(off.out).toContain('node .claude/accord.mjs on');

  // a local file the person already has keeps its bytes, indentation included
  const own = makeLaneRepo();
  dirs.push(own);
  writeFiles(own, { '.claude/settings.local.json': JSON.stringify(FOUR_SPACE, null, 4) + '\n' });
  const before = bytesOf(localOf(own));
  expect((await run(['off'], own)).code).toBe(0);
  expect(bytesOf(localOf(own))).toEqual(before);
});

// Phase 08.9.2 D-03, G-08.9.2-5 (UAT test 5): with `off` leaving the local file alone, off then on gives it back byte for byte, and creates none where there was none.
it('risk:data-loss accord off then on leaves the local settings byte for byte as they were (D-03 G-08.9.2-5)', async () => {
  const four = JSON.stringify(FOUR_SPACE, null, 4) + '\n';
  const cases: Array<{ name: string; bytes: Buffer | undefined }> = [
    { name: 'no file at all', bytes: undefined },
    { name: 'two-space JSON', bytes: Buffer.from(pretty(FOUR_SPACE)) },
    { name: 'four-space JSON', bytes: Buffer.from(four) },
    { name: 'BOM plus CRLF four-space JSON', bytes: Buffer.from('﻿' + four.replace(/\n/g, '\r\n')) },
    { name: 'a JSON array', bytes: Buffer.from('[1, 2]\n') },
    { name: 'text that is no JSON', bytes: Buffer.from('not json\n') },
    { name: 'the persons own panel false', bytes: Buffer.from(JSON.stringify({ enabledPlugins: { [PANEL]: false }, env: { A: '1' } }, null, 4) + '\n') },
  ];
  for (const c of cases) {
    const repo = makeLaneRepo();
    dirs.push(repo);
    if (c.bytes !== undefined) {
      mkdirSync(join(repo, '.claude'), { recursive: true });
      writeFileSync(localOf(repo), c.bytes);
    }
    const off = await run(['off'], repo);
    expect(off.err, c.name).toBe('');
    expect(off.code, c.name).toBe(0);
    expect(bytesOf(localOf(repo)), `${c.name} after off`).toEqual(c.bytes);
    const on = await run(['on'], repo);
    expect(on.err, c.name).toBe('');
    expect(on.code, c.name).toBe(0);
    expect(on.out, c.name).toContain('accord is on again for you in this clone');
    expect(bytesOf(localOf(repo)), `${c.name} after on`).toEqual(c.bytes);
    expect(existsSync(markerOf(repo)), c.name).toBe(false);
  }
});

// Phase 08.9.2 D-03, G-08.9.2-10 (owner ruling 2026-11-25, backward compatibility): a marker written by 0.20.0 or 0.20.1 carries a `panel` record, and `on` undoes that flag exactly as 0.20.1 did.
// Green at the base commit by design: it guards the restore path the fix keeps.
it('risk:data-loss accord on still undoes the panel flag a 0.20.0 or 0.20.1 accord off recorded (D-03 G-08.9.2-10)', async () => {
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
    legacyOff(repo, c.before);
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
  legacyOff(repo, undefined);
  const mid = parsed(localOf(repo));
  writeFiles(repo, { '.claude/settings.local.json': pretty({ ...mid, later: true, enabledPlugins: { ...(mid.enabledPlugins as object), 'mine@y': true } }) });
  expect((await run(['on'], repo)).code).toBe(0);
  expect(parsed(localOf(repo))).toEqual({ later: true, enabledPlugins: { 'mine@y': true } });

  // the new `off` on top of a 0.20.x marker keeps that marker and the local file as they are, so a later `on` still restores the flag
  const mixed = makeLaneRepo();
  dirs.push(mixed);
  legacyOff(mixed, base);
  const markerBefore = bytesOf(markerOf(mixed));
  const localBefore = bytesOf(localOf(mixed));
  expect((await run(['off'], mixed)).code).toBe(0);
  expect(bytesOf(markerOf(mixed))).toEqual(markerBefore);
  expect(bytesOf(localOf(mixed))).toEqual(localBefore);
  expect((await run(['on'], mixed)).code).toBe(0);
  expect(parsed(localOf(mixed))).toEqual(base);
});

// Phase 08.9.2 D-03, T-08.9.2-15, T-08.9.2-48, T-08.9.2-49: `on` reads both marker shapes; any doubt leaves the local settings as they are, and only the marker is removed.
it('risk:parsing accord on reads both marker shapes and leaves the local settings alone on any doubt (D-03)', async () => {
  const doubtful = ['[1, 2]\n', '"text"\n', 'not json\n', '{"enabledPlugins": [1]}\n', '{"enabledPlugins": {"accord-panel@accord": "no"}}\n'];
  // a 0.20.x marker with a well-formed record beside a local file `on` cannot restore: one stderr line, the file kept, the marker gone
  for (const text of doubtful) {
    const repo = makeLaneRepo();
    dirs.push(repo);
    writeFiles(repo, { '.git/accord-off': pretty({ since: 'x', panel: { prior: 'absent', createdMap: true } }), '.claude/settings.local.json': text });
    const r = await run(['on'], repo);
    expect(r.code, text).toBe(0);
    expect(r.err.trim().split('\n'), text).toHaveLength(1);
    expect(read(localOf(repo)), text).toBe(text);
    expect(existsSync(markerOf(repo)), text).toBe(false);
  }

  // a marker that is no JSON, or whose record is malformed: one stderr line, the file kept, the marker gone
  const flagFalse = pretty({ enabledPlugins: { [PANEL]: false } });
  for (const marker of ['not json\n', pretty({ since: 'x', panel: { prior: 'maybe' } })]) {
    const repo = makeLaneRepo();
    dirs.push(repo);
    writeFiles(repo, { '.git/accord-off': marker, '.claude/settings.local.json': flagFalse });
    const r = await run(['on'], repo);
    expect(r.code, marker).toBe(0);
    expect(r.err.trim().split('\n'), marker).toHaveLength(1);
    expect(read(localOf(repo)), marker).toBe(flagFalse);
    expect(existsSync(markerOf(repo)), marker).toBe(false);
  }

  // a marker with no record (what the new `off` writes) opens no settings file: nothing on stderr, even beside a file that is no JSON
  for (const marker of ['{}\n', pretty({ since: 'x' })]) {
    const repo = makeLaneRepo();
    dirs.push(repo);
    writeFiles(repo, { '.git/accord-off': marker, '.claude/settings.local.json': 'not json\n' });
    const r = await run(['on'], repo);
    expect(r.code, marker).toBe(0);
    expect(r.err, marker).toBe('');
    expect(read(localOf(repo)), marker).toBe('not json\n');
    expect(existsSync(markerOf(repo)), marker).toBe(false);
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
  expect(existsSync(localOf(repo))).toBe(false); // off wrote no local settings file
  expect((await run(['on'], repo)).code).toBe(0);
  expect(existsSync(markerOf(repo))).toBe(false);

  const none = await run(['on'], repo);
  expect(none.code).toBe(0);
  expect(none.out).toBe('accord is not off in this clone\n');
  expect(existsSync(localOf(repo))).toBe(false); // and `on` left none behind either

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
