// Phase 08.9.2 D-03: where a checkout's git folders are, read with file reads only (no git process), so a hook can ask "is accord off here?" for free.
// A main checkout's `.git` is the common folder itself. A linked worktree's `.git` is a file `gitdir: <path>` naming its own folder
// (`<main>/.git/worktrees/<name>`), whose `commondir` file points back at the common folder (`../..`). The personal off marker lives in the common folder,
// so one switch covers every worktree of the clone. The launcher (packages/core/launcher/accord.mjs) makes the same reads; keep the two in step.
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

/** The file `accord off` writes in the common git folder and `accord on` removes. */
export const OFF_MARKER = 'accord-off';

export interface GitDirs {
  /** The folder holding this checkout's HEAD and index: `.git` itself, or the per-worktree folder a `.git` file names. */
  gitDir: string;
  /** The folder every worktree of the clone shares: `info/exclude`, the config, and the off marker. */
  commonDir: string;
}

const isFolder = (p: string): boolean => {
  try {
    return statSync(p).isDirectory();
  } catch {
    return false;
  }
};

/** The first line of a small text file, or undefined when it cannot be read. */
function firstLine(file: string): string | undefined {
  try {
    return readFileSync(file, 'utf8').split(/\r?\n/, 1)[0]?.trim();
  } catch {
    return undefined;
  }
}

/** Walks up from `dir` to the first folder holding a `.git` file or folder; undefined when there is none. */
export function checkoutOf(dir: string): string | undefined {
  let at = resolve(dir);
  for (;;) {
    if (existsSync(join(at, '.git'))) return at;
    const up = dirname(at);
    if (up === at) return undefined;
    at = up;
  }
}

/**
 * The git folders of the checkout at `root`, or undefined when `root` has no readable `.git`. A `.git` file is read only as its first line,
 * `gitdir: <path>` (resolved against `root`); `commondir`'s first line is resolved against that folder, and both folders must exist.
 */
export function gitDirsOf(root: string): GitDirs | undefined {
  const dotGit = join(root, '.git');
  if (isFolder(dotGit)) return { gitDir: dotGit, commonDir: dotGit };
  const line = firstLine(dotGit);
  if (line === undefined || !line.startsWith('gitdir:')) return undefined;
  const named = line.slice('gitdir:'.length).trim();
  if (named === '') return undefined;
  const gitDir = resolve(root, named);
  if (!isFolder(gitDir)) return undefined;
  const common = firstLine(join(gitDir, 'commondir'));
  const commonDir = common === undefined || common === '' ? gitDir : resolve(gitDir, common);
  return isFolder(commonDir) ? { gitDir, commonDir } : undefined;
}

/** `<common git folder>/accord-off` of the checkout at `root`; undefined when its git folders cannot be read. */
export function offMarkerPath(root: string): string | undefined {
  const dirs = gitDirsOf(root);
  return dirs === undefined ? undefined : join(dirs.commonDir, OFF_MARKER);
}

/** True when accord is switched off in the clone `dir` belongs to. Never throws: a folder that cannot be read is not off. */
export function isOff(dir: string): boolean {
  try {
    const root = checkoutOf(dir);
    const marker = root === undefined ? undefined : offMarkerPath(root);
    return marker !== undefined && existsSync(marker);
  } catch {
    return false;
  }
}

/**
 * Phase 08.9.2 D-02, L-02: the branch a checkout is on, read from the first line of `<gitDir>/HEAD` with no git process. `ref: refs/heads/<name>` gives the name,
 * a bare object name (a detached HEAD) gives '', and anything else, or a file that cannot be read, gives undefined.
 */
export function headBranchOf(gitDir: string): string | undefined {
  const line = firstLine(join(gitDir, 'HEAD'));
  if (line === undefined) return undefined;
  const ref = /^ref:[ \t]*refs\/heads\/(.+)$/.exec(line);
  if (ref !== null) return ref[1];
  return /^[0-9a-f]{40,64}$/i.test(line) ? '' : undefined;
}

/** Phase 08.9.2 Ruling-wake-session: the folder, in a checkout's own git folder, holding one small file per session that typed /accord; the launcher reads the same files. */
export const WAKE_DIR = 'accord-wake';
/** A session id may name a file only when it is a plain name: letters, digits, `_` and `-`, 1 to 128 of them (T-08.9.2-29). */
const SESSION_NAME = /^[A-Za-z0-9_-]{1,128}$/;
/** A wake file older than this is a session nobody is coming back to; each write removes such files. */
const WAKE_KEEP_MS = 24 * 3_600_000;

/** `<per-worktree git folder>/accord-wake/<session_id>` of the checkout at `root`; undefined unless the id is a plain name and the git folders can be read. */
export function wakeFilePath(root: string, sessionId: string | undefined): string | undefined {
  if (typeof sessionId !== 'string' || !SESSION_NAME.test(sessionId)) return undefined;
  const dirs = gitDirsOf(root);
  return dirs === undefined ? undefined : join(dirs.gitDir, WAKE_DIR, sessionId);
}

/** True when the session `sessionId` of the clone `dir` belongs to has typed /accord (its wake file exists). Never throws: anything unreadable is not woken. */
export function isWoken(dir: string, sessionId: string | undefined): boolean {
  try {
    const root = checkoutOf(dir);
    const file = root === undefined ? undefined : wakeFilePath(root, sessionId);
    return file !== undefined && existsSync(file);
  } catch {
    return false;
  }
}

/** Writes the wake file temp-then-rename, so a reader never sees half a file, and removes the files of the folder older than 24 hours. Throws on a failed write. */
export function writeWakeFile(file: string, delivered: boolean, now: Date = new Date()): void {
  const folder = dirname(file);
  mkdirSync(folder, { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  writeFileSync(tmp, JSON.stringify({ since: now.toISOString(), delivered }) + '\n');
  renameSync(tmp, file);
  try {
    for (const name of readdirSync(folder)) {
      const old = join(folder, name);
      if (old !== file && now.getTime() - statSync(old).mtimeMs > WAKE_KEEP_MS) rmSync(old, { force: true });
    }
  } catch {
    // a folder that cannot be pruned is left as it is
  }
}
