// ST-LN-94 `accord budget <id>` (94-ac-4, D-11): whether a lane R ticket is within its Timebox and Token budget, clocked from the committer
// time of its claim commit, modelled on `accord round <id>`. Exit 0 within budget; 1 for `stop: ask owner`; 2 for a usage error (not a lane R
// ticket, an unreadable Timebox or Token budget, no claim commit).
import { budgetVerdict, readTimebox, readTokenBudget, sectionValue } from '@accord-dev/accord-core';
import { gitClaimFacts } from '../load/claim-facts.js';
import { UsageError } from '../load/fs.js';
import type { CommandContext } from '../run.js';
import { requireLaneTicket } from './lane-args.js';

/** The section's first line as written and the number its reader gives; a UsageError naming the section when either is missing. */
function allowance(text: string | undefined, name: string, read: (text: string) => number | undefined): { text: string; n: number } {
  const n = text === undefined ? undefined : read(text);
  if (text === undefined || n === undefined) throw new UsageError(`the "## ${name}" section of the ticket does not read as an allowance; run accord gate ready`);
  return { text, n };
}

/** 94-ac-4: `within budget` or `stop: ask owner`, the Spent line the record states, and on a stop how the owner's answer is written. */
export function budget(ctx: CommandContext, id: string): number {
  const ticket = requireLaneTicket(ctx, id);
  const lane = ticket.frontmatter?.lane;
  if (lane !== 'R') throw new UsageError(`accord budget applies to lane R tickets only; ${id} is lane ${String(lane)}`);
  const timebox = allowance(sectionValue(ticket, 'Timebox'), 'Timebox', readTimebox);
  const budgetLine = allowance(sectionValue(ticket, 'Token budget'), 'Token budget', readTokenBudget);
  // D-11 Ruling: the clock starts at the claim commit; with no commit at all there is none.
  const fact = ctx.snapshot.git === undefined ? undefined : gitClaimFacts(ctx.root, id);
  if (fact === undefined) throw new UsageError(`no claim commit for ${id}: run accord worktree open ${id}`);
  if ('error' in fact) throw new UsageError(fact.error);
  // A claim commit dated after now (clock skew) counts as no time spent.
  const elapsedMinutes = Math.max(0, Math.floor((Date.now() - fact.time * 1000) / 60_000));
  const answer = budgetVerdict({
    id,
    elapsedMinutes,
    timeboxMinutes: timebox.n,
    timebox: timebox.text,
    // Plan 03-21 supplies the tokens measured from the Claude Code transcripts (D-11, D-20); until then they are not measured.
    tokens: undefined,
    budgetTokens: budgetLine.n,
    budget: budgetLine.text,
  });
  ctx.stdout.write(answer.lines.join('\n') + '\n');
  return answer.stop ? 1 : 0;
}
