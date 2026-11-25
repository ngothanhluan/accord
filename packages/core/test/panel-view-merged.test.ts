// Phase 15 D-29, SC-6 (15-04): the pane's dashboard tab draws the "merged, waiting for verify" group with a Continue action, and a dashboard JSON with no `mergedWaiting` key draws exactly as before.
// view.js is loaded from the generated plugin files, as the real pane loads it.
/* eslint-disable @typescript-eslint/no-explicit-any -- view.js is untyped JavaScript */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterEach, expect, it } from 'vitest';
import { pluginTargets } from '../src/index.js';

const dirs: string[] = [];
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

async function loadView(): Promise<{ view: (state: unknown, query: string, columns?: number) => any; outcome: (r: { exitCode: number; stdout: string; stderr: string }) => any }> {
  const dir = mkdtempSync(join(tmpdir(), 'accord-panel-merged-'));
  dirs.push(dir);
  for (const f of pluginTargets({ runtimes: ['claude'] }, { name: '@accord-dev/accord', version: '9.9.9' })) {
    const p = join(dir, ...f.path.split('/'));
    mkdirSync(dirname(p), { recursive: true });
    writeFileSync(p, f.text);
  }
  return import(/* @vite-ignore */ pathToFileURL(join(dir, '.claude/accord-panel/plugin/hooks/view.js')).href);
}

const dashboard = (over: Record<string, unknown> = {}): Record<string, unknown> => ({
  yours: { rows: [], more: 0 },
  team: { rows: [{ id: 'T-3', title: 'Three', lane: 'M', stage: 'build', tasksDone: 1, tasksTotal: 2, claimedBy: 'a@x.io' }], more: 0 },
  ready: { rows: [{ id: 'T-2', title: 'Two', lane: 'M', stage: 'plan' }], more: 0 },
  upNext: { rows: [], more: 0 },
  epics: { rows: [], more: 0 },
  summary: { inProgress: 1, ready: 1, blocked: 0, backlog: 0, done: 0, withoutLane: 0, withSchemaErrors: 0 },
  ...over,
});
const load = async (d: Record<string, unknown>) => {
  const { view, outcome } = await loadView();
  const state = outcome({ exitCode: 0, stdout: JSON.stringify(d), stderr: '' });
  return { view, outcome, state };
};
const merged = { rows: [{ id: 'T-1', title: 'One', lane: 'M', stage: 'verify', next: 'verify' }], more: 0 };

it('risk:regression a mergedWaiting section is drawn after UP NEXT with a Continue action on its row (D-29)', async () => {
  const { view, state } = await load(dashboard({ mergedWaiting: merged }));
  expect(state.dashboard).toBeDefined();
  const headings = view(state, '').sections.map((s: any) => s.heading);
  expect(headings).toEqual(['YOURS', 'TEAM', 'READY', 'UP NEXT', 'MERGED, WAITING FOR VERIFY']);
  const row = view(state, '').sections[4].rows[0];
  expect(row).toMatchObject({ id: 'T-1', stage: 'verify', open: { key: 'show:T-1', id: 'T-1', action: { key: 'continue:T-1', label: 'Continue', command: 'accord', args: 'continue T-1' } } });
});

// the fixture below is view() of this dashboard taken before the change (no mergedWaiting key)
it('risk:regression a dashboard JSON without mergedWaiting draws exactly the sections it drew before (D-29)', async () => {
  const { view, state } = await load(dashboard());
  const before = JSON.parse(
    '{"sections":[{"heading":"YOURS","rows":[],"more":0},{"heading":"TEAM","rows":[{"id":"T-3","lane":"M","stage":"build 1/2","bar":[{"key":"intent","state":"done","color":"blue"},{"key":"plan","state":"done","color":"cyan"},{"key":"build","state":"current","color":"yellow"},{"key":"review","state":"todo","color":"magenta"},{"key":"verify","state":"todo","color":"green"}],"stageColor":"yellow","title":"Three","blockedBy":"","who":"a@x.io","open":{"key":"show:T-3","id":"T-3"}}],"more":0},{"heading":"READY","rows":[{"id":"T-2","lane":"M","stage":"plan","bar":[{"key":"intent","state":"done","color":"blue"},{"key":"plan","state":"current","color":"cyan"},{"key":"build","state":"todo","color":"yellow"},{"key":"review","state":"todo","color":"magenta"},{"key":"verify","state":"todo","color":"green"}],"stageColor":"cyan","title":"Two","blockedBy":"","who":"","open":{"key":"show:T-2","id":"T-2","action":{"key":"pick-up:T-2","label":"Pick up","command":"accord","args":"pick-up T-2"}}}],"more":0},{"heading":"UP NEXT","rows":[],"more":0}],"summary":"1 in progress, 1 ready, 0 blocked, 0 backlog, 0 done","widths":{"id":3,"bar":5,"lane":4,"stage":9},"layout":"wide","hint":"No ticket in flight in this worktree"}',
  );
  expect(view(state, '', 120)).toEqual(before);
});

it('risk:parsing outcome accepts mergedWaiting absent or a section and rejects any other value, as it does for upNext (D-29)', async () => {
  const { outcome } = await loadView();
  const run = (d: Record<string, unknown>) => outcome({ exitCode: 0, stdout: JSON.stringify(d), stderr: '' });
  expect(run(dashboard()).dashboard).toBeDefined();
  expect(run(dashboard({ mergedWaiting: merged })).dashboard).toBeDefined();
  for (const bad of ['x', 7, null, [], { more: 0 }, { rows: 'T-1', more: 0 }, { rows: ['T-1'], more: 0 }]) {
    expect(run(dashboard({ mergedWaiting: bad })).dashboard, JSON.stringify(bad)).toBeUndefined();
  }
});

it('risk:regression the column widths cover the merged rows so the columns do not move between sections (D-29)', async () => {
  const wide = { rows: [{ id: 'LONG-TICKET-ID-9', title: 'Long', lane: 'M', stage: 'verify' }], more: 0 };
  const { view, state } = await load(dashboard({ mergedWaiting: wide }));
  expect(view(state, '').widths.id).toBe('LONG-TICKET-ID-9'.length);
  const { view: v2, state: s2 } = await load(dashboard());
  expect(v2(s2, '').widths.id).toBe(3);
});

it('risk:security a crafted title of a merged row reaches the pane through clean text like every other row (T-15-09)', async () => {
  const evil = { rows: [{ id: 'T-1', title: 'One\u202Egnp.exe\u0007\nsecond', lane: 'M', stage: 'verify' }], more: 0 };
  const { view, state } = await load(dashboard({ mergedWaiting: evil }));
  const row = view(state, '').sections[4].rows[0];
  expect(row.title).toBe('One gnp.exe second');
});

it('risk:regression a search keeps the merged heading only when a merged row matches (D-29)', async () => {
  const { view, state } = await load(dashboard({ mergedWaiting: merged }));
  expect(view(state, 'one').sections.map((s: any) => s.heading)).toEqual(['MERGED, WAITING FOR VERIFY']);
  expect(view(state, 'two').sections.map((s: any) => s.heading)).toEqual(['READY']);
});
