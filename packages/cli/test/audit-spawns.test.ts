// Phase 08.9 D-02 and D-04: the git processes `accord audit` starts do not grow with the number of finished tickets, and the audit reads the repository fresh on every run.
// RESEARCH counted 204 of the audit's 254 processes in the per-ticket claim-fact loop of auditDeferred (38 finished tickets with an undecided item, up to six processes each).
import { afterEach, expect, it, vi } from 'vitest';
import { DEFERRED_MARK_FROM } from '@accord-dev/accord-core';
import { CONFIG, done, laneTicket, P } from '../../../test/helpers/lane.js';
import type { Files } from '../../../test/helpers/lane.js';
import { countedSync, spawnLog } from './helpers/git-spawns.js';
import { cleanup, commitMsg, gitRun, makeEmptyRepo, run, writeFiles } from './helpers/repo.js';
import * as limit from '../src/commands/fetch-limit.js';
import { authorOfSha, authorsOfShas } from '../src/load/audit-hygiene.js';

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

// Phase 08.9 D-02: a finished ticket with a claim commit costs no git process of its own either: its ruleset backfill (`-G^ruleset:`) is read for every ticket by one batched log (08.9-05), so twelve tickets start as many as two.
it('risk:resource accord audit starts as many git processes for twelve finished tickets with a claim commit as for two (D-02)', async () => {
  const few = await spawns(claimedRepo(2));
  const many = await spawns(claimedRepo(12));
  expect(many.length, `${many.length} git processes with 12 tickets (${histogram(many)}), ${few.length} with 2 (${histogram(few)})`).toBe(few.length);
});

// Phase 08.9 D-02: the authors of the commits a dry clean would remove are read with one git process, each equal to what authorOfSha says (D-03).
it('risk:resource the authors of any number of commits a clean would remove are read with one git process (D-02)', () => {
  const repo = sandbox({});
  const shas: string[] = [];
  for (let i = 1; i <= 12; i++) {
    gitRun(repo, 'config', 'user.email', `u${i}@x.io`);
    shas.push(commitMsg(repo, `commit ${i}`, undefined, true));
  }
  const short = shas.map((s) => s.slice(0, 7));
  const read = countedSync(() => authorsOfShas(repo, [...shas, ...short]));
  expect(read.argv.map((a) => a.join(' ')), 'one git process for twelve commits, full and cut to 7 characters').toHaveLength(1);
  for (const sha of [...shas, ...short]) expect(read.value.get(sha), sha).toBe(authorOfSha(repo, sha));
  expect(read.value.get(shas[4])).toBe('u5@x.io');
  // one 40-hex sha the repository lacks fails the whole log call; every value still equals authorOfSha's
  const missing = 'deadbeef'.repeat(5);
  const withMissing = authorsOfShas(repo, [shas[0], missing, short[7]]);
  expect(withMissing.get(missing)).toBeUndefined();
  expect(withMissing.get(shas[0])).toBe(authorOfSha(repo, shas[0]));
  expect(withMissing.get(short[7])).toBe(authorOfSha(repo, short[7]));
  // a text that is no sha maps to undefined and, alone, starts no process
  const nothing = countedSync(() => authorsOfShas(repo, ['not a sha', '--output=x']));
  expect(nothing.argv).toEqual([]);
  expect(nothing.value.get('not a sha')).toBeUndefined();
  expect(nothing.value.get('--output=x')).toBeUndefined();
  expect(countedSync(() => authorsOfShas(repo, [])).argv).toEqual([]);
  // an annotated tag peels to its commit: the printed record names the commit, so the tag's own sha is read alone and answers as authorOfSha does
  gitRun(repo, 'tag', '-a', '-m', 'tag', 'v1', shas[3]);
  const tag = gitRun(repo, 'rev-parse', 'v1').trim();
  expect(authorOfSha(repo, tag)).toBe('u4@x.io');
  expect(authorsOfShas(repo, [tag, shas[1]]).get(tag)).toBe(authorOfSha(repo, tag));
  expect(authorsOfShas(repo, [tag, shas[1]]).get(shas[1])).toBe('u2@x.io');
});

/** A sandbox on main with `count` unmerged local branches backlog/q-<n>, each adding one draft ticket Q-<n> in a commit 100 days old by q@x.io; the branch names hold no date. */
function queuedRepo(count: number): string {
  const repo = sandbox({});
  for (let i = 1; i <= count; i++) {
    gitRun(repo, 'switch', '-q', '-c', `backlog/q-${i}`, 'main');
    gitRun(repo, 'config', 'user.email', 'q@x.io');
    writeFiles(repo, { [`accord/tickets/Q-${i}.md`]: laneTicket(`Q-${i}`) });
    commitMsg(repo, `backlog: queue Q-${i}`, new Date(Date.now() - (100 * 24 + 1) * 3600 * 1000));
    gitRun(repo, 'switch', '-q', 'main');
    gitRun(repo, 'config', 'user.email', 'a@x.io');
  }
  return repo;
}

// The draft gap lines the per-ref reads printed at BASE (captured before 08.9-06 changed them).
const FEW_GAPS = [
  "gap: draft-stale: Q-1 created by q@x.io has waited on backlog/q-1, not merged, for 100 days (stale_draft_days 90) - fix: the owner merges the pull request of backlog/q-1 first, then ask to pick up Q-1 or accord drop Q-1 --reason \"<why>\"",
  "gap: draft-stale: Q-2 created by q@x.io has waited on backlog/q-2, not merged, for 100 days (stale_draft_days 90) - fix: the owner merges the pull request of backlog/q-2 first, then ask to pick up Q-2 or accord drop Q-2 --reason \"<why>\"",
];
const MANY_GAPS = [
  "gap: draft-stale: Q-1 created by q@x.io has waited on backlog/q-1, not merged, for 100 days (stale_draft_days 90) - fix: the owner merges the pull request of backlog/q-1 first, then ask to pick up Q-1 or accord drop Q-1 --reason \"<why>\"",
  "gap: draft-stale: Q-10 created by q@x.io has waited on backlog/q-10, not merged, for 100 days (stale_draft_days 90) - fix: the owner merges the pull request of backlog/q-10 first, then ask to pick up Q-10 or accord drop Q-10 --reason \"<why>\"",
  "gap: draft-stale: Q-11 created by q@x.io has waited on backlog/q-11, not merged, for 100 days (stale_draft_days 90) - fix: the owner merges the pull request of backlog/q-11 first, then ask to pick up Q-11 or accord drop Q-11 --reason \"<why>\"",
  "gap: draft-stale: Q-12 created by q@x.io has waited on backlog/q-12, not merged, for 100 days (stale_draft_days 90) - fix: the owner merges the pull request of backlog/q-12 first, then ask to pick up Q-12 or accord drop Q-12 --reason \"<why>\"",
  "gap: draft-stale: Q-2 created by q@x.io has waited on backlog/q-2, not merged, for 100 days (stale_draft_days 90) - fix: the owner merges the pull request of backlog/q-2 first, then ask to pick up Q-2 or accord drop Q-2 --reason \"<why>\"",
  "gap: draft-stale: Q-3 created by q@x.io has waited on backlog/q-3, not merged, for 100 days (stale_draft_days 90) - fix: the owner merges the pull request of backlog/q-3 first, then ask to pick up Q-3 or accord drop Q-3 --reason \"<why>\"",
  "gap: draft-stale: Q-4 created by q@x.io has waited on backlog/q-4, not merged, for 100 days (stale_draft_days 90) - fix: the owner merges the pull request of backlog/q-4 first, then ask to pick up Q-4 or accord drop Q-4 --reason \"<why>\"",
  "gap: draft-stale: Q-5 created by q@x.io has waited on backlog/q-5, not merged, for 100 days (stale_draft_days 90) - fix: the owner merges the pull request of backlog/q-5 first, then ask to pick up Q-5 or accord drop Q-5 --reason \"<why>\"",
  "gap: draft-stale: Q-6 created by q@x.io has waited on backlog/q-6, not merged, for 100 days (stale_draft_days 90) - fix: the owner merges the pull request of backlog/q-6 first, then ask to pick up Q-6 or accord drop Q-6 --reason \"<why>\"",
  "gap: draft-stale: Q-7 created by q@x.io has waited on backlog/q-7, not merged, for 100 days (stale_draft_days 90) - fix: the owner merges the pull request of backlog/q-7 first, then ask to pick up Q-7 or accord drop Q-7 --reason \"<why>\"",
  "gap: draft-stale: Q-8 created by q@x.io has waited on backlog/q-8, not merged, for 100 days (stale_draft_days 90) - fix: the owner merges the pull request of backlog/q-8 first, then ask to pick up Q-8 or accord drop Q-8 --reason \"<why>\"",
  "gap: draft-stale: Q-9 created by q@x.io has waited on backlog/q-9, not merged, for 100 days (stale_draft_days 90) - fix: the owner merges the pull request of backlog/q-9 first, then ask to pick up Q-9 or accord drop Q-9 --reason \"<why>\"",
];

// Phase 08.9 D-02: the tip age and the creator of old queued drafts come from one for-each-ref, never one log per backlog ref (D-03: the gap lines are those the per-ref reads printed).
it('risk:resource accord audit reads the tips of any number of old queued drafts with one git process (D-02)', async () => {
  const lines = async (count: number): Promise<{ argv: string[][]; gaps: string[] }> => {
    const repo = queuedRepo(count);
    const argv = await spawns(repo);
    const r = await run(['audit'], repo);
    expect(r.code, r.out + r.err).toBe(0);
    return { argv, gaps: r.out.split('\n').filter((l) => l.startsWith('gap: draft-stale:')) };
  };
  const few = await lines(2);
  const many = await lines(12);
  for (const argv of [...few.argv, ...many.argv]) {
    const refs = argv.filter((a) => a.startsWith('refs/heads/backlog/') || a.startsWith('refs/remotes/origin/backlog/'));
    expect(verbOf(argv) === 'log' && refs.length > 0, `a log on a backlog ref: ${argv.join(' ')}`).toBe(false);
  }
  const forEachRef = (all: string[][]): number => all.filter((a) => verbOf(a) === 'for-each-ref').length;
  expect(forEachRef(many.argv), `${histogram(many.argv)} with 12 branches, ${histogram(few.argv)} with 2`).toBe(forEachRef(few.argv));
  expect(few.gaps).toEqual(FEW_GAPS);
  expect(many.gaps).toEqual(MANY_GAPS);
});
