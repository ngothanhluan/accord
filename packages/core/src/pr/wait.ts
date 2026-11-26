// Phase 15 D-22: the verdict of one poll of `accord pr wait`, judged over what `gh pr view --json` and the REST list of inline review comments returned. Pure: the host runs `gh` and
// prints; this reads JSON and imports no Node built-in module. The verdict holds counts, numbers, logins and sanitised check names and never a body of a comment or review
// (T-15-12): the text of a pull request is data from outside, and what is printed becomes the session's context.

interface Author {
  login?: string;
}

/** The part of `gh pr view --json state,mergedAt,reviewDecision,comments,reviews,statusCheckRollup,commits,number,...` the verdict reads. */
export interface PrView {
  number?: number;
  state?: string; // OPEN | CLOSED | MERGED
  mergedAt?: string | null;
  reviewDecision?: string | null; // APPROVED | CHANGES_REQUESTED | REVIEW_REQUIRED | ''
  comments?: { author?: Author; authorAssociation?: string; createdAt?: string }[];
  reviews?: { author?: Author; authorAssociation?: string; submittedAt?: string; state?: string }[];
  /** CheckRun entries carry `name` and `conclusion`; StatusContext entries carry `context` and `state`. */
  statusCheckRollup?: { name?: string; context?: string; conclusion?: string | null; state?: string | null }[];
  commits?: { committedDate?: string }[];
}

/** One inline review comment as the REST list gives it, cut to the fields read (the body is never asked for). */
export interface InlineComment {
  user?: Author;
  author_association?: string;
  created_at?: string;
  in_reply_to_id?: number | null;
}

/** `since`: the committed date of the head commit, after which an item is new ('' counts every item as new); `self`: the login `gh` acts as, whose own thread replies are not feedback. */
export interface WaitGate {
  since: string;
  self: string;
}

/** What one poll found. `pending` means nothing ends the wait yet; `ignored` counts the new items by authors who are not collaborators, which never start a fix (Ruling R4). */
export type WaitVerdict =
  | { kind: 'merged'; number: number }
  | { kind: 'closed'; number: number }
  | { kind: 'feedback'; number: number; comments: number; reviews: number; inline: number; logins: string[]; ignored: number }
  | { kind: 'ci-failed'; number: number; names: string[] }
  | { kind: 'pending'; ignored: number };

/** The associations whose items start a fix (Ruling R4, 999.23: only a repository collaborator's comment does). */
const TRUSTED = new Set(['OWNER', 'MEMBER', 'COLLABORATOR']);
const FAILED_CONCLUSIONS = new Set(['FAILURE', 'CANCELLED', 'TIMED_OUT', 'STARTUP_FAILURE', 'ACTION_REQUIRED']);
const FAILED_STATES = new Set(['FAILURE', 'ERROR']);

/** A check name as it is printed: only `[A-Za-z0-9 ._()/:-]`, at most 80 characters (a name is set by whoever can push a workflow). */
export function checkName(raw: string): string {
  const name = raw.replace(/[^A-Za-z0-9 ._()/:-]/g, '').trim().slice(0, 80).trim();
  return name === '' ? 'check' : name;
}

/** A login as it is printed: letters, digits and `-._[]` only, at most 50 characters. */
function loginOf(raw: string | undefined): string {
  return (raw ?? '').replace(/[^A-Za-z0-9._[\]-]/g, '').slice(0, 50);
}

/** The newest committed date among the commits, which is the head commit's: the list may hold only the first commits of a long pull request, so the newest is taken and not the last. */
export function headCommitDate(view: PrView): string {
  let best = '';
  let bestAt = Number.NEGATIVE_INFINITY;
  for (const c of view.commits ?? []) {
    const at = Date.parse(c.committedDate ?? '');
    if (!Number.isNaN(at) && at > bestAt) {
      bestAt = at;
      best = c.committedDate ?? '';
    }
  }
  return best;
}

/** One pull request as `gh pr list --json number,state,baseRefName,headRefName,url` gives it. */
export interface PrRef {
  number: number;
  state?: string; // OPEN | CLOSED | MERGED
  url?: string;
  baseRefName?: string;
  headRefName?: string;
}

/** The newest pull request (the highest number) of a list: a branch may have had older closed ones, and the newest is the one in play. Entries without a whole number are ignored. */
export function newestPr<T extends { number: number }>(list: readonly T[]): T | undefined {
  return list.filter((p) => Number.isInteger(p.number)).sort((a, b) => b.number - a.number)[0];
}

/**
 * Phase 15 D-08, T-15-38: may the base of `next` be moved to the default branch now that the slice on `mergedBranch` merged? Only when `next` is open, its head is `nextBranch` (the next slice's
 * branch of the same ticket, named by the caller) and its base is still `mergedBranch`. A pull request whose base the owner moved, GitHub retargeted, or that is another ticket's is never touched.
 */
export function baseMovable(mergedBranch: string, nextBranch: string, next: PrRef | undefined): next is PrRef {
  return next !== undefined && next.state === 'OPEN' && next.headRefName === nextBranch && next.baseRefName === mergedBranch;
}

/** The verdict of one poll. Order: merged, closed, feedback, a failed check, else pending; a merged pull request is reported before any pending or failing check. */
export function prWaitVerdict(view: PrView, inline: readonly InlineComment[], gate: WaitGate): WaitVerdict {
  const number = view.number ?? 0;
  if (view.state === 'MERGED') return { kind: 'merged', number };
  if (view.state === 'CLOSED') return view.mergedAt === null || view.mergedAt === undefined ? { kind: 'closed', number } : { kind: 'merged', number };

  const sinceAt = Date.parse(gate.since);
  const isNew = (at: string | undefined): boolean => {
    const t = Date.parse(at ?? '');
    return !Number.isNaN(t) && (Number.isNaN(sinceAt) || t > sinceAt);
  };
  const logins = new Set<string>();
  let ignored = 0;
  let comments = 0;
  let reviews = 0;
  let inlineCount = 0;
  const count = (association: string | undefined, login: string | undefined): boolean => {
    if (TRUSTED.has(association ?? '')) {
      logins.add(loginOf(login));
      return true;
    }
    ignored += 1;
    return false;
  };
  for (const c of view.comments ?? []) if (isNew(c.createdAt) && count(c.authorAssociation, c.author?.login)) comments += 1;
  // an approval holds nothing to resolve; a review that asks for something is COMMENTED or CHANGES_REQUESTED, and its inline comments are counted below
  for (const r of view.reviews ?? []) if (r.state !== 'APPROVED' && isNew(r.submittedAt) && count(r.authorAssociation, r.author?.login)) reviews += 1;
  for (const c of inline) {
    // the session acts as the `gh` user, and its own replies in a thread must not start the wait over
    if (c.in_reply_to_id !== null && c.in_reply_to_id !== undefined && gate.self !== '' && c.user?.login === gate.self) continue;
    if (isNew(c.created_at) && count(c.author_association, c.user?.login)) inlineCount += 1;
  }
  // A-CR-01: GitHub keeps reviewDecision CHANGES_REQUESTED until the reviewer approves or the review is dismissed, so the decision alone is not news; a request for changes counts through the
  // `reviews` loop above, and only when it was submitted after the head commit, as a comment does.
  if (comments + reviews + inlineCount > 0) {
    return { kind: 'feedback', number, comments, reviews, inline: inlineCount, logins: [...logins].filter((l) => l !== '').sort(), ignored };
  }

  const failed: string[] = [];
  for (const e of view.statusCheckRollup ?? []) {
    const bad = FAILED_CONCLUSIONS.has(e.conclusion ?? '') || FAILED_STATES.has(e.state ?? '');
    if (bad) failed.push(checkName(e.name ?? e.context ?? ''));
  }
  if (failed.length > 0) return { kind: 'ci-failed', number, names: [...new Set(failed)] };
  return { kind: 'pending', ignored };
}
