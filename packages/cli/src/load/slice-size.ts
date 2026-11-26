// Phase 15 D-06, D-10: where a slice starts and how large it is. A slice's start is the merge base of HEAD with the previous slice's branch (this clone's copy, else origin's, as in CI where only
// the remote ref exists): the claim branch for slice 2, `slice/<id>/<n-1>` after it; slice 1 starts at the plan's `baseline:`. The size is `git diff --numstat` from that start, left to the pure
// `sliceSizeOf` to count; the files accord itself renders and the lockfiles are not counted (Ruling R13). Every failure is "no answer" (undefined): the callers warn about nothing they could not measure.
import { execFileSync } from 'node:child_process';
import { DEFAULT_BRANCH_TEMPLATE, renderBranch, sliceSizeOf, workOf } from '@accord-dev/accord-core';
import type { NumstatLine, RepoSnapshot, SkillFile, SliceSize } from '@accord-dev/accord-core';
import { sliceBranch } from './slices.js';

/** The lockfiles of the usual package managers, by file name at any depth: never a reviewer's reading. */
const LOCKFILES: ReadonlySet<string> = new Set([
  'package-lock.json', 'npm-shrinkwrap.json', 'yarn.lock', 'pnpm-lock.yaml', 'bun.lockb', 'Cargo.lock', 'poetry.lock', 'Pipfile.lock', 'go.sum', 'composer.lock', 'Gemfile.lock',
]);

const git = (root: string, args: string[]): string =>
  execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 64 * 1024 * 1024 });

/** The first commit a name or sha resolves to, as a full sha, or undefined. */
function commitOf(root: string, ref: string): string | undefined {
  try {
    return git(root, ['rev-parse', '--verify', '-q', ref + '^{commit}']).trim() || undefined;
  } catch {
    return undefined;
  }
}

/** The claim branch of a ticket the way `accord worktree` names it: the one the loader found, else the template's name. */
function claimBranchOf(snapshot: RepoSnapshot, id: string): string {
  if (snapshot.claimBranches !== undefined && Object.hasOwn(snapshot.claimBranches, id)) return snapshot.claimBranches[id];
  const own = Object.hasOwn(snapshot.tickets, id) ? snapshot.tickets[id].frontmatter : undefined;
  return renderBranch(
    snapshot.claimTemplate ?? DEFAULT_BRANCH_TEMPLATE,
    { id, ...(own?.title === undefined ? {} : { title: own.title }), ...(own?.change === undefined ? {} : { change: own.change }) },
    snapshot.config,
  );
}

/**
 * The commit slice `n` of ticket `id` starts at, as a full sha, or undefined when git cannot say (no such branch, no common history, no baseline). Slice 1: the plan's `baseline:`. Slice n of 2 or more: the merge
 * base of HEAD with the branch of slice n-1, a local branch first and then origin's copy of it.
 */
export function sliceStart(root: string, snapshot: RepoSnapshot, id: string, n: number): string | undefined {
  try {
    if (!Number.isInteger(n) || n < 1) return undefined;
    if (n === 1) {
      const baseline = workOf(snapshot, id)?.plan?.baseline;
      return baseline === undefined ? undefined : commitOf(root, baseline);
    }
    const previous = n === 2 ? claimBranchOf(snapshot, id) : sliceBranch(id, n - 1);
    for (const ref of [`refs/heads/${previous}`, `refs/remotes/origin/${previous}`]) {
      if (commitOf(root, ref) === undefined) continue;
      const base = git(root, ['merge-base', 'HEAD', ref]).trim();
      if (base !== '') return base;
    }
    return undefined;
  } catch {
    return undefined;
  }
}

/** `git diff --numstat -z` text as lines: `<added>\t<deleted>\t<path>\0` each; a binary file is `-\t-` and counts 0. */
function parseNumstat(text: string): NumstatLine[] {
  const out: NumstatLine[] = [];
  for (const record of text.split('\0')) {
    const m = /^(\d+|-)\t(\d+|-)\t([\s\S]+)$/.exec(record);
    if (m !== null) out.push({ added: m[1] === '-' ? 0 : Number(m[1]), deleted: m[2] === '-' ? 0 : Number(m[2]), path: m[3] });
  }
  return out;
}

/**
 * The measured size of slice `n` of `id`: what HEAD holds since the slice's start, with the ticket records, the files `accord skills sync` renders and the lockfiles left out; undefined when the start is unknown or git
 * fails, so no warning is made from a number nobody measured. `rendered` is the lazy list of copies accord writes (`renderedFilesOf` of the config): a loader imports no command, so the caller hands it over.
 */
export function gitSliceSize(root: string, snapshot: RepoSnapshot, id: string, n: number, rendered: () => SkillFile[]): (SliceSize & { n: number }) | undefined {
  const start = sliceStart(root, snapshot, id, n);
  if (start === undefined) return undefined;
  try {
    const copies = new Set(rendered().map((f) => f.path));
    const text = git(root, ['diff', '--numstat', '--no-renames', '-z', `${start}...HEAD`, '--']);
    const excluded = (path: string): boolean => copies.has(path) || LOCKFILES.has(path.slice(path.lastIndexOf('/') + 1));
    return { n, ...sliceSizeOf(parseNumstat(text), excluded) };
  } catch {
    return undefined;
  }
}
