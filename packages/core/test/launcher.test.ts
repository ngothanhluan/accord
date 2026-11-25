// Phase 08.9.2 D-01: the launcher's fill, driven through launch(io) with an in-memory fs, a spawn stub, an injected clock and an injected sleep.
// The launcher source is plain JavaScript shipped as text, so it is imported by file URL and no real cache, npm or wall clock is touched.
import { dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { expect, it } from 'vitest';

const PKG = 'ACCORD_PACKAGE_NAME'; // the token the source launcher carries before the render fills it
const V = '1.2.3';
const MIN = 60_000;

type Spawned = { cmd: string; args: string[]; opts: Record<string, unknown> };
type Io = Record<string, unknown>;
const href = pathToFileURL(fileURLToPath(new URL('../launcher/accord.mjs', import.meta.url))).href;
const { launch } = (await import(/* @vite-ignore */ href)) as { launch: (io: Io) => number };

const norm = (p: string): string => p.replace(/\\/g, '/');
const fsError = (code: string): Error => Object.assign(new Error(`${code}: simulated`), { code });

type Node_ = { dir: boolean; mtimeMs: number };

/** A small in-memory fs that records every call, with the few methods the launcher uses. */
function memoryFs(clock: { t: number }) {
  const nodes = new Map<string, Node_>();
  const calls: string[] = [];
  const parentOf = (p: string): string => norm(dirname(p));
  const mk = (p: string, dir: boolean, mtimeMs = clock.t): void => {
    nodes.set(norm(p), { dir, mtimeMs });
  };
  const children = (p: string): string[] => [...nodes.keys()].filter((k) => k !== norm(p) && parentOf(k) === norm(p));
  const subtree = (p: string): string[] => [...nodes.keys()].filter((k) => k === norm(p) || k.startsWith(norm(p) + '/'));
  const ensureDirs = (p: string): void => {
    for (let d = norm(p); d !== '/' && d !== '' && !nodes.has(d); d = parentOf(d)) mk(d, true);
  };
  const fs = {
    existsSync: (p: string) => {
      calls.push(`existsSync ${norm(p)}`);
      return nodes.has(norm(p));
    },
    mkdirSync: (p: string, o?: { recursive?: boolean }) => {
      calls.push(`mkdirSync ${norm(p)}`);
      if (o?.recursive === true) return ensureDirs(p);
      if (nodes.has(norm(p))) throw fsError('EEXIST');
      if (!nodes.has(parentOf(p))) throw fsError('ENOENT');
      mk(p, true);
    },
    statSync: (p: string) => {
      calls.push(`statSync ${norm(p)}`);
      const n = nodes.get(norm(p));
      if (n === undefined) throw fsError('ENOENT');
      return { mtimeMs: n.mtimeMs };
    },
    readdirSync: (p: string) => {
      calls.push(`readdirSync ${norm(p)}`);
      return children(p).map((k) => k.slice(k.lastIndexOf('/') + 1));
    },
    renameSync: (a: string, b: string) => {
      calls.push(`renameSync ${norm(a)} ${norm(b)}`);
      if (!nodes.has(norm(a))) throw fsError('ENOENT');
      if (nodes.has(norm(b)) && children(b).length > 0) throw fsError('ENOTEMPTY');
      for (const k of subtree(a)) {
        const n = nodes.get(k);
        nodes.delete(k);
        if (n !== undefined) nodes.set(norm(b) + k.slice(norm(a).length), n);
      }
    },
    rmSync: (p: string) => {
      calls.push(`rmSync ${norm(p)}`);
      for (const k of subtree(p)) nodes.delete(k);
    },
  };
  return {
    fs,
    calls,
    has: (p: string) => nodes.has(norm(p)),
    names: (p: string) => children(p).map((k) => k.slice(k.lastIndexOf('/') + 1)).sort(),
    dir: (p: string, mtimeMs = clock.t) => {
      ensureDirs(dirname(p));
      mk(p, true, mtimeMs);
    },
    file: (p: string) => {
      ensureDirs(dirname(p));
      mk(p, false);
    },
  };
}

const BASE = '/cache';
const VERSIONS = `${BASE}/accord/versions`;
const bundleOf = (v: string): string => `${VERSIONS}/${v}/node_modules/${PKG}/dist/cli.js`;
const NPM_CLI = '/usr/lib/node_modules/npm/bin/npm-cli.js';

/** One launcher call on a fresh world. `npm` decides what the install stub does; `onSleep` lets a test change the world while the call waits. */
function world(opts: { npm?: 'ok' | 'fail'; withNpmCli?: boolean; start?: number } = {}) {
  const clock = { t: opts.start ?? 1_000_000 };
  const m = memoryFs(clock);
  m.dir(VERSIONS);
  if (opts.withNpmCli !== false) m.file(NPM_CLI);
  const spawned: Spawned[] = [];
  const sleeps: number[] = [];
  const out: string[] = [];
  const err: string[] = [];
  let onSleep: ((nth: number) => void) | undefined;
  const spawnSync = (cmd: string, args: string[], o: Record<string, unknown> = {}) => {
    spawned.push({ cmd, args, opts: o });
    if (args.includes('install')) {
      if (opts.npm === 'fail') return { status: 1, stdout: '', stderr: 'npm ERR! 404 Not Found\nsecond line\n' };
      const temp = args[args.indexOf('--prefix') + 1] as string;
      m.file(`${temp}/node_modules/${PKG}/dist/cli.js`);
      return { status: 0, stdout: '', stderr: '' };
    }
    return { status: 0 };
  };
  const io = (argv: string[], extra: Io = {}): Io => ({
    argv,
    env: { XDG_CACHE_HOME: BASE },
    platform: 'linux',
    homedir: '/home/u',
    execPath: '/usr/bin/node',
    pid: 4242,
    readStdin: () => '{"hook_event_name":"PreToolUse"}',
    fs: m.fs,
    spawnSync,
    now: () => clock.t,
    sleep: (ms: number) => {
      m.calls.push(`sleep ${ms}`);
      sleeps.push(ms);
      clock.t += ms;
      onSleep?.(sleeps.length);
    },
    stdout: { write: (s: string) => out.push(s) },
    stderr: { write: (s: string) => err.push(s) },
    ...extra,
  });
  return {
    clock,
    m,
    spawned,
    sleeps,
    out,
    err,
    io,
    onSleep: (f: (nth: number) => void) => {
      onSleep = f;
    },
    npmCalls: () => spawned.filter((s) => s.args.includes('install')),
    bundleRuns: () => spawned.filter((s) => norm(s.args[0] ?? '') === bundleOf(V)),
  };
}

// Phase 08.9.2 D-01 (T-08.9.2-08): a version folder without its bundle is no entry; a lock folder lets one run install while the other waits; a stale lock is taken over.
it('risk:concurrency two fills of one version install once and a half-installed folder counts as missing (D-01)', () => {
  // A half-installed folder (no dist/cli.js) is removed and refilled, the install goes through a temp folder and the lock is gone after.
  const half = world();
  half.m.dir(`${VERSIONS}/${V}`);
  half.m.file(`${VERSIONS}/${V}/node_modules/leftover.txt`);
  expect(launch(half.io([V, 'hook', 'pre-tool-use']))).toBe(0);
  expect(half.npmCalls()).toHaveLength(1);
  expect(half.npmCalls()[0]?.args).toContain(`${PKG}@${V}`);
  expect(half.npmCalls()[0]?.args).toContain('--ignore-scripts');
  expect(half.m.has(bundleOf(V))).toBe(true);
  expect(half.m.has(`${VERSIONS}/${V}/node_modules/leftover.txt`)).toBe(false);
  expect(half.m.names(VERSIONS)).toEqual([V]);
  expect(half.bundleRuns()).toHaveLength(1);

  // A fresh lock held by another run: this run waits (injected sleep and clock), makes no npm call of its own and runs the bundle once it appears.
  const waiting = world();
  waiting.m.dir(`${VERSIONS}/.lock-${V}`);
  waiting.onSleep((nth) => {
    if (nth === 3) waiting.m.file(bundleOf(V));
  });
  expect(launch(waiting.io([V, 'hook', 'pre-tool-use']))).toBe(0);
  expect(waiting.sleeps).toEqual([200, 200, 200]);
  expect(waiting.npmCalls()).toHaveLength(0);
  expect(waiting.bundleRuns()).toHaveLength(1);
  expect(waiting.m.has(`${VERSIONS}/.lock-${V}`), 'the other run still owns its lock').toBe(true);

  // The other run released its lock and left no bundle (it failed): this run takes the lock and installs once itself.
  const released = world();
  released.m.dir(`${VERSIONS}/.lock-${V}`);
  released.onSleep((nth) => {
    if (nth === 2) released.m.fs.rmSync(`${VERSIONS}/.lock-${V}`);
  });
  expect(launch(released.io([V, 'hook', 'pre-tool-use']))).toBe(0);
  expect(released.npmCalls()).toHaveLength(1);
  expect(released.bundleRuns()).toHaveLength(1);
  expect(released.m.has(`${VERSIONS}/.lock-${V}`)).toBe(false);

  // A lock older than 10 minutes is taken over at once, with no wait.
  const stale = world();
  stale.m.dir(`${VERSIONS}/.lock-${V}`, stale.clock.t - 11 * MIN);
  expect(launch(stale.io([V, 'hook', 'pre-tool-use']))).toBe(0);
  expect(stale.sleeps).toEqual([]);
  expect(stale.npmCalls()).toHaveLength(1);
  expect(stale.m.has(bundleOf(V))).toBe(true);
  expect(stale.m.has(`${VERSIONS}/.lock-${V}`)).toBe(false);
});

// Phase 08.9.2 Ruling-planner-calls: after a successful fill the cache keeps the three newest version folders and never the one being run.
it('risk:resource a fill keeps the three newest versions and never the running one (Ruling-planner-calls)', () => {
  const others = { '1.1.0': 100, '1.2.0': 200, '1.3.0': 300, '1.4.0': 400 };
  const seed = (w: ReturnType<typeof world>): void => {
    for (const [v, t] of Object.entries(others)) {
      w.m.dir(`${VERSIONS}/${v}`, t);
      w.m.file(`${VERSIONS}/${v}/node_modules/${PKG}/dist/cli.js`);
    }
    w.m.dir(`${VERSIONS}/notes`, 1); // not a version folder: never listed for removal
  };

  // The running version is the oldest (its folder is made at clock 50): it stays, with the two newest others.
  const oldest = world({ start: 50 });
  seed(oldest);
  expect(launch(oldest.io([V, 'hook', 'pre-tool-use']))).toBe(0);
  expect(oldest.m.names(VERSIONS)).toEqual(['1.3.0', '1.4.0', 'notes', V].sort());

  // The running version is the newest: the three newest are left, which is the running one and the two newest others.
  const newest = world({ start: 1000 });
  seed(newest);
  expect(launch(newest.io([V, 'hook', 'pre-tool-use']))).toBe(0);
  expect(newest.m.names(VERSIONS)).toEqual(['1.3.0', '1.4.0', 'notes', V].sort());

  // No fill, no removal: a cached version leaves every folder where it is.
  const cached = world();
  seed(cached);
  cached.m.file(bundleOf(V));
  expect(launch(cached.io([V, 'hook', 'pre-tool-use']))).toBe(0);
  expect(cached.m.names(VERSIONS)).toEqual(['1.1.0', '1.2.0', '1.3.0', '1.4.0', 'notes', V].sort());
});

// Phase 08.9.2 Ruling-fill-fails: a failed install or a lock wait past 120 s prints one line naming the version and the fix; a hook exits 0, any other call 2.
it('risk:regression an install that fails prints one line naming the version and the fix and a hook exits 0 (Ruling-fill-fails)', () => {
  const fix = `node .claude/accord.mjs ${V} --version`;

  const start = world({ npm: 'fail' });
  expect(launch(start.io([V, 'hook', 'session-start']))).toBe(0);
  expect(start.err).toEqual([]);
  expect(start.out).toHaveLength(1);
  expect(start.out[0]).toContain(V);
  expect(start.out[0]).toContain(fix);
  expect(start.out[0]?.trimEnd().split('\n')).toHaveLength(1);
  expect(start.bundleRuns()).toHaveLength(0);
  // The temp folder and the lock are gone and no version folder was made.
  expect(start.m.names(VERSIONS)).toEqual([]);

  const guard = world({ npm: 'fail' });
  expect(launch(guard.io([V, 'hook', 'pre-tool-use']))).toBe(0);
  expect(guard.out).toEqual([]);
  expect(guard.err).toHaveLength(1);
  expect(guard.err[0]).toContain(fix);

  const dashboard = world({ npm: 'fail' });
  expect(launch(dashboard.io([V, 'dashboard', '--json']))).toBe(2);
  expect(dashboard.out).toEqual([]);
  expect(dashboard.err).toHaveLength(1);
  expect(dashboard.err[0]).toContain(V);
  expect(dashboard.err[0]).toContain(fix);

  // A lock held for good: the wait ends past 120 s of the injected clock, with the same line and no npm call.
  const stuck = world();
  const t0 = stuck.clock.t;
  stuck.m.dir(`${VERSIONS}/.lock-${V}`);
  expect(launch(stuck.io([V, 'hook', 'session-start']))).toBe(0);
  expect(stuck.clock.t - t0).toBeGreaterThanOrEqual(120_000);
  expect(stuck.clock.t - t0).toBeLessThan(121_000);
  expect(stuck.npmCalls()).toHaveLength(0);
  expect(stuck.out).toHaveLength(1);
  expect(stuck.out[0]).toContain(V);
  expect(stuck.out[0]).toContain(fix);
  expect(stuck.m.has(`${VERSIONS}/.lock-${V}`), 'the lock belongs to the other run').toBe(true);

  // No npm-cli.js beside Node: npm is called by name, with no shell outside win32, and the failure is the same one line.
  const noCli = world({ npm: 'fail', withNpmCli: false });
  expect(launch(noCli.io([V, 'hook', 'session-start']))).toBe(0);
  expect(noCli.npmCalls()[0]?.cmd).toBe('npm');
  expect(noCli.npmCalls()[0]?.opts.shell).toBe(false);
  expect(noCli.out).toHaveLength(1);
});

// Phase 08.9.2 D-01 (T-08.9.2-03): the version word is checked before any path or npm word is built, so nothing touches the fs or starts a process.
it('risk:security the version word is checked before any path or npm word is built (D-01)', () => {
  for (const word of ['../1.0.0', '1.0.0;rm', '1.0.0/x', '']) {
    const hook = world();
    hook.m.calls.length = 0;
    expect(launch(hook.io([word, 'hook', 'pre-tool-use'])), `hook with ${JSON.stringify(word)}`).toBe(0);
    expect(hook.m.calls).toEqual([]);
    expect(hook.spawned).toEqual([]);
    expect(hook.err).toHaveLength(1);
    expect(hook.err[0]).toContain('not a version');

    const call = world();
    call.m.calls.length = 0;
    expect(launch(call.io([word, 'status'])), `call with ${JSON.stringify(word)}`).toBe(2);
    expect(call.m.calls).toEqual([]);
    expect(call.spawned).toEqual([]);
  }
});

// Phase 08.9.2 D-01: a cached version starts the bundle once with the call's own words and the stdin text, through no npm and no shell.
it('risk:regression a cached version runs the bundle once with the call words and no npm (D-01)', () => {
  const w = world();
  w.m.file(bundleOf(V));
  w.m.calls.length = 0;
  expect(launch(w.io([V, 'hook', 'pre-tool-use']))).toBe(0);
  expect(w.spawned).toHaveLength(1);
  const call = w.spawned[0] as Spawned;
  expect(call.cmd).toBe('/usr/bin/node');
  expect(call.args.map(norm)).toEqual([bundleOf(V), 'hook', 'pre-tool-use']);
  expect(call.opts.input).toBe('{"hook_event_name":"PreToolUse"}');
  expect(call.opts.shell).toBeUndefined();
  expect(w.m.calls.filter((c) => !c.startsWith('existsSync'))).toEqual([]);
});
