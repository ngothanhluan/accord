// D-51 filesystem loader: a repository root becomes a SnapshotInput through `git ls-files` and readdir.
// Impure by design (node:fs, node:path, node:child_process are allowed in the CLI package).
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { isAbsolute, join, relative, resolve, sep } from 'node:path';
import { loadSnapshot } from '@accord-dev/accord-core';
import type { SnapshotInput } from '@accord-dev/accord-core';

/** Environment problem the user must fix (no git, not a repository, no accord/ folder); exit 2 in Phase 5. */
export class UsageError extends Error {
  readonly exitCode = 2;
  constructor(message: string) {
    super(message);
    this.name = 'UsageError';
  }
}

/** Tracked plus untracked-but-not-ignored paths, forward slashes, sorted, de-duplicated (D-51). */
function gitTree(root: string): string[] {
  let out: string;
  try {
    out = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'], {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch (err) {
    const e = err as { code?: string; stderr?: string };
    if (e.code === 'ENOENT') throw new UsageError('git is required but was not found on PATH');
    const stderr = String(e.stderr ?? '').trim();
    throw new UsageError('not a git repository (or git failed): ' + root + '\n' + stderr);
  }
  return [...new Set(out.split('\0').filter((p) => p !== ''))].sort();
}

/** Every regular file under `accord/`, keyed by its posix path relative to the root (D-30). */
function accordFiles(root: string): Record<string, string> {
  const accordDir = join(root, 'accord');
  if (!statSync(accordDir, { throwIfNoEntry: false })?.isDirectory()) {
    throw new UsageError('no accord/ folder in ' + root);
  }
  const files: Record<string, string> = {};
  for (const d of readdirSync(accordDir, { recursive: true, withFileTypes: true })) {
    if (!d.isFile()) continue;
    const abs = join(d.parentPath, d.name);
    files[relative(root, abs).split(sep).join('/')] = readFileSync(abs, 'utf8');
  }
  return files;
}

/** Path of the configured tokens file relative to the root, or undefined when unset, missing, or outside the root (T-02-20). */
function tokensPath(root: string, tokens: string | undefined): string | undefined {
  if (!tokens) return undefined;
  const rel = tokens.replace(/\\/g, '/').replace(/^\.\//, '');
  const abs = resolve(root, rel);
  const back = relative(root, abs);
  if (back === '' || back.startsWith('..') || isAbsolute(back)) return undefined;
  if (!existsSync(abs) || !statSync(abs).isFile()) return undefined;
  return back.split(sep).join('/');
}

export function loadFromFs(root: string): SnapshotInput {
  const tree = gitTree(root);
  const files = accordFiles(root);
  // First pass reads config.design.tokens; a missing tokens file is Phase 3's lint concern (LINT-04).
  const tokens = tokensPath(root, loadSnapshot({ files, tree }).config?.design.tokens);
  if (tokens !== undefined) files[tokens] = readFileSync(join(root, tokens), 'utf8');
  return { files, tree };
}
