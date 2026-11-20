// Phase 8.2 group 3 (D-01..D-08): the facts and gaps about the work in a repository: claimed tickets that went quiet and drafts nobody touched, each naming the person. It reads git and files,
// writes nothing, fetches nothing and calls no model: the claim branches it judges are the ones already in this clone (local and origin-tracking), so the report is only as fresh as the last fetch.
// Group 3 loads the claims view itself, as `accord dashboard` does, inside a guard: `accord audit` keeps its checkout preflight, so a claim-view failure never stops the pin report or groups 1, 2 and 6.
import { execFileSync } from 'node:child_process';
import { draftAge, draftStaleGaps, isOpenWork, loadSnapshot, SAFE_BRANCH, SAFE_ID, statusRows, ticketIdleGaps } from '@accord-dev/accord-core';
import type { AuditFact, AuditGap, OldDraft } from '@accord-dev/accord-core';
import type { CommandContext } from '../run.js';
import { NOT_CHECKED } from './audit-health.js';
import { loadClaimView, withDefaultRef, withQueued } from './fs.js';
import { whoFor } from './who.js';

/** The fact that names the display mode: `email`, `initials`, or the unset-value form that says what git holds (Ruling "who setting"). */
function whoFact(mode: string, value: string | undefined): string {
  if (value === undefined || value === '' || value === 'email' || value === 'initials') return mode;
  return `${mode} (git config accord.who is "${value}", which is neither email nor initials)`;
}

/** The first non-empty line of an error, for a `not checked` fact. */
function firstLine(err: unknown): string {
  const text = err instanceof Error ? err.message : String(err);
  return text.split(/\r?\n/).map((l) => l.trim()).find((l) => l !== '') ?? 'unknown error';
}

/** One read-only git call: a literal argument array, no shell, no lazy fetch (a partial clone never goes to the network here), the 64 MiB buffer every log of this CLI carries. */
function git(root: string, args: string[]): string {
  return execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 64 * 1024 * 1024, env: { ...process.env, GIT_NO_LAZY_FETCH: '1' } });
}

/** The last non-empty line of `text`, trimmed (git log prints newest first, so the last line is the oldest commit); undefined when there is none. */
function lastLine(text: string): string | undefined {
  return text.split('\n').map((l) => l.trim()).filter((l) => l !== '').at(-1);
}

/**
 * Ruling "creator": a default-branch draft's creator is the author of the oldest commit that added its ticket file in HEAD's history (the queue commit for a draft queued and then merged);
 * a queued draft's creator is the author of its backlog branch tip, local first. The id and the branch are checked against the printable patterns before any argument is built (T-08.2-18).
 * Nothing read gives undefined, which the gap names `an unknown author`.
 */
function creatorOf(root: string, id: string, branch: string | undefined): string | undefined {
  try {
    if (branch === undefined) {
      if (!SAFE_ID.test(id)) return undefined;
      return lastLine(git(root, ['-c', 'log.showSignature=false', 'log', '--no-show-signature', '--no-renames', '--diff-filter=A', '--format=%ae', '--', `:(literal)accord/tickets/${id}.md`]));
    }
    if (!SAFE_BRANCH.test(branch)) return undefined;
    for (const ref of [`refs/heads/${branch}`, `refs/remotes/origin/${branch}`]) {
      try {
        const email = lastLine(git(root, ['-c', 'log.showSignature=false', 'log', '--no-show-signature', '-1', '--format=%ae', ref]));
        if (email !== undefined) return email;
      } catch {
        // this ref does not exist here: try the next
      }
    }
  } catch {
    // a failed read is an unknown author, never a failed audit
  }
  return undefined;
}

/** The age of a queued draft whose branch name holds no date: whole days since its tip's committer time; undefined when the tip cannot be read. */
function tipAge(root: string, branch: string, now: number): number | undefined {
  if (!SAFE_BRANCH.test(branch)) return undefined;
  for (const ref of [`refs/heads/${branch}`, `refs/remotes/origin/${branch}`]) {
    try {
      const time = Number(lastLine(git(root, ['-c', 'log.showSignature=false', 'log', '--no-show-signature', '-1', '--format=%ct', ref])));
      if (Number.isFinite(time) && time > 0) return Math.floor((now - time) / 86400);
    } catch {
      // this ref does not exist here: try the next
    }
  }
  return undefined;
}

/** The group 3 facts and gaps (Rulings "group 3 facts, G1", "gap wording"). Every string goes through audit.ts's `fact()` and `gap()` closures, which make it printable. */
export async function auditHygiene(ctx: CommandContext): Promise<{ facts: AuditFact[]; gaps: AuditGap[] }> {
  const facts: AuditFact[] = [];
  const gaps: AuditGap[] = [];
  const config = ctx.snapshot.config;
  const who = whoFor(ctx.root, config);
  facts.push({ name: 'who', value: whoFact(who.mode, who.value) });
  // never a clean result for a check that did not run
  if (config === undefined) {
    facts.push({ name: 'work-ages', value: `not checked (${NOT_CHECKED})` });
    return { facts, gaps };
  }
  const staleDays = config.stale_days ?? '14';
  const staleDraftDays = config.stale_draft_days ?? '90';
  try {
    const now = Math.floor(Date.now() / 1000);
    const parts = loadClaimView(ctx.root);
    const loaded = loadSnapshot(parts.view);
    const plain = parts.checkout === parts.view ? loaded : loadSnapshot(parts.checkout);
    const view = withQueued(ctx.root, withDefaultRef(ctx.root, loaded, parts.refs));
    const open = statusRows(view, now, plain).filter(isOpenWork(view));
    facts.push({
      name: 'work-ages',
      value: `claimed tickets idle over ${staleDays} days (stale_days) and unclaimed tickets untouched over ${staleDraftDays} days (stale_draft_days), from the branches already in this clone`,
    });
    gaps.push(...ticketIdleGaps(open, staleDays, who.show));

    // D-02: an unclaimed, unfinished ticket is a draft; the creator is read only for the ones already past the threshold
    const old: OldDraft[] = [];
    for (const r of open.filter((x) => x.claimedBy === undefined)) {
      const branch = view.queued !== undefined && Object.hasOwn(view.queued, r.id) ? view.queued[r.id].branch : undefined;
      const days = draftAge(view, r.id, now) ?? (branch === undefined ? undefined : tipAge(ctx.root, branch, now));
      if (days === undefined || days <= Number(staleDraftDays)) continue;
      old.push({ id: r.id, days, creator: creatorOf(ctx.root, r.id, branch), ...(branch === undefined ? {} : { queued: branch }) });
    }
    gaps.push(...draftStaleGaps(old, staleDraftDays, who.show));
  } catch (err) {
    facts.push({ name: 'work-ages', value: `not checked (the claim branches could not be read: ${firstLine(err)})` });
    gaps.length = 0; // a failed read leaves no half result: no gap is printed for a check that did not finish
  }
  return { facts, gaps };
}
