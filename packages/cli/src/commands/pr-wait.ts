// Phase 15 D-22, D-21: `accord pr wait <id>` follows a ticket's pull request with `gh` and runs no model. It asks on a rhythm and ends on the first of: merged, closed,
// new feedback from a collaborator, a failed check, or the time limit. It only reads: no ticket, record or ref is written (D-21), and nothing outlives the command (D-16).
// The sentence at the top of pr.ts, "it never calls gh" (Phase 8.1 D-03), binds `accord pr build`, the body builder; this is a separate command and is the one place that asks `gh`.
// Every line it prints is a row of the output grammar in 15-06-PLAN.md (P1 to P2 progress, F1 to F5 final with exit 0, U1 and U2 with exit 2): the last stdout line of a run is one final line.
import { execFileSync } from 'node:child_process';
import { headCommitDate, prWaitVerdict, SAFE_BRANCH } from '@accord-dev/accord-core';
import type { InlineComment, PrView, WaitVerdict } from '@accord-dev/accord-core';
import { UsageError } from '../load/fs.js';
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

  // start: who `gh` acts as (its own thread replies are not feedback), and the newest pull request of the branch; a failure of either is U1, since nothing can be followed
  let self: string;
  let found: { number: number; url: string };
  try {
    self = loginOnly(gh(ctx, ['api', 'user', '--jq', '.login']));
    const list = JSON.parse(gh(ctx, ['pr', 'list', '--head', branch, '--state', 'all', '--json', 'number,state,url', '--limit', '30'])) as { number: number; url?: string }[];
    const newest = list.filter((p) => Number.isInteger(p.number)).sort((a, b) => b.number - a.number)[0];
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
  let told = 0;
  const poll = (): WaitVerdict => {
    const view = { ...(JSON.parse(gh(ctx, ['pr', 'view', String(found.number), '--json', VIEW_FIELDS])) as PrView), number: found.number };
    // a merged or closed state needs nothing else, so a failing list of inline comments never hides it
    const inline = view.state === 'MERGED' || view.state === 'CLOSED' ? [] : inlineOf(gh(ctx, ['api', `repos/{owner}/{repo}/pulls/${found.number}/comments`, '--paginate', '--jq', INLINE_JQ]));
    const verdict = prWaitVerdict(view, inline, { since: headCommitDate(view), self });
    if ((verdict.kind === 'pending' || verdict.kind === 'feedback') && verdict.ignored > told) {
      told = verdict.ignored;
      ctx.stdout.write(`pr-wait: ignored ${told} from non-collaborators\n`);
    }
    return verdict;
  };
  const end = waitLoop({ poll, now: Date.now, sleep: sleepSync, everyMs: PR_WAIT_EVERY_MS, limitMs });
  ctx.stdout.write(finalLine(end, found.number) + '\n');
  return 0;
}
