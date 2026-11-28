// Phase 10 D-06, D-15: sandboxes for the review budget tests. A lane M ticket T-1 on its claim branch `t/T-1` with a `claim: T-1` commit that pins a chosen release, one code commit per
// review round (the head that round names), and a version 2 review.md written from the rounds. Every round's finding sits in `src/a.ts`, which each code commit changes, so no finding is
// outside the fix diff (ST-LN-56 D-10); every round carries `Security: no pattern matched`, as a round whose package has no trigger does.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { commitMsg, gitRun, makeEmptyRepo, writeFiles } from './repo.js';
import { CONFIG, PLAN, laneTicket, pinned } from '../../../../test/helpers/lane.js';

export const REVIEW = 'accord/tickets/T-1/review.md';

/** One round of the record: its finding lines (none: `No findings`), and whether it is headed `(final review)`. */
export interface Round { lines: string[]; final?: true }

/** `Should <n> [patch]: ... — src/a.ts:1 — <state>`; the finding lines of a round are `should(1)`, `should(2)`, ... */
export const should = (n: number, state = 'open', ...marks: string[]): string => `Should ${n} [patch]: a comma is not quoted — src/a.ts:1 — ${state} — rests on: ac-1${marks.map((m) => ' — ' + m).join('')}`;
export const must = (n: number, state = 'open', ...marks: string[]): string => `Must ${n} [patch]: the export overwrites the old file — src/a.ts:1 — ${state} — rests on: ac-1${marks.map((m) => ' — ' + m).join('')}`;
/** `k` open Should lines (none for 0: the round reports no findings). */
export const shoulds = (k: number, state = 'open'): string[] => Array.from({ length: k }, (_, i) => should(i + 1, state));

/** A ticket claimed under `claimPin`: the base commit on main, the claim commit on `t/T-1`, then the working pin back to the running release. `extra` files join the base commit. */
export function claimedRepo(claimPin: string, extra: Record<string, string> = {}, slices = ''): string {
  const repo = makeEmptyRepo();
  gitRun(repo, 'config', 'user.email', 'fixture@example.invalid');
  gitRun(repo, 'config', 'user.name', 'fixture');
  gitRun(repo, 'config', 'commit.gpgsign', 'false');
  writeFiles(repo, { 'accord/config.yml': pinned(claimPin), 'accord/tickets/T-1.md': laneTicket('T-1'), 'src/a.ts': 'export const a = 0;\n', ...extra });
  commitMsg(repo, 'base');
  gitRun(repo, 'branch', '-M', 'main');
  gitRun(repo, 'switch', '-q', '-c', 't/T-1');
  commitMsg(repo, 'claim: T-1', undefined, true);
  writeFiles(repo, { 'accord/config.yml': CONFIG });
  // the pin back to the running release in a commit of its own, then the plan whose baseline it is: the first round's package starts there
  const base = commitMsg(repo, 'pin', undefined, true);
  writeFiles(repo, { 'accord/tickets/T-1/plan.md': PLAN.replace('abc1234', base) + slices });
  commitMsg(repo, 'plan');
  return repo;
}

/** A code commit that changes `src/a.ts`; its sha is the head the next round names. `tag` tells the commits apart. */
export function codeCommit(repo: string, tag: string): string {
  writeFiles(repo, { 'src/a.ts': `export const a = ${JSON.stringify(tag)};\n` });
  return commitMsg(repo, `code ${tag}`);
}

/** The text of a version 2 review.md: `rounds` with their heads, each closed by the security line. `tail` follows the last round (a verdict, say). */
export function reviewText(rounds: (Round & { head: string })[], tail = ''): string {
  const out = ['Round record: 2', ''];
  rounds.forEach((r, i) => {
    out.push(`## Round ${i + 1} head ${r.head}${r.final === true ? ' (final review)' : ''}`, '', ...(r.lines.length === 0 ? ['No findings'] : r.lines), '', 'Security: no pattern matched', '');
  });
  return out.join('\n') + tail;
}

/**
 * The executor fix report of the checkout, which `accord round` holds a fix against (Phase 8.5 D-19): one `places checked: <p>.<n>: src/a.ts:1` line for each finding of `fixed` (`<round>.<n>`).
 * A finding written `fixed in <sha> — checked: src/a.ts:1` is covered by it.
 */
export function fixReport(repo: string, fixed: string[]): void {
  const folder = join(repo, '.accord-reports', 'T-1');
  mkdirSync(folder, { recursive: true });
  writeFileSync(join(folder, 'fix-1.md'), fixed.map((f) => `places checked: ${f}: src/a.ts:1\n`).join(''));
}

/**
 * A claimed ticket with one code commit per round and its review.md committed after them. `rounds[i].head` is filled with the commit of code commit i; a round whose `lines` hold the text
 * `<head>` has it replaced by that commit's sha (for `fixed in <sha>`).
 */
export function reviewed(claimPin: string, rounds: Round[], o: { tail?: string; extra?: Record<string, string> } = {}): string {
  const repo = claimedRepo(claimPin, o.extra);
  const heads = rounds.map((_, i) => codeCommit(repo, `round ${i + 1}`));
  const filled = rounds.map((r, i) => ({ ...r, head: heads[i], lines: r.lines.map((l) => l.replaceAll('<head>', heads[i])) }));
  writeFiles(repo, { [REVIEW]: reviewText(filled, o.tail) });
  commitMsg(repo, 'T-1 review');
  return repo;
}

/** The plan's two slices: slice 1 on the claim branch, slice 2 on `slice/T-1/2`, cut at the tip of slice 1. */
export const SLICES = ['## Slice 1: Writer', 'tasks: 1', 'covers: @ac-1', '', '## Slice 2: Escaping', 'tasks: 2', 'covers: @ac-2', ''].join('\n');

/**
 * A ticket of two slices with a review.md that spans both: the rounds of slice 1 are recorded on the claim branch `t/T-1` (one code commit each), then `slice/T-1/2` is cut from its tip and the rounds of slice 2 follow,
 * numbered on from slice 1's, each with a code commit of its own. The checkout is left on `slice/T-1/2`.
 */
export function slicedReviewed(claimPin: string, first: Round[], second: Round[], o: { tail?: string } = {}): string {
  const repo = claimedRepo(claimPin, {}, SLICES);
  const fill = (rounds: Round[], heads: string[]) => rounds.map((r, i) => ({ ...r, head: heads[i], lines: r.lines.map((l) => l.replaceAll('<head>', heads[i])) }));
  const one = first.map((_, i) => codeCommit(repo, `round ${i + 1}`));
  writeFiles(repo, { [REVIEW]: reviewText(fill(first, one)) });
  commitMsg(repo, 'T-1 review of slice 1');
  gitRun(repo, 'switch', '-q', '-c', 'slice/T-1/2');
  const two = second.map((_, i) => codeCommit(repo, `round ${first.length + i + 1}`));
  writeFiles(repo, { [REVIEW]: reviewText([...fill(first, one), ...fill(second, two)], o.tail) });
  commitMsg(repo, 'T-1 review of slice 2');
  return repo;
}
