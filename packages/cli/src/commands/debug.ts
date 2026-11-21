// Phase 8.3 D-06 (Ruling 10): the state of `/accord-debug` on an issue no ticket holds. `accord debug path` names one file per repository and user in a private folder of
// the system temp directory: outside the working tree (nothing is committed before a ticket exists, and `git add -A` never sees it) and outside `.git` (Claude Code
// protects that path from agent writes). It is created only here: the hook and the skill never create it. A predictable name in a shared temp directory is a
// target on a multi-user host, so the folder is made 0700 and refused when it is a link, not a directory, not ours, or open to group or others, and the file is made
// with the exclusive flag at 0600 and refused when it is a link or not a regular file; nothing is followed or changed on a refusal. The file's text is data: it
// is read only through `debugOpen`, never printed, run or obeyed.
import { createHash } from 'node:crypto';
import { closeSync, lstatSync, mkdirSync, openSync, readFileSync } from 'node:fs';
import type { Stats } from 'node:fs';
import { tmpdir, userInfo } from 'node:os';
import { debugOpen } from '@accord-dev/accord-core';
import { UsageError } from '../load/fs.js';
import type { CommandContext } from '../run.js';
import { git } from './worktree.js';

const sha = (text: string, length: number): string => createHash('sha256').update(text).digest('hex').slice(0, length);

/** The person the folder belongs to; a host that cannot say (no passwd entry) still gets one stable name. */
function who(): string {
  try {
    return userInfo().username;
  } catch {
    return 'unknown';
  }
}

/**
 * `<temp>/accord-debug-<12 hex of the user>/<16 hex of the git common dir>.md`, with forward slashes. Every worktree of one repository prints the same common dir, so
 * they share the file; another repository, or another user, gets another one.
 */
export function debugStatePath(root: string): string {
  const common = git(root, ['rev-parse', '--path-format=absolute', '--git-common-dir']).trim().replace(/\\/g, '/');
  const key = process.platform === 'win32' ? common.toLowerCase() : common;
  return (tmpdir() + '/accord-debug-' + sha(who(), 12) + '/' + sha(key, 16) + '.md').replace(/\\/g, '/');
}

/** The state file's text when it is a regular file; anything else (absent, a link, a folder, unreadable) is undefined. Never throws. */
export function readDebugState(path: string): string | undefined {
  try {
    const found = lstatSync(path, { throwIfNoEntry: false });
    return found !== undefined && found.isFile() ? readFileSync(path, 'utf8') : undefined;
  } catch {
    return undefined;
  }
}

const refuse = (what: string, path: string): UsageError => new UsageError(`${path} is ${what} - nothing was changed; remove it and run accord debug path again`);

/** The private folder, created when absent. A race that makes it first is read again, not trusted. */
function ensureFolder(dir: string): void {
  let found: Stats | undefined = lstatSync(dir, { throwIfNoEntry: false });
  if (found === undefined) {
    try {
      mkdirSync(dir, { mode: 0o700 });
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== 'EEXIST') throw e;
    }
    found = lstatSync(dir, { throwIfNoEntry: false });
  }
  if (found === undefined || found.isSymbolicLink() || !found.isDirectory()) throw refuse('not a plain folder (a link or a file)', dir);
  if (process.platform !== 'win32') {
    if (typeof process.getuid === 'function' && found.uid !== process.getuid()) throw refuse('owned by another user', dir);
    if ((found.mode & 0o077) !== 0) throw refuse('open to group or others', dir);
  }
}

/** The state file, created empty with the exclusive flag when absent. */
function ensureFile(file: string): void {
  let found: Stats | undefined = lstatSync(file, { throwIfNoEntry: false });
  if (found === undefined) {
    try {
      closeSync(openSync(file, 'wx', 0o600));
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== 'EEXIST') throw e;
    }
    found = lstatSync(file, { throwIfNoEntry: false });
  }
  if (found === undefined || found.isSymbolicLink() || !found.isFile()) throw refuse('not a regular file (a link or a folder)', file);
}

/** `accord debug path [--json]`: print the state file's path and whether an episode is open in it; create it empty when absent. */
export function debugPath(ctx: CommandContext, options: { json?: boolean }): number {
  const file = debugStatePath(ctx.root);
  ensureFolder(file.slice(0, file.lastIndexOf('/')));
  ensureFile(file);
  const episode = debugOpen(readDebugState(file) ?? '') ? 'open' : 'none';
  ctx.stdout.write(options.json === true ? JSON.stringify({ path: file, episode }, null, 2) + '\n' : `path: ${file}\nepisode: ${episode}\n`);
  return 0;
}
