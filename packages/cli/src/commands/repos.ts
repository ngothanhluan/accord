// Phase 08.9.3 D-01, D-02: `accord repos set <name> <path>` stores where the clone of another repository (declared under `repos:` in accord/config.yml by its remote URL) lives on this machine,
// and `accord repos status` reads each one back. Both read and write only; nothing is cloned, fetched, switched or touched in the other repository (D-02, D-04). The CLI has no prompt: a skill asks the
// person where the clone is, and its answer ends in `accord repos set`.
// D-05, D-04: `accord repos baseline <name> --id <id>` is the one command here that reaches the network: it fetches the other clone's origin (no prompt) and reads the tip of its default branch, so a plan
// is written against what that repository's teammates have merged and no session runs git in another folder. The fetch moves remote-tracking refs only (D-10: the clone is never switched or touched).
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { isSha, SAFE_ID } from '@accord-dev/accord-core';
import { assertNoLink } from '../guard.js';
import { defaultRefOf, UsageError } from '../load/fs.js';
import { checkClone, REPO_NAME, resolveRepo, storeRepoPath, toPosix } from '../load/repos.js';
import { REPORT_DIR } from '../load/report.js';
import { shown } from '../load/script-trust.js';
import type { CommandContext } from '../run.js';
import { requireTicket } from './lane-args.js';
import { gitNoPrompt } from './worktree.js';

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
  const where = toPosix(resolve(cwd, path));
  const remote = entry[name].remote;
  const check = checkClone(where, remote);
  if (!check.ok) {
    if (check.why === 'origin') throw new UsageError(`the clone at ${where} has origin ${check.origin ?? 'none'}, not ${remote} (repos.${name}.remote); nothing was stored`);
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

/** `accord repos status`: one line per declared repository, `<name>: <path> (stored)` for a verified clone and the refusal line otherwise; exit 2 after the last line when any is refused or not found. */
export function reposStatus(ctx: CommandContext): number {
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

