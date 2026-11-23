// Phase 8.3 D-06 (Ruling 10): the state of `/accord-debug` on an issue no ticket holds. `accord debug path` names one file per repository and user in a private folder of
// the system temp directory: outside the working tree (nothing is committed before a ticket exists, and `git add -A` never sees it) and outside `.git` (Claude Code
// protects that path from agent writes). It is created only here: the hook and the skill never create it. A predictable name in a shared temp directory is a
// target on a multi-user host, so the folder is made 0700 (on Windows given a private access list at once) and refused when it is a link, not a directory, not ours, or open to
// another account, and the file is made with the exclusive flag at 0600 and refused when it is a link or not a regular file; nothing is followed or changed on a refusal.
// Phase 08.8 D-14: the folder check is shared with the session hook (../load/debug-folder.ts), which reads the file only through it. The file's text is data: it
// is read only through `debugOpen`, never printed, run or obeyed. Phase 08.8 review WR-01: on Windows the folder is open to the temp directory's list between `mkdir` and the
// icacls run that makes it private, so a folder made in this run must be empty after it, and its state file is created with the exclusive flag only, never adopted.
import { createHash } from 'node:crypto';
import { closeSync, lstatSync, mkdirSync, openSync, readdirSync, rmdirSync } from 'node:fs';
import type { Stats } from 'node:fs';
import { tmpdir, userInfo } from 'node:os';
import { debugOpen } from '@accord-dev/accord-core';
import { checkDebugFolder, DEBUG_STATE_MAX, folderOf, makePrivate, readDebugFile, readStateFile } from '../load/debug-folder.js';
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

/** The state file's text when its folder passes the shared check and it is a regular file; anything else (absent, a link, a folder, unreadable, a refused folder) is undefined. Never throws. */
export function readDebugState(path: string): string | undefined {
  return readDebugFile(path)?.text;
}

/** The variable that moves the temp directory, and so the folder, on this OS. */
const moveVariable = (): string => (process.platform === 'win32' ? 'TEMP' : 'TMPDIR');

const refuse = (what: string, path: string): UsageError =>
  new UsageError(`${path} is ${what} - nothing was changed; remove it and run accord debug path again, or set ${moveVariable()} to use another folder`);

/** The private folder, created when absent; true when this run made it. A race that makes it first is read again, not trusted. */
function ensureFolder(dir: string, file: string): boolean {
  // the state file is judged with the folder: its mode tells a filesystem that stores no POSIX modes (D-14 IN-01), and on Windows its owner and list count too (review CR-01)
  let check = checkDebugFolder(dir, { stateFile: file });
  let made = false;
  if (check.state === 'absent') {
    try {
      mkdirSync(dir, { mode: 0o700 });
      made = true;
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== 'EEXIST') throw e;
    }
    if (made) {
      try {
        makePrivate(dir);
      } catch (e) {
        try {
          rmdirSync(dir);
        } catch {
          // an empty folder that stays is refused by the next check
        }
        throw new UsageError(`${dir} could not be made private: ${(e as Error).message}; nothing was kept, or set ${moveVariable()} to use another folder`);
      }
      // review WR-01: whatever is in it got there before it was private; it is left as it is and never read
      if (readdirSync(dir).length > 0) throw refuse('not empty right after accord made it private (another account wrote in it)', dir);
    }
    check = checkDebugFolder(dir, made ? { madeNow: true } : { stateFile: file });
  }
  if (check.state !== 'ok') throw refuse(check.state === 'absent' ? 'not a plain folder (a link or a file)' : check.reason, dir);
  return made;
}

/**
 * The state file, created empty with the exclusive flag when absent; its size is the one thing a person cannot fix by removing the folder, so it is refused by name. In a folder
 * this run made, a file accord did not create is refused (review WR-01); elsewhere one that another run made first is judged with the folder before it is used.
 */
function ensureFile(file: string, madeNow: boolean): void {
  const planted = 'a file accord did not create, in the folder it made this run (another account wrote in it)';
  let found: Stats | undefined = lstatSync(file, { throwIfNoEntry: false });
  if (found !== undefined && madeNow) throw refuse(planted, file);
  if (found === undefined) {
    try {
      closeSync(openSync(file, 'wx', 0o600));
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== 'EEXIST') throw e;
      if (madeNow) throw refuse(planted, file);
      const again = checkDebugFolder(folderOf(file), { stateFile: file });
      if (again.state !== 'ok') throw refuse(again.state === 'absent' ? 'not a plain folder (a link or a file)' : again.reason, folderOf(file));
    }
    found = lstatSync(file, { throwIfNoEntry: false });
  }
  if (found === undefined || found.isSymbolicLink() || !found.isFile()) throw refuse('not a regular file (a link or a folder)', file);
  if (found.size > DEBUG_STATE_MAX) throw new UsageError(`${file} is too large (${found.size} bytes, over the limit of ${DEBUG_STATE_MAX}) - nothing was changed; trim or remove it and run accord debug path again`);
}

/** `accord debug path [--json]`: print the state file's path and whether an episode is open in it; create it empty when absent. */
export function debugPath(ctx: CommandContext, options: { json?: boolean }): number {
  const file = debugStatePath(ctx.root);
  ensureFile(file, ensureFolder(folderOf(file), file));
  // the folder was just checked above: only the file is read here
  const episode = debugOpen(readStateFile(file)?.text ?? '') ? 'open' : 'none';
  ctx.stdout.write(options.json === true ? JSON.stringify({ path: file, episode }, null, 2) + '\n' : `path: ${file}\nepisode: ${episode}\n`);
  return 0;
}
