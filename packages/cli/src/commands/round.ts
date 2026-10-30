// ST-LN-17 `accord round <id> [--plan]`: the next review or plan critique round, read from review.md or
// plan-review.md. Exit 0 only for a next round; 1 for a stop or a refusal; 2 for a usage error.
import { nextRound, roundText } from '@accord-dev/accord-core';
import { UsageError, withReturnFacts } from '../load/fs.js';
import type { CommandContext } from '../run.js';
import { requireLaneTicket } from './lane-args.js';

/** ST-LN-17: the next review or plan critique round, its cap and the fix executor's model, or the stop or refusal; exit 0 only for a next round. */
export function round(ctx: CommandContext, id: string, options: { plan?: boolean }): number {
  const ticket = requireLaneTicket(ctx, id);
  const plan = options.plan === true;
  if (plan && ticket.frontmatter?.lane === 'S') {
    throw new UsageError('lane S has no plan critique; accord round ' + id + ' counts its review rounds');
  }
  const snapshot = plan ? ctx.snapshot : withReturnFacts(ctx.root, ctx.snapshot, id);
  const answer = nextRound(snapshot, id, plan ? 'plan' : 'review');
  ctx.stdout.write(roundText(answer));
  return answer.kind === 'next' ? 0 : 1;
}
