// Phase 15 D-06, D-10: where a slice starts and how large it is. The size is measured from the slice's own branch over its base (`sliceRange`, review C-WR-05); `sliceStart` below is the
// start `accord anchor` and `accord review-package` print and diff from. A slice's start is the merge base of HEAD with the previous slice's branch (this clone's copy, else origin's, as in CI where only
// the remote ref exists): the claim branch for slice 2, `slice/<id>/<n-1>` after it; slice 1 starts at the plan's `baseline:`. The size is `git diff --numstat` from that start, left to the pure
// `sliceSizeOf` to count; the files accord itself renders and the lockfiles are not counted (Ruling R13). Every failure is "no answer" (undefined): the callers warn about nothing they could not measure.
import { execFileSync } from 'node:child_process';
import { DEFAULT_BRANCH_TEMPLATE, renderBranch, sliceSizeOf, workOf } from '@accord-dev/accord-core';
import type { NumstatLine, RepoSnapshot, SkillFile, SliceSize } from '@accord-dev/accord-core';
import { defaultRefOf } from './fs.js';
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

/** A local branch of that name, else origin's copy (as in CI, where only the remote ref exists), as a ref name; undefined when neither resolves. */
function branchRef(root: string, name: string): string | undefined {
  return [`refs/heads/${name}`, `refs/remotes/origin/${name}`].find((ref) => commitOf(root, ref) !== undefined);
}

const isAncestor = (root: string, ancestor: string, of: string): boolean => {
  try {
    git(root, ['merge-base', '--is-ancestor', ancestor, of]);
    return true;
  } catch {
    return false;
  }
};

/**
 * What a reviewer of slice `n`'s pull request reads, as the two ends of a `base...tip` diff (review C-WR-05). The tip is slice n's own branch (the claim branch for slice 1, this clone's copy, else origin's), HEAD only when that branch
 * is not there, so a run from another slice's checkout measures the slice it was asked about. The base is the branch the pull request stacks on: the default branch for slice 1 (the plan's `baseline:` only when there is none), the branch of slice n-1 for
 * slice n, and the default branch once slice n-1 is merged into it. The diff is three-dot, from the merge base, so what the default branch gained after the fork and was merged into the slice branch is not counted. Undefined when git
 * cannot say: no previous slice branch, no default branch and no baseline.
 */
export function sliceRange(root: string, snapshot: RepoSnapshot, id: string, n: number): { base: string; tip: string } | undefined {
  try {
    if (!Number.isInteger(n) || n < 1) return undefined;
    const tip = branchRef(root, n === 1 ? claimBranchOf(snapshot, id) : sliceBranch(id, n)) ?? 'HEAD';
    const def = defaultRefOf(root);
    if (n === 1) {
      if (def !== undefined) return { base: def, tip };
      const baseline = sliceStart(root, snapshot, id, 1);
      return baseline === undefined ? undefined : { base: baseline, tip };
    }
    const previous = branchRef(root, n === 2 ? claimBranchOf(snapshot, id) : sliceBranch(id, n - 1));
    if (previous === undefined) return undefined;
    return { base: def !== undefined && isAncestor(root, previous, def) ? def : previous, tip };
  } catch {
    return undefined;
  }
}

/**
 * The measured size of slice `n` of `id`: what its own branch adds over its base (`sliceRange`), with the ticket records, the files `accord skills sync` renders and the lockfiles left out; undefined when the range is unknown or git
 * fails, so no warning is made from a number nobody measured. `rendered` is the lazy list of copies accord writes (`renderedFilesOf` of the config): a loader imports no command, so the caller hands it over.
 */
export function gitSliceSize(root: string, snapshot: RepoSnapshot, id: string, n: number, rendered: () => SkillFile[]): (SliceSize & { n: number }) | undefined {
  const range = sliceRange(root, snapshot, id, n);
  if (range === undefined) return undefined;
  try {
    const copies = new Set(rendered().map((f) => f.path));
    const text = git(root, ['diff', '--numstat', '--no-renames', '-z', `${range.base}...${range.tip}`, '--']);
    const excluded = (path: string): boolean => copies.has(path) || LOCKFILES.has(path.slice(path.lastIndexOf('/') + 1));
    return { n, ...sliceSizeOf(parseNumstat(text), excluded) };
  } catch {
    return undefined;
  }
}
