// ST-LN-17 `accord round <id> [--plan | --approach]`: the next review, plan critique or approach critique round, read from
// review.md, plan-review.md or approach-review.md. Exit 0 only for a next round; 1 for a stop or a refusal; 2 for a usage error.
import { nextRound, roundText } from '@accord-dev/accord-core';
import { UsageError, withReturnFacts } from '../load/fs.js';
import { withRoundFacts } from '../load/round-facts.js';
import type { CommandContext } from '../run.js';
import { requireLaneTicket } from './lane-args.js';

/** ST-LN-17: the next review, plan critique or approach critique round, its cap and the fix executor's model, or the stop or refusal; exit 0 only for a next round. */
export function round(ctx: CommandContext, id: string, options: { plan?: boolean; approach?: boolean }): number {
  const ticket = requireLaneTicket(ctx, id);
  const plan = options.plan === true;
  const approach = options.approach === true;
  if (plan && approach) throw new UsageError('give --plan or --approach, not both');
  if (plan && ticket.frontmatter?.lane === 'S') {
    throw new UsageError('lane S has no plan critique; accord round ' + id + ' counts its review rounds');
  }
  if (approach && ticket.frontmatter?.lane === 'S') {
    throw new UsageError('lane S has no approach critique; accord round ' + id + ' counts its review rounds');
  }
  const snapshot = plan || approach ? ctx.snapshot : withRoundFacts(ctx.root, withReturnFacts(ctx.root, ctx.snapshot, id), id);
  const answer = nextRound(snapshot, id, plan ? 'plan' : approach ? 'approach' : 'review');
  ctx.stdout.write(roundText(answer));
  return answer.kind === 'next' ? 0 : 1;
}
