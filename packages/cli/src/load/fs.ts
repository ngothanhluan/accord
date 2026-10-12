// D-51 filesystem loader: a repository root becomes a SnapshotInput through `git ls-files` and readdir.
// Impure by design (node:fs, node:path, node:child_process are allowed in the CLI package).
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { isAbsolute, join, relative, resolve, sep } from 'node:path';
import { isSha, loadSnapshot } from '@accord-dev/accord-core';
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

/**
 * Spec §5: a branch named t/<id>, local or on any remote, claims ticket <id> for the author of its tip.
 * One spawn, literal arguments. for-each-ref sorts by refname, so refs/remotes/... is read after
 * refs/heads/... and the pushed claim, the one teammates see, wins.
 *
 * A failure throws: `gitTree` has already proved git and the repository, so a failed for-each-ref is a
 * broken ref store, and silently dropping claims would offer held tickets as free. No match exits 0.
 */
function gitClaims(root: string): Record<string, string> {
  let out: string;
  try {
    // for-each-ref globs with WM_PATHNAME, so `*` stays within one segment.
    // shortcut: a remote whose name contains `/` is not matched; widen the pattern if one ever must be.
    out = execFileSync('git', ['for-each-ref', '--format=%(refname)%00%(authoremail)', 'refs/heads/t/', 'refs/remotes/*/t/*'], {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch (err) {
    const stderr = String((err as { stderr?: string }).stderr ?? '').trim();
    throw new UsageError('git for-each-ref failed reading the t/<id> claim branches' + (stderr === '' ? '' : '\n' + stderr));
  }
  const claims: Record<string, string> = {};
  for (const line of out.split('\n')) {
    const [ref, email] = line.split('\0');
    const m = /^refs\/(?:heads|remotes\/[^/]+)\/t\/([^/]+)$/.exec(ref ?? '');
    if (m !== null && email !== undefined) claims[m[1]] = email.replace(/^<|>$/g, '');
  }
  return claims;
}

/**
 * Spec §7: is each lane plan's baseline an ancestor of HEAD? Per sha, `git merge-base --is-ancestor`:
 * exit 0 is true and every other outcome is false (an unknown sha exits 128, a spawn failure throws).
 * Never a UsageError: this runs for every command, so a typo'd baseline must not break `status` or
 * `lint`; false fails `gate plan` closed. `isSha` runs first, so a value cannot read as an option.
 */
function gitAncestors(root: string, shas: string[]): Record<string, boolean> {
  const out: Record<string, boolean> = {};
  for (const sha of shas) {
    try {
      execFileSync('git', ['merge-base', '--is-ancestor', sha, 'HEAD'], { cwd: root, stdio: 'ignore' });
      out[sha] = true;
    } catch {
      out[sha] = false;
    }
  }
  return out;
}

/**
 * Spec §7: which of the plans' non-new `files:` paths exist at each baseline that is an ancestor of HEAD.
 * One `git ls-tree` per baseline; `--literal-pathspecs` keeps a path from reading as pathspec magic, `isSha`
 * keeps the sha from reading as an option. A git failure is an environment error, not a verdict.
 */
function gitBaselineFiles(root: string, wanted: Record<string, string[]>, ancestors: Record<string, boolean>): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const [sha, paths] of Object.entries(wanted)) {
    if (!ancestors[sha]) continue;
    if (paths.length === 0) {
      out[sha] = [];
      continue;
    }
    try {
      const raw = execFileSync('git', ['--literal-pathspecs', 'ls-tree', '--name-only', '-z', sha, '--', ...paths], {
        cwd: root,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
        maxBuffer: 64 * 1024 * 1024,
      });
      out[sha] = raw.split('\0').filter((p) => p !== '');
    } catch (err) {
      const stderr = String((err as { stderr?: string }).stderr ?? '').trim();
      throw new UsageError(`git ls-tree failed at baseline ${sha}` + (stderr === '' ? '' : '\n' + stderr));
    }
  }
  return out;
}

export function loadFromFs(root: string): SnapshotInput {
  const tree = gitTree(root);
  const files = accordFiles(root);
  // First pass reads the config; the tokens file and the test report are read the same way,
  // and a missing one is lint's concern (LINT-04, FMT-11).
  const first = loadSnapshot({ files, tree });
  const config = first.config;
  for (const value of [config?.design.tokens, config?.tests?.report]) {
    const key = containedPath(root, value);
    if (key !== undefined) files[key] = readFileSync(join(root, key), 'utf8');
  }
  const git = gitFacts(root);
  const shas = [
    ...new Set(Object.values(first.work ?? {}).flatMap((w) => (w.plan?.baseline !== undefined && isSha(w.plan.baseline) ? [w.plan.baseline] : []))),
  ];
  const claims = gitClaims(root);
  const ancestors = shas.length === 0 ? undefined : gitAncestors(root, shas);
  const wanted: Record<string, string[]> = {};
  for (const plan of Object.values(first.work ?? {}).flatMap((w) => (w.plan === undefined ? [] : [w.plan]))) {
    const sha = plan.baseline;
    if (sha === undefined || !isSha(sha)) continue;
    const mine = plan.tasks.flatMap((t) => t.files.filter((f) => !t.newFiles.includes(f)));
    wanted[sha] = [...new Set([...(wanted[sha] ?? []), ...mine])];
  }
  const baselineFiles = ancestors === undefined ? {} : gitBaselineFiles(root, wanted, ancestors);
  return {
    files,
    tree,
    ...(git === undefined ? {} : { git }),
    // Omitted when empty, so a repository with no ticket branch loads exactly as before.
    ...(Object.keys(claims).length === 0 ? {} : { claims }),
    ...(ancestors === undefined ? {} : { ancestors }),
    ...(Object.keys(baselineFiles).length === 0 ? {} : { baselineFiles }),
  };
}
