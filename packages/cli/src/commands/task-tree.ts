// ST-LN-92 D-03, D-16: `accord worktree task open|merge|clean <id> <n>`: each task of a wave in its own worktree `<main>-<id lower-cased>-t<n>` on branch
// `accord-task/<id>/<n>`, cut from the ticket branch's HEAD; brought into the ticket branch linearly (rebase in the task worktree, then a fast-forward of the
// ticket branch: the D-03 integration Ruling, so no merge commit enters the ticket history); removed only once the ticket branch holds its commits, never with a
// forced remove (`sensitive.data-deletion`). Every command runs in the ticket's own checkout, where task-done and the ledger live. Names reach git only from the
// loader's ticket key and the validated task number, as literal argument arrays.
import { existsSync } from 'node:fs';
import { claimPinBefore, matches, PLAN_WAVES_FROM } from '@accord-dev/accord-core';
import type { RepoSnapshot } from '@accord-dev/accord-core';
import { withClaimPins } from '../load/claim-facts.js';
import { currentBranch, UsageError } from '../load/fs.js';
import type { CommandContext } from '../run.js';
import { requireTicket, taskNumber } from './lane-args.js';
import { norm } from './leftover.js';
import { branchOf, git, gitOk, ID, prepare, setupMarker, siblingOf } from './worktree.js';

/** The task's worktree folder: the ticket's sibling folder name with `-t<n>`, which no ticket folder name ends in (Pitfall 12). */
export const taskPath = (mainPath: string, id: string, n: number): string => siblingOf(mainPath, id) + '-t' + n;

/** The task's branch: a prefix no `branch:` template produces, so the session guard never takes it for a ticket (Pitfall 11). */
export const taskBranch = (id: string, n: number): string => `accord-task/${id}/${n}`;

interface Listed {
  path: string;
  head: string;
  branch?: string;
  prunable: boolean;
}

/** `git worktree list --porcelain -z`, the main worktree first; a path may hold any character but NUL. */
function listed(root: string): Listed[] {
  const out: Listed[] = [];
  let cur: Listed | undefined;
  for (const field of git(root, ['worktree', 'list', '--porcelain', '-z']).split('\0')) {
    if (field === '') {
      if (cur !== undefined) out.push(cur);
      cur = undefined;
      continue;
    }
    if (field.startsWith('worktree ')) cur = { path: field.slice(9), head: '', prunable: false };
    else if (cur === undefined) continue;
    else if (field.startsWith('HEAD ')) cur.head = field.slice(5);
    else if (field.startsWith('branch refs/heads/')) cur.branch = field.slice(18);
    else if (field === 'prunable' || field.startsWith('prunable ')) cur.prunable = true;
  }
  if (cur !== undefined) out.push(cur);
  return out;
}

/** The live worktree at the task's folder, on its branch or detached (a rebase stopped there); undefined when there is none or its folder is gone. */
function findIn(list: Listed[], id: string, n: number): Listed | undefined {
  if (list.length === 0) return undefined;
  const want = norm(taskPath(list[0].path, id, n));
  const at = list.find((w) => norm(w.path) === want);
  return at === undefined || at.prunable || (at.branch !== undefined && at.branch !== taskBranch(id, n)) ? undefined : at;
}

/** The task's live worktree, read from `git worktree list`: its path (forward slashes) and HEAD. */
export function findTaskWorktree(root: string, id: string, n: number): { path: string; head: string } | undefined {
  const w = findIn(listed(root), id, n);
  return w === undefined ? undefined : { path: w.path.replace(/\\/g, '/'), head: w.head };
}

/** Every live task worktree of `id`, by task number, from one listing (`accord waves`). */
export function taskWorktrees(root: string, id: string): Map<number, string> {
  const list = listed(root);
  const found = new Map<number, string>();
  if (list.length === 0) return found;
  const prefix = norm(siblingOf(list[0].path, id) + '-t');
  for (const w of list) {
    const rest = norm(w.path).startsWith(prefix) ? norm(w.path).slice(prefix.length) : '';
    if (!/^[1-9][0-9]*$/.test(rest)) continue;
    const n = Number(rest);
    if (findIn(list, id, n) === w) found.set(n, w.path.replace(/\\/g, '/'));
  }
  return found;
}

/**
 * The folder an executor of task `n` works in, which `accord brief` names and under which its report lies: the task worktree while it exists, else `root`.
 * Undefined for a ticket claimed before 0.6.0, which is built one task at a time as before and whose brief names no Work dir (D-16 cut-off Ruling).
 * `claimed` is the snapshot with the claim read (`withClaimPins`), so brief and task-done decide on the read they already made; a failed read gives the folder.
 */
export function workRootOf(root: string, claimed: RepoSnapshot, id: string, n: number): string | undefined {
  if (claimPinBefore(claimed, id, PLAN_WAVES_FROM)) return undefined;
  return findTaskWorktree(root, id, n)?.path ?? root.replace(/\\/g, '/');
}

/** The checks every task command makes: the id and task number, and that it runs in the ticket's own checkout (exit 2 naming the one to run it in). */
function inTicketCheckout(ctx: CommandContext, id: string, task: string, verb: 'open' | 'merge' | 'clean'): { n: number; ticketBranch: string; list: Listed[] } {
  const n = taskNumber(task);
  if (!ID.test(id)) throw new UsageError('not a valid ticket id: ' + id);
  requireTicket(ctx.snapshot, id);
  const ticketBranch = branchOf(ctx.snapshot, id);
  const list = listed(ctx.root);
  if (currentBranch(ctx.root) !== ticketBranch) {
    const holder = list.find((w) => w.branch === ticketBranch && !w.prunable);
    throw new UsageError(
      holder === undefined
        ? `accord worktree task ${verb} runs in ${id}'s own checkout, on ${ticketBranch}, and no worktree holds that branch - open it with accord worktree open ${id}; nothing was changed`
        : `accord worktree task ${verb} runs in ${id}'s own checkout: run it in ${holder.path.replace(/\\/g, '/')}; nothing was changed`,
    );
  }
  return { n, ticketBranch, list };
}

/** Tracked files changed in `dir` (untracked files are git's own concern: a rebase and a removal refuse to lose them). */
const dirty = (dir: string): boolean => git(dir, ['status', '--porcelain', '--untracked-files=no']).trim() !== '';

/** True while a rebase stopped in `dir` waits to be continued. */
function rebasing(dir: string): boolean {
  for (const name of ['rebase-merge', 'rebase-apply']) {
    if (existsSync(git(dir, ['rev-parse', '--path-format=absolute', '--git-path', name]).trim())) return true;
  }
  return false;
}

/** The paths a stopped rebase left unmerged in `dir`, NUL-separated so any path reads back whole. */
const unmerged = (dir: string): string[] => git(dir, ['diff', '--name-only', '--diff-filter=U', '-z']).split('\0').filter((p) => p !== '');

/**
 * D-06: `conflict: task <n> in <folder>`, then each path as `generated:` when an entry of the config's `generated:` list matches it, else `hand-written:`; exit 1.
 * The CLI runs no regenerate command (CONTEXT Ruling 2026-11-16): the build skill runs build.regenerate, or a fresh executor resolves, then merge runs again.
 */
function conflict(ctx: CommandContext, n: number, path: string, paths: string[]): number {
  const generated = ctx.snapshot.config?.generated ?? [];
  const lines = paths.map((p) => (generated.some((e) => matches(e, p)) ? 'generated: ' : 'hand-written: ') + p);
  ctx.stdout.write(`conflict: task ${n} in ${path}\n` + lines.map((l) => l + '\n').join(''));
  return 1;
}

function printOpen(ctx: CommandContext, path: string, branch: string): number {
  ctx.stdout.write(`path: ${path.replace(/\\/g, '/')}\nbranch: ${branch}\n`);
  return 0;
}

/** `accord worktree task open <id> <n>`: the task's worktree from the ticket branch's HEAD, set up with the repository's `setup` list (`dist` per worktree, obstacle 3). */
export function taskOpen(ctx: CommandContext, id: string, task: string): number {
  const { n, list } = inTicketCheckout(ctx, id, task, 'open');
  // D-16: before any git write. A failed claim read is false here, so the task worktree is opened (fail closed).
  if (claimPinBefore(withClaimPins(ctx.root, ctx.snapshot, id), id, PLAN_WAVES_FROM)) {
    throw new UsageError(`${id} was claimed before 0.6.0, so it is built one task at a time in its own worktree, as before: run accord brief ${id} ${n} there; nothing was created`);
  }
  const path = taskPath(list[0].path, id, n);
  const branch = taskBranch(id, n);
  const at = list.find((w) => norm(w.path) === norm(path));
  if (at !== undefined) {
    if (at.branch === branch && !at.prunable) {
      if (!existsSync(setupMarker(at.path))) prepare(at.path);
      return printOpen(ctx, at.path, branch);
    }
    throw new UsageError(
      at.prunable
        ? `git still registers a worktree at ${path}, whose folder is missing - put that folder back, then try again; nothing was created`
        : `${path} is already a worktree of ${at.branch ?? 'a detached HEAD'}, not of ${branch} - move it away, then try again; nothing was created`,
    );
  }
  const holder = list.find((w) => w.branch === branch);
  if (holder !== undefined) throw new UsageError(`${branch} is checked out in ${holder.path.replace(/\\/g, '/')}, not in ${path} - nothing was created`);
  if (existsSync(path)) throw new UsageError(`${path} already exists and is not a worktree of ${branch} - move it away, then try again; nothing was created`);
  if (gitOk(ctx.root, ['rev-parse', '--verify', '-q', 'refs/heads/' + branch])) {
    throw new UsageError(`the branch ${branch} already exists with no worktree - keep its commits (git branch -m), then try again; nothing was created`);
  }
  git(ctx.root, ['worktree', 'add', '-q', '-b', branch, path, 'HEAD']);
  prepare(path);
  return printOpen(ctx, path, branch);
}

/**
 * `accord worktree task merge <id> <n>`: rebase the task branch onto the ticket branch in the task worktree, then fast-forward the ticket branch to it. No order is
 * enforced between the tasks of a wave (the permission-fallback Ruling): a task stopped after committing is merged after the ones recorded.
 */
export function taskMerge(ctx: CommandContext, id: string, task: string): number {
  const { n, ticketBranch, list } = inTicketCheckout(ctx, id, task, 'merge');
  const w = findIn(list, id, n);
  if (w === undefined) throw new UsageError(`task ${n} of ${id} has no worktree - open it with accord worktree task open ${id} ${n}; nothing was merged`);
  const path = w.path.replace(/\\/g, '/');
  if (dirty(ctx.root)) throw new UsageError(`${ctx.root.replace(/\\/g, '/')} has uncommitted changes to tracked files - commit them first; nothing was merged`);
  const stopped = rebasing(path);
  if (!stopped && dirty(path)) throw new UsageError(`task ${n}'s worktree ${path} has uncommitted changes to tracked files - commit them there first; nothing was merged`);
  const open = stopped ? unmerged(path) : [];
  if (open.length > 0) return conflict(ctx, n, path, open);
  /** Runs one rebase step in the task worktree: undefined when it finished, the exit code of the conflict lines when it stopped. */
  const step = (args: string[]): number | undefined => {
    try {
      git(path, args);
      return undefined;
    } catch (err) {
      // D-06: a conflict leaves the rebase stopped where it stands, for the build skill to regenerate or resolve; any other failure is git's own message
      const paths = rebasing(path) ? unmerged(path) : [];
      if (paths.length === 0) throw err;
      return conflict(ctx, n, path, paths);
    }
  };
  // a stopped rebase whose paths are resolved and added continues; core.editor=true keeps each message as it is, with no editor (RESEARCH A4)
  let code = step(stopped ? ['-c', 'core.editor=true', 'rebase', '--continue'] : ['rebase', ticketBranch]);
  if (code !== undefined) return code;
  // the ticket branch moved on while the rebase waited (another task merged): rebase onto its tip again, so the fast-forward below can be made
  if (stopped && !gitOk(ctx.root, ['merge-base', '--is-ancestor', 'HEAD', taskBranch(id, n)])) {
    code = step(['rebase', ticketBranch]);
    if (code !== undefined) return code;
  }
  git(ctx.root, ['merge', '--ff-only', '-q', taskBranch(id, n)]);
  ctx.stdout.write(`merged: task ${n} at ${git(ctx.root, ['rev-parse', 'HEAD']).trim().slice(0, 12)}\n`);
  return 0;
}

/**
 * `accord worktree task clean <id> <n>`: remove the task worktree (`git worktree remove`, never forced, so git refuses a folder with uncommitted work) and delete its
 * branch at the tip checked here, only when the ticket branch holds that tip; otherwise exit 1 and nothing is removed (data loss).
 */
export function taskClean(ctx: CommandContext, id: string, task: string): number {
  const { n, list } = inTicketCheckout(ctx, id, task, 'clean');
  const w = findIn(list, id, n);
  const branch = taskBranch(id, n);
  let tip: string | undefined;
  try {
    tip = git(ctx.root, ['rev-parse', '--verify', '-q', 'refs/heads/' + branch]).trim();
  } catch {
    tip = undefined;
  }
  if (w === undefined && tip === undefined) {
    ctx.stdout.write(`removed: nothing for task ${n}\n`);
    return 0;
  }
  const refuse = (why: string): number => {
    ctx.stdout.write(`kept task ${n} of ${id}: ${why}\n`);
    return 1;
  };
  if (w !== undefined && rebasing(w.path)) return refuse(`a rebase is stopped in ${w.path.replace(/\\/g, '/')}: finish it with accord worktree task merge ${id} ${n} first`);
  for (const sha of [tip, w?.head]) {
    if (sha === undefined || sha === '') continue;
    if (!gitOk(ctx.root, ['merge-base', '--is-ancestor', sha, 'HEAD'])) return refuse(`task ${n}'s branch holds commits the ticket branch lacks: run accord worktree task merge ${id} ${n} first`);
  }
  if (w !== undefined) git(ctx.root, ['worktree', 'remove', w.path]);
  if (tip !== undefined) git(ctx.root, ['update-ref', '-d', 'refs/heads/' + branch, tip]);
  ctx.stdout.write(`removed: ${(w?.path ?? taskPath(list[0].path, id, n)).replace(/\\/g, '/')}\n`);
  return 0;
}
