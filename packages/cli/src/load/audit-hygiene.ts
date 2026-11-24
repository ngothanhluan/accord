// Phase 8.2 group 3 (D-01..D-11): the facts and gaps about the work in a repository: claimed tickets that went quiet, drafts nobody touched, deferred items nobody decided and baseline ids that can go, each naming the person where one is known. It reads git and files,
// writes nothing, fetches nothing and calls no model: the claim branches it judges are the ones already in this clone (local and origin-tracking), so the report is only as fresh as the last fetch.
// Group 3 loads the claims view itself, as `accord dashboard` does, inside a guard: `accord audit` keeps its checkout preflight, so a claim-view failure never stops the pin report or groups 1, 2 and 6.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Writable } from 'node:stream';
import { baselineGap, branchGaps, branchIdOf, claimPinBefore, deferredGaps, DEFERRED_MARK_FROM, draftAge, draftStaleGaps, isOpenWork, leftoverGaps, loadSnapshot, normaliseKey, ownerDeferred, removableBaseline, SAFE_BRANCH, SAFE_ID, statusRows, ticketIdleGaps } from '@accord-dev/accord-core';
import type { AuditFact, AuditGap, ClaimPin, ClaimRefFact, OldDraft, OwnerDeferred } from '@accord-dev/accord-core';
import type { CommandContext } from '../run.js';
import { NOT_CHECKED } from './audit-health.js';
import { gitClaimFactsMany, onePathCommits } from './claim-facts.js';
import type { ClaimFacts } from './claim-facts.js';
import { doneRef, gitDefaultRef, gitFilesAt, loadClaimView, snapshotAt, withDefaultRef, withQueued } from './fs.js';
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
export function creatorOf(root: string, id: string, branch: string | undefined): string | undefined {
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

/** The author email of commit `sha`; undefined for a text that is no sha, a commit git cannot find, or no author. The sha is checked before any argument is built. Exported as the oracle of `authorsOfShas` (D-03). */
export function authorOfSha(root: string, sha: string): string | undefined {
  if (!SHA.test(sha)) return undefined;
  try {
    const email = lastLine(git(root, ['-c', 'log.showSignature=false', 'log', '--no-show-signature', '-1', '--format=%ae', sha, '--']));
    return email === undefined || email === '' ? undefined : email;
  } catch {
    return undefined;
  }
}

/** Shas per `git log --no-walk` call: a command line holds about 32 K characters on Windows, and 200 shas of 40 characters stay far below it. */
const SHAS_PER_LOG = 200;

/**
 * Phase 08.9 D-02: the author emails of any number of commits, read with one `git log --no-walk` per 200 shas; each value equals `authorOfSha`'s answer (D-03).
 * Only texts that pass SHA enter the argument list, before `--` (T-08.9-15); any other text maps to undefined with no process. A record answers an input only when its full sha starts with the input;
 * an input no record answers (git peeled a tag to its commit, so the record prints another name), or one that two records answer, is read alone by `authorOfSha`, and so is every sha of a chunk
 * whose call failed (one missing or ambiguous object fails the whole call). Every value lives in this call's locals (D-04).
 */
export function authorsOfShas(root: string, shas: readonly string[]): Map<string, string | undefined> {
  const authors = new Map<string, string | undefined>();
  const valid: string[] = [];
  for (const sha of new Set(shas)) {
    if (SHA.test(sha)) valid.push(sha);
    else authors.set(sha, undefined);
  }
  for (let at = 0; at < valid.length; at += SHAS_PER_LOG) {
    const chunk = valid.slice(at, at + SHAS_PER_LOG);
    let records: Array<{ sha: string; email: string }> | undefined;
    try {
      records = git(root, ['-c', 'log.showSignature=false', 'log', '--no-show-signature', '--no-walk=unsorted', '--format=%H%x00%ae', ...chunk, '--'])
        .split(/\r?\n/)
        .filter((l) => l !== '')
        .map((l) => {
          const [sha, email = ''] = l.split('\0');
          return { sha: sha.toLowerCase(), email: email.trim() };
        });
    } catch {
      records = undefined; // the per-sha read answers each of them as before
    }
    for (const sha of chunk) {
      const hits = records?.filter((r) => r.sha.startsWith(sha));
      if (hits === undefined || hits.length !== 1) authors.set(sha, authorOfSha(root, sha));
      else authors.set(sha, hits[0].email === '' ? undefined : hits[0].email);
    }
  }
  return authors;
}

/** One backlog ref's tip: the committer time and the author email, each present only when git gave a usable one. */
type Tip = { committed?: number; email?: string };

/**
 * Phase 08.9 D-02: the committer time and the author email of the tip of every backlog ref (local and origin-tracking) from one `git for-each-ref`, keyed by the full ref name.
 * `%(committerdate:unix)` and `%(authoremail)` without its brackets are what `log -1 --format=%ct` and `%ae` print. The command line holds no repository text. A failed read throws; the caller then
 * reads each tip with `tipAge` and `creatorOf` as before. Its result lives in the locals of one audit run (D-04).
 */
export function backlogTips(root: string): Map<string, Tip> {
  const tips = new Map<string, Tip>();
  const text = git(root, ['for-each-ref', '--format=%(refname)%00%(committerdate:unix)%00%(authoremail)', 'refs/heads/backlog', 'refs/remotes/origin/backlog']);
  for (const row of text.split(/\r?\n/)) {
    const [name, time, mail] = row.split('\0');
    if (name === undefined || name === '') continue;
    const committed = Number(time);
    const email = (mail ?? '').trim().replace(/^<|>$/g, '');
    tips.set(name, { ...(Number.isFinite(committed) && committed > 0 ? { committed } : {}), ...(email === '' ? {} : { email }) });
  }
  return tips;
}

/** `tipAge` from the tips `backlogTips` read: the local ref first, then origin's, the first that holds a time. */
function tipAgeFrom(tips: Map<string, Tip>, branch: string, now: number): number | undefined {
  for (const ref of [`refs/heads/${branch}`, `refs/remotes/origin/${branch}`]) {
    const committed = tips.get(ref)?.committed;
    if (committed !== undefined) return Math.floor((now - committed) / 86400);
  }
  return undefined;
}

/** `creatorOf` of a queued draft from the tips `backlogTips` read: the first of the local and origin refs that holds an author email. */
function queuedCreatorFrom(tips: Map<string, Tip>, branch: string): string | undefined {
  for (const ref of [`refs/heads/${branch}`, `refs/remotes/origin/${branch}`]) {
    const email = tips.get(ref)?.email;
    if (email !== undefined) return email;
  }
  return undefined;
}

/** Draft paths per added-file log: the pathspec list stays far below the command line cap of about 32 K characters on Windows. */
const DRAFT_PATHS_PER_LOG = 200;
const FULL_SHA = /^[0-9a-f]{40,64}$/;
/** The characters git prints unquoted in `--name-only` output, so a name in it is compared by exact equality; a draft path with any other is read by `creatorOf`. */
const PLAIN_PATH = /^[A-Za-z0-9._/-]+$/;

/**
 * Phase 08.9 D-02, D-03: `creatorOf(root, id, undefined)` for many drafts on the default branch at once; the value of every id equals what creatorOf returns, which stays untouched as the oracle.
 * The creator is the author of the oldest commit that added `accord/tickets/<id>.md` in HEAD's history under git's per-file history simplification (RESEARCH Pattern 4): from HEAD, a merge whose file equals
 * the file of one of its parents is followed through the first such parent only. That walk is replayed by claim-facts.ts's onePathCommits over the parent graph (one `log`), with the commits that add each
 * file from one `--diff-filter=A --full-history` log per 200 paths and what differs at each merge from one `diff-tree`; the author of each answer comes from one authorsOfShas call. A draft with no adding
 * commit is undefined, as creatorOf says. A draft with two or more adding commits in the walk is read by creatorOf, because which of them git prints last depends on its date order, which the graph does not tell;
 * so are a draft whose path git would quote and an id that is no safe id (T-08.9-17), and with fewer than two drafts there is nothing to batch. A shared step that fails gives every draft creatorOf's answer.
 * Every value lives in the locals of this call (D-04).
 */
export function creatorsOf(root: string, ids: readonly string[]): Map<string, string | undefined> {
  const creators = new Map<string, string | undefined>();
  const asked = [...new Set(ids)];
  const rel = (id: string): string => `accord/tickets/${id}.md`;
  const batchable = asked.filter((id) => SAFE_ID.test(id) && PLAIN_PATH.test(rel(id)));
  for (const id of asked) if (!batchable.includes(id)) creators.set(id, creatorOf(root, id, undefined));
  const each = (list: readonly string[]): void => {
    for (const id of list) creators.set(id, creatorOf(root, id, undefined));
  };
  if (batchable.length < 2) {
    each(batchable);
    return creators;
  }
  const answered = new Map<string, string | undefined>();
  const handBack: string[] = [];
  try {
    const graph = new Map<string, string[]>();
    for (const line of git(root, ['-c', 'log.showSignature=false', 'log', '--no-show-signature', '--topo-order', '--reverse', '--format=%H %P', 'HEAD']).split(/\r?\n/)) {
      const [sha, ...parents] = line.trim().split(' ').filter((w) => w !== '');
      if (sha === undefined) continue;
      if (!FULL_SHA.test(sha) || !parents.every((q) => FULL_SHA.test(q))) throw new Error(`creatorsOf: unexpected log line ${JSON.stringify(line)}`);
      graph.set(sha, parents);
    }
    const isParent = new Set<string>();
    for (const parents of graph.values()) for (const parent of parents) isParent.add(parent);
    const tips = [...graph.keys()].filter((sha) => !isParent.has(sha));
    if (tips.length !== 1) throw new Error(`creatorsOf: ${tips.length} tips in the parent graph`);
    const head = tips[0];
    const merges = [...graph].filter(([, parents]) => parents.length > 1).map(([sha]) => sha);
    const nobody = new Set<string>();
    const winners = new Map<string, string>();
    for (let at = 0; at < batchable.length; at += DRAFT_PATHS_PER_LOG) {
      const part = batchable.slice(at, at + DRAFT_PATHS_PER_LOG);
      const specs = part.map((id) => ':(literal)' + rel(id));
      const wroteBy = new Map<string, Set<string>>(part.map((id) => [rel(id), new Set<string>()]));
      const changedBy = new Map<string, Set<string>>(part.map((id) => [rel(id), new Set<string>()]));
      const log = git(root, ['-c', 'log.showSignature=false', 'log', '--no-show-signature', '--no-renames', '--full-history', '--diff-filter=A', '--format=%x01%H', '--name-only', 'HEAD', '--', ...specs]);
      for (const record of log.split('\x01')) {
        const lines = record.split('\n').map((l) => l.replace(/\r$/, ''));
        const sha = lines[0].trim().toLowerCase();
        if (sha === '') continue;
        if (!FULL_SHA.test(sha)) throw new Error(`creatorsOf: unexpected log line ${JSON.stringify(lines[0])}`);
        for (const name of lines.slice(1)) {
          if (name === '') continue;
          const into = wroteBy.get(name);
          if (into === undefined) throw new Error(`creatorsOf: the log names a file nobody asked about: ${JSON.stringify(name)}`);
          into.add(sha);
        }
      }
      if (merges.length > 0) {
        const out = execFileSync('git', ['diff-tree', '--stdin', '-m', '-r', '--name-only', '--no-renames', '--pretty=oneline', '--', ...specs], {
          cwd: root,
          encoding: 'utf8',
          stdio: ['pipe', 'pipe', 'pipe'],
          maxBuffer: 64 * 1024 * 1024,
          env: { ...process.env, GIT_NO_LAZY_FETCH: '1' },
          input: merges.map((m) => m + '\n').join(''),
        });
        let pair: string | undefined;
        for (const raw of out.split('\n')) {
          const line = raw.replace(/\r$/, '');
          if (line === '') continue;
          const into = changedBy.get(line);
          if (into !== undefined) {
            if (pair === undefined) throw new Error('creatorsOf: a file name before any merge');
            into.add(pair);
            continue;
          }
          const header = /^([0-9a-f]{40,64}) \(from ([0-9a-f]{40,64})\)(?: |$)/.exec(line);
          if (header === null) throw new Error(`creatorsOf: unexpected diff-tree line ${JSON.stringify(line)}`);
          pair = header[1] + ' ' + header[2];
        }
      }
      for (const id of part) {
        const listed = onePathCommits(graph, head, '', nobody, wroteBy.get(rel(id))!, (merge, parent) => changedBy.get(rel(id))!.has(merge + ' ' + parent));
        if (listed === undefined || listed.length > 1) handBack.push(id);
        else if (listed.length === 0) answered.set(id, undefined);
        else winners.set(id, listed[0]);
      }
    }
    const authors = authorsOfShas(root, [...winners.values()]);
    for (const [id, sha] of winners) answered.set(id, authors.get(sha));
  } catch {
    each(batchable); // a shared step failed: every draft is read as creatorOf reads it
    return creators;
  }
  for (const [id, email] of answered) creators.set(id, email);
  each(handBack);
  return creators;
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
 * that worktree. The authors of all the shas the lines name are read together by `authorsOfShas` (Phase 08.9 D-02: one git process, not one per line). Returns the gaps and the branch names
 * (`t/x`, `origin/t/x`) the lines delete.
 */
function leftovers(ctx: CommandContext, lines: string[], who: (email: string) => string, norm: HygieneDeps['norm']): { gaps: AuditGap[]; deleted: Set<string> } {
  const heads = new Lazy(() => worktreeHeads(ctx.root, norm));
  const cut = lines.map((l) => (l.includes(NEXT) ? l.slice(0, l.indexOf(NEXT)) : l));
  // the sha each cut line names: a `removed` line's worktree HEAD (the list is read only when such a line exists), a `deleted` line's `(was <sha>)`
  const shaOf = (line: string): string | undefined => {
    if (line.startsWith('removed ')) return heads.get().get(norm(line.slice('removed '.length)));
    return /\(was ([^)\s]+)\)$/.exec(line)?.[1];
  };
  const named = new Map<string, string | undefined>();
  for (const line of cut) if (line.startsWith('removed ') || line.startsWith('deleted ')) named.set(line, shaOf(line));
  const authors = named.size === 0 ? new Map<string, string | undefined>() : authorsOfShas(ctx.root, [...named.values()].filter((sha): sha is string => sha !== undefined));
  const authorOf = (line: string): string | undefined => {
    const sha = named.get(line);
    return sha === undefined ? undefined : authors.get(sha);
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
 * whether it is on the default ref. One `for-each-ref` for the refs, one for the merged ones; one `cat-file --batch-check` reads the ticket of every branch whose ticket the checkout does not hold
 * (Phase 08.9 D-02: on the default ref and on the branch's own tip, two specs per branch, one process for any number of branches). Reads only.
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
  // the rows whose ticket the checkout lacks, with the `<ref>:<path>` specs that say whether it exists elsewhere (T-08.9-12: a ref name, a SHA-checked sha and a SAFE_ID path hold no newline)
  const probes: Array<{ at: number; def?: string; tip?: string }> = [];
  for (const [ref, email, when, sha] of rows) {
    const m = /^refs\/(?:(heads)|remotes\/origin)\/(.+)$/.exec(ref ?? '');
    if (m === null || email === undefined || when === undefined || sha === undefined) continue;
    const name = m[2];
    if (name === 'HEAD' || name === defName) continue;
    // issue #341 D-07c: an id guessed among several candidates is marked, so its gap carries no delete command
    const read = branchIdOf(name, templates, known, ctx.snapshot.config);
    const id = read?.id;
    if (read === undefined || id === undefined || !SAFE_ID.test(id)) continue;
    const path = `accord/tickets/${id}.md`;
    const ticketAnywhere = known(id);
    if (!ticketAnywhere && (def !== undefined || SHA.test(sha))) probes.push({ at: refs.length, ...(def === undefined ? {} : { def: `${def}:${path}` }), ...(SHA.test(sha) ? { tip: `${sha}:${path}` } : {}) });
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
      ...(read.ambiguous ? { ambiguous: true } : {}),
    });
  }
  if (probes.length > 0) {
    const specs = probes.flatMap((p) => [p.def, p.tip]).filter((s): s is string => s !== undefined);
    const present = presentSpecs(root, specs);
    for (const p of probes) {
      refs[p.at].ticketAnywhere =
        (p.def !== undefined && (present === undefined ? gitOk(root, ['cat-file', '-e', p.def]) : present.has(p.def))) ||
        (p.tip !== undefined && (present === undefined ? gitOk(root, ['cat-file', '-e', p.tip]) : present.has(p.tip)));
    }
  }
  return refs;
}

/**
 * Phase 08.9 D-02, D-03: which of `specs` (`<ref>:<path>`) name an object, from one `git cat-file --batch-check`, answers read by line index as `missingShas` does. A spec is present only when its line is an object name,
 * a type and a size: `cat-file -e` fails for a missing or an ambiguous name, and batch-check prints `missing` or `ambiguous` for those. `undefined` when git failed, so the caller reads each with `cat-file -e` as before.
 */
function presentSpecs(root: string, specs: readonly string[]): Set<string> | undefined {
  try {
    const out = execFileSync('git', ['cat-file', '--batch-check'], {
      cwd: root,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
      maxBuffer: 64 * 1024 * 1024,
      env: { ...process.env, GIT_NO_LAZY_FETCH: '1' },
      input: specs.map((s) => s + '\n').join(''),
    });
    const lines = out.split('\n');
    if (lines.length < specs.length) return undefined;
    const present = new Set<string>();
    specs.forEach((s, i) => {
      if (/^[0-9a-f]{40,64} \S+ \d+\r?$/.test(lines[i])) present.add(s);
    });
    return present;
  } catch {
    return undefined;
  }
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

/** Phase 08.8 D-19: the skipped ids the fact names (`: a, b`), at most ten in code-point order, then `and <k> more`; nothing when none was skipped. Every id passed SAFE_ID when it was listed. */
const SKIPPED_SHOWN = 10;
function skippedIds(ids: string[]): string {
  if (ids.length === 0) return '';
  const rest = ids.length - SKIPPED_SHOWN;
  return ': ' + [...ids].sort().slice(0, SKIPPED_SHOWN).join(', ') + (rest > 0 ? ` and ${rest} more` : '');
}

/**
 * D-04, D-06, D-10: the Must and Should items no owner decided, of every ticket done on the default ref, whoever claimed it and whatever its lane (the lane is never read). Only a ticket claimed at or
 * after DEFERRED_MARK_FROM is judged; one claimed before, or whose claim release cannot be read, is counted in the fact and never listed (Phase 08.8 D-19: the fact counts the done tickets with an undecided item and names the ones it skipped). The claim fact is read only for a ticket that has an item, for all of them in one batched read (Phase 08.9 D-02).
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
    const unreadable: string[] = [];
    let withItems = 0;
    const judged: { id: string; items: OwnerDeferred[] }[] = [];
    const itemsOf = new Map<string, OwnerDeferred[]>();
    for (const id of finished) {
      const text = ledgers[`accord/tickets/${id}/ledger.md`];
      const items = text === undefined ? [] : ownerDeferred(text, (mark) => Object.hasOwn(onRef.tickets, mark));
      if (items.length > 0) itemsOf.set(id, items);
    }
    // Phase 08.9 D-02: the claim facts of every ticket that has an item come from one batched read (gitClaimFactsMany), not one read per ticket.
    const claimFacts = gitClaimFactsMany(ctx.root, [...itemsOf.keys()], ctx.snapshot.config);
    for (const [id, items] of itemsOf) {
      withItems++;
      let release: ClaimPin | undefined;
      try {
        release = claimRelease(claimFacts.get(id), onRef.tickets[id]?.frontmatter?.ruleset);
      } catch {
        release = undefined; // a failed read skips this ticket into the unreadable count
      }
      if (release === undefined) {
        unreadable.push(id);
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
      value: `of ${withItems} done tickets with an undecided Must or Should item, ${judgedCount} judged, ${before} claimed before deferred marks were recorded (${DEFERRED_MARK_FROM}), ${unreadable.length} skipped because their claim release cannot be read${skippedIds(unreadable)}`,
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

    // D-02: an unclaimed, unfinished ticket is a draft; the creator is read only for the ones already past the threshold.
    // Phase 08.9 D-02: the tips of the queued drafts' backlog refs are read once, on the first draft that needs one (a failed read leaves the per-ref `tipAge` and `creatorOf`)
    const tips = new Lazy<Map<string, Tip> | undefined>(() => {
      try {
        return backlogTips(ctx.root);
      } catch {
        return undefined;
      }
    });
    const batched = (branch: string): Map<string, Tip> | undefined => (SAFE_BRANCH.test(branch) && branch.startsWith('backlog/') ? tips.get() : undefined);
    const tipAgeOf = (branch: string): number | undefined => {
      const read = batched(branch);
      return read === undefined ? tipAge(ctx.root, branch, now) : tipAgeFrom(read, branch, now);
    };
    const creatorOfQueued = (id: string, branch: string): string | undefined => {
      const read = batched(branch);
      return read === undefined ? creatorOf(ctx.root, id, branch) : queuedCreatorFrom(read, branch);
    };
    const late: Array<{ id: string; days: number; branch: string | undefined }> = [];
    for (const r of open.filter((x) => x.claimedBy === undefined)) {
      const branch = view.queued !== undefined && Object.hasOwn(view.queued, r.id) ? view.queued[r.id].branch : undefined;
      const days = draftAge(view, r.id, now) ?? (branch === undefined ? undefined : tipAgeOf(branch));
      if (days === undefined || days <= Number(staleDraftDays)) continue;
      late.push({ id: r.id, days, branch });
    }
    // Phase 08.9 D-02: the creators of the old drafts on the default branch come from one batched read; a queued draft's creator comes from its backlog tip
    const onDefault = creatorsOf(ctx.root, late.filter((d) => d.branch === undefined).map((d) => d.id));
    const old: OldDraft[] = late.map(({ id, days, branch }) => ({
      id,
      days,
      creator: branch === undefined ? onDefault.get(id) : creatorOfQueued(id, branch),
      ...(branch === undefined ? {} : { queued: branch }),
    }));
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
