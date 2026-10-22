// Spec §4 `accord approve <id>`: records the owner's approval as approved_hash. Run only after the owner
// says yes in so many words; the gate then fails the moment an approved section changes.
import { approvedHash } from '@accord-dev/accord-core';
import { UsageError } from '../load/fs.js';
import type { CommandContext } from '../run.js';
import { writeKey } from '../write/key.js';
import { requireLaneTicket } from './lane-args.js';

export function approve(ctx: CommandContext, id: string): number {
  const ticket = requireLaneTicket(ctx, id);
  if (ticket.frontmatter?.lane === 'S') {
    throw new UsageError(ticket.file + ' is a lane S ticket, which needs no approval: run accord gate ready ' + id);
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
