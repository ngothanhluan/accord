// Phase 08.9.3 D-01, D-02: `accord repos set <name> <path>` stores where the clone of another repository (declared under `repos:` in accord/config.yml by its remote URL) lives on this machine,
// and `accord repos status` reads each one back. Both read and write only; nothing is cloned, fetched, switched or touched in the other repository (D-02, D-04). The CLI has no prompt: a skill asks the
// person where the clone is, and its answer ends in `accord repos set`.
// D-05, D-04: `accord repos baseline <name> --id <id>` is the one command here that reaches the network: it fetches the other clone's origin (no prompt) and reads the tip of its default branch, so a plan
// is written against what that repository's teammates have merged and no session runs git in another folder. The fetch moves remote-tracking refs only (D-10: the clone is never switched or touched).
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { isSha, newestPr, SAFE_ID, workOf } from '@accord-dev/accord-core';
import { assertNoLink } from '../guard.js';
import { defaultRefOf, gitSliceTip, UsageError } from '../load/fs.js';
import { ghFirstLine, ghRepoOf, ghRun } from '../load/gh.js';
import { canonical, checkClone, REPO_NAME, redactUrl, resolveRepo, samePath, storeRepoPath, toPosix } from '../load/repos.js';
import { REPORT_DIR } from '../load/report.js';
import { shown } from '../load/script-trust.js';
import { sliceHomeOf } from '../load/slice-size.js';
import type { CommandContext } from '../run.js';
import { requireTicket } from './lane-args.js';
import { gitNoPrompt, listWorktrees, readRecorded } from './worktree.js';

/** The names `repos:` declares, in name order. */
const declared = (ctx: CommandContext): string[] => Object.keys(ctx.snapshot.config?.repos ?? {}).sort();

/**
 * `accord repos set <name> <path>`: store the clone at `path` (made absolute against `cwd`, kept with forward slashes) as where `name` lives. Refused with exit 2, storing nothing, unless `name` is declared,
 * `path` is a clone (a `.git` folder: a linked worktree has a `.git` file and a plain folder none) and its configured origin names `repos.<name>.remote`.
 */
export function reposSet(ctx: CommandContext, name: string, path: string, cwd: string): number {
  const names = declared(ctx);
  const entry = ctx.snapshot.config?.repos;
  if (entry === undefined || !Object.hasOwn(entry, name)) {
    throw new UsageError(
      names.length === 0
        ? `accord/config.yml declares no repository (repos:), so there is no ${name} to store; nothing was stored`
        : `${name} is not declared in accord/config.yml; it declares ${names.join(', ')}; nothing was stored`,
    );
  }
  const where = canonical(resolve(cwd, path));
  const remote = entry[name].remote;
  const check = checkClone(where, remote);
  if (!check.ok) {
    if (check.why === 'origin') throw new UsageError(`the clone at ${where} has origin ${check.origin === undefined ? 'none' : redactUrl(check.origin)}, not ${redactUrl(remote)} (repos.${name}.remote); nothing was stored`);
    throw new UsageError(
      check.why === 'no-folder'
        ? `${where} is not a folder; nothing was stored`
        : `${where} is not a clone: it has no .git folder of its own (a linked worktree or a plain folder is no clone); nothing was stored`,
    );
  }
  try {
    storeRepoPath(ctx.root, name, where);
  } catch (e) {
    throw new UsageError(`could not store the path of ${name}: ${(e as Error).message}`);
  }
  ctx.stdout.write(`repos: ${name} -> ${where}\n`);
  return 0;
}

/**
 * `accord repos status`: one line per declared repository, `<name>: <path> (stored)` for a verified clone and the refusal line otherwise; exit 2 after the last line when any is refused or not found.
 * With a ticket id (Phase 08.9.3 D-07) it prints the facts of that ticket's other repositories instead: see `reposTicketStatus`.
 */
export function reposStatus(ctx: CommandContext, id?: string): number {
  if (id !== undefined) return reposTicketStatus(ctx, id);
  const names = declared(ctx);
  if (names.length === 0) {
    ctx.stdout.write('repos: none declared in accord/config.yml\n');
    return 0;
  }
  let code = 0;
  for (const name of names) {
    const found = resolveRepo(ctx.root, ctx.snapshot.config, name);
    if ('refused' in found) {
      ctx.stdout.write(found.refused + '\n');
      code = 2;
    } else {
      ctx.stdout.write(`${name}: ${found.path} (${found.how})\n`);
    }
  }
  return code;
}

/** What the newest pull request of a slice branch is, as parsed fields only (Ruling R17, T-08.9.3-29): a number, a state, a draft flag and a 40-hex merge commit; nothing else of the pull request is kept. */
type Pr =
  | { kind: 'none' }
  | { kind: 'found'; number: number; state: 'open' | 'draft' | 'merged' | 'closed'; merge?: string }
  | { kind: 'unavailable'; why: string };

const HEX40 = /^[0-9a-f]{40}$/i;
const SHAPE = 'gh answered with a pull request list accord does not read';

/** The newest pull request of `branch` in the repository `slug` (`<owner>/<repo>`, or undefined when the remote is not a github.com one) by `gh pr list`, a read verb. A failed call or an answer that does not parse is `unavailable`, never `none`. */
function readPr(ctx: CommandContext, name: string, slug: string | undefined, branch: string): Pr {
  if (slug === undefined) return { kind: 'unavailable', why: `${name}'s remote is not a github.com repository` };
  let list: unknown;
  try {
    list = JSON.parse(ghRun(ctx.root, ['pr', 'list', '--head', branch, '--state', 'all', '--json', 'number,state,isDraft,mergeCommit', '--limit', '30'], ctx.env, slug));
  } catch (err) {
    return { kind: 'unavailable', why: ghFirstLine(err) };
  }
  if (!Array.isArray(list)) return { kind: 'unavailable', why: SHAPE };
  const rows = list.filter((p): p is { number: number; state?: unknown; isDraft?: unknown; mergeCommit?: { oid?: unknown } | null } => typeof p === 'object' && p !== null && Number.isSafeInteger((p as { number?: unknown }).number) && (p as { number: number }).number > 0);
  const newest = newestPr(rows);
  if (newest === undefined) return list.length === 0 ? { kind: 'none' } : { kind: 'unavailable', why: SHAPE };
  if (newest.state === 'OPEN') return { kind: 'found', number: newest.number, state: newest.isDraft === true ? 'draft' : 'open' };
  if (newest.state === 'CLOSED') return { kind: 'found', number: newest.number, state: 'closed' };
  if (newest.state === 'MERGED') {
    const oid = newest.mergeCommit?.oid;
    return { kind: 'found', number: newest.number, state: 'merged', ...(typeof oid === 'string' && HEX40.test(oid) ? { merge: oid.toLowerCase() } : {}) };
  }
  return { kind: 'unavailable', why: SHAPE };
}

/** The line a pull request is told in: `pr #41 open draft`, `pr #41 open`, `pr #41 merged <sha>`, `pr #41 closed`, `pr none` or `pr unavailable: <line>`. */
function prLine(pr: Pr): string {
  if (pr.kind === 'none') return 'pr none';
  if (pr.kind === 'unavailable') return `pr unavailable: ${pr.why}`;
  const n = `pr #${pr.number}`;
  return pr.state === 'draft' ? `${n} open draft` : pr.state === 'merged' ? `${n} merged${pr.merge === undefined ? '' : ' ' + pr.merge}` : `${n} ${pr.state}`;
}

/**
 * Phase 08.9.3 D-07, D-04, D-06, D-08: `accord repos status <id>` prints, for each other repository of the ticket's plan (name order), what the verifier copies into `## Repository <name>` of verification.md: the clone,
 * the worktree this repository recorded for the ticket there, the suite (`repos.<name>.tests`) and where to run it, and per slice of that repository its branch, the branch's head in the clone, the newest pull request
 * of that branch read with `gh` (`GH_REPO` from the declared remote, Ruling R17) and the `record:` lines to copy; then, for each slice of this repository that comes after a slice whose pull request is not merged, a
 * `held:` line (D-08). It reads and writes nothing: no file, no ref, no `gh` write verb. Exit 2 after the last line when a clone is missing or refused, a pull request cannot be read, or a remote is not a
 * github.com one. Only numbers, states, branch names and shas leave `gh` and git; no text of the other repository is printed.
 */
function reposTicketStatus(ctx: CommandContext, id: string): number {
  if (!SAFE_ID.test(id)) throw new UsageError(`not a ticket id: ${plain(id)}`);
  requireTicket(ctx.snapshot, id);
  const slices = workOf(ctx.snapshot, id)?.plan?.slices ?? [];
  const others = [...new Set(slices.flatMap((s) => (s.repo === undefined ? [] : [s.repo])))].sort();
  if (others.length === 0) {
    ctx.stdout.write(`repos: ${id} has no slice in another repository\n`);
    return 0;
  }
  const out = (line: string): void => void ctx.stdout.write(line + '\n');
  let code = 0;
  /** The slices of other repositories whose pull request is not merged, for the held lines. */
  const waiting: { repo: string; n: number; pr?: number }[] = [];
  for (const name of others) {
    const found = resolveRepo(ctx.root, ctx.snapshot.config, name, { store: false });
    if ('refused' in found) {
      out(found.refused);
      code = 2;
      continue;
    }
    out(`repository: ${name}`);
    out(`clone: ${found.path}`);
    const entry = ctx.snapshot.config?.repos?.[name];
    const recorded = readRecorded(ctx.root).find((e) => e.id === id && e.repo === name);
    let wt: string | undefined;
    try {
      wt = recorded !== undefined && listWorktrees(found.path).some((w) => w.prunable === undefined && samePath(w.path, recorded.path)) ? toPosix(recorded.path) : undefined;
    } catch {
      wt = undefined; // a clone git cannot list is no worktree to run a suite in
    }
    out(`worktree: ${wt ?? 'none'}`);
    const tests = entry?.tests;
    if (tests === undefined) out(`suite: none - set repos.${name}.tests`);
    else if (/[^\x20-\x7e\u0080-￿]/.test(tests)) {
      out(`suite: unreadable - repos.${name}.tests holds a control character`);
      code = 2;
    } else out(`suite: ${tests}`);
    out(`suite-dir: ${wt ?? 'none'}`);
    const slug = entry === undefined ? undefined : ghRepoOf(entry.remote);
    const seen = new Set<number>();
    for (const s of slices.filter((x) => x.repo === name).sort((a, b) => a.n - b.n)) {
      if (seen.has(s.n)) continue;
      seen.add(s.n);
      const home = sliceHomeOf(ctx.snapshot, id, s.n);
      if (home === undefined) {
        out(`slice ${s.n}: pr unavailable: ${id} slice ${s.n} names no branch`);
        code = 2;
        continue;
      }
      const head = gitSliceTip(found.path, home.branch);
      const pr = readPr(ctx, name, slug, home.branch);
      out(`slice ${s.n}: branch ${home.branch}`);
      out(`slice ${s.n}: head ${head ?? 'none'}`);
      out(`slice ${s.n}: ${prLine(pr)}`);
      out(`record: Slice: ${s.n}`);
      if (pr.kind === 'found') out(`record: PR: #${pr.number}`);
      if (head !== undefined) out(`record: Verified head: ${head}`);
      if (pr.kind === 'found' && pr.merge !== undefined) out(`record: Merged: ${pr.merge}`);
      if (pr.kind === 'unavailable') code = 2;
      else if (!(pr.kind === 'found' && pr.state === 'merged')) waiting.push({ repo: name, n: s.n, ...(pr.kind === 'found' ? { pr: pr.number } : {}) });
    }
  }
  // D-08: a slice of this repository after a slice of another repository whose pull request has not merged waits for it
  const own = [...new Set(slices.filter((s) => s.repo === undefined).map((s) => s.n))].sort((a, b) => a - b);
  for (const n of own) {
    for (const w of waiting.filter((x) => x.n < n)) out(`held: slice ${n} waits for ${w.repo} slice ${w.n} (${w.pr === undefined ? 'no pull request yet' : '#' + w.pr})`);
  }
  return code;
}

const NOTHING = '; nothing was written';
const FETCH_LIMIT_MS = 120_000;
const LIST_LIMIT_MS = 60_000;
/** The most output of one `git ls-tree` read: a repository of a few million files still fits, and one that does not is refused rather than cut. */
const LIST_BUFFER = 512 * 1024 * 1024;

/** Text that goes into a refusal: control characters made visible and no backslash (a usage error prints every one as a slash). */
const plain = (text: string): string => shown(text.replace(/\\/g, '/'));

/** The first line git said. */
const said = (e: unknown): string => plain(String((e as { stderr?: unknown }).stderr ?? (e as Error).message ?? e).trim().split('\n')[0]);

/**
 * D-05, D-04: `accord repos baseline <name> --id <id>`. Fetches the clone's origin without a prompt (remote-tracking refs only: no tags, no submodules, no prune; HEAD, index, working tree and local branches
 * stay as they were, D-10), prints `baseline_<name>: <40-hex sha>` of origin's default branch tip (R5), and writes that commit's tracked paths, one per line, to `.accord-reports/<id>/repos/<name>.files`
 * in this checkout (git-ignored like every report), followed by `files: <path>` and `count: <n>`. A path with a line break in it is left out and counted on a `skipped:` line. Refused with exit 2 and nothing
 * written when --id is missing or no ticket of this checkout, the name is not declared, there is no clone (the D-02 line), a report folder is a link, or a git step fails.
 */
export function reposBaseline(ctx: CommandContext, name: string, o: { id?: string }): number {
  const id = o.id;
  if (id === undefined) throw new UsageError('accord repos baseline needs --id <ticket id>, the ticket whose report folder gets the file list' + NOTHING);
  if (!SAFE_ID.test(id)) throw new UsageError(`not a ticket id: ${plain(id)}${NOTHING}`);
  requireTicket(ctx.snapshot, id);
  if (!REPO_NAME.test(name)) throw new UsageError(`not a repository name: ${plain(name)}${NOTHING}`);
  const found = resolveRepo(ctx.root, ctx.snapshot.config, name);
  if ('refused' in found) throw new UsageError(found.refused);
  const clone = found.path;
  // a link in the report folder is refused before the network is touched
  const rel = `${REPORT_DIR}/${id}/repos/${name}.files`;
  const ignore = `${REPORT_DIR}/.gitignore`;
  assertNoLink(ctx.root, ignore);
  assertNoLink(ctx.root, rel);
  try {
    gitNoPrompt(clone, ['fetch', '--no-prune', '--no-tags', '--no-recurse-submodules', 'origin'], FETCH_LIMIT_MS);
  } catch (e) {
    throw new UsageError(`${name}: git fetch origin failed in ${clone}: ${said(e)}${NOTHING}`);
  }
  const ref = defaultRefOf(clone);
  if (ref === undefined || !ref.startsWith('refs/remotes/origin/')) {
    throw new UsageError(`${name}: the clone at ${clone} has no default branch of origin (origin/HEAD, origin/main or origin/master) after the fetch${NOTHING}`);
  }
  let sha: string;
  let listing: string;
  try {
    const git = (args: string[]): string => execFileSync('git', args, { cwd: clone, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: LIST_LIMIT_MS, maxBuffer: LIST_BUFFER, windowsHide: true });
    sha = git(['rev-parse', '--verify', '--end-of-options', ref + '^{commit}']).trim();
    if (!isSha(sha)) throw new Error('git rev-parse did not print a commit name');
    listing = git(['ls-tree', '-r', '--name-only', '-z', sha]);
  } catch (e) {
    throw new UsageError(`${name}: could not read ${ref} in ${clone}: ${said(e)}${NOTHING}`);
  }
  const all = listing.split('\0').filter((p) => p !== '');
  const paths = all.filter((p) => !/[\r\n]/.test(p));
  mkdirSync(join(ctx.root, REPORT_DIR, id, 'repos'), { recursive: true });
  if (!existsSync(join(ctx.root, ...ignore.split('/')))) writeFileSync(join(ctx.root, ...ignore.split('/')), '*\n');
  writeFileSync(join(ctx.root, ...rel.split('/')), paths.map((p) => p + '\n').join(''), 'utf8');
  ctx.stdout.write(`baseline_${name}: ${sha}\n`);
  ctx.stdout.write(`files: ${toPosix(ctx.root).replace(/\/+$/, '')}/${rel}\n`);
  ctx.stdout.write(`count: ${paths.length}\n`);
  if (all.length > paths.length) ctx.stdout.write(`skipped: ${all.length - paths.length} path(s) with a line break in the name\n`);
  return 0;
}

