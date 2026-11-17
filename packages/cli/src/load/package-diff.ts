// ST-LN-36 (05-04): the review package's diff of any head. `accord review-package` calls it for HEAD; the security record rule (plan 05-06) calls it for the head
// each recorded round names, so the package a reviewer read and the one the gate checks are built by the same git commands. git only, literal argument
// arrays, no shell, and nothing here writes.
import { execFileSync } from 'node:child_process';
import { stageOff, workOf } from '@accord-dev/accord-core';
import type { RepoSnapshot } from '@accord-dev/accord-core';
import { defaultRefOf, UsageError } from './fs.js';

// No leading '-', so a ref can never be read as a git option; no spaces or shell metacharacters.
// `~` and `^` after the first character admit HEAD~3 and main^.
export const REF = /^[A-Za-z0-9][A-Za-z0-9._/~^-]*$/;

/**
 * The base of the first round of a ticket: the default ref for lane S, else the plan's `baseline:`, else, with the plan stage off, the default ref;
 * undefined when none. `known` hands over a default ref the caller already read, so no extra `git for-each-ref` runs.
 */
export function roundOneBase(root: string, snapshot: RepoSnapshot, id: string, known?: { defaultRef: string | undefined }): string | undefined {
  const defaultRef = (): string | undefined => (known === undefined ? defaultRefOf(root) : known.defaultRef);
  if (snapshot.tickets[id]?.frontmatter?.lane === 'S') return defaultRef();
  const baseline = workOf(snapshot, id)?.plan?.baseline;
  if (baseline !== undefined) return baseline;
  return stageOff(snapshot, id, 'plan') ? defaultRef() : undefined;
}

export interface PackageDiffOptions {
  base: string;
  /** a commit-ish: `HEAD` for the package of the branch, a recorded round's head for that round's package. */
  head: string;
  /** the default ref a merge from it is left out against; undefined when the repository has none. */
  def: string | undefined;
  /** a record that predates the loop rounds falls back to a plain `git log -p` where git cannot `--remerge-diff` (git < 2.36). */
  allowPlainLog: boolean;
  /** also read the commit list and the stat. */
  parts?: boolean;
}

export interface PackageDiffResult {
  /** the diff text with ten lines of context, trailing whitespace removed; empty when there is none. */
  diff: string;
  /** the changed paths, read NUL-separated. */
  changed: string[];
  /** a merge from the default branch is left out of the package (ST-LN-26). */
  excluded: boolean;
  /** the default ref without `refs/remotes/` or `refs/heads/`. */
  short: string | undefined;
  /** with `parts`: the commit lines and the stat, trailing whitespace removed. */
  commits?: string;
  stat?: string;
}

/** A short reason for the one failure that explains itself, else git's own first stderr line. */
export function why(e: unknown): string {
  const err = e as { code?: string; stderr?: string };
  if (err.code === 'ENOBUFS') return 'the diff is larger than 64 MiB';
  const line = (err.stderr ?? '').split('\n').find((l) => l.trim() !== '');
  return line === undefined ? 'git failed' : line.replace(/^fatal: /, '').trim();
}

/** The package diff of `head` over `base`. A git failure throws as git threw it; the caller words it (see `why`). */
export function packageDiff(root: string, o: PackageDiffOptions): PackageDiffResult {
  const { base, head, def } = o;
  if (!REF.test(base)) throw new UsageError('not a git ref: ' + base);
  if (!REF.test(head)) throw new UsageError('not a git ref: ' + head);
  const git = (args: string[]) =>
    execFileSync('git', args, {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      maxBuffer: 64 * 1024 * 1024,
    });
  // Every git log passes the signature flags (conventions.md), so a signed head never changes the output. Every call whose text is read for paths
  // (log -p, diff -p, --stat) passes core.quotePath=false, so a non-ASCII name prints as it is and not as a quoted octal escape the reader cannot place.
  const NO_QUOTE = ['-c', 'core.quotePath=false'];
  const gitLog = (args: string[]) => git([...NO_QUOTE, '-c', 'log.showSignature=false', 'log', '--no-show-signature', ...args]);
  const range = base + '...' + head;
  // ST-LN-26: a fix made after a merge from the default branch is reviewed without what that merge brought in.
  const short = def?.replace(/^refs\/(remotes|heads)\//, '');
  let excluded = false;
  if (def !== undefined) {
    try {
      git(['merge-base', '--is-ancestor', head, def]);
    } catch {
      try {
        const count = (extra: string[]) => git(['rev-list', '--count', base + '..' + head, ...extra, '--']).trim();
        excluded = count(['^' + def]) !== count([]);
      } catch {
        // a count that fails leaves today's package
      }
    }
  }
  // Each git log is tried with --remerge-diff first and once more without it (git < 2.36).
  const log = (args: string[]): string => {
    const full = (extra: string[]) => gitLog([...args, ...extra, base + '..' + head, '^' + def, '--']);
    try {
      return full(['--remerge-diff']);
    } catch {
      if (!o.allowPlainLog) throw new UsageError(`cannot diff ${range}: git cannot show a merge's own changes (git log --remerge-diff needs git 2.36 or newer)`);
      return full([]);
    }
  };
  // BUG-LN-19: oldest first without --reverse, since git 2.36 to 2.47 show a clean merge's changes wrong when --reverse meets
  // --remerge-diff (fixed in git 2.48). Each commit's text starts at its \x01 header line; no diff or stat line starts with \x01.
  const oldestFirst = (args: string[]): string => {
    const text = log([...args, '--format=%x01%h %s']);
    if (!text.startsWith('\x01')) return text;
    const commits = text.slice(1).split('\n\x01');
    return commits
      .map((c, i) => (i < commits.length - 1 ? c + '\n' : c))
      .reverse()
      .join('');
  };
  const result: PackageDiffResult = { diff: '', changed: [], excluded, short };
  if (o.parts === true) {
    result.commits = (excluded
      ? gitLog(['--no-color', '--format=%h %s', base + '..' + head, '^' + def, '--'])
      : gitLog(['--no-color', '--format=%h %s', base + '..' + head, '--'])
    ).trimEnd();
    result.stat = (excluded
      ? oldestFirst(['--no-color', '--no-ext-diff', '--stat'])
      : git([...NO_QUOTE, 'diff', '--no-color', '--no-ext-diff', '--stat', range, '--'])
    ).trimEnd();
  }
  result.diff = (excluded ? oldestFirst(['--no-color', '--no-ext-diff', '-p', '-U10']) : git([...NO_QUOTE, 'diff', '--no-color', '--no-ext-diff', '-U10', range, '--'])).trimEnd();
  result.changed = excluded
    ? [...new Set(log(['--no-renames', '--name-only', '-z', '--format=']).split(/[\0\n]/).filter((p) => p !== ''))]
    : git(['diff', '--name-only', '-z', '--no-renames', range, '--']).split('\0').filter((p) => p !== '');
  return result;
}
