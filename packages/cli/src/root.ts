// D-103 root resolution: `git rev-parse --show-toplevel`, so every command reads the whole repository
// no matter which subdirectory it was typed in. Walking up looking for `accord/` was rejected — a root
// that is not the git top-level makes `git ls-files` list one subtree and D-82 evidence resolution
// fails silently. Impure by design; `git` is spawned by name with a literal argument array and no
// shell, never a package manager and never a `.cmd` shim (CLI-07).
import { sep } from 'node:path';
import { UsageError } from './load/fs.js';
import { gitStartFailure, runGitSync } from './load/git-spawn.js';

/** The git top-level containing `cwd`, forward slashes, no trailing separator (D-103). */
export function repoRoot(cwd: string): string {
  let out: string;
  try {
    out = runGitSync(['rev-parse', '--show-toplevel'], {
      cwd,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch (err) {
    // Phase 08.8 D-15: the sentences come from `gitStartFailure`, the function `gitTree` uses too, so the two git spawn sites cannot drift apart.
    if (err instanceof UsageError) throw err;
    throw gitStartFailure(err, cwd);
  }
  return out.trim().split(sep).join('/');
}
