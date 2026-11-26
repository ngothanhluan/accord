// Phase 8.2 group 3 (work hygiene, D-01..D-06, D-10): the gaps `accord audit` prints about claimed tickets that went quiet, drafts nobody touched, and deferred items nobody decided. Pure: no node import, no
// filesystem, no git; the CLI hands it rows and ages it already read, and the function that shows a person (D-08).
import { LEGACY_ID } from '../lint/ids.js';
import type { RepoSnapshot } from '../model/snapshot.js';
import type { StatusRow } from '../status/rows.js';
import type { OwnerDeferred } from '../tickets/deferred.js';
import type { AuditGap } from './conventions.js';

/** The ticket id shape a command may be printed for: the one id shape of lint (`LEGACY_ID`), also the CLI's `ID` and `QUEUED_ID` and held equal to the panel's copy by a test (Phase 08.8 D-17 IN-04). Ruling "ids in fix commands". */
export const SAFE_ID = LEGACY_ID;

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
      // Phase 08.8 D-15: the fix says what to ask in words, not a typed form
      fix: SAFE_ID.test(r.id) ? `ask to continue ${r.id}, or accord drop ${r.id} --reason "<why>"` : NO_COMMAND,
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
 * dropped (`accord drop` refuses it), so its fix says the owner merges that branch's pull request first.
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
          fix: SAFE_ID.test(d.id) ? `ask to pick up ${d.id}, or accord drop ${d.id} --reason "<why>"` : NO_COMMAND,
        };
      }
      return {
        id: 'draft-stale',
        text: `${d.id} created by ${by} has waited on ${d.queued}, not merged, for ${d.days} days ${limit}`,
        // Phase 08.8 D-16, D-17: pull requests are merged by the owner; the fix names the wait, never an instruction to merge
        fix: !SAFE_ID.test(d.id) ? NO_COMMAND : !SAFE_BRANCH.test(d.queued) ? NO_COMMAND_BRANCH : `the owner merges the pull request of ${d.queued} first, then ask to pick up ${d.id} or accord drop ${d.id} --reason "<why>"`,
      };
    });
}

/** What a G2 fix says for a branch name a command line would read (Ruling "branch checks"). */
export const NO_COMMAND_CLAIM = 'the branch name holds characters a command line would read, so no command is printed; push or delete it by hand';

const NEXT = ' - next: ';

/**
 * D-03, D-06: the removed, deleted and pruned lines of an offline dry clean, one `worktree-leftover` gap each, in the clean's order: the line with its next action cut,
 * then the person who made the tip it concerns. `authorOf` gets the cut line and returns an email (or nothing); a `pruned` line names nobody and a `kept` line is no gap.
 */
export function leftoverGaps(lines: readonly string[], authorOf: (line: string) => string | undefined, who: (email: string) => string): AuditGap[] {
  const gaps: AuditGap[] = [];
  for (const raw of lines) {
    const cut = raw.indexOf(NEXT);
    const line = cut < 0 ? raw : raw.slice(0, cut);
    if (line.startsWith('pruned ')) {
      gaps.push({ id: 'worktree-leftover', text: line, fix: 'accord worktree clean' });
    } else if (line.startsWith('removed ') || line.startsWith('deleted ')) {
      const email = authorOf(line);
      gaps.push({ id: 'worktree-leftover', text: `${line}; branch tip by ${email === undefined || email === '' ? 'an unknown author' : who(email)}`, fix: 'accord worktree clean' });
    }
  }
  return gaps;
}

/** One claim branch ref read from git: local or origin-tracking, the ticket id its name carries, its tip, and what is known about it (Ruling "branch checks"). */
export interface ClaimRefFact {
  /** The branch name without `origin/`, as `t/ST-9`. */
  name: string;
  /** The tip's object name as git printed it; a local delete is printed pinned to it, so a commit made after this audit makes git refuse the delete. */
  sha: string;
  local: boolean;
  id: string;
  /** The tip's committer time, epoch seconds. */
  tip: number;
  /** The tip's author email, when git named one. */
  author: string | undefined;
  /** Some ticket file `accord/tickets/<id>.md` exists in the checkout, on the default branch or at this tip. */
  ticketAnywhere: boolean;
  /** `refs/remotes/origin/<name>` exists in this clone. */
  origin: boolean;
  /** The tip is already on the default ref. */
  merged: boolean;
  /** Phase 15 D-15, B-WR-07: this local branch's tip is on the progress ref `refs/accord/<id>` as this clone last fetched it: its commits are on origin, but the ref is not a claim, so the gap stays and names it. */
  progress?: boolean;
  /** Issue #341 D-07c: the id was guessed among more than one candidate the name can carry, none of them known, so no delete command is printed. */
  ambiguous?: boolean;
}

/** What a fix says for a local branch whose tip git did not give as a hash. */
export const NO_COMMAND_TIP = 'the branch tip could not be read as a hash, so no delete command is printed; delete it by hand';

const TIP_HASH = /^[0-9a-f]{40,64}$/;

/** Issue #341 D-07c: what a fix says for a branch whose ticket id was guessed among several candidates the name can carry. */
export const NO_COMMAND_GUESS = 'the ticket id was guessed from a name that can carry more than one id, so no delete command is printed; read the branch with git log and delete it by hand only if nobody works on it';

/** The repository's local branch delete (conventions.md): `git update-ref -d` pinned to the tip this audit read, never `git branch -D`. */
const deleteLocal = (r: ClaimRefFact): string | undefined => (TIP_HASH.test(r.sha) ? `git update-ref -d refs/heads/${r.name} ${r.sha}` : undefined);

/**
 * D-03, D-06: `branch-orphan` for a claim ref whose ticket exists nowhere, `claim-unpushed` for a local claim branch never pushed whose tip is older than `stale_days` (strictly).
 * A branch the dry clean already names in a `deleted` line is in neither (`deleted` holds `t/x` for a local ref and `origin/t/x` for an origin one). `unpushed: false` leaves the
 * second check out (no origin remote to compare with); `defaultName` is how the default branch reads in the text. A name a command line would read gets no command, and issue #341 D-07c: a ref
 * whose id was a guess among several candidates (`ambiguous`) is named as a guess and gets no delete command.
 */
export function branchGaps(
  refs: readonly ClaimRefFact[],
  deleted: ReadonlySet<string>,
  staleDays: string,
  now: number,
  who: (email: string) => string,
  opts: { unpushed?: boolean; defaultName?: string } = {},
): AuditGap[] {
  const def = opts.defaultName ?? 'the default branch';
  const by = (r: ClaimRefFact): string => (r.author === undefined || r.author === '' ? 'an unknown author' : who(r.author));
  const listed = refs.filter((r) => !deleted.has(r.local ? r.name : `origin/${r.name}`));
  const orphans = listed
    .filter((r) => !r.ticketAnywhere)
    .sort((a, b) => cmp(a.name, b.name) || Number(b.local) - Number(a.local))
    .map((r) => ({
      id: 'branch-orphan',
      text: `${r.name} (${r.local ? 'local' : 'origin'}) names ticket ${r.id}${r.ambiguous === true ? ' by a guess' : ''}, and no accord/tickets/${r.id}.md is in the checkout, on ${def} or on the branch; tip by ${by(r)}`,
      fix: !SAFE_BRANCH.test(r.name) ? NO_COMMAND_CLAIM : r.ambiguous === true ? NO_COMMAND_GUESS : r.local ? (deleteLocal(r) ?? NO_COMMAND_TIP) : `git push origin --delete ${r.name}`,
    }));
  const unpushed =
    opts.unpushed === false
      ? []
      : listed
          .filter((r) => r.local && !r.origin && !r.merged && Math.floor((now - r.tip) / 86400) > Number(staleDays))
          .sort((a, b) => cmp(a.name, b.name))
          .map((r) => ({
            id: 'claim-unpushed',
            // B-WR-07: a progress ref is never a claim (the dashboard ignores it), so it does not make the branch pushed; the text says where the commits are
            text: `${r.name} (ticket ${r.id}) has no origin/${r.name}, and its tip is ${Math.floor((now - r.tip) / 86400)} days old (stale_days ${staleDays}); tip by ${by(r)}${r.progress === true ? `; its commits are on origin in refs/accord/${r.id}, which is not a claim, so teammates do not see this ticket` : ''}`,
            fix: !SAFE_BRANCH.test(r.name)
              ? NO_COMMAND_CLAIM
              : r.ambiguous === true
                ? `git push -u origin ${r.name} to keep it; ${NO_COMMAND_GUESS}`
                : `git push -u origin ${r.name} to keep it${deleteLocal(r) === undefined ? '' : `, or ${deleteLocal(r)} to delete it`}`,
          }));
  return [...orphans, ...unpushed];
}

/**
 * D-04, D-06, D-10: one `deferred-undecided` gap per unmarked Must or Should item of a done ticket the loader judged (claimed at or after DEFERRED_MARK_FROM), in id code-point order, the items in
 * the order `ownerDeferred` gave them. No lane is read: the text, the fix and the input hold none, so the same route clears the gap on every lane.
 */
export function deferredGaps(tickets: readonly { id: string; items: readonly OwnerDeferred[] }[]): AuditGap[] {
  return [...tickets]
    .sort((a, b) => cmp(a.id, b.id))
    .flatMap((t) =>
      t.items.map((i) => ({
        id: 'deferred-undecided',
        text: `${t.id} has an undecided ${i.rating} item: ${i.text}`,
        fix: SAFE_ID.test(t.id)
          ? `queue it with /accord queue <idea> and append " → <new id>" to its line in accord/tickets/${t.id}/ledger.md, or append " → declined" there; a pull request that changes only that ledger`
          : NO_COMMAND,
      })),
    );
}

/** D-11: the most baseline ids one audit run lists; the baseline of this repository holds over a thousand, and a line naming them all cannot be read. */
export const BASELINE_LISTED = 10;

const WHY: Record<'test' | 'risk' | 'absent', string> = { test: 'named by @test:', risk: 'carries risk:', absent: 'not in the report' };

/**
 * D-05, D-11: one `baseline-removable` gap for the baseline ids that can go, the first BASELINE_LISTED ids in line order, each with its 1-based line of accord/tests-baseline.txt and its reason, and the
 * fix that names those lines (deleting is allowed: the baseline only shrinks); `(+K more)` and "run accord audit again" when more ids were found than listed. Undefined for an empty list.
 * `total` is the number of ids in the baseline.
 * Phase 08.8 D-17 (IN-03): `found` holds one entry per line, so an id written on two lines is listed with both and the fix names every one of them, highest line first: deleting them in that order never
 * shifts a number still to be deleted, and no copy of the id stays behind.
 */
export function baselineGap(found: readonly { id: string; why: 'test' | 'risk' | 'absent'; line: number }[], total: number): AuditGap | undefined {
  if (found.length === 0) return undefined;
  const byId = new Map<string, { why: 'test' | 'risk' | 'absent'; lines: number[] }>();
  for (const f of [...found].sort((a, b) => a.line - b.line)) {
    const entry = byId.get(f.id);
    if (entry === undefined) byId.set(f.id, { why: f.why, lines: [f.line] });
    else entry.lines.push(f.line);
  }
  const ids = [...byId.entries()];
  const listed = ids.slice(0, BASELINE_LISTED);
  const more = ids.length - listed.length;
  const at = (lines: readonly number[]): string => {
    const named = lines.map((n) => `line ${n}`);
    return named.length < 2 ? named.join('') : `${named.slice(0, -1).join(', ')} and ${named[named.length - 1]}`;
  };
  const items = listed.map(([id, e]) => `${id} (${at(e.lines)}: ${WHY[e.why]})`).join(', ');
  const bottomUp = listed.flatMap(([, e]) => e.lines).sort((a, b) => b - a);
  return {
    id: 'baseline-removable',
    text: `${ids.length} of ${total} ids in accord/tests-baseline.txt can be removed: ${items}${more > 0 ? `, (+${more} more)` : ''}`,
    fix: `delete lines ${bottomUp.join(', ')} of accord/tests-baseline.txt, from the bottom up, (the baseline only shrinks, so deleting is allowed)${more > 0 ? '; run accord audit again for the rest' : ''}`,
  };
}
