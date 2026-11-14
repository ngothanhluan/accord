// ST-LN-96 t1-ac-4, D-16 Option E: when accord's own rebase (`accord worktree sync` under git.merge: rebase) leaves the ticket's files unchanged, it re-binds
// verified_commit and verification.md's commit: to the rebased HEAD in one records-only commit, so `gate done` passes in a fresh clone (CI) after the
// force-push. A rebase by hand, or by a git.sync script, is never re-bound. Real git, a bare remote, and a fresh clone of it as CI has.
// ST-LN-96 rel-ac-1 (Open Question 8): a ticket claimed before RULESET_FROM whose file lives only on its branch gets `ruleset` at its first sync.
import { mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, expect, it, vi } from 'vitest';
import { RULESET_FROM } from '@accord-dev/accord-core';
import { cleanup, commitMsg, gitRun, run, writeFiles } from './helpers/repo.js';
import { gitClaimFacts } from '../src/load/claim-facts.js';
import { copy, type Clone, doneBranch, EXPORT, exportText, lines, pushMain, useSandboxes, VERIFICATION } from './helpers/worktree.js';
import { P, pinned } from '../../../test/helpers/lane.js';

// the running version: the package's own unless a test moves it (the backfill is about releases around RULESET_FROM)
const running = vi.hoisted(() => ({ v: undefined as string | undefined }));
vi.mock('../package.json', async (orig) => {
  const m = await orig<{ default: Record<string, unknown> }>();
  const mocked = { ...m.default };
  Object.defineProperty(mocked, 'version', { get: () => running.v ?? (m.default.version as string), enumerable: true });
  return { default: mocked };
});
afterEach(() => {
  running.v = undefined;
});
vi.mock('../src/load/proc.js', async (orig) => {
  const real = await orig<typeof import('../src/load/proc.js')>();
  return { ...real, processTable: vi.fn(real.processTable) };
});
vi.mock('../src/commands/fetch-limit.js', async (orig) => {
  const real = await orig<typeof import('../src/commands/fetch-limit.js')>();
  return { ...real, fetchLimitMs: vi.fn(real.fetchLimitMs) };
});

useSandboxes([{}, { tickets: [] }]);

const REBASE = ['  merge: rebase'];
const ID = 'ST-9';
const TICKET = P(ID);
const PLAN_FILE = `accord/tickets/${ID}/plan.md`;
const REVIEW_FILE = `accord/tickets/${ID}/review.md`;

type Found = { rule: string; reason: string };

/** What CI sees: a fresh clone of the remote on the ticket branch holds only reachable objects. Returns the two stale findings of `gate done`. */
async function inFreshClone(c: Clone): Promise<Found[]> {
  const dir = realpathSync.native(mkdtempSync(join(tmpdir(), 'accord-fresh-')));
  try {
    gitRun(dir, 'clone', '-q', '--no-local', c.remote, '.'); // --no-local: a local clone would hardlink every object, the unreachable old commits too
    gitRun(dir, 'switch', '-q', 't/ST-9');
    const gate = await run(['gate', 'done', ID, '--json'], dir);
    expect(gate.err).toBe('');
    return (JSON.parse(gate.out).findings as Found[]).filter((f) => f.rule === 'gate.tick-stale-commit' || f.rule === 'gate.stale-review');
  } finally {
    cleanup(dir);
  }
}

const at = (dir: string, ref: string, file: string): string => gitRun(dir, 'show', `${ref}:${file}`);
const head = (dir: string, ref = 'HEAD'): string => gitRun(dir, 'rev-parse', ref).trim();
const reboundLines = (out: string): string[] => lines(out).filter((l) => l.startsWith('rebound:'));
const subject = (dir: string): string => gitRun(dir, 'log', '-1', '--format=%s').trim();

it("risk:complex-branching accord's rebase re-binds an unchanged verification so CI's gate done passes (ST-LN-96 t1-ac-4 D-16)", async () => {
  const c = copy();
  const { sib, v } = doneBranch(c, { gitKeys: REBASE });
  pushMain(c, 'notes.txt', 'main moves\n'); // an unrelated change: the ticket's files are unchanged by the rebase
  const review = at(sib, 'HEAD', REVIEW_FILE);
  const plan = at(sib, 'HEAD', PLAN_FILE);
  const r = await run(['worktree', 'sync', ID], sib);
  expect([r.code, r.err]).toEqual([0, '']);
  const rebased = head(sib, 'HEAD~1'); // verify's commit, replayed
  expect(v).not.toBe(rebased);
  expect(reboundLines(r.out)).toEqual([`rebound: ${ID} verified_commit ${v.slice(0, 12)} -> ${rebased.slice(0, 12)}`]);
  // one records-only commit on top of the rebased branch, with exactly the two key lines changed
  expect(subject(sib)).toBe(`verify: ${ID} rebound after rebase`);
  expect(gitRun(sib, 'show', '--format=', '--name-only', 'HEAD').trim().split('\n').sort()).toEqual([TICKET, VERIFICATION].sort());
  const changed = gitRun(sib, 'show', '--format=', '-U0', 'HEAD').split('\n').filter((l) => /^[+-]/.test(l) && !/^(\+\+\+|---) /.test(l));
  expect(changed).toHaveLength(4);
  expect(changed.filter((l) => l.startsWith('-')).map((l) => l.slice(1).replace(/\r$/, '')).sort()).toEqual([`commit: ${v}`, `verified_commit: "${v}"`]);
  expect(changed.filter((l) => l.startsWith('+')).map((l) => l.slice(1).replace(/\r$/, '')).sort()).toEqual([`commit: "${rebased}"`, `verified_commit: "${rebased}"`]);
  // the owner-typed records are untouched
  expect(at(sib, 'HEAD', REVIEW_FILE)).toBe(review);
  expect(at(sib, 'HEAD', PLAN_FILE)).toBe(plan);
  // pushed with the lease: origin holds what the gate judges
  expect(head(c.remote, 'refs/heads/t/ST-9')).toBe(head(sib));
  // CI: a fresh clone has no old commit, and gate done finds nothing stale
  expect(await inFreshClone(c)).toEqual([]);
  // synced already: nothing runs again, nothing is written
  const again = await run(['worktree', 'sync', ID], sib);
  expect([again.code, again.out, again.err]).toEqual([0, '', '']);
  expect(head(sib)).toBe(head(c.remote, 'refs/heads/t/ST-9'));
}, 240_000);

it('risk:complex-branching a changed ticket is never re-bound (ST-LN-96 t1-ac-4 D-16)', async () => {
  const c = copy();
  const { sib, v } = doneBranch(c, { gitKeys: REBASE });
  // main edits the last line of a file the ticket changes: the rebase is clean and the file's contents differ from what was verified
  pushMain(c, EXPORT, exportText({ 12: 'export const line12 = 1200;' }));
  const review = at(sib, 'HEAD', REVIEW_FILE);
  const ticket = at(sib, 'HEAD', TICKET);
  const r = await run(['worktree', 'sync', ID], sib);
  expect([r.code, r.err]).toEqual([0, '']);
  expect(reboundLines(r.out)).toEqual([]);
  expect(lines(r.out)).toContain(`verify again: ${ID}'s files changed since ${v.slice(0, 12)}: ${EXPORT}`);
  // no records commit: the branch's own commits were replayed and nothing was added
  expect(subject(sib)).toBe(`verify: ${ID}`);
  expect(gitRun(sib, 'rev-list', '--count', 'origin/main..HEAD').trim()).toBe('3'); // config, work, verify
  expect(at(sib, 'HEAD', TICKET)).toBe(ticket);
  expect(at(sib, 'HEAD', REVIEW_FILE)).toBe(review);
  expect(at(sib, 'HEAD', VERIFICATION)).toContain(`commit: ${v}`);
  // the rebased branch was pushed all the same, and CI's gate done refuses it
  expect(head(c.remote, 'refs/heads/t/ST-9')).toBe(head(sib));
  const found = await inFreshClone(c);
  expect(found.map((f) => f.rule).sort()).toEqual(['gate.stale-review', 'gate.tick-stale-commit']);
}, 240_000);

it('risk:complex-branching a hand rebase and a git.sync rebase are not re-bound (ST-LN-96 t1-ac-4 D-16)', async () => {
  const notHere = /; the verified commit is not in this clone, so its contents cannot be compared - verify again$/;
  // by hand: git rebase and git push --force-with-lease, no accord
  const h = copy();
  const hand = doneBranch(h, { gitKeys: REBASE });
  pushMain(h, 'notes.txt', 'main moves\n');
  gitRun(hand.sib, 'fetch', '-q', 'origin');
  gitRun(hand.sib, 'rebase', '-q', 'origin/main');
  gitRun(hand.sib, 'push', '-q', '--force-with-lease', 'origin', 't/ST-9');
  const byHand = await inFreshClone(h);
  expect(byHand.map((f) => f.rule).sort()).toEqual(['gate.stale-review', 'gate.tick-stale-commit']);
  for (const f of byHand) expect(f.reason).toMatch(notHere);

  // by a git.sync script that rebases: accord pushes it, and re-binds nothing. The ticket was edited after verify, so it is at verify and sync runs.
  const s = copy();
  const dir = mkdtempSync(join(tmpdir(), 'accord-rebind-fx-'));
  try {
    const file = join(dir, 'team.mjs').replaceAll('\\', '/');
    writeFileSync(file, "import { execFileSync } from 'node:child_process';\nexecFileSync('git', ['rebase', process.env.ACCORD_BASE_REF], { stdio: 'pipe' });\n");
    const script = doneBranch(s, { gitKeys: [`  sync: 'node ${file}'`], after: true });
    pushMain(s, 'notes.txt', 'main moves\n');
    const r = await run(['worktree', 'sync', ID], script.sib);
    expect([r.code, r.err]).toEqual([0, '']);
    expect(lines(r.out)).toContain(`synced: t/${ID} by git.sync`);
    expect(reboundLines(r.out)).toEqual([]);
    expect(subject(script.sib)).toBe(`ST-9 edits the export after verify`);
    expect(head(s.remote, 'refs/heads/t/ST-9')).toBe(head(script.sib));
    const bySync = await inFreshClone(s);
    expect(bySync.map((f) => f.rule).sort()).toEqual(['gate.stale-review', 'gate.tick-stale-commit']);
    for (const f of bySync) expect(f.reason).toMatch(notHere);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}, 360_000);

it('risk:security a verified commit that is not in this clone is never re-bound (ST-LN-96 t1-ac-4 D-16)', async () => {
  const c = copy();
  const { sib, v } = doneBranch(c, { gitKeys: REBASE });
  // the ticket names a commit this clone never had: the stage reads verify, so the sync runs, and there is nothing to compare against
  const ghost = 'b'.repeat(40);
  writeFileSync(sib + '/' + TICKET, readFileSync(sib + '/' + TICKET, 'utf8').replace(v, ghost));
  gitRun(sib, 'add', '-A');
  gitRun(sib, '-c', 'user.email=fixture@example.invalid', '-c', 'user.name=fixture', 'commit', '-q', '-m', 'ghost');
  gitRun(sib, 'push', '-q', 'origin', 't/ST-9');
  pushMain(c, 'notes.txt', 'main moves\n');
  const before = at(sib, 'HEAD', TICKET);
  const r = await run(['worktree', 'sync', ID], sib);
  expect([r.code, r.err]).toEqual([0, '']);
  expect(reboundLines(r.out)).toEqual([]);
  expect(lines(r.out)).toContain(`verify again: ${ID}'s verified commit ${ghost.slice(0, 12)} is not in this clone`);
  expect(subject(sib)).toBe('ghost');
  expect(at(sib, 'HEAD', TICKET)).toBe(before);
}, 240_000);


// ---- ST-LN-96 rel-ac-1: the sync-time ruleset backfill ----

const CONFIG_REL = 'accord/config.yml';

/** Pin the sandbox's main to `v` (config and the running version both), in the clone and on the remote. */
function pinTo(c: Clone, v: string): void {
  running.v = v;
  writeFiles(c.root, { [CONFIG_REL]: pinned(v) });
  commitMsg(c.root, 'pin ' + v, undefined, true);
  c.git('push', '-q', 'origin', 'main');
}

/** A lane M ticket ST-9 created on its own branch by `new ticket --worktree` under the running version: its file is not on main. Returns its worktree. */
async function claimedOnBranch(c: Clone): Promise<string> {
  const made = await run(['new', 'ticket', ID, '--lane', 'M', '--worktree'], c.root);
  expect([made.code, made.err]).toEqual([0, '']);
  return c.sibling(ID);
}

const claimSha = (wt: string): string => gitRun(wt, 'log', '-1', '--format=%H', '--grep=^claim: ST-9$').trim();
const rulesetFindings = async (cwd: string): Promise<string[]> => {
  const r = await run(['gate', 'ready', ID, '--json'], cwd);
  return (JSON.parse(r.out).findings as { rule: string }[]).map((f) => f.rule).filter((f) => f.startsWith('gate.ruleset-'));
};
const subjects = (wt: string): string[] => gitRun(wt, 'log', '--format=%s').split('\n').filter((l) => l !== '');
const backfilledLines = (out: string): string[] => lines(out).filter((l) => l.startsWith('backfilled:'));

it('risk:complex-branching a branch-only ticket claimed under 0.4.1 gets ruleset at its first sync (ST-LN-96 rel-ac-1)', async () => {
  expect(RULESET_FROM).toBe('0.5.0');
  const c = copy({ tickets: [] });
  pinTo(c, '0.4.1');
  const wt = await claimedOnBranch(c);
  // the claim is the old kind: no ruleset, and the ticket file is on the branch only
  expect(gitRun(wt, 'show', 'HEAD:' + TICKET)).not.toContain('ruleset');
  expect(() => c.git('cat-file', '-e', 'origin/main:' + TICKET)).toThrow();
  const claim = claimSha(wt);
  const before = gitClaimFacts(wt, ID);
  expect(before).toMatchObject({ sha: claim, pin: '0.4.1' });
  pinTo(c, RULESET_FROM); // main moves on to a release that writes the field
  const r = await run(['worktree', 'open', ID, '--continue'], c.root);
  expect([r.code, r.err]).toEqual([0, '']);
  expect(lines(r.out).some((l) => l.startsWith('merged:'))).toBe(true);
  expect(backfilledLines(r.out)).toEqual([`backfilled: ${ID} ruleset 0.4.1`]);
  // one records-only commit: its subject is not a claim, its diff is one added line
  expect(subjects(wt)[0]).toBe(`ruleset: ${ID} from its claim commit`);
  expect(gitRun(wt, 'diff', '--numstat', 'HEAD~1', 'HEAD').trim()).toBe(`1\t0\t${TICKET}`);
  const added = gitRun(wt, 'diff', '-U0', 'HEAD~1', 'HEAD').split('\n').filter((l) => /^[+-][^+-]/.test(l));
  expect(added).toEqual(['+ruleset: "0.4.1"']);
  expect(subjects(wt).filter((l) => l === 'claim: ' + ID)).toHaveLength(1);
  // the claim fact still names the original claim commit, and the gates hold no ruleset finding
  expect(claimSha(wt)).toBe(claim);
  expect(gitClaimFacts(wt, ID)).toMatchObject({ sha: claim, pin: '0.4.1' });
  expect(await rulesetFindings(wt)).toEqual([]);
  expect(gitRun(c.remote, 'rev-parse', 'refs/heads/t/ST-9').trim()).toBe(gitRun(wt, 'rev-parse', 'HEAD').trim()); // pushed with the sync
  // a second sync writes nothing: the field is there
  pushMain(c, 'next.txt', 'next\n');
  const again = await run(['worktree', 'open', ID, '--continue'], c.root);
  expect([again.code, again.err]).toEqual([0, '']);
  expect(lines(again.out).some((l) => l.startsWith('merged:'))).toBe(true);
  expect(backfilledLines(again.out)).toEqual([]);
  expect(subjects(wt).filter((l) => l.startsWith('ruleset: '))).toHaveLength(1);
}, 240_000);

it('risk:regression no backfill below the cut-off or for a ticket claimed at it (ST-LN-96 rel-ac-1)', async () => {
  // the branch is still pinned below RULESET_FROM after the sync: nothing is written, the older schema would refuse the field
  const below = copy({ tickets: [] });
  pinTo(below, '0.4.1');
  const wtBelow = await claimedOnBranch(below);
  pushMain(below, 'next.txt', 'next\n');
  const b = await run(['worktree', 'open', ID, '--continue'], below.root);
  expect([b.code, b.err]).toEqual([0, '']);
  expect(lines(b.out).some((l) => l.startsWith('merged:'))).toBe(true);
  expect(backfilledLines(b.out)).toEqual([]);
  expect(subjects(wtBelow).some((l) => l.startsWith('ruleset: '))).toBe(false);
  expect(gitRun(wtBelow, 'show', 'HEAD:' + TICKET)).not.toContain('ruleset');

  // a ticket claimed at RULESET_FROM whose field was removed by hand is not backfilled: gate.ruleset-missing reports it
  const at = copy({ tickets: [] });
  pinTo(at, RULESET_FROM);
  const wtAt = await claimedOnBranch(at);
  expect(gitRun(wtAt, 'show', 'HEAD:' + TICKET)).toContain('ruleset: "0.5.0"');
  writeFileSync(wtAt + '/' + TICKET, readFileSync(wtAt + '/' + TICKET, 'utf8').replace(/ruleset: "0\.5\.0"\r?\n/, ''));
  commitMsg(wtAt, 'remove the ruleset by hand');
  pushMain(at, 'next.txt', 'next\n');
  const a = await run(['worktree', 'open', ID, '--continue'], at.root);
  expect([a.code, a.err]).toEqual([0, '']);
  expect(lines(a.out).some((l) => l.startsWith('merged:'))).toBe(true);
  expect(backfilledLines(a.out)).toEqual([]);
  expect(subjects(wtAt).some((l) => l.startsWith('ruleset: '))).toBe(false);
  expect(await rulesetFindings(wtAt)).toEqual(['gate.ruleset-missing']);
}, 240_000);
