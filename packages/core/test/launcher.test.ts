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
const { launch, readHookInput } = (await import(/* @vite-ignore */ href)) as { launch: (io: Io) => number; readHookInput: (io: Io) => string };

const norm = (p: string): string => p.replace(/\\/g, '/');
const fsError = (code: string): Error => Object.assign(new Error(`${code}: simulated`), { code });

type Node_ = { dir: boolean; mtimeMs: number };

/** A small in-memory fs that records every call, with the few methods the launcher uses. */
function memoryFs(clock: { t: number }) {
  const nodes = new Map<string, Node_>();
  const calls: string[] = [];
  const texts = new Map<string, string>();
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
    readFileSync: (p: string) => {
      calls.push(`readFileSync ${norm(p)}`);
      const t = texts.get(norm(p));
      if (t === undefined) throw fsError('ENOENT');
      return t;
    },
  };
  return {
    fs,
    calls,
    text: (p: string, content: string) => {
      ensureDirs(dirname(p));
      mk(p, false);
      texts.set(norm(p), content);
    },
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

// Phase 08.9.2 D-03 (08.9.2-06): before anything else a hook call reads `<launcher root>/.git` once, looking for the person's off marker; in these worlds there is none.
const OFF_LOOKUP = ['readFileSync /repo/.git'];

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
      const prefix = args[args.indexOf('--prefix') + 1] as string;
      const temp = prefix === '.' ? (o.cwd as string) : prefix; // npm resolves a relative prefix against the child's working directory
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
    launcherPath: '/repo/.claude/accord.mjs',
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
    expect(hook.m.calls).toEqual(OFF_LOOKUP); // a hook first looks for the person's off marker (08.9.2-06); nothing else is touched
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
  expect(w.m.calls.filter((c) => !c.startsWith('existsSync') && !OFF_LOOKUP.includes(c))).toEqual([]);
});

const pre = (call: Record<string, unknown>): string => JSON.stringify({ hook_event_name: 'PreToolUse', ...call });

// Phase 08.9.2 Ruling-quiet-hooks (D-01): an Agent or Task call that is not an executor dispatch is answered by the launcher with `{}`, before any cache path is built.
it('risk:resource a non-executor Agent call is answered by the launcher with no process and no cache read (Ruling-quiet-hooks)', () => {
  const calls = [
    pre({ tool_name: 'Agent', tool_input: { subagent_type: 'Explore' } }),
    pre({ tool_name: 'Task', tool_input: { subagent_type: 'Explore' } }),
    pre({ tool_name: 'Agent' }),
    pre({ tool_name: 'Agent', tool_input: null }),
  ];
  for (const stdin of calls) {
    const w = world(); // nothing cached: an answer that needed the bundle would have to fill it
    w.m.calls.length = 0;
    expect(launch(w.io([V, 'hook', 'pre-tool-use'], { readStdin: () => stdin })), stdin).toBe(0);
    expect(w.out.join('')).toBe('{}\n');
    expect(w.err).toEqual([]);
    expect(w.spawned).toEqual([]);
    expect(w.m.calls).toEqual(OFF_LOOKUP); // only the off-marker lookup, no cache path
  }
});

// Phase 08.9.2 D-01 (T-08.9.2-12, T-08.9.2-13): the write guard and the executor model guard live in the CLI, so the launcher hands those calls over with the stdin text.
it('risk:security the launcher passes a verification write and an executor dispatch to the bundle (D-01)', () => {
  const passed = [
    pre({ tool_name: 'Write', tool_input: { file_path: 'accord/tickets/T-1/verification.md' } }),
    pre({ tool_name: 'Edit', tool_input: { file_path: 'accord/tickets/T-1/verification.md' } }),
    pre({ tool_name: 'MultiEdit', tool_input: { file_path: 'accord/tickets/T-1/verification.md' } }),
    pre({ tool_name: 'Agent', tool_input: { subagent_type: 'accord-executor' } }),
    pre({ tool_name: 'Task', tool_input: { subagent_type: 'accord-executor' } }),
    'not json at all',
    '',
  ];
  for (const stdin of passed) {
    const w = world();
    w.m.file(bundleOf(V));
    expect(launch(w.io([V, 'hook', 'pre-tool-use'], { readStdin: () => stdin })), stdin).toBe(0);
    expect(w.out).toEqual([]);
    expect(w.bundleRuns(), stdin).toHaveLength(1);
    expect(w.spawned[0]?.opts.input, stdin).toBe(stdin);
  }
});

// Phase 08.9.2 D-01 (the D-04 line `node .claude/accord.mjs off`): a command word first takes its version from accord/config.yml beside the launcher's folder.
it('risk:parsing a command word first reads the pin from accord config beside the launcher (D-01)', () => {
  const pinned = world();
  pinned.m.text('/repo/accord/config.yml', 'schema: 1\naccord: "0.19.0"\nmode: team\n');
  pinned.m.file(bundleOf('0.19.0'));
  expect(launch(pinned.io(['off']))).toBe(0);
  expect(pinned.spawned).toHaveLength(1);
  expect((pinned.spawned[0] as Spawned).args.map(norm)).toEqual([bundleOf('0.19.0'), 'off']);
  expect(pinned.err).toEqual([]);

  // A bare unquoted pin works, and a call with more words keeps them all.
  const bare = world();
  bare.m.text('/repo/accord/config.yml', 'accord: 0.19.0\n');
  bare.m.file(bundleOf('0.19.0'));
  expect(launch(bare.io(['wake', '--now']))).toBe(0);
  expect((bare.spawned[0] as Spawned).args.map(norm)).toEqual([bundleOf('0.19.0'), 'wake', '--now']);

  // No pin line, a pin that is not a version, no config file, and a flag first: one stderr line, exit 2, no process.
  const missing = [
    { setup: (w: ReturnType<typeof world>) => w.m.text('/repo/accord/config.yml', 'schema: 1\n'), argv: ['off'] },
    { setup: (w: ReturnType<typeof world>) => w.m.text('/repo/accord/config.yml', 'accord: ../x\n'), argv: ['off'] },
    { setup: () => undefined, argv: ['off'] },
    { setup: (w: ReturnType<typeof world>) => w.m.text('/repo/accord/config.yml', 'accord: "0.19.0"\n'), argv: ['--version'] },
  ];
  for (const c of missing) {
    const w = world();
    c.setup(w);
    expect(launch(w.io(c.argv)), JSON.stringify(c.argv)).toBe(2);
    expect(w.spawned).toEqual([]);
    expect(w.err).toHaveLength(1);
    expect(w.err[0]?.trimEnd().split('\n')).toHaveLength(1);
  }
});

// Phase 08.9.2 review WR-01: the pin line takes every form `accord upgrade` writes and accepts (the grammar of scaffold/repin.ts), so the off line a session start prints works in each.
it('risk:parsing the pin line takes a quoted pin a single-quoted pin and a pin with a comment (WR-01)', () => {
  for (const line of ['accord: "0.19.0" # pinned', "accord: '0.19.0'", 'accord: 0.19.0 # comment', 'accord:   "0.19.0"', 'accord: 0.19.0\r']) {
    const w = world();
    w.m.text('/repo/accord/config.yml', `schema: 1\n${line}\nmode: team\n`);
    w.m.file(bundleOf('0.19.0'));
    expect(launch(w.io(['off'])), line).toBe(0);
    expect(w.err, line).toEqual([]);
    expect((w.spawned[0] as Spawned | undefined)?.args.map(norm), line).toEqual([bundleOf('0.19.0'), 'off']);
  }
  // a key with no value on its line takes nothing from the next line
  const split = world();
  split.m.text('/repo/accord/config.yml', 'accord:\nfoo: bar\n');
  expect(launch(split.io(['off']))).toBe(2);
  expect(split.spawned).toEqual([]);
  expect(split.err[0]).toContain('no "accord:" pin found');
});

/** The stdin seam of readHookInput: `reads` is what each readSync call does (a byte string, an error code, or end of input). */
function stdinWorld(reads: (string | Buffer | { code: string })[], isTTY = false) {
  const queue = [...reads];
  const err: string[] = [];
  const sleeps: number[] = [];
  let calls = 0;
  const io = {
    isTTY,
    readSync: (_fd: number, buf: Buffer) => {
      calls++;
      const next = queue.shift();
      if (next === undefined) return 0;
      if (typeof next === 'object' && !Buffer.isBuffer(next)) throw Object.assign(new Error(next.code + ': simulated'), { code: next.code });
      return (Buffer.isBuffer(next) ? next : Buffer.from(next, 'utf8')).copy(buf);
    },
    sleep: (ms: number) => sleeps.push(ms),
    stderr: { write: (s: string) => err.push(s) },
  };
  return { io, err, sleeps, calls: () => calls };
}

// Phase 08.9.2 review WR-03: the launcher never waits on a terminal's stdin, reads a pipe in chunks whatever their split, and says so on stderr when the input cannot be read (the CLI then fails open on an empty input).
it('risk:resource the launcher reads hook input in chunks skips a terminal and names a failed read (WR-03)', () => {
  const tty = stdinWorld(['never read'], true);
  expect(readHookInput(tty.io)).toBe('');
  expect(tty.calls(), 'a terminal is not read').toBe(0);

  // one two-byte character split over two chunks is decoded whole
  const bytes = Buffer.from('{"a":"é"}', 'utf8');
  const split = bytes.indexOf(0xc3) + 1;
  const chunked = stdinWorld([bytes.subarray(0, split), bytes.subarray(split)]);
  expect(readHookInput(chunked.io)).toBe('{"a":"é"}');

  // a pipe that is not ready yet is waited for, a closed Windows pipe is an end, and neither is reported
  const slow = stdinWorld([{ code: 'EAGAIN' }, { code: 'EAGAIN' }, '{"x":1}', { code: 'EOF' }]);
  expect(readHookInput(slow.io)).toBe('{"x":1}');
  expect(slow.sleeps).toHaveLength(2);
  expect(slow.err).toEqual([]);

  // any other failure: one stderr line, and what was read so far
  const broken = stdinWorld(['{"x"', { code: 'EBADF' }]);
  expect(readHookInput(broken.io)).toBe('{"x"');
  expect(broken.err).toHaveLength(1);
  expect(broken.err[0]).toContain('accord: could not read hook input');
  expect(broken.err[0]).toContain('EBADF');

  // a pipe that never becomes ready stops after a bounded wait
  const stuck = stdinWorld(Array.from({ length: 200 }, () => ({ code: 'EAGAIN' })));
  expect(readHookInput(stuck.io)).toBe('');
  expect(stuck.sleeps.length).toBeLessThan(100);
  expect(stuck.err).toHaveLength(1);
});

// Phase 08.9.2 review WR-04: the Windows shell fallback of the install (no npm-cli.js beside Node) carries no user path in the shell command; the temporary folder is the child's working directory.
it('risk:security the shell fallback of the install on Windows carries no path in its command (WR-04)', () => {
  for (const home of ['/Users/Luan Ngo/AppData/Local', '/Users/a&b/AppData/Local']) {
    const w = world({ withNpmCli: false });
    expect(launch(w.io([V, 'hook', 'session-start'], { platform: 'win32', env: { LOCALAPPDATA: home } })), home).toBe(0);
    const install = w.npmCalls();
    expect(install, home).toHaveLength(1);
    const call = install[0] as Spawned;
    expect(call.cmd).toBe('npm');
    expect(call.opts.shell, 'the one shell of the launcher').toBe(true);
    expect(call.args.filter((a) => /[ &]|\.tmp-|Users/.test(a)), `no argument holds a path of ${home}`).toEqual([]);
    expect(call.args[call.args.indexOf('--prefix') + 1], 'the prefix is the working directory').toBe('.');
    expect(norm(String(call.opts.cwd)), 'the temporary folder is where npm runs').toContain(home + '/accord/versions/.tmp-');
    expect(w.m.has(bundleOf(V).replace(/^\/cache/, home)), 'the install lands in the cache').toBe(true);
  }
});
