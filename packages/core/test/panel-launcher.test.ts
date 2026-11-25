// Phase 08.9.2 D-01 D-05 Ruling-structural Ruling-fill-fails: the generated pane runs only the hook launcher at the pinned version, one dashboard run per refresh, and draws the claimed ticket's tab from that run.
// The real register.js is driven through a fake host that follows claude-code.d.ts (a trimmed copy of the host of panel.test.ts, which this file does not import).
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
  const dir = mkdtempSync(join(tmpdir(), 'accord-panel-launcher-'));
  dirs.push(dir);
  for (const f of pluginTargets({ runtimes: ['claude'] }, PKG)) {
    const p = join(dir, ...f.path.split('/'));
    mkdirSync(dirname(p), { recursive: true });
    writeFileSync(p, f.text);
  }
  return import(/* @vite-ignore */ pathToFileURL(join(dir, '.claude/accord-panel/plugin/hooks/register.js')).href);
}

// which kind of run an argv is: the draw path (`dashboard --json --no-fetch`), the background fetch (`dashboard --json`) or a `show`
const kindOf = (argv: string[]): 'fast' | 'full' | 'show' | 'other' =>
  argv[3] === 'show' ? 'show' : argv[3] === 'dashboard' ? (argv.includes('--no-fetch') ? 'fast' : 'full') : 'other';

async function host(mod: { register: (on: Handler) => void }, root: string) {
  type Hook = { event: string; matcher: Record<string, unknown>; fn: Handler };
  const hooks: Hook[] = [];
  mod.register((event: string, a: any, b?: any) => hooks.push(b ? { event, matcher: a, fn: b } : { event, matcher: {}, fn: a }));
  const open = new Set<string>();
  const pending: { argv: string[]; res: (r: Result) => void; rej: (e: unknown) => void }[] = [];
  const argvs: string[][] = [];
  let tree: El | undefined;
  const h = {
    tree: () => tree,
    async fire(event: string, e: any): Promise<any> {
      const chain = hooks.filter((x) => x.event === event && Object.entries(x.matcher).every(([k, v]) => e[k] === v));
      const run = (i: number): Promise<any> => (i >= chain.length ? Promise.resolve(e) : Promise.resolve(chain[i].fn($, e, () => run(i + 1))));
      return run(0);
    },
    // settles the oldest pending run of a kind
    settle: (kind: 'fast' | 'full' | 'show', r: Partial<Result>) => {
      const at = pending.findIndex((p) => kindOf(p.argv) === kind);
      if (at < 0) throw new Error('no pending ' + kind + ' run');
      pending.splice(at, 1)[0].res({ exitCode: 0, stdout: '', stderr: '', ...r });
    },
    count: (kind: 'fast' | 'full' | 'show') => argvs.filter((a) => kindOf(a) === kind).length,
    pendingCount: () => pending.length,
    argvs: () => argvs,
    nodes: (type: string): El[] => {
      const out: El[] = [];
      const walk = (n: any): void => {
        if (!n || typeof n !== 'object') return;
        if (n.type === type) out.push(n);
        if (n.type === 'Text') return;
        for (const c of n.props?.children ?? []) walk(c);
      };
      walk(tree);
      return out;
    },
    texts: () => h.nodes('Text').map((n) => flat(n.props.children)),
    buttons: () => h.nodes('Button').map((n) => n.props),
  };
  const draw = async (): Promise<void> => {
    const r = await h.fire('ui.render', { component: 'Pane', requestId: 'accord-panel', surface: 'terminal', props: {} });
    if (r && r.type) tree = r;
  };
  const $: any = {
    agent: { list: vi.fn(async () => []) },
    clock: { after: vi.fn(() => ({ cancel: () => undefined })), every: vi.fn(() => ({ cancel: () => undefined })) },
    session: { surfaces: vi.fn(async () => []), root: vi.fn(async () => root) },
    store: { get: vi.fn(async () => undefined), set: vi.fn(async () => undefined) },
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
const detailOf = (over: Record<string, unknown> = {}): Record<string, unknown> => ({
  id: 'ST-1',
  title: 'Login form',
  stage: 'build',
  lane: 'M',
  tasksDone: 1,
  tasksTotal: 3,
  branch: 't/ST-1',
  holder: 'me@x',
  blockedBy: [],
  intent: ['Owners log in.'],
  criteria: [],
  ...over,
});
const claimedBoard = (detail: Record<string, unknown> = detailOf()): string =>
  JSON.stringify(
    board({
      current: 'ST-1',
      currentDetail: detail,
      yours: { rows: [{ id: 'ST-1', title: 'Login form' }], more: 0 },
      ready: { rows: [{ id: 'ST-2', title: 'Export' }], more: 0 },
    }),
  );
const start = { cwd: '.', surface: 'terminal', isInteractive: true };
const ROOT = '/work/repo with space';

// Phase 08.9.2 D-01: every process the pane starts is `node <root>/.claude/accord.mjs <version> ...`; the root holds a space and stays one word.
it('risk:security the pane runs only the launcher at the pinned version and never npx (D-01)', async () => {
  const h = await host(await loadPanel(), ROOT);
  await h.fire('session.start', start);
  await vi.waitFor(() => expect(h.count('fast')).toBe(1));
  h.settle('fast', { stdout: claimedBoard() });
  await vi.waitFor(() => expect(h.texts()).toContain('build 1/3'));
  // a detail the person opens runs through the launcher too
  const dash = h.buttons().find((b) => b.key === 'tab:dashboard');
  dash?.onPress();
  await vi.waitFor(() => expect(h.buttons().some((b) => b.key === 'show:ST-2')).toBe(true));
  h.buttons().find((b) => b.key === 'show:ST-2')?.onPress();
  await vi.waitFor(() => expect(h.count('show')).toBe(1));
  const all = h.argvs();
  expect(all.length).toBeGreaterThanOrEqual(2);
  for (const argv of all) {
    expect(argv.slice(0, 3)).toEqual(['node', ROOT + '/.claude/accord.mjs', '9.9.9']);
    expect(argv).not.toContain('npx');
    expect(argv).not.toContain('--yes');
  }
});

// Phase 08.9.2 D-05 Ruling-structural: the draw path is one `dashboard --json --no-fetch` run; the claimed ticket's tab takes its state from `currentDetail`, so no `show` runs for it.
it('risk:resource a refresh draws from one dashboard run and runs no show for the claimed ticket (D-05)', async () => {
  const h = await host(await loadPanel(), ROOT);
  await h.fire('session.start', start);
  await vi.waitFor(() => expect(h.count('fast')).toBe(1));
  expect(h.argvs()[0].slice(3)).toEqual(['dashboard', '--json', '--no-fetch']);
  h.settle('fast', { stdout: claimedBoard(detailOf({ tasksDone: 2 })) });
  await vi.waitFor(() => expect(h.texts()).toContain('build 2/3'));
  expect(h.texts()).toContain('Login form');
  expect(h.count('fast')).toBe(1);
  expect(h.count('show')).toBe(0);
  // the next turn's refresh is again one run of the same shape, and its `currentDetail` redraws the tab
  await h.fire('turn.complete', { reason: 'answer' });
  await vi.waitFor(() => expect(h.count('fast')).toBe(2));
  h.settle('fast', { stdout: claimedBoard(detailOf({ tasksDone: 3 })) });
  await vi.waitFor(() => expect(h.texts()).toContain('build 3/3'));
  expect(h.count('fast')).toBe(2);
  expect(h.count('show')).toBe(0);
  // a detail the person opens is the only reason a `show` runs
  h.buttons().find((b) => b.key === 'tab:dashboard')?.onPress();
  await vi.waitFor(() => expect(h.buttons().some((b) => b.key === 'show:ST-2')).toBe(true));
  h.buttons().find((b) => b.key === 'show:ST-2')?.onPress();
  await vi.waitFor(() => expect(h.count('show')).toBe(1));
  expect(h.argvs().filter((a) => kindOf(a) === 'show')[0].slice(3)).toEqual(['show', 'ST-2', '--json']);
});

// Phase 08.9.2 Ruling-fill-fails: the launcher's failure line (exit 2, one stderr line) is the failure text the pane draws.
it('risk:regression the launcher fill failure line reaches the pane (Ruling-fill-fails)', async () => {
  const h = await host(await loadPanel(), ROOT);
  await h.fire('session.start', start);
  await vi.waitFor(() => expect(h.count('fast')).toBe(1));
  const line = 'accord: accord 9.9.9 is not installed and could not be installed (offline); with network access run: node .claude/accord.mjs 9.9.9 --version';
  h.settle('fast', { exitCode: 2, stderr: line + '\n' });
  await vi.waitFor(() => expect(h.texts()).toContain(line));
});
