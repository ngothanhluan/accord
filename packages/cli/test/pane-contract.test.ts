// Phase 08.7 D-02, D-10: the contract between the CLI's JSON and the pane's view. The real CLI runs in a claimed sandbox, and the real generated view.js reads what it printed.
/* eslint-disable @typescript-eslint/no-explicit-any -- the generated view.js is an untyped module */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { pluginTargets } from '@accord-dev/accord-core';
import { afterEach, expect, it } from 'vitest';
import pkg from '../package.json' with { type: 'json' };
import { cleanup, commitMsg, gitRun, makeLaneRepo, run, writeFiles } from './helpers/repo.js';
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
    const { outcome, currentOf, detailOutcome, pipelineOf, tabLabels } = await loadView();
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
  } finally {
    cleanup(repo);
  }
}, 120_000);
