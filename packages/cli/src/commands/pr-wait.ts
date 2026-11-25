// Phase 15 D-22, D-21: `accord pr wait <id>` follows a ticket's pull request with `gh` and runs no model. It asks on a rhythm and ends on the first of: merged, closed,
// new feedback from a collaborator, a failed check, or the time limit. It only reads: no ticket, record or ref is written (D-21), and nothing outlives the command (D-16).
// The sentence at the top of pr.ts, "it never calls gh" (Phase 8.1 D-03), binds `accord pr build`, the body builder; this is a separate command and is the one place that asks `gh`.
// Every line it prints is a row of the output grammar in 15-06-PLAN.md (P1 to P2 progress, F1 to F5 final with exit 0, U1 and U2 with exit 2): the last stdout line of a run is one final line.
import { execFileSync } from 'node:child_process';
import { baseMovable, headCommitDate, newestPr, prWaitVerdict, SAFE_BRANCH, workOf } from '@accord-dev/accord-core';
import type { InlineComment, PrRef, PrView, WaitVerdict } from '@accord-dev/accord-core';
import { gitDefaultRef, UsageError } from '../load/fs.js';
import { sliceBranch } from '../load/slices.js';
import type { CommandContext } from '../run.js';
import { branchOf, ID } from './worktree.js';

/** `gh` is asked this often: 120 minutes is 160 calls, far under the hourly limit of the API (Phase 15 research 3.3). */
export const PR_WAIT_EVERY_MS = 45_000;
export const PR_WAIT_DEFAULT_MINUTES = 120;
/** One `gh` call may run this long and print this much; a call over either is a failed poll. */
const GH_TIMEOUT_MS = 60_000;
const GH_MAX_BUFFER = 16 * 1024 * 1024;

/** A verdict that ends the wait. */
export type FinalVerdict = Exclude<WaitVerdict, { kind: 'pending' }>;

/** How a wait ended: by a verdict, or by the limit; `failed` counts the polls whose `gh` call failed or whose answer did not parse. */
export type WaitEnd = { kind: 'verdict'; verdict: FinalVerdict; failed: number } | { kind: 'limit'; failed: number; waitedMs: number };

export interface WaitDeps {
  /** One poll; a throw is a failed poll, counted and retried, and never read as merged or closed (T-15-14). */
  poll: () => WaitVerdict;
  now: () => number;
  sleep: (ms: number) => void;
  everyMs: number;
  limitMs: number;
}

/** Poll, sleep, poll again, until a verdict ends the wait or the limit passed. The first poll runs at once; a sleep never passes the limit. */
export function waitLoop(deps: WaitDeps): WaitEnd {
  const start = deps.now();
  let failed = 0;
  for (;;) {
    try {
      const verdict = deps.poll();
      if (verdict.kind !== 'pending') return { kind: 'verdict', verdict, failed };
    } catch {
      failed += 1;
    }
    const waitedMs = deps.now() - start;
    if (waitedMs >= deps.limitMs) return { kind: 'limit', failed, waitedMs };
    deps.sleep(Math.min(deps.everyMs, deps.limitMs - waitedMs));
  }
}

/** The final line of a run, row F1 to F5 of the grammar; `n` is the number of the pull request watched. Everything printed here is a count, a number, a login or a sanitised check name. */
export function finalLine(end: WaitEnd, n: number): string {
  if (end.kind === 'limit') return `pr-wait: limit #${n} after ${Math.round(end.waitedMs / 60_000)} minutes (${end.failed} polls failed)`;
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

/** The first line of what a failed `gh` said, with control characters dropped and at most 200 characters: it is text from outside and is printed as one line. */
function firstLine(err: unknown): string {
  const e = err as { stderr?: unknown; message?: unknown };
  const said = String(e.stderr ?? '').trim() !== '' ? String(e.stderr) : String(e.message ?? err);
  const line = (said.trim().split(/\r?\n/)[0] ?? '').replace(/[^\x20-\x7e]/g, '').trim();
  return (line === '' ? 'gh failed' : line).slice(0, 200);
}

/** Run `gh` by name with an argument array and no shell; the environment is the process's with the context's over it, and a prompt is never allowed. */
function gh(ctx: CommandContext, args: string[]): string {
  return execFileSync('gh', args, {
    cwd: ctx.root,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: GH_TIMEOUT_MS,
    maxBuffer: GH_MAX_BUFFER,
    env: { ...process.env, ...ctx.env, GH_PROMPT_DISABLED: '1', GH_NO_UPDATE_NOTIFIER: '1' },
  });
}

const VIEW_FIELDS = 'state,mergedAt,closedAt,reviewDecision,comments,reviews,statusCheckRollup,commits,number,url,headRefName,baseRefName';
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

/** The limit in milliseconds: `pr.wait_minutes` (schema: '1' to '120'), else 120 minutes. */
function limitOf(ctx: CommandContext): number {
  const minutes = Number(ctx.snapshot.config?.pr?.wait_minutes ?? PR_WAIT_DEFAULT_MINUTES);
  return (Number.isInteger(minutes) && minutes >= 1 && minutes <= 120 ? minutes : PR_WAIT_DEFAULT_MINUTES) * 60_000;
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
  // Phase 15 D-28: a ticket whose plan has two or more slices is followed slice by slice; any other ticket makes exactly the calls below and no slice lookup
  const slices = sliceCountOf(ctx, id);
  if (slices >= 2) return prWaitSliced(ctx, id, branch, slices);

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
    ctx.stdout.write(`pr-wait: unavailable: ${firstLine(err)}\n`);
    return 2;
  }

  const limitMs = limitOf(ctx);
  ctx.stdout.write(`pr-wait: watching #${found.number} ${found.url}, limit ${limitMs / 60_000} minutes\n`);
  const told = new Map<number, number>();
  const poll = (): WaitVerdict => judgePr(ctx, found.number, self, told);
  const end = waitLoop({ poll, now: Date.now, sleep: sleepSync, everyMs: PR_WAIT_EVERY_MS, limitMs });
  ctx.stdout.write(finalLine(end, found.number) + '\n');
  return 0;
}

/**
 * One look at pull request `n`: `gh pr view`, then the inline comments while it is open, then the verdict. `told` holds, for each pull request, how many non-collaborator items were already named
 * on an `ignored` line, so a count is printed when it grows and never twice.
 */
function judgePr(ctx: CommandContext, n: number, self: string, told: Map<number, number>): WaitVerdict {
  return judgeView(ctx, viewOf(ctx, n), self, told);
}

/** What `gh pr view --json` says of pull request `n`, with the number set: the part the verdict reads, and the base and head names the base move is judged by. */
type Seen = PrView & { baseRefName?: string; headRefName?: string };
function viewOf(ctx: CommandContext, n: number): Seen {
  return { ...(JSON.parse(gh(ctx, ['pr', 'view', String(n), '--json', VIEW_FIELDS])) as Seen), number: n };
}

function judgeView(ctx: CommandContext, view: Seen, self: string, told: Map<number, number>): WaitVerdict {
  const n = view.number as number;
  // a merged or closed state needs nothing else, so a failing list of inline comments never hides it
  const inline = view.state === 'MERGED' || view.state === 'CLOSED' ? [] : inlineOf(gh(ctx, ['api', `repos/{owner}/{repo}/pulls/${n}/comments`, '--paginate', '--jq', INLINE_JQ]));
  const verdict = prWaitVerdict(view, inline, { since: headCommitDate(view), self });
  if ((verdict.kind === 'pending' || verdict.kind === 'feedback') && verdict.ignored > (told.get(n) ?? 0)) {
    told.set(n, verdict.ignored);
    ctx.stdout.write(`pr-wait: ignored ${verdict.ignored} from non-collaborators\n`);
  }
  return verdict;
}

/** The number of the last slice of the ticket's plan, 0 when the plan has no `## Slice` section. */
function sliceCountOf(ctx: CommandContext, id: string): number {
  const slices = workOf(ctx.snapshot, id)?.plan?.slices;
  return slices === undefined || slices.length === 0 ? 0 : Math.max(...slices.map((s) => s.n));
}

/** One slice of a sliced ticket: its branch (slice 1 is the claim branch), its newest pull request once there is one, and whether that pull request merged. */
interface SliceWatch {
  k: number;
  branch: string;
  pr?: PrRef;
  merged: boolean;
}

/** The newest pull request whose head is `branch`, with the base and head names the base move is judged by. */
function newestOf(ctx: CommandContext, branch: string): PrRef | undefined {
  const list = JSON.parse(gh(ctx, ['pr', 'list', '--head', branch, '--state', 'all', '--json', 'number,state,baseRefName,headRefName,url', '--limit', '30'])) as PrRef[];
  return newestPr(list);
}

/** The default branch's name as the pull request base: origin's default ref (a full ref name) without its remote, and nothing when it is not a name this command passes to gh. */
function defaultBranch(ctx: CommandContext): string | undefined {
  const name = gitDefaultRef(ctx.root)?.replace(/^(?:refs\/remotes\/)?origin\//, '');
  return name !== undefined && SAFE_BRANCH.test(name) && !name.startsWith('-') ? name : undefined;
}

/**
 * Phase 15 D-28, D-08: the wait of a sliced ticket. The pull requests are the newest of each slice's branch (the claim branch for slice 1, `slice/<id>/<k>` for the others). The wait follows the lowest
 * slice whose pull request is not merged; when that one merges, the base of the next slice's pull request is moved to the default branch, and the wait goes on with it. It ends `merged` when the last
 * slice's pull request merged. One clock, the one limit, covers the whole wait. The one write this command makes is that base move (D-21 read otherwise): it never merges, closes or comments.
 */
function prWaitSliced(ctx: CommandContext, id: string, claimBranch: string, count: number): number {
  const watches: SliceWatch[] = [];
  let self: string;
  try {
    self = loginOnly(gh(ctx, ['api', 'user', '--jq', '.login']));
    for (let k = 1; k <= count; k++) {
      const branch = k === 1 ? claimBranch : sliceBranch(id, k);
      if (!SAFE_BRANCH.test(branch) || branch.startsWith('-')) throw new UsageError(`ticket ${id}: the branch ${branch} is not a name this command passes to gh`);
      const pr = newestOf(ctx, branch);
      if (k === 1 && pr === undefined) {
        ctx.stdout.write(`pr-wait: no pull request for ${branch}\n`);
        return 2;
      }
      watches.push({ k, branch, ...(pr === undefined ? {} : { pr }), merged: pr?.state === 'MERGED' });
    }
  } catch (err) {
    if (err instanceof UsageError) throw err;
    ctx.stdout.write(`pr-wait: unavailable: ${firstLine(err)}\n`);
    return 2;
  }

  const limitMs = limitOf(ctx);
  /** The slice the wait is on: the lowest whose pull request is not merged, else the last that has one. */
  const current = (): SliceWatch => watches.find((w) => w.pr !== undefined && !w.merged) ?? (watches.filter((w) => w.pr !== undefined).at(-1) as SliceWatch);
  const first = current();
  ctx.stdout.write(`pr-wait: watching #${(first.pr as PrRef).number} (slice ${first.k} of ${count}) ${String((first.pr as PrRef).url ?? '').replace(/[^\x21-\x7e]/g, '')}, limit ${limitMs / 60_000} minutes\n`);
  const told = new Map<number, number>();
  const moved = new Set<number>(); // the slices whose pull request had its base move tried: once each, so a refusal is not repeated every 45 seconds (Ruling R14)
  const pending: WaitVerdict = { kind: 'pending', ignored: 0 };
  /** Set when the wait cannot go on and is not one of the verdicts: the next slice has no pull request. Printed as row U2 after the loop (`halt.line`). */
  const halt: { line?: string } = {};

  const poll = (): WaitVerdict => {
    // every pull request not merged is looked at each round, lowest slice first: a later slice's feedback or failed check ends the wait as well (D-28)
    const open = watches.filter((w) => w.pr !== undefined && !w.merged);
    const seen = new Map<SliceWatch, { view: Seen; verdict: WaitVerdict }>();
    for (const w of open) {
      const view = viewOf(ctx, (w.pr as PrRef).number);
      seen.set(w, { view, verdict: judgeView(ctx, view, self, told) });
    }
    for (const [w, s] of seen) if (s.verdict.kind === 'merged') w.merged = true;

    // each merged slice's next pull request, still on the merged branch, goes to the default branch (D-08, T-15-38): judged on what `gh pr view` just said of it
    for (const w of watches) {
      const next = w.merged && w.k < count ? watches[w.k] : undefined; // slice k + 1
      const look = next === undefined ? undefined : seen.get(next);
      if (next === undefined || look === undefined || next.merged || moved.has(next.k)) continue;
      const nextPr: PrRef = { number: (next.pr as PrRef).number, state: look.view.state, baseRefName: look.view.baseRefName, headRefName: look.view.headRefName };
      const def = defaultBranch(ctx) ?? w.pr?.baseRefName;
      if (def === undefined || !SAFE_BRANCH.test(def) || def.startsWith('-') || !baseMovable(w.branch, next.branch, nextPr)) continue;
      moved.add(next.k);
      try {
        gh(ctx, ['pr', 'edit', String(nextPr.number), '--base', def]);
        ctx.stdout.write(`pr-wait: slice ${w.k} merged #${(w.pr as PrRef).number}, base of #${nextPr.number} moved to ${def}\n`);
      } catch (err) {
        ctx.stdout.write(`pr-wait: base of #${nextPr.number} not moved: ${firstLine(err)}\n`);
      }
    }

    // merged ends the wait only when every slice's pull request merged (D-28)
    const last = watches[count - 1];
    if (watches.every((w) => w.pr !== undefined && w.merged)) return { kind: 'merged', number: (last.pr as PrRef).number };
    for (const w of watches) {
      const verdict = seen.get(w)?.verdict;
      if (verdict !== undefined && verdict.kind !== 'pending' && verdict.kind !== 'merged') return verdict;
    }
    // no pull request left to watch but a slice has none yet: look once more for the ones opened meanwhile; a slice that still has none ends the wait
    if (!watches.some((w) => w.pr !== undefined && !w.merged)) {
      for (const w of watches) {
        if (w.pr !== undefined) continue;
        const pr = newestOf(ctx, w.branch);
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
    return 2;
  }
  ctx.stdout.write(finalLine(end, end.kind === 'verdict' ? end.verdict.number : (current().pr as PrRef).number) + '\n');
  return 0;
}
