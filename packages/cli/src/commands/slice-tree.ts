// Phase 15 D-07, D-31, Phase 08.9.3 D-10, D-11, D-14: `accord worktree slice <id> <n>` opens slice n of a sliced ticket where core's `sliceHome` says it lives. The first slice of THIS repository is the claim branch
// (the checkout is switched back to it, nothing is cut, whatever its number); a later slice of this repository is `slice/<id>/<n>`, cut at the tip of the previous slice of this repository WITHOUT waiting for that
// slice's pull request to merge, and the ticket's own worktree is switched to it; a slice of ANOTHER repository opens in a linked worktree of that repository's clone (`repoSliceOpen`). Every branch it cuts is recorded in
// `<git common dir>/accord/slices`, so the dashboard, `worktree clean` and `pr wait` find it. It runs in the ticket's own worktree, on the claim branch or on one of its slice branches; run again it prints the same
// lines and changes nothing. No rebase and no force-push ever touches a slice branch (D-08). Names reach git only from an id that passed `ID` and a number of 1 to 99, as literal argument arrays (T-15-31).
import { existsSync } from 'node:fs';
import { isSha, workOf } from '@accord-dev/accord-core';
import type { SliceHome } from '@accord-dev/accord-core';
import { currentBranch, defaultRefOf, UsageError } from '../load/fs.js';
import { resolveRepo, toPosix } from '../load/repos.js';
import { sliceHomeOf } from '../load/slice-size.js';
import { recordSlice, sliceNumber, sliceOfBranch } from '../load/slices.js';
import type { CommandContext } from '../run.js';
import { requireTicket } from './lane-args.js';
import { norm } from './leftover.js';
import { branchOf, git, gitNoPrompt, gitOk, ID, listWorktrees, recordWorktree, readRecorded, siblingOf } from './worktree.js';

/** Tracked files changed in `dir` (untracked files are git's own concern: a switch refuses to lose them). */
const dirty = (dir: string): boolean => git(dir, ['status', '--porcelain', '--untracked-files=no']).trim() !== '';

const print = (ctx: CommandContext, branch: string, base: string): number => {
  ctx.stdout.write(`branch: ${branch}\nbase: ${base}\n`);
  return 0;
};

/** `accord worktree slice <id> <n>`: see the file's first lines. Every refusal is exit 2 with nothing created. */
export function sliceOpen(ctx: CommandContext, id: string, arg: string): number {
  if (!ID.test(id)) throw new UsageError('not a valid ticket id: ' + id);
  const n = sliceNumber(arg);
  if (n === undefined) {
    throw new UsageError(`not a slice number: ${arg} - a slice is 1 to 99 (the first slice of this repository is the claim branch, the others are cut by this command); nothing was created`);
  }
  requireTicket(ctx.snapshot, id);
  const slices = workOf(ctx.snapshot, id)?.plan?.slices;
  if (slices === undefined || slices.length === 0) throw new UsageError(`${id}'s plan.md has no ## Slice section, so it has no slice ${n}; nothing was created`);
  if (n > slices.length) throw new UsageError(`${id}'s plan.md has ${slices.length} slice${slices.length === 1 ? '' : 's'}, so there is no slice ${n}; nothing was created`);
  const claim = branchOf(ctx.snapshot, id);
  const here = currentBranch(ctx.root);
  if (here !== claim && sliceOfBranch(here ?? '')?.id !== id) {
    throw new UsageError(`accord worktree slice runs in ${id}'s own checkout, on ${claim} or one of its slice branches, and this one is on ${here ? here : 'a detached HEAD'}; nothing was created`);
  }
  const home = sliceHomeOf(ctx.snapshot, id, n, claim);
  if (home === undefined) throw new UsageError(`${id}'s plan.md has no slice ${n} that could name a branch; nothing was created`);
  // D-10: a slice of another repository opens in that repository's clone, never in this checkout
  if (home.repo !== undefined) return repoSliceOpen(ctx, id, { ...home, repo: home.repo });
  // D-14: the first slice of this repository is the claim branch, whatever its number (review C-WR-06: slices.md sends the agent back to it to change an earlier slice); nothing is cut or recorded
  if (home.claim || home.previous === undefined) return claimOpen(ctx, id, claim, here);
  const base = home.previous.branch;
  const branch = home.branch;
  if (here === branch) return recordedPrint(ctx, id, n, branch, base);
  if (!gitOk(ctx.root, ['rev-parse', '--verify', '-q', 'refs/heads/' + base])) {
    throw new UsageError(base === claim ? `${claim} does not exist here; nothing was created` : `slice ${home.previous.n} of ${id} is not open yet (no branch ${base}): open it first with accord worktree slice ${id} ${home.previous.n}; nothing was created`);
  }
  if (dirty(ctx.root)) throw new UsageError(`${ctx.root.replace(/\\/g, '/')} has uncommitted changes to tracked files - commit them first; nothing was created`);
  const exists = gitOk(ctx.root, ['rev-parse', '--verify', '-q', 'refs/heads/' + branch]);
  if (!exists) {
    if (!gitOk(ctx.root, ['check-ref-format', '--branch', branch])) throw new UsageError(`${branch} is not a valid branch name (git check-ref-format); nothing was created`);
    git(ctx.root, ['branch', branch, 'refs/heads/' + base]);
  }
  git(ctx.root, ['switch', '-q', branch]);
  return recordedPrint(ctx, id, n, branch, base);
}

/** The first slice of this repository: switch the ticket's checkout to its claim branch (a refusal on a dirty tree or a missing branch changes nothing); on it already, print the same two lines. The base is the default branch. */
function claimOpen(ctx: CommandContext, id: string, claim: string, here: string | undefined): number {
  const def = defaultRefOf(ctx.root)?.replace(/^refs\/(?:remotes\/origin|heads)\//, '');
  const base = def ?? 'the default branch';
  if (here === claim) return print(ctx, claim, base);
  if (!gitOk(ctx.root, ['rev-parse', '--verify', '-q', 'refs/heads/' + claim])) throw new UsageError(`${claim} does not exist here; nothing was changed`);
  if (dirty(ctx.root)) throw new UsageError(`${ctx.root.replaceAll('\\', '/')} has uncommitted changes to tracked files - commit them first; nothing was changed`);
  git(ctx.root, ['switch', '-q', claim]);
  return print(ctx, claim, base);
}

/** Record the branch (a line already there is kept as it is) and print the two lines; a failed record is named and the command goes on, since every reader also finds the branch by its name. */
function recordedPrint(ctx: CommandContext, id: string, n: number, branch: string, base: string): number {
  try {
    const start = git(ctx.root, ['merge-base', 'refs/heads/' + base, 'refs/heads/' + branch]).trim();
    recordSlice(ctx.root, id, n, start);
  } catch (e) {
    ctx.stdout.write(`note ${id}: ${branch} was not recorded: ${e instanceof Error ? e.message.split('\n')[0] : String(e)}\n`);
  }
  return print(ctx, branch, base);
}

const NOTHING = '; nothing was created';

/**
 * Ruling R13: where a copy of `branch` already is on the clone's origin. The clone's own remote-tracking ref when it has one; otherwise origin is asked (prompt-free) and the one branch is fetched into its
 * remote-tracking ref, which touches no local branch, no HEAD, no index and no working tree. `ref` is set when a copy exists, `note` when origin could not be asked (the caller then cuts the branch and says so).
 */
function originCopy(ctx: CommandContext, clone: string, branch: string): { ref?: string; note?: string } {
  const ref = `refs/remotes/origin/${branch}`;
  if (gitOk(clone, ['rev-parse', '--verify', '-q', ref])) return { ref };
  try {
    gitNoPrompt(clone, ['ls-remote', '--exit-code', '--heads', 'origin', `refs/heads/${branch}`], 30_000, ctx.ssh);
    // WR-05: as `accord repos baseline` fetches, nothing but the one remote-tracking ref changes in the person's clone (no tag followed, no submodule fetched whatever the clone's own settings say)
    gitNoPrompt(clone, ['fetch', '-q', '--no-tags', '--no-recurse-submodules', 'origin', `+refs/heads/${branch}:${ref}`], 60_000, ctx.ssh);
    return gitOk(clone, ['rev-parse', '--verify', '-q', ref]) ? { ref } : {};
  } catch (e) {
    if ((e as { status?: number }).status === 2) return {}; // ls-remote --exit-code: origin has no such branch
    const why = String((e as { stderr?: string }).stderr ?? e).trim().split('\n')[0];
    return { note: `origin of the clone could not be asked (${why}), so ${branch} was cut here and a copy on origin, if any, was not looked for` };
  }
}

/**
 * Phase 08.9.3 D-10, D-11, D-14: open a slice of another repository. The clone is the one `resolveRepo` verified by its origin; the worktree is `<clone folder>-<id lower case>` beside it (Ruling R12: no `setup:`
 * of this repository runs there), created with `git worktree add -b slice/<id>/<n> <folder> <start>` run in the clone, so the person's own checkout of it is never switched or touched. The first slice there is cut at
 * the plan's `baseline_<repo>`; a later one at the tip of the previous slice of that repository and the same worktree is switched to it (refused when it has uncommitted tracked changes). A branch that exists only on
 * the clone's origin is checked out, never cut again (Ruling R13). The worktree and the slice are recorded in this repository's git folder. No file of the other repository's `accord/` folder is read (D-03).
 */
function repoSliceOpen(ctx: CommandContext, id: string, home: SliceHome & { repo: string }): number {
  const { repo, branch } = home;
  const resolved = resolveRepo(ctx.root, ctx.snapshot.config, repo);
  if ('refused' in resolved) throw new UsageError(resolved.refused + NOTHING);
  const clone = resolved.path;
  if (!gitOk(clone, ['check-ref-format', '--branch', branch])) throw new UsageError(`${branch} is not a valid branch name (git check-ref-format)${NOTHING}`);
  // where the branch is cut, what is printed as its base, and where the slice starts
  let from: string;
  let base: string;
  let start: string | undefined;
  if (home.previous === undefined) {
    const baselines = workOf(ctx.snapshot, id)?.plan?.repoBaselines;
    const named = baselines !== undefined && Object.hasOwn(baselines, repo) ? baselines[repo] : undefined;
    if (named === undefined || !isSha(named) || !gitOk(clone, ['cat-file', '-e', `${named}^{commit}`])) {
      throw new UsageError(`${id}'s plan.md has no baseline_${repo} that is a commit of the ${repo} clone at ${clone}${named === undefined ? '' : ' (' + named + ')'}; fetch there or re-plan${NOTHING}`);
    }
    start = git(clone, ['rev-parse', '--verify', '--end-of-options', `${named}^{commit}`]).trim();
    from = start;
    base = start.slice(0, 12);
  } else {
    base = home.previous.branch;
    from = 'refs/heads/' + base;
    if (!gitOk(clone, ['rev-parse', '--verify', '-q', from])) {
      throw new UsageError(`slice ${home.previous.n} of ${id} is not open yet in ${repo} (no branch ${base}): open it first with accord worktree slice ${id} ${home.previous.n}${NOTHING}`);
    }
  }
  const list = listWorktrees(clone);
  const recorded = readRecorded(ctx.root).find((e) => e.id === id && e.repo === repo);
  const folder = toPosix(recorded !== undefined && list.some((w) => norm(w.path) === norm(recorded.path)) ? recorded.path : siblingOf(clone, id));
  const entry = list.find((w) => norm(w.path) === norm(folder));
  const local = gitOk(clone, ['rev-parse', '--verify', '-q', 'refs/heads/' + branch]);
  const holder = list.find((w) => w.branch === branch);
  let note: string | undefined;
  if (entry !== undefined) {
    if (entry.prunable !== undefined) throw new UsageError(`git still registers a worktree of ${repo} at ${folder}, whose folder is missing - put that folder back, then try again${NOTHING}`);
    if (entry.branch !== branch) {
      // a later slice of this repository: the same worktree, switched
      if (entry.branch === undefined || sliceOfBranch(entry.branch)?.id !== id) {
        throw new UsageError(`${folder} is a worktree of the ${repo} clone on ${entry.branch ?? 'a detached HEAD'}, not on a slice branch of ${id} - move it away or switch it, then try again${NOTHING}`);
      }
      if (holder !== undefined) throw new UsageError(`${branch} is checked out in ${toPosix(holder.path)}, not in ${folder}${NOTHING}`);
      if (dirty(folder)) throw new UsageError(`${folder} has uncommitted changes to tracked files - commit them first${NOTHING}`);
      if (!local) {
        const copy = originCopy(ctx, clone, branch);
        note = copy.note;
        git(folder, copy.ref === undefined ? ['branch', branch, from] : ['branch', '--track', branch, copy.ref]);
      }
      git(folder, ['switch', '-q', branch]);
    }
  } else {
    if (existsSync(folder)) throw new UsageError(`${folder} already exists and is not a worktree of the ${repo} clone - move it away, then try again${NOTHING}`);
    if (holder !== undefined) throw new UsageError(`${branch} is checked out in ${toPosix(holder.path)}, not in ${folder}${NOTHING}`);
    if (local) {
      git(clone, ['worktree', 'add', '-q', folder, branch]);
    } else {
      const copy = originCopy(ctx, clone, branch);
      note = copy.note;
      git(clone, ['worktree', 'add', '-q', '-b', branch, folder, copy.ref ?? from]);
    }
  }
  try {
    start ??= git(clone, ['merge-base', from, 'refs/heads/' + branch]).trim();
    recordWorktree(ctx.root, id, folder, repo);
    recordSlice(ctx.root, id, home.n, start, repo);
  } catch (e) {
    ctx.stdout.write(`note ${id}: ${branch} of ${repo} was not recorded: ${e instanceof Error ? e.message.split('\n')[0] : String(e)}\n`);
  }
  if (note !== undefined) ctx.stdout.write(`note ${id}: ${note}\n`);
  ctx.stdout.write(`branch: ${branch}\nbase: ${base}\nrepository: ${repo}\nworktree: ${folder}\n`);
  return 0;
}
