// ST-LN-22 D-09 `accord related <id>`: the Vetoes and Decisions of the tickets related to <id>, for the scout at intent and the
// critic at approach. The skills paste what this prints into the dispatch, so no agent is told to open other tickets' files.
import { relatedText } from '@accord-dev/accord-core';
import type { CommandContext } from '../run.js';
import { requireTicket } from './lane-args.js';
import { withDefaultBranch } from './new-ticket.js';

export function related(ctx: CommandContext, id: string): number {
  requireTicket(ctx.snapshot, id);
  // The default branch's tickets count as well as the working tree's (a finished ticket may not be in a clone's checkout yet); the
  // whole ref is read, not only the ids the working tree holds, so a similar ticket that exists only there is found.
  const view = ctx.snapshot.defaultRef === undefined ? withDefaultBranch(ctx) : ctx.snapshot;
  ctx.stdout.write(relatedText(view, id) ?? '');
  return 0;
}
