// ST-LN-92 D-03, D-16: `accord worktree task open|merge|clean <id> <n>`: each task of a wave in its own worktree `<main>-<id lower-cased>+t<n>` on branch
// `accord-task/<id>/<n>`, cut from the ticket branch's HEAD; brought into the ticket branch linearly (rebase in the task worktree, then a fast-forward of the
// ticket branch: the D-03 integration Ruling, so no merge commit enters the ticket history); removed only once the ticket branch holds its commits, never with a
// forced remove (`sensitive.data-deletion`). Every command runs in the ticket's own checkout, where task-done and the ledger live. Names reach git only from the
// loader's ticket key and the validated task number, as literal argument arrays.
import { existsSync } from 'node:fs';
import { claimPinBefore, matches, PLAN_WAVES_FROM } from '@accord-dev/accord-core';
import type { RepoSnapshot } from '@accord-dev/accord-core';
import { withClaimPins } from '../load/claim-facts.js';
import { currentBranch, UsageError } from '../load/fs.js';
import { scriptDigest, scriptRefusal } from '../load/script-trust.js';
import type { CommandContext } from '../run.js';
import { requireTicket, taskNumber } from './lane-args.js';
import { norm } from './leftover.js';
import { branchOf, git, gitOk, ID, listWorktrees, prepare, rebaseBranch, setupMarker, siblingOf, worktrees } from './worktree.js';
import type { PrunableEntry } from './worktree.js';

/**
 * The task's worktree folder: the ticket's sibling folder name with `+t<n>`. Review round 2 finding 3: `+` is outside the ticket id characters, so no ticket's own
 * folder (`<main>-<id>`) ever has this name; ticket `<id>-T<n>`'s folder is `<main>-<id>-t<n>`. A folder is still taken for the task's only by its branch (`atTask`).
 */
export const taskPath = (mainPath: string, id: string, n: number): string => siblingOf(mainPath, id) + '+t' + n;

/** The task's branch: a prefix no `branch:` template produces, so the session guard never takes it for a ticket (Pitfall 11). */
export const taskBranch = (id: string, n: number): string => `accord-task/${id}/${n}`;

const slash = (p: string): string => p.replace(/\\/g, '/');

/** The last non-blank line of an error, the one git's own reason is on. */
const reasonOf = (e: unknown): string =>
  String(e instanceof Error ? e.message : e)
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l !== '')
    .pop() ?? 'unknown error';

/**
 * The live worktree at task n's folder: the task's own (`other` undefined), or in another state, with `other` naming it for merge and clean to refuse on and `state`
 * the short form `accord waves` prints (`<branch>`, `detached <sha12>`, `unreadable: <reason>`).
 */
interface AtTask {
  w: PrunableEntry;
  other?: string;
  state?: string;
}

/**
 * Review round 1 findings 2, 4 and 9: the worktree at task n's folder is the task's only on `accord-task/<id>/<n>`, or detached while a rebase OF that branch is stopped
 * there (`rebaseBranch`, the one reader of a stopped rebase). Any other state (another branch the executor switched to, a ticket branch, a detached HEAD whose commits may
 * be on no branch) comes back with `other`. Round 2 finding 9: a folder git cannot read is such a state too, never a crash. Undefined when no live worktree is there. The
 * list is `listWorktrees` (no `-z`, which needs git 2.36: round 1 findings 1 and 10).
 */
function atTask(list: PrunableEntry[], id: string, n: number): AtTask | undefined {
  if (list.length === 0) return undefined;
  const want = norm(taskPath(list[0].path, id, n));
  const w = list.find((x) => norm(x.path) === want);
  if (w === undefined || w.prunable !== undefined) return undefined;
  const branch = taskBranch(id, n);
  if (w.branch === branch) return { w };
  if (w.branch !== undefined) return { w, state: w.branch, other: `${slash(w.path)} is a worktree of ${w.branch}, not of ${branch}` };
  let of: string | undefined;
  try {
    of = rebaseBranch(w.path);
  } catch (e) {
    const why = reasonOf(e);
    return { w, state: 'unreadable: ' + why, other: `${slash(w.path)} cannot be read by git (${why}), so it is not taken for ${branch}` };
  }
  if (of === branch) return { w };
  const stopped = of === undefined ? '' : ` (a rebase of ${of} is stopped there)`;
  return { w, state: 'detached ' + w.head.slice(0, 12), other: `${slash(w.path)} holds a detached HEAD${stopped}, not ${branch}: its commits may be on no branch` };
}


/**
 * Every live worktree at a task folder of `id`, by task number, from one listing (`accord waves`): its path, and `state` when it is not the task's own (round 2 finding 2:
 * a folder holding work off its task branch is named, never dropped).
 */
export function taskWorktrees(root: string, id: string): Map<number, { path: string; state?: string }> {
  const list = listWorktrees(root);
  const found = new Map<number, { path: string; state?: string }>();
  if (list.length === 0) return found;
  const prefix = norm(siblingOf(list[0].path, id) + '+t');
  for (const w of list) {
    const rest = norm(w.path).startsWith(prefix) ? norm(w.path).slice(prefix.length) : '';
    if (!/^[1-9][0-9]*$/.test(rest)) continue;
    const n = Number(rest);
    const at = atTask(list, id, n);
    if (at !== undefined && at.w === w) found.set(n, { path: slash(w.path), ...(at.state === undefined ? {} : { state: at.state }) });
  }
  return found;
}

/**
 * The folder an executor of task `n` works in, which `accord brief` names and under which its report lies: the task worktree while it exists, else `root`.
 * Undefined for a ticket claimed before 0.6.0, which is built one task at a time as before and whose brief names no Work dir (D-16 cut-off Ruling).
 * `claimed` is the snapshot with the claim read (`withClaimPins`), so brief and task-done decide on the read they already made; a failed read gives the folder.
 */
export function workRootOf(root: string, claimed: RepoSnapshot, id: string, n: number, what: string): string | undefined {
  if (claimPinBefore(claimed, id, PLAN_WAVES_FROM)) return undefined;
  const list = listWorktrees(root);
  const at = atTask(list, id, n);
  // round 3 finding 4: a task folder off its task branch holds the task's work, so the ticket checkout is never taken for it (exit 2, as a wrong checkout)
  if (at?.other !== undefined) throw new UsageError(`${what} reads task ${n}'s worktree, and ${at.other} - put it back on its task branch, or tell the owner; nothing was changed`);
  return at === undefined ? slash(root) : slash(at.w.path);
}

/** The refusal of a command run outside the ticket's own checkout, naming the checkout that holds the ticket branch, or how to open one. */
function wrongCheckout(what: string, id: string, ticketBranch: string, list: PrunableEntry[]): string {
  const holder = list.find((w) => w.branch === ticketBranch && w.prunable === undefined);
  return holder === undefined
    ? `${what} runs in ${id}'s own checkout, on ${ticketBranch}, and no worktree holds that branch - open it with accord worktree open ${id}; nothing was changed`
    : `${what} runs in ${id}'s own checkout: run it in ${slash(holder.path)}; nothing was changed`;
}

/**
 * Review round 1 finding 8: `workRootOf` for `accord brief`, which never names a folder that is not a checkout of the ticket branch or of task n's own branch. When the
 * folder would be `root` (no task worktree) and `root` is on neither, a UsageError names the ticket's checkout, as the task commands' refusal does, before the brief writes
 * anything. A ticket whose branch exists neither locally nor on origin (never claimed) has no branch to compare with and passes. Undefined for a ticket claimed before 0.6.0, unchecked.
 */
export function briefWorkRoot(root: string, claimed: RepoSnapshot, id: string, n: number): string | undefined {
  const dir = workRootOf(root, claimed, id, n, `accord brief ${id} ${n}`);
  if (dir === undefined || norm(dir) !== norm(slash(root))) return dir;
  const ticketBranch = branchOf(claimed, id);
  const here = currentBranch(root);
  if (here === ticketBranch || here === taskBranch(id, n)) return dir;
  const list = listWorktrees(root);
  // round 2 finding 7: a ticket branch that only origin holds exists too (the claim pushed it; the local branch or worktree was removed)
  const exists = list.some((w) => w.branch === ticketBranch) || ['refs/heads/', 'refs/remotes/origin/'].some((p) => gitOk(root, ['rev-parse', '--verify', '-q', p + ticketBranch]));
  if (!exists) return dir;
  throw new UsageError(wrongCheckout(`accord brief ${id} ${n}`, id, ticketBranch, list));
}

/**
 * Phase 8.5 D-02: the folder a fix executor works in when `accord brief <id> --fix` names no task: the ticket's own checkout, as a fix is committed on the ticket branch. `root` when it is on that
 * branch, or when the ticket's branch exists nowhere (never claimed, as `briefWorkRoot` passes it); a checkout on another branch is the refusal every task command makes, naming the one to run it in.
 */
export function fixWorkRoot(root: string, claimed: RepoSnapshot, id: string): string {
  const ticketBranch = branchOf(claimed, id);
  if (currentBranch(root) === ticketBranch) return slash(root);
  const list = listWorktrees(root);
  const exists = list.some((w) => w.branch === ticketBranch) || ['refs/heads/', 'refs/remotes/origin/'].some((p) => gitOk(root, ['rev-parse', '--verify', '-q', p + ticketBranch]));
  if (!exists) return slash(root);
  throw new UsageError(wrongCheckout(`accord brief ${id} --fix`, id, ticketBranch, list));
}

/** The checks every task command makes: the id and task number, and that it runs in the ticket's own checkout (exit 2 naming the one to run it in). */
function inTicketCheckout(ctx: CommandContext, id: string, task: string, verb: 'open' | 'merge' | 'clean'): { n: number; ticketBranch: string; list: PrunableEntry[] } {
  const n = taskNumber(task);
  if (!ID.test(id)) throw new UsageError('not a valid ticket id: ' + id);
  requireTicket(ctx.snapshot, id);
  const ticketBranch = branchOf(ctx.snapshot, id);
  const list = listWorktrees(ctx.root);
  if (currentBranch(ctx.root) !== ticketBranch) throw new UsageError(wrongCheckout(`accord worktree task ${verb}`, id, ticketBranch, list));
  return { n, ticketBranch, list };
}

/** Tracked files changed in `dir` (untracked files are git's own concern: a rebase and a removal refuse to lose them). */
const dirty = (dir: string): boolean => git(dir, ['status', '--porcelain', '--untracked-files=no']).trim() !== '';

/** The paths a stopped rebase left unmerged in `dir`, NUL-separated so any path reads back whole. */
const unmerged = (dir: string): string[] => git(dir, ['diff', '--name-only', '--diff-filter=U', '-z']).split('\0').filter((p) => p !== '');

/**
 * D-06: `conflict: task <n> in <folder>`, then each path as `generated:` when an entry of the config's `generated:` list matches it, else `hand-written:`; exit 1.
 * The CLI runs no regenerate command (CONTEXT Ruling 2026-11-16): the build skill runs it, or a fresh executor resolves, then merge runs again.
 * Review round 1 finding 7: build.regenerate is repository text, like git.sync, so when every path is generated the CLI prints `regenerate: <command>` (the only
 * command the skill runs) only when `accord trust` allowed that command and the files it reaches; else `regenerate refused:` and how to allow it, and the skill
 * resolves as with no command set. Round 2 finding 5: the binding is read in the ticket checkout (`ctx.root`), where the owner allowed it, not in the task folder,
 * whose conflicted files a root-level cover would hold mid-rebase; merge has already refused a ticket checkout with changed tracked files, so what is read there is
 * the ticket branch's committed content. The skill runs the command in the task folder. Round 2 finding 8: the schema keeps the command on one line with no control
 * character, so it is printed as written.
 */
/**
 * Review round 3 finding 1: the allowed command runs in the task folder, so what it reaches there must be what was allowed in the ticket checkout. Every file the
 * trust cover hashes, in either checkout, is compared by git content id (the same id the digest is built from), leaving out only the unmerged paths the regenerate
 * command is to rewrite; the first file that differs (a task commit or an edit there changed it, or it exists on one side only) is named and the command is refused.
 */
function coverDiffers(root: string, task: string, command: string, unmergedPaths: readonly string[]): string | undefined {
  const here = scriptDigest(root, command);
  const there = scriptDigest(task, command);
  const skip = new Set(unmergedPaths);
  const first = [...new Set([...here.files, ...there.files])]
    .filter((f) => !skip.has(f))
    .sort()
    .find((f) => here.hashes[f] !== there.hashes[f]);
  if (first === undefined) return undefined;
  return `build.regenerate "${command}" would run in ${task}, where ${first} is not the content allowed in ${slash(root)} (a commit or an edit in the task folder changed it), so it was not printed to run; resolve the conflict as with no build.regenerate`;
}

function conflict(ctx: CommandContext, n: number, path: string, paths: string[]): number {
  const generated = ctx.snapshot.config?.generated ?? [];
  const isGenerated = paths.map((p) => generated.some((e) => matches(e, p)));
  const lines = paths.map((p, i) => (isGenerated[i] ? 'generated: ' : 'hand-written: ') + p);
  const regenerate = ctx.snapshot.config?.build?.regenerate;
  if (regenerate !== undefined && isGenerated.every(Boolean)) {
    const refusal = scriptRefusal(ctx.root, 'build.regenerate', regenerate) ?? coverDiffers(ctx.root, path, regenerate, paths);
    lines.push(refusal === undefined ? 'regenerate: ' + regenerate : 'regenerate refused: ' + refusal);
  }
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
  const found = atTask(list, id, n);
  if (found !== undefined) {
    if (found.other !== undefined) throw new UsageError(`${found.other} - nothing was created`);
    if (!existsSync(setupMarker(found.w.path))) prepare(found.w.path, ctx.root);
    return printOpen(ctx, found.w.path, branch);
  }
  if (list.some((w) => norm(w.path) === norm(path))) {
    throw new UsageError(`git still registers a worktree at ${path}, whose folder is missing - put that folder back, then try again; nothing was created`);
  }
  const holder = list.find((w) => w.branch === branch);
  if (holder !== undefined) throw new UsageError(`${branch} is checked out in ${holder.path.replace(/\\/g, '/')}, not in ${path} - nothing was created`);
  if (existsSync(path)) throw new UsageError(`${path} already exists and is not a worktree of ${branch} - move it away, then try again; nothing was created`);
  if (gitOk(ctx.root, ['rev-parse', '--verify', '-q', 'refs/heads/' + branch])) {
    throw new UsageError(`the branch ${branch} already exists with no worktree - keep its commits (git branch -m), then try again; nothing was created`);
  }
  git(ctx.root, ['worktree', 'add', '-q', '-b', branch, path, 'HEAD']);
  prepare(path, ctx.root);
  return printOpen(ctx, path, branch);
}

/**
 * `accord worktree task merge <id> <n>`: rebase the task branch onto the ticket branch in the task worktree, then fast-forward the ticket branch to it. No order is
 * enforced between the tasks of a wave (the permission-fallback Ruling): a task stopped after committing is merged after the ones recorded.
 */
export function taskMerge(ctx: CommandContext, id: string, task: string): number {
  const { n, ticketBranch, list } = inTicketCheckout(ctx, id, task, 'merge');
  const found = atTask(list, id, n);
  if (found === undefined) throw new UsageError(`task ${n} of ${id} has no worktree - open it with accord worktree task open ${id} ${n}; nothing was merged`);
  // findings 2, 4, 9: a fast-forward to the task branch would leave the folder's own commits out and still say merged
  if (found.other !== undefined) {
    ctx.stdout.write(`not merged: task ${n} of ${id}: ${found.other} - nothing was merged\n`);
    return 1;
  }
  const path = slash(found.w.path);
  if (dirty(ctx.root)) throw new UsageError(`${ctx.root.replace(/\\/g, '/')} has uncommitted changes to tracked files - commit them first; nothing was merged`);
  // atTask takes a detached task folder only while a rebase of the task branch is stopped there
  const stopped = found.w.branch === undefined;
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
      // round 3 finding 5: a failure reading the stopped rebase never hides git's own rebase error
      let paths: string[];
      try {
        paths = rebaseBranch(path) === taskBranch(id, n) ? unmerged(path) : [];
      } catch {
        throw err;
      }
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
  const refuse = (why: string): number => {
    ctx.stdout.write(`kept task ${n} of ${id}: ${why}\n`);
    return 1;
  };
  const found = atTask(list, id, n);
  // findings 4 and 9: the folder holds another branch or a detached HEAD; deleting the task branch beside it would print removed: while the folder and its work stay
  if (found?.other !== undefined) return refuse(`${found.other} - nothing was removed`);
  const w = found?.w;
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
  let live = list;
  // round 3 finding 2: the task folder deleted by hand (git lists it as prunable) is pruned, as `accord worktree clean` prunes (each pruned record printed, and
  // nothing pruned while a missing folder holds a detached HEAD on no branch); the branch then goes only when the ticket branch holds its tip, as below
  const path = taskPath(list[0].path, id, n);
  if (w === undefined && list.some((x) => norm(x.path) === norm(path) && x.prunable !== undefined)) {
    live = worktrees(ctx.root, ctx.stdout);
    if (live.some((x) => norm(x.path) === norm(path))) {
      return refuse(`git still registers ${slash(path)}, whose folder is missing, and no prune runs while a missing folder holds a detached HEAD on no branch - nothing was removed`);
    }
  }
  // round 2 finding 4: the task branch checked out in a folder other than the task's (as taskOpen refuses it); its work there is not the ticket branch's to drop
  const holder = w === undefined ? live.find((x) => x.branch === branch && x.prunable === undefined) : undefined;
  if (holder !== undefined) return refuse(`${branch} is checked out in ${slash(holder.path)}, not in its task folder - nothing was removed`);
  if (w !== undefined && w.branch === undefined) return refuse(`a rebase is stopped in ${slash(w.path)}: finish it with accord worktree task merge ${id} ${n} first`);
  for (const sha of [tip, w?.head]) {
    if (sha === undefined || sha === '') continue;
    if (!gitOk(ctx.root, ['merge-base', '--is-ancestor', sha, 'HEAD'])) return refuse(`task ${n}'s branch holds commits the ticket branch lacks: run accord worktree task merge ${id} ${n} first`);
  }
  if (w !== undefined) git(ctx.root, ['worktree', 'remove', w.path]);
  if (tip !== undefined) git(ctx.root, ['update-ref', '-d', 'refs/heads/' + branch, tip]);
  // `removed:` names a folder only when it was removed; a task branch with no worktree is named as the branch deleted
  ctx.stdout.write(w !== undefined ? `removed: ${slash(w.path)}\n` : `deleted: branch ${branch} (task ${n} had no worktree)\n`);
  return 0;
}
