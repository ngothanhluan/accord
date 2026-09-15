// D-103 root resolution: `git rev-parse --show-toplevel`, so every command reads the whole repository
// no matter which subdirectory it was typed in. Walking up looking for `accord/` was rejected — a root
// that is not the git top-level makes `git ls-files` list one subtree and D-82 evidence resolution
// fails silently. Impure by design; `git` is spawned by name with a literal argument array and no
// shell, never a package manager and never a `.cmd` shim (CLI-07).
import { execFileSync } from 'node:child_process';
import { sep } from 'node:path';
import { UsageError } from './load/fs.js';

/** The git top-level containing `cwd`, forward slashes, no trailing separator (D-103). */
export function repoRoot(cwd: string): string {
  let out: string;
  try {
    out = execFileSync('git', ['rev-parse', '--show-toplevel'], {
      cwd,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch (err) {
    const e = err as { code?: string; stderr?: string };
    // The same sentence `gitTree` uses, so the two git spawn sites cannot drift apart.
    if (e.code === 'ENOENT') throw new UsageError('git is required but was not found on PATH');
    const stderr = String(e.stderr ?? '').trim();
    throw new UsageError('not a git repository (or git failed): ' + cwd + '\n' + stderr);
  }
  return out.trim().split(sep).join('/');
}
