// ST-LN-2 task 1: `accord dashboard` — sections, column headers, titles; ST-LN-61 lifted the row caps.
import { afterAll, beforeAll, expect, it } from 'vitest';
import { dashboard, loadSnapshot } from '@accord-dev/accord-core';
import type { Dashboard, StatusRow } from '@accord-dev/accord-core';
import { renderDashboard } from '../src/render/dashboard.js';
import { appendFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { cleanup, commitAllAt, commitMsg, copyRepo, gitRun, makeLaneRepo, run, writeFiles } from './helpers/repo.js';
import { approve, building, CONFIG, done, gateReadyIn, LANE_BODY, laneTicket, P, ready } from '../../../test/helpers/lane.js';
import type { Files } from '../../../test/helpers/lane.js';

const board = (files: Files, claims: Record<string, string> = {}, viewer = 'an@example.com') =>
  dashboard(loadSnapshot({ files, tree: [], claims }), viewer);
// Lane-repo templates (H1): built once, copied with copyRepo. None has a remote, and none is ever given one.
const identity = (repo: string) => {
  gitRun(repo, 'config', 'user.email', 'fixture@example.invalid');
  gitRun(repo, 'config', 'user.name', 'fixture');
  gitRun(repo, 'config', 'commit.gpgsign', 'false');
};
let tplClaimDone = '';
let tplCommitted = '';
let tplIntent = '';
beforeAll(() => {
  // T-2 depends on T-1, and T-1 is done only on its claim ref: the done files are committed on the base branch,
  // origin/t/T-1 is pointed at that commit, and the base branch is put back.
  tplClaimDone = makeLaneRepo({ [P('T-1')]: laneTicket('T-1'), [P('T-2')]: laneTicket('T-2', { frontmatter: ['depends_on: ["T-1"]'] }) });
  identity(tplClaimDone);
  commitMsg(tplClaimDone, 'fixture');
  const files: Files = {};
  done(files, 'T-1');
  writeFiles(tplClaimDone, files);
  commitMsg(tplClaimDone, 'fixture');
  gitRun(tplClaimDone, 'update-ref', 'refs/remotes/origin/t/T-1', 'HEAD');
  gitRun(tplClaimDone, 'reset', '-q', '--hard', 'HEAD~1');
  gitRun(tplClaimDone, 'config', 'user.email', 'an@example.com');
  tplCommitted = makeLaneRepo({ [P('ST-AN-1')]: laneTicket('ST-AN-1') });
  identity(tplCommitted);
  commitMsg(tplCommitted, 'fixture');
  tplIntent = makeLaneRepo({
    [P('T-2')]: laneTicket('T-2', { body: LANE_BODY.replace('Owners can export their report as CSV.', '<!-- why, for whom -->\n') }),
    [P('T-3')]: laneTicket('T-3', {
      body: LANE_BODY.replace(/```gherkin[\s\S]*?```/, '```gherkin\nFeature: T-3\n\n  @ac-1\n  Scenario: <observable outcome>\n    Given ...\n    When ...\n    Then ...\n```'),
    }),
  });
  identity(tplIntent);
});
afterAll(() => {
  for (const t of [tplClaimDone, tplCommitted, tplIntent]) if (t !== '') cleanup(t);
});
const summaryLine = (text: string) => text.split('\n').find((l) => l.includes(' in progress, ')) as string;

it('ac-2 rows carry titles and sections carry column headers', async () => {
  const written: Files = { 'accord/config.yml': CONFIG, [P('ST-AN-1')]: laneTicket('ST-AN-1').replace('title: "Export"', 'title: "Password reset"') };
  approve(written, 'ST-AN-1');
  expect(gateReadyIn(written, 'ST-AN-1')).toBe('pass');
  const repo = makeLaneRepo({ [P('ST-AN-1')]: written[P('ST-AN-1')] });
  try {
    gitRun(repo, 'config', 'user.email', 'an@example.com');
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

it('risk:regression sections list every row on a large backlog', () => {
  const files: Files = { 'accord/config.yml': CONFIG };
  const claims: Record<string, string> = {};
  for (let i = 1; i <= 3; i++) { files[P('ST-AN-' + i)] = laneTicket('ST-AN-' + i); claims['ST-AN-' + i] = 'an@example.com'; }
  for (let i = 1; i <= 12; i++) { files[P('ST-BO-' + i)] = laneTicket('ST-BO-' + i); claims['ST-BO-' + i] = 'bo@example.com'; }
  for (let i = 1; i <= 4; i++) { done(files, 'ST-DO-' + i); claims['ST-DO-' + i] = 'bo@example.com'; }
  for (let i = 1; i <= 25; i++) ready(files, 'ST-CY-' + i);
  const d = board(files, claims);
  expect([d.yours.rows.length, d.yours.more]).toEqual([3, 0]);
  expect([d.team.rows.length, d.team.more]).toEqual([12, 0]);
  expect([d.ready.rows.length, d.ready.more]).toEqual([25, 0]);
  for (const s of [d.yours, d.team, d.ready]) expect(s.rows.some((r) => r.id.startsWith('ST-DO-'))).toBe(false);
  expect(d.summary).toMatchObject({ inProgress: 15, ready: 25, blocked: 0, done: 4 });
  const lines = renderDashboard(d).split('\n');
  expect(lines.some((l) => l.includes(' more'))).toBe(false);
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
    yours: { rows: [row('A-1', 'Mot de\u001b[31m passe\u202e oublié\u2028x'), row('A-2', 'É'.repeat(70))], more: 0 },
    team: empty, ready: empty, upNext: empty,
    summary: { inProgress: 0, ready: 0, blocked: 0, backlog: 0, done: 0, withoutLane: 0, withSchemaErrors: 0 },
  };
  const text = renderDashboard(d);
  for (const ch of text) {
    const cp = ch.codePointAt(0) as number;
    if (cp !== 0x0a) expect(cp).toBeGreaterThanOrEqual(0x20);
    expect([0x1b, 0x202e, 0x2028]).not.toContain(cp);
  }
  expect(text).toContain('Mot de [31m passe oublié x');
  expect(text).toContain('É'.repeat(57) + '...');
  expect(text).not.toContain('É'.repeat(58));
});

it('ac-1 ready tickets are ranked by inherited priority then by id', async () => {
  const lt = (id: string, fm: string[] = []) => laneTicket(id, { frontmatter: fm });
  const written: Files = {
    'accord/config.yml': CONFIG,
    [P('ST-AN-1')]: lt('ST-AN-1', ['priority: low']),
    [P('ST-AN-3')]: lt('ST-AN-3'),
    [P('ST-AN-4')]: lt('ST-AN-4', ['priority: high']),
    [P('ST-AN-2')]: lt('ST-AN-2', ['priority: medium', 'depends_on: ["ST-AN-1"]']),
    [P('ST-AN-6')]: lt('ST-AN-6', ['priority: high', 'depends_on: ["ST-AN-2"]']),
  };
  for (const id of ['ST-AN-1', 'ST-AN-3', 'ST-AN-4', 'ST-AN-2', 'ST-AN-6']) {
    approve(written, id);
    expect(gateReadyIn(written, id)).toBe('pass');
  }
  const repo = makeLaneRepo(Object.fromEntries(['ST-AN-1', 'ST-AN-3', 'ST-AN-4', 'ST-AN-2', 'ST-AN-6'].map((id) => [P(id), written[P(id)]])));
  try {
    gitRun(repo, 'config', 'user.email', 'an@example.com');
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
  expect(d.upNext.rows.map((r) => r.id)).toEqual(['ST-AN-1', 'ST-AN-2']);
  expect(d.upNext.suggest).toEqual({ action: 'pick-up', id: 'ST-AN-1' });
});

const MINE = { 'ST-AN-9': 'an@example.com' };
const view = (files: Files, claims: Record<string, string>) => {
  const d = board(files, claims);
  const text = renderDashboard(d);
  const lines = text.split('\n');
  return { d, j: JSON.parse(JSON.stringify(d)), text, lines, u: lines.indexOf('UP NEXT'), lastLine: lines.filter((l) => l !== '').pop() as string };
};

it('ac-1 up next lists the backlog and the blocked tickets while the viewer holds work', () => {
  const files: Files = { 'accord/config.yml': CONFIG };
  files[P('ST-AN-9')] = laneTicket('ST-AN-9');
  files[P('ST-AN-1')] = laneTicket('ST-AN-1', { frontmatter: ['status: draft'] });
  files[P('ST-AN-2')] = laneTicket('ST-AN-2', { frontmatter: ['status: draft', 'depends_on: ["ST-AN-1"]'] });
  const { j, lines, u, lastLine } = view(files, MINE);
  expect(j.yours.rows.map((r: StatusRow) => r.id)).toEqual(['ST-AN-9']);
  expect(j.upNext.rows.map((r: StatusRow) => r.id)).toEqual(['ST-AN-1', 'ST-AN-2']);
  expect(j.upNext.rows[1].blockedBy).toEqual(['ST-AN-1']);
  expect(u).toBeGreaterThanOrEqual(0);
  const block = lines.slice(u, u + lines.slice(u).indexOf(''));
  expect(block.some((l) => l.startsWith('  ST-AN-1'))).toBe(true);
  expect(block.some((l) => l.startsWith('  ST-AN-2'))).toBe(true);
  expect(lastLine).toBe('-> [Continue ST-AN-9]  [Pick up ST-AN-1]  [New request]');
});

it('risk:regression up next leaves out the ready tickets and lists all the rest', () => {
  const files: Files = { 'accord/config.yml': CONFIG };
  files[P('ST-AN-9')] = laneTicket('ST-AN-9');
  ready(files, 'ST-AN-50');
  for (let i = 1; i <= 22; i++) files[P('ST-BO-' + i)] = laneTicket('ST-BO-' + i, { frontmatter: ['status: draft'] });
  const { j, lines, u, lastLine } = view(files, MINE);
  expect(j.ready.rows.map((r: StatusRow) => r.id)).toEqual(['ST-AN-50']);
  expect(j.upNext.rows).toHaveLength(22);
  expect(j.upNext.more).toBe(0);
  expect(j.upNext.rows.map((r: StatusRow) => r.id)).not.toContain('ST-AN-50');
  expect(u).toBeGreaterThanOrEqual(0);
  expect(lines.some((l) => l.includes(' more'))).toBe(false);
  expect(lastLine).toContain('[Pick up ST-AN-50]');
});

it('ac-3 up next is present when nothing is left to pick up', () => {
  const files: Files = { 'accord/config.yml': CONFIG };
  files[P('ST-AN-9')] = laneTicket('ST-AN-9');
  done(files, 'ST-AN-1');
  done(files, 'ST-AN-2');
  const { j, text, lines, u } = view(files, MINE);
  expect(j.upNext).toEqual({ rows: [], more: 0 });
  expect(u).toBeGreaterThanOrEqual(0);
  expect(lines[u + 1]).toBe('  none');
  expect(text).not.toContain('[Pick up');
});

it('risk:complex-branching every ready ticket is in ready and none in up next', () => {
  const files: Files = { 'accord/config.yml': CONFIG };
  files[P('ST-AN-9')] = laneTicket('ST-AN-9');
  for (let i = 1; i <= 21; i++) ready(files, 'ST-CY-' + i);
  files[P('ST-BO-1')] = laneTicket('ST-BO-1');
  const { d } = view(files, MINE);
  expect([d.ready.rows.length, d.ready.more]).toEqual([21, 0]);
  expect(d.upNext.rows.map((r) => r.id)).toEqual(['ST-BO-1']);
  expect(d.upNext.more).toBe(0);
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
  const a = lastTwo({ epics: empty, yours: { rows: [row('ST-AN-1')], more: 0 }, team: empty, ready: { rows: [row('ST-AN-2')], more: 0 }, upNext: empty, summary });
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
  const repo = copyRepo(tplCommitted);
  try {
    const sha = gitRun(repo, '-c', 'user.email=An@Example.com', '-c', 'user.name=x', '-c', 'commit.gpgsign=false', 'commit-tree', 'HEAD^{tree}', '-p', 'HEAD', '-m', 'claim').trim();
    gitRun(repo, 'update-ref', 'refs/remotes/origin/t/ST-AN-1', sha);
    gitRun(repo, 'config', 'user.email', 'an@example.com');
    const res = await run(['dashboard', '--json'], repo);
    expect(res.code).toBe(0);
    const j = JSON.parse(res.out) as Dashboard;
    expect(j.yours.rows.map((r) => r.id)).toEqual(['ST-AN-1']);
    expect(j.team.rows.some((r) => r.id === 'ST-AN-1')).toBe(false);
    expect(j).toHaveProperty('upNext');
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

it('risk:regression epics list every epic, with no row cap', () => {
  const files: Files = { 'accord/config.yml': CONFIG };
  for (let i = 1; i <= 25; i++) files[P('EP-AN-' + i)] = laneTicket('EP-AN-' + i, { lane: '' }).replace('type: story', 'type: epic');
  const d = board(files);
  expect([d.epics.rows.length, d.epics.more]).toEqual([25, 0]);
  expect(renderDashboard(d).split('\n').some((l) => l.includes(' more'))).toBe(false);
});

it('risk:regression an idle ticket shows idle days in the dashboard text and the json keeps every key', async () => {
  const written: Files = { 'accord/config.yml': CONFIG, [P('T-1')]: laneTicket('T-1') };
  approve(written, 'T-1');
  const repo = makeLaneRepo({ [P('T-1')]: written[P('T-1')] });
  try {
    commitAllAt(repo, new Date('2000-01-01T00:00:00Z'), 'plan: T-1 ready');
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

it('risk:complex-branching a dependency done only on its claim branch still blocks its dependent', async () => {
  const repo = copyRepo(tplClaimDone);
  try {
    const rows = JSON.parse((await run(['status', '--json'], repo)).out) as { id: string; stage?: string; blockedBy?: string[] }[];
    expect(rows.find((r) => r.id === 'T-1')?.stage).toBe('done');
    expect(rows.find((r) => r.id === 'T-2')?.blockedBy).toEqual(['T-1']);
  } finally {
    cleanup(repo);
  }
});

it('risk:complex-branching the dashboard counts a dependent of a claim-branch-done ticket as blocked', async () => {
  const repo = copyRepo(tplClaimDone);
  try {
    const j = JSON.parse((await run(['dashboard', '--json'], repo)).out);
    expect(j.summary.blocked).toBe(1);
  } finally {
    cleanup(repo);
  }
});

it('ac-4 an unwritten intent points anchor and dashboard to the intent interview', async () => {
  const INTERVIEW = 'the intent interview (accord-intent)';
  const APPROVE = 'the owner approves the ticket (accord approve)';
  const repo = copyRepo(tplIntent);
  try {
    appendFileSync(join(repo, '.git', 'config'), '[user]\n\temail = an@example.com\n');
    expect((await run(['anchor', 'T-2'], repo)).out).toContain(`Stage: intent, next: ${INTERVIEW}`);
    expect((await run(['anchor', 'T-3'], repo)).out).toContain(`Stage: intent, next: ${INTERVIEW}`);
    expect((await run(['anchor', 'T-1'], repo)).out).toContain(`Stage: intent, next: ${APPROVE}`);
    const text = (await run(['dashboard'], repo)).out.split('\n');
    expect(text.find((l) => l.includes('T-2'))).toContain(`intent, next: ${INTERVIEW}`);
    expect(text.find((l) => l.includes('T-3'))).toContain(`intent, next: ${INTERVIEW}`);
    expect(text.find((l) => l.includes('T-1'))).toContain(`intent, next: ${APPROVE}`);
    const j = JSON.parse((await run(['dashboard', '--json'], repo)).out);
    const all = [j.yours, j.team, j.ready, j.upNext].flatMap((s) => s?.rows ?? []) as { id: string; next?: string }[];
    expect(all.find((r) => r.id === 'T-2')?.next).toBe(INTERVIEW);
  } finally {
    cleanup(repo);
  }
});
