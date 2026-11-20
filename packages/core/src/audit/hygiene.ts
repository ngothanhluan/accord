// Phase 8.2 group 3 (work hygiene, D-01, D-02, D-06): the gaps `accord audit` prints about claimed tickets that went quiet and about drafts nobody touched. Pure: no node import, no
// filesystem, no git; the CLI hands it rows and ages it already read, and the function that shows a person (D-08).
import type { StatusRow } from '../status/rows.js';
import type { AuditGap } from './conventions.js';

/** The ticket id shape a command may be printed for: the same as the CLI's `ID` (packages/cli/src/commands/worktree.ts) and the panel's SAFE_ID. Ruling "ids in fix commands". */
const SAFE_ID = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

/** What a fix says for an id a command line would read: text from a file name never becomes a command the skill runs on a yes. */
export const NO_COMMAND = 'the ticket id holds characters a command line would read, so no command is printed: rename its ticket file to a plain id first';

const cmp = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

/**
 * D-01, D-06: one `ticket-idle` gap per claimed open row whose `idleDays` is set (it is set only above `stale_days`), named by claimer, in id code-point order.
 * `who` is the one display function: the person is the email or what the setting maps it to.
 */
export function ticketIdleGaps(open: readonly StatusRow[], staleDays: string, who: (email: string) => string): AuditGap[] {
  return open
    .filter((r) => r.claimedBy !== undefined && r.idleDays !== undefined)
    .sort((a, b) => cmp(a.id, b.id))
    .map((r) => ({
      id: 'ticket-idle',
      text: `${r.id} claimed by ${who(r.claimedBy as string)} has had no activity for ${r.idleDays} days (stale_days ${staleDays})`,
      fix: SAFE_ID.test(r.id) ? `/accord-continue ${r.id}, or accord drop ${r.id} --reason "<why>"` : NO_COMMAND,
    }));
}
