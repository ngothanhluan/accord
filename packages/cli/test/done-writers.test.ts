// Phase 15 G1 (D-23): accord never writes to a ticket done on the default branch. `accord approve`, the `ac_hash` write of `gate ready`, the `plan_hash` write of `gate plan` and the `ruleset:`
// backfill of `worktree sync` / `continue` refuse or skip it, each with one line, and the file's bytes do not move. A ticket not done is written as before. Real git, real commands.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, expect, it, vi } from 'vitest';
import { RULESET_FROM } from '@accord-dev/accord-core';
import { cleanup, commitMsg, gitRun, makeEmptyRepo, run, writeFiles } from './helpers/repo.js';
import { CONFIG, REPORT, building, discussFiles, done, junit, P, laneTicket, pinned } from '../../../test/helpers/lane.js';
import type { Files } from '../../../test/helpers/lane.js';
import { doneOnDefaultBranch } from '../src/load/done-on-default.js';
import { copy, doneBranch, lines, pushMain, useSandboxes } from './helpers/worktree.js';

// the running version: the package's own unless a test moves it (the backfill is about releases around RULESET_FROM)
const running = vi.hoisted(() => ({ v: undefined as string | undefined }));
vi.mock('../package.json', async (orig) => {
  const m = await orig<{ default: Record<string, unknown> }>();
  const mocked = { ...m.default };
  Object.defineProperty(mocked, 'version', { get: () => running.v ?? (m.default.version as string), enumerable: true });
  return { default: mocked };
});
vi.mock('../src/load/proc.js', async (orig) => {
  const real = await orig<typeof import('../src/load/proc.js')>();
  return { ...real, processTable: vi.fn(real.processTable) };
});
vi.mock('../src/commands/fetch-limit.js', async (orig) => {
  const real = await orig<typeof import('../src/commands/fetch-limit.js')>();
  return { ...real, fetchLimitMs: vi.fn(real.fetchLimitMs) };
});
// A passthrough: the backfill and the re-bind cases force the done fact, every other case reads real git.
vi.mock('../src/load/done-on-default.js', async (orig) => {
  const real = await orig<typeof import('../src/load/done-on-default.js')>();
  return { ...real, doneOnDefaultBranch: vi.fn(real.doneOnDefaultBranch) };
});

useSandboxes([{ tickets: [] }, {}]);

const repos: string[] = [];
afterEach(() => {
  running.v = undefined;
  vi.mocked(doneOnDefaultBranch).mockReset();
  while (repos.length > 0) cleanup(repos.pop() as string);
});

const LINE = (id: string): string => `${id} is done on the default branch; a done ticket is not edited`;
const bytes = (repo: string, rel: string): Buffer => readFileSync(join(repo, rel));
const PLAN_OF = (id: string): string => `accord/tickets/${id}/plan.md`;
/** A plan whose `plan_hash` is wrong, so a passing `gate plan` has a hash to write. */
const staleHash = (plan: string): string => plan.replace(/plan_hash: "[^"]*"/, 'plan_hash: "fnv1a64:0000000000000000"');

/**
 * A repository whose `main` holds done T-1 and, for the not-done cases, T-2 (built, approved, plan with a wrong plan_hash, no ac_hash); HEAD is the branch `work`. The plans carry a wrong hash so
 * `gate plan` has something to write, and the done ticket carries no `ac_hash` so `gate ready` has something to write.
 */
function repoWithDone(): string {
  const repo = makeEmptyRepo();
  repos.push(repo);
  writeFiles(repo, {
    'accord/config.yml': CONFIG,
    [REPORT]: junit({ 'export#writes-csv': 'passed', 'export#escapes-commas': 'passed' }),
    'src/export.ts': 'export const write = 1;\n',
  });
  const baseline = commitMsg(repo, 'baseline');
  const files: Files = discussFiles('T-1', 'T-2');
  done(files, 'T-1');
  building(files, 'T-2');
  for (const id of ['T-1', 'T-2']) files[PLAN_OF(id)] = staleHash(files[PLAN_OF(id)]).replace('abc1234', baseline);
  writeFiles(repo, files);
  commitMsg(repo, 'base: T-1 done, T-2 under way');
  gitRun(repo, 'branch', '-M', 'main');
  gitRun(repo, 'switch', '-q', '-c', 'work');
  return repo;
}

it('risk:data-loss accord approve refuses a ticket done on the default branch, names it, and leaves the file as it was (D-23)', async () => {
  const repo = repoWithDone();
  const before = bytes(repo, P('T-1'));
  const r = await run(['approve', 'T-1'], repo);
  expect(r.code).toBe(1);
  expect(r.out).toBe(LINE('T-1') + '\n');
  expect(bytes(repo, P('T-1')).equals(before)).toBe(true);
}, 120_000);

it('risk:data-loss gate ready on a done ticket whose ac_hash differs prints the verdict, writes nothing and says so on stderr (D-23)', async () => {
  const repo = repoWithDone();
  expect(readFileSync(join(repo, P('T-1')), 'utf8')).not.toContain('ac_hash');
  const before = bytes(repo, P('T-1'));
  const r = await run(['gate', 'ready', 'T-1'], repo);
  expect(r.out).toContain('0 errors');
  expect(r.code).toBe(0);
  expect(r.err).toBe('not written: ' + LINE('T-1') + '\n');
  expect(bytes(repo, P('T-1')).equals(before)).toBe(true);
}, 120_000);

it('risk:data-loss gate plan on a done ticket writes no plan_hash and says so on stderr (D-23)', async () => {
  const repo = repoWithDone();
  const before = bytes(repo, PLAN_OF('T-1'));
  const r = await run(['gate', 'plan', 'T-1'], repo);
  expect(r.code, r.out + r.err).toBe(0);
  expect(r.err).toBe('not written: ' + LINE('T-1') + '\n');
  expect(bytes(repo, PLAN_OF('T-1')).equals(before)).toBe(true);
}, 120_000);

it('risk:regression a ticket not done on the default branch is written as before by approve, gate ready and gate plan (D-23)', async () => {
  const repo = repoWithDone();
  // approve: an unapproved lane M ticket T-3 on main
  const files: Files = {};
  files[P('T-3')] = laneTicket('T-3');
  files['accord/tickets/T-3/scout.md'] = 'skipped: nothing to scout in a test\n';
  writeFiles(repo, files);
  commitMsg(repo, 'T-3 queued');
  gitRun(repo, 'branch', '-f', 'main', 'HEAD');
  const approved = await run(['approve', 'T-3'], repo);
  expect(approved.err).toBe('');
  expect(approved.out).toMatch(/^approved accord\/tickets\/T-3\.md at /);
  expect(readFileSync(join(repo, P('T-3')), 'utf8')).toContain('approved_hash');
  // gate ready writes ac_hash into T-2
  const ready = await run(['gate', 'ready', 'T-2'], repo);
  expect(ready.code, ready.out + ready.err).toBe(0);
  expect(ready.err).toContain('wrote ac_hash ');
  expect(readFileSync(join(repo, P('T-2')), 'utf8')).toContain('ac_hash');
  // gate plan writes plan_hash into T-2's plan
  const planned = await run(['gate', 'plan', 'T-2'], repo);
  expect(planned.code, planned.out + planned.err).toBe(0);
  expect(planned.err).toContain('wrote plan_hash ');
  expect(readFileSync(join(repo, PLAN_OF('T-2')), 'utf8')).not.toContain('0000000000000000');
}, 120_000);

it('risk:regression where no default ref can be read no ticket counts as done, so every writer behaves as before (D-23)', async () => {
  const repo = makeEmptyRepo();
  repos.push(repo);
  writeFiles(repo, { 'accord/config.yml': CONFIG, [REPORT]: junit({}), 'src/export.ts': 'export {};\n' });
  const baseline = commitMsg(repo, 'baseline');
  const files: Files = discussFiles('T-2');
  building(files, 'T-2');
  files[PLAN_OF('T-2')] = staleHash(files[PLAN_OF('T-2')]).replace('abc1234', baseline);
  writeFiles(repo, files);
  commitMsg(repo, 'no main, no origin');
  gitRun(repo, 'branch', '-M', 'side'); // a repository whose only branch is neither main nor master, with no origin
  const real = (await vi.importActual<typeof import('../src/load/done-on-default.js')>('../src/load/done-on-default.js')).doneOnDefaultBranch;
  expect(real(repo, 'T-2')).toBe(false);
  const planned = await run(['gate', 'plan', 'T-2'], repo);
  expect(planned.err).toContain('wrote plan_hash ');
}, 120_000);

// ---- the ruleset backfill of a sync ----

const ID = 'ST-9';
const TICKET = P(ID);
const CONFIG_REL = 'accord/config.yml';
const backfilledLines = (out: string): string[] => lines(out).filter((l) => l.startsWith('backfilled:'));
const subjects = (wt: string): string[] => gitRun(wt, 'log', '--format=%s').split('\n').filter((l) => l !== '');

it('risk:data-loss the ruleset backfill of a sync writes nothing into a ticket done on the default branch, and writes it once the ticket is not (D-23)', async () => {
  const c = copy({ tickets: [] });
  const pinTo = (v: string): void => {
    running.v = v;
    writeFiles(c.root, { [CONFIG_REL]: pinned(v) });
    commitMsg(c.root, 'pin ' + v, undefined, true);
    c.git('push', '-q', 'origin', 'main');
  };
  pinTo('0.4.1');
  const made = await run(['new', 'ticket', ID, '--lane', 'M', '--worktree', '--no-dup-check'], c.root);
  expect([made.code, made.err]).toEqual([0, '']);
  const wt = c.sibling(ID);
  expect(gitRun(wt, 'show', 'HEAD:' + TICKET)).not.toContain('ruleset');
  pinTo(RULESET_FROM); // main moves on to a release that writes the field
  const before = bytes(wt, TICKET);
  vi.mocked(doneOnDefaultBranch).mockReturnValue(true); // the ticket reads done on the default branch
  const held = await run(['worktree', 'open', ID, '--continue'], c.root);
  expect([held.code, held.err]).toEqual([0, '']);
  expect(lines(held.out).some((l) => l.startsWith('merged:'))).toBe(true);
  expect(backfilledLines(held.out)).toEqual([]);
  expect(subjects(wt).some((l) => l.startsWith('ruleset: '))).toBe(false);
  expect(bytes(wt, TICKET).equals(before)).toBe(true);
  // the same sync once the ticket is not done there writes the field: the guard is what held it back
  vi.mocked(doneOnDefaultBranch).mockReset();
  pushMain(c, 'next.txt', 'next\n');
  const again = await run(['worktree', 'open', ID, '--continue'], c.root);
  expect([again.code, again.err]).toEqual([0, '']);
  expect(backfilledLines(again.out)).toEqual([`backfilled: ${ID} ruleset 0.4.1`]);
}, 240_000);

// A-WR-05: the re-bind that follows accord's own rebase writes verified_commit into the ticket and commit: into verification.md; into a ticket done on the default branch it writes nothing.
it('risk:data-loss the re-bind after a rebase writes nothing into a ticket done on the default branch, says so once, and re-binds once it is not done (D-23, A-WR-05)', async () => {
  const c = copy();
  const { sib } = doneBranch(c, { gitKeys: ['  merge: rebase'] });
  pushMain(c, 'notes.txt', 'main moves\n'); // an unrelated change: the ticket's files are unchanged by the rebase, so the re-bind would write
  const ticket = 'accord/tickets/ST-9.md';
  vi.mocked(doneOnDefaultBranch).mockReturnValue(true);
  const held = await run(['worktree', 'sync', 'ST-9'], sib);
  expect(held.code, held.err).toBe(0);
  expect(lines(held.out).filter((l) => l.startsWith('rebound:'))).toEqual([]);
  expect(held.err.split('\n').filter((l) => l.startsWith('not written: '))).toEqual(['not written: ' + LINE('ST-9')]);
  expect(gitRun(sib, 'log', '--format=%s').split('\n').some((l) => l.includes('rebound after rebase'))).toBe(false);
  expect(gitRun(sib, 'show', 'HEAD:' + ticket)).not.toContain(gitRun(sib, 'rev-parse', 'HEAD').trim());
  // the same sync with the ticket not done there re-binds: the guard is what held it back
  vi.mocked(doneOnDefaultBranch).mockReset();
  const c2 = copy();
  const second = doneBranch(c2, { gitKeys: ['  merge: rebase'] });
  pushMain(c2, 'notes.txt', 'main moves\n');
  const again = await run(['worktree', 'sync', 'ST-9'], second.sib);
  expect([again.code, again.err]).toEqual([0, '']);
  expect(lines(again.out).filter((l) => l.startsWith('rebound:'))).toHaveLength(1);
}, 240_000);
