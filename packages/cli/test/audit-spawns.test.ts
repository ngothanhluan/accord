// Phase 08.9 D-02 and D-04: the git processes `accord audit` starts do not grow with the number of finished tickets, and the audit reads the repository fresh on every run.
// RESEARCH counted 204 of the audit's 254 processes in the per-ticket claim-fact loop of auditDeferred (38 finished tickets with an undecided item, up to six processes each).
import { afterEach, expect, it, vi } from 'vitest';
import { DEFERRED_MARK_FROM } from '@accord-dev/accord-core';
import { CONFIG, done, laneTicket, P } from '../../../test/helpers/lane.js';
import type { Files } from '../../../test/helpers/lane.js';
import { spawnLog } from './helpers/git-spawns.js';
import { cleanup, commitMsg, gitRun, makeEmptyRepo, run, writeFiles } from './helpers/repo.js';
import * as limit from '../src/commands/fetch-limit.js';

vi.mock('../src/load/proc.js', async (orig) => {
  const real = await orig<typeof import('../src/load/proc.js')>();
  return { ...real, processTable: vi.fn(real.processTable) };
});
vi.mock('../src/commands/fetch-limit.js', async (orig) => {
  const real = await orig<typeof import('../src/commands/fetch-limit.js')>();
  return { ...real, fetchLimitMs: vi.fn(real.fetchLimitMs), cleanBudgetMs: vi.fn(real.cleanBudgetMs) };
});
vi.mock('node:child_process', async (orig) => (await import('./helpers/git-spawns.js')).wrapChildProcess(await orig<typeof import('node:child_process')>()));

const dirs: string[] = [];
afterEach(() => {
  vi.mocked(limit.cleanBudgetMs).mockReset();
  while (dirs.length > 0) cleanup(dirs.pop() as string);
  spawnLog.on = false;
  spawnLog.after = undefined;
  spawnLog.fail = undefined;
  spawnLog.calls = [];
});

const LEDGER_TASKS = '## Tasks\n- task 1 done abc1234\n- task 2 done abc1234\n\n';
/** The ledger's deferred section: one Must item no owner decided. */
const ITEMS = ['## Deferred', '- review 1.1: the lock is not released on a crash (Must)', ''].join('\n');
const ledgerOf = (id: string): string => `accord/tickets/${id}/ledger.md`;

/** A finished lane M ticket claimed under `ruleset`, its ledger holding the unmarked Must item. */
function doneM(files: Files, id: string, ruleset: string | undefined): void {
  done(files, id, { frontmatter: [...(ruleset === undefined ? [] : [`ruleset: "${ruleset}"`]), 'verified_commit: "abcdef1234567"'] });
  files[ledgerOf(id)] = LEDGER_TASKS + ITEMS;
}

/** A sandbox on branch main holding `files` beside the config, in one commit. */
function sandbox(files: Files): string {
  const repo = makeEmptyRepo();
  dirs.push(repo);
  gitRun(repo, 'symbolic-ref', 'HEAD', 'refs/heads/main');
  gitRun(repo, 'config', 'user.email', 'a@x.io');
  gitRun(repo, 'config', 'user.name', 'a');
  writeFiles(repo, { 'accord/config.yml': CONFIG, 'accord/product/conventions.md': '# Conventions\n\n<!-- One rule per line. -->\n', ...files });
  commitMsg(repo, 'add tickets', new Date(Date.now() - 3 * 24 * 3600 * 1000));
  return repo;
}

/** `count` finished tickets D-1..D-<count>, each claimed under the cut-off release by its own `ruleset` line and holding an undecided Must item; no claim commit. */
function noClaimRepo(count: number): string {
  const files: Files = {};
  for (let i = 1; i <= count; i++) doneM(files, `D-${i}`, DEFERRED_MARK_FROM);
  files[P('ST-9')] = laneTicket('ST-9');
  return sandbox(files);
}

/** The git verb of one argument list: the first word that is neither a flag nor the value of `-c`. */
function verbOf(argv: string[]): string {
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '-c') i++;
    else if (!argv[i].startsWith('-')) return argv[i];
  }
  return '?';
}

const histogram = (all: string[][]): string => {
  const counts = new Map<string, number>();
  for (const argv of all) counts.set(verbOf(argv), (counts.get(verbOf(argv)) ?? 0) + 1);
  return [...counts].sort(([a], [b]) => a.localeCompare(b)).map(([verb, n]) => `${verb}=${n}`).join(' ');
};

/** The git argument lists one in-process `accord audit` starts on `repo`. */
async function spawns(repo: string): Promise<string[][]> {
  spawnLog.calls = [];
  spawnLog.on = true;
  try {
    const r = await run(['audit'], repo);
    expect(r.code, r.out + r.err).toBe(0);
    return spawnLog.calls.map((c) => [...c]);
  } finally {
    spawnLog.on = false;
  }
}

// Phase 08.9 D-02: a finished ticket with an undecided item and no claim commit costs no git process of its own: twelve tickets start as many as two.
it('risk:resource accord audit starts as many git processes for twelve finished tickets with an undecided item and no claim commit as for two (D-02)', async () => {
  const few = await spawns(noClaimRepo(2));
  const many = await spawns(noClaimRepo(12));
  expect(many.length, `${many.length} git processes with 12 tickets (${histogram(many)}), ${few.length} with 2 (${histogram(few)})`).toBe(few.length);
});

// Phase 08.9 D-04: nothing a first audit read is kept for the second one in the same process.
it('risk:regression a second accord audit in one process reads a claim commit added after the first (D-04)', async () => {
  const files: Files = {};
  doneM(files, 'D-5', undefined);
  const repo = sandbox(files);
  const line = (out: string): string => out.split('\n').find((l) => l.startsWith('fact: deferred-marks')) ?? '';
  const first = await run(['audit'], repo);
  expect(first.code, first.out + first.err).toBe(0);
  expect(line(first.out), first.out).toContain('0 judged');
  expect(line(first.out), first.out).toContain('1 skipped because their claim release cannot be read: D-5');
  commitMsg(repo, 'claim: D-5', undefined, true);
  const second = await run(['audit'], repo);
  expect(second.code, second.out + second.err).toBe(0);
  expect(line(second.out), second.out).toContain('1 judged');
  expect(line(second.out), second.out).toContain('0 skipped because their claim release cannot be read');
});

/** `count` finished tickets D-1..D-<count>, each with an undecided Must item and an empty `claim: <id>` commit on main. */
function claimedRepo(count: number): string {
  const files: Files = {};
  for (let i = 1; i <= count; i++) doneM(files, `D-${i}`, undefined);
  files[P('ST-9')] = laneTicket('ST-9');
  const repo = sandbox(files);
  for (let i = 1; i <= count; i++) commitMsg(repo, `claim: D-${i}`, undefined, true);
  return repo;
}

// Phase 08.9 D-02: the ruleset log (`-G^ruleset:`, 08.9-05 takes it on) is the only git process a finished ticket with a claim commit still costs.
it('risk:resource the only git process accord audit adds per finished ticket with a claim commit is its ruleset log (D-02)', async () => {
  const isRuleset = (argv: string[]): boolean => argv.includes('-G^ruleset:');
  const few = await spawns(claimedRepo(2));
  const many = await spawns(claimedRepo(12));
  const rest = (all: string[][]): string[][] => all.filter((a) => !isRuleset(a));
  expect([few.filter(isRuleset).length, many.filter(isRuleset).length], 'one ruleset log per ticket').toEqual([2, 12]);
  expect(rest(many).length, `${rest(many).length} other git processes with 12 tickets (${histogram(rest(many))}), ${rest(few).length} with 2 (${histogram(rest(few))})`).toBe(rest(few).length);
});
