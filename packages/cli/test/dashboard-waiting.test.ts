// Phase 15 D-22, SC-8 (15-08): a ticket verified on its claim branch and not yet done on the default ref is a pull request waiting for its merge. Its row carries `waitingSince`
// (the newest activity, read from the commit times the loader already reads, never from `gh`) and the text row says how long it has waited. Real git in tmp sandboxes.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, expect, it } from 'vitest';
import { CONFIG, discussFiles, done, ready } from '../../../test/helpers/lane.js';
import { renderDashboard } from '../src/render/dashboard.js';
import type { Files } from '../../../test/helpers/lane.js';
import { cleanup, commitMsg, gitRun, makeEmptyRepo, mergeMsg, run, writeFiles } from './helpers/repo.js';

type Json = Record<string, unknown>;
type Row = { id: string; stage?: string; next?: string; claimedBy?: string; waitingSince?: string };

const made: string[] = [];
afterEach(() => {
  for (const dir of made.splice(0).reverse()) cleanup(dir);
});

const HOUR = 3600 * 1000;

/** An empty claim commit on a new branch t/<id>, authored by `author`; the checkout stays on that branch. */
function claimBranch(repo: string, id: string, author: string): void {
  gitRun(repo, 'switch', '-q', '-c', `t/${id}`);
  const folder = mkdtempSync(join(tmpdir(), 'accord-msg-'));
  try {
    const file = join(folder, 'msg.txt');
    writeFileSync(file, `claim: ${id}\n`);
    const env: NodeJS.ProcessEnv = { ...process.env };
    for (const k of ['GIT_AUTHOR_EMAIL', 'GIT_AUTHOR_NAME', 'GIT_COMMITTER_NAME', 'GIT_COMMITTER_EMAIL']) delete env[k];
    execFileSync('git', ['-c', `user.email=${author}`, '-c', 'user.name=who', '-c', 'commit.gpgsign=false', 'commit', '-q', '--allow-empty', '-F', file, '--cleanup=verbatim'], { cwd: repo, env, stdio: ['ignore', 'pipe', 'pipe'] });
  } finally {
    cleanup(folder);
  }
}

/** main holds T-1 and T-2, both ready; `origin/main` is faked at main's tip, as a clone that fetched it. */
function base(): string {
  const repo = makeEmptyRepo();
  made.push(repo);
  gitRun(repo, 'symbolic-ref', 'HEAD', 'refs/heads/main');
  gitRun(repo, 'config', 'user.email', 'v@x.io');
  gitRun(repo, 'config', 'user.name', 'viewer');
  const files: Files = { 'accord/config.yml': CONFIG, ...discussFiles('T-1', 'T-2') };
  ready(files, 'T-1');
  ready(files, 'T-2');
  writeFiles(repo, files);
  commitMsg(repo, 'add tickets', new Date(Date.now() - 10 * HOUR)); // older than every commit a test ages: the newest activity of a row is the newest of main's commits on it and its branch tip
  gitRun(repo, 'update-ref', 'refs/remotes/origin/main', 'HEAD');
  return repo;
}

/** The claim branch t/T-1 with the build, the review and the verify ticks committed `ago` ms before now, as verify leaves it; the checkout goes back to main. */
function verifiedOnBranch(repo: string, ago: number): Date {
  claimBranch(repo, 'T-1', 'v@x.io');
  const files: Files = {};
  done(files, 'T-1');
  writeFiles(repo, files);
  const when = new Date(Date.now() - ago);
  commitMsg(repo, 'verify: T-1', when);
  gitRun(repo, 'switch', '-q', 'main');
  return when;
}

const SECTIONS = ['yours', 'team', 'ready', 'upNext', 'mergedWaiting'] as const;
const dash = async (dir: string): Promise<Json> => {
  const r = await run(['dashboard', '--json', '--no-fetch'], dir);
  expect(r.code, r.err).toBe(0);
  return JSON.parse(r.out) as Json;
};
const rowOf = (d: Json, id: string): Row | undefined => SECTIONS.flatMap((s) => (d[s] as { rows?: Row[] } | undefined)?.rows ?? []).find((r) => r.id === id);

it('risk:regression a ticket verified on its claim branch and not done on the default ref carries waitingSince and shows waiting for its merge with its age (D-22)', async () => {
  const repo = base();
  const when = verifiedOnBranch(repo, 2 * HOUR);

  const row = rowOf(await dash(repo), 'T-1');
  expect(row).toMatchObject({ stage: 'done' });
  // the commit time in whole seconds, as ISO 8601 UTC
  expect(row?.waitingSince).toBe(new Date(Math.floor(when.getTime() / 1000) * 1000).toISOString());

  const text = await run(['dashboard', '--no-fetch'], repo);
  expect(text.code, text.err).toBe(0);
  const line = text.out.split('\n').find((l) => /^ {2}T-1\b/.test(l));
  expect(line).toContain('waiting for merge, 2h');
  // nothing is written: the wait is read from git
  expect(gitRun(repo, 'status', '--short').trim()).toBe('');
}, 120_000);

it('risk:regression a ticket that is not verified has no waitingSince, and neither has a ticket nobody claimed (D-22)', async () => {
  const repo = base();
  claimBranch(repo, 'T-2', 'v@x.io');
  writeFiles(repo, { 'accord/tickets/T-2/ledger.md': '## Tasks\n- task 1 done abc1234\n' });
  commitMsg(repo, 'build: T-2 task 1', new Date(Date.now() - 3 * HOUR));
  gitRun(repo, 'switch', '-q', 'main');

  const d = await dash(repo);
  expect(rowOf(d, 'T-2')).toBeDefined();
  expect(rowOf(d, 'T-2')?.waitingSince).toBeUndefined();
  expect(rowOf(d, 'T-1')?.waitingSince).toBeUndefined();
  const text = await run(['dashboard', '--no-fetch'], repo);
  expect(text.out).not.toContain('waiting for merge');
}, 120_000);

it('risk:regression once the ticket is done on the default ref no row carries waitingSince (D-22)', async () => {
  const repo = base();
  verifiedOnBranch(repo, 2 * HOUR);
  mergeMsg(repo, 't/T-1', 'Merge pull request #1 from t/T-1');
  gitRun(repo, 'update-ref', 'refs/remotes/origin/main', 'HEAD');

  const d = await dash(repo);
  for (const id of ['T-1', 'T-2']) expect(rowOf(d, id)?.waitingSince, id).toBeUndefined();
  const text = await run(['dashboard', '--no-fetch'], repo);
  expect(text.out).not.toContain('waiting for merge');
}, 120_000);

it('risk:parsing the age is whole minutes under an hour, whole hours under two days, else days, and an unreadable time leaves the age out (D-22)', () => {
  const now = Date.parse('2026-11-26T12:00:00.000Z');
  const row = (waitingSince: string) => ({ id: 'T-1', lane: 'M', title: 't', stage: 'done', ui: false, errors: 0, warnings: 0, ready: 'ok', ticksVerified: 0, ticksTagged: 0, ticksBinding: 'bound', waitingSince });
  const empty = { rows: [], more: 0 };
  const text = (waitingSince: string): string =>
    renderDashboard(
      { yours: { rows: [row(waitingSince)], more: 0 }, team: empty, ready: empty, upNext: empty, mergedWaiting: empty, epics: { rows: [], more: 0 }, summary: { inProgress: 1, ready: 0, blocked: 0, backlog: 0, done: 0, withoutLane: 0, withSchemaErrors: 0, mergedWaiting: 0 } } as never,
      now,
    );
  const at = (ms: number) => new Date(now - ms).toISOString();
  expect(text(at(59 * 60_000 + 59_000))).toContain('waiting for merge, 59m');
  expect(text(at(60 * 60_000))).toContain('waiting for merge, 1h');
  expect(text(at(47 * HOUR + 59 * 60_000))).toContain('waiting for merge, 47h');
  expect(text(at(48 * HOUR))).toContain('waiting for merge, 2d');
  expect(text(at(-5 * 60_000))).toContain('waiting for merge, 0m'); // a time in the future (a skewed clock) reads as just now
  const bad = text('not a time');
  expect(bad).toContain('(waiting for merge)');
  expect(bad).not.toMatch(/waiting for merge, /);
});
