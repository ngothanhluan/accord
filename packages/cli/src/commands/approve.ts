// Spec §4 `accord approve <id>`: records the owner's approval as approved_hash. Run only after the owner
// says yes in so many words; the gate then fails the moment an approved section changes.
import { approvedHash } from '@accord-dev/accord-core';
import { UsageError } from '../load/fs.js';
import type { CommandContext } from '../run.js';
import { writeKey } from '../write/key.js';

export function approve(ctx: CommandContext, id: string): number {
  if (!Object.hasOwn(ctx.snapshot.tickets, id)) throw new UsageError('no ticket ' + id + ' in accord/tickets/');
  const ticket = ctx.snapshot.tickets[id];
  if (ticket.frontmatter === undefined) {
    throw new UsageError(ticket.file + ' has frontmatter errors; run accord lint');
  }
  if (ticket.frontmatter.lane === undefined) {
    throw new UsageError(ticket.file + ' has no lane:, and approval applies to lane tickets only');
  }
  const hash = approvedHash(ticket);
  let wrote: boolean;
  try {
    // T-05-07: the path is the loader's record for a ticket that exists, never the raw argument.
    wrote = writeKey(ctx.root, ticket.file, 'approved_hash', hash);
  } catch (err) {
    throw new UsageError(
      'cannot write approved_hash to ' + ticket.file + ': ' + (err instanceof Error ? err.message : String(err)),
    );
  }
  ctx.stdout.write((wrote ? 'approved ' : 'already approved ') + ticket.file + ' at ' + hash + '\n');
  return 0;
}
