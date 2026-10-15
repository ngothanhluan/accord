// The generated Claude Code pane: the real register.js driven through a fake host that follows claude-code.d.ts.
/* eslint-disable @typescript-eslint/no-explicit-any -- the fake host mirrors an untyped mod API */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterEach, expect, it, vi } from 'vitest';
import { contentHash, markerHash, pluginTargets, withoutMarker } from '../src/index.js';

const PKG = { name: '@accord-dev/accord', version: '9.9.9' };
const dirs: string[] = [];
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

type El = { type: string; props: Record<string, any> };
type Handler = (...a: any[]) => any;
type Result = { exitCode: number; stdout: string; stderr: string };

async function loadPanel(): Promise<{ register: (on: Handler) => void }> {
  const dir = mkdtempSync(join(tmpdir(), 'accord-panel-'));
  dirs.push(dir);
  for (const f of pluginTargets({ runtimes: ['claude'] }, PKG)) {
    const p = join(dir, ...f.path.split('/'));
    mkdirSync(dirname(p), { recursive: true });
    writeFileSync(p, f.text);
  }
  return import(/* @vite-ignore */ pathToFileURL(join(dir, '.claude/accord-panel/plugin/hooks/register.js')).href);
}

async function host(mod: { register: (on: Handler) => void }) {
  type Hook = { event: string; matcher: Record<string, unknown>; fn: Handler };
  const hooks: Hook[] = [];
  mod.register((event: string, a: any, b?: any) => hooks.push(b ? { event, matcher: a, fn: b } : { event, matcher: {}, fn: a }));
  const open = new Set<string>();
  const pending: ((r: Result) => void)[] = [];
  const failers: ((e: unknown) => void)[] = [];
  let tree: El | undefined;
  let inputText = '';
  const h = {
    placed: true,
    tree: () => tree,
    async fire(event: string, e: any): Promise<any> {
      const chain = hooks.filter((x) => x.event === event && Object.entries(x.matcher).every(([k, v]) => e[k] === v));
      const run = (i: number): Promise<any> => (i >= chain.length ? Promise.resolve(e) : Promise.resolve(chain[i].fn($, e, () => run(i + 1))));
      return run(0);
    },
    settle: (r: Partial<Result>) => (pending.shift() as (r: Result) => void)({ exitCode: 0, stdout: '', stderr: '', ...r }),
    fail: (err: unknown) => (failers.shift() as (e: unknown) => void)(err),
    close: (id: string) => open.delete(id),
    nodes: (type: string): El[] => {
      const out: El[] = [];
      const walk = (n: any): void => {
        if (!n || typeof n !== 'object') return;
        if (n.type === type) out.push(n);
        for (const c of n.props?.children ?? []) walk(c);
      };
      walk(tree);
      return out;
    },
    texts: () => h.nodes('Text').map((n) => (n.props.children as unknown[]).join('')),
    buttons: () => h.nodes('Button').map((n) => n.props),
    input: () => h.nodes('Input')[0]?.props,
    field: () => inputText,
    type: (text: string) => ((inputText = text), h.input()?.onInput(text, {})),
  };
  const draw = async (): Promise<void> => {
    const r = await h.fire('ui.render', { component: 'Pane', requestId: 'accord-panel', surface: 'terminal' });
    if (r && r.type) tree = r;
    inputText = h.input()?.value ?? '';
  };
  const $: any = {
    process: { run: vi.fn(() => new Promise<Result>((res, rej) => (pending.push(res), failers.push(rej)))) },
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

it('risk:complex-branching the pane opens only in an interactive terminal and an unplaced pane names its command', async () => {
  for (const e of [{ ...start, isInteractive: false, surface: null }, { ...start, surface: 'desktop' }]) {
    const h = await host(await loadPanel());
    await h.fire('session.start', e);
    expect(h.$.command.register).not.toHaveBeenCalled();
    expect(h.$.ui.open).not.toHaveBeenCalled();
    expect(h.$.process.run).not.toHaveBeenCalled();
  }
  const unplaced = await host(await loadPanel());
  unplaced.placed = false;
  await unplaced.fire('session.start', start);
  expect(unplaced.$.ui.toast).toHaveBeenCalledTimes(1);
  expect(unplaced.$.ui.toast).toHaveBeenCalledWith('Run /accord-panel to show the accord dashboard');
  const placed = await host(await loadPanel());
  await placed.fire('session.start', start);
  expect(placed.$.ui.toast).not.toHaveBeenCalled();
});
