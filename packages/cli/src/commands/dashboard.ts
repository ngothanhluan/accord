// ST-LN-2 `accord dashboard`: the ranked, capped sections for the viewer (git user.email), as text or JSON.
import { dashboard } from '@accord-dev/accord-core';
import { gitUserEmail, UsageError } from '../load/fs.js';
import { renderDashboard } from '../render/dashboard.js';
import type { CommandContext } from '../run.js';

export function dashboardCommand(ctx: CommandContext, options: { json?: boolean }): number {
  const viewer = gitUserEmail(ctx.root);
  if (viewer === '') throw new UsageError('git user.email is not set - set it with git config user.email <you@example.com>');
  const d = dashboard(ctx.snapshot, viewer, Math.floor(Date.now() / 1000), ctx.plain);
  ctx.stdout.write(options.json ? JSON.stringify(d, null, 2) + '\n' : renderDashboard(d));
  return 0;
}
