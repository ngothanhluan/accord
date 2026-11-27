// Phase 15 D-22, D-21: `accord pr wait <id>` follows a ticket's pull request with `gh` and runs no model. It asks on a rhythm and ends on the first of: merged, closed,
// new feedback from a collaborator, a failed check, or the time limit. It only reads: no ticket, record or ref is written (D-21), and nothing outlives the command (D-16).
// The sentence at the top of pr.ts, "it never calls gh" (Phase 8.1 D-03), binds `accord pr build`, the body builder; this is a separate command and is the one place that asks `gh`.
// Every line it prints is a row of the output grammar in 15-06-PLAN.md (P1 to P2 progress, F1 to F5 final with exit 0, U1 and U2 with exit 2): the last stdout line of a run is one final line.
import { baseMovable, headCommitDate, newestPr, prWaitVerdict, SAFE_BRANCH, workOf } from '@accord-dev/accord-core';
import type { InlineComment, PrRef, PrView, WaitVerdict } from '@accord-dev/accord-core';
import { gitDefaultRef, UsageError } from '../load/fs.js';
import { ghFirstLine, ghRepoOf, ghRun } from '../load/gh.js';
import { resolveRepo } from '../load/repos.js';
import { sliceHomeOf } from '../load/slice-size.js';
import type { CommandContext } from '../run.js';
import { branchOf, ID } from './worktree.js';

/** `gh` is asked this often: 120 minutes is 160 calls, far under the hourly limit of the API (Phase 15 research 3.3). */
export const PR_WAIT_EVERY_MS = 45_000;
export const PR_WAIT_DEFAULT_MINUTES = 120;
/**
 * A-Info: Claude Code stops a background command after 120 minutes at most, and the skill gives the run a timeout of the limit plus one minute, capped there. A limit of 120 minutes would end at the
 * very moment the host stops the run, and the final `limit` line could be lost; the command therefore ends 2 minutes before that stop at the latest (an in-flight poll of a slow `gh` included).
 */
export const PR_WAIT_HOST_STOP_MINUTES = 120;
export const PR_WAIT_MARGIN_MINUTES = 2;
/** A-WR-03: this many polls in a row that fail end the wait as unavailable (about four minutes), where `gh` was logged out or its token revoked mid-wait; the run does not sit out the limit. */
export const PR_WAIT_FAIL_STREAK = 5;
/** A verdict that ends the wait. */
export type FinalVerdict = Exclude<WaitVerdict, { kind: 'pending' }>;

/**
 * How a wait ended: by a verdict, by the limit, or by `unreadable` (a run of failed polls, with the first line of the last failure); `failed` counts the polls whose `gh` call failed or whose
 * answer did not parse.
 */
export type WaitEnd =
  | { kind: 'verdict'; verdict: FinalVerdict; failed: number }
  | { kind: 'limit'; failed: number; waitedMs: number }
  | { kind: 'unreadable'; failed: number; streak: number; last: string };

export interface WaitDeps {
  /** One poll; a throw is a failed poll, counted and retried, and never read as merged or closed (T-15-14). */
  poll: () => WaitVerdict;
  now: () => number;
  sleep: (ms: number) => void;
  everyMs: number;
  limitMs: number;
  /** Polls in a row that may fail before the wait ends as `unreadable`; absent means PR_WAIT_FAIL_STREAK. */
  failStreak?: number;
}

/** Poll, sleep, poll again, until a verdict ends the wait, the limit passed or too many polls in a row failed. The first poll runs at once; a sleep never passes the limit. */
export function waitLoop(deps: WaitDeps): WaitEnd {
  const start = deps.now();
  const maxStreak = deps.failStreak ?? PR_WAIT_FAIL_STREAK;
  let failed = 0;
  let streak = 0;
  for (;;) {
    try {
      const verdict = deps.poll();
      streak = 0; // a poll that answered, quiet or not, ends a run of failures
      if (verdict.kind !== 'pending') return { kind: 'verdict', verdict, failed };
    } catch (err) {
      failed += 1;
      streak += 1;
      if (streak >= maxStreak) return { kind: 'unreadable', failed, streak, last: ghFirstLine(err) };
    }
    const waitedMs = deps.now() - start;
    if (waitedMs >= deps.limitMs) return { kind: 'limit', failed, waitedMs };
    deps.sleep(Math.min(deps.everyMs, deps.limitMs - waitedMs));
  }
}

/** The final line of a run, row F1 to F5 of the grammar; `n` is the number of the pull request watched. Everything printed here is a count, a number, a login or a sanitised check name. */
export function finalLine(end: WaitEnd, n: number): string {
  if (end.kind === 'limit') return `pr-wait: limit #${n} after ${Math.round(end.waitedMs / 60_000)} minutes (${end.failed} polls failed)`;
  // row U1 reached after the wait had started: `gh` stopped answering (logged out, token revoked, offline); the skill reads it as unavailable, and nothing watches the pull request any more
  if (end.kind === 'unreadable') return `pr-wait: unavailable: ${end.streak} polls in a row failed (last: ${end.last}); check gh auth status and gh --version`;
  const v = end.verdict;
  switch (v.kind) {
    case 'merged':
      return `pr-wait: merged #${n}`;
    case 'closed':
      return `pr-wait: closed #${n}`;
    case 'feedback':
      return `pr-wait: feedback #${n}: ${v.comments} comments, ${v.reviews} reviews, ${v.inline} inline from ${v.logins.length === 0 ? 'reviewers' : v.logins.join(', ')}`;
    case 'ci-failed':
      return `pr-wait: ci-failed #${n}: ${v.names.join(', ')}`;
  }
}

/**
 * Run `gh` by name with an argument array and no shell (`ghRun` of load/gh.ts, Phase 08.9.3 R17): from this checkout, prompt-free, and aimed at another repository only with `repo` (its `<owner>/<repo>`, set as
 * `GH_REPO` from the declared remote); without it `gh` reads this repository, as it always did.
 */
function gh(ctx: CommandContext, args: string[], repo?: string): string {
  return ghRun(ctx.root, args, ctx.env, repo);
}

const VIEW_FIELDS = 'state,isDraft,mergedAt,closedAt,reviewDecision,comments,reviews,statusCheckRollup,commits,number,url,headRefName,baseRefName';
/** The inline review comments of a pull request, cut at the source to the fields the verdict reads: the text of a comment is never fetched. `{owner}` and `{repo}` are filled by `gh` from the repository it runs in. */
const INLINE_JQ = '.[] | {user: {login: .user.login}, author_association: .author_association, created_at: .created_at, in_reply_to_id: .in_reply_to_id}';

/** The login `gh api user --jq .login` printed: one line of letters, digits and -._[] only; anything else is a failed read. */
function loginOnly(text: string): string {
  const login = text.trim();
  if (!/^[A-Za-z0-9._[\]-]{1,50}$/.test(login)) throw new Error('gh printed no login');
  return login;
}

/** A synchronous sleep: the commands of the CLI are synchronous and nothing here needs a signal handler. */
function sleepSync(ms: number): void {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

/** The limit in milliseconds: `pr.wait_minutes` (schema: '1' to '120'), else 120 minutes, and never more than the host's stop less the margin (A-Info), so the last line is printed before the host stops the run. */
function limitOf(ctx: CommandContext): number {
  const minutes = Number(ctx.snapshot.config?.pr?.wait_minutes ?? PR_WAIT_DEFAULT_MINUTES);
  const set = Number.isInteger(minutes) && minutes >= 1 && minutes <= 120 ? minutes : PR_WAIT_DEFAULT_MINUTES;
  return Math.min(set, PR_WAIT_HOST_STOP_MINUTES - PR_WAIT_MARGIN_MINUTES) * 60_000;
}

/** The JSON lines `gh api --paginate --jq` printed, one object per line. A line that does not parse makes the poll fail: a half-read list is never taken for a quiet one. */
function inlineOf(text: string): InlineComment[] {
  return text
    .split('\n')
    .filter((l) => l.trim() !== '')
    .map((l) => JSON.parse(l) as InlineComment);
}

/**
 * Follow the pull request of ticket `id` until it ends. Exit 0 with one final line F1 to F5; exit 2 with U1 when `gh` is missing or not logged in, U2 when no pull request has the
 * ticket's branch as its head, and a usage error for an id that is not one. It reads the pull request and writes nothing (D-21).
 */
export function prWait(ctx: CommandContext, id: string): number {
  if (!ID.test(id)) throw new UsageError('not a valid ticket id: ' + id);
  const branch = branchOf(ctx.snapshot, id);
  if (!SAFE_BRANCH.test(branch) || branch.startsWith('-')) throw new UsageError(`ticket ${id}: the branch ${branch} is not a name this command passes to gh`);
  // Phase 15 D-28: a ticket whose plan has two or more slices is followed slice by slice; any other ticket makes exactly the calls below and no slice lookup.
  // Phase 08.9.3: a plan with a slice in another repository is followed slice by slice as well, whatever the number of slices.
  const numbers = sliceNumbersOf(ctx, id);
  const elsewhere = (workOf(ctx.snapshot, id)?.plan?.slices ?? []).some((s) => s.repo !== undefined);
  if (numbers.length >= 2 || (numbers.length === 1 && elsewhere)) return prWaitSliced(ctx, id, branch, numbers);

  // start: who `gh` acts as (its own thread replies are not feedback), and the newest pull request of the branch; a failure of either is U1, since nothing can be followed
  let self: string;
  let found: { number: number; url: string };
  try {
    self = loginOnly(gh(ctx, ['api', 'user', '--jq', '.login']));
    const list = JSON.parse(gh(ctx, ['pr', 'list', '--head', branch, '--state', 'all', '--json', 'number,state,url', '--limit', '30'])) as { number: number; url?: string }[];
    const newest = newestPr(list);
    if (newest === undefined) {
      ctx.stdout.write(`pr-wait: no pull request for ${branch}\n`);
      return 2;
    }
    found = { number: newest.number, url: String(newest.url ?? '').replace(/[^\x21-\x7e]/g, '') };
  } catch (err) {
    ctx.stdout.write(`pr-wait: unavailable: ${ghFirstLine(err)}\n`);
    return 2;
  }

  const limitMs = limitOf(ctx);
  ctx.stdout.write(`pr-wait: watching #${found.number} ${found.url}, limit ${limitMs / 60_000} minutes\n`);
  const told = new Map<string, number>();
  const poll = (): WaitVerdict => judgePr(ctx, found.number, self, told);
  const end = waitLoop({ poll, now: Date.now, sleep: sleepSync, everyMs: PR_WAIT_EVERY_MS, limitMs });
  ctx.stdout.write(finalLine(end, found.number) + '\n');
  return end.kind === 'unreadable' ? 2 : 0;
}

/**
 * One look at pull request `n`: `gh pr view`, then the inline comments while it is open, then the verdict. `told` holds, for each pull request, how many non-collaborator items were already named
 * on an `ignored` line, so a count is printed when it grows and never twice.
 */
function judgePr(ctx: CommandContext, n: number, self: string, told: Map<string, number>): WaitVerdict {
  return judgeView(ctx, viewOf(ctx, n), self, told);
}

/**
 * What `gh pr view --json` says of pull request `n`, with the number set: the part the verdict reads, and the base and head names the base move is judged by. `repo` is the `<owner>/<repo>` of another
 * repository (Phase 08.9.3 R17); the draft flag is what the released end of a held slice reads (R18).
 */
type Seen = PrView & { baseRefName?: string; headRefName?: string; isDraft?: boolean };
function viewOf(ctx: CommandContext, n: number, repo?: string): Seen {
  return { ...(JSON.parse(gh(ctx, ['pr', 'view', String(n), '--json', VIEW_FIELDS], repo)) as Seen), number: n };
}

function judgeView(ctx: CommandContext, view: Seen, self: string, told: Map<string, number>, repo?: string): WaitVerdict {
  const n = view.number as number;
  // a merged or closed state needs nothing else, so a failing list of inline comments never hides it
  const inline = view.state === 'MERGED' || view.state === 'CLOSED' ? [] : inlineOf(gh(ctx, ['api', `repos/{owner}/{repo}/pulls/${n}/comments`, '--paginate', '--jq', INLINE_JQ], repo));
  const verdict = prWaitVerdict(view, inline, { since: headCommitDate(view), self });
  // a count of ignored items is kept per pull request; the same number in two repositories is two pull requests
  const key = `${repo ?? ''}#${n}`;
  if ((verdict.kind === 'pending' || verdict.kind === 'feedback') && verdict.ignored > (told.get(key) ?? 0)) {
    told.set(key, verdict.ignored);
    ctx.stdout.write(`pr-wait: ignored ${verdict.ignored} from non-collaborators\n`);
  }
  return verdict;
}

/** The slice numbers of the ticket's plan, ascending: empty when the plan has no `## Slice` section. */
function sliceNumbersOf(ctx: CommandContext, id: string): number[] {
  const slices = workOf(ctx.snapshot, id)?.plan?.slices ?? [];
  return [...new Set(slices.map((s) => s.n))].sort((a, b) => a - b);
}

/** One slice of a sliced ticket: where it lives (`sliceHome`, Phase 08.9.3 D-14), its newest pull request once there is one, and whether that pull request merged. */
interface SliceWatch {
  k: number;
  branch: string;
  /** The declared name of another repository's clone; absent for this repository. */
  repo?: string;
  /** The `<owner>/<repo>` `gh` is aimed at for this slice's pull request, from the declared remote; absent for this repository (Ruling R17). */
  ghRepo?: string;
  /** The previous slice of the SAME repository, the one this slice's pull request is stacked on; absent for the first slice of a repository. */
  previousN?: number;
  pr?: PrRef & { isDraft?: boolean };
  merged: boolean;
  /** The base the pull request had when it was seen merged (C-WR-02): the base move below is made only after a merge into the default branch. */
  mergedBase?: string;
}

/**
 * The newest pull request whose head is the slice's branch, with the base and head names the base move is judged by. In another repository only entries with a whole positive number are kept: nothing else of
 * that repository's answer is read (T-08.9.3-29).
 */
function newestOf(ctx: CommandContext, w: Pick<SliceWatch, 'branch' | 'ghRepo'>): (PrRef & { isDraft?: boolean }) | undefined {
  const list = JSON.parse(gh(ctx, ['pr', 'list', '--head', w.branch, '--state', 'all', '--json', 'number,state,isDraft,baseRefName,headRefName,url', '--limit', '30'], w.ghRepo)) as (PrRef & { isDraft?: boolean })[];
  return newestPr(w.ghRepo === undefined ? list : list.filter((p) => Number.isSafeInteger(p.number) && p.number > 0));
}

/** The pull request link told on the `watching` line: the one `gh` gave for this repository (control characters out), and for another repository one built from its validated `<owner>/<repo>` and the number. */
function linkOf(w: SliceWatch, pr: PrRef): string {
  return w.ghRepo === undefined ? String(pr.url ?? '').replace(/[^\x21-\x7e]/g, '') : `https://github.com/${w.ghRepo}/pull/${pr.number}`;
}

/**
 * The default branch's name as the pull request base: origin's default ref (a full ref name) without its remote, and nothing when it is not a name this command passes to gh. For a slice of another repository
 * it is read in that repository's STORED clone (nothing is searched or stored here); a clone that is not there, or is refused, gives nothing.
 */
function defaultBranch(ctx: CommandContext, repo?: string): string | undefined {
  let dir = ctx.root;
  if (repo !== undefined) {
    const found = resolveRepo(ctx.root, ctx.snapshot.config, repo, { scan: false, store: false });
    if ('refused' in found) return undefined;
    dir = found.path;
  }
  const name = gitDefaultRef(dir)?.replace(/^(?:refs\/remotes\/)?origin\//, '');
  return name !== undefined && SAFE_BRANCH.test(name) && !name.startsWith('-') ? name : undefined;
}

/**
 * Phase 15 D-28, D-08 and Phase 08.9.3 D-08, D-13: the wait of a sliced ticket, slice by slice in deploy order across repositories. Each slice's branch and repository come from `sliceHome` (the claim branch for the first
 * slice of this repository, `slice/<id>/<k>` for the others); a slice of another repository is read with `gh` aimed at it by `GH_REPO` (Ruling R17). The wait follows the lowest slice whose pull request is not merged;
 * when that one merges, the base of the next slice of the SAME repository, stacked on it, is moved to that repository's default branch (never across repositories, T-08.9.3-31), and the wait goes on with it. It ends
 * `merged` when every slice's pull request merged, and `released` (Ruling R18) when every slice below a held slice merged and the held slice is in another repository than the one before it with its pull request
 * missing or draft: the verify skill then writes the held slice's block. One clock, the one limit, covers the whole wait. The one write this command makes is the base move (D-21 read otherwise): it never merges, closes or comments.
 */
function prWaitSliced(ctx: CommandContext, id: string, claimBranch: string, numbers: number[]): number {
  const watches: SliceWatch[] = [];
  const count = numbers[numbers.length - 1];
  let self: string;
  try {
    self = loginOnly(gh(ctx, ['api', 'user', '--jq', '.login']));
    for (const k of numbers) {
      const home = sliceHomeOf(ctx.snapshot, id, k, claimBranch);
      if (home === undefined) throw new UsageError(`ticket ${id}: slice ${k} names no branch this command passes to gh`);
      const branch = home.branch;
      if (!SAFE_BRANCH.test(branch) || branch.startsWith('-')) throw new UsageError(`ticket ${id}: the branch ${branch} is not a name this command passes to gh`);
      let ghRepo: string | undefined;
      if (home.repo !== undefined) {
        const repos = ctx.snapshot.config?.repos;
        ghRepo = repos !== undefined && Object.hasOwn(repos, home.repo) ? ghRepoOf(repos[home.repo].remote) : undefined;
        if (ghRepo === undefined) {
          ctx.stdout.write(`pr-wait: unavailable: ${home.repo}'s remote is not a github.com repository\n`);
          return 2;
        }
      }
      const w: SliceWatch = { k, branch, ...(home.repo === undefined ? {} : { repo: home.repo }), ...(ghRepo === undefined ? {} : { ghRepo }), ...(home.previous === undefined ? {} : { previousN: home.previous.n }), merged: false };
      const pr = newestOf(ctx, w);
      if (watches.length === 0 && pr === undefined) {
        ctx.stdout.write(`pr-wait: no pull request for ${branch}\n`);
        return 2;
      }
      if (pr !== undefined) {
        w.pr = pr;
        w.merged = pr.state === 'MERGED';
      }
      watches.push(w);
    }
  } catch (err) {
    if (err instanceof UsageError) throw err;
    ctx.stdout.write(`pr-wait: unavailable: ${ghFirstLine(err)}\n`);
    return 2;
  }

  const limitMs = limitOf(ctx);
  /** The slice the wait is on: the lowest whose pull request is not merged, else the last that has one. */
  const current = (): SliceWatch => watches.find((w) => w.pr !== undefined && !w.merged) ?? (watches.filter((w) => w.pr !== undefined).at(-1) as SliceWatch);
  const first = current();
  ctx.stdout.write(`pr-wait: watching #${(first.pr as PrRef).number} (slice ${first.k} of ${count}) ${linkOf(first, first.pr as PrRef)}, limit ${limitMs / 60_000} minutes\n`);
  const told = new Map<string, number>();
  const moved = new Set<number>(); // the slices whose pull request had its base move tried: once each, so a refusal is not repeated every 45 seconds (Ruling R14)
  const pending: WaitVerdict = { kind: 'pending', ignored: 0 };
  /** Set when the wait cannot go on and is not one of the verdicts: the next slice has no pull request (row U2, exit 2), or a held slice is released (R18, exit 0). Printed after the loop. */
  const halt: { line?: string; code?: number } = {};

  const poll = (): WaitVerdict => {
    // C-WR-03, D-28: a slice that has no pull request yet is looked up every round, so one opened while an earlier slice is still open is watched from the next poll on
    for (const w of watches) {
      if (w.pr !== undefined) continue;
      const pr = newestOf(ctx, w);
      if (pr !== undefined) {
        w.pr = pr;
        w.merged = pr.state === 'MERGED';
      }
    }
    // every pull request not merged is looked at each round, lowest slice first: a later slice's feedback or failed check ends the wait as well (D-28)
    const open = watches.filter((w) => w.pr !== undefined && !w.merged);
    const seen = new Map<SliceWatch, { view: Seen; verdict: WaitVerdict }>();
    for (const w of open) {
      const view = viewOf(ctx, (w.pr as PrRef).number, w.ghRepo);
      seen.set(w, { view, verdict: judgeView(ctx, view, self, told, w.ghRepo) });
    }
    for (const [w, s] of seen) {
      if (s.verdict.kind !== 'merged') continue;
      w.merged = true;
      if (s.view.baseRefName !== undefined) w.mergedBase = s.view.baseRefName;
    }

    // each merged slice's next pull request of the same repository, still on the merged branch, goes to that repository's default branch (D-08, T-15-38): judged on what `gh pr view` just said of it.
    // A slice of another repository is never the next one: its base is that repository's own (T-08.9.3-31).
    for (const w of watches) {
      const next = w.merged ? watches.find((x) => x.previousN === w.k && x.repo === w.repo) : undefined;
      const look = next === undefined ? undefined : seen.get(next);
      if (next === undefined || look === undefined || next.merged || moved.has(next.k)) continue;
      const nextPr: PrRef = { number: (next.pr as PrRef).number, state: look.view.state, baseRefName: look.view.baseRefName, headRefName: look.view.headRefName };
      if (!baseMovable(w.branch, next.branch, nextPr)) continue;
      // C-WR-02, D-08: the next slice goes to the default branch only after the slice before it merged into the default branch. A slice merged into another branch (an earlier slice's, say) does not
      // move it, and the merged slice's own base is never taken for the default branch.
      const def = defaultBranch(ctx, w.repo);
      const mergedInto = w.mergedBase ?? w.pr?.baseRefName;
      const why = def === undefined ? 'the default branch of the clone is not known' : mergedInto === def ? undefined : `#${(w.pr as PrRef).number} merged into ${mergedInto !== undefined && SAFE_BRANCH.test(mergedInto) ? mergedInto : 'another branch'}, not ${def}`;
      if (def === undefined || why !== undefined) {
        moved.add(next.k); // said once, not at every poll
        ctx.stdout.write(`pr-wait: base of #${nextPr.number} not moved: ${why}\n`);
        continue;
      }
      moved.add(next.k);
      try {
        gh(ctx, ['pr', 'edit', String(nextPr.number), '--base', def], next.ghRepo);
        ctx.stdout.write(`pr-wait: slice ${w.k} merged #${(w.pr as PrRef).number}, base of #${nextPr.number} moved to ${def}\n`);
      } catch (err) {
        ctx.stdout.write(`pr-wait: base of #${nextPr.number} not moved: ${ghFirstLine(err)}\n`);
      }
    }

    // merged ends the wait only when every slice's pull request merged (D-28)
    const last = watches[watches.length - 1];
    if (watches.every((w) => w.pr !== undefined && w.merged)) return { kind: 'merged', number: (last.pr as PrRef).number };

    // D-08, D-13, Ruling R18: every slice below the lowest unmerged slice merged, and that slice is in another repository than the one before it, with its pull request missing or still a draft: it is free, and
    // the wait ends so the verify skill writes its block after the earlier slice merged (a draft cannot merge until verify finishes, so waiting on it would never end)
    const held = watches.findIndex((w) => !w.merged);
    if (held > 0 && watches[held].repo !== watches[held - 1].repo) {
      const w = watches[held];
      const state = seen.get(w)?.view.state ?? w.pr?.state;
      const draft = w.pr === undefined || (state === 'OPEN' && (seen.get(w)?.view.isDraft ?? w.pr.isDraft) === true);
      if (draft) {
        const before = watches[held - 1];
        halt.line = `pr-wait: released slice ${w.k}: slice ${before.k} (${before.repo ?? 'this repository'}) merged #${(before.pr as PrRef).number}`;
        halt.code = 0;
        return { kind: 'closed', number: 0 };
      }
    }

    for (const w of watches) {
      const verdict = seen.get(w)?.verdict;
      if (verdict !== undefined && verdict.kind !== 'pending' && verdict.kind !== 'merged') return verdict;
    }
    // no pull request left to watch but a slice has none: look once more, since one may have been opened while this round ran; a slice that still has none ends the wait naming it
    if (!watches.some((w) => w.pr !== undefined && !w.merged)) {
      for (const w of watches) {
        if (w.pr !== undefined) continue;
        const pr = newestOf(ctx, w);
        if (pr !== undefined) {
          w.pr = pr;
          w.merged = pr.state === 'MERGED';
        }
      }
      const missing = watches.find((w) => w.pr === undefined);
      if (missing !== undefined && !watches.some((w) => w.pr !== undefined && !w.merged)) {
        halt.line = `pr-wait: no pull request for ${missing.branch}`;
        return { kind: 'closed', number: 0 };
      }
    }
    return pending;
  };
  const end = waitLoop({ poll, now: Date.now, sleep: sleepSync, everyMs: PR_WAIT_EVERY_MS, limitMs });
  if (halt.line !== undefined) {
    ctx.stdout.write(halt.line + '\n');
    return halt.code ?? 2;
  }
  ctx.stdout.write(finalLine(end, end.kind === 'verdict' ? end.verdict.number : (current().pr as PrRef).number) + '\n');
  return end.kind === 'unreadable' ? 2 : 0;
}
