// ST-LN-91 D-22: the open `risk: data-loss` and `risk: security` approach findings `accord show --approval --short` lists and `accord approve` refuses on.
import { approvalFindings, approvalProblems, claimPinError } from '@accord-dev/accord-core';
import { withClaimPins } from '../load/claim-facts.js';
import type { CommandContext } from '../run.js';

/** One round's finding lines, as `accord round` prints them. */
export interface RoundLines { round: number; lines: string[] }

/**
 * The findings of ticket `id`'s last approach cycle that the approval shows: `blocking` (the block applies only when the ticket's claim pin is at
 * or after the cut-off), `risks`, `problems` (CR-01: what the approach record holds that accord cannot read, on the same rules as `blocking`), and
 * `error`, the git error when the claim pin could not be read and so the capped rules apply (fail closed). The
 * claim pin is read from git as `accord round --approach` reads it; the checkout's snapshot holds the work records.
 */
export function approachFacts(ctx: CommandContext, id: string): { risks: RoundLines[]; blocking: RoundLines[]; problems: string[]; error?: string } {
  const snapshot = withClaimPins(ctx.root, ctx.plain ?? ctx.snapshot, id);
  const error = claimPinError(snapshot, id);
  return { ...approvalFindings(snapshot, id), problems: approvalProblems(snapshot, id), ...(error === undefined ? {} : { error }) };
}

/** The one line that names the git error behind the capped rules (the error is one line already: `whyGit`). */
export const claimNote = (error: string): string => `${error}; the claim pin could not be read, so the capped rules apply`;

/**
 * The refusal `accord approve` prints: one line, the git error when the claim pin could not be read, then each blocking round's findings as `accord round`
 * prints them, then (CR-01) the record problems, one per line, as `accord round` names them.
 */
export function blockedApproval(id: string, blockers: RoundLines[], error?: string, problems: string[] = []): string {
  const lead =
    blockers.length > 0
      ? `refused: ${id} has an approach finding marked risk: data-loss or risk: security still open, and it blocks the approval: the owner cannot say yes to this approach; ` +
        "the owner's no with a Correction appends ## Closed to approach-review.md and starts a new cycle"
      : `refused: ${id} has an approach-review.md that accord cannot read as it stands, so the approval waits: fix the record and ask again`;
  const out = [lead, ...(error === undefined ? [] : [claimNote(error)])];
  if (blockers.length > 0) out.push('Blocking findings:');
  for (const b of blockers) out.push(`Round ${b.round}:`, ...b.lines);
  if (problems.length > 0) out.push(...(blockers.length > 0 ? ['Record problems (approach-review.md):'] : ['Record problems:']), ...problems);
  return out.join('\n') + '\n';
}
