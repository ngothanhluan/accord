// Phase 8.2 group 3 (D-01..D-08): the facts and gaps about the work in a repository: claimed tickets that went quiet and drafts nobody touched, each naming the person. It reads git and files,
// writes nothing, fetches nothing and calls no model: the claim branches it judges are the ones already in this clone (local and origin-tracking), so the report is only as fresh as the last fetch.
// Group 3 loads the claims view itself, as `accord dashboard` does, inside a guard: `accord audit` keeps its checkout preflight, so a claim-view failure never stops the pin report or groups 1, 2 and 6.
import { execFileSync } from 'node:child_process';
import { Writable } from 'node:stream';
import { branchGaps, draftAge, draftStaleGaps, isOpenWork, leftoverGaps, loadSnapshot, SAFE_BRANCH, SAFE_ID, statusRows, ticketIdleGaps } from '@accord-dev/accord-core';
import type { AuditFact, AuditGap, ClaimRefFact, OldDraft } from '@accord-dev/accord-core';
import { norm } from '../commands/leftover.js';
import { worktreeClean } from '../commands/worktree.js';
import type { CommandContext } from '../run.js';
import { NOT_CHECKED } from './audit-health.js';
import { doneRef, gitDefaultRef, loadClaimView, ticketOfBranch, withDefaultRef, withQueued } from './fs.js';
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

const SHA = /^[0-9a-f]{7,64}$/;
const NEXT = ' - next: ';

/** The author email of commit `sha`; undefined for a text that is no sha, a commit git cannot find, or no author. The sha is checked before any argument is built. */
function authorOfSha(root: string, sha: string): string | undefined {
  if (!SHA.test(sha)) return undefined;
  try {
    const email = lastLine(git(root, ['-c', 'log.showSignature=false', 'log', '--no-show-signature', '-1', '--format=%ae', sha, '--']));
    return email === undefined || email === '' ? undefined : email;
  } catch {
    return undefined;
  }
}

/** The HEAD sha of each worktree of this repository by `norm`ed path, read once (`git worktree list --porcelain`); empty when git cannot say. */
function worktreeHeads(root: string): Map<string, string> {
  const heads = new Map<string, string>();
  try {
    for (const entry of git(root, ['worktree', 'list', '--porcelain']).split(/\r?\n\r?\n/)) {
      const path = /^worktree (.+)$/m.exec(entry)?.[1];
      const head = /^HEAD ([0-9a-f]+)$/m.exec(entry)?.[1];
      if (path !== undefined && head !== undefined) heads.set(norm(path.trim()), head);
    }
  } catch {
    // no worktree list: a removed line then names nobody
  }
  return heads;
}

/** True when the git call succeeds (`cat-file -e`, `remote get-url`); its output is not needed. */
function gitOk(root: string, args: string[]): boolean {
  try {
    git(root, args);
    return true;
  } catch {
    return false;
  }
}

/** The ref's name without `refs/heads/` or `refs/remotes/`, for the text a person reads. */
function shortRef(ref: string): string {
  return ref.replace(/^refs\/heads\//, '').replace(/^refs\/remotes\//, '');
}

/**
 * D-03: the lines an offline dry clean prints (it fetches nothing and reports no prune of remote refs), as the lines a real clean would print for the refs already in this clone.
 * `undefined` when the clean threw; the audit then says it did not check.
 */
function dryCleanLines(ctx: CommandContext): string[] | undefined {
  let text = '';
  const sink = new Writable({
    write(chunk, _encoding, done) {
      text += String(chunk);
      done();
    },
  });
  try {
    worktreeClean({ ...ctx, stdout: sink }, { fetched: 'ok', dry: 'offline' });
  } catch {
    return undefined;
  }
  return text.split('\n').filter((l) => l.startsWith('removed ') || l.startsWith('deleted ') || l.startsWith('pruned '));
}

/** A value computed on first use. */
class Lazy<T> {
  private value: T | undefined;
  private done = false;
  constructor(private readonly make: () => T) {}
  get(): T {
    if (!this.done) {
      this.value = this.make();
      this.done = true;
    }
    return this.value as T;
  }
}

/**
 * Ruling "worktree-leftover wording": one gap per would-be removal, the author of the commit the line names. `deleted` lines carry `(was <sha>)`; a `removed <path>` line is the HEAD of
 * that worktree. Returns the gaps and the branch names (`t/x`, `origin/t/x`) the lines delete.
 */
function leftovers(ctx: CommandContext, lines: string[], who: (email: string) => string): { gaps: AuditGap[]; deleted: Set<string> } {
  const heads = new Lazy(() => worktreeHeads(ctx.root));
  const cut = lines.map((l) => (l.includes(NEXT) ? l.slice(0, l.indexOf(NEXT)) : l));
  const authorOf = (line: string): string | undefined => {
    if (line.startsWith('removed ')) {
      const sha = heads.get().get(norm(line.slice('removed '.length)));
      return sha === undefined ? undefined : authorOfSha(ctx.root, sha);
    }
    const sha = /\(was ([^)\s]+)\)$/.exec(line)?.[1];
    return sha === undefined ? undefined : authorOfSha(ctx.root, sha);
  };
  const deleted = new Set<string>();
  for (const line of cut) {
    const name = line.startsWith('deleted ') ? /^deleted ([^\s:]+)/.exec(line)?.[1] : undefined;
    if (name !== undefined) deleted.add(name);
  }
  return { gaps: leftoverGaps(cut, authorOf, who), deleted };
}

/**
 * Ruling "branch checks": the claim branches in this clone (local and origin-tracking), each with its ticket looked up where it could be (the checkout, the default ref, the branch's own tip) and
 * whether it is on the default ref. One `for-each-ref` for the refs, one for the merged ones; two `cat-file` calls per branch whose ticket the checkout does not hold. Reads only.
 */
function claimRefs(ctx: CommandContext, def: string | undefined, origin: boolean): ClaimRefFact[] {
  const root = ctx.root;
  const templates = ctx.snapshot.branchTemplates ?? ['t/{id}'];
  const known = (id: string): boolean => Object.hasOwn(ctx.snapshot.tickets, id);
  const out = git(root, ['for-each-ref', '--format=%(refname)%00%(authoremail)%00%(committerdate:unix)%00%(objectname)', 'refs/heads', 'refs/remotes/origin']);
  const merged = new Set<string>();
  if (def !== undefined) {
    try {
      for (const l of git(root, ['for-each-ref', '--merged', def, '--format=%(refname)', 'refs/heads', 'refs/remotes/origin']).split('\n')) if (l.trim() !== '') merged.add(l.trim());
    } catch {
      // no merged list: nothing is called merged, so a branch the default ref already holds may be listed
    }
  }
  const rows = out.split('\n').filter((l) => l !== '').map((l) => l.split('\0'));
  const have = new Set(rows.map((r) => r[0]));
  const defName = def === undefined ? undefined : def.replace(/^refs\/(heads|remotes\/[^/]+)\//, '');
  const refs: ClaimRefFact[] = [];
  for (const [ref, email, when, sha] of rows) {
    const m = /^refs\/(?:(heads)|remotes\/origin)\/(.+)$/.exec(ref ?? '');
    if (m === null || email === undefined || when === undefined || sha === undefined) continue;
    const name = m[2];
    if (name === 'HEAD' || name === defName) continue;
    const id = ticketOfBranch(name, templates, known);
    if (id === undefined || !SAFE_ID.test(id)) continue;
    const path = `accord/tickets/${id}.md`;
    const ticketAnywhere = known(id) || (def !== undefined && gitOk(root, ['cat-file', '-e', `${def}:${path}`])) || (SHA.test(sha) && gitOk(root, ['cat-file', '-e', `${sha}:${path}`]));
    refs.push({
      name,
      local: m[1] !== undefined,
      id,
      tip: Number(when),
      author: email.replace(/^<|>$/g, '') || undefined,
      ticketAnywhere,
      origin: origin && have.has(`refs/remotes/origin/${name}`),
      merged: merged.has(ref as string),
    });
  }
  return refs;
}

/** D-03, D-06: group 3's second half: what a clean would remove, and the claim branches no clean handles (Rulings "worktree-leftover wording", "branch checks", "G2 facts"). */
function auditBranches(ctx: CommandContext, who: (email: string) => string, staleDays: string, facts: AuditFact[], gaps: AuditGap[]): void {
  let deleted = new Set<string>();
  let defaultRef: string | undefined;
  try {
    defaultRef = gitDefaultRef(ctx.root);
  } catch {
    defaultRef = undefined;
  }
  if (defaultRef === undefined) {
    facts.push({ name: 'worktree-refs', value: 'no observation (no default branch in this clone)' });
  } else {
    const lines = dryCleanLines(ctx);
    if (lines === undefined) {
      facts.push({ name: 'worktree-refs', value: 'not checked (the offline dry clean could not run)' });
    } else {
      facts.push({ name: 'worktree-refs', value: 'judged against the refs already in this clone; accord worktree clean --dry-run fetches first' });
      const found = leftovers(ctx, lines, who);
      gaps.push(...found.gaps);
      deleted = found.deleted;
    }
  }
  const origin = gitOk(ctx.root, ['remote', 'get-url', 'origin']);
  if (!origin) facts.push({ name: 'claim-unpushed', value: 'no observation (no origin remote)' });
  try {
    const def = doneRef(ctx.root);
    const now = Math.floor(Date.now() / 1000);
    gaps.push(...branchGaps(claimRefs(ctx, def, origin), deleted, staleDays, now, who, { unpushed: origin, ...(def === undefined ? {} : { defaultName: shortRef(def) }) }));
  } catch (err) {
    facts.push({ name: 'claim-branches', value: `not checked (the branches could not be read: ${firstLine(err)})` });
  }
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
    facts.push({ name: 'worktree-refs', value: `not checked (${NOT_CHECKED})` });
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
  // D-03, D-06: its own guard, so a failure here never takes group 3's first half with it
  auditBranches(ctx, who.show, staleDays, facts, gaps);
  return { facts, gaps };
}
