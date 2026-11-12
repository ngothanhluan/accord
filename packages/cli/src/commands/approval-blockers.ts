// ST-LN-91 D-22: the open `risk: data-loss` and `risk: security` approach findings `accord show --approval --short` lists and `accord approve` refuses on.
import { approvalBlockers } from '@accord-dev/accord-core';
import { withClaimPins } from '../load/claim-facts.js';
import type { CommandContext } from '../run.js';

/**
 * The blocking findings of ticket `id`'s last approach cycle, per round. The ticket's claim pin decides whether the capped rules (and so the
 * block) apply, read from git as `accord round --approach` reads it; the checkout's snapshot holds the work records.
 */
export function approachBlockers(ctx: CommandContext, id: string): { round: number; lines: string[] }[] {
  return approvalBlockers(withClaimPins(ctx.root, ctx.plain ?? ctx.snapshot, id), id);
}

/** The refusal `accord approve` prints: one line, then each blocking round's findings as `accord round` prints them. */
export function blockedApproval(id: string, blockers: { round: number; lines: string[] }[]): string {
  const out = [
    `refused: ${id} has an approach finding marked risk: data-loss or risk: security still open, and it blocks the approval: the owner cannot say yes to this approach; ` +
      "the owner's no with a Correction appends ## Closed to approach-review.md and starts a new cycle",
    'Blocking findings:',
  ];
  for (const b of blockers) out.push(`Round ${b.round}:`, ...b.lines);
  return out.join('\n') + '\n';
}
