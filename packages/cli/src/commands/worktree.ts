// ST-LN-7 `accord worktree`: each ticket works in its own git worktree, a sibling folder of the main checkout.
import { execFileSync } from 'node:child_process';
import { appendFileSync, closeSync, existsSync, lstatSync, mkdirSync, openSync, readdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs';
import type { Dirent } from 'node:fs';
import { resolve } from 'node:path';
import { branchFieldsOf, branchTypesOf, changeProblem, DEFAULT_BRANCH_TEMPLATE, forbiddenLines, isResearchPath, isSha, loadConfig, loadSnapshot, parseRepoUrl, pinBefore, pinOf, progressPushTarget, REPO_NAME, renderBranch, renderSubject, RULESET_FROM, rulesetOfTicket, SAFE_ID, setFrontmatterKey, shaEqual, statusRows, subjectsFor, trailerReason } from '@accord-dev/accord-core';
import type { AccordConfig, RepoSnapshot } from '@accord-dev/accord-core';
import type { ContentMemo } from '../load/fs.js';
import { gitClaimFacts } from '../load/claim-facts.js';
import { isOff } from '../load/gitdir.js';
import { readCleanFacts } from '../load/clean-facts.js';
import type { CleanFacts, ResearchAnswers } from '../load/clean-facts.js';
import { contentSinceOf, currentBranch, droppedOn, gitDefaultRef, gitFilesAt, gitUnpushedCommits, gitUserEmail, loadFromFs, loadWithBranch, snapshotAt, ticketOfBranch, UsageError } from '../load/fs.js';
import { doneOnDefaultBranch, doneRefusal } from '../load/done-on-default.js';
import { sliceHomeOf } from '../load/slice-size.js';
import { dropSlices, sliceOfBranch } from '../load/slices.js';
import { blobsOnRef } from '../load/merged-state.js';
import { fetchLimitMs } from './fetch-limit.js';
import { cleanLine, nextLine, withNext, withNextOnFirst } from './next-action.js';
import { disposableNames, gitInside, hiddenEditReason, isDisposable, norm, repositoryReason, sweepForgotten, sweepRemoved } from './leftover.js';
import { scriptRefusal, shown } from '../load/script-trust.js';
import { runTeamCommand } from '../load/team-run.js';
import { claudeEnv, describeSession, isLive, processTable, runSetup, sameSession, sessionIn } from '../load/proc.js';
import type { Session } from '../load/proc.js';
import type { CommandContext } from '../run.js';
import { repoRoot } from '../root.js';
import { writeKey } from '../write/key.js';
import pkg from '../../package.json' with { type: 'json' };

export const ID = SAFE_ID;

export interface WorktreeEntry {
  path: string;
  head: string;
  branch?: string;
}

export function git(cwd: string, args: string[]): string {
  try {
    return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 64 * 1024 * 1024 });
  } catch (err) {
    throw new UsageError('git ' + args.join(' ') + ' failed\n' + String((err as { stderr?: string }).stderr ?? '').trim());
  }
}

export function gitOk(cwd: string, args: string[]): boolean {
  try {
    execFileSync('git', args, { cwd, stdio: ['ignore', 'pipe', 'pipe'] });
    return true;
  } catch {
    return false;
  }
}

/**
 * The ticket's branch: the claim branch git already shows, else the template rendered from the ticket's id, title and change: word (the checkout's copy, or `fields`
 * when the caller read a newer copy), as `accord status` prints it. A name still holding `{type}` means the ticket has no allowed change word (R-4).
 */
export function branchOf(snapshot: RepoSnapshot, id: string, fields?: { title?: string; change?: string }): string {
  if (snapshot.claimBranches !== undefined && Object.hasOwn(snapshot.claimBranches, id)) return snapshot.claimBranches[id];
  const own = snapshot.tickets[id]?.frontmatter;
  const title = fields?.title ?? own?.title;
  const change = fields?.change ?? own?.change;
  return renderBranch(snapshot.claimTemplate ?? DEFAULT_BRANCH_TEMPLATE, { id, ...(title === undefined ? {} : { title }), ...(change === undefined ? {} : { change }) }, snapshot.config);
}

/** R-4: a claim name that still holds `{type}` has no allowed change word; no type is guessed, so the claim is refused before any git write. `why` says what is missing, in the caller's words (IN-03). */
function refuseUntyped(ctx: CommandContext, id: string, why: string, written: string, give: string): never {
  const template = ctx.snapshot.claimTemplate ?? DEFAULT_BRANCH_TEMPLATE;
  throw new UsageError(`${id}: the branch template ${template} needs a change word, and ${why} - ${give}, one of: ${branchTypesOf(ctx.snapshot.config).join(', ')}; ${written}`);
}

/**
 * Review ruling (CR-01, WR-02, WR-03): before `git worktree add`, a rendered claim name must be a branch name git accepts (`git check-ref-format --branch`) and must read back
 * through the templates in force to the same id; otherwise the claim is refused, since a name the readers cannot map to its ticket is a claim nobody sees. No git write has run.
 */
function checkClaimName(ctx: CommandContext, id: string, claim: string, written: string): void {
  const template = ctx.snapshot.claimTemplate ?? DEFAULT_BRANCH_TEMPLATE;
  if (!gitOk(ctx.root, ['check-ref-format', '--branch', claim])) {
    throw new UsageError(`${id}: ${claim} is not a valid branch name (git check-ref-format), as the branch template ${template} renders it - change the template or the ticket's title; ${written}`);
  }
  const templates = ctx.snapshot.branchTemplates ?? [DEFAULT_BRANCH_TEMPLATE];
  if (ticketOfBranch(claim, templates, (i) => i === id, ctx.snapshot.config) !== id) {
    throw new UsageError(
      `${id}: ${claim} would not be read back as ${id} under the branch templates in force (${templates.join(', ')}), so no reader would see the claim - change the branch template or the change word; ${written}`,
    );
  }
}

export interface PrunableEntry extends WorktreeEntry {
  prunable?: string;
}

export function listWorktrees(root: string): PrunableEntry[] {
  return git(root, ['worktree', 'list', '--porcelain'])
    .split('\n\n')
    .filter((block) => block.trim() !== '')
    .map((block) => {
      const entry: PrunableEntry = { path: '', head: '' };
      for (const line of block.split('\n')) {
        if (line.startsWith('worktree ')) entry.path = line.slice(9);
        else if (line.startsWith('HEAD ')) entry.head = line.slice(5);
        else if (line.startsWith('branch refs/heads/')) entry.branch = line.slice(18);
        else if (line === 'prunable' || line.startsWith('prunable ')) entry.prunable = line.slice(9) || 'no reason given';
      }
      return entry;
    });
}

/** ST-LN-55 fix 1: true when `head` (a detached HEAD) is reachable from no branch, so a prune or a removal would lose its commits. An empty `head` counts as no branch. */
function onNoBranch(root: string, head: string, ref: string | undefined, merged?: ReadonlySet<string>, gone?: ReadonlySet<string>): boolean {
  if (head === '') return true;
  if (merged?.has(head.toLowerCase()) === true) return false;
  if (ref !== undefined && gitOk(root, ['merge-base', '--is-ancestor', head, ref])) return false;
  try {
    // D-03: a ref the dry run's prune report names is gone for this read, as it is after a real prune
    return git(root, ['for-each-ref', '--points-at', head, '--format=%(refname)', 'refs/heads', 'refs/remotes/origin']).split('\n').every((r) => r.trim() === '' || gone?.has(r.trim()) === true);
  } catch {
    return true;
  }
}

/**
 * `git worktree list --porcelain` in git's order (the first is the main worktree), after pruning records of folders deleted by hand, each named on `out`.
 * While a missing folder holds a detached HEAD on no branch nothing is pruned (git prunes every missing entry at once, and the prune would drop the only ref to that commit):
 * the whole list comes back, missing entries included, and each is named once on `out` (when `judged` is given) and added to `judged`.
 * Phase 8.2 D-03: with `dry` (the set of the `norm`ed paths already reported) the prune is not run; the line the prune would earn is written once for each stale entry and the list comes back without them, as after it.
 */
export function worktrees(root: string, out: NodeJS.WritableStream, judged?: Set<string>, dry?: Set<string>): PrunableEntry[] {
  let list = listWorktrees(root);
  const stale = list.filter((w) => w.prunable !== undefined);
  if (stale.length === 0) return list;
  const ref = gitDefaultRef(root);
  const held = stale.filter((w) => w.branch === undefined && onNoBranch(root, w.head, ref));
  if (held.length === 0 && dry !== undefined) {
    for (const w of stale) {
      if (dry.has(norm(w.path))) continue;
      dry.add(norm(w.path));
      out.write(withNext('pruned', `pruned ${w.path}: ${w.prunable}`) + '\n');
    }
    return list.filter((w) => w.prunable === undefined);
  }
  if (held.length === 0) {
    git(root, ['worktree', 'prune']);
    list = listWorktrees(root);
    for (const w of stale) if (!list.some((x) => x.path === w.path)) out.write(withNext('pruned', `pruned ${w.path}: ${w.prunable}`) + '\n');
    return list.filter((w) => w.prunable === undefined);
  }
  if (judged !== undefined) {
    for (const w of stale) {
      if (judged.has(norm(w.path))) continue;
      out.write(
        cleanLine(
          held.includes(w)
            ? `kept ${w.path}: its folder is missing and its detached HEAD ${w.head} is on no branch`
            : `kept ${w.path}: its folder is missing (${w.prunable}); no prune runs while a missing folder holds a detached HEAD on no branch`,
        ) + '\n',
      );
      judged.add(norm(w.path));
    }
  }
  return list;
}

/** D-06: the main checkout's folder name, a hyphen, the id in lower case, beside the main checkout. */
export function siblingOf(mainPath: string, id: string): string {
  const cut = mainPath.lastIndexOf('/');
  return mainPath.slice(0, cut + 1) + mainPath.slice(cut + 1) + '-' + id.toLowerCase();
}

/**
 * D-07: run the worktree's own `setup`; a failing command keeps the worktree and exits 2. Issue #341 D-02: a worktree with no accord/config.yml (a local-only install,
 * whose accord files are git-excluded) runs the `setup` of `from`, the checkout that runs the command; an invalid file in either place refuses and names it.
 */
export function prepare(path: string, from: string): void {
  let text: string | undefined;
  let where = 'accord/config.yml in the new worktree';
  try {
    text = readFileSync(path + '/accord/config.yml', 'utf8');
  } catch {
    // no config in the new worktree: the running checkout's, when it is another folder
    if (norm(from) !== norm(path)) {
      try {
        text = readFileSync(from + '/accord/config.yml', 'utf8');
        where = `accord/config.yml of ${from.replace(/\\/g, '/')}`;
      } catch {
        // no config anywhere: nothing to run
      }
    }
  }
  let setup: string[] = [];
  if (text !== undefined) {
    const loaded = loadConfig('accord/config.yml', text);
    if (loaded.config === undefined) {
      throw new UsageError(
        `${where} is invalid, so setup did not run: ${loaded.findings[0]?.reason ?? 'unreadable'}\nthe worktree is kept; fix the file, then continue the ticket again`,
      );
    }
    setup = loaded.config.setup ?? [];
  }
  const failed = runSetup(setup, path).failed;
  if (failed !== undefined) {
    throw new UsageError(
      withNextOnFirst('setup-failed', `setup command failed in the new worktree: ${failed.command} (exit ${failed.code})\n${failed.tail}\nthe worktree is kept; fix the command, then continue the ticket again`),
    );
  }
  writeFileSync(setupMarker(path), '');
}

/** D-15: the file in the worktree's own git dir that says `setup` finished there. */
export function setupMarker(path: string): string {
  return git(path, ['rev-parse', '--path-format=absolute', '--git-dir']).trim() + '/accord-setup-done';
}

interface Hold extends Session {
  taken: string;
  folder?: string;
}

/** D-14: run `fn` with `<git-common-dir>/accord` under the exclusive lock that guards the holds file and the worktree record. */
function withLock<T>(root: string, fn: (dir: string) => T): T {
  const dir = git(root, ['rev-parse', '--path-format=absolute', '--git-common-dir']).trim() + '/accord';
  const lock = dir + '/holds.lock';
  mkdirSync(dir, { recursive: true });
  const stop = Date.now() + 2000;
  let fd: number | undefined;
  while (fd === undefined) {
    try {
      fd = openSync(lock, 'wx');
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== 'EEXIST') throw e;
      if (Date.now() > stop) {
        throw new UsageError('the hold file is locked by another accord command: ' + lock + ' - if none is running, delete that file');
      }
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 50);
    }
  }
  try {
    return fn(dir);
  } finally {
    closeSync(fd);
    rmSync(lock, { force: true });
  }
}

/** D-14: run `fn` on the holds file under an exclusive lock; `fn` returns the new object or undefined for no write. */
export function withHolds(root: string, fn: (holds: Record<string, Hold>) => Record<string, Hold> | undefined): void {
  withLock(root, (dir) => {
    const file = dir + '/holds';
    let holds: Record<string, Hold> = {};
    if (existsSync(file)) {
      let parsed: unknown;
      try {
        parsed = JSON.parse(readFileSync(file, 'utf8'));
      } catch {
        parsed = undefined;
      }
      if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
        throw new UsageError(file + ' is not a JSON object - fix or delete it; accord does not rewrite it');
      }
      holds = parsed as Record<string, Hold>;
    }
    const next = fn(holds);
    if (next !== undefined) {
      const tmp = `${file}.${process.pid}.tmp`;
      writeFileSync(tmp, JSON.stringify(next, null, 2) + '\n');
      renameSync(tmp, file);
    }
  });
}

/** One readable line of the worktree record: `<id>\t<path>`, or `<id>\t<path>\t<repo>` for a worktree of another repository's clone (Phase 08.9.3 D-10). */
export interface Recorded {
  id: string;
  path: string;
  repo?: string;
}

/** The readable form of one record line, or undefined: a valid id, a path, and a third column that is absent or a repository name (a line with any other third column is not read, and is kept when the file is rewritten). */
function recordLine(l: string): Recorded | undefined {
  const t = l.indexOf('\t');
  if (t <= 0 || !ID.test(l.slice(0, t)) || l.length <= t + 1) return undefined;
  const id = l.slice(0, t);
  const rest = l.slice(t + 1);
  const u = rest.lastIndexOf('\t');
  if (u < 0) return { id, path: rest };
  const repo = rest.slice(u + 1);
  return u > 0 && REPO_NAME.test(repo) ? { id, path: rest.slice(0, u), repo } : undefined;
}

/** ST-LN-55 D-07: the record of the worktrees accord created, one `<id>\t<path>` line each (Phase 08.9.3: a third column names the repository whose clone the worktree belongs to); a line that does not read is skipped when read and kept when rewritten. */
function parseRecord(text: string): Recorded[] {
  return text.split('\n').flatMap((l) => recordLine(l) ?? []);
}

/** Write `text` over the record through a temporary file, as the holds file is written. */
function writeRecord(file: string, text: string): void {
  const tmp = `${file}.${process.pid}.tmp`;
  writeFileSync(tmp, text);
  renameSync(tmp, file);
}

/** Record a worktree accord just created (with `repo`, a worktree of that repository's clone); a path already in the record is not written twice. Throws when `repo` is no repository name. */
export function recordWorktree(root: string, id: string, path: string, repo?: string): void {
  if (repo !== undefined && !REPO_NAME.test(repo)) throw new UsageError('not a repository name: ' + repo);
  withLock(root, (dir) => {
    const file = dir + '/worktrees';
    const text = existsSync(file) ? readFileSync(file, 'utf8') : '';
    if (parseRecord(text).some((e) => norm(e.path) === norm(path))) return;
    writeRecord(file, (text === '' || text.endsWith('\n') ? text : text + '\n') + `${id}\t${path}${repo === undefined ? '' : '\t' + repo}\n`);
  });
}

/** The record without a lock (it is written by rename); a missing file gives `[]`. `dir` is `<git-common-dir>/accord` when the caller already has it. */
export function readRecorded(root: string, dir?: string): Recorded[] {
  const file = (dir ?? git(root, ['rev-parse', '--path-format=absolute', '--git-common-dir']).trim() + '/accord') + '/worktrees';
  return existsSync(file) ? parseRecord(readFileSync(file, 'utf8')) : [];
}

/** Drop the record lines whose path is `path` (the path column only); nothing is written when there are none. */
function dropRecorded(root: string, path: string): void {
  withLock(root, (dir) => {
    const file = dir + '/worktrees';
    if (!existsSync(file)) return;
    const lines = readFileSync(file, 'utf8').split('\n');
    const keep = lines.filter((l) => {
      const e = recordLine(l);
      return !(e !== undefined && norm(e.path) === norm(path));
    });
    if (keep.length !== lines.length) writeRecord(file, keep.join('\n'));
  });
}

/** `recordWorktree` that never fails the command: a failure is named and the command goes on. */
function recordQuietly(ctx: CommandContext, id: string, path: string): void {
  try {
    recordWorktree(ctx.root, id, path);
  } catch (e) {
    ctx.stdout.write(withNext('note', `note ${id}: the worktree ${path} was not recorded: ${firstLine(e instanceof UsageError ? e.message : e)}`) + '\n');
  }
}

/** The holds file read without the lock (writes are a rename), so the works rule writes nothing. */
export function readHoldsFile(root: string): Record<string, Hold> {
  const file = git(root, ['rev-parse', '--path-format=absolute', '--git-common-dir']).trim() + '/accord/holds';
  if (!existsSync(file)) return {};
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(file, 'utf8'));
  } catch {
    parsed = undefined;
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new UsageError(file + ' is not a JSON object - fix or delete it; accord does not rewrite it');
  }
  return parsed as Record<string, Hold>;
}

/** The worked record: one `<id>\t<marker>` line per ticket a session took a hold on or started in; never rewritten. */
export function recordWorked(root: string, id: string, marker: string): void {
  const dir = git(root, ['rev-parse', '--path-format=absolute', '--git-common-dir']).trim() + '/accord';
  const file = dir + '/worked';
  mkdirSync(dir, { recursive: true });
  const line = `${id}\t${marker}`;
  if (!(existsSync(file) ? readFileSync(file, 'utf8') : '').split('\n').includes(line)) appendFileSync(file, line + '\n');
}

/** The first ticket the record names for this marker; reads without a lock and writes nothing. */
export function workedBy(root: string, marker: string): string | undefined {
  const file = git(root, ['rev-parse', '--path-format=absolute', '--git-common-dir']).trim() + '/accord/worked';
  if (!existsSync(file)) return undefined;
  for (const l of readFileSync(file, 'utf8').split('\n')) {
    const t = l.indexOf('\t');
    if (t > 0 && l.slice(t + 1) === marker) return l.slice(0, t);
  }
  return undefined;
}

/** D-17: take (or keep) this session's hold on `id`; a live other session holding it refuses. Claude Code sessions only. */
export function takeHold(ctx: CommandContext, id: string, path: string): void {
  const claude = claudeEnv(ctx.env)!;
  const table = processTable();
  const session = sessionIn(claude, table, process.pid);
  withHolds(ctx.root, (holds) => {
    const h = Object.hasOwn(holds, id) ? holds[id] : undefined;
    if (h !== undefined && !sameSession(h, session) && isLive(h, table)) {
      throw new UsageError(withNext('held-by-other', `${id} is held by another session: ${describeSession(h)} - work it there, or close that session first`));
    }
    const same = h !== undefined && sameSession(h, session);
    const here = (isLinked(ctx.root) ? ctx.root : path).replaceAll('\\', '/');
    return { ...holds, [id]: { ...session, taken: same ? h.taken : new Date().toISOString(), folder: same ? (h.folder ?? here) : here } };
  });
  recordWorked(ctx.root, id, session.marker);
}

/** BUG-LN-14 D-02, D-06: drop the holds the claude process `session` took, except the one `marker` holds; the hold of `stay` moves to `marker`. */
export function releaseHolds(root: string, session: { pid: number; start: string }, marker: string, stay: string | undefined): void {
  withHolds(root, (holds) => {
    let changed = false;
    const next: Record<string, Hold> = {};
    for (const [id, h] of Object.entries(holds)) {
      if (h.pid !== session.pid || h.start !== session.start || h.marker === marker) next[id] = h;
      else if (id === stay) {
        next[id] = { ...h, marker };
        changed = true;
      } else changed = true;
    }
    return changed ? next : undefined;
  });
}

/** Inside the ticket's worktree: take the hold (Claude Code only, D-17), then make sure `setup` finished. */
function hold(ctx: CommandContext, id: string, path: string): number {
  if (claudeEnv(ctx.env) === undefined) {
    if (!existsSync(setupMarker(path))) prepare(path, ctx.root);
    ctx.stdout.write(withNext('not-held', `not held: ${id} - a second session in this worktree is not refused in this tool yet`) + '\n');
    return 0;
  }
  takeHold(ctx, id, path);
  if (!existsSync(setupMarker(path))) prepare(path, ctx.root);
  ctx.stdout.write(withNext('held', `held: ${id} by this session`) + '\n');
  return 0;
}

export function isLinked(root: string): boolean {
  return norm(git(root, ['rev-parse', '--path-format=absolute', '--git-dir']).trim()) !== norm(git(root, ['rev-parse', '--path-format=absolute', '--git-common-dir']).trim());
}

/** A Claude Code session in the main checkout can move into the worktree; a session missing its variables gets the stop lines. */
export function canEnter(ctx: CommandContext): boolean {
  let c;
  try {
    c = claudeEnv(ctx.env);
  } catch {
    return false;
  }
  return c !== undefined && !isLinked(ctx.root);
}

/** The session runs the launch folder's accord, so a worktree pinned to another version must be fixed before the session moves. */
export function checkPin(ctx: CommandContext, id: string, path: string, branch: string, mainPath: string): void {
  const file = path + '/accord/config.yml';
  if (!existsSync(file)) return;
  const pinned = loadConfig('accord/config.yml', readFileSync(file, 'utf8')).config?.accord;
  if (pinned === undefined || pinned === pkg.version) return;
  const ref = gitDefaultRef(ctx.root);
  const def = ref === undefined ? 'the default branch' : ref.replace('refs/remotes/', '');
  let defPin: string | undefined;
  if (ref !== undefined && gitOk(ctx.root, ['cat-file', '-e', `${ref}:accord/config.yml`])) {
    defPin = loadConfig('accord/config.yml', git(ctx.root, ['-c', 'log.showSignature=false', 'show', '--no-show-signature', `${ref}:accord/config.yml`])).config?.accord;
  }
  throw new UsageError(
    defPin === pinned
      ? `${file} pins accord ${pinned} as ${def} does, but the main checkout ${mainPath} runs ${pkg.version} - update the main checkout to ${def} (git pull there), then ask to continue ${id}; this session did not move`
      : `${file} pins accord ${pinned}, running ${pkg.version} - merge ${def} into ${branch}, then ask to continue ${id}; this session did not move`,
  );
}

export function enterOrStop(ctx: CommandContext, id: string, path: string, branch: string, enter: boolean): void {
  if (!enter) return printStop(ctx, path, id);
  takeHold(ctx, id, path);
  if (!existsSync(setupMarker(path))) prepare(path, ctx.root);
  ctx.stdout.write(`${nextLine('enter')}\nenter: ${path}\n`);
}

/** D-11, D-12: exactly three lines, naming no tool. */
export function printStop(ctx: CommandContext, path: string, id: string): void {
  ctx.stdout.write(`${nextLine('stop')}\nstop: open a session in this folder and type the line below it\n${path}\n/accord continue ${id}\n`);
}

/** Pick up reuses an existing branch only when its claim is the user's own (same email); otherwise exit 2, nothing created. */
function checkClaimant(ctx: CommandContext, id: string, ref: string): void {
  const def = gitDefaultRef(ctx.root);
  // ST-LN-50 D-06: the claim subject is the team's template and every legacy one still names a claimant; `--grep` only narrows the log, each subject is compared exactly.
  const subjects = subjectsFor(ctx.snapshot.config, 'claim', id);
  const log = git(ctx.root, ['-c', 'log.showSignature=false', 'log', '--no-show-signature', '--fixed-strings', ...subjects.map((s) => '--grep=' + s), '--format=%ae%x00%s', ref, ...(def === undefined ? [] : ['--not', def])]);
  let claimant: string | undefined;
  for (const line of log.split('\n')) {
    const [email, subject] = line.split('\0');
    if (subject !== undefined && subjects.includes(subject)) {
      claimant = email;
      break;
    }
  }
  const claims = ctx.snapshot.claims;
  claimant ??= claims !== undefined && Object.hasOwn(claims, id) ? claims[id] : undefined;
  if (claimant === undefined) return;
  const me = gitUserEmail(ctx.root);
  if (me === '') throw new UsageError('git user.email is not set - set it with git config user.email <you@example.com>');
  if (claimant.trim().toLowerCase() !== me.trim().toLowerCase()) {
    throw new UsageError(withNext('claimed', `claimed: ${id} by ${claimant} - nothing was created; to work on it with them, ask to continue ${id}`));
  }
}

/** D-04: the Claude Code session, or undefined for another runtime; never throws. */
export function inClaude(env: NodeJS.ProcessEnv): { marker: string | undefined } | undefined {
  try {
    const c = claudeEnv(env);
    return c === undefined ? undefined : { marker: c.marker };
  } catch {
    return { marker: env.CLAUDE_CODE_SESSION_ID || undefined };
  }
}

export type Works = { id: string | undefined; top: string };

/** D-04: the ticket this session works: its linked worktree's branch, else a hold carrying its marker. */
export function worksTicket(cwd: string, marker: string | undefined, snapshot: RepoSnapshot): Works | undefined {
  const top = repoRoot(cwd);
  if (isLinked(top)) {
    const b = currentBranch(top);
    if (b === undefined || b === '') return { id: undefined, top };
    const id = ticketOfBranch(b, snapshot.branchTemplates ?? [DEFAULT_BRANCH_TEMPLATE], (i) => Object.hasOwn(snapshot.tickets, i), snapshot.config);
    if (id !== undefined) return { id, top };
  }
  if (marker !== undefined) {
    const holds = readHoldsFile(top);
    const key = Object.keys(holds).sort().find((k) => holds[k]?.marker === marker);
    if (key !== undefined) return { id: key, top };
    const id = workedBy(top, marker);
    if (id !== undefined) return { id, top };
  }
  return undefined;
}

/** ST-LN-83 D-06: what a refused command needs - the command to type, and the folder to open a new session in. */
export interface SessionNext {
  command: string;
  path: string;
}

/**
 * ST-LN-83 D-06: with `next`, the message names the refused command and ends with a line ready to copy that opens a session in
 * the folder where it runs; without it (the session check) the message keeps its older text and the line opens the main checkout.
 * The hook's block reason and the CLI guard share this one text. The path comes from `git worktree list`, never from typed text;
 * accord prints the line for a person to copy and never runs it.
 */
export function worksMessage(w: Works, mainPath: string, next?: SessionNext): string {
  const who = w.id === undefined ? `this session works the ticket worktree ${w.top}, whose branch cannot be read` : `this session works ${w.id}`;
  if (next !== undefined) {
    return `${withNext('session-works', `${who}: ${next.command} needs a session of its own - open one with the line below and type ${next.command} there - nothing was changed`)}\n${openLine(next.path)}`;
  }
  const text =
    w.id === undefined
      ? `${who}: open a new session in the main checkout ${mainPath} for other work, or type a request about that ticket without "/accord" - nothing was changed`
      : `${who}: open a new session in the main checkout ${mainPath} for other work, or type a request about ${w.id} without "/accord" - nothing was changed`;
  return `${withNext('session-works', text)}\n${openLine(mainPath)}`;
}

/** `;` sequences two commands in PowerShell 5.1 and 7, bash and zsh alike (`&&` fails in Windows PowerShell 5.1); the guard acts only in Claude Code, so it names `claude`. */
function openLine(path: string): string {
  return `cd "${path}"; claude`;
}

/**
 * ST-LN-83 D-06: where a refused `command` is opened: for a Continue of `cont`, that ticket's existing worktree (the entry on its branch), else the main checkout,
 * where /accord continue makes or finds it; for any other command the main checkout.
 */
export function sessionNext(root: string, snapshot: RepoSnapshot, mainPath: string, command: string, cont?: string): SessionNext {
  if (cont === undefined || !ID.test(cont)) return { command, path: mainPath };
  const branch = branchOf(snapshot, cont);
  const there = listWorktrees(root).find((e) => e.branch === branch && e.prunable === undefined);
  return { command, path: there?.path ?? mainPath };
}

/** The continue a session that works `w` may run: its own ticket, or, with no readable branch, the ticket whose sibling folder it is in. */
export function guardAllowsContinue(w: Works, mainPath: string, cont: string): boolean {
  return w.id === cont || (w.id === undefined && norm(siblingOf(mainPath, cont)) === norm(w.top));
}

/**
 * D-02, D-06, D-09: a Claude Code session that works a ticket is refused what would touch another; `cont` names the ticket a continue asks for,
 * `command` the command a pick up or a new ticket was typed as (the message names it and the line that opens its session).
 * Without either (the session check) the message keeps its older text. Nothing here switches the session to another ticket (ST-LN-83 D-07).
 */
export function guardTicketSession(ctx: CommandContext, cont?: string, command?: string): void {
  const s = inClaude(ctx.env);
  if (s === undefined) return;
  const w = worksTicket(ctx.root, s.marker, ctx.snapshot);
  if (w === undefined) return;
  const mainPath = listWorktrees(ctx.root)[0].path;
  if (cont !== undefined && guardAllowsContinue(w, mainPath, cont)) return;
  const typed = cont !== undefined ? `/accord continue ${cont}` : command;
  throw new UsageError(worksMessage(w, mainPath, typed === undefined ? undefined : sessionNext(ctx.root, ctx.snapshot, mainPath, typed, cont)));
}

/** A worktree git still registers at `path` whose folder is missing: a plain `git worktree add` there would fail with advice to prune, which can lose a detached commit. No git command has run. */
function refuseAt(id: string, path: string, tail: string): never {
  throw new UsageError(`${id}: git still registers a worktree at ${path}, whose folder is missing - put that folder back, then try again; ${tail}`);
}

export function worktreeCheck(ctx: CommandContext): number {
  guardTicketSession(ctx);
  // Phase 08.9.2 Ruling-off-accord: the first command /accord runs tells a session that the person switched accord off, so the skill's own rule (do what the next action says) offers `accord on`; the exit code stays 0
  if (isOff(ctx.root)) ctx.stdout.write(withNext('accord-off', 'accord is switched off for you in this clone') + '\n');
  return 0;
}

export function worktreeOpen(ctx: CommandContext, id: string, opts: { continue?: boolean; change?: string } = {}): number {
  if (!ID.test(id)) throw new UsageError('not a valid ticket id: ' + id);
  // Issue #341 D-10, R-7: --change names a new claim; a continue never claims, and the word must be one the team lists, so both are refused before the fetch
  if (opts.change !== undefined) {
    if (opts.continue === true) throw new UsageError('--change goes with a new claim; --continue never claims - nothing was created');
    const problem = changeProblem(opts.change, ctx.snapshot.config);
    if (problem !== undefined) throw new UsageError('--change ' + opts.change + ': ' + problem + ' - nothing was created');
  }
  guardTicketSession(ctx, opts.continue === true ? id : undefined, `/accord pick-up ${id}`);
  const f = fetchOrigin(ctx);
  ctx = f.ctx;
  const seen = cleanQuietly(ctx, f.fetched, id);
  const enter = canEnter(ctx);
  const pick = opts.continue !== true;
  const branch = branchOf(ctx.snapshot, id);
  // the list clean read last and no removal changed since; undefined after a removal or a failed clean
  // entries whose folder is missing reach `all` only while a missing folder holds a detached HEAD on no branch; they are never entered or claimed
  const all = (seen ?? worktrees(ctx.root, ctx.stdout)) as PrunableEntry[];
  const list = all.filter((w) => w.prunable === undefined);
  const mainPath = list[0].path;
  // IN-01: a name still holding {type} is no claim (the ticket has no allowed change word and no claim branch), so the literal never reaches git
  const untyped = branch.includes('{type}');
  const held = untyped ? undefined : list.find((w) => w.branch === branch);
  const local = held !== undefined || (!untyped && gitOk(ctx.root, ['rev-parse', '--verify', '-q', 'refs/heads/' + branch]));
  const remote = !untyped && gitOk(ctx.root, ['rev-parse', '--verify', '-q', 'refs/remotes/origin/' + branch]);
  // IN-04: --change names a new claim only; a found claim keeps its name (D-07), so the flag is refused rather than silently dropped
  if (opts.change !== undefined && (local || remote)) {
    throw new UsageError(`--change ${opts.change}: ${id} is already claimed on ${branch}, which keeps its name - run accord worktree open ${id} without --change; nothing was created`);
  }
  if (opts.continue !== true) {
    const def = gitDefaultRef(ctx.root);
    if (def !== undefined && droppedOn(ctx.root, def, [id]).has(id)) {
      throw new UsageError(`${id} is dropped on ${def.replace('refs/remotes/origin/', '')} - make a new ticket instead (the drop reason is in accord/tickets/${id}.md there); nothing was created`);
    }
    // judge every ref that exists: the dashboard credits the pushed claim too
    if (local) checkClaimant(ctx, id, 'refs/heads/' + branch);
    if (remote) checkClaimant(ctx, id, 'refs/remotes/origin/' + branch);
  }
  // D-15: a worktree already holding the branch is only found, nothing runs there (Continue merges and sets up, ST-LN-25).
  if (held !== undefined) {
    if (opts.continue === true) continueMerge(ctx, id, held.path, branch);
    if (norm(held.path) === norm(ctx.root)) return hold(ctx, id, held.path);
    if (enter) checkPin(ctx, id, held.path, branch, mainPath);
    enterOrStop(ctx, id, held.path, branch, enter);
    return 0;
  }
  if (local || remote) {
    const path = siblingOf(mainPath, id);
    const missing = all.filter((w) => w.prunable !== undefined && w.branch === branch);
    const atPath = all.filter((w) => w.prunable !== undefined && norm(w.path) === norm(path));
    // a missing folder at the target path that is not the one --force case below: a plain add would fail with git's advice to prune
    if (atPath.length > 0 && !(atPath.length === 1 && missing.length === 1 && atPath[0] === missing[0])) refuseAt(id, path, 'nothing was created');
    if (missing.length === 0) {
      git(ctx.root, local ? ['worktree', 'add', path, branch] : ['worktree', 'add', '--track', '-b', branch, path, 'origin/' + branch]);
    } else if (missing.length === 1 && norm(missing[0].path) === norm(path)) {
      // the ticket's own sibling, deleted by hand and still registered: --force replaces only that entry's record, and its commits are on the branch
      git(ctx.root, ['worktree', 'add', '--force', path, branch]);
    } else {
      throw new UsageError(
        `${id}: its branch ${branch} is checked out in ${missing.map((w) => w.path).join(', ')}, whose folder is missing - put that folder back, then try again; nothing was created`,
      );
    }
    recordQuietly(ctx, id, path);
    if (opts.continue === true) continueMerge(ctx, id, path, branch);
    if (enter) {
      if (pick) takeHold(ctx, id, path);
      checkPin(ctx, id, path, branch, mainPath);
    } else if (!existsSync(setupMarker(path))) prepare(path, ctx.root);
    enterOrStop(ctx, id, path, branch, enter);
    return 0;
  }
  const isTicket = Object.hasOwn(ctx.snapshot.tickets, id);
  if (opts.continue === true) {
    throw new UsageError(
      isTicket
        ? withNext('not-claimed', `not claimed: ${id} has no ${untyped ? 'claim branch' : `branch ${branch}`} here or on origin - nothing was created; pick it up first`)
        : withNext('not-a-ticket', `not a ticket: ${id} is not in accord/tickets and has no ${untyped ? 'claim branch' : `branch ${branch}`} here or on origin - nothing was created`),
    );
  }
  if (!isTicket) throw new UsageError('no ticket ' + id + ' in accord/tickets - nothing was created');
  const ref = gitDefaultRef(ctx.root);
  if (ref === undefined) throw new UsageError('no origin/main in this clone - run git fetch origin, then try again');
  // W3: the claim commit holds the default ref's copy of the ticket, which can differ from this checkout's, so the name is rendered from that copy.
  let onDefault: string;
  try {
    onDefault = git(ctx.root, ['cat-file', 'blob', `${ref}:accord/tickets/${id}.md`]);
  } catch {
    throw new UsageError(
      `${id} is not on ${ref.replace('refs/remotes/', '')} - merge accord/tickets/${id}.md into the main branch, run git fetch origin, then try again; nothing was created`,
    );
  }
  // R-7 and W3: the --change word stands in for the ticket's own change: in the name, and is written into the claim commit below
  const claim = branchOf(ctx.snapshot, id, { ...branchFieldsOf(onDefault), ...(opts.change === undefined ? {} : { change: opts.change }) });
  if (claim.includes('{type}')) {
    refuseUntyped(ctx, id, 'the ticket has none that branch_types allows', 'nothing was created', `add change: <word> to accord/tickets/${id}.md on the default branch, or run accord worktree open ${id} --change <word>`);
  }
  checkClaimName(ctx, id, claim, 'nothing was created');
  if (
    claim !== branch &&
    (list.some((w) => w.branch === claim) ||
      gitOk(ctx.root, ['rev-parse', '--verify', '-q', 'refs/heads/' + claim]) ||
      gitOk(ctx.root, ['rev-parse', '--verify', '-q', 'refs/remotes/origin/' + claim]))
  ) {
    throw new UsageError(`${claim} already exists - nothing was created`);
  }
  const path = siblingOf(mainPath, id);
  if (all.some((w) => w.prunable !== undefined && norm(w.path) === norm(path))) refuseAt(id, path, 'nothing was created');
  git(ctx.root, ['worktree', 'add', '--no-track', '-b', claim, path, ref]);
  recordQuietly(ctx, id, path);
  const wroteRuleset = claimRuleset(path, `accord/tickets/${id}.md`);
  let wroteChange = false;
  if (opts.change !== undefined) {
    try {
      wroteChange = writeKey(path, `accord/tickets/${id}.md`, 'change', opts.change);
    } catch (e) {
      throw new UsageError(`could not write change: ${opts.change} into accord/tickets/${id}.md in ${path}: ${firstLine(e instanceof UsageError ? e.message : e)}\nthe worktree is kept; fix the ticket, then continue it`);
    }
  }
  const wrote = wroteRuleset || wroteChange;
  if (wrote) git(path, ['add', '--', ':(literal)' + `accord/tickets/${id}.md`]);
  git(path, ['commit', ...(wrote ? [] : ['--allow-empty']), '-q', '-m', renderSubject(ctx.snapshot.config, 'claim', id)]);
  if (enter) {
    takeHold(ctx, id, path);
    checkPin(ctx, id, path, claim, mainPath);
  } else prepare(path, ctx.root);
  enterOrStop(ctx, id, path, claim, enter);
  return 0;
}

/**
 * ST-LN-96 D-02: the pin the claim records as the ticket's `ruleset`: the `accord:` value of accord/config.yml in the new worktree (the commit the claim
 * branches from), when it is a plain x.y.z not before RULESET_FROM. Undefined otherwise (an older pin, whose published schema refuses the field, a pre-release
 * pin, or a config that cannot be read), and then the claim is written as before.
 */
function rulesetPinOf(path: string): string | undefined {
  let pin: string | undefined;
  try {
    pin = pinOf(readFileSync(path + '/accord/config.yml', 'utf8'));
  } catch {
    return undefined;
  }
  return writablePin(pin);
}

/** `pin` when it is a plain x.y.z not before RULESET_FROM, the pins whose published schema takes the field; undefined otherwise. */
function writablePin(pin: string | undefined): string | undefined {
  return pin !== undefined && /^\d+\.\d+\.\d+$/.test(pin) && !pinBefore(RULESET_FROM, pin) ? pin : undefined;
}

/** The pin of accord/config.yml at `ref` (the default ref a sync is about to take in), when it is one to write a `ruleset` under; undefined when it is not or git cannot say. */
function refPinOf(path: string, ref: string): string | undefined {
  try {
    return writablePin(pinOf(git(path, ['-c', 'log.showSignature=false', 'show', '--no-show-signature', `${ref}:accord/config.yml`])));
  } catch {
    return undefined;
  }
}

/**
 * ST-LN-96 D-02: write `ruleset: "<pin>"` into the ticket `rel` of the new worktree `path` so the claim commit carries it; true when the file changed. False
 * when the pin is not one to record, when the file already holds that exact value, or when the ticket cannot take the key (the claim stays the empty commit it was).
 */
function claimRuleset(path: string, rel: string): boolean {
  const pin = rulesetPinOf(path);
  if (pin === undefined) return false;
  try {
    return writeKey(path, rel, 'ruleset', pin);
  } catch {
    return false;
  }
}

/**
 * ST-LN-96 rel-ac-1 (RESEARCH Open Question 8): the claim pin to write as `ruleset` into the ticket of the worktree `path`, or undefined when nothing is to be
 * written: the ticket file holds no `ruleset` and no commit on the branch ever wrote one, it has a `claim: <id>` commit whose config pin is a plain x.y.z below RULESET_FROM, and git
 * could read it. A ticket whose file is only on its branch cannot be backfilled by `accord upgrade` (the upgrade branch has no such file), so its first sync does it. A rebase replays
 * the claim commit onto the new base, so after one the claim pin is the new base's: the pin is read BEFORE the sync, while the original claim commit is reachable (backfillRuleset's `ref`).
 */
function claimPinToBackfill(path: string, id: string, config: Pick<AccordConfig, 'commits'> | undefined): string | undefined {
  let text: string;
  try {
    text = readFileSync(`${path}/accord/tickets/${id}.md`, 'utf8');
  } catch {
    return undefined;
  }
  if (rulesetOfTicket(text) !== undefined) return undefined;
  const fact = gitClaimFacts(path, id, config);
  // a ruleset an earlier commit wrote and the file has lost is a hand removal: gate.ruleset-missing reports it, it is not backfilled
  if (fact === undefined || 'error' in fact || fact.ruleset !== undefined) return undefined;
  return fact.pin !== undefined && /^\d+\.\d+\.\d+$/.test(fact.pin) && pinBefore(RULESET_FROM, fact.pin) ? fact.pin : undefined;
}

/** What backfillRuleset wrote: the pin, the commit it made and the commit before it. */
interface Backfill {
  pin: string;
  commit: string;
  before: string;
}

/**
 * ST-LN-96 rel-ac-1, T-03.1-10: write `ruleset: "<claim pin>"` into the ticket in one records-only commit whose subject is `ruleset: <id> from its claim commit`, never `claim: <id>`, so the claim
 * reader still reads the original claim commit. Nothing is written without a pin from claimPinToBackfill, or unless the branch carries a pin that is a plain x.y.z not before RULESET_FROM (an
 * older repository's published schema refuses the field): the pin of the worktree, or, with `ref` (a sync that rewrites the branch is about to take it in), the pin of that ref. A rebase and a
 * git.sync script replay this commit, so they call it BEFORE the sync, with `ref`, when the claim commit and its merge base are still reachable; a merge keeps the claim commit and calls it after.
 * A failed write or commit is undone and named, and the sync stands. Returns what it wrote, for the caller to report; undefined when nothing was written.
 */
function backfillRuleset(ctx: CommandContext, id: string, path: string, ref?: string): Backfill | undefined {
  if (rulesetPinOf(path) === undefined && (ref === undefined || refPinOf(path, ref) === undefined)) return undefined;
  const pin = claimPinToBackfill(path, id, ctx.snapshot.config);
  if (pin === undefined) return undefined;
  // Phase 15 D-23: a ticket done on the default branch is not edited, so nothing is backfilled into it and nothing new is printed.
  if (doneOnDefaultBranch(path, id)) return undefined;
  const rel = ':(literal)' + `accord/tickets/${id}.md`;
  try {
    const before = git(path, ['rev-parse', 'HEAD']).trim();
    if (!writeKey(path, `accord/tickets/${id}.md`, 'ruleset', pin)) return undefined;
    git(path, ['add', '--', rel]);
    git(path, ['commit', '-q', '-m', renderSubject(ctx.snapshot.config, 'ruleset_backfill', id)]);
    return { pin, commit: git(path, ['rev-parse', 'HEAD']).trim(), before };
  } catch (e) {
    gitOk(path, ['checkout', 'HEAD', '--', rel]);
    ctx.stdout.write(`ruleset: ${id} could not be backfilled: ${firstLine(e instanceof UsageError ? e.message.split('\n').slice(-1)[0] : e)}\n`);
    return undefined;
  }
}

const backfilled = (ctx: CommandContext, id: string, b: Backfill | undefined): void => {
  if (b !== undefined) ctx.stdout.write(`backfilled: ${id} ruleset ${b.pin}\n`);
};

/**
 * The sync that followed a backfill commit was refused and left the branch as it was: take that commit off again, so the branch really is as it was (a branch pinned below RULESET_FROM
 * must not keep a `ruleset`). Only while HEAD is still that commit, nothing is under way and the tree is clean; `--keep` moves nothing else. Never fails the refusal it follows.
 */
function undoBackfill(path: string, b: Backfill): void {
  try {
    if (git(path, ['rev-parse', 'HEAD']).trim() !== b.commit) return;
    if (git(path, ['status', '--porcelain', '--untracked-files=no']).trim() !== '' || gitOk(path, ['rev-parse', '-q', '--verify', 'MERGE_HEAD'])) return;
    git(path, ['reset', '-q', '--keep', b.before]);
  } catch {
    // the commit stays; it is one the next sync replays
  }
}

/** The first word of a shell command line, quotes removed. */
const firstWord = (cmd: string) => (/^\s*(?:"([^"]*)"|'([^']*)'|(\S+))/.exec(cmd) ?? []).slice(1).find((w) => w !== undefined) ?? '';

/**
 * Run a network git command with prompts off. ssh gets BatchMode only when it is OpenSSH: git reads core.sshCommand before GIT_SSH, and
 * GIT_SSH_COMMAND before both, so the user's own program is never replaced and a non-OpenSSH command is passed through unchanged.
 */
export function gitNoPrompt(cwd: string, args: string[], timeout?: number, seen?: Map<string, string>, env?: NodeJS.ProcessEnv): string {
  // ST-LN-63: the configured command is read once per folder when the caller keeps a map for the run
  let configured = seen?.get(cwd);
  if (configured === undefined) {
    configured = '';
    try {
      configured = execFileSync('git', ['config', '--get', 'core.sshCommand'], { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    } catch {
      // not set
    }
    seen?.set(cwd, configured);
  }
  const fromEnv = (process.env.GIT_SSH_COMMAND ?? '') !== '';
  const cmd = fromEnv ? process.env.GIT_SSH_COMMAND! : configured;
  const base = firstWord(cmd).split(/[\\/]/).pop()!.toLowerCase();
  let ssh: string | undefined; // the core.sshCommand to inject
  if (cmd !== '') ssh = base === 'ssh' || base === 'ssh.exe' ? cmd + ' -o BatchMode=yes' : undefined;
  else if ((process.env.GIT_SSH ?? '') === '') ssh = 'ssh -o BatchMode=yes';
  return execFileSync('git', ['-c', 'credential.interactive=never', ...(ssh === undefined ? [] : ['-c', 'core.sshCommand=' + ssh]), ...args], {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    ...(timeout === undefined ? {} : { timeout }),
    env: { ...process.env, GIT_TERMINAL_PROMPT: '0', ...(ssh !== undefined && fromEnv ? { GIT_SSH_COMMAND: undefined } : {}), ...(env ?? {}) },
  });
}

const firstLine = (e: unknown) => String((e as { stderr?: string }).stderr ?? e).trim().split('\n')[0];

/**
 * Phase 15 D-15 (15-10): the progress refs come with every fetch of origin, so no teammate edits a git refspec. `-c remote.origin.fetch=` adds a value to the key (a multi-valued one), so the
 * refspec the clone was configured with (a single-branch clone, a pull-request namespace) keeps working beside it, and it is still one fetch. The copy lands under `origin-accord`, which no branch name reaches.
 */
const PROGRESS_FETCH = '+refs/accord/*:refs/remotes/origin-accord/*';

/**
 * ST-LN-30 D-01, D-06: fetch origin so a branch is cut and a claim judged from the latest refs; a failed fetch prints one line and the work goes on.
 * ST-LN-16: `ms` replaces the limit; `quiet` prints no failure line and the reason comes back as `why`; `keep` returns the context as it came, for a caller
 * that reloads in its own way after a fetch.
 */
export function fetchOrigin(
  ctx: CommandContext,
  known?: boolean,
  options: { ms?: number; quiet?: boolean; keep?: boolean } = {},
): { ctx: CommandContext; fetched: 'ok' | 'failed' | 'none'; why?: string } {
  // ST-LN-63: a context from a light preflight is finished here. With no fetch, or a failed one, nothing moved a ref or the working tree,
  // so the full load reuses what the light load read; after a fetch origin's refs may have moved, so it reads everything again.
  const finished = (): CommandContext => {
    if (ctx.light === undefined) return ctx;
    const { light, ...rest } = ctx;
    const loaded = loadWithBranch(ctx.root, { from: light });
    return { ...rest, snapshot: loadSnapshot(loaded.input), ...(loaded.branch === undefined ? {} : { branch: loaded.branch }) };
  };
  if (known !== true && !gitOk(ctx.root, ['remote', 'get-url', 'origin'])) return { ctx: finished(), fetched: 'none' };
  const ms = options.ms ?? fetchLimitMs();
  try {
    gitNoPrompt(ctx.root, ['-c', 'remote.origin.fetch=' + PROGRESS_FETCH, 'fetch', '--no-prune', 'origin'], ms, ctx.ssh);
  } catch (e) {
    const why = (e as NodeJS.ErrnoException).code === 'ETIMEDOUT' ? `no answer within ${ms / 1000} seconds` : firstLine(e);
    if (options.quiet !== true) ctx.stdout.write(withNext('fetch-failed', `fetch from origin failed, going on with the refs already in this clone: ${why}`) + '\n');
    return { ctx: finished(), fetched: 'failed', why };
  }
  if (options.keep === true) return { ctx, fetched: 'ok' };
  const full: CommandContext = { ...ctx, snapshot: loadSnapshot(loadFromFs(ctx.root)) };
  delete full.light;
  return { ctx: full, fetched: 'ok' };
}

/**
 * ST-LN-96 D-14: how a ticket branch takes `ref`, the fetched default branch, into the branch checked out in `root`. `merge` and `squash` (the
 * team's PR merge style; accord never syncs with `git merge --squash`) are an ordinary `--no-ff` merge, `rebase` a `git rebase <ref>`; a refused or
 * conflicting one is aborted, named, and leaves the branch as it was. A rebase returns the old-to-new commit pairs `git range-diff` reports.
 * ST-LN-96 D-03: with `team` (the `git.sync` command) the script runs instead, through runTeamCommand, and the result is `by: 'git.sync'`.
 */
export function syncDefault(
  root: string,
  ref: string,
  branch: string,
  strategy: 'merge' | 'rebase' | 'squash' | undefined,
  again: { conflict: string; clash: string },
  team?: { command: string; ticket: string },
): { rebased: Array<[string, string]>; by?: 'git.sync' } {
  if (team !== undefined) {
    runTeamSync(root, ref, branch, team);
    return { rebased: [], by: 'git.sync' };
  }
  const def = ref.replace('refs/remotes/', '');
  const rebase = strategy === 'rebase';
  const verb = rebase ? 'rebase' : 'merge';
  // git 2.56 ort ignores --no-overwrite-ignore: refuse by hand when the merge adds a path that is an untracked (ignored) file here
  const mine = git(root, ['diff', '--name-only', '--no-renames', '--diff-filter=A', '-z', 'HEAD', ref]).split('\0').filter((l) => l !== '');
  // git itself says which of those paths are untracked here, so a tracked file under another case is no clash; the pathspecs keep it from walking node_modules
  const here = mine.filter((f) => existsSync(root + '/' + f)); // keeps the command line short: a big merged PR adds hundreds of paths, none normally on disk
  const clash = here.length === 0 ? undefined : git(root, ['ls-files', '--others', '-z', '--', ...here.map((f) => ':(literal)' + f)]).split('\0').find((l) => l !== '');
  if (clash !== undefined) {
    throw new UsageError(withNext('merge-of', `${verb} of ${def} into ${branch} failed: ${clash} is an ignored file here that the ${verb} would overwrite - ${again.clash} - ${branch} is as it was`));
  }
  if (!rebase) {
    try {
      // the full ref: a short origin/main would resolve to a local branch or tag of that name first
      execFileSync('git', ['merge', '--no-ff', '--no-edit', '--no-overwrite-ignore', ref], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    } catch (e) {
      const files = git(root, ['diff', '--name-only', '-z', '--diff-filter=U']).split('\0').filter((l) => l !== '');
      if (gitOk(root, ['rev-parse', '-q', '--verify', 'MERGE_HEAD'])) git(root, ['merge', '--abort']);
      if (files.length > 0) {
        throw new UsageError(withNext('merge-of', `merge of ${def} into ${branch} stopped on a conflict in ${files.join(', ')} - the merge was aborted and ${branch} is as it was; ${again.conflict}`));
      }
      throw new UsageError(withNext('merge-of', `merge of ${def} into ${branch} failed: ${firstLine(e)} - ${branch} is as it was`));
    }
    return { rebased: [] };
  }
  const oldTip = git(root, ['rev-parse', 'HEAD']).trim();
  const oldBase = git(root, ['merge-base', 'HEAD', ref]).trim();
  try {
    execFileSync('git', ['rebase', ref], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  } catch (e) {
    const files = git(root, ['diff', '--name-only', '-z', '--diff-filter=U']).split('\0').filter((l) => l !== '');
    const dirs = ['rebase-merge', 'rebase-apply'].map((n) => resolve(root, git(root, ['rev-parse', '--git-path', n]).trim()));
    if (dirs.some((d) => existsSync(d))) git(root, ['rebase', '--abort']);
    if (files.length > 0) {
      throw new UsageError(withNext('merge-of', `rebase of ${def} into ${branch} stopped on a conflict in ${files.join(', ')} - the rebase was aborted and ${branch} is as it was; ${again.conflict}`));
    }
    throw new UsageError(withNext('merge-of', `rebase of ${def} into ${branch} failed: ${firstLine(e)} - ${branch} is as it was`));
  }
  // full shas (core.abbrev=40), cut to 12 below; a pair is a `=` or `!` line, an unpaired commit (`<` or `>`) names no old-to-new pair
  const pairs: Array<[string, string]> = [];
  const diff = git(root, ['-c', 'core.abbrev=40', 'range-diff', '--no-color', `${oldBase}..${oldTip}`, `${ref}..HEAD`]);
  for (const line of diff.split('\n')) {
    const m = /^\s*\d+:\s+([0-9a-f]{40})\s+[=!]\s+\d+:\s+([0-9a-f]{40})(?:\s|$)/.exec(line);
    if (m !== null) pairs.push([m[1].slice(0, 12), m[2].slice(0, 12)]);
  }
  return { rebased: pairs };
}

/** D-03 Ruling: a team sync script may run this long and print this much. */
const TEAM_SYNC_TIMEOUT_MS = 600_000;
const TEAM_SYNC_MAX_BUFFER = 64 * 1024 * 1024;

/**
 * ST-LN-96 D-03, D-01: run `git.sync` in the ticket's worktree with the ticket only in the environment, then judge it by exit code and by re-reading git:
 * a non-zero exit, a timeout, a branch left mid-merge or mid-rebase, or uncommitted tracked files is a refusal that names the command. The script's output is
 * quoted in the refusal, never read as a verdict. The ignored-file clash check is not made: accord cannot know what a team script writes.
 */
function runTeamSync(root: string, ref: string, branch: string, team: { command: string; ticket: string }): void {
  // the callers check this before any network call; it is checked here too, so no path runs a repository script that `accord trust` did not allow
  const refusal = scriptRefusal(root, 'git.sync', team.command);
  if (refusal !== undefined) throw new UsageError(withNext('trust', `${refusal} - ${branch} was not pushed`));
  const r = runTeamCommand(team.command, {
    cwd: root,
    env: { ...process.env, ACCORD_TICKET: team.ticket, ACCORD_BRANCH: branch, ACCORD_BASE_REF: ref, ACCORD_ROOT: root },
    timeoutMs: TEAM_SYNC_TIMEOUT_MS,
    maxBuffer: TEAM_SYNC_MAX_BUFFER,
  });
  const dirs = (): boolean => ['rebase-merge', 'rebase-apply'].some((n) => existsSync(resolve(root, git(root, ['rev-parse', '--git-path', n]).trim())));
  let why: string | undefined;
  if (r.timedOut) why = `timed out after ${TEAM_SYNC_TIMEOUT_MS / 1000} s`;
  else if (r.oversize) why = `printed more than ${TEAM_SYNC_MAX_BUFFER / 1024 / 1024} MiB`;
  else if (r.code !== 0) why = r.code === null ? `was killed${r.signal === null ? '' : ' by ' + r.signal}` : `exited ${r.code}`;
  else if (gitOk(root, ['rev-parse', '-q', '--verify', 'MERGE_HEAD'])) why = 'left a merge unfinished';
  else if (dirs()) why = 'left a rebase unfinished';
  else if (git(root, ['status', '--porcelain', '--untracked-files=no']).trim() !== '') why = 'left uncommitted changes to tracked files';
  if (why === undefined) return;
  const text = (r.stderr.trim() !== '' ? r.stderr : r.stdout).trim();
  const tail = text === '' ? '' : ' - ' + text.split('\n').slice(-20).map((l) => l.trimEnd()).join(' / ');
  throw new UsageError(`git.sync "${shown(team.command)}" ${why}${tail} - ${branch} was not pushed`);
}

/**
 * ST-LN-96 D-03, D-14: the push after a sync that may have rewritten the branch. `rebase` pushes with the lease when origin already holds the branch;
 * `team` (a git.sync script) with the lease when origin's branch is not an ancestor of HEAD, plainly otherwise; `merge` plainly. `unpublished: 'skip'`
 * pushes nothing when origin has no such branch. The lease keeps a teammate's commit from being overwritten.
 */
function pushAfterSync(ctx: CommandContext, root: string, branch: string, how: 'merge' | 'rebase' | 'team', unpublished: 'skip' | 'push'): { pushed: boolean; lease: boolean; why?: string } {
  const own = 'refs/remotes/origin/' + branch;
  const has = gitOk(root, ['rev-parse', '-q', '--verify', own]);
  if (!has && unpublished === 'skip') return { pushed: false, lease: false };
  const lease = has && (how === 'rebase' || (how === 'team' && !gitOk(root, ['merge-base', '--is-ancestor', own, 'HEAD'])));
  try {
    gitNoPrompt(root, ['push', ...(lease ? ['--force-with-lease', '--force-if-includes'] : []), 'origin', `refs/heads/${branch}:refs/heads/${branch}`], undefined, ctx.ssh);
    return { pushed: true, lease };
  } catch (e) {
    const why = String((e as { stderr?: string }).stderr ?? '').split('\n').map((l) => l.trim()).find((l) => /^(!|error:|fatal:|remote:)/.test(l)) ?? firstLine(e);
    return { pushed: false, lease, why };
  }
}

/** The accord/config.yml of the worktree at `path` as it is on disk, or undefined when it is missing or does not load (then the caller keeps its own). */
function worktreeConfigOf(path: string): AccordConfig | undefined {
  try {
    return loadConfig('accord/config.yml', readFileSync(path + '/accord/config.yml', 'utf8')).config;
  } catch {
    return undefined;
  }
}

/** ST-LN-25 D-01, D-09: Continue merges the fetched default branch into a ticket branch that is behind and still before verify, then runs setup and pushes; any doubt leaves the branch alone and prints the behind line. */
function continueMerge(ctx: CommandContext, id: string, path: string, branch: string): void {
  const ref = gitDefaultRef(ctx.root);
  if (ref === undefined) return;
  const n = Number(git(path, ['rev-list', '--count', 'HEAD..' + ref]).trim());
  if (n === 0) return;
  const def = ref.replace('refs/remotes/', '');
  // ST-LN-96 D-03, D-14: the way this team takes main is git.sync (a team command) before git.merge; absent both, a merge
  const strategy = ctx.snapshot.config?.git?.merge;
  // round 4 WR-05 (Ruling R12): the git.sync that runs, and that the allow is checked for, is the ticket worktree's own - the one `accord worktree sync <id>`
  // runs there and `accord trust` there shows - so following the behind: hint is what lets the next Continue sync
  const ticketConfig = worktreeConfigOf(path);
  const sync = ticketConfig === undefined ? ctx.snapshot.config?.git?.sync : ticketConfig.git?.sync;
  // `accord worktree sync` refuses before verify (and after it unless the built-in rebase applies), so the line names it as the command to run only where it works (WR-13)
  const stageOf = (): string | undefined => statusRows(snapshotAt(ctx.root, 'refs/heads/' + branch, [id])).find((r) => r.id === id)?.stage;
  const syncRuns = (): boolean => {
    const at = stageOf();
    return at === 'verify' || (at === 'done' && strategy === 'rebase' && sync === undefined);
  };
  const way = (): string => {
    if (sync !== undefined) return syncRuns() ? `sync them with git.sync, the team command (accord worktree sync ${id} runs it)` : `sync them with git.sync, the team command, which accord worktree sync ${id} runs at verify`;
    if (strategy === 'rebase') return syncRuns() ? `rebase onto it with accord worktree sync ${id}` : `rebase onto it, which accord worktree sync ${id} does at verify`;
    return `merge them with git merge ${def}`;
  };
  // a git.sync the person has not allowed is not run by Continue either: the branch stays as it is and the line says how to allow it
  const unallowed = sync !== undefined && scriptRefusal(path, 'git.sync', sync) !== undefined;
  // round 3 WR-03: the allow is checked against the ticket's worktree, not the checkout Continue runs from, so the line names that worktree
  const where = `"${shown(path.replaceAll('\\', '/'))}"`;
  const unallowedHint = `; git.sync is not allowed to run here yet - run accord trust in ${where} to see what it covers, then accord trust git.sync@<the digest it shows> there`;
  const behind = (): void => void ctx.stdout.write(withNext(unallowed ? 'trust' : 'behind', `behind: ${branch} is ${n} commit${n === 1 ? '' : 's'} behind ${def}; ${way()}${unallowed ? unallowedHint : ''}`) + '\n');
  // a remote branch with commits this clone lacks (a teammate pushed): the stage here may be stale, and the push would be refused
  const own = 'refs/remotes/origin/' + branch;
  if (gitOk(path, ['rev-parse', '-q', '--verify', own]) && !gitOk(path, ['merge-base', '--is-ancestor', own, 'HEAD'])) return behind();
  if (unallowed) return behind();
  const stage = stageOf();
  if (stage === undefined || !['intent', 'plan', 'build', 'review'].includes(stage)) return behind();
  if (git(path, ['status', '--porcelain', '--untracked-files=no']).trim() !== '' || gitOk(path, ['rev-parse', '-q', '--verify', 'MERGE_HEAD'])) return behind();
  try {
    if (claudeEnv(ctx.env) !== undefined) takeHold(ctx, id, path);
    else {
      const holds = readHoldsFile(ctx.root);
      const h = Object.hasOwn(holds, id) ? holds[id] : undefined;
      if (h !== undefined && isLive(h, processTable())) return behind();
    }
  } catch {
    return behind();
  }
  // ST-LN-96 rel-ac-1: a rebase and a git.sync script rewrite the claim commit, so the backfill is committed first and replayed by them
  const rewrites = sync !== undefined || strategy === 'rebase';
  const early = rewrites ? backfillRuleset(ctx, id, path, ref) : undefined;
  let done: ReturnType<typeof syncDefault>;
  try {
    done = syncDefault(
      path,
      ref,
      branch,
      strategy,
      {
        conflict:
          strategy === 'rebase'
            ? `rebase it by hand with git -C "${path}" rebase ${def}, resolve the conflicts and finish with git rebase --continue, then ask to continue ${id}`
            : `merge it by hand with git -C "${path}" merge ${def}, resolve the conflict and commit, then ask to continue ${id}`,
        clash: `move it, then ask to continue ${id}`,
      },
      sync === undefined ? undefined : { command: sync, ticket: id },
    );
  } catch (e) {
    if (early !== undefined) undoBackfill(path, early);
    throw e;
  }
  const how = done.by !== undefined ? 'team' : strategy === 'rebase' ? 'rebase' : 'merge';
  if (how === 'team') ctx.stdout.write(withNext('synced', `synced: ${branch} by git.sync`) + '\n');
  else if (how === 'rebase') for (const [was, now] of done.rebased) ctx.stdout.write(withNext('synced', `rebased: ${was} -> ${now}`) + '\n');
  else ctx.stdout.write(withNext('synced', `merged: ${n} commit${n === 1 ? '' : 's'} of ${def} into ${branch}`) + '\n');
  backfilled(ctx, id, early ?? (rewrites ? undefined : backfillRuleset(ctx, id, path)));
  // the marker of the pre-merge setup never stands for the merge commit
  rmSync(setupMarker(path), { force: true });
  let failure: unknown;
  try {
    prepare(path, ctx.root);
  } catch (e) {
    failure = e;
  }
  const push = pushAfterSync(ctx, path, branch, how, 'push');
  if (!push.pushed) {
    ctx.stdout.write(withNext('push-after-sync', `push of ${branch} failed: ${push.why} - ${push.lease ? `run accord worktree push ${id} --branch --force-with-lease after checking origin` : `push it with git -C "${path}" push origin ${branch}`}`) + '\n');
  }
  if (failure !== undefined) throw failure;
}

/** Where this clone last saw `refs/accord/<id>` on origin. */
const progressCopy = (id: string): string => 'refs/remotes/origin-accord/' + id;

/** Fetch origin's `refs/accord/<id>` into its local copy; an origin that has no such ref drops a stale copy. A failed fetch is no news: the push after it says what is wrong. */
function refreshProgressCopy(ctx: CommandContext, id: string): void {
  try {
    gitNoPrompt(ctx.root, ['fetch', '--no-prune', 'origin', `+refs/accord/${id}:${progressCopy(id)}`], undefined, ctx.ssh);
  } catch (e) {
    if (/couldn't find remote ref/.test(String((e as { stderr?: string }).stderr ?? ''))) gitOk(ctx.root, ['update-ref', '-d', progressCopy(id)]);
  }
}

/**
 * B-WR-02: may `branch` replace the progress ref? A tip that descends from the copy of the ref (or no ref on origin) is a fast-forward. A tip behind it would move another clone's progress back. A tip beside it is allowed only
 * when this branch once held the copy's commit (a reworded commit, a rebase: the reflog says so), as `--force-if-includes` judges a branch push; otherwise the ref holds commits this branch never had (a teammate's clone, an earlier claim).
 * Returns the sha to lease on ('' for no ref), or the reason to push nothing.
 */
function progressLease(ctx: CommandContext, id: string, branch: string): { seen: string } | { why: string } {
  const tip = git(ctx.root, ['rev-parse', `refs/heads/${branch}`]).trim();
  const copy = progressCopy(id);
  const seen = gitOk(ctx.root, ['rev-parse', '-q', '--verify', copy]) ? git(ctx.root, ['rev-parse', copy]).trim() : '';
  if (seen === '' || seen === tip || gitOk(ctx.root, ['merge-base', '--is-ancestor', seen, tip])) return { seen };
  if (gitOk(ctx.root, ['merge-base', '--is-ancestor', tip, seen])) return { why: 'is ahead of this branch (another clone or branch pushed more); it is not moved back' };
  let held: boolean;
  try {
    held = git(ctx.root, ['rev-list', '--walk-reflogs', `refs/heads/${branch}`]).split('\n').includes(seen);
  } catch {
    held = false; // no reflog to prove it: refuse
  }
  return held ? { seen } : { why: 'holds commits this branch never had (another clone or an earlier claim); it is not replaced' };
}

/**
 * Push `branch` to `refs/accord/<id>` with a lease on the local copy of that ref, and record the new tip in the copy. Undefined when it was pushed; the reason when it was not judged safe.
 * A lease that origin refuses (the ref moved since this clone fetched it) refreshes the copy once and judges again; any other git failure is thrown for the caller's one failure line.
 */
function pushProgressRef(ctx: CommandContext, id: string, branch: string): string | undefined {
  const ref = `refs/accord/${id}`;
  if (!gitOk(ctx.root, ['rev-parse', '-q', '--verify', progressCopy(id)])) refreshProgressCopy(ctx, id);
  for (let attempt = 0; ; attempt++) {
    const judged = progressLease(ctx, id, branch);
    if ('why' in judged) return judged.why;
    try {
      // no leading + on the refspec: a + forces the update whatever the lease says (reproduced with git 2.56), so the lease alone must carry the force
      gitNoPrompt(ctx.root, ['push', `--force-with-lease=${ref}:${judged.seen}`, 'origin', `refs/heads/${branch}:${ref}`], undefined, ctx.ssh);
    } catch (e) {
      if (attempt === 0 && /stale info/.test(String((e as { stderr?: string }).stderr ?? ''))) {
        refreshProgressCopy(ctx, id);
        continue;
      }
      throw e;
    }
    git(ctx.root, ['update-ref', progressCopy(id), git(ctx.root, ['rev-parse', `refs/heads/${branch}`]).trim()]);
    return undefined;
  }
}

/**
 * BUG-LN-11: push the ticket's claim branch by its ref, so it works from any worktree; a failed push is named with git's message and exits 0.
 * Phase 15 D-12 to D-15, D-33: with `branch` (verify's push) the claim branch goes to origin as always. Without it the progress goes to `refs/accord/<id>`, a ref that is not a branch
 * and starts no CI, only where `progress.push` allows (`progressPushTarget`); otherwise nothing is pushed, one note line is printed, and it reaches origin at verify.
 */
export function worktreePush(ctx: CommandContext, id: string, o: { lease?: boolean; branch?: boolean } = {}): number {
  if (!ID.test(id)) throw new UsageError('not a valid ticket id: ' + id);
  // B-WR-01: since Phase 15 a push without --branch goes to the progress ref, which the lease never applied to; the form every earlier release printed must fail loudly, not report success
  if (o.lease === true && o.branch !== true) throw new UsageError(`--force-with-lease replaces a branch on origin: run accord worktree push ${id} --branch --force-with-lease`);
  // Phase 15 D-31: in a slice worktree the branch pushed, and mirrored into the progress ref, is the slice branch this checkout is on; anywhere else it is the claim branch, as before
  const here = ctx.branch === undefined ? currentBranch(ctx.root) : ctx.branch.name;
  const branch = here !== undefined && sliceOfBranch(here)?.id === id ? here : branchOf(ctx.snapshot, id);
  const toRef = o.branch !== true;
  const ref = `refs/accord/${id}`;
  if (toRef) {
    let origin: string | undefined;
    try {
      origin = git(ctx.root, ['remote', 'get-url', 'origin']).trim();
    } catch {
      origin = undefined; // no origin counts as no host
    }
    if (progressPushTarget(ctx.snapshot.config, origin) === 'none') {
      const host = origin === undefined ? undefined : parseRepoUrl(origin)?.host;
      ctx.stdout.write(withNext('progress-not-pushed', `progress not pushed: progress.push is ${ctx.snapshot.config?.progress?.push ?? 'off'} for ${host ?? 'this origin'}; it reaches origin at verify`) + '\n');
      return 0;
    }
  }
  const kept = (why: string): number => {
    const line = toRef ? `push of ${ref} failed; its progress stays local until the next push` : `push of ${branch} failed; its commits stay local until the next push`;
    ctx.stdout.write(withNext('push-failed', line) + `\n${why}\n`);
    return 0;
  };
  if (ctx.snapshot.config?.commits?.trailers === 'forbid') {
    // a forbidden line on origin could only be removed by replacing history there, so nothing leaves this clone with one
    try {
      const hits = gitUnpushedCommits(ctx.root, branch).flatMap((c) => forbiddenLines(c.message).map((l) => trailerReason(c.sha, l)));
      if (hits.length > 0) return kept(`${hits.join('\n')}\nreword each commit named above to drop that line (it is not on origin yet), then run accord worktree push ${id}${toRef ? '' : ' --branch'} again`);
    } catch (e) {
      return kept(e instanceof UsageError ? e.message : firstLine(e));
    }
  }
  try {
    if (toRef) {
      // T-15-20: the id passed ID above, and the full ref name is checked again; B-WR-02: the ref moves forward, or by a rewrite of a commit this branch held, never over another clone's progress
      if (!gitOk(ctx.root, ['check-ref-format', ref])) return kept(`${ref} is not a valid ref name`);
      const refused = pushProgressRef(ctx, id, branch);
      if (refused !== undefined) {
        ctx.stdout.write(withNext('progress-not-pushed', `progress not pushed: ${ref} on origin ${refused}`) + '\n');
        return 0;
      }
    } else {
      // after a reworded commit: the lease keeps a push from replacing what origin got since this clone last saw it, and --force-if-includes keeps it from replacing a commit a fetch brought in that this branch never held
      const force = o.lease === true ? ['--force-with-lease', '--force-if-includes'] : [];
      gitNoPrompt(ctx.root, ['push', ...force, 'origin', `refs/heads/${branch}:refs/heads/${branch}`], undefined, ctx.ssh);
    }
  } catch (e) {
    const why = String((e as { stderr?: string }).stderr ?? '').trim();
    return kept(why === '' ? String(e) : why);
  }
  ctx.stdout.write(`pushed: ${toRef ? ref : branch}\n`);
  return 0;
}

/** The two records that bind a verification to a commit: the ticket's `verified_commit` and verification.md's `commit`. */
const BOUND = [
  { label: 'verified_commit', key: 'verified_commit', rel: (id: string) => `accord/tickets/${id}.md` },
  { label: 'verification commit', key: 'commit', rel: (id: string) => `accord/tickets/${id}/verification.md` },
] as const;

/**
 * ST-LN-96 D-16 Option E, T-03.1-09: right after accord's own built-in rebase in `root`, move `verified_commit` and verification.md's `commit:` to the rebased HEAD in one
 * records-only commit, so `accord gate done` passes in a clone that never held the old commit (CI after the force-push). Only a recorded commit the rebase rewrote (no longer an
 * ancestor of HEAD) is re-bound, and only when contentSinceOf says no file of the ticket differs from what was verified; the old objects are still in this clone. A change, an
 * absent object or a git failure writes nothing and prints `verify again:`. review.md heads and plan.md `baseline:` are never touched.
 */
function rebindAfterRebase(ctx: CommandContext, id: string, root: string): void {
  const say = (line: string): void => void ctx.stdout.write(line + '\n');
  const snap = loadSnapshot(loadFromFs(root));
  const recorded: Record<string, string | undefined> = {
    verified_commit: Object.hasOwn(snap.tickets, id) ? snap.tickets[id].frontmatter?.verified_commit : undefined,
    commit: Object.hasOwn(snap.verifications, id) ? snap.verifications[id].frontmatter?.commit : undefined,
  };
  const head = git(root, ['rev-parse', 'HEAD']).trim();
  const todo = BOUND.flatMap((b) => {
    const sha = recorded[b.key];
    // HEAD itself needs nothing, and a recorded commit still in HEAD's history was not rewritten: today's rule holds for it
    if (sha === undefined || !isSha(sha) || shaEqual(sha, head) || gitOk(root, ['merge-base', '--is-ancestor', sha, 'HEAD'])) return [];
    return [{ ...b, sha: sha.toLowerCase() }];
  });
  if (todo.length === 0) return;
  // Phase 15 D-23, A-WR-05: a ticket done on the default branch is not edited, so nothing is re-bound into it; one line says what was left as it is
  if (doneOnDefaultBranch(root, id)) {
    ctx.stderr.write('not written: ' + doneRefusal(id) + '\n');
    return;
  }
  const memo: ContentMemo = {};
  const refused: string[] = [];
  for (const sha of new Set(todo.map((t) => t.sha))) {
    const verdict = contentSinceOf(root, id, sha, memo);
    const was = sha.slice(0, 12);
    if (verdict === undefined) refused.push(`verify again: ${id}'s files could not be compared with ${was}, so its verification was not re-bound`);
    else if ('absent' in verdict) refused.push(`verify again: ${id}'s verified commit ${was} is not in this clone`);
    else if (verdict.changed.length > 0) refused.push(`verify again: ${id}'s files changed since ${was}: ${verdict.changed.join(', ')}`);
  }
  if (refused.length > 0) {
    for (const line of refused) say(line);
    return;
  }
  const rels = todo.map((t) => ':(literal)' + t.rel(id));
  try {
    for (const t of todo) writeKey(root, t.rel(id), t.key, head);
    git(root, ['add', '--', ...rels]);
    git(root, ['commit', '-q', '-m', renderSubject(ctx.snapshot.config, 'rebind', id)]);
  } catch (e) {
    // the rebase stands; the two records go back as the rebase left them, so the branch is never left half written
    gitOk(root, ['checkout', 'HEAD', '--', ...rels]);
    say(`verify again: ${id}'s verification could not be re-bound: ${firstLine(e instanceof UsageError ? e.message.split('\n').slice(-1)[0] : e)}`);
    return;
  }
  for (const t of todo) {
    // both records named one commit: the verified_commit line says it for both
    if (t.key === 'commit' && todo.some((o) => o.key === 'verified_commit' && o.sha === t.sha)) continue;
    say(`rebound: ${id} ${t.label} ${t.sha.slice(0, 12)} -> ${head.slice(0, 12)}`);
  }
}

/**
 * ST-LN-30 D-03, D-04, D-09, ST-LN-96 D-14, D-15: fetch, then take the remote default branch into the ticket branch the way `git.merge` says (a merge commit, or
 * a rebase with a lease push); a conflict is aborted, named, and exits 2. `accord worktree merge` is the same command under its old name.
 */
export function worktreeSync(ctx: CommandContext, id: string): number {
  if (!ID.test(id)) throw new UsageError('not a valid ticket id: ' + id);
  const branch = branchOf(ctx.snapshot, id);
  // refusals first: a refused merge makes no network call
  const cur = ctx.branch === undefined ? currentBranch(ctx.root) : ctx.branch.name;
  const onSlice = cur === undefined ? undefined : sliceOfBranch(cur);
  if (cur !== undefined && onSlice?.id === id) return syncSlice(ctx, id, cur, onSlice.n);
  if (cur !== branch) {
    throw new UsageError(`${id} is merged on its branch ${branch}, and this checkout is on ${cur ? cur : 'a detached HEAD'} - run accord worktree sync ${id} in the ticket's worktree; nothing was merged`);
  }
  if (git(ctx.root, ['status', '--porcelain', '--untracked-files=no']).trim() !== '') {
    throw new UsageError(`${ctx.root} has uncommitted changes to tracked files - commit them, then run accord worktree sync ${id} again; nothing was merged`);
  }
  const stage = statusRows(ctx.snapshot).find((r) => r.id === id)?.stage;
  // ST-LN-96 D-16: under the built-in rebase a verified ticket whose PR fell behind main is rebased and its verification re-bound; under merge, squash or git.sync a sync after
  // verify asks for verification again (the contents rule), so there the stage stays verify only
  const builtInRebase = ctx.snapshot.config?.git?.merge === 'rebase' && ctx.snapshot.config?.git?.sync === undefined;
  if (stage !== 'verify' && !(stage === 'done' && builtInRebase)) {
    throw new UsageError(`${id} is at stage ${stage ?? 'none'}, and accord worktree sync runs only at verify, after review - nothing was merged`);
  }
  // a repository script runs only once the person allowed it: refused before any network call, like the checks above
  const declared = ctx.snapshot.config?.git?.sync;
  const refusal = declared === undefined ? undefined : scriptRefusal(ctx.root, 'git.sync', declared);
  if (refusal !== undefined) throw new UsageError(withNext('trust', `${refusal} - nothing was synced`));
  if (!gitOk(ctx.root, ['remote', 'get-url', 'origin'])) return 0;
  fetchOrigin(ctx, true);
  const ref = gitDefaultRef(ctx.root);
  if (ref === undefined) {
    ctx.stdout.write('no origin/HEAD, origin/main or origin/master in this clone - nothing was merged\n');
    return 0;
  }
  if (gitOk(ctx.root, ['merge-base', '--is-ancestor', ref, 'HEAD'])) return 0;
  const strategy = ctx.snapshot.config?.git?.merge;
  const sync = ctx.snapshot.config?.git?.sync;
  // ST-LN-96 rel-ac-1: a rebase and a git.sync script rewrite the claim commit, so the backfill is committed first and replayed by them
  const rewrote = sync !== undefined || strategy === 'rebase';
  const early = rewrote ? backfillRuleset(ctx, id, ctx.root, ref) : undefined;
  let done: ReturnType<typeof syncDefault>;
  try {
    done = syncDefault(ctx.root, ref, branch, strategy, { conflict: 'resolve the conflict, then start verify again', clash: 'move it, then start verify again' }, sync === undefined ? undefined : { command: sync, ticket: id });
  } catch (e) {
    if (early !== undefined) undoBackfill(ctx.root, early);
    throw e;
  }

  if (rewrote) {
    if (done.by !== undefined) ctx.stdout.write(withNext('synced', `synced: ${branch} by ${done.by}`) + '\n');
    // the records that name a commit by sha (review heads, plan baseline) stay owner-typed: the pairs are what to retype
    else {
      for (const [was, now] of done.rebased) ctx.stdout.write(withNext('synced', `rebased: ${was} -> ${now}`) + '\n');
      // ST-LN-96 D-16 Option E: accord's own rebase keeps an unchanged verification valid; a hand rebase and a team script never reach this line
      rebindAfterRebase(ctx, id, ctx.root);
    }
  }
  backfilled(ctx, id, early ?? (rewrote ? undefined : backfillRuleset(ctx, id, ctx.root)));
  if (rewrote) {
    // every commit has a new sha, so a plain push is refused once origin holds the branch; the lease keeps a teammate's commit from being overwritten.
    // A team script is pushed too, even when origin has no such branch yet: the branch on origin must hold what the gate judges
    const push = pushAfterSync(ctx, ctx.root, branch, done.by !== undefined ? 'team' : 'rebase', done.by !== undefined ? 'push' : 'skip');
    if (push.pushed) ctx.stdout.write(`pushed: ${branch}\n`);
    else if (push.why !== undefined) ctx.stdout.write(withNext('push-after-sync', `push of ${branch} failed: ${push.why} - run accord worktree push ${id} --branch${push.lease ? ' --force-with-lease' : ''} after checking origin`) + '\n');
  }
  // preflight checked the pin before the merge, so this throws only when the merge changed it
  checkPin(ctx, id, ctx.root, branch, listWorktrees(ctx.root)[0].path);
  return 0;
}

/**
 * Phase 15 D-08, D-31 (Rulings R11, R12): `accord worktree sync <id>` on slice branch `slice/<id>/<n>`. Review changes slice n-1 after slice n was cut, and the change is MERGED forward, never rebased and never
 * force-pushed, whatever `git.merge` or `git.sync` says: the previous slice's branch of this repository (the claim branch for the first one after it; Phase 08.9.3 D-14, never a slice of another repository) while it is not merged into the default branch, else the default branch itself. A merge that
 * conflicts is aborted and named (exit 2) and the branch is as it was. It runs at any stage (slices are built before verify), pushes nothing and re-binds no verification: the slice's own push is `worktree push --branch`.
 */
function syncSlice(ctx: CommandContext, id: string, branch: string, n: number): number {
  if (git(ctx.root, ['status', '--porcelain', '--untracked-files=no']).trim() !== '') {
    throw new UsageError(`${ctx.root} has uncommitted changes to tracked files - commit them, then run accord worktree sync ${id} again; nothing was merged`);
  }
  // Phase 08.9.3 D-14: the previous slice of THIS repository (the claim branch for the first one), never a slice of another repository
  const home = sliceHomeOf(ctx.snapshot, id, n, branchOf(ctx.snapshot, id));
  if (home?.previous === undefined) throw new UsageError(`slice ${n} of ${id} has no earlier slice of this repository to merge - nothing was merged`);
  const previous = home.previous.branch;
  if (gitOk(ctx.root, ['remote', 'get-url', 'origin'])) fetchOrigin(ctx, true);
  const tipOf = (ref: string): string | undefined => (gitOk(ctx.root, ['rev-parse', '--verify', '-q', ref + '^{commit}']) ? git(ctx.root, ['rev-parse', '--verify', ref + '^{commit}']).trim() : undefined);
  // the branch of slice n-1: this clone's copy, or origin's when that is ahead of it (a teammate pushed the review fix) or the only one
  const local = 'refs/heads/' + previous;
  const origin = 'refs/remotes/origin/' + previous;
  const tips = { local: tipOf(local), origin: tipOf(origin) };
  const prevRef = tips.local === undefined ? (tips.origin === undefined ? undefined : origin) : tips.origin !== undefined && tips.origin !== tips.local && gitOk(ctx.root, ['merge-base', '--is-ancestor', tips.local, tips.origin]) ? origin : local;
  if (prevRef === undefined) throw new UsageError(`slice ${home.previous.n}'s branch ${previous} is neither here nor on origin - nothing was merged`);
  const def = gitDefaultRef(ctx.root);
  const prevTip = (prevRef === local ? tips.local : tips.origin) as string;
  const prevMerged = def !== undefined && safeTip(ctx.root, prevTip, undefined, def) === 'safe';
  const base = prevMerged ? (def as string) : prevRef;
  if (gitOk(ctx.root, ['merge-base', '--is-ancestor', base, 'HEAD'])) return 0;
  const count = Number(git(ctx.root, ['rev-list', '--count', 'HEAD..' + base]).trim());
  const again = `then run accord worktree sync ${id} again`;
  syncDefault(ctx.root, base, branch, 'merge', { conflict: `resolve it by hand, ${again}`, clash: `move it, ${again}` });
  const name = base.replace('refs/remotes/', '').replace('refs/heads/', '');
  ctx.stdout.write(withNext('synced', `merged: ${count} commit${count === 1 ? '' : 's'} of ${name} into ${branch}`) + '\n');
  return 0;
}

/** ST-LN-20 D-05, B-WR-03: after a good fetch, prune origin's stale refs (remote-tracking, progress copies under origin-accord, and tags a fetch refspec maps), naming each with its full sha (it can be the last copy of an unmerged branch). */
function pruneStale(ctx: CommandContext, report = false): Map<string, string> {
  const refs = () => git(ctx.root, ['for-each-ref', '--format=%(objectname) %(refname)']).split('\n').filter((r) => r !== '');
  const before = refs();
  // D-03: with `report` nothing is pruned; `git remote prune --dry-run origin` (read in the C locale) names the refs a prune would remove, and they are treated as gone
  const would = new Set<string>();
  try {
    if (report) {
      for (const l of gitNoPrompt(ctx.root, ['-c', 'remote.origin.fetch=' + PROGRESS_FETCH, 'remote', 'prune', '--dry-run', 'origin'], undefined, ctx.ssh, { LC_ALL: 'C' }).split('\n')) {
        const name = /^ \* \[would prune\] (.+?)\r?$/.exec(l)?.[1];
        if (name !== undefined) would.add(name.startsWith('refs/') ? name : 'refs/remotes/' + name);
      }
    } else gitNoPrompt(ctx.root, ['-c', 'remote.origin.fetch=' + PROGRESS_FETCH, 'remote', 'prune', 'origin'], undefined, ctx.ssh);
  } catch (e) {
    ctx.stdout.write(`prune of origin failed: ${firstLine(e)}
`);
  }
  const left = report ? new Set(before.filter((r) => !would.has(r.slice(r.indexOf(' ') + 1)))) : new Set(refs());
  const pruned = new Map<string, string>();
  for (const r of before) {
    if (left.has(r)) continue;
    const cut = r.indexOf(' ');
    ctx.stdout.write(`pruned ${r.slice(cut + 1)} (was ${r.slice(0, cut)})
`);
    pruned.set(r.slice(cut + 1), r.slice(0, cut));
  }
  return pruned;
}

/** The worktree list the last read in a clean left, for the pick-up that runs it; a removal clears it. */
interface SeenList {
  list?: WorktreeEntry[];
  /** ST-LN-55 D-11: set only by the session-start hook's clean, which never prunes the record of a worktree whose folder is missing. */
  keepMissing?: boolean;
  /** The `norm`ed folders this clean already wrote a `removed` or `kept` line for; no later phase judges them again. */
  judged?: Set<string>;
  /** The `norm`ed path of the main checkout and of every worktree any list read of this clean returned. */
  listed?: Set<string>;
  /** The main checkout, the first entry of a list read. */
  main?: string;
  /**
   * Phase 8.2 D-03: set only by `accord worktree clean --dry-run` ('online': it fetches as a real clean does) and `accord audit` ('offline': it fetches
   * nothing); every mutation of the clean is skipped and its line printed as a successful step would print it.
   */
  dry?: 'online' | 'offline';
  /** D-03: the `norm`ed paths of stale worktree records a dry run has already named; a real run prunes them once, so they are named once. */
  reported?: Set<string>;
}

/** ST-LN-69 D-19: one line of a clean, with its next action. */
function cleanSay(ctx: CommandContext, text: string): void {
  ctx.stdout.write(cleanLine(text) + '\n');
}

/** One folder line of a clean: `text` is written and the folder is remembered as judged. */
function folderLine(ctx: CommandContext, seen: SeenList, path: string, text: string): void {
  cleanSay(ctx, text);
  (seen.judged ??= new Set()).add(norm(path));
}

/** `worktrees(...)`, remembered in `seen` when there is one. For the hook's clean the list is never pruned: a folder that is missing may be an unmounted drive, so its entry stays and is named. */
function readList(ctx: CommandContext, seen?: SeenList): PrunableEntry[] {
  let list: PrunableEntry[];
  if (seen?.keepMissing === true) {
    list = listWorktrees(ctx.root);
    for (const w of list) {
      if (w.prunable === undefined || seen.judged?.has(norm(w.path)) === true) continue;
      folderLine(ctx, seen, w.path, `kept ${w.path}: its folder is missing (${w.prunable}); a session start never prunes its record`);
    }
  } else list = worktrees(ctx.root, ctx.stdout, seen === undefined ? undefined : (seen.judged ??= new Set()), seen?.dry === undefined ? undefined : (seen.reported ??= new Set()));
  if (seen !== undefined) {
    seen.list = list;
    seen.listed ??= new Set();
    for (const w of list) seen.listed.add(norm(w.path));
    if (seen.main === undefined && list.length > 0) seen.main = list[0].path;
  }
  return list;
}

interface GuardState {
  seen: SeenList;
  holds?: Record<string, Hold>;
  holdsError?: string;
  table?: ReturnType<typeof processTable>;
  /** `<git-common-dir>/accord`, read once per clean. */
  accord?: string;
  /** The record entries `cleanRecorded` read. */
  recorded?: { id: string; path: string }[];
  /** ST-LN-55 fix 5: the time (ms since the epoch) after which a hook clean starts no new unit of work. */
  until?: number;
  stopped?: boolean;
  /** Phase 8.2 D-03: the dry mode of this clean (see SeenList.dry); every site that deletes, writes or locks checks it. */
  dry?: 'online' | 'offline';
  /** D-03: the refs the dry run's prune report names; every later ref read of the run leaves them out, as it would after a real prune. */
  gone?: ReadonlySet<string>;
  /**
   * Phase 08.9 D-08: the batched facts of the audit's offline dry clean, set only there and in no other place; each table is read once per clean (the owner's snapshot-once ruling),
   * so every tip read answers from the one snapshot. Every site that reads one takes the lookup's answer when there is one and runs the per-branch read otherwise.
   */
  facts?: CleanFacts;
}

/**
 * ST-LN-55 fix 5: true once the time budget is spent, writing the stop line once. Called once per unit of work, never between two steps of
 * one unit, so a branch whose worktree is removed also loses its local branch and its origin branch in the same turn.
 */
function spent(ctx: CommandContext, s: GuardState): boolean {
  if (s.until === undefined) return false;
  if (s.stopped === true) return true;
  if (Date.now() < s.until) return false;
  s.stopped = true;
  cleanSay(ctx, 'clean stopped: its time budget is spent; the rest waits for the next session start');
  return true;
}

const halted = (s: GuardState): boolean => s.stopped === true;

/** The origin delete push gets the fetch limit while a budget is set, so a hung push fails with the usual kept line. */
const pushLimit = (s: GuardState): number | undefined => (s.until === undefined ? undefined : fetchLimitMs());

/** The guards every worktree removal passes; undefined (after a kept line) when one keeps the worktree, else the hold it may drop. */
function passGuards(ctx: CommandContext, w: PrunableEntry, id: string, s: GuardState, list: readonly WorktreeEntry[]): { h: Hold | undefined } | undefined {
  // readList already named a worktree whose folder is missing
  if (w.prunable !== undefined) return undefined;
  if (norm(w.path) === norm(ctx.root)) {
    cleanSay(ctx, `kept ${w.path}: this session's worktree`);
    return undefined;
  }
  // Task 6: `git worktree remove` would delete a worktree that sits inside this one, in an ignored folder
  const inner = list.find((x) => norm(x.path) !== norm(w.path) && norm(x.path).startsWith(norm(w.path) + '/'));
  if (inner !== undefined) {
    cleanSay(ctx, `kept ${w.path}: it holds the worktree ${inner.path}`);
    return undefined;
  }
  // D-08: `git worktree remove` deletes every ignored file, so they are judged here; `matching` lists an ignored file under a folder that is not itself ignored, and the untracked mode stays explicit whatever `status.showUntrackedFiles` says; --no-optional-locks keeps a session that is committing there from meeting index.lock (Review WR-02), and the audit runs this too
  const status = git(w.path, ['--no-optional-locks', 'status', '--porcelain', '-z', '--ignored=matching', '--untracked-files=normal', '--ignore-submodules=none']).split('\0').filter((e) => e !== '');
  if (status.some((e) => !e.startsWith('!! '))) {
    cleanSay(ctx, `kept ${w.path}: uncommitted work`);
    return undefined;
  }
  const names = disposableNames(ctx.snapshot.config?.disposable);
  const real = status.find((e) => !isDisposable(e.slice(3), names));
  if (real !== undefined) {
    cleanSay(ctx, `kept ${w.path}: ${real.slice(3)}`);
    return undefined;
  }
  // a nested repository in an ignored folder holds commits that `git worktree remove` would delete with it
  for (const e of status) {
    if (!e.endsWith('/')) continue;
    const nested = gitInside(w.path, e.slice(3));
    if (nested !== undefined) {
      cleanSay(ctx, `kept ${w.path}: ${repositoryReason(nested)}`);
      return undefined;
    }
  }
  const edited = editHiddenFromStatus(w.path);
  if (edited !== undefined) {
    cleanSay(ctx, `kept ${w.path}: ${hiddenEditReason(edited)}`);
    return undefined;
  }
  const holds = guardHolds(ctx, s, w.path);
  if (holds === undefined) return undefined;
  const h = Object.hasOwn(holds, id) ? holds[id] : undefined;
  const why = h === undefined ? undefined : holdReason(ctx, h, s);
  if (why !== undefined) {
    cleanSay(ctx, `kept ${w.path}: ${why}`);
    return undefined;
  }
  // fix 2: a hold of another ticket that names this folder keeps it too
  const elsewhere = heldElsewhere(ctx, w.path, id, s);
  if (elsewhere !== undefined) {
    cleanSay(ctx, `kept ${w.path}: ${elsewhere}`);
    return undefined;
  }
  return { h };
}

/**
 * Task 6: the first file on disk that the index flags skip-worktree (tag `S`) or assume-unchanged (a lower-case tag) and that differs from its
 * index entry, so `git status`, and with it `git worktree remove`, cannot see the edit. A flagged symlink counts as differing; a flagged entry
 * that is not on disk (a sparse checkout) never counts.
 */
function editHiddenFromStatus(path: string): string | undefined {
  for (const e of git(path, ['ls-files', '-v', '-z']).split('\0')) {
    if (e === '' || !/^[Sa-z] /.test(e)) continue;
    const file = e.slice(2);
    if (lstatSync(`${path}/${file}`, { throwIfNoEntry: false }) === undefined) continue;
    const row = /^(\d+) ([0-9a-f]+) /.exec(git(path, ['ls-files', '-s', '-z', '--', ':(literal)' + file]).split('\0')[0]);
    if (row === null || row[1] === '120000' || git(path, ['hash-object', '--', file]).trim() !== row[2]) return file;
  }
  return undefined;
}

/** The holds file, read once per clean; undefined after the line `say` writes when it could not be read, naming `path`. */
function guardHolds(ctx: CommandContext, s: GuardState, path: string, say: (text: string) => void = (t) => cleanSay(ctx, t)): Record<string, Hold> | undefined {
  if (s.holds === undefined && s.holdsError === undefined) {
    try {
      // D-03: a dry run reads the holds file without the lock, which creates a folder and a lock file
      if (s.dry !== undefined) s.holds = readHoldsFile(ctx.root);
      else withHolds(ctx.root, (h) => ((s.holds = h), undefined));
    } catch (e) {
      s.holdsError = firstLine(e instanceof UsageError ? e.message : e);
    }
  }
  if (s.holds === undefined) {
    say(`kept ${path}: its hold could not be read: ${s.holdsError}`);
    return undefined;
  }
  return s.holds;
}

/** Why the session of hold `h` keeps the folder it holds, or undefined when that session is gone. */
function holdReason(ctx: CommandContext, h: Hold, s: GuardState): string | undefined {
  let mine: Session | undefined;
  try {
    const claude = claudeEnv(ctx.env);
    if (claude !== undefined && h.marker === claude.marker) return `this session's worktree`;
    s.table ??= processTable();
    if (claude !== undefined) mine = sessionIn(claude, s.table, process.pid);
  } catch {
    return 'cannot tell whether the session holding it still runs';
  }
  return isLive(h, s.table) && !(mine !== undefined && sameSession(h, mine)) ? 'held by another session' : undefined;
}

/** ST-LN-55 fix 2: the reason a hold other than `skip` keeps `path`, going by the folder it names; the holds are already read into `s`. */
function heldElsewhere(ctx: CommandContext, path: string, skip: string | undefined, s: GuardState): string | undefined {
  for (const [key, h] of Object.entries(s.holds ?? {})) {
    if (key === skip || typeof h?.folder !== 'string' || norm(h.folder) !== norm(path)) continue;
    const why = holdReason(ctx, h, s);
    if (why !== undefined) return why;
  }
  return undefined;
}

/** `git worktree remove` with its three printed outcomes; the hold goes with a worktree that is gone. `failed` means the folder is still a worktree. */
function removeWorktree(ctx: CommandContext, w: WorktreeEntry, id: string, h: Hold | undefined, seen?: SeenList): { failed: boolean } {
  // D-03: a dry run names the removal as a successful one and removes nothing; the list, the record and the hold stay as they are
  if (seen?.dry !== undefined) {
    folderLine(ctx, seen, w.path, `removed ${w.path}`);
    return { failed: false };
  }
  let failure: string | undefined;
  try {
    execFileSync('git', ['worktree', 'remove', w.path], { cwd: ctx.root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  } catch (e) {
    failure = firstLine(e);
  }
  // the list held before this removal no longer stands; the read below, when there is one, is fresh
  if (seen !== undefined) seen.list = undefined;
  const listed = failure !== undefined && readList(ctx, seen).some((x) => x.path === w.path);
  const line = seen ?? {};
  if (listed) folderLine(ctx, line, w.path, `kept ${w.path}: git worktree remove failed: ${failure}`);
  else {
    // git unregistered the folder, but may leave links (Git for Windows leaves npm's junctions) or files behind; "removed" means the folder is gone
    const own = norm(w.path);
    const left = sweepRemoved(w.path, disposableNames(ctx.snapshot.config?.disposable), [...(seen?.listed ?? [])].filter((p) => p !== own));
    folderLine(ctx, line, w.path, left === undefined ? `removed ${w.path}` : `kept ${w.path}: ${left}`);
    if (left === undefined) {
      try {
        dropRecorded(ctx.root, w.path);
      } catch (e) {
        cleanSay(ctx, `note ${id}: the record of the removed worktree could not be updated: ${firstLine(e instanceof UsageError ? e.message : e)}`);
      }
    }
  }
  const gone = !listed;
  if (gone && h !== undefined) {
    try {
      withHolds(ctx.root, (all) => (Object.hasOwn(all, id) ? Object.fromEntries(Object.entries(all).filter(([k]) => k !== id)) : undefined));
    } catch (e) {
      cleanSay(ctx, `note ${id}: the hold of the removed worktree could not be dropped: ${firstLine(e instanceof UsageError ? e.message : e)}`);
    }
  }
  return { failed: !gone };
}

/**
 * ST-LN-55: one clean runs at a time per repository. Returns the open lock file, or the line that says why this clean skips. A lock is stale
 * when its pid no longer runs or it is more than an hour old.
 */
function takeCleanLock(dir: string): { fd: number; file: string } | string {
  const file = dir + '/clean.lock';
  mkdirSync(dir, { recursive: true });
  let owner = '?';
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const fd = openSync(file, 'wx');
      try {
        writeFileSync(fd, String(process.pid));
      } catch (e) {
        closeSync(fd);
        rmSync(file, { force: true });
        throw e;
      }
      return { fd, file };
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== 'EEXIST') throw e;
    }
    let pid: number;
    try {
      pid = Number.parseInt(readFileSync(file, 'utf8').trim(), 10);
      if (Number.isInteger(pid) && pid > 0) owner = String(pid);
    } catch {
      // the lock vanished between the open and the read: try the open again
      continue;
    }
    let stale = Date.now() - (statSync(file, { throwIfNoEntry: false })?.mtimeMs ?? Date.now()) > 3_600_000;
    if (!stale && Number.isInteger(pid) && pid > 0) {
      try {
        process.kill(pid, 0);
      } catch (e) {
        stale = (e as NodeJS.ErrnoException).code === 'ESRCH';
      }
    }
    if (!stale) break;
    rmSync(file, { force: true });
  }
  return `clean skipped: another accord worktree clean is running (pid ${owner})`;
}

/** D-05, D-16: fetch, prune stale remote refs, then (ST-LN-25 D-08) remove the worktree and delete the local branch of each ticket that is done on origin's main, then (ST-LN-34) those of dropped tickets, naming what is removed, deleted or kept. */
export interface CleanOpts {
  fetched?: 'ok' | 'failed' | 'none';
  skip?: string;
  seen?: SeenList;
  until?: number;
  dry?: 'online' | 'offline';
  /** Phase 15 D-20: the id of a ticket whose pull request merged; this session's hold on it is dropped, from outside its worktree, before the usual clean. */
  afterMerge?: string;
}

/** The worktree of ticket `id`: the one whose branch reads back as it, else the one the record of accord's worktrees names for it. */
function worktreeOfTicket(ctx: CommandContext, id: string): PrunableEntry | undefined {
  const templates = ctx.snapshot.branchTemplates ?? [DEFAULT_BRANCH_TEMPLATE];
  const list = listWorktrees(ctx.root).filter((w) => w.prunable === undefined);
  const byBranch = list.find((w) => w.branch !== undefined && ticketOfBranch(w.branch, templates, (i) => i === id, ctx.snapshot.config) === id);
  if (byBranch !== undefined) return byBranch;
  const recorded = readRecorded(ctx.root).filter((e) => e.id === id);
  return list.find((w) => recorded.some((e) => norm(e.path) === norm(w.path)));
}

/**
 * Phase 15 D-20, Pitfall 2, T-15-16: `--after-merge` never targets the folder the caller stands in. Refuses (exit 2) when `ctx.root` is `id`'s worktree or inside it;
 * returns the worktree otherwise (undefined when the ticket has none).
 */
function afterMergeTarget(ctx: CommandContext, id: string): PrunableEntry | undefined {
  if (!ID.test(id)) throw new UsageError(`--after-merge needs a ticket id, not ${JSON.stringify(id)}`);
  const w = worktreeOfTicket(ctx, id);
  if (w === undefined) return undefined;
  const here = norm(ctx.root);
  const there = norm(w.path);
  if (here === there || here.startsWith(there + '/')) {
    throw new UsageError(withNext('leave-first', `${w.path} is the worktree this session stands in: leave it first (ExitWorktree keep), then run accord worktree clean --after-merge ${id} again from the main checkout`));
  }
  return w;
}

/** The hold of `id` whose marker is this Claude Code session's, or undefined: another session's hold and a tool with no hold are never touched. */
function ownHoldOf(ctx: CommandContext, holds: Record<string, Hold>, id: string): Hold | undefined {
  const claude = claudeEnv(ctx.env);
  const h = Object.hasOwn(holds, id) ? holds[id] : undefined;
  return claude !== undefined && h?.marker === claude.marker ? h : undefined;
}

/** D-20: drop this session's hold on `id`, under the holds lock; the clean that follows judges the folder by every guard as before. */
function releaseOwnHold(ctx: CommandContext, id: string): void {
  let dropped = false;
  try {
    withHolds(ctx.root, (holds) => {
      if (ownHoldOf(ctx, holds, id) === undefined) return undefined;
      dropped = true;
      return Object.fromEntries(Object.entries(holds).filter(([k]) => k !== id));
    });
  } catch (e) {
    cleanSay(ctx, `note ${id}: the hold of this session could not be dropped: ${firstLine(e instanceof UsageError ? e.message : e)}`);
    return;
  }
  if (dropped) ctx.stdout.write(`released the hold of ${id}: this session left its worktree\n`);
}

export function worktreeClean(ctx: CommandContext, opts: CleanOpts = {}): number {
  const accord = git(ctx.root, ['rev-parse', '--path-format=absolute', '--git-common-dir']).trim() + '/accord';
  if (opts.afterMerge !== undefined) afterMergeTarget(ctx, opts.afterMerge);
  // D-03: a dry run writes nothing, the lock file included; it reads what a real run reads
  if (opts.dry !== undefined) return cleanLocked(ctx, opts, accord);
  const lock = takeCleanLock(accord);
  if (typeof lock === 'string') {
    cleanSay(ctx, lock);
    return 0;
  }
  try {
    if (opts.afterMerge !== undefined) releaseOwnHold(ctx, opts.afterMerge);
    return cleanLocked(ctx, opts, accord);
  } finally {
    closeSync(lock.fd);
    rmSync(lock.file, { force: true });
  }
}

function cleanLocked(ctx: CommandContext, opts: CleanOpts, accord: string): number {
  const seen = opts.seen ?? {};
  if (opts.dry !== undefined) seen.dry = opts.dry;
  readList(ctx, seen);
  const templates = ctx.snapshot.branchTemplates ?? [DEFAULT_BRANCH_TEMPLATE];
  // 'ok' and 'failed' come from a caller that found the origin remote; only a bare clean asks for it
  if (opts.fetched === 'none' || (opts.fetched === undefined && !gitOk(ctx.root, ['remote', 'get-url', 'origin']))) return 0;
  let pruned = new Map<string, string>();
  let fetchFailed = opts.fetched === 'failed';
  try {
    if (!fetchFailed) {
      if (opts.fetched === undefined) gitNoPrompt(ctx.root, ['-c', 'remote.origin.fetch=' + PROGRESS_FETCH, 'fetch', '--no-prune', 'origin'], undefined, ctx.ssh);
      // D-03: a dry run that fetches reports the prune read-only; one that does not fetch (the audit) reports none
      if (opts.dry === undefined) pruned = pruneStale(ctx);
      else if (opts.dry === 'online') pruned = pruneStale(ctx, true);
    }
  } catch (e) {
    fetchFailed = true;
    cleanSay(ctx, `fetch from origin failed, judging against the refs already in this clone: ${firstLine(e)}`);
  }
  const ref = gitDefaultRef(ctx.root);
  if (ref === undefined) return 0;
  const state: GuardState = {
    seen,
    accord,
    until: opts.until,
    dry: opts.dry,
    gone: opts.dry === undefined ? undefined : new Set(pruned.keys()),
    facts: opts.dry === 'offline' ? readCleanFacts(ctx.root, ref) : undefined,
  };
  // D-20, D-03: a dry run judges the folder as the real run will, with this session's hold already dropped, and writes nothing
  if (opts.dry !== undefined && opts.afterMerge !== undefined) {
    try {
      const all = readHoldsFile(ctx.root);
      if (ownHoldOf(ctx, all, opts.afterMerge) !== undefined) {
        ctx.stdout.write(`would release the hold of ${opts.afterMerge}: this session left its worktree\n`);
        state.holds = Object.fromEntries(Object.entries(all).filter(([k]) => k !== opts.afterMerge));
      }
    } catch {
      // an unreadable holds file is named by the guards below
    }
  }
  const merged = mergedTips(ctx.root, ref);
  cleanDone(ctx, ref, templates, state, fetchFailed, merged, opts.skip);
  if (halted(state)) return 0;
  cleanDropped(ctx, ref, templates, state, pruned, fetchFailed, merged, opts.skip);
  if (halted(state)) return 0;
  cleanRecorded(ctx, ref, state, fetchFailed, merged);
  if (halted(state)) return 0;
  cleanBranches(ctx, ref, state, merged);
  if (halted(state)) return 0;
  cleanSiblings(ctx, ref, state, fetchFailed);
  return 0;
}

/** ST-LN-87 D-19: the only non-ticket branches the clean judges, by prefix; a branch named any other way is never looked at. */
const CLEAN_PREFIXES = ['refs/heads/backlog/', 'refs/heads/fix/', 'refs/heads/release/'] as const;

/**
 * ST-LN-87 D-19: the local `backlog/*`, `fix/*` and `release/*` branches that are on `ref` or whose merge into it would change nothing (a squash or
 * rebase merge) are deleted, and the worktree that has one checked out goes first, through the guards every worktree removal passes. A branch with
 * commits `ref` lacks, a conflicting or unclear one, and one whose tip is on `ref`'s first-parent history (cut from it, no commit of its own yet; WR-01 of the phase 7 review) is kept and named. A ticket's own branch belongs to the phases above, and no remote branch
 * is ever touched: `ref` is origin's default, and what a host deletes after a merge is its own setting.
 */
function cleanBranches(ctx: CommandContext, ref: string, s: GuardState, merged: ReadonlySet<string>): void {
  const def = ref.replace('refs/remotes/', '');
  const templates = ctx.snapshot.branchTemplates ?? [DEFAULT_BRANCH_TEMPLATE];
  const known = (i: string) => Object.hasOwn(ctx.snapshot.tickets, i);
  const listed = git(ctx.root, ['for-each-ref', '--format=%(objectname)%00%(refname)', ...CLEAN_PREFIXES]).split('\n');
  const names = listed.flatMap((row) => {
    const cut = row.indexOf('\0');
    const name = cut < 0 ? '' : row.slice(cut + 1 + 'refs/heads/'.length).trim();
    return name === '' || ticketOfBranch(name, templates, known, ctx.snapshot.config) !== undefined ? [] : [name];
  });
  if (names.length === 0) return;
  const after = readList(ctx, s.seen);
  const tipOf = (b: string): string | undefined => {
    const snapTip = s.facts?.localTip(b);
    if (snapTip !== undefined) return snapTip ?? undefined;
    const args = ['rev-parse', '--verify', '-q', 'refs/heads/' + b];
    return gitOk(ctx.root, args) ? git(ctx.root, args).trim() : undefined;
  };
  // 07-review WR-01: a tip on ref's first-parent history is a branch cut from ref with no commit of its own yet (a branch merged through a merge commit has its tip only through a second parent)
  let spine: Set<string> | undefined;
  const fresh = (tip: string): boolean => {
    spine ??= new Set(git(ctx.root, ['rev-list', '--first-parent', ref]).split('\n').map((l) => l.trim().toLowerCase()));
    return spine.has(tip.toLowerCase());
  };
  const why = (tip: string, set?: ReadonlySet<string>): string | undefined => {
    if (fresh(tip)) return 'it has no commit of its own';
    const v = safeTip(ctx.root, tip, undefined, ref, set, s.facts);
    if (v === 'safe') return undefined;
    return v === 'conflict' ? `merging it into ${def} conflicts` : `it has commits ${def} lacks`;
  };
  for (const b of names.sort((x, y) => (x < y ? -1 : x > y ? 1 : 0))) {
    try {
      if (spent(ctx, s)) return;
      let L = tipOf(b);
      if (L === undefined) continue;
      const first = why(L, merged);
      if (first !== undefined) {
        cleanSay(ctx, `kept ${b}: ${first}`);
        continue;
      }
      // A worktree mid-rebase has a detached HEAD and shows no branch; its rebase still owns the branch.
      const rebasing = after.find((x) => x.branch === undefined && x.prunable === undefined && (s.facts === undefined ? rebaseBranch(x.path) : s.facts.rebaseOf(x.path, rebaseBranch)) === b);
      if (rebasing !== undefined) {
        cleanSay(ctx, `kept ${b}: being rebased in ${rebasing.path}`);
        continue;
      }
      const W = after.find((x) => x.branch === b);
      if (W !== undefined && W === after[0]) {
        cleanSay(ctx, `kept ${b}: checked out in ${W.path}`);
        continue;
      }
      if (W !== undefined) {
        const g = passGuards(ctx, W, b, s, after);
        if (g === undefined || removeWorktree(ctx, W, b, g.h, s.seen).failed) {
          cleanSay(ctx, `kept ${b}: checked out in ${W.path}`);
          continue;
        }
      }
      // A commit made while the guards ran counts: the delete names the sha it checked.
      const was = L;
      L = tipOf(b);
      if (L === undefined) continue;
      const again = L === was ? undefined : why(L);
      if (again !== undefined) {
        cleanSay(ctx, `kept ${b}: ${again}`);
        continue;
      }
      // D-03: a dry run names the delete as a successful one and deletes nothing
      if (s.dry === undefined) execFileSync('git', ['update-ref', '-d', 'refs/heads/' + b, L], { cwd: ctx.root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
      cleanSay(ctx, `deleted ${b}: merged into ${def} (was ${L})`);
    } catch (e) {
      cleanSay(ctx, `kept ${b}: could not be judged: ${firstLine(e instanceof UsageError ? e.message : e)}`);
    }
  }
}

/** ST-LN-55 D-01 part C: folders next to the main checkout, named for a done or dropped ticket, that git does not list and the record never named (left before the record existed). Judged by `cleanForgotten` with all its guards. */
function cleanSiblings(ctx: CommandContext, ref: string, s: GuardState, fetchFailed: boolean): void {
  const main = s.seen.main;
  if (main === undefined) return;
  const cut = main.lastIndexOf('/');
  const parent = main.slice(0, cut);
  const prefix = main.slice(cut + 1) + '-';
  let entries: Dirent[];
  try {
    entries = readdirSync(parent, { withFileTypes: true });
  } catch {
    return;
  }
  const known = new Set((s.recorded ?? []).map((e) => norm(e.path)));
  const folders = entries
    .filter((d) => d.isDirectory() && !d.isSymbolicLink() && d.name.startsWith(prefix) && d.name.length > prefix.length)
    .map((d) => ({ path: parent + '/' + d.name, rest: d.name.slice(prefix.length) }))
    .filter((f) => !s.seen.listed?.has(norm(f.path)) && s.seen.judged?.has(norm(f.path)) !== true && !known.has(norm(f.path)));
  if (folders.length === 0) return;
  // ids come from origin's default ref; a lower-cased id two tickets share is left out
  const byLower = new Map<string, string | null>();
  for (const f of git(ctx.root, ['ls-tree', '-z', '--name-only', ref, '--', 'accord/tickets/']).split('\0')) {
    const id = /^accord\/tickets\/([^/]+)\.md$/.exec(f)?.[1];
    if (id === undefined || !ID.test(id)) continue;
    const low = id.toLowerCase();
    byLower.set(low, byLower.has(low) ? null : id);
  }
  const candidates = folders.flatMap((f) => {
    const id = byLower.get(f.rest);
    return id === undefined || id === null ? [] : [{ ...f, id }];
  });
  if (candidates.length === 0) return;
  const ids = [...new Set(candidates.map((f) => f.id))];
  const done = new Set(statusRows(snapshotAt(ctx.root, ref, ids)).filter((r) => r.stage === 'done' && r.status !== 'dropped').map((r) => r.id));
  const dropped = fetchFailed ? new Set<string>() : droppedOn(ctx.root, ref, ids);
  for (const f of candidates.filter((c) => done.has(c.id) || dropped.has(c.id)).sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0))) {
    if (spent(ctx, s)) return;
    try {
      cleanForgotten(ctx, f.path, s);
    } catch (err) {
      folderLine(ctx, s.seen, f.path, `kept ${f.path}: could not be judged: ${firstLine(err instanceof UsageError ? err.message : err)}`);
    }
  }
}

/** ST-LN-55 D-04: a folder at a recorded path that git no longer lists. Every line goes through `folderLine`; true when the folder is gone. */
function cleanForgotten(ctx: CommandContext, path: string, s: GuardState): boolean {
  if (s.seen.judged?.has(norm(path)) === true) return false;
  const root = norm(ctx.root);
  const here = norm(path);
  if (root === here || root.startsWith(here + '/')) {
    folderLine(ctx, s.seen, path, `kept ${path}: this session's worktree`);
    return false;
  }
  if (guardHolds(ctx, s, path, (t) => folderLine(ctx, s.seen, path, t)) === undefined) return false;
  const elsewhere = heldElsewhere(ctx, path, undefined, s);
  if (elsewhere !== undefined) {
    folderLine(ctx, s.seen, path, `kept ${path}: ${elsewhere}`);
    return false;
  }
  const st = lstatSync(path, { throwIfNoEntry: false });
  if (st === undefined) return true;
  if (st.isSymbolicLink()) {
    folderLine(ctx, s.seen, path, `kept ${path}: it is a link`);
    return false;
  }
  if (!st.isDirectory()) {
    folderLine(ctx, s.seen, path, `kept ${path}: it is not a folder`);
    return false;
  }
  const left = sweepForgotten(path, [...(s.seen.listed ?? [])], s.dry !== undefined);
  folderLine(ctx, s.seen, path, left === undefined ? `removed ${path}` : `kept ${path}: ${left}`);
  return left === undefined;
}

/** ST-LN-55 D-07: the worktrees accord recorded for a ticket that is done or dropped on `ref`; one git lists on the ticket's own branch is left to the phases above, any other listed one is judged by its HEAD, one whose folder is gone leaves the record, one git forgot is swept. */
function cleanRecorded(ctx: CommandContext, ref: string, s: GuardState, fetchFailed: boolean, merged: ReadonlySet<string>): void {
  s.accord ??= git(ctx.root, ['rev-parse', '--path-format=absolute', '--git-common-dir']).trim() + '/accord';
  s.recorded = readRecorded(ctx.root, s.accord);
  if (s.recorded.length === 0) return;
  const ids = [...new Set(s.recorded.map((e) => e.id))];
  const done = new Set(statusRows(snapshotAt(ctx.root, ref, ids)).filter((r) => r.stage === 'done' && r.status !== 'dropped').map((r) => r.id));
  // a stale drop is not trusted, as cleanDropped refuses it
  const dropped = fetchFailed ? new Set<string>() : droppedOn(ctx.root, ref, ids);
  const todo = s.recorded.filter((e) => done.has(e.id) || dropped.has(e.id)).sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  if (todo.length === 0) return;
  const list = readList(ctx, s.seen);
  for (const e of todo) {
    if (s.seen.judged?.has(norm(e.path)) === true) continue;
    if (spent(ctx, s)) return;
    try {
      const W = list.find((w) => norm(w.path) === norm(e.path));
      if (W !== undefined) {
        cleanListed(ctx, ref, s, e.id, W, dropped.has(e.id), merged, list);
        continue;
      }
      // D-03: a dry run leaves the record as it is
      if ((lstatSync(e.path, { throwIfNoEntry: false }) === undefined || cleanForgotten(ctx, e.path, s)) && s.dry === undefined) dropRecorded(ctx.root, e.path);
    } catch (err) {
      folderLine(ctx, s.seen, e.path, `kept ${e.path}: could not be judged: ${firstLine(err instanceof UsageError ? err.message : err)}`);
    }
  }
}

/** ST-LN-55 D-07: a recorded worktree of a done or dropped ticket that git lists. Clean never removes by path a worktree on a branch, and a detached one only when its HEAD is on `ref` or at a branch tip (fix 1, fix 2). */
function cleanListed(ctx: CommandContext, ref: string, s: GuardState, id: string, W: PrunableEntry, dropped: boolean, merged: ReadonlySet<string>, list: readonly WorktreeEntry[]): void {
  if (W.prunable !== undefined) return; // readList already named it
  const def = ref.replace('refs/remotes/', '');
  if (W.branch !== undefined) {
    if (W.branch !== branchOf(ctx.snapshot, id)) {
      folderLine(ctx, s.seen, W.path, `kept ${W.path}: checked out on ${W.branch}`);
    } else if (dropped && (merged.has(W.head.toLowerCase()) || gitOk(ctx.root, ['merge-base', '--is-ancestor', W.head, ref]))) {
      // cleanDropped leaves such a branch and cleanDone judges only done tickets, so this line is the only word on it
      folderLine(ctx, s.seen, W.path, `kept ${W.path}: its ticket is dropped and its branch ${W.branch} is already on ${def}`);
    }
    return;
  }
  if (rebaseBranch(W.path) !== undefined) {
    folderLine(ctx, s.seen, W.path, `kept ${W.path}: being rebased`);
  } else if (onNoBranch(ctx.root, W.head, ref, merged, s.gone)) {
    folderLine(ctx, s.seen, W.path, `kept ${W.path}: its detached HEAD ${W.head} is on no branch`);
  } else {
    const g = passGuards(ctx, W, id, s, list);
    if (g !== undefined) removeWorktree(ctx, W, id, g.h, s.seen);
  }
}

/** The shas of the local and origin branches already on `ref`, from one query; a failure gives an empty set, so every tip goes to the checks. Keyed by sha, never by branch name: a branch that moves is not in it. */
function mergedTips(root: string, ref: string): Set<string> {
  try {
    return new Set(
      git(root, ['for-each-ref', '--merged', ref, '--format=%(objectname)', 'refs/heads', 'refs/remotes/origin'])
        .split('\n')
        .map((l) => l.trim().toLowerCase())
        .filter((l) => l !== ''),
    );
  } catch {
    return new Set();
  }
}

/** D-02: the clean a command runs on the side; a failure is named and never stops that command. */
export function cleanQuietly(ctx: CommandContext, fetched: 'ok' | 'failed' | 'none', skip?: string, o: { hook?: boolean; until?: number } = {}): WorktreeEntry[] | undefined {
  const seen: SeenList = o.hook === true ? { keepMissing: true } : {};
  try {
    worktreeClean(ctx, { fetched, skip, seen, until: o.until });
  } catch (e) {
    cleanSay(ctx, `clean failed, nothing more was removed: ${firstLine(e instanceof UsageError ? e.message : e)}`);
    return undefined;
  }
  return seen.list;
}

/** The branch a worktree's stopped rebase is rebuilding, or undefined. */
export function rebaseBranch(path: string): string | undefined {
  const dir = git(path, ['rev-parse', '--path-format=absolute', '--git-dir']).trim();
  for (const d of ['rebase-merge', 'rebase-apply']) {
    try {
      const h = readFileSync(`${dir}/${d}/head-name`, 'utf8').trim();
      if (h.startsWith('refs/heads/')) return h.slice('refs/heads/'.length);
    } catch {
      // no rebase of this kind
    }
  }
  return undefined;
}

/** ST-LN-25 D-08: is every commit of `tip` either on `ref`, in the verified commit `vc`, or past `vc` touching only paths `ref` leaves alone, or else a branch whose merge into `ref` adds nothing? A tip in `merged` (the shas of the branches already on `ref`) is on `ref` without a process; a miss runs every check. */
function safeTip(root: string, tip: string, vc: string | undefined, ref: string, merged?: ReadonlySet<string>, facts?: CleanFacts): 'safe' | 'conflict' | 'unsafe' {
  if (merged?.has(tip.toLowerCase()) === true || (facts?.onRef(tip) ?? gitOk(root, ['merge-base', '--is-ancestor', tip, ref]))) return 'safe';
  if (vc !== undefined) {
    if (gitOk(root, ['merge-base', '--is-ancestor', tip, vc])) return 'safe';
    if (!gitOk(root, ['merge-base', '--is-ancestor', vc, tip])) return 'unsafe';
    const names = (x: string, y: string) => git(root, ['diff', '--name-only', '-z', '--no-renames', x, y, '--']).split('\0').filter((n) => n !== '');
    const onMain = new Set(names(tip, ref));
    if (names(vc, tip).every((n) => !onMain.has(n))) return 'safe';
  }
  // Otherwise (no verified commit, or a later change main may hold): the branch goes only when merging it into main would change nothing; a conflict is never resolved.
  let out: string;
  try {
    out = execFileSync('git', ['merge-tree', '--write-tree', ref, tip], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  } catch (e) {
    // ST-LN-96 t1-ac-5: a squash- or rebase-merged branch whose files main edited again conflicts, yet everything it wrote is in main's history
    if ((e as { status?: number | null }).status !== 1) return 'unsafe';
    return blobsOnRef(root, tip, ref) ? 'safe' : 'conflict';
  }
  try {
    // Phase 08.9 D-08: on the offline dry path the default ref's tree is read once for all branches
    return out.split('\n')[0].trim() === (facts?.refTree() ?? git(root, ['rev-parse', ref + '^{tree}']).trim()) ? 'safe' : 'unsafe';
  } catch {
    return 'unsafe';
  }
}

/**
 * Phase 15 D-15: the progress ref of a ticket whose branches clean deletes: `refs/accord/<id>` on origin goes with a lease on the fetched sha, then the local copy in `refs/remotes/origin-accord/`. `P` is that copy;
 * `why` is the reason to keep it, when there is one. A dry run names the delete as a successful one and pushes nothing. A refused push is one `kept origin refs/accord/<id>: git push failed: ...` line and the work goes on;
 * origin no longer holding the ref (another clone cleaned it first, and this fetch does not prune) only drops the stale copy, with a `pruned` line.
 */
function deleteProgress(ctx: CommandContext, s: GuardState, id: string, P: string, why?: string): void {
  const name = 'refs/accord/' + id;
  if (why !== undefined) {
    cleanSay(ctx, `kept origin ${name}: ${why}`);
    return;
  }
  const local = 'refs/remotes/origin-accord/' + id;
  let gone = false;
  try {
    if (s.dry === undefined) gitNoPrompt(ctx.root, ['push', `--force-with-lease=${name}:${P}`, 'origin', ':' + name], pushLimit(s), ctx.ssh);
  } catch (e) {
    // a lease on a ref origin no longer has is refused as `stale info`, the same as one origin moved: only then, and only in a real run, origin is asked whether the ref is there at all
    try {
      gone = /stale info/.test(String((e as { stderr?: string }).stderr ?? '')) && gitNoPrompt(ctx.root, ['ls-remote', 'origin', name], pushLimit(s), ctx.ssh).trim() === '';
    } catch {
      gone = false;
    }
    if (!gone) {
      cleanSay(ctx, `kept origin ${name}: git push failed: ${firstLine(e)}`);
      return;
    }
  }
  if (s.dry === undefined) {
    try {
      execFileSync('git', ['update-ref', '-d', local, P], { cwd: ctx.root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    } catch {
      // the copy moved or is gone: the next fetch writes it again, or it never was
    }
  }
  cleanSay(ctx, gone ? `pruned ${local} (was ${P})` : `deleted origin ${name} (was ${P})`);
}

/** Phase 15 D-31: the record line of a slice branch that clean just deleted goes with it; a failed write is named and the clean goes on. */
function dropSliceLine(ctx: CommandContext, id: string, b: string): void {
  const slice = sliceOfBranch(b);
  if (slice === undefined) return;
  try {
    dropSlices(ctx.root, id, slice.n);
  } catch (e) {
    cleanSay(ctx, `note ${id}: the record of ${b} was not dropped: ${firstLine(e)}`);
  }
}

/** ST-LN-25 D-08: for each ticket branch whose ticket is done on `ref`, remove the worktree and delete the local branch when nothing beyond main is lost. */
function cleanDone(ctx: CommandContext, ref: string, templates: readonly string[], s: GuardState, fetchFailed: boolean, merged: ReadonlySet<string>, skip?: string): void {
  const known = (i: string) => Object.hasOwn(ctx.snapshot.tickets, i);
  const def = ref.replace('refs/remotes/', '');
  const tips = new Map<string, string | undefined>();
  const origin = new Map<string, string>();
  const progress = new Map<string, string>();
  for (const row of git(ctx.root, ['for-each-ref', '--format=%(objectname) %(refname)', 'refs/heads', 'refs/remotes/origin', 'refs/remotes/origin-accord']).split('\n')) {
    const cut = row.indexOf(' ');
    if (cut < 0) continue;
    const full = row.slice(cut + 1);
    if (full.startsWith('refs/remotes/origin-accord/')) {
      progress.set(full.slice('refs/remotes/origin-accord/'.length), row.slice(0, cut)); // D-15: read by ticket id below, never as a branch name
      continue;
    }
    if (s.gone?.has(full) === true) continue;
    const local = full.startsWith('refs/heads/');
    const name = full.slice(local ? 'refs/heads/'.length : 'refs/remotes/origin/'.length);
    if (name === 'HEAD' && !local) continue;
    tips.set(name, local ? row.slice(0, cut) : tips.get(name));
    if (!local) origin.set(name, row.slice(0, cut));
  }
  const ids = new Map<string, string>();
  for (const name of tips.keys()) {
    const id = ticketOfBranch(name, templates, known, ctx.snapshot.config);
    if (id !== undefined && id !== skip) ids.set(name, id);
  }
  const orphans = strandedProgress(progress, new Set(ids.values()), skip);
  if (ids.size === 0 && orphans.length === 0) return;
  const snap = snapshotAt(ctx.root, ref, [...new Set([...ids.values(), ...orphans])]);
  const done = new Set(statusRows(snap).filter((r) => r.stage === 'done' && r.status !== 'dropped').map((r) => r.id));
  const after = readList(ctx, s.seen);
  // Phase 08.9 D-08: on the offline dry path the commits the full-length verified commits of the done branches name come from one batch-check; a short one or a failed batch is read per branch below
  const verified = s.facts?.commitsOf([...ids.keys()].filter((n) => done.has(ids.get(n)!)).flatMap((n) => [snap.tickets[ids.get(n)!]?.frontmatter?.verified_commit]).filter((v): v is string => typeof v === 'string'));
  for (const b of [...ids.keys()].filter((n) => done.has(ids.get(n)!)).sort()) {
    const id = ids.get(b)!;
    try {
      if (spent(ctx, s)) return;
      // A worktree mid-rebase has a detached HEAD; its rebase still owns the branch.
      const rebasing = after.find((x) => x.branch === undefined && x.prunable === undefined && (s.facts === undefined ? rebaseBranch(x.path) : s.facts.rebaseOf(x.path, rebaseBranch)) === b);
      if (rebasing !== undefined) {
        cleanSay(ctx, `kept ${b}: being rebased in ${rebasing.path}`);
        continue;
      }
      const W = after.find((x) => x.branch === b);
      if (W !== undefined && W === after[0]) {
        cleanSay(ctx, `kept ${b}: checked out in ${W.path}`);
        continue;
      }
      const raw = snap.tickets[id]?.frontmatter?.verified_commit;
      const vcArgs = ['rev-parse', '--verify', '-q', String(raw) + '^{commit}'];
      const batched = typeof raw === 'string' ? verified?.get(raw) : undefined;
      const vc = batched !== undefined ? (batched ?? undefined) : typeof raw === 'string' && isSha(raw) && gitOk(ctx.root, vcArgs) ? git(ctx.root, vcArgs).trim() : undefined;
      const tipArgs = ['rev-parse', '--verify', '-q', 'refs/heads/' + b];
      // The set answers the first judgement of L and the one of R; the tip re-read after the guards gets every check.
      const reason = (t: string, set?: ReadonlySet<string>) => {
        const v = safeTip(ctx.root, t, vc, ref, set, s.facts);
        if (v === 'safe') return undefined;
        return v === 'conflict' ? `merging it into ${def} conflicts` : vc !== undefined ? 'it has commits after its verified commit' : `it has changes not on ${def}`;
      };
      const snapTip = s.facts?.localTip(b);
      let L = snapTip !== undefined ? (snapTip ?? undefined) : gitOk(ctx.root, tipArgs) ? git(ctx.root, tipArgs).trim() : undefined;
      const why = L === undefined ? undefined : reason(L, merged);
      if (why !== undefined) {
        cleanSay(ctx, `kept ${b}: ${why}`);
        continue;
      }
      if (W !== undefined) {
        const g = passGuards(ctx, W, id, s, after);
        if (g === undefined || removeWorktree(ctx, W, id, g.h, s.seen).failed) {
          cleanSay(ctx, `kept ${b}: checked out in ${W.path}`);
          continue;
        }
      }
      if (L !== undefined) {
        // A commit made while the guards ran counts: the delete names the sha it checked.
        const snapAgain = s.facts?.localTip(b);
        L = typeof snapAgain === 'string' ? snapAgain : git(ctx.root, tipArgs).trim();
        const again = reason(L);
        if (again !== undefined) {
          cleanSay(ctx, `kept ${b}: ${again}`);
          continue;
        }
        // D-03: a dry run names the delete as a successful one and deletes nothing
        if (s.dry === undefined) {
          execFileSync('git', ['update-ref', '-d', 'refs/heads/' + b, L], { cwd: ctx.root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
          dropSliceLine(ctx, id, b);
        }
        cleanSay(ctx, `deleted ${b} (was ${L})`);
      }
      // The origin branch goes with a lease on the fetched sha; after a failed fetch it is not judged.
      const R = origin.get(b);
      // D-15: the ticket's progress ref goes where its origin branch goes, judged as the branch is, and also when the host already deleted the branch
      const P = progress.get(id);
      const dropProgress = (): void => {
        if (P !== undefined) deleteProgress(ctx, s, id, P, reason(P, merged));
      };
      if (fetchFailed) continue;
      if (R === undefined) {
        dropProgress();
        continue;
      }
      const why2 = reason(R, merged);
      if (why2 !== undefined) {
        cleanSay(ctx, `kept origin/${b}: ${why2}`);
        continue;
      }
      try {
        // D-03: no push in a dry run; the success line is printed as a real push would print it
        if (s.dry === undefined) gitNoPrompt(ctx.root, ['push', `--force-with-lease=refs/heads/${b}:${R}`, 'origin', ':refs/heads/' + b], pushLimit(s), ctx.ssh);
      } catch (e) {
        cleanSay(ctx, `kept origin/${b}: git push failed: ${firstLine(e)}`);
        continue;
      }
      cleanSay(ctx, `deleted origin/${b} (was ${R})`);
      dropProgress();
    } catch (e) {
      cleanSay(ctx, `kept ${b}: could not be judged: ${firstLine(e instanceof UsageError ? e.message : e)}`);
    }
  }
  // B-WR-10: a done ticket whose branches are gone from this clone and from origin still has its progress ref; no branch led the loop above to it
  if (fetchFailed) return;
  for (const id of orphans.filter((i) => done.has(i)).sort()) {
    try {
      if (spent(ctx, s)) return;
      const P = progress.get(id)!;
      const raw = snap.tickets[id]?.frontmatter?.verified_commit;
      const vcArgs = ['rev-parse', '--verify', '-q', String(raw) + '^{commit}'];
      const vc = typeof raw === 'string' && isSha(raw) && gitOk(ctx.root, vcArgs) ? git(ctx.root, vcArgs).trim() : undefined;
      const v = safeTip(ctx.root, P, vc, ref, merged, s.facts);
      deleteProgress(ctx, s, id, P, v === 'safe' ? undefined : v === 'conflict' ? `merging it into ${def} conflicts` : vc !== undefined ? 'it has commits after its verified commit' : `it has changes not on ${def}`);
    } catch (e) {
      cleanSay(ctx, `kept origin refs/accord/${id}: could not be judged: ${firstLine(e instanceof UsageError ? e.message : e)}`);
    }
  }
}

/** B-WR-10: the ids that have a progress copy and no branch of this clone or origin (`held` holds the ids the branches name), ticket ids only: an id becomes a path when its ticket is read. */
function strandedProgress(progress: ReadonlyMap<string, string>, held: ReadonlySet<string>, skip?: string): string[] {
  return [...progress.keys()].filter((i) => i !== skip && !held.has(i) && ID.test(i));
}

/** ST-LN-13: the first research record the ticket lists at `tip` whose copy the history of `ref` never held, or undefined. */
function researchNotOn(root: string, tip: string, ref: string, id: string, answers?: ResearchAnswers): string | undefined {
  const file = 'accord/tickets/' + id + '.md';
  // Phase 08.9 D-08: on the offline dry path the ticket text and the blob names come from the batched reads; anything they did not answer is read as before
  const given = answers?.ticket(tip, id);
  const files = given === undefined ? gitFilesAt(root, tip, [file]) : given === null ? {} : { [file]: given };
  if (!Object.hasOwn(files, file)) return undefined;
  const tickets = loadSnapshot({ files, tree: [] }).tickets;
  if (!Object.hasOwn(tickets, id)) return undefined;
  const blob = (c: string, p: string): string | undefined => {
    const named = answers?.blob(c, p);
    if (named !== undefined) return named ?? undefined;
    const args = ['rev-parse', '--verify', '-q', c + ':' + p];
    return gitOk(root, args) ? git(root, args).trim() : undefined;
  };
  for (const p of [...new Set(tickets[id].frontmatter?.research ?? [])].filter(isResearchPath)) {
    const atTip = blob(tip, p);
    if (atTip === undefined || atTip === blob(ref, p)) continue;
    if (git(root, ['-c', 'log.showSignature=false', 'log', '--no-show-signature', '-1', '--format=%H', '--find-object=' + atTip, ref, '--', ':(literal)' + p]).trim() !== '') continue;
    return p;
  }
  return undefined;
}

/** ST-LN-34: for each ticket branch whose ticket is dropped on `ref`, delete the worktree, the origin branch and the local branch when nothing beyond origin is lost. */
function cleanDropped(ctx: CommandContext, ref: string, templates: readonly string[], s: GuardState, pruned: Map<string, string>, fetchFailed: boolean, merged: ReadonlySet<string>, skip?: string): void {
  const known = (i: string) => Object.hasOwn(ctx.snapshot.tickets, i);
  const tips = new Map<string, { L?: string; R?: string }>();
  const progress = new Map<string, string>();
  for (const row of git(ctx.root, ['for-each-ref', '--format=%(objectname) %(refname)', 'refs/heads', 'refs/remotes/origin', 'refs/remotes/origin-accord']).split('\n')) {
    const cut = row.indexOf(' ');
    if (cut < 0) continue;
    const sha = row.slice(0, cut);
    const full = row.slice(cut + 1);
    if (full.startsWith('refs/remotes/origin-accord/')) {
      progress.set(full.slice('refs/remotes/origin-accord/'.length), sha); // D-15: read by ticket id below, never as a branch name
      continue;
    }
    if (s.gone?.has(full) === true) continue;
    const local = full.startsWith('refs/heads/');
    const name = full.slice(local ? 'refs/heads/'.length : 'refs/remotes/origin/'.length);
    if (name === 'HEAD' && !local) continue;
    tips.set(name, { ...tips.get(name), [local ? 'L' : 'R']: sha });
  }
  // A merged ticket stays on the merged path above; a merged origin branch is left to the host.
  const ids = new Map<string, string>();
  for (const [name, t] of tips) {
    const id = ticketOfBranch(name, templates, known, ctx.snapshot.config);
    const tip = (t.L ?? t.R)!;
    if (id !== undefined && id !== skip && !merged.has(tip.toLowerCase()) && !(s.facts?.onRef(tip) ?? gitOk(ctx.root, ['merge-base', '--is-ancestor', tip, ref]))) ids.set(name, id);
  }
  // B-WR-10: ids with a progress copy and no branch at all, here or on origin (a merged branch above is no branch here, and its ref went with it on the merged path)
  const named = new Set([...tips.keys()].flatMap((n) => ticketOfBranch(n, templates, known, ctx.snapshot.config) ?? []));
  const orphans = strandedProgress(progress, named, skip);
  if (ids.size === 0 && orphans.length === 0) return;
  const dropped = droppedOn(ctx.root, ref, [...new Set([...ids.values(), ...orphans])]);
  if (fetchFailed && ([...ids.keys()].some((n) => dropped.has(ids.get(n)!)) || orphans.some((i) => dropped.has(i)))) {
    cleanSay(ctx, 'kept dropped tickets: fetch from origin failed');
    return;
  }
  const after = readList(ctx, s.seen);
  // Phase 08.9 D-08, offline dry path only: the ticket texts and research blobs at the tips about to be judged, and the commits origin lacks on each local-only branch, are read once for all of them
  const judging = [...ids.keys()].filter((n) => dropped.has(ids.get(n)!)).sort();
  const judgedAt = (b: string): string | undefined => {
    const snapTip = s.facts?.localTip(b);
    return typeof snapTip === 'string' ? snapTip : snapTip === null ? tips.get(b)!.R : (tips.get(b)!.L ?? tips.get(b)!.R);
  };
  const research = s.facts?.researchAt(judging.flatMap((b) => [{ tip: judgedAt(b), id: ids.get(b)! }]).filter((i): i is { tip: string; id: string } => i.tip !== undefined));
  const lacking = s.facts?.notOnOrigin(judging.filter((b) => tips.get(b)!.R === undefined).flatMap((b) => judgedAt(b) ?? []));
  for (const b of [...ids.keys()].filter((n) => dropped.has(ids.get(n)!)).sort()) {
    const id = ids.get(b)!;
    try {
      if (spent(ctx, s)) return;
      const W = after.find((x) => x.branch === b);
      // A worktree mid-rebase has a detached HEAD and shows no branch; its rebase still owns the branch.
      const rebasing = after.find((x) => x.branch === undefined && x.prunable === undefined && (s.facts === undefined ? rebaseBranch(x.path) : s.facts.rebaseOf(x.path, rebaseBranch)) === b);
      if (rebasing !== undefined) {
        cleanSay(ctx, `kept ${b}: being rebased in ${rebasing.path}`);
        continue;
      }
      if (W !== undefined && W === after[0]) {
        cleanSay(ctx, `kept ${b}: checked out in ${W.path}`);
        continue;
      }
      let g: { h: Hold | undefined } | undefined;
      if (W !== undefined) {
        g = passGuards(ctx, W, id, s, after);
        if (g === undefined) continue;
      }
      // Re-read the local tip: a commit made in the worktree while the guards ran counts, and the printed sha is the deleted one.
      const args = ['rev-parse', '--verify', '-q', 'refs/heads/' + b];
      const snapTip = s.facts?.localTip(b);
      const L = snapTip !== undefined ? (snapTip ?? undefined) : gitOk(ctx.root, args) ? git(ctx.root, args).trim() : undefined;
      const R = tips.get(b)!.R;
      if (L !== undefined && R !== undefined && L !== R) {
        if (gitOk(ctx.root, ['merge-base', '--is-ancestor', R, L])) {
          cleanSay(ctx, `kept ${b}: ${git(ctx.root, ['rev-list', '--count', `${R}..${L}`]).trim()} commits not on origin`);
        } else cleanSay(ctx, `kept ${b}: origin/${b} has commits not here`);
        continue;
      }
      if (L !== undefined && R === undefined && pruned.get('refs/remotes/origin/' + b) !== L) {
        // D-03: a ref the dry run's prune report names is not counted as origin's, as it is not after a real prune
        const excluded = [...(s.gone ?? [])].filter((r) => r.startsWith('refs/remotes/')).map((r) => '--exclude=' + r.slice('refs/remotes/'.length));
        // Phase 08.9 D-08: with no ref the dry run's prune report names, the batched count of the tip answers; otherwise, or unanswered, today's count runs
        const counted = s.gone === undefined || s.gone.size === 0 ? lacking?.get(L) : undefined;
        const n = counted ?? Number(git(ctx.root, ['rev-list', '--count', L, '--not', ...excluded, '--remotes=origin']).trim());
        if (n > 0) {
          cleanSay(ctx, `kept ${b}: ${n} commits not on origin`);
          continue;
        }
      }
      const at = L ?? R;
      const lost = at === undefined ? undefined : researchNotOn(ctx.root, at, ref, id, research);
      if (lost !== undefined) {
        const d = ref.replace('refs/remotes/origin/', '');
        cleanSay(ctx, `kept ${b}: research record ${lost} is not on ${d} as ${b} holds it - make the record on ${b} equal to the copy on ${d}, or put it on ${d}, then push`);
        continue;
      }
      // git refuses to delete a branch checked out in a worktree, and a branch must not lose its folder after its origin copy is gone.
      if (W !== undefined && removeWorktree(ctx, W, id, g!.h, s.seen).failed) continue;
      if (R !== undefined) {
        try {
          // D-03: no push in a dry run; the success line is printed as a real push would print it
          if (s.dry === undefined) gitNoPrompt(ctx.root, ['push', `--force-with-lease=refs/heads/${b}:${R}`, 'origin', ':refs/heads/' + b], pushLimit(s), ctx.ssh);
        } catch (e) {
          cleanSay(ctx, `kept origin/${b}: git push failed: ${firstLine(e)}`);
          if (L !== undefined) cleanSay(ctx, `kept ${b}: its origin branch was not deleted`);
          continue;
        }
        cleanSay(ctx, `deleted origin/${b} (was ${R})`);
      }
      // D-15: the progress ref goes with the branches when the local or origin branch holds every commit of it, so a delete never takes the only copy of a commit
      const P = progress.get(id);
      if (P !== undefined && !fetchFailed) {
        const held = [L, R].some((x) => x !== undefined && (x === P || gitOk(ctx.root, ['merge-base', '--is-ancestor', P, x])));
        deleteProgress(ctx, s, id, P, held ? undefined : `it has commits not on ${b}`);
      }
      if (L !== undefined) {
        try {
          // D-03: a dry run names the delete as a successful one and deletes nothing
          if (s.dry === undefined) {
            execFileSync('git', ['update-ref', '-d', 'refs/heads/' + b, L], { cwd: ctx.root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
            dropSliceLine(ctx, id, b);
          }
          cleanSay(ctx, `deleted ${b} (was ${L})`);
        } catch (e) {
          cleanSay(ctx, `kept ${b}: git update-ref failed: ${firstLine(e)}`);
        }
      }
    } catch (e) {
      cleanSay(ctx, `kept ${b}: could not be judged: ${firstLine(e instanceof UsageError ? e.message : e)}`);
    }
  }
  // B-WR-10: a dropped ticket's progress ref when no branch of this clone or origin is left; with no branch to hold its commits it goes only when the default branch already does
  if (fetchFailed) return;
  for (const id of orphans.filter((i) => dropped.has(i)).sort()) {
    try {
      if (spent(ctx, s)) return;
      const P = progress.get(id)!;
      const held = s.facts?.onRef(P) ?? gitOk(ctx.root, ['merge-base', '--is-ancestor', P, ref]);
      deleteProgress(ctx, s, id, P, held ? undefined : 'it has commits no branch holds');
    } catch (e) {
      cleanSay(ctx, `kept origin refs/accord/${id}: could not be judged: ${firstLine(e instanceof UsageError ? e.message : e)}`);
    }
  }
}

/** D-13: write the new ticket in its own worktree on its claim branch, commit and push it, then run setup there. */
export function newTicketWorktree(ctx: CommandContext, id: string, rel: string, text: string, seen?: WorktreeEntry[]): void {
  const enter = canEnter(ctx);
  const branch = branchOf(ctx.snapshot, id, branchFieldsOf(text));
  if (branch.includes('{type}')) refuseUntyped(ctx, id, 'the new ticket has no change: word that branch_types allows', 'nothing was written', 'give --change <word>');
  checkClaimName(ctx, id, branch, 'nothing was written');
  const all = (seen ?? worktrees(ctx.root, ctx.stdout)) as PrunableEntry[];
  const list = all.filter((w) => w.prunable === undefined);
  const exists =
    list.some((w) => w.branch === branch) ||
    gitOk(ctx.root, ['rev-parse', '--verify', '-q', 'refs/heads/' + branch]) ||
    gitOk(ctx.root, ['rev-parse', '--verify', '-q', 'refs/remotes/origin/' + branch]);
  if (exists) throw new UsageError(`${branch} already exists - nothing was written`);
  const ref = gitDefaultRef(ctx.root);
  if (ref === undefined) throw new UsageError('no origin/main in this clone - run git fetch origin, then try again');
  if (gitOk(ctx.root, ['cat-file', '-e', `${ref}:${rel}`])) {
    throw new UsageError(`${rel} already exists on ${ref.replace('refs/remotes/', '')} - nothing was written`);
  }
  const path = siblingOf(list[0].path, id);
  if (all.some((w) => w.prunable !== undefined && norm(w.path) === norm(path))) refuseAt(id, path, 'nothing was written');
  git(ctx.root, ['worktree', 'add', '--no-track', '-b', branch, path, ref]);
  recordQuietly(ctx, id, path);
  mkdirSync(path + '/accord/tickets', { recursive: true });
  const ruleset = rulesetPinOf(path);
  writeFileSync(path + '/' + rel, ruleset === undefined ? text : setFrontmatterKey(text, 'ruleset', ruleset));
  git(path, ['add', '--', rel]);
  git(path, ['commit', '-q', '-m', renderSubject(ctx.snapshot.config, 'claim', id)]);
  let holdError: unknown;
  if (enter) {
    try {
      takeHold(ctx, id, path);
    } catch (e) {
      holdError = e; // push anyway so the claim is not stranded locally; rethrown below
    }
  }
  try {
    gitNoPrompt(path, ['push', '-u', 'origin', branch], undefined, ctx.ssh);
  } catch (e) {
    throw new UsageError(withNext('ticket-push-failed', `the ticket is committed in ${path} but the push failed: ${firstLine(e)} - push it with git -C "${path}" push -u origin ${branch}`));
  }
  if (holdError !== undefined) throw holdError;
  if (enter) checkPin(ctx, id, path, branch, list[0].path);
  prepare(path, ctx.root);
  ctx.stdout.write(rel + '\n');
  enterOrStop(ctx, id, path, branch, enter);
}
