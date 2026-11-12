// ST-LN-91 D-22: the open `risk: data-loss` and `risk: security` approach findings `accord show --approval --short` lists and `accord approve` refuses on.
import { approvalFindings, claimPinError } from '@accord-dev/accord-core';
import { withClaimPins } from '../load/claim-facts.js';
import type { CommandContext } from '../run.js';

/** One round's finding lines, as `accord round` prints them. */
export interface RoundLines { round: number; lines: string[] }

/**
 * The findings of ticket `id`'s last approach cycle that the approval shows: `blocking` (the block applies only when the ticket's claim pin is at
 * or after the cut-off), `risks`, and `error`, the git error when the claim pin could not be read and so the capped rules apply (fail closed). The
 * claim pin is read from git as `accord round --approach` reads it; the checkout's snapshot holds the work records.
 */
export function approachFacts(ctx: CommandContext, id: string): { risks: RoundLines[]; blocking: RoundLines[]; error?: string } {
  const snapshot = withClaimPins(ctx.root, ctx.plain ?? ctx.snapshot, id);
  const error = claimPinError(snapshot, id);
  return { ...approvalFindings(snapshot, id), ...(error === undefined ? {} : { error }) };
}

/** The one line that names the git error behind the capped rules (the error is one line already: `whyGit`). */
export const claimNote = (error: string): string => `${error}; the claim pin could not be read, so the capped rules apply`;

/** The refusal `accord approve` prints: one line, the git error when the claim pin could not be read, then each blocking round's findings as `accord round` prints them. */
export function blockedApproval(id: string, blockers: RoundLines[], error?: string): string {
  const out = [
    `refused: ${id} has an approach finding marked risk: data-loss or risk: security still open, and it blocks the approval: the owner cannot say yes to this approach; ` +
      "the owner's no with a Correction appends ## Closed to approach-review.md and starts a new cycle",
    ...(error === undefined ? [] : [claimNote(error)]),
    'Blocking findings:',
  ];
  for (const b of blockers) out.push(`Round ${b.round}:`, ...b.lines);
  return out.join('\n') + '\n';
}
