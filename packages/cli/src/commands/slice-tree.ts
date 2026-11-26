// Phase 15 D-07, D-31: `accord worktree slice <id> <n>`: the later slices of one ticket are built on stacked branches `slice/<id>/<n>` (n of 2 to the plan's slice count; slice 1 is the
// claim branch), each cut at the tip of the branch before it WITHOUT waiting for that slice's pull request to merge. The ticket's own worktree is switched to the new branch, and the
// branch is recorded in `<git common dir>/accord/slices` so the dashboard, `worktree clean` and `pr wait` find it. It runs in the ticket's own worktree, on the claim branch or on one of
// its slice branches; run again it prints the same lines and changes nothing. No rebase and no force-push ever touches a slice branch (D-08). Names reach git only from an id that passed
// `ID` and a number of 2 to 99, as literal argument arrays (T-15-31).
import { workOf } from '@accord-dev/accord-core';
import { currentBranch, UsageError } from '../load/fs.js';
import { recordSlice, sliceBranch, sliceNumber, sliceOfBranch } from '../load/slices.js';
import type { CommandContext } from '../run.js';
import { requireTicket } from './lane-args.js';
import { branchOf, git, gitOk, ID } from './worktree.js';

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
    throw new UsageError(
      /^[0-9]+$/.test(arg) && Number(arg) === 1
        ? `slice 1 is the claim branch of ${id}, built where it is: slices to open start at 2; nothing was created`
        : `not a slice number: ${arg} - a slice is 2 to 99 (slice 1 is the claim branch); nothing was created`,
    );
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
  const base = n === 2 ? claim : sliceBranch(id, n - 1);
  const branch = sliceBranch(id, n);
  if (here === branch) return recordedPrint(ctx, id, n, branch, base);
  if (!gitOk(ctx.root, ['rev-parse', '--verify', '-q', 'refs/heads/' + base])) {
    throw new UsageError(n === 2 ? `${claim} does not exist here; nothing was created` : `slice ${n - 1} of ${id} is not open yet (no branch ${base}): open it first with accord worktree slice ${id} ${n - 1}; nothing was created`);
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
