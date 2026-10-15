// ST-LN-2 task 1: `accord dashboard` — sections, caps, column headers, titles.
import { expect, it } from 'vitest';
import { approvedHash, dashboard, gateReady, loadSnapshot, setFrontmatterKey } from '@accord-dev/accord-core';
import type { Dashboard, StatusRow } from '@accord-dev/accord-core';
import { renderDashboard } from '../src/render/dashboard.js';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { cleanup, commitAll, commitAllAt, gitRun, makeLaneRepo, run, writeFiles } from './helpers/repo.js';
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
    epics: empty,
    yours: { rows: [row('A-1', 'Đặt lại\u001b[31m mật\u202e khẩu\u2028x'), row('A-2', 'Ư'.repeat(70))], more: 0 },
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

it('ac-1 ready tickets are ranked by inherited priority then by id', async () => {
  const lt = (id: string, fm: string[] = []) => laneTicket(id, { frontmatter: fm });
  const repo = makeLaneRepo({
    [P('ST-AN-1')]: lt('ST-AN-1', ['priority: low']),
    [P('ST-AN-3')]: lt('ST-AN-3'),
    [P('ST-AN-4')]: lt('ST-AN-4', ['priority: high']),
    [P('ST-AN-2')]: lt('ST-AN-2', ['priority: medium', 'depends_on: ["ST-AN-1"]']),
    [P('ST-AN-6')]: lt('ST-AN-6', ['priority: high', 'depends_on: ["ST-AN-2"]']),
  });
  try {
    gitRun(repo, 'config', 'user.email', 'an@example.com');
    for (const id of ['ST-AN-1', 'ST-AN-3', 'ST-AN-4', 'ST-AN-2', 'ST-AN-6']) {
      await run(['approve', id], repo);
      expect((await run(['gate', 'ready', id], repo)).code).toBe(0);
    }
    const d = JSON.parse((await run(['dashboard', '--json'], repo)).out) as Dashboard;
    expect(d.ready.rows.map((r) => r.id)).toEqual(['ST-AN-1', 'ST-AN-4', 'ST-AN-3']);
    const ok = await run(['lint', '--json'], repo);
    expect(ok.code).toBe(0);
    expect((JSON.parse(ok.out).findings as { pointer?: string }[]).some((f) => f.pointer === '/priority')).toBe(false);
    const f3 = join(repo, P('ST-AN-3'));
    writeFiles(repo, { [P('ST-AN-3')]: readFileSync(f3, 'utf8').replace('ui: false', 'ui: false' + String.fromCharCode(10) + 'priority: urgent') });
    const bad = await run(['lint', '--json'], repo);
    expect(bad.code).toBe(1);
    expect((JSON.parse(bad.out).findings as { pointer?: string; rule: string }[]).some((f) => f.pointer === '/priority' && f.rule.startsWith('schema.'))).toBe(true);
  } finally {
    cleanup(repo);
  }
});

it('risk:complex-branching a depends_on cycle ends and a dropped dependent does not lift', () => {
  const files: Files = { 'accord/config.yml': CONFIG };
  const claims: Record<string, string> = {};
  const add = (id: string, fm: string[]) => { files[P(id)] = laneTicket(id, { frontmatter: fm }); claims[id] = 'bo@example.com'; };
  add('ST-AN-1', ['priority: low', 'depends_on: ["ST-AN-2"]']);
  add('ST-AN-2', ['priority: low', 'depends_on: ["ST-AN-1"]']);
  add('ST-AN-3', []);
  add('ST-AN-4', ['priority: high', 'status: dropped', 'depends_on: ["ST-AN-1"]']);
  add('ST-AN-5', ['priority: low']);
  add('ST-AN-6', ['status: dropped', 'depends_on: ["ST-AN-5"]']);
  add('ST-AN-7', ['priority: high', 'depends_on: ["ST-AN-6"]']);
  expect(board(files, claims).team.rows.map((r) => r.id)).toEqual(['ST-AN-5', 'ST-AN-7', 'ST-AN-3', 'ST-AN-1', 'ST-AN-2']);
});

it('ac-3 up next shows the viewer what to pick up when nothing is ready', () => {
  const files: Files = { 'accord/config.yml': CONFIG };
  building(files, 'ST-AN-9');
  files[P('ST-AN-1')] = laneTicket('ST-AN-1');
  files[P('ST-AN-2')] = laneTicket('ST-AN-2', { frontmatter: ['priority: high', 'depends_on: ["ST-AN-1"]'] });
  done(files, 'ST-AN-3');
  const d = board(files, { 'ST-AN-9': 'bo@example.com' });
  expect(d.ready.rows).toEqual([]);
  expect(d.upNext?.rows.map((r) => r.id)).toEqual(['ST-AN-1', 'ST-AN-2']);
  expect(d.upNext?.suggest).toEqual({ action: 'pick-up', id: 'ST-AN-1' });
  const d2 = board(files, { 'ST-AN-9': 'bo@example.com', 'ST-AN-1': 'an@example.com' });
  expect(d2).not.toHaveProperty('upNext');
  expect(renderDashboard(d2).split('\n')).not.toContain('UP NEXT');
});

it('risk:complex-branching an archived claimed ticket is in no section and no count', () => {
  const files: Files = { 'accord/config.yml': CONFIG };
  files[P('ST-AN-1')] = laneTicket('ST-AN-1', { frontmatter: ['status: archived'] });
  files[P('ST-AN-2')] = laneTicket('ST-AN-2', { frontmatter: ['status: archived'] });
  const d = board(files, { 'ST-AN-1': 'an@example.com' });
  expect([d.yours.rows, d.team.rows, d.ready.rows]).toEqual([[], [], []]);
  expect(d.upNext).toEqual({ rows: [], more: 0 });
  expect(d.summary.inProgress).toBe(0);
  expect(d.summary.backlog).toBe(0);
});

it('risk:complex-branching the action line names only the actions that apply', () => {
  const row = (id: string): StatusRow => ({
    id, title: 'T', ui: false, errors: 0, warnings: 0, ready: 'ok', ticksVerified: 0, ticksTagged: 0,
    ticksBinding: 'none', lane: 'M', stage: 'plan', tasksDone: 0, tasksTotal: 0,
  });
  const empty = { rows: [], more: 0 };
  const summary = { inProgress: 0, ready: 0, blocked: 0, backlog: 0, done: 0, withoutLane: 0, withSchemaErrors: 0 };
  const lastTwo = (d: Dashboard) => {
    const lines = renderDashboard(d).split('\n').filter((l) => l !== '');
    return [lines[lines.length - 2], lines[lines.length - 1]];
  };
  const a = lastTwo({ epics: empty, yours: { rows: [row('ST-AN-1')], more: 0 }, team: empty, ready: { rows: [row('ST-AN-2')], more: 0 }, summary });
  expect(a[1]).toBe('-> [Continue ST-AN-1]  [Pick up ST-AN-2]  [New request]');
  expect(a[0]).toContain(' in progress, ');
  const b = lastTwo({ epics: empty, yours: empty, team: empty, ready: empty, upNext: { rows: [row('ST-AN-3')], more: 0, suggest: { action: 'pick-up', id: 'ST-AN-3' } }, summary });
  expect(b[1]).toBe('-> [Pick up ST-AN-3]  [New request]');
  expect(b[0]).toContain(' in progress, ');
  const c = lastTwo({ epics: empty, yours: empty, team: empty, ready: empty, upNext: { rows: [row('ST-AN-3')], more: 0 }, summary });
  expect(c[1]).toBe('-> [New request]');
  expect(c[0]).toContain(' in progress, ');
});

it('risk:complex-branching the viewer comes from git user.email without case and an empty one exits 2', async () => {
  const repo = makeLaneRepo({ [P('ST-AN-1')]: laneTicket('ST-AN-1') });
  try {
    commitAll(repo);
    const sha = gitRun(repo, '-c', 'user.email=An@Example.com', '-c', 'user.name=x', '-c', 'commit.gpgsign=false', 'commit-tree', 'HEAD^{tree}', '-p', 'HEAD', '-m', 'claim').trim();
    gitRun(repo, 'update-ref', 'refs/remotes/origin/t/ST-AN-1', sha);
    gitRun(repo, 'config', 'user.email', 'an@example.com');
    const res = await run(['dashboard', '--json'], repo);
    expect(res.code).toBe(0);
    const j = JSON.parse(res.out) as Dashboard;
    expect(j.yours.rows.map((r) => r.id)).toEqual(['ST-AN-1']);
    expect(j.team.rows.some((r) => r.id === 'ST-AN-1')).toBe(false);
    expect(j).not.toHaveProperty('upNext');
    gitRun(repo, 'config', 'user.email', '');
    const bad = await run(['dashboard'], repo);
    expect(bad.code).toBe(2);
    expect(bad.out).toBe('');
    expect(bad.err).toContain('git user.email is not set - set it with git config user.email <you@example.com>');
  } finally {
    cleanup(repo);
  }
});

it('ac-5 epics show their children done over all their children', () => {
  const files: Files = { 'accord/config.yml': CONFIG };
  const child = ['parent: "EP-AN-1"'];
  const epic = (id: string, fm: string[] = []) =>
    (files[P(id)] = laneTicket(id, { lane: '', frontmatter: fm }).replace('type: story', 'type: epic'));
  epic('EP-AN-1');
  epic('EP-AN-2', ['status: archived']);
  for (let i = 1; i <= 3; i++) done(files, 'ST-AN-' + i, { frontmatter: child });
  files[P('ST-AN-4')] = laneTicket('ST-AN-4', { frontmatter: [...child, 'status: dropped'] });
  for (let i = 5; i <= 8; i++) files[P('ST-AN-' + i)] = laneTicket('ST-AN-' + i, { frontmatter: child });
  files[P('ST-AN-20')] = laneTicket('ST-AN-20');
  const d = board(files);
  expect(d.epics).toEqual({ rows: [{ id: 'EP-AN-1', title: 'Export', done: 3, total: 7 }], more: 0 });
  const lines = renderDashboard(d).split('\n');
  const at = lines.indexOf('EPICS');
  expect(at).toBeGreaterThanOrEqual(0);
  const sect = lines.slice(at, lines.indexOf('', at));
  expect(sect.filter((l) => l.includes('EP-AN-1') && l.includes('3/7 done'))).toHaveLength(1);
  expect(sect.join('\n')).not.toMatch(/EP-AN-2|ST-AN-20/);
  delete files[P('EP-AN-1')];
  delete files[P('EP-AN-2')];
  const d2 = board(files);
  expect(d2.epics).toEqual({ rows: [], more: 0 });
  expect(renderDashboard(d2).split('\n')).not.toContain('EPICS');
});

it('risk:regression an idle ticket shows idle days in the dashboard text and the json keeps every key', async () => {
  const repo = makeLaneRepo();
  try {
    expect((await run(['approve', 'T-1'], repo)).code).toBe(0);
    commitAllAt(repo, new Date('2000-01-01T00:00:00Z'));
    gitRun(repo, 'config', 'user.email', 'an@example.com');
    const res = await run(['dashboard'], repo);
    expect(res.code).toBe(0);
    expect(res.out.split('\n').find((l) => l.includes('T-1'))).toMatch(/build 0\/2 idle \d+d/);
    const j = JSON.parse((await run(['dashboard', '--json'], repo)).out);
    expect(Object.keys(j)).toEqual(['yours', 'team', 'ready', 'upNext', 'epics', 'summary']);
    expect(Object.keys(j.summary)).toEqual(['inProgress', 'ready', 'blocked', 'backlog', 'done', 'withoutLane', 'withSchemaErrors']);
    expect(j.epics).toEqual({ rows: [], more: 0 });
    expect(typeof j.upNext.rows.find((r: { id: string }) => r.id === 'T-1').idleDays).toBe('number');
  } finally {
    cleanup(repo);
  }
});
