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

/** `git worktree list --porcelain`, in git's order; the first entry is the main worktree. */
export function worktrees(root: string): WorktreeEntry[] {
  return git(root, ['worktree', 'list', '--porcelain'])
    .split('\n\n')
    .filter((block) => block.trim() !== '')
    .map((block) => {
      const entry: WorktreeEntry = { path: '', head: '' };
      for (const line of block.split('\n')) {
        if (line.startsWith('worktree ')) entry.path = line.slice(9);
        else if (line.startsWith('HEAD ')) entry.head = line.slice(5);
        else if (line.startsWith('branch refs/heads/')) entry.branch = line.slice(18);
      }
      return entry;
    });
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

export function worktreeOpen(ctx: CommandContext, id: string): number {
  if (!ID.test(id)) throw new UsageError('not a valid ticket id: ' + id);
  const branch = branchOf(ctx.snapshot, id);
  if (
    gitOk(ctx.root, ['rev-parse', '--verify', '-q', 'refs/heads/' + branch]) ||
    gitOk(ctx.root, ['rev-parse', '--verify', '-q', 'refs/remotes/origin/' + branch]) ||
    worktrees(ctx.root).some((w) => w.branch === branch)
  ) {
    throw new UsageError(branch + ' already exists');
  }
  if (!Object.hasOwn(ctx.snapshot.tickets, id)) {
    throw new UsageError('no ticket ' + id + ' in accord/tickets - nothing was created');
  }
  const ref = gitDefaultRef(ctx.root);
  if (ref === undefined) throw new UsageError('no origin/main in this clone - run git fetch origin, then try again');
  if (!gitOk(ctx.root, ['cat-file', '-e', `${ref}:accord/tickets/${id}.md`])) {
    throw new UsageError(
      `${id} is not on ${ref.replace('refs/remotes/', '')} - merge accord/tickets/${id}.md into the main branch, run git fetch origin, then try again; nothing was created`,
    );
  }
  const path = siblingOf(worktrees(ctx.root)[0].path, id);
  git(ctx.root, ['worktree', 'add', '--no-track', '-b', branch, path, ref]);
  git(path, ['commit', '--allow-empty', '-q', '-m', 'claim: ' + id]);
  prepare(path);
  printStop(ctx, path, id);
  return 0;
}
