// Phase 8.2 group 3 (D-01..D-11): the facts and gaps about the work in a repository: claimed tickets that went quiet, drafts nobody touched, deferred items nobody decided and baseline ids that can go, each naming the person where one is known. It reads git and files,
// writes nothing, fetches nothing and calls no model: the claim branches it judges are the ones already in this clone (local and origin-tracking), so the report is only as fresh as the last fetch.
// Group 3 loads the claims view itself, as `accord dashboard` does, inside a guard: `accord audit` keeps its checkout preflight, so a claim-view failure never stops the pin report or groups 1, 2 and 6.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Writable } from 'node:stream';
import { baselineGap, branchGaps, claimPinBefore, deferredGaps, DEFERRED_MARK_FROM, draftAge, draftStaleGaps, isOpenWork, leftoverGaps, loadSnapshot, normaliseKey, ownerDeferred, removableBaseline, SAFE_BRANCH, SAFE_ID, statusRows, ticketIdleGaps } from '@accord-dev/accord-core';
import type { AuditFact, AuditGap, ClaimPin, ClaimRefFact, OldDraft, OwnerDeferred } from '@accord-dev/accord-core';
import type { CommandContext } from '../run.js';
import { NOT_CHECKED } from './audit-health.js';
import { gitClaimFacts } from './claim-facts.js';
import type { ClaimFacts } from './claim-facts.js';
import { doneRef, gitDefaultRef, gitFilesAt, loadClaimView, snapshotAt, ticketOfBranch, withDefaultRef, withQueued } from './fs.js';
import { whoFor } from './who.js';

/** The fact that names the display mode: `email`, `initials`, or the unset-value form that says what git holds (Ruling "who setting"). */
function whoFact(mode: string, value: string | undefined): string {
  if (value === undefined || value === '' || value === 'email' || value === 'initials') return mode;
  return `${mode} (git config accord.who is "${value}", which is neither email nor initials)`;
}

/**
 * Phase 08.8 D-17 (IN-04): the command-level helpers this loader uses. `accord audit` (packages/cli/src/commands/audit.ts) passes them in, so no loader imports a command (an ESLint rule holds it);
 * each is typed by the call this file makes, and the audit command's call fails to typecheck when a real helper stops fitting.
 */
export interface HygieneDeps {
  /** The case-folded, slash-normalised form of a path the worktree list and a clean line are compared by (leftover.ts `norm`). */
  norm: (path: string) => string;
  /** The message that says the test report is older than the last commit, or undefined (task-done.ts `staleReport`). */
  staleReport: (ctx: CommandContext) => string | undefined;
  /** `accord worktree clean`, run as an offline dry run that prints what a clean would do (worktree.ts `worktreeClean`). */
  worktreeClean: (ctx: CommandContext, opts: { fetched: 'ok'; dry: 'offline' }) => number;
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
function worktreeHeads(root: string, norm: HygieneDeps['norm']): Map<string, string> {
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
function dryCleanLines(ctx: CommandContext, worktreeClean: HygieneDeps['worktreeClean']): string[] | undefined {
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
function leftovers(ctx: CommandContext, lines: string[], who: (email: string) => string, norm: HygieneDeps['norm']): { gaps: AuditGap[]; deleted: Set<string> } {
  const heads = new Lazy(() => worktreeHeads(ctx.root, norm));
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
      sha,
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
function auditBranches(ctx: CommandContext, deps: HygieneDeps, who: (email: string) => string, staleDays: string, facts: AuditFact[], gaps: AuditGap[]): void {
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
    const lines = dryCleanLines(ctx, deps.worktreeClean);
    if (lines === undefined) {
      facts.push({ name: 'worktree-refs', value: 'not checked (the offline dry clean could not run)' });
    } else {
      facts.push({ name: 'worktree-refs', value: 'judged against the refs already in this clone; accord worktree clean --dry-run fetches first' });
      const found = leftovers(ctx, lines, who, deps.norm);
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

const TICKET_FILE = /^accord\/tickets\/([^/]+)\.md$/;
const PLAIN_RELEASE = /^\d+\.\d+\.\d+$/;

/**
 * Ruling "claim release known" (D-04): the claim fact claimPinBefore should read for a done ticket, or undefined when its release cannot be read. A release is readable when the claim fact holds a
 * plain `ruleset` or `pin`, or has no pin and the finished ticket's own frontmatter `ruleset` is plain (a squash merge dropped the claim commit); that last case is handed on as a fact holding
 * the ruleset, so claimPinBefore reads it the one way it reads a claim. A failed claim read is unreadable: claimPinBefore fails closed for a gate, but a report that did so would list every older
 * squash-merged ticket's items for ever.
 */
function claimRelease(fact: ClaimFacts | undefined, own: string | undefined): ClaimPin | undefined {
  if (fact !== undefined && 'error' in fact) return undefined;
  if (fact?.ruleset !== undefined && PLAIN_RELEASE.test(fact.ruleset)) return fact;
  if (fact?.pin !== undefined && PLAIN_RELEASE.test(fact.pin)) return fact;
  if (own !== undefined && PLAIN_RELEASE.test(own)) return { ...(fact === undefined ? {} : fact), ruleset: own };
  return undefined;
}

/**
 * D-04, D-06, D-10: the Must and Should items no owner decided, of every ticket done on the default ref, whoever claimed it and whatever its lane (the lane is never read). Only a ticket claimed at or
 * after DEFERRED_MARK_FROM is judged; one claimed before, or whose claim release cannot be read, is counted in the fact and never listed. The claim fact is read only for a ticket that has an item.
 * Reads git (the ref's tree, blobs and claim commits), writes nothing and fetches nothing.
 */
function auditDeferred(ctx: CommandContext, facts: AuditFact[], gaps: AuditGap[]): void {
  try {
    const ref = doneRef(ctx.root);
    if (ref === undefined) {
      facts.push({ name: 'deferred-marks', value: 'no observation (no default branch in this clone)' });
      return;
    }
    // every id is checked against the id pattern before a path is built from it (T-08.2-12)
    const ids = git(ctx.root, ['ls-tree', '-z', '--name-only', ref, '--', 'accord/tickets/'])
      .split('\0')
      .flatMap((p) => {
        const id = TICKET_FILE.exec(p)?.[1];
        return id !== undefined && SAFE_ID.test(id) ? [id] : [];
      })
      .sort();
    const onRef = snapshotAt(ctx.root, ref, ids);
    const finished = statusRows(onRef).filter((r) => r.stage === 'done' && r.status !== 'dropped').map((r) => r.id);
    const ledgers = gitFilesAt(ctx.root, ref, finished.map((id) => `accord/tickets/${id}/ledger.md`));
    let judgedCount = 0;
    let before = 0;
    let unreadable = 0;
    const judged: { id: string; items: OwnerDeferred[] }[] = [];
    for (const id of finished) {
      const text = ledgers[`accord/tickets/${id}/ledger.md`];
      const items = text === undefined ? [] : ownerDeferred(text);
      if (items.length === 0) continue;
      let release: ClaimPin | undefined;
      try {
        release = claimRelease(gitClaimFacts(ctx.root, id, ctx.snapshot.config), onRef.tickets[id]?.frontmatter?.ruleset);
      } catch {
        release = undefined; // a failed read skips this ticket into the unreadable count
      }
      if (release === undefined) {
        unreadable++;
        continue;
      }
      if (claimPinBefore({ ...onRef, claimPins: { [id]: release } }, id, DEFERRED_MARK_FROM)) {
        before++;
        continue;
      }
      judgedCount++;
      judged.push({ id, items });
    }
    facts.push({
      name: 'deferred-marks',
      value: `${judgedCount} done tickets judged; ${before} claimed before deferred marks were recorded and ${unreadable} whose claim release cannot be read are skipped`,
    });
    gaps.push(...deferredGaps(judged));
  } catch (err) {
    facts.push({ name: 'deferred-marks', value: `not checked (the ledgers could not be read: ${firstLine(err)})` });
  }
}

/** The 1-based lines of each id in accord/tests-baseline.txt as written (BOM and CRLF dropped), every line holding it in file order (Phase 08.8 D-17 IN-03: a deleted id must go from all of them). */
function baselineLines(root: string): Map<string, number[]> {
  const text = readFileSync(join(root, 'accord', 'tests-baseline.txt'), 'utf8').replace(/^\uFEFF/, '').replace(/\r\n/g, '\n');
  const lines = new Map<string, number[]>();
  text.split('\n').forEach((l, i) => {
    const id = l.trim();
    if (id === '') return;
    const at = lines.get(id);
    if (at === undefined) lines.set(id, [i + 1]);
    else at.push(i + 1);
  });
  return lines;
}

/**
 * D-05, D-11: the size of the tests baseline and the ids of it that can be deleted now. The removable ones are judged only against a fresh report: with no `tests.report`, a missing report or one
 * written before the last commit (the staleness guard `accord tests baseline` applies too: this repository's `tests.affected` writes the same path with a subset) the fact says `no observation`,
 * never that none can go. Reads the baseline and the report from the checkout the audit already loaded, writes nothing and calls no model.
 */
function auditBaseline(ctx: CommandContext, staleReport: HygieneDeps['staleReport'], facts: AuditFact[], gaps: AuditGap[]): void {
  const ids = ctx.snapshot.testsBaseline;
  if (ids === undefined) {
    facts.push({ name: 'tests-baseline', value: 'no accord/tests-baseline.txt' });
    return;
  }
  const head = `${ids.length} ids`;
  const config = ctx.snapshot.config;
  const none = (why: string): void => void facts.push({ name: 'tests-baseline', value: `${head}; removable ones: no observation (${why})` });
  if (config === undefined) {
    facts.push({ name: 'tests-baseline', value: `${head}; removable ones: not checked (${NOT_CHECKED})` });
    return;
  }
  const report = config.tests?.report;
  if (report === undefined) return none('no tests.report in accord/config.yml');
  const rel = normaliseKey(report);
  if (ctx.snapshot.tests === undefined) return none(`${rel} was not found; run tests.full`);
  try {
    if (ctx.snapshot.git?.commit !== undefined && staleReport(ctx) !== undefined) return none(`${rel} was written before the last commit; run tests.full`);
  } catch {
    return none(`${rel} could not be compared with the last commit`);
  }
  const found = removableBaseline(ctx.snapshot);
  if (found === undefined) return none(`${rel} was not found; run tests.full`);
  const summary = found.notJudged > 0 ? `${head}, ${found.notJudged} not judged: their files have no case in the report` : head;
  // Phase 08.8 D-17 (IN-01): the lines are read before the fact is pushed, so a read failure gives one fact that carries the summary and the failure, never two.
  let at: Map<string, number[]>;
  try {
    at = baselineLines(ctx.root);
  } catch (err) {
    facts.push({ name: 'tests-baseline', value: `${summary}; removable ones: not checked (accord/tests-baseline.txt could not be read: ${firstLine(err)})` });
    return;
  }
  facts.push({ name: 'tests-baseline', value: summary });
  const listed = found.removable.flatMap((r) => (at.get(r.id) ?? []).map((line) => ({ id: r.id, why: r.why, line })));
  const gap = baselineGap(listed, ids.length);
  if (gap !== undefined) gaps.push(gap);
}

/** The group 3 facts and gaps (Rulings "group 3 facts, G1", "gap wording"). Every string goes through audit.ts's `fact()` and `gap()` closures, which make it printable. */
export async function auditHygiene(ctx: CommandContext, deps: HygieneDeps): Promise<{ facts: AuditFact[]; gaps: AuditGap[] }> {
  const facts: AuditFact[] = [];
  const gaps: AuditGap[] = [];
  const config = ctx.snapshot.config;
  const who = whoFor(ctx.root, config);
  facts.push({ name: 'who', value: whoFact(who.mode, who.value) });
  // never a clean result for a check that did not run
  if (config === undefined) {
    facts.push({ name: 'work-ages', value: `not checked (${NOT_CHECKED})` });
    facts.push({ name: 'worktree-refs', value: `not checked (${NOT_CHECKED})` });
    facts.push({ name: 'deferred-marks', value: `not checked (${NOT_CHECKED})` });
    // Phase 08.8 D-17 (IN-02): the two claim checks need the config too, so they are listed as not checked rather than left out
    facts.push({ name: 'claim-unpushed', value: `not checked (${NOT_CHECKED})` });
    facts.push({ name: 'claim-branches', value: `not checked (${NOT_CHECKED})` });
    auditBaseline(ctx, deps.staleReport, facts, gaps);
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
  auditBranches(ctx, deps, who.show, staleDays, facts, gaps);
  // D-04, D-06, D-10: its own guard as well
  auditDeferred(ctx, facts, gaps);
  // D-05, D-11: the baseline and the report are read from the checkout, so this check needs no git beyond the report's age
  auditBaseline(ctx, deps.staleReport, facts, gaps);
  return { facts, gaps };
}
