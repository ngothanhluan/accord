// Spec §6 `accord anchor [id]`: the active ticket's intent, vetoes, decisions, corrections, and position,
// for the SessionStart hook after compaction and for the first step of every stage skill. Without an id
// the active ticket is the current branch named by a template in force (t/{id} or config `branch`); on any other branch there is nothing to anchor.
import { anchorText, DEFAULT_BRANCH_TEMPLATE } from '@accord-dev/accord-core';
import type { RepoSnapshot } from '@accord-dev/accord-core';
import { currentBranch, ticketOfBranch } from '../load/fs.js';
import type { CommandContext } from '../run.js';
import { requireLaneTicket } from './lane-args.js';

/** The id the current branch carries under a template in force; undefined on any other branch. Throws when git could not say. */
export function activeTicket(root: string, snapshot: RepoSnapshot, known?: { name: string | undefined }): string | undefined {
  // ST-LN-63: `known` is the branch the load of this same checkout already read.
  const branch = known === undefined ? currentBranch(root) : known.name;
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
    active = activeTicket(ctx.root, ctx.snapshot, ctx.branch);
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
