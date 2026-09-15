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

/** A configured path relative to the root, or undefined when unset, missing, or outside the root (T-02-20, T-03-02). */
function containedPath(root: string, rel: string | undefined): string | undefined {
  if (!rel) return undefined;
  rel = rel.replace(/\\/g, '/').replace(/^\.\//, '');
  const abs = resolve(root, rel);
  const back = relative(root, abs);
  if (back === '' || back.startsWith('..') || isAbsolute(back)) return undefined;
  if (!existsSync(abs) || !statSync(abs).isFile()) return undefined;
  return back.split(sep).join('/');
}

/**
 * D-78 host facts: the gated commit with its author, plus the author of every file under
 * `accord/tickets`. Two `git` invocations, spawned by name with a literal argument array — never a
 * Windows batch shim, never a package manager, and never through a shell (STACK "What NOT to Use",
 * D-51). Nothing beyond the author identity is read: no diff, no message body, no remote.
 *
 * Returns undefined when the repository has no commit, so `loadFromFs` omits the key rather than emit
 * `undefined` and move the D-54 goldens; Done then fails cleanly with `gate.commit-missing`.
 */
function gitFacts(root: string): { commit: string; authors: Record<string, string> } | undefined {
  const git = (args: string[]) =>
    execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  let head: string;
  try {
    head = git(['show', '-s', '--format=%H%x00%ae', 'HEAD']);
  } catch {
    // `gitTree` runs first, so a missing binary has already thrown the ENOENT UsageError; a failure
    // here means an unborn HEAD and nothing else.
    return undefined;
  }
  const [commit, commitAuthor] = head.trim().split('\0');
  if (commit === undefined || commitAuthor === undefined) return undefined;
  const authors: Record<string, string> = {};
  let log: string;
  try {
    // One bounded walk over one subtree in one spawn (T-04-23).
    log = git(['log', '--format=%x01%ae', '--name-only', '--', 'accord/tickets']);
  } catch {
    log = '';
  }
  let author: string | undefined;
  for (const line of log.split('\n')) {
    const text = line.trim();
    if (text === '') continue;
    if (text.startsWith('')) author = text.slice(1);
    // git log emits the most recent commit first, so the first author seen for a path is the latest.
    else if (author !== undefined) {
      const key = text.split(sep).join('/');
      if (!Object.hasOwn(authors, key)) authors[key] = author;
    }
  }
  // D-78: the gated commit's author rides under a key equal to the sha, which cannot collide with a path.
  authors[commit] = commitAuthor;
  return { commit, authors };
}

export function loadFromFs(root: string): SnapshotInput {
  const tree = gitTree(root);
  const files = accordFiles(root);
  // First pass reads the config; the tokens file and the test report are read the same way,
  // and a missing one is lint's concern (LINT-04, FMT-11).
  const config = loadSnapshot({ files, tree }).config;
  for (const value of [config?.design.tokens, config?.tests?.report]) {
    const key = containedPath(root, value);
    if (key !== undefined) files[key] = readFileSync(join(root, key), 'utf8');
  }
  const git = gitFacts(root);
  return { files, tree, ...(git === undefined ? {} : { git }) };
}
