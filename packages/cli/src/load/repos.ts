// Phase 08.9.3 D-01, D-02: where the clone of another repository (`repos.<name>` of accord/config.yml) lives on THIS machine. The place is per clone and never committed: one `<name>\t<absolute posix path>`
// line per repository in `<git common dir>/accord/repos`, beside `holds`, `worktrees` and `slices`, under the same lock and atomic write. A path is never an identity: every use of a stored path
// re-reads the clone's configured origin and compares it with the declared remote (`sameRepository`), and a clone whose origin no longer names the repository is refused, naming both URLs, and used for nothing.
// accord never clones (D-02); a missing clone is reported with the exact `git clone` line to run and the `accord repos set` line that gives an existing one.
// A leaf module like slices.ts (it imports no load/fs.ts, so fs.ts can import it); it returns `{ refused }` text instead of throwing UsageError, and a failed write throws a plain Error.
import { execFileSync } from 'node:child_process';
import { closeSync, existsSync, lstatSync, mkdirSync, openSync, readdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { basename, dirname } from 'node:path';
import { sameRepository } from '@accord-dev/accord-core';
import type { AccordConfig } from '@accord-dev/accord-core';
import { gitDirsOf } from './gitdir.js';

/** The name a repository goes by in `repos:`: the schema's pattern (two characters or more of a-z, 0-9, -, starting with a letter). */
export const REPO_NAME = /^[a-z][a-z0-9-]+$/;
/** An absolute posix path: `/x/y` or `C:/x/y`, with no backslash, no line break and no tab (a tab would split the line). */
const POSIX_ABSOLUTE = /^(?:\/|[A-Za-z]:\/)[^\\\r\n\t]*$/;
const LINE = /^([a-z][a-z0-9-]+)\t((?:\/|[A-Za-z]:\/)[^\\\r\n\t]*)$/;

export interface RepoPath {
  name: string;
  path: string;
}

/** What a repository resolves to: a verified clone's path, or the text that says why it is not usable (one line, starting with `<name>:`). */
export type Resolved = { path: string; how: 'stored' | 'found' } | { refused: string };

/** A path with forward slashes only (`C:\Work\tools` is `C:/Work/tools`): the form stored, printed and compared. */
export const toPosix = (p: string): string => p.replace(/\\/g, '/');

/** The record lines that read as `<name>\t<absolute posix path>`; any other line is skipped when read and kept when rewritten. */
function parse(text: string): RepoPath[] {
  const out: RepoPath[] = [];
  for (const l of text.split('\n')) {
    const m = LINE.exec(l);
    if (m !== null) out.push({ name: m[1], path: m[2] });
  }
  return out;
}

const folderOf = (root: string): string => {
  const dirs = gitDirsOf(root);
  if (dirs === undefined) throw new Error(`${root} has no readable .git folder`);
  return dirs.commonDir + '/accord';
};

/** The stored paths without a lock (the file is written by rename); a missing file, or a checkout whose git folders cannot be read, gives `[]`. */
export function readRepoPaths(root: string): RepoPath[] {
  const dirs = gitDirsOf(root);
  if (dirs === undefined) return [];
  const file = dirs.commonDir + '/accord/repos';
  try {
    return existsSync(file) ? parse(readFileSync(file, 'utf8')) : [];
  } catch {
    return [];
  }
}

/** The same exclusive lock `accord worktree` takes for the holds file and the worktree record (`holds.lock`): no second lock file, so no two accord commands write the records at once. */
function withLock<T>(root: string, fn: (dir: string) => T): T {
  const dir = folderOf(root);
  const lock = dir + '/holds.lock';
  mkdirSync(dir, { recursive: true });
  const stop = Date.now() + 2000;
  let fd: number | undefined;
  while (fd === undefined) {
    try {
      fd = openSync(lock, 'wx');
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== 'EEXIST') throw e;
      if (Date.now() > stop) throw new Error('the hold file is locked by another accord command: ' + lock + ' - if none is running, delete that file', { cause: e });
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

function write(file: string, text: string): void {
  const tmp = `${file}.${process.pid}.tmp`;
  writeFileSync(tmp, text);
  renameSync(tmp, file);
}

/**
 * Store where the clone of `name` lives: replaces any line of that name, keeps every other line (one that does not read as a record included), and writes the file under the holds lock, temp then rename.
 * Throws a plain Error when the name or the path could not be a record, or when the lock or the write fails. It checks nothing about the clone: `checkClone` is the caller's step before it.
 */
export function storeRepoPath(root: string, name: string, path: string): void {
  if (!REPO_NAME.test(name)) throw new Error('not a repository name: ' + name);
  if (!POSIX_ABSOLUTE.test(path)) throw new Error('not an absolute posix path: ' + path);
  withLock(root, (dir) => {
    const file = dir + '/repos';
    const text = existsSync(file) ? readFileSync(file, 'utf8') : '';
    const kept = text.split('\n').filter((l, i, all) => !(i === all.length - 1 && l === '') && LINE.exec(l)?.[1] !== name);
    write(file, [...kept, `${name}\t${path}`].join('\n') + '\n');
  });
}

/** The URL `remote.origin.url` holds in the clone's own config, exactly as written: not `git remote get-url`, which applies `url.<base>.insteadOf` and so reads a rewritten URL (R2). Undefined when git could not say. */
export function originOf(dir: string): string | undefined {
  try {
    const out = execFileSync('git', ['config', '--local', '--get', 'remote.origin.url'], { cwd: dir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 15_000, windowsHide: true }).trim();
    return out === '' ? undefined : out;
  } catch {
    return undefined;
  }
}

const isFolder = (p: string): boolean => {
  try {
    return statSync(p).isDirectory();
  } catch {
    return false;
  }
};

/** Whether `dir` is a clone of the repository at `remote`: a folder holding a `.git` folder (a linked worktree's `.git` is a file, a plain folder has none) whose configured origin names `remote`. */
export type CloneCheck = { ok: true } | { ok: false; why: 'no-folder' | 'no-clone' } | { ok: false; why: 'origin'; origin: string | undefined };

export function checkClone(dir: string, remote: string): CloneCheck {
  if (!isFolder(dir)) return { ok: false, why: 'no-folder' };
  if (!isFolder(dir + '/.git')) return { ok: false, why: 'no-clone' };
  const origin = originOf(dir);
  return origin !== undefined && sameRepository(origin, remote) ? { ok: true } : { ok: false, why: 'origin', origin };
}

/** The folder of the main checkout of the clone `root` belongs to, posix form: the folder above the common git folder, or `root` itself when that folder is not a `.git`. */
export function mainCheckoutOf(root: string): string {
  const dirs = gitDirsOf(root);
  const common = dirs === undefined ? undefined : toPosix(dirs.commonDir);
  return common !== undefined && basename(common) === '.git' ? dirname(common) : toPosix(root);
}

const quote = (s: string): string => "'" + s.replace(/'/g, "'\\''") + "'";

/** The `git clone` line for a repository that has no clone: each argument single-quoted POSIX style. `parent` is the folder above the main checkout and `name` a validated repository name, so the path is never built from the URL (R3). */
export const cloneLine = (url: string, parent: string, name: string): string => `git clone ${quote(url)} ${quote(parent + '/' + name)}`;

/** The two lines a missing or refused clone ends in: the clone to make, or the existing one to give. */
function ways(name: string, url: string, root: string): string {
  const parent = dirname(mainCheckoutOf(root));
  return `clone it with ${cloneLine(url, parent, name)}, or give an existing clone with accord repos set ${name} <path>; nothing was cloned`;
}

/** R4: how many entries of the parent folder the scan looks at, in name order. */
export const SCAN_LIMIT = 200;
/** A candidate's `.git/config` is read only up to this size (a real one is a few hundred bytes). */
const CONFIG_LIMIT = 1024 * 1024;

/** The value `[remote "origin"]` gives `url` in the text of a git config file, as the last `url =` line of that section (what `git config --get` returns for a multi-valued key); undefined when there is none. */
function originInConfig(text: string): string | undefined {
  let inOrigin = false;
  let url: string | undefined;
  for (const line of text.split(/\r?\n/)) {
    const header = /^\s*\[([^\]]*)\]/.exec(line);
    if (header !== null) {
      inOrigin = /^\s*remote\s+"origin"\s*$/.test(header[1]);
      continue;
    }
    if (!inOrigin) continue;
    const m = /^\s*url\s*=\s*(.*?)\s*$/i.exec(line);
    if (m !== null) url = m[1].replace(/^"(.*)"$/, '$1');
  }
  return url === '' ? undefined : url;
}

/**
 * D-01, R4: the clones of the repository `name` declares that sit in the parent folder of the main checkout. One level only; the first SCAN_LIMIT entries in name order (`capped` says there were more);
 * a symlink, a junction, a plain file and the main checkout itself are skipped, and so is a folder whose `.git` is not a folder (a linked worktree). A candidate's `.git/config` is read as a file (no git
 * process), and it counts when its `[remote "origin"]` url names the declared remote; a config that cannot be read, or is over a mebibyte, is skipped. A found path is a candidate, not yet a clone: `checkClone` confirms it.
 */
export function scanParent(root: string, config: Pick<AccordConfig, 'repos'> | undefined, name: string): { found: string[]; capped: boolean } {
  const remote = config?.repos !== undefined && Object.hasOwn(config.repos, name) ? config.repos[name].remote : undefined;
  if (remote === undefined) return { found: [], capped: false };
  const main = mainCheckoutOf(root);
  const parent = dirname(main);
  let names: string[];
  try {
    names = readdirSync(parent).sort();
  } catch {
    return { found: [], capped: false };
  }
  const found: string[] = [];
  for (const entry of names.slice(0, SCAN_LIMIT)) {
    const path = parent + '/' + entry;
    if (path.toLowerCase() === main.toLowerCase()) continue;
    try {
      const own = lstatSync(path);
      if (own.isSymbolicLink() || !own.isDirectory()) continue;
      if (!lstatSync(path + '/.git').isDirectory()) continue;
      const file = path + '/.git/config';
      if (statSync(file).size > CONFIG_LIMIT) continue;
      const origin = originInConfig(readFileSync(file, 'utf8'));
      if (origin !== undefined && sameRepository(origin, remote)) found.push(path);
    } catch {
      // a folder that cannot be read is no candidate
    }
  }
  return { found, capped: names.length > SCAN_LIMIT };
}

/**
 * D-01, D-02: the clone of repository `name`, read from the stored path and re-verified on every call. Refused (never trusted, never a fallback to another path) when `name` is not declared,
 * the stored path is no longer a clone, or its configured origin no longer names `repos.<name>.remote`; the origin refusal names both URLs and says the stored path was not used.
 * With no stored path the parent folder of the main checkout is searched (`scanParent`): exactly one clone whose configured origin names the repository is stored like `accord repos set` and used (`how: 'found'`),
 * two are refused naming both, and none ends in the not-found line. Only a ticket command that needs the repository calls this; status, dashboard and the hooks never do (Decision 9).
 */
export function resolveRepo(root: string, config: Pick<AccordConfig, 'repos'> | undefined, name: string): Resolved {
  const entry = config?.repos !== undefined && Object.hasOwn(config.repos, name) ? config.repos[name] : undefined;
  if (entry === undefined) return { refused: `${name}: not declared - accord/config.yml has no repos.${name}` };
  const stored = readRepoPaths(root).find((e) => e.name === name);
  if (stored === undefined) {
    const scan = scanParent(root, config, name);
    if (scan.found.length >= 2) {
      return { refused: `repository ${name} has two clones beside this checkout: ${scan.found[0]} and ${scan.found[1]} - choose one with accord repos set ${name} <path>; nothing was used` };
    }
    if (scan.found.length === 1 && checkClone(scan.found[0], entry.remote).ok) {
      try {
        storeRepoPath(root, name, scan.found[0]);
      } catch {
        // the clone is verified; a store that failed is searched for again next time
      }
      return { path: scan.found[0], how: 'found' };
    }
    const more = scan.capped ? `; the folder ${dirname(mainCheckoutOf(root))} holds more than ${SCAN_LIMIT} entries, so it was not searched to the end` : '';
    return { refused: `${name}: not found - ${ways(name, entry.remote, root)}${more}` };
  }
  const check = checkClone(stored.path, entry.remote);
  if (check.ok) return { path: stored.path, how: 'stored' };
  if (check.why === 'origin') {
    return { refused: `${name}: refused - the clone at ${stored.path} has origin ${check.origin ?? 'none'}, not ${entry.remote} (repos.${name}.remote), so the stored path was not used; give the right clone with accord repos set ${name} <path>` };
  }
  return { refused: `${name}: not found - the stored path ${stored.path} is no longer a clone; ${ways(name, entry.remote, root)}` };
}
