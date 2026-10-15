// ST-LN-2 task 1: `accord dashboard` — sections, caps, column headers, titles.
import { expect, it } from 'vitest';
import { approvedHash, dashboard, gateReady, loadSnapshot, setFrontmatterKey } from '@accord-dev/accord-core';
import type { Dashboard, StatusRow } from '@accord-dev/accord-core';
import { renderDashboard } from '../src/render/dashboard.js';
import { cleanup, gitRun, makeLaneRepo, run } from './helpers/repo.js';
import { CONFIG, laneTicket, PLAN } from '../../../test/helpers/lane.js';

type Files = Record<string, string>;
type Opts = { lane?: string; frontmatter?: string[] };
const P = (id: string) => 'accord/tickets/' + id + '.md';
const AC = gateReady(loadSnapshot({ files: { 'accord/config.yml': CONFIG, [P('X-1')]: laneTicket('X-1') }, tree: [] }), 'X-1').acHash as string;
const approve = (files: Files, id: string) => {
  const t = loadSnapshot({ files: { 'accord/config.yml': CONFIG, [P(id)]: files[P(id)] }, tree: [] }).tickets[id];
  files[P(id)] = setFrontmatterKey(files[P(id)], 'approved_hash', approvedHash(t));
};
const ready = (files: Files, id: string, opts?: Opts) => {
  files[P(id)] = laneTicket(id, opts);
  approve(files, id);
  files[P(id)] = setFrontmatterKey(files[P(id)], 'ac_hash', AC);
};
const building = (files: Files, id: string, opts?: Opts) => {
  files[P(id)] = laneTicket(id, opts);
  approve(files, id);
  files['accord/tickets/' + id + '/plan.md'] = PLAN;
};
const done = (files: Files, id: string, opts?: Opts) => {
  building(files, id, opts);
  files['accord/tickets/' + id + '/ledger.md'] = '## Tasks\n- task 1 done abc1234\n- task 2 done abc1234\n';
  files['accord/tickets/' + id + '/review.md'] = 'verdict: converged\n';
  files[P(id)] = setFrontmatterKey(files[P(id)], 'verified', ['ac-1', 'ac-2']);
  files[P(id)] = setFrontmatterKey(files[P(id)], 'verified_hash', AC);
};
const board = (files: Files, claims: Record<string, string> = {}, viewer = 'an@example.com') =>
  dashboard(loadSnapshot({ files, tree: [], claims }), viewer);
const summaryLine = (text: string) => text.split('\n').find((l) => l.includes(' in progress, ')) as string;

it('ac-2 rows carry titles and sections carry column headers', async () => {
  const repo = makeLaneRepo({ [P('ST-AN-1')]: laneTicket('ST-AN-1').replace('title: "Export"', 'title: "Password reset"') });
  try {
    gitRun(repo, 'config', 'user.email', 'an@example.com');
    await run(['approve', 'ST-AN-1'], repo);
    expect((await run(['gate', 'ready', 'ST-AN-1'], repo)).code).toBe(0);
    const rows = JSON.parse((await run(['status', '--json'], repo)).out) as { id: string; title?: string }[];
    expect(rows.find((r) => r.id === 'ST-AN-1')?.title).toBe('Password reset');
    const res = await run(['dashboard'], repo);
    expect(res.code).toBe(0);
    const lines = res.out.split('\n');
    const r = lines.indexOf('READY');
    expect(r).toBeGreaterThanOrEqual(0);
    expect(lines[r + 1]).toMatch(/\bid\b/);
    expect(lines[r + 1]).toMatch(/\btitle\b/);
    expect(lines[r + 2]).toContain('ST-AN-1');
    expect(lines[r + 2]).toContain('Password reset');
  } finally {
    cleanup(repo);
  }
});

it('ac-4 sections are capped on a large backlog', () => {
  const files: Files = { 'accord/config.yml': CONFIG };
  const claims: Record<string, string> = {};
  for (let i = 1; i <= 3; i++) { files[P('ST-AN-' + i)] = laneTicket('ST-AN-' + i); claims['ST-AN-' + i] = 'an@example.com'; }
  for (let i = 1; i <= 12; i++) { files[P('ST-BO-' + i)] = laneTicket('ST-BO-' + i); claims['ST-BO-' + i] = 'bo@example.com'; }
  for (let i = 1; i <= 4; i++) { done(files, 'ST-DO-' + i); claims['ST-DO-' + i] = 'bo@example.com'; }
  for (let i = 1; i <= 25; i++) ready(files, 'ST-CY-' + i);
  const d = board(files, claims);
  expect([d.yours.rows.length, d.yours.more]).toEqual([3, 0]);
  expect([d.team.rows.length, d.team.more]).toEqual([10, 2]);
  expect([d.ready.rows.length, d.ready.more]).toEqual([20, 5]);
  for (const s of [d.yours, d.team, d.ready]) expect(s.rows.some((r) => r.id.startsWith('ST-DO-'))).toBe(false);
  expect(d.summary).toMatchObject({ inProgress: 15, ready: 25, blocked: 0, done: 4 });
  const lines = renderDashboard(d).split('\n');
  const t = lines.indexOf('TEAM');
  const r = lines.indexOf('READY');
  const m2 = lines.findIndex((l) => l.includes('+2 more'));
  expect(m2 > t && m2 < r).toBe(true);
  expect(lines.findIndex((l) => l.includes('+5 more'))).toBeGreaterThan(r);
  expect(lines.filter((l) => ['15 in progress', '25 ready', '0 blocked', '4 done'].every((s) => l.includes(s)))).toHaveLength(1);
});

it('risk:parsing ids compare digit runs by value', () => {
  const files: Files = { 'accord/config.yml': CONFIG };
  const claims: Record<string, string> = {};
  for (const id of ['ST-AN-10', 'ST-AN-9', 'ST-AN-1', 'ST-AN-010']) { files[P(id)] = laneTicket(id); claims[id] = 'bo@example.com'; }
  expect(board(files, claims).team.rows.map((r) => r.id)).toEqual(['ST-AN-1', 'ST-AN-9', 'ST-AN-010', 'ST-AN-10']);
});

it('risk:complex-branching a laneless and a schema-broken ticket are counted and never listed', () => {
  const files: Files = { 'accord/config.yml': CONFIG };
  ready(files, 'ST-AN-1');
  files[P('L-1')] = laneTicket('L-1', { lane: '' });
  files[P('B-1')] = laneTicket('B-1', { frontmatter: ['owner: x'] });
  const claims = { 'B-1': 'an@example.com' };
  const d = board(files, claims);
  expect(d.summary).toMatchObject({ withoutLane: 1, withSchemaErrors: 1 });
  for (const s of [d.yours, d.team, d.ready]) expect(s.rows.some((r) => r.id === 'L-1' || r.id === 'B-1')).toBe(false);
  const line = summaryLine(renderDashboard(d));
  expect(line).toContain('1 without lane');
  expect(line).toContain('1 with schema errors, run accord lint');
  delete files[P('L-1')];
  delete files[P('B-1')];
  const clean = board(files);
  const l2 = summaryLine(renderDashboard(clean));
  expect(l2).not.toContain('without lane');
  expect(l2).not.toContain('schema errors');
  expect(clean.summary).toMatchObject({ withoutLane: 0, withSchemaErrors: 0 });
});

it('risk:security a title cannot inject control characters or overflow its cell', () => {
  const row = (id: string, title: string): StatusRow => ({
    id, title, ui: false, errors: 0, warnings: 0, ready: 'ok', ticksVerified: 0, ticksTagged: 0,
    ticksBinding: 'none', lane: 'M', stage: 'plan', tasksDone: 0, tasksTotal: 0,
  });
  const empty = { rows: [], more: 0 };
  const d: Dashboard = {
    yours: { rows: [row('A-1', 'Đặt lại\u001b[31m mật‮ khẩu x'), row('A-2', 'Ư'.repeat(70))], more: 0 },
    team: empty, ready: empty,
    summary: { inProgress: 0, ready: 0, blocked: 0, backlog: 0, done: 0, withoutLane: 0, withSchemaErrors: 0 },
  };
  const text = renderDashboard(d);
  for (const ch of text) {
    const cp = ch.codePointAt(0) as number;
    if (cp !== 0x0a) expect(cp).toBeGreaterThanOrEqual(0x20);
    expect([0x1b, 0x202e, 0x2028]).not.toContain(cp);
  }
  expect(text).toContain('Đặt lại [31m mật khẩu x');
  expect(text).toContain('Ư'.repeat(57) + '...');
  expect(text).not.toContain('Ư'.repeat(58));
});
