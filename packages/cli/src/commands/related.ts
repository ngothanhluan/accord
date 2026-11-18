// ST-LN-22 D-09 `accord related <id>`: the Vetoes and Decisions of the tickets related to <id>, then the Rejected lines of
// accord/product/conventions.md (ST-LN-84 D-10), for the scout at intent and the critic at approach. The skills paste what this prints into the dispatch, so no agent is told to open other tickets' files.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { relatedText } from '@accord-dev/accord-core';
import type { CommandContext } from '../run.js';
import { requireTicket } from './lane-args.js';
import { withDefaultBranch } from './ticket-shared.js';

export function related(ctx: CommandContext, id: string): number {
  requireTicket(ctx.snapshot, id);
  // The default branch's tickets count as well as the working tree's (a finished ticket may not be in a clone's checkout yet); the
  // whole ref is read, not only the ids the working tree holds, so a similar ticket that exists only there is found.
  const view = ctx.snapshot.defaultRef === undefined ? withDefaultBranch(ctx) : ctx.snapshot;
  // ST-LN-84 D-10: the team's recorded refusals, read from disk as `accord brief` reads them (a BOM or CRLF reaches core as written).
  const convPath = join(ctx.root, 'accord', 'product', 'conventions.md');
  const conventions = existsSync(convPath) ? readFileSync(convPath, 'utf8') : undefined;
  ctx.stdout.write(relatedText(view, id, conventions) ?? '');
  return 0;
}
