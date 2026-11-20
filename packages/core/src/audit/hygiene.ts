// Phase 8.2 group 3 (work hygiene, D-01, D-02, D-06): the gaps `accord audit` prints about claimed tickets that went quiet and about drafts nobody touched. Pure: no node import, no
// filesystem, no git; the CLI hands it rows and ages it already read, and the function that shows a person (D-08).
import type { RepoSnapshot } from '../model/snapshot.js';
import type { StatusRow } from '../status/rows.js';
import type { AuditGap } from './conventions.js';

/** The ticket id shape a command may be printed for: the same as the CLI's `ID` (packages/cli/src/commands/worktree.ts) and the panel's SAFE_ID. Ruling "ids in fix commands". */
export const SAFE_ID = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

/** The branch name shape a command may be printed for, and a git argument built from (Ruling "ids in fix commands"). */
export const SAFE_BRANCH = /^[A-Za-z0-9._/-]+$/;

/** What a fix says for an id a command line would read: text from a file name never becomes a command the skill runs on a yes. */
export const NO_COMMAND = 'the ticket id holds characters a command line would read, so no command is printed: rename its ticket file to a plain id first';

/** What a fix says for a branch name a command line would read. */
export const NO_COMMAND_BRANCH = 'the branch name holds characters a command line would read, so no command is printed: rename that branch first';

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

/** The draft's age in whole days at `now` (epoch seconds), or undefined when nothing says (the loader then reads a queued branch's tip). Never `idleDays`, which exists only above `stale_days`. */
export function draftAge(snapshot: RepoSnapshot, id: string, now: number): number | undefined {
  const queued = snapshot.queued !== undefined && Object.hasOwn(snapshot.queued, id) ? snapshot.queued[id] : undefined;
  if (queued !== undefined) {
    // `backlog/<id>-<UTC date>`: the age counts from UTC midnight of the date that ends the branch name (accord queue writes it)
    const m = /-(\d{4})-(\d{2})-(\d{2})$/.exec(queued.branch);
    if (m === null) return undefined;
    const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
    const at = new Date(Date.UTC(y, mo - 1, d));
    if (at.getUTCFullYear() !== y || at.getUTCMonth() !== mo - 1 || at.getUTCDate() !== d) return undefined;
    return Math.floor((now - at.getTime() / 1000) / 86400);
  }
  const last = snapshot.lastActivity !== undefined && Object.hasOwn(snapshot.lastActivity, id) ? snapshot.lastActivity[id] : undefined;
  return last === undefined ? undefined : Math.floor((now - last) / 86400);
}

/** One old draft the loader found: its age, its creator's email when git named one, and the backlog branch that alone holds it when it was never merged. */
export interface OldDraft {
  id: string;
  days: number;
  creator: string | undefined;
  queued?: string;
}

/**
 * D-02, D-06: one `draft-stale` gap per draft older than `stale_draft_days` (strictly), in id code-point order, naming its creator. A draft only a backlog branch holds cannot be
 * dropped (`accord drop` refuses it), so its fix says to merge that branch first.
 */
export function draftStaleGaps(drafts: readonly OldDraft[], staleDraftDays: string, who: (email: string) => string): AuditGap[] {
  return drafts
    .filter((d) => d.days > Number(staleDraftDays))
    .sort((a, b) => cmp(a.id, b.id))
    .map((d) => {
      const by = d.creator === undefined ? 'an unknown author' : who(d.creator);
      const limit = `(stale_draft_days ${staleDraftDays})`;
      if (d.queued === undefined) {
        return {
          id: 'draft-stale',
          text: `${d.id} created by ${by} has not been touched for ${d.days} days ${limit}`,
          fix: SAFE_ID.test(d.id) ? `/accord-pickup ${d.id}, or accord drop ${d.id} --reason "<why>"` : NO_COMMAND,
        };
      }
      return {
        id: 'draft-stale',
        text: `${d.id} created by ${by} has waited on ${d.queued}, not merged, for ${d.days} days ${limit}`,
        fix: !SAFE_ID.test(d.id) ? NO_COMMAND : !SAFE_BRANCH.test(d.queued) ? NO_COMMAND_BRANCH : `merge ${d.queued} into the default branch first, then /accord-pickup ${d.id} or accord drop ${d.id} --reason "<why>"`,
      };
    });
}
