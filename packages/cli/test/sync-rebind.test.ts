// ST-LN-96 t1-ac-4, D-16 Option E: when accord's own rebase (`accord worktree sync` under git.merge: rebase) leaves the ticket's files unchanged, it re-binds
// verified_commit and verification.md's commit: to the rebased HEAD in one records-only commit, so `gate done` passes in a fresh clone (CI) after the
// force-push. A rebase by hand, or by a git.sync script, is never re-bound. Real git, a bare remote, and a fresh clone of it as CI has.
import { mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it, vi } from 'vitest';
import { cleanup, gitRun, run } from './helpers/repo.js';
import { copy, type Clone, doneBranch, EXPORT, exportText, lines, pushMain, useSandboxes, VERIFICATION } from './helpers/worktree.js';
import { P } from '../../../test/helpers/lane.js';

vi.mock('../src/load/proc.js', async (orig) => {
  const real = await orig<typeof import('../src/load/proc.js')>();
  return { ...real, processTable: vi.fn(real.processTable) };
});
vi.mock('../src/commands/fetch-limit.js', async (orig) => {
  const real = await orig<typeof import('../src/commands/fetch-limit.js')>();
  return { ...real, fetchLimitMs: vi.fn(real.fetchLimitMs) };
});

useSandboxes([{}]);

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
  expect(gitRun(sib, 'rev-list', '--count', 'origin/main..HEAD').trim()).toBe('2');
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

