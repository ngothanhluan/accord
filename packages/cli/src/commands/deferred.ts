// ST-LN-12 D-12 `accord deferred <id>`: the Must and Should items under the ticket ledger's `## Deferred` that carry no owner's mark (Phase 8.2 D-04: a trailing
// ` → <id>` or ` → declined`), one short line each, for the owner at verify. It only reads; no gate looks at its answer, and no ledger line is changed or triaged.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ownerDeferred } from '@accord-dev/accord-core';
import { UsageError } from '../load/fs.js';
import type { CommandContext } from '../run.js';
import { requireTicket } from './lane-args.js';
import { ID } from './worktree.js';

export const NONE = 'no Must or Should deferred items';

export function deferred(ctx: CommandContext, id: string): number {
  // T-07-26: the id names a file the command reads, so it must be a plain ticket id (no slash, backslash or leading dot) before the path is built.
  if (!ID.test(id)) throw new UsageError('not a valid ticket id: ' + id);
  requireTicket(ctx.snapshot, id);
  // The text is read from disk as `accord related` reads conventions.md: a BOM or CRLF reaches core as written. No ledger counts as empty.
  const file = join(ctx.root, 'accord', 'tickets', id, 'ledger.md');
  const items = ownerDeferred(existsSync(file) ? readFileSync(file, 'utf8') : '');
  ctx.stdout.write(items.length === 0 ? NONE + '\n' : items.map((i) => i.rating + ': ' + i.text + '\n').join(''));
  return 0;
}
