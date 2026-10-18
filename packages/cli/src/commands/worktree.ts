// ST-LN-7 `accord worktree`: each ticket works in its own git worktree, a sibling folder of the main checkout.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { DEFAULT_BRANCH_TEMPLATE, loadConfig } from '@accord-dev/accord-core';
import type { RepoSnapshot } from '@accord-dev/accord-core';
import { gitDefaultRef, UsageError } from '../load/fs.js';
import { runSetup } from '../load/proc.js';
import type { CommandContext } from '../run.js';

const ID = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

export interface WorktreeEntry {
  path: string;
  head: string;
  branch?: string;
}

function git(cwd: string, args: string[]): string {
  try {
    return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  } catch (err) {
    throw new UsageError('git ' + args.join(' ') + ' failed\n' + String((err as { stderr?: string }).stderr ?? '').trim());
  }
}

function gitOk(cwd: string, args: string[]): boolean {
  try {
    execFileSync('git', args, { cwd, stdio: ['ignore', 'pipe', 'pipe'] });
    return true;
  } catch {
    return false;
  }
}

/** The ticket's branch: the claim branch git already shows, else the template, as `accord status` prints it. */
export function branchOf(snapshot: RepoSnapshot, id: string): string {
  return snapshot.claimBranches !== undefined && Object.hasOwn(snapshot.claimBranches, id)
    ? snapshot.claimBranches[id]
    : (snapshot.claimTemplate ?? DEFAULT_BRANCH_TEMPLATE).replace('{id}', id);
}

export interface PrunableEntry extends WorktreeEntry {
  prunable?: string;
}

function listWorktrees(root: string): PrunableEntry[] {
  return git(root, ['worktree', 'list', '--porcelain'])
    .split('\n\n')
    .filter((block) => block.trim() !== '')
    .map((block) => {
      const entry: PrunableEntry = { path: '', head: '' };
      for (const line of block.split('\n')) {
        if (line.startsWith('worktree ')) entry.path = line.slice(9);
        else if (line.startsWith('HEAD ')) entry.head = line.slice(5);
        else if (line.startsWith('branch refs/heads/')) entry.branch = line.slice(18);
        else if (line === 'prunable' || line.startsWith('prunable ')) entry.prunable = line.slice(9) || 'no reason given';
      }
      return entry;
    });
}

/** `git worktree list --porcelain` in git's order (the first is the main worktree), after pruning records of folders deleted by hand, each named on `out`. */
export function worktrees(root: string, out: NodeJS.WritableStream): WorktreeEntry[] {
  let list = listWorktrees(root);
  const stale = list.filter((w) => w.prunable !== undefined);
  if (stale.length === 0) return list;
  git(root, ['worktree', 'prune']);
  list = listWorktrees(root);
  for (const w of stale) if (!list.some((x) => x.path === w.path)) out.write(`pruned ${w.path}: ${w.prunable}\n`);
  return list.filter((w) => w.prunable === undefined);
}

/** D-06: the main checkout's folder name, a hyphen, the id in lower case, beside the main checkout. */
export function siblingOf(mainPath: string, id: string): string {
  const cut = mainPath.lastIndexOf('/');
  return mainPath.slice(0, cut + 1) + mainPath.slice(cut + 1) + '-' + id.toLowerCase();
}

/** D-07: run the worktree's own `setup`; a failing command keeps the worktree and exits 2. */
export function prepare(path: string): void {
  let text = '';
  try {
    text = readFileSync(path + '/accord/config.yml', 'utf8');
  } catch {
    // no config: nothing to run
  }
  const failed = runSetup(loadConfig('accord/config.yml', text).config?.setup ?? [], path).failed;
  if (failed !== undefined) {
    throw new UsageError(
      `setup command failed in the new worktree: ${failed.command} (exit ${failed.code})\n${failed.tail}\nthe worktree is kept; fix the command, then continue the ticket again`,
    );
  }
}

/** D-11, D-12: exactly three lines, naming no tool. */
export function printStop(ctx: CommandContext, path: string, id: string): void {
  ctx.stdout.write(`stop: open a session in this folder and type the line below it\n${path}\n/accord continue ${id}\n`);
}

export function worktreeOpen(ctx: CommandContext, id: string, opts: { continue?: boolean } = {}): number {
  if (!ID.test(id)) throw new UsageError('not a valid ticket id: ' + id);
  const branch = branchOf(ctx.snapshot, id);
  const list = worktrees(ctx.root, ctx.stdout);
  const mainPath = list[0].path;
  // D-15: a worktree already holding the branch is only found, nothing runs there.
  const held = list.find((w) => w.branch === branch);
  if (held !== undefined) {
    printStop(ctx, held.path, id);
    return 0;
  }
  const local = gitOk(ctx.root, ['rev-parse', '--verify', '-q', 'refs/heads/' + branch]);
  const remote = gitOk(ctx.root, ['rev-parse', '--verify', '-q', 'refs/remotes/origin/' + branch]);
  if (local || remote) {
    const path = siblingOf(mainPath, id);
    git(ctx.root, local ? ['worktree', 'add', path, branch] : ['worktree', 'add', '--track', '-b', branch, path, 'origin/' + branch]);
    prepare(path);
    printStop(ctx, path, id);
    return 0;
  }
  const isTicket = Object.hasOwn(ctx.snapshot.tickets, id);
  if (opts.continue === true) {
    throw new UsageError(
      isTicket
        ? `not claimed: ${id} has no branch ${branch} here or on origin - nothing was created; pick it up first`
        : `not a ticket: ${id} is not in accord/tickets and has no branch ${branch} here or on origin - nothing was created`,
    );
  }
  if (!isTicket) throw new UsageError('no ticket ' + id + ' in accord/tickets - nothing was created');
  const ref = gitDefaultRef(ctx.root);
  if (ref === undefined) throw new UsageError('no origin/main in this clone - run git fetch origin, then try again');
  if (!gitOk(ctx.root, ['cat-file', '-e', `${ref}:accord/tickets/${id}.md`])) {
    throw new UsageError(
      `${id} is not on ${ref.replace('refs/remotes/', '')} - merge accord/tickets/${id}.md into the main branch, run git fetch origin, then try again; nothing was created`,
    );
  }
  const path = siblingOf(mainPath, id);
  git(ctx.root, ['worktree', 'add', '--no-track', '-b', branch, path, ref]);
  git(path, ['commit', '--allow-empty', '-q', '-m', 'claim: ' + id]);
  prepare(path);
  printStop(ctx, path, id);
  return 0;
}
