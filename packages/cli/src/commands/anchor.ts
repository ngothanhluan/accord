// Spec §6 `accord anchor [id]`: the active ticket's intent, vetoes, decisions, corrections, and position,
// for the SessionStart hook after compaction and for the first step of every stage skill. Without an id
// the active ticket is the current branch named by a template in force (t/{id} or config `branch`); on any other branch there is nothing to anchor.
import { execFileSync } from 'node:child_process';
import { anchorText, DEFAULT_BRANCH_TEMPLATE } from '@accord-dev/accord-core';
import type { RepoSnapshot } from '@accord-dev/accord-core';
import { ticketOfBranch } from '../load/fs.js';
import type { CommandContext } from '../run.js';
import { requireLaneTicket } from './lane-args.js';

/** The branch name; '' for a detached HEAD; undefined when git could not say. */
function currentBranch(root: string): string | undefined {
  try {
    // symbolic-ref answers on an unborn branch too, where rev-parse fails.
    return execFileSync('git', ['symbolic-ref', '--short', '-q', 'HEAD'], {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim();
  } catch (e) {
    const { status, stdout } = e as { status?: number | null; stdout?: string };
    return status === 1 && (stdout ?? '').trim() === '' ? '' : undefined;
  }
}

/** The id the current branch carries under a template in force; undefined on any other branch. Throws when git could not say. */
export function activeTicket(root: string, snapshot: RepoSnapshot): string | undefined {
  const branch = currentBranch(root);
  if (branch === undefined) throw new Error('could not read the current branch; nothing to anchor');
  return ticketOfBranch(branch, snapshot.branchTemplates ?? [DEFAULT_BRANCH_TEMPLATE], (id) => Object.hasOwn(snapshot.tickets, id));
}

export function anchor(ctx: CommandContext, id: string | undefined): number {
  if (id !== undefined) {
    requireLaneTicket(ctx, id);
    ctx.stdout.write(anchorText(ctx.snapshot, id) ?? '');
    return 0;
  }
  // A hook must not fail a session start, but an empty anchor must not be silent: so every failure here
  // exits 0 and says why on stderr, and only a detached HEAD (nothing to anchor) says nothing.
  let active: string | undefined;
  try {
    active = activeTicket(ctx.root, ctx.snapshot);
  } catch (e) {
    ctx.stderr.write((e as Error).message + '\n');
    return 0;
  }
  if (active === undefined) return 0;
  const text = anchorText(ctx.snapshot, active);
  if (text === undefined) ctx.stderr.write(active + ' is not a lane ticket in accord/tickets/; nothing to anchor\n');
  else ctx.stdout.write(text);
  return 0;
}
