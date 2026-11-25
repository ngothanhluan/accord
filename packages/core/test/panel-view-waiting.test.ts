// Phase 15 D-22, SC-8 (15-08): the pane keeps a waiting pull request visible with its age. A YOURS row that carries `waitingSince` draws `waiting for merge, <age>`, the age computed from the clock
// the draw passes in (the view never reads one itself); a row without the field draws as before, and an unreadable time draws no age and no error.
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

async function loadView(): Promise<{ view: (state: unknown, query: string, columns?: number, now?: number) => any; outcome: (r: { exitCode: number; stdout: string; stderr: string }) => any }> {
  const dir = mkdtempSync(join(tmpdir(), 'accord-panel-waiting-'));
  dirs.push(dir);
  for (const f of pluginTargets({ runtimes: ['claude'] }, { name: '@accord-dev/accord', version: '9.9.9' })) {
    const p = join(dir, ...f.path.split('/'));
    mkdirSync(dirname(p), { recursive: true });
    writeFileSync(p, f.text);
  }
  return import(/* @vite-ignore */ pathToFileURL(join(dir, '.claude/accord-panel/plugin/hooks/view.js')).href);
}

const NOW = Date.parse('2026-11-26T12:00:00.000Z');
const HOUR = 3600 * 1000;
const dashboard = (yours: unknown[]): Record<string, unknown> => ({
  yours: { rows: yours, more: 0 },
  team: { rows: [], more: 0 },
  ready: { rows: [], more: 0 },
  upNext: { rows: [], more: 0 },
  epics: { rows: [], more: 0 },
  summary: { inProgress: 1, ready: 0, blocked: 0, backlog: 0, done: 0, withoutLane: 0, withSchemaErrors: 0 },
});
const row = (extra: Record<string, unknown> = {}) => ({ id: 'T-1', title: 'One', lane: 'M', stage: 'done', claimedBy: 'v@x.io', ...extra });
const draw = async (rows: unknown[], now: number | null = NOW) => {
  const { view, outcome } = await loadView();
  const state = outcome({ exitCode: 0, stdout: JSON.stringify(dashboard(rows)), stderr: '' });
  expect(state.dashboard).toBeDefined();
  return view(state, '', 120, now ?? undefined).sections[0].rows[0];
};

it('risk:regression a YOURS row with waitingSince two hours before the clock draws waiting for merge, 2h (D-22)', async () => {
  const r = await draw([row({ waitingSince: new Date(NOW - 2 * HOUR).toISOString() })]);
  expect(r.waiting).toBe('waiting for merge, 2h');
  expect(r).toMatchObject({ id: 'T-1', stage: 'done', open: { key: 'show:T-1' } });
});

it('risk:regression a row without waitingSince draws exactly as before and a row with one is the same row plus its waiting line (D-22)', async () => {
  const plain = await draw([row()]);
  expect('waiting' in plain).toBe(false);
  const waiting = await draw([row({ waitingSince: new Date(NOW - 5 * 60_000).toISOString() })]);
  const { waiting: line, ...rest } = waiting;
  expect(line).toBe('waiting for merge, 5m');
  expect(rest).toEqual(plain);
  // days after two days
  expect((await draw([row({ waitingSince: new Date(NOW - 72 * HOUR).toISOString() })])).waiting).toBe('waiting for merge, 3d');
});

it('risk:parsing an unparsable or non-string waitingSince draws no age and no error, and a draw with no clock draws no age (D-22)', async () => {
  expect((await draw([row({ waitingSince: 'not a time' })])).waiting).toBe('waiting for merge');
  for (const bad of [42, null, {}, ['x']]) expect('waiting' in (await draw([row({ waitingSince: bad })])), String(JSON.stringify(bad))).toBe(false);
  expect((await draw([row({ waitingSince: new Date(NOW - 2 * HOUR).toISOString() })], null)).waiting).toBe('waiting for merge');
  // control and bidi code points in the time never reach the line
  expect((await draw([row({ waitingSince: '\u202e2026-11-26\u0007' })])).waiting).toBe('waiting for merge');
});
