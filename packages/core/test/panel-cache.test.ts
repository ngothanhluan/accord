// Phase 08.9.2 D-06 D-03 Ruling-planner-calls: the generated pane draws its last result first, redraws only when the background fetch's text differs, falls back to the plugin store when `$.fs` refuses, and stays closed while accord is off.
// The real register.js is driven through a fake host with an in-memory `$.fs` (a trimmed copy of the host of panel.test.ts, which this file does not import).
/* eslint-disable @typescript-eslint/no-explicit-any -- the fake host mirrors an untyped mod API */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
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
type El = { type: string; props: Record<string, any> };
const flat = (children: unknown): string => (Array.isArray(children) ? children : [children]).map((c: any) => (c && typeof c === 'object' ? flat(c.props?.children) : String(c ?? ''))).join('');

async function loadPanel(): Promise<{ register: (on: Handler) => void }> {
  const dir = mkdtempSync(join(tmpdir(), 'accord-panel-cache-'));
  dirs.push(dir);
  for (const f of pluginTargets({ runtimes: ['claude'] }, PKG)) {
    const p = join(dir, ...f.path.split('/'));
    mkdirSync(dirname(p), { recursive: true });
    writeFileSync(p, f.text);
  }
  return import(/* @vite-ignore */ pathToFileURL(join(dir, '.claude/accord-panel/plugin/hooks/register.js')).href);
}

const kindOf = (argv: string[]): 'fast' | 'full' | 'show' | 'other' =>
  argv[3] === 'show' ? 'show' : argv[3] === 'dashboard' ? (argv.includes('--no-fetch') ? 'fast' : 'full') : 'other';

// the in-memory file tree of a test: `files` by absolute path with `/` separators, `folders` as a set; `refuse` makes every write and read of a path under `.git` throw, as a host that denies the folder would
type Tree = { files: Map<string, string>; folders: Set<string>; refuseWrite: boolean; refuseRead: boolean };
const tree = (folders: string[] = [], files: Record<string, string> = {}): Tree => ({ files: new Map(Object.entries(files)), folders: new Set(folders), refuseWrite: false, refuseRead: false });

async function host(mod: { register: (on: Handler) => void }, root: string, fs: Tree = tree(), stored: Map<string, unknown> = new Map()) {
  type Hook = { event: string; matcher: Record<string, unknown>; fn: Handler };
  const hooks: Hook[] = [];
  mod.register((event: string, a: any, b?: any) => hooks.push(b ? { event, matcher: a, fn: b } : { event, matcher: {}, fn: a }));
  const open = new Set<string>();
  const pending: { argv: string[]; res: (r: Result) => void; rej: (e: unknown) => void }[] = [];
  const argvs: string[][] = [];
  let shown: El | undefined;
  const h = {
    fs,
    store: stored,
    async fire(event: string, e: any): Promise<any> {
      const chain = hooks.filter((x) => x.event === event && Object.entries(x.matcher).every(([k, v]) => e[k] === v));
      const run = (i: number): Promise<any> => (i >= chain.length ? Promise.resolve(e) : Promise.resolve(chain[i].fn($, e, () => run(i + 1))));
      return run(0);
    },
    settle: (kind: 'fast' | 'full' | 'show', r: Partial<Result>) => {
      const at = pending.findIndex((p) => kindOf(p.argv) === kind);
      if (at < 0) throw new Error('no pending ' + kind + ' run');
      pending.splice(at, 1)[0].res({ exitCode: 0, stdout: '', stderr: '', ...r });
    },
    count: (kind: 'fast' | 'full' | 'show') => argvs.filter((a) => kindOf(a) === kind).length,
    pendingCount: () => pending.length,
    argvs: () => argvs,
    isOpen: () => open.has('accord-panel'),
    texts: () => {
      const out: string[] = [];
      const walk = (n: any): void => {
        if (!n || typeof n !== 'object') return;
        if (n.type === 'Text') out.push(flat(n.props.children));
        else for (const c of n.props?.children ?? []) walk(c);
      };
      walk(shown);
      return out;
    },
  };
  const draw = async (): Promise<void> => {
    const r = await h.fire('ui.render', { component: 'Pane', requestId: 'accord-panel', surface: 'terminal', props: {} });
    if (r && r.type) shown = r;
  };
  const gone = (): never => {
    throw new Error('ENOENT');
  };
  const under = (p: string): boolean => p.includes('/.git');
  const $: any = {
    agent: { list: vi.fn(async () => []) },
    clock: { after: vi.fn(() => ({ cancel: () => undefined })), every: vi.fn(() => ({ cancel: () => undefined })) },
    session: { surfaces: vi.fn(async () => []), root: vi.fn(async () => root) },
    fs: {
      read: vi.fn(async (p: string) => (fs.refuseRead && under(p) ? gone() : (fs.files.get(p) ?? gone()))),
      write: vi.fn(async (p: string, text: string) => {
        if (fs.refuseWrite && under(p)) throw new Error('denied');
        fs.files.set(p, text);
      }),
      exists: vi.fn(async (p: string) => fs.files.has(p) || fs.folders.has(p)),
      stat: vi.fn(async (p: string) => (fs.files.has(p) ? { kind: 'file' } : fs.folders.has(p) ? { kind: 'dir' } : gone())),
    },
    store: {
      get: vi.fn(async (k: string) => (stored.has(k) ? JSON.parse(JSON.stringify(stored.get(k))) : undefined)),
      set: vi.fn(async (k: string, v: unknown) => void stored.set(k, JSON.parse(JSON.stringify(v)))),
    },
    process: {
      run: vi.fn((argv: string[]) => {
        argvs.push(argv);
        return new Promise<Result>((res, rej) => pending.push({ argv, res, rej }));
      }),
    },
    command: { register: vi.fn(async () => ({})), run: vi.fn(async () => ({})) },
    ui: {
      open: vi.fn(async ({ id }: { id: string }) => {
        open.add(id);
        await draw();
      }),
      panes: vi.fn(async () => [...open].map((id) => ({ id, title: id, isShown: true, isFocused: false, isPlaced: true }))),
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
  return Object.assign(h, { $ });
}

const board = (over: Record<string, unknown> = {}): Record<string, unknown> => ({
  yours: { rows: [], more: 0 },
  team: { rows: [], more: 0 },
  ready: { rows: [], more: 0 },
  epics: { rows: [], more: 0 },
  summary: { inProgress: 0, ready: 0, blocked: 0, backlog: 0, done: 0, withoutLane: 0, withSchemaErrors: 0 },
  ...over,
});
const dash = (id: string, title: string): string => JSON.stringify(board({ ready: { rows: [{ id, title }], more: 0 } }));
const start = { cwd: '.', surface: 'terminal', isInteractive: true };
const ROOT = '/work/repo';
const cacheOf = (text: string, over: Record<string, unknown> = {}): string => JSON.stringify({ v: '9.9.9', savedAt: 1, text, ...over });
const has = (h: { texts: () => string[] }, s: string): boolean => h.texts().some((t) => t.includes(s));

// Phase 08.9.2 D-06: the pane draws the saved dashboard before any process runs; a linked worktree's `.git` file points at the folder that holds the cache.
it('risk:regression the pane draws the cached result before any process runs (D-06)', async () => {
  const main = await host(await loadPanel(), ROOT, tree([ROOT + '/.git'], { [ROOT + '/.git/accord-panel.json']: cacheOf(dash('ST-5', 'Cached export')) }));
  await main.fire('session.start', start);
  await vi.waitFor(() => expect(main.pendingCount()).toBe(1));
  expect(has(main, 'ST-5')).toBe(true);
  expect(main.count('fast')).toBe(1);
  // the cache was drawn by the first draw, with the run still unsettled
  expect(main.$.fs.read).toHaveBeenCalledWith(ROOT + '/.git/accord-panel.json');
  // a linked worktree: `.git` is a file naming the folder, the cache is read from there
  const linked = await host(
    await loadPanel(),
    ROOT,
    tree([], { [ROOT + '/.git']: 'gitdir: ' + ROOT + '/../main/.git/worktrees/w\n', '/work/main/.git/worktrees/w/accord-panel.json': cacheOf(dash('ST-6', 'Cached linked')) }),
  );
  await linked.fire('session.start', start);
  await vi.waitFor(() => expect(linked.pendingCount()).toBe(1));
  expect(has(linked, 'ST-6')).toBe(true);
});

// Phase 08.9.2 D-06, T-08.9.2-32: a cache from another version, a text that is not a dashboard and a file that is not JSON draw nothing; the pane waits for its run.
it('risk:parsing a cache from another version or a broken cache is ignored (D-06)', async () => {
  const cases: Record<string, string> = {
    'another version': cacheOf(dash('ST-5', 'Cached export'), { v: '0.0.1' }),
    'text that is not json': cacheOf('{ not json'),
    'no text key': JSON.stringify({ v: '9.9.9', savedAt: 1 }),
    'text that is not a dashboard': cacheOf('{"yours":1}'),
    'a truncated file': cacheOf(dash('ST-5', 'Cached export')).slice(0, 40),
  };
  for (const [name, file] of Object.entries(cases)) {
    const h = await host(await loadPanel(), ROOT, tree([ROOT + '/.git'], { [ROOT + '/.git/accord-panel.json']: file }));
    await h.fire('session.start', start);
    await vi.waitFor(() => expect(h.pendingCount(), name).toBe(1));
    expect(h.texts(), name).toEqual(['Loading…']);
  }
});

// Phase 08.9.2 D-06 Ruling (background fetch): after the local draw one fetching run starts, single-flight, and the pane redraws only when its text differs; a failed run changes nothing drawn.
it('risk:resource the background fetch redraws only when its output differs (D-06)', async () => {
  const fs = tree([ROOT + '/.git']);
  const h = await host(await loadPanel(), ROOT, fs);
  await h.fire('session.start', start);
  await vi.waitFor(() => expect(h.count('fast')).toBe(1));
  const local = dash('ST-1', 'Local only');
  h.settle('fast', { stdout: local });
  await vi.waitFor(() => expect(has(h, 'ST-1')).toBe(true));
  // the cache holds what was drawn, and one fetching run follows the local one
  await vi.waitFor(() => expect(h.count('full')).toBe(1));
  expect(JSON.parse(fs.files.get(ROOT + '/.git/accord-panel.json') ?? '{}')).toMatchObject({ v: '9.9.9', text: local });
  expect(h.argvs().find((a) => kindOf(a) === 'full')?.slice(3)).toEqual(['dashboard', '--json']);
  // a second refresh while it runs starts no second fetching run
  await h.fire('turn.complete', { reason: 'answer' });
  await vi.waitFor(() => expect(h.count('fast')).toBe(2));
  h.settle('fast', { stdout: local });
  await new Promise((r) => setTimeout(r, 20));
  expect(h.count('full')).toBe(1);
  // the same text: no redraw
  const calls = (): number => h.$.ui.invalidate.mock.calls.length;
  const before = calls();
  h.settle('full', { stdout: local });
  await new Promise((r) => setTimeout(r, 20));
  expect(calls()).toBe(before);
  // a fresh refresh starts a new fetching run; a failed one leaves the drawn state and the cache as they are
  await h.fire('turn.complete', { reason: 'answer' });
  await vi.waitFor(() => expect(h.count('fast')).toBe(3));
  h.settle('fast', { stdout: local });
  await vi.waitFor(() => expect(h.count('full')).toBe(2));
  h.settle('full', { exitCode: 1, stderr: 'boom' });
  await new Promise((r) => setTimeout(r, 20));
  expect(has(h, 'ST-1')).toBe(true);
  expect(has(h, 'boom')).toBe(false);
  // a different text redraws once and rewrites the cache
  await h.fire('turn.complete', { reason: 'answer' });
  await vi.waitFor(() => expect(h.count('fast')).toBe(4));
  h.settle('fast', { stdout: local });
  await vi.waitFor(() => expect(h.count('full')).toBe(3));
  const fetched = dash('ST-2', 'Fetched teammate claim');
  const mark = calls();
  h.settle('full', { stdout: fetched });
  await vi.waitFor(() => expect(has(h, 'ST-2')).toBe(true));
  expect(calls() - mark).toBe(1);
  expect(JSON.parse(fs.files.get(ROOT + '/.git/accord-panel.json') ?? '{}')).toMatchObject({ text: fetched });
});

// Phase 08.9.2 D-06 fallback (RESEARCH A4): when the host refuses the write or the read under `.git`, the cache lives in the plugin's store under `cache:<root>`.
it('risk:regression a refused write under git moves the cache to the store (D-06)', async () => {
  const fs = tree([ROOT + '/.git']);
  fs.refuseWrite = true;
  const stored = new Map<string, unknown>();
  const h = await host(await loadPanel(), ROOT, fs, stored);
  await h.fire('session.start', start);
  await vi.waitFor(() => expect(h.count('fast')).toBe(1));
  const text = dash('ST-3', 'Kept in the store');
  h.settle('fast', { stdout: text });
  await vi.waitFor(() => expect(stored.has('cache:' + ROOT)).toBe(true));
  expect(stored.get('cache:' + ROOT)).toMatchObject({ v: '9.9.9', text });
  expect(fs.files.has(ROOT + '/.git/accord-panel.json')).toBe(false);
  // the next session reads it back, also when the read under `.git` is refused too
  const again = tree([ROOT + '/.git']);
  again.refuseRead = true;
  const next = await host(await loadPanel(), ROOT, again, stored);
  await next.fire('session.start', start);
  await vi.waitFor(() => expect(next.pendingCount()).toBe(1));
  expect(has(next, 'ST-3')).toBe(true);
  // a host with no `$.fs` at all works the same way
  const bare = await host(await loadPanel(), ROOT, tree(), new Map());
  delete bare.$.fs;
  await bare.fire('session.start', start);
  await vi.waitFor(() => expect(bare.count('fast')).toBe(1));
  bare.settle('fast', { stdout: text });
  await vi.waitFor(() => expect(bare.store.has('cache:' + ROOT)).toBe(true));
});

// Phase 08.9.2 D-03 Ruling (/accord-panel while off): the marker in the git common folder keeps the pane closed at session start and on a desktop attach; a typed command still opens it.
it('risk:regression the pane stays closed at session start while accord is off and opens on request (D-03)', async () => {
  const layouts: Record<string, Tree> = {
    'a main checkout': tree([ROOT + '/.git'], { [ROOT + '/.git/accord-off']: '' }),
    'a linked worktree': tree([], {
      [ROOT + '/.git']: 'gitdir: /work/main/.git/worktrees/w\n',
      '/work/main/.git/worktrees/w/commondir': '../..\n',
      '/work/main/.git/accord-off': '',
    }),
  };
  for (const [name, fs] of Object.entries(layouts)) {
    const h = await host(await loadPanel(), ROOT, fs);
    await h.fire('session.start', start);
    await h.fire('session.attach', { surface: 'desktop' });
    await new Promise((r) => setTimeout(r, 20));
    expect(h.$.ui.open, name).not.toHaveBeenCalled();
    expect(h.$.process.run, name).not.toHaveBeenCalled();
    expect(h.$.command.register, name).toHaveBeenCalled();
    await h.fire('command.run', { command: 'accord-panel' });
    expect(h.$.ui.open, name).toHaveBeenCalledWith(expect.objectContaining({ id: 'accord-panel', focus: true }));
    await vi.waitFor(() => expect(h.count('fast'), name).toBe(1));
  }
  // without the marker the same start opens the pane
  const on = await host(await loadPanel(), ROOT, tree([ROOT + '/.git']));
  await on.fire('session.start', start);
  expect(on.$.ui.open).toHaveBeenCalled();
});
