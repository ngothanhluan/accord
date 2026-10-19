// The argument checks every workflow-layer command shares, so each refuses a bad task number or a
// non-lane ticket with the same words and exit 2.
import type { RepoSnapshot, Ticket } from '@accord-dev/accord-core';
import { UsageError } from '../load/fs.js';
import type { CommandContext } from '../run.js';

const TASK = /^[1-9][0-9]*$/;

/** A plan task number as the user typed it: a positive integer with no sign, point, or leading zero. */
export function taskNumber(arg: string): number {
  if (!TASK.test(arg)) throw new UsageError('not a task number: ' + arg);
  return Number(arg);
}

/** The ticket when the snapshot holds it; a UsageError otherwise. */
export function requireTicket(snapshot: RepoSnapshot, id: string): Ticket {
  // `Object.hasOwn`, never `in`: the id is caller-supplied.
  if (!Object.hasOwn(snapshot.tickets, id)) throw new UsageError('no ticket ' + id + ' in accord/tickets/');
  return snapshot.tickets[id];
}

/** The ticket when it exists, its frontmatter loaded, and it carries `lane:`; a UsageError otherwise. */
export function requireLaneTicket(ctx: CommandContext, id: string): Ticket {
  const ticket = requireTicket(ctx.snapshot, id);
  if (ticket.frontmatter === undefined) {
    throw new UsageError(ticket.file + ' has frontmatter errors; run accord lint');
  }
  if (ticket.frontmatter.lane === undefined) {
    throw new UsageError(ticket.file + ' has no lane:, and this command applies to lane tickets only');
  }
  return ticket;
}
