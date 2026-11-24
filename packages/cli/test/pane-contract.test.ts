// Phase 08.7 D-02, D-10: the contract between the CLI's JSON and the pane's view. The real CLI runs in a claimed sandbox, and the real generated view.js reads what it printed.
/* eslint-disable @typescript-eslint/no-explicit-any -- the generated view.js is an untyped module */
import { appendFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { pluginTargets } from '@accord-dev/accord-core';
import { afterEach, expect, it } from 'vitest';
import pkg from '../package.json' with { type: 'json' };
import { cleanup, commitAll, commitMsg, gitRun, makeLaneRepo, run, writeFiles } from './helpers/repo.js';
import { approve, laneTicket, P, PLAN } from '../../../test/helpers/lane.js';
import type { Files } from '../../../test/helpers/lane.js';
import { v2Review } from '../../../test/helpers/review-v2.js';

const dirs: string[] = [];
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

async function loadView(): Promise<Record<string, any>> {
  const dir = mkdtempSync(join(tmpdir(), 'accord-pane-contract-'));
  dirs.push(dir);
  for (const f of pluginTargets({ runtimes: ['claude'] }, { name: pkg.name, version: pkg.version })) {
    const p = join(dir, ...f.path.split('/'));
    mkdirSync(dirname(p), { recursive: true });
    writeFileSync(p, f.text);
  }
  return import(/* @vite-ignore */ pathToFileURL(join(dir, '.claude/accord-panel/plugin/hooks/view.js')).href);
}

it('risk:regression the pane reads the real dashboard and show json of a claimed ticket (D-02 D-10)', async () => {
  const repo = makeLaneRepo();
  try {
    gitRun(repo, 'config', 'user.email', 'an@example.com');
    gitRun(repo, 'config', 'user.name', 'fixture');
    gitRun(repo, 'config', 'commit.gpgsign', 'false');
    commitMsg(repo, 'fixture');
    gitRun(repo, 'checkout', '-q', '-b', 't/T-1');
    const dash = await run(['dashboard', '--json'], repo);
    const show = await run(['show', 'T-1', '--json'], repo);
    expect([dash.code, show.code]).toEqual([0, 0]);
    const { outcome, currentOf, detailOutcome, pipelineOf, tabLabels, tabParts, ticketView } = await loadView();
    const state = outcome({ exitCode: 0, stdout: dash.out, stderr: '' });
    expect(state.dashboard).toBeDefined();
    expect(currentOf(state)).toBe('T-1');
    const got = detailOutcome({ exitCode: 0, stdout: show.out, stderr: '' });
    expect(got.ticket).toBeDefined();
    const cell = pipelineOf(got.ticket).find((c: any) => c.state === 'current');
    expect(cell?.key).toBe(got.ticket.stage);
    const labels = tabLabels({ state, ticket: { id: 'T-1', state: got }, running: 0 });
    expect(labels.ticket.label.startsWith('1 ticket T-1 ')).toBe(true);
    expect(labels.dashboard.label.startsWith('2 dashboard ')).toBe(true);
    // issue 342 D-02: the title is the json's title alone, the track names the json's stage in its one bold segment, and the tabs line starts with the id
    const shown = ticketView({ ticket: { id: 'T-1', state: got }, now: Math.floor(Date.now() / 1000) });
    expect(shown.title).toBe(got.ticket.title);
    expect(shown.track.filter((x: any) => x.bold === true).map((x: any) => x.text)).toEqual([got.ticket.stage]);
    expect(shown.track.map((x: any) => x.text).join('')).toContain(got.ticket.stage);
    expect(tabParts({ labels, columns: 100 }).ticket[0].text).toBe('T-1');
  } finally {
    cleanup(repo);
  }
}, 120_000);

// Phase 08.7-07 D-02, D-04: the real `show --json` of a claimed ticket with a review record, two ticket commits and an executor report, read by the real view.js.
it('risk:regression the pane draws the real review and log json of a claimed ticket (D-02 D-04)', async () => {
  const repo = makeLaneRepo({ 'accord/tickets/T-1/review.md': v2Review([[{ lines: ['Must 1 [patch]: the writer drops the header — src/export.ts:1 — open'] }]]) });
  try {
    gitRun(repo, 'config', 'user.email', 'an@example.com');
    gitRun(repo, 'config', 'user.name', 'fixture');
    gitRun(repo, 'config', 'commit.gpgsign', 'false');
    commitMsg(repo, 'chore: base', new Date('2026-03-01T10:00:00Z'));
    gitRun(repo, 'update-ref', 'refs/remotes/origin/main', 'HEAD');
    gitRun(repo, 'switch', '-q', '-c', 't/T-1');
    writeFiles(repo, { 'accord/tickets/T-1/notes-a.md': 'a\n' });
    commitMsg(repo, 'claim: T-1', new Date('2026-03-01T11:00:00Z'));
    writeFiles(repo, { 'accord/tickets/T-1/notes-b.md': 'b\n' });
    commitMsg(repo, 'plan: T-1 ready', new Date('2026-03-01T12:00:00Z'));
    mkdirSync(join(repo, '.accord-reports', 'T-1'), { recursive: true });
    writeFileSync(join(repo, '.accord-reports', '.gitignore'), '*\n');
    writeFileSync(join(repo, '.accord-reports', 'T-1', 'task-1.md'), 'report\n');
    const show = await run(['show', 'T-1', '--json'], repo);
    expect(show.code).toBe(0);
    const { detailOutcome, reviewRows, logRows } = await loadView();
    const got = detailOutcome({ exitCode: 0, stdout: show.out, stderr: '' });
    expect(got.ticket).toBeDefined();
    const review = reviewRows(got.ticket.review);
    expect(review.heading).toBe('REVIEW r1/5');
    expect(review.rounds[0].parts).toContain('Must 1 open');
    const now = Math.floor(Date.now() / 1000);
    expect(logRows(got.ticket.log, now).map((r: any) => r.text)).toEqual(['executor report task 1', 'plan: T-1 ready', 'claim: T-1']);
    // issue 342 D-02: each entry also reads as who did it and what, while the text stays the json's own
    const rows = logRows(got.ticket.log, now);
    expect(rows.map((r: any) => r.say)).toEqual(['finished task 1', 'plan: T-1 ready', 'claim: T-1']);
    expect(rows.map((r: any) => r.who)).toEqual(['executor', 'commit', 'commit']);
  } finally {
    cleanup(repo);
  }
}, 120_000);

// Phase 08.7-04 D-05: the real `dashboard --json` of a sandbox with lane M, S and R tickets and an epic, read by the real view.js: every lane row gets the bar the stage reader gives its row, every epic row a progress.
it('risk:regression the dashboard tab draws a bar for every real dashboard row (D-05)', async () => {
  const repo = makeLaneRepo({
    'accord/tickets/T-2.md': laneTicket('T-2', { lane: 'S' }),
    'accord/tickets/T-3.md': laneTicket('T-3', { lane: 'R' }),
    'accord/tickets/T-4.md': laneTicket('T-4', { frontmatter: ['parent: "EP-1"'] }),
    'accord/tickets/EP-1.md': laneTicket('EP-1', { lane: '' }).replace('type: story', 'type: epic'),
  });
  try {
    gitRun(repo, 'config', 'user.email', 'an@example.com');
    gitRun(repo, 'config', 'user.name', 'fixture');
    gitRun(repo, 'config', 'commit.gpgsign', 'false');
    commitMsg(repo, 'fixture');
    const dash = await run(['dashboard', '--json'], repo);
    expect(dash.code).toBe(0);
    const { outcome, view, pipelineOf } = await loadView();
    const state = outcome({ exitCode: 0, stdout: dash.out, stderr: '' });
    expect(state.dashboard).toBeDefined();
    const raw = new Map<string, any>();
    for (const key of ['yours', 'team', 'ready', 'upNext']) for (const r of state.dashboard[key]?.rows ?? []) raw.set(r.id, r);
    const shown = view(state, '');
    const lanes = shown.sections.filter((s: any) => s.heading !== 'EPICS').flatMap((s: any) => s.rows);
    expect(lanes.length).toBeGreaterThanOrEqual(3);
    for (const row of lanes) {
      const source = raw.get(row.id);
      expect(typeof source?.stage, row.id).toBe('string');
      expect(row.bar.length, row.id).toBe(pipelineOf(source).length);
    }
    const epics = shown.sections.find((s: any) => s.heading === 'EPICS');
    expect(epics?.rows.length).toBeGreaterThanOrEqual(1);
    for (const row of epics.rows) expect(row.progress).toEqual({ label: row.id + ' children done', value: expect.any(Number), max: expect.any(Number), valueText: expect.stringMatching(/^\d+\/\d+ done$/) });
    expect(shown.widths.bar).toBeGreaterThanOrEqual(1);
  } finally {
    cleanup(repo);
  }
}, 120_000);

// Phase 08.8.1-04 D-05 L-05: CSA-185's shape through the real CLI and the real view: accord/ is git-ignored, the json still counts three open tasks, and the pane draws the warning and no count.
it('risk:regression the pane draws the real cli warning and no stage or task count for a repository that ignores accord (D-05 L-05)', async () => {
  const files: Files = { [P('T-1')]: laneTicket('T-1') };
  approve(files, 'T-1');
  const repo = makeLaneRepo({
    ...files,
    'accord/tickets/T-1/plan.md': PLAN + '## Task 3: Docs\ncovers: @ac-1\nfiles: src/export.ts\nverify: export#writes-csv (@ac-1)\nafter: 2\nDocument the csv mode.\n',
  });
  try {
    commitAll(repo, 'plan: T-1 ready');
    appendFileSync(join(repo, '.git', 'info', 'exclude'), 'accord/\n');
    gitRun(repo, 'rm', '-r', '-q', '--cached', 'accord');
    commitMsg(repo, 'chore: stop tracking accord');
    const show = await run(['show', 'T-1', '--json'], repo);
    expect(show.code).toBe(0);
    const json = JSON.parse(show.out);
    expect(json.warnings[0].kind).toBe('not-committed');
    expect([json.tasksTotal, json.tasksDone, json.tasks.length]).toEqual([3, 0, 3]);
    const { detailOutcome, ticketView } = await loadView();
    const got = detailOutcome({ exitCode: 0, stdout: show.out, stderr: '' });
    expect(got.ticket).toBeDefined();
    const shown = ticketView({ ticket: { id: 'T-1', state: got }, now: Math.floor(Date.now() / 1000) });
    expect(shown.notCommitted).toBe(json.warnings[0].text);
    for (const key of ['cells', 'current', 'tasks', 'progress', 'now']) expect(Object.hasOwn(shown, key), key).toBe(false);
    const text = JSON.stringify(shown);
    expect(text).not.toContain('0/3');
    expect(text).not.toContain('0 of 3');
    // Phase 08.8.1-06 L-07 D-05: the plan's three task titles are not drawn either, and the count helpers do return a `0 of 3`, so the absence is the allow-list's doing and not a missing count
    for (const title of ['Writer csv mode', 'Escaping', 'Docs']) expect(text).not.toContain(title);
    const { buildProgress, taskRows } = await loadView();
    expect(buildProgress(got.ticket)).toEqual({ value: 0, max: 3, valueText: '0 of 3' });
    expect(taskRows(got.ticket.tasks, got.ticket.now?.task)).toHaveLength(3);
  } finally {
    cleanup(repo);
  }
}, 120_000);

// Phase 08.8.1-06 L-07: the real `show --json` of a claimed ticket at build with task 1 done, read by the real view.js: one row per plan task, task 1 done and the task `now` names in flight.
it('risk:regression the pane reads the real cli task list and draws one row per plan task (L-07)', async () => {
  const files: Files = { [P('T-1')]: laneTicket('T-1') };
  approve(files, 'T-1');
  const repo = makeLaneRepo({ ...files, 'accord/tickets/T-1/plan.md': PLAN });
  try {
    commitAll(repo, 'plan: T-1 ready');
    writeFiles(repo, { 'accord/tickets/T-1/ledger.md': '## Tasks\n- task 1 done abc1234\n' });
    commitAll(repo, 'task 1 done');
    const show = await run(['show', 'T-1', '--json'], repo);
    expect(show.code).toBe(0);
    const json = JSON.parse(show.out);
    expect(json.stage).toBe('build');
    const { detailOutcome, ticketView } = await loadView();
    const got = detailOutcome({ exitCode: 0, stdout: show.out, stderr: '' });
    expect(got.ticket).toBeDefined();
    const shown = ticketView({ ticket: { id: 'T-1', state: got }, now: Math.floor(Date.now() / 1000) });
    expect(shown.tasks).toHaveLength(json.tasks.length);
    expect(shown.tasks).toHaveLength(2);
    expect(shown.tasks[0]).toMatchObject({ n: 1, state: 'done', mark: '✓' });
    const current = shown.tasks.find((r: any) => r.state === 'current');
    expect(current?.n).toBe(json.now.task);
    expect(shown.progress).toEqual({ value: json.tasksDone, max: json.tasksTotal, valueText: `${json.tasksDone} of ${json.tasksTotal}` });
    // issue 342 D-02: the head names the task and its title, the current task row carries the still star, and the one gradient bar reads the json's counts
    expect(shown.now[0].text).toBe(`Building task ${json.now.task} of ${json.tasksTotal}`);
    expect(shown.now[1].text).toBe(json.now.title);
    expect(current?.mark).toBe('✦');
    expect(shown.barRow.counter).toBe(`${json.tasksDone} of ${json.tasksTotal}`);
  } finally {
    cleanup(repo);
  }
}, 120_000);
