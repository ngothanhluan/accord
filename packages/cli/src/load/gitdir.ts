// Phase 08.9.2 D-03: where a checkout's git folders are, read with file reads only (no git process), so a hook can ask "is accord off here?" for free.
// A main checkout's `.git` is the common folder itself. A linked worktree's `.git` is a file `gitdir: <path>` naming its own folder
// (`<main>/.git/worktrees/<name>`), whose `commondir` file points back at the common folder (`../..`). The personal off marker lives in the common folder,
// so one switch covers every worktree of the clone. The launcher (packages/core/launcher/accord.mjs) makes the same reads; keep the two in step.
import { existsSync, readFileSync, statSync } from 'node:fs';
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
