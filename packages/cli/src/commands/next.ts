// Spec §6 `accord next`: lane tickets that passed Ready, have no task recorded yet, and are unblocked and
// unclaimed. The rows and the filter come from core; this file only writes them.
import { nextRows, statusRows } from '@accord-dev/accord-core';
import { renderRows } from '../render/table.js';
import type { CommandContext } from '../run.js';

export function next(ctx: CommandContext, options: { json?: boolean }): number {
  const rows = nextRows(statusRows(ctx.snapshot, undefined, ctx.plain));
  if (options.json) {
    ctx.stdout.write(JSON.stringify(rows, null, 2) + '\n');
    return 0;
  }
  ctx.stdout.write(rows.length === 0 ? 'no ticket is ready to pick up\n' : renderRows(rows));
  return 0;
}
