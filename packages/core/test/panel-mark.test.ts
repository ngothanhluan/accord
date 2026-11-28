// Phase 15 D-18, SC-7: the pane's change mark. The real register.js driven through a small fake host: a 1-second timer reads a few files of the clone's git folder through `$.fs` and runs
// `accord dashboard --json --no-fetch` only when they moved. The harness is a trimmed copy of panel.test.ts's, so this file runs on its own.
/* eslint-disable @typescript-eslint/no-explicit-any -- the fake host mirrors an untyped mod API */
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterEach, expect, it, vi } from 'vitest';
import { pluginTargets } from '../src/index.js';

const PKG = { name: '@accord-dev/accord', version: '9.9.9' };
const dirs: string[] = [];
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

type Handler = (...a: any[]) => any;
type Result = { exitCode: number; stdout: string; stderr: string };
type Timer = { ms: number; fn: () => unknown; cancelled: boolean; kind: string };

async function loadPanel(): Promise<{ register: (on: Handler) => void }> {
  const dir = mkdtempSync(join(tmpdir(), 'accord-panel-mark-'));
  dirs.push(dir);
  for (const f of pluginTargets({ runtimes: ['claude'] }, PKG)) {
    const p = join(dir, ...f.path.split('/'));
    mkdirSync(dirname(p), { recursive: true });
    writeFileSync(p, f.text);
  }
  return import(/* @vite-ignore */ pathToFileURL(join(dir, '.claude/accord-panel/plugin/hooks/register.js')).href);
}

const GIT = '/work/repo/.git';
const W2 = GIT + '/worktrees/w2/logs/HEAD';
const DASH = ['node', '/work/repo/.claude/accord.mjs', '9.9.9', 'dashboard', '--json', '--no-fetch'];
const BOARD = JSON.stringify({
  yours: { rows: [], more: 0 },
  team: { rows: [], more: 0 },
  ready: { rows: [], more: 0 },
  epics: { rows: [], more: 0 },
  summary: { inProgress: 0, ready: 0, blocked: 0, backlog: 0, done: 0, withoutLane: 0, withSchemaErrors: 0 },
});

async function host(withList = true) {
  const hooks: { event: string; matcher: Record<string, unknown>; fn: Handler }[] = [];
  (await loadPanel()).register((event: string, a: any, b?: any) => hooks.push(b ? { event, matcher: a, fn: b } : { event, matcher: {}, fn: a }));
  const open = new Set<string>();
  const runs: { res: (r: Result) => void }[] = [];
  const h = {
    // the in-memory text files of the fake `$.fs`, and the files whose size and time a test moves by hand
    files: new Map<string, string>(),
    sizes: new Map<string, number>([
      [GIT + '/logs/HEAD', 100],
      [W2, 50],
    ]),
    dirs: new Map<string, { name: string; kind: string }[]>([[GIT + '/worktrees', [{ name: 'w2', kind: 'dir' }]]]),
    placed: true,
    timers: [] as Timer[],
    async fire(event: string, e: any): Promise<any> {
      const chain = hooks.filter((x) => x.event === event && Object.entries(x.matcher).every(([k, v]) => e[k] === v));
      const run = (i: number): Promise<any> => (i >= chain.length ? Promise.resolve(e) : Promise.resolve(chain[i].fn(reg, e, () => run(i + 1))));
      const result = await run(0);
      for (let i = 0; i < 8; i++) await Promise.resolve();
      return result;
    },
    settle: (r: Partial<Result> = {}) => (runs.shift() as { res: (r: Result) => void }).res({ exitCode: 0, stdout: BOARD, stderr: '', ...r }),
    inflight: () => runs.length,
    close: (id: string) => open.delete(id),
    // the live `every` timers: the ones asked for and not cancelled
    live: (): Timer[] => h.timers.filter((t) => t.kind === 'every' && !t.cancelled),
  };
  const timer = (kind: string) => (ms: number, fn: () => unknown): { cancel: () => void } => {
    const t = { ms, fn, cancelled: false, kind };
    h.timers.push(t);
    return { cancel: () => void (t.cancelled = true) };
  };
  const statOf = (path: string): any => {
    if (h.files.has(path)) return { kind: 'file', size: (h.files.get(path) as string).length, mtimeMs: 1 };
    if (h.sizes.has(path)) return { kind: 'file', size: h.sizes.get(path), mtimeMs: 1 };
    if (path === GIT) return { kind: 'dir' };
    return undefined;
  };
  const $: any = {
    agent: { list: vi.fn(async () => []) },
    clock: { after: vi.fn(timer('after')), every: vi.fn(timer('every')) },
    session: { surfaces: vi.fn(async () => []), root: vi.fn(async () => '/work/repo') },
    fs: {
      read: vi.fn(async (path: string) => h.files.get(path) ?? Promise.reject(new Error('ENOENT'))),
      write: vi.fn(async (path: string, text: string) => void h.files.set(path, text)),
      exists: vi.fn(async (path: string) => statOf(path) !== undefined),
      stat: vi.fn(async (path: string) => statOf(path) ?? Promise.reject(new Error('ENOENT'))),
      ...(withList ? { list: vi.fn(async (path: string) => h.dirs.get(path) ?? Promise.reject(new Error('ENOENT'))) } : {}),
    },
    store: { get: vi.fn(async () => undefined), set: vi.fn(async () => undefined) },
    process: { run: vi.fn(() => new Promise<Result>((res) => runs.push({ res }))) },
    command: { register: vi.fn(async () => ({})), run: vi.fn(async () => ({})) },
    ui: {
      open: vi.fn(async ({ id }: { id: string }) => {
        open.add(id);
        await draw();
      }),
      panes: vi.fn(async () => [...open].map((id) => ({ id, title: id, isShown: h.placed, isFocused: false, isPlaced: h.placed }))),
      toast: vi.fn(() => undefined),
      invalidate: vi.fn(async (event: string) => {
        if (event === 'ui.render') await draw();
      }),
      resolve: () => ({
        Box: (p: any) => ({ type: 'Box', props: p }),
        Text: (p: any) => ({ type: 'Text', props: p }),
        Button: (p: any) => ({ type: 'Button', props: p }),
        Input: (p: any) => ({ type: 'Input', props: { ...p, value: p.value ?? '' } }),
        Progress: (p: any) => ({ type: 'Progress', props: p }),
      }),
    },
  };
  const draw = async (): Promise<void> => {
    await h.fire('ui.render', { component: 'Pane', requestId: 'accord-panel', surface: 'terminal', props: {} });
  };
  // a dashboard run without --no-fetch is the background run, which these tests do not count
  const reg: any = new Proxy($, {
    get: (t, k) => (k === 'process' ? { run: (argv: string[], o: unknown) => (argv[3] === 'dashboard' && !argv.includes('--no-fetch') ? new Promise<Result>(() => undefined) : t.process.run(argv, o)) } : t[k as string]),
  });
  return Object.assign(h, { $ });
}

// every promise the fake host holds has run: it has no real timers, so one macrotask is enough
const quiet = (): Promise<void> => new Promise((r) => setTimeout(r, 0));

const START = { cwd: '.', surface: 'terminal', isInteractive: true };

// the pane open in an interactive terminal, its first dashboard run settled, so every later process is the mark's doing
async function openPane(withList = true): Promise<Awaited<ReturnType<typeof host>>> {
  const h = await host(withList);
  await h.fire('session.start', START);
  h.settle();
  await quiet();
  return h;
}

const calls = (h: Awaited<ReturnType<typeof host>>): number => h.$.process.run.mock.calls.length;

it('risk:resource ac-1 an open pane in an interactive session holds exactly one mark timer of 1000 ms and no frame timer while idle (D-18)', async () => {
  const h = await openPane();
  expect(h.live().map((t) => t.ms)).toEqual([1000]);
  expect(h.$.clock.every).toHaveBeenCalledTimes(1);
  expect(h.$.clock.after).not.toHaveBeenCalled();
});

it('risk:resource a tick with no file change starts no process (D-18)', async () => {
  const h = await openPane();
  const base = calls(h);
  for (let i = 0; i < 5; i++) await h.live()[0].fn();
  expect(calls(h)).toBe(base);
});

it('risk:regression a commit in another worktree moves the mark and the pane runs the dashboard once, from local refs (D-18, SC-7)', async () => {
  const h = await openPane();
  const base = calls(h);
  // another session's commit appends to its own worktree's reflog, which the first session reads through $.fs
  h.sizes.set(W2, 120);
  await h.live()[0].fn();
  await quiet();
  expect(calls(h)).toBe(base + 1);
  expect(h.$.process.run).toHaveBeenLastCalledWith(DASH, { timeoutMs: 120000 });
  h.settle();
  await quiet();
  // the new mark is the one kept: the next tick runs nothing
  await h.live()[0].fn();
  expect(calls(h)).toBe(base + 1);
});

it('risk:resource two ticks while a dashboard run is pending start no second run (D-18, single flight)', async () => {
  const h = await openPane();
  const base = calls(h);
  h.sizes.set(W2, 120);
  await h.live()[0].fn();
  await quiet();
  h.sizes.set(W2, 140);
  await h.live()[0].fn();
  await h.live()[0].fn();
  await quiet();
  expect(calls(h)).toBe(base + 1);
  expect(h.inflight()).toBe(1);
  // the one change that came in meanwhile is made up by one more run, not by one run per tick
  h.settle();
  await quiet();
  expect(calls(h)).toBe(base + 2);
  h.settle();
  await quiet();
  expect(h.inflight()).toBe(0);
  expect(calls(h)).toBe(base + 2);
});

it('risk:regression a file that appears, or a hold that is written, moves the mark too (D-18)', async () => {
  const h = await openPane();
  const base = calls(h);
  h.sizes.set(GIT + '/accord/holds', 30);
  await h.live()[0].fn();
  await quiet();
  expect(calls(h)).toBe(base + 1);
});

it('risk:security the tick reads a fixed set of files of the git folder through $.fs and starts only the launcher (D-18, T-15-10, T-15-11)', async () => {
  const h = await openPane();
  h.$.fs.stat.mockClear();
  h.$.fs.read.mockClear();
  h.$.fs.list.mockClear();
  await h.live()[0].fn();
  const touched = [...h.$.fs.stat.mock.calls, ...h.$.fs.read.mock.calls, ...h.$.fs.list.mock.calls, ...h.$.fs.exists.mock.calls.slice(-1)].map((c: unknown[]) => String(c[0]));
  expect(touched.length).toBeGreaterThan(0);
  for (const p of touched) expect(p.startsWith(GIT + '/')).toBe(true);
  for (const [argv] of h.$.process.run.mock.calls as [string[]][]) expect(argv.slice(0, 2)).toEqual(['node', '/work/repo/.claude/accord.mjs']);
  const source = readFileSync(new URL('../panel/register.js', import.meta.url), 'utf8');
  expect(source).not.toMatch(/process\.run\(\s*\[\s*'git'|'git'/);
  expect(source.match(/MARK_POLL_MS/g)?.length ?? 0).toBeGreaterThanOrEqual(2);
});

it('risk:compat the panel never reads a $ host call as a value, which Claude Code 2.1.332 refuses for the whole module (GitHub #398)', () => {
  for (const name of ['register.js', 'view.js']) {
    const code = readFileSync(new URL('../panel/' + name, import.meta.url), 'utf8').replace(/^\s*\/\/.*$/gm, '').replace(/\s\/\/ .*$/gm, '');
    const read = [...code.matchAll(/\$\.[A-Za-z]+\.[A-Za-z]+(?!\s*[(A-Za-z])/g)].map((m) => name + ': ' + m[0]);
    expect(read).toEqual([]);
  }
});

it('risk:parsing a host whose $.fs.list answers no list finds the worktrees from the CLI record (GitHub #398)', async () => {
  const h = await host();
  h.$.fs.list.mockImplementation(async () => undefined);
  h.files.set(GIT + '/accord/worktrees', 'ST-2\t/work/w2\n');
  h.files.set('/work/w2/.git', 'gitdir: ' + GIT + '/worktrees/w2\n');
  await h.fire('session.start', START);
  h.settle();
  await quiet();
  const base = calls(h);
  h.sizes.set(W2, 90);
  await h.live()[0].fn();
  await quiet();
  expect(calls(h)).toBe(base + 1);
});

it('risk:parsing a host without $.fs.list finds the worktrees from the CLI record and their .git files (D-18)', async () => {
  const h = await host(false);
  h.files.set(GIT + '/accord/worktrees', 'ST-2\t/work/w2\nbad line\n');
  h.files.set('/work/w2/.git', 'gitdir: ' + GIT + '/worktrees/w2\n');
  await h.fire('session.start', START);
  h.settle();
  await quiet();
  expect(h.live().map((t) => t.ms)).toEqual([1000]);
  const base = calls(h);
  h.sizes.set(W2, 90);
  await h.live()[0].fn();
  await quiet();
  expect(calls(h)).toBe(base + 1);
});

// ---- stop conditions (D-16, D-18) ----

it('risk:resource accord off for the clone: no mark timer, and a timer running when the marker appears is cancelled at its next tick (D-18)', async () => {
  const off = await host();
  off.files.set(GIT + '/accord-off', '');
  // a typed /accord-panel opens the pane even while accord is off; it still starts no timer
  await off.fire('command.run', { command: 'accord-panel' });
  expect(off.live()).toEqual([]);
  expect(calls(off)).toBe(1);
  const h = await openPane();
  const timer = h.live()[0];
  h.files.set(GIT + '/accord-off', '');
  const base = calls(h);
  h.sizes.set(W2, 500);
  await timer.fn();
  expect(timer.cancelled).toBe(true);
  expect(h.live()).toEqual([]);
  expect(calls(h)).toBe(base);
});

it('risk:resource a headless session starts no mark timer, whatever the pane does (D-18)', async () => {
  const h = await host();
  await h.fire('session.start', { cwd: '.', surface: null, isInteractive: false });
  await h.fire('command.run', { command: 'accord-panel' });
  expect(h.live()).toEqual([]);
  expect(h.$.clock.every).not.toHaveBeenCalled();
});

it('risk:resource a pane that is closed or not placed loses its mark timer at the next tick and gets one again when it opens (D-18)', async () => {
  const h = await openPane();
  const first = h.live()[0];
  h.placed = false;
  const base = calls(h);
  h.sizes.set(W2, 777);
  await first.fn();
  expect(first.cancelled).toBe(true);
  expect(calls(h)).toBe(base);
  // reopened and placed: one timer again, and only one however often it is drawn
  h.placed = true;
  await h.fire('command.run', { command: 'accord-panel' });
  await h.$.ui.invalidate('ui.render');
  await h.$.ui.invalidate('ui.render');
  expect(h.live()).toHaveLength(1);
  expect(h.live()[0]).not.toBe(first);
  // closed outright: the pane is gone from the host's list
  h.close('accord-panel');
  await h.live()[0].fn();
  expect(h.live()).toEqual([]);
});

it('risk:complex-branching a host without $.clock gets no timer and no error (D-18)', async () => {
  const h = await host();
  delete h.$.clock;
  await h.fire('session.start', START);
  await h.fire('command.run', { command: 'accord-panel' });
  expect(h.timers).toEqual([]);
  expect(h.$.ui.open).toHaveBeenCalled();
});
