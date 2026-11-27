// Phase 15 D-06, D-10: where a slice starts and how large it is. The size is measured from the slice's own branch over its base (`sliceRange`, review C-WR-05); `sliceStart` below is the
// start `accord anchor` and `accord review-package` print and diff from. Phase 08.9.3 D-14: where a slice lives, and which slice is its previous one, is core's `sliceHome`; a slice of another repository is read in that
// repository's clone. A slice's start is the merge base of HEAD with the previous slice's branch (this clone's copy, else origin's, as in CI where only
// the remote ref exists): the claim branch for slice 2, `slice/<id>/<n-1>` after it; slice 1 starts at the plan's `baseline:`. The size is `git diff --numstat` from that start, left to the pure
// `sliceSizeOf` to count; the files accord itself renders and the lockfiles are not counted (Ruling R13). Every failure is "no answer" (undefined): the callers warn about nothing they could not measure.
import { execFileSync } from 'node:child_process';
import { DEFAULT_BRANCH_TEMPLATE, isSha, renderBranch, sliceHome, sliceSizeOf, workOf } from '@accord-dev/accord-core';
import type { NumstatLine, RepoSnapshot, SkillFile, SliceHome, SliceSize } from '@accord-dev/accord-core';
import { defaultRefOf } from './fs.js';
import { resolveRepo } from './repos.js';

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
 * The slices core's `sliceHome` reads for slice `n` of ticket `id`: the plan's, and a slice number the plan does not list is taken as a slice of this repository, so a slice branch of a plan without `## Slice` sections
 * (slices 1 to n then) or one the plan lost is answered as in Phase 15. Empty for a number that could not name a slice.
 */
function slicesFor(snapshot: RepoSnapshot, id: string, n: number): { n: number; repo?: string }[] {
  if (!Number.isInteger(n) || n < 1 || n > 99) return [];
  const planned = workOf(snapshot, id)?.plan?.slices ?? [];
  if (planned.length > 0) return planned.some((s) => s.n === n) ? planned : [...planned, { n }];
  return Array.from({ length: n }, (_, i) => ({ n: i + 1 }));
}

/** Phase 08.9.3 D-14: where slice `n` of ticket `id` lives; `claim` is the ticket's claim branch when the caller knows it. */
export function sliceHomeOf(snapshot: RepoSnapshot, id: string, n: number, claim: string = claimBranchOf(snapshot, id)): SliceHome | undefined {
  return sliceHome(slicesFor(snapshot, id, n), n, { id, claim });
}

/** The clone of another repository on this machine, or undefined when there is none (not declared, not found, refused): no size or start is claimed that nobody measured. */
function cloneOf(root: string, snapshot: RepoSnapshot, repo: string): string | undefined {
  const resolved = resolveRepo(root, snapshot.config, repo);
  return 'refused' in resolved ? undefined : resolved.path;
}

/**
 * The start of a slice of another repository, read in that repository's clone: the first slice there starts at the plan's `baseline_<repo>` (a commit of the clone), a later one at the merge base of its own
 * branch with the previous slice's branch there, or at the previous slice's tip when its own branch is not cut yet (where it will be cut).
 */
function otherStart(root: string, snapshot: RepoSnapshot, id: string, home: SliceHome & { repo: string }): string | undefined {
  const dir = cloneOf(root, snapshot, home.repo);
  if (dir === undefined) return undefined;
  if (home.previous === undefined) {
    const baselines = workOf(snapshot, id)?.plan?.repoBaselines;
    const sha = baselines !== undefined && Object.hasOwn(baselines, home.repo) ? baselines[home.repo] : undefined;
    return sha === undefined || !isSha(sha) ? undefined : commitOf(dir, sha);
  }
  const previous = branchRef(dir, home.previous.branch);
  if (previous === undefined) return undefined;
  const own = branchRef(dir, home.branch);
  if (own === undefined) return commitOf(dir, previous);
  const base = git(dir, ['merge-base', own, previous]).trim();
  return base === '' ? undefined : base;
}

/**
 * The commit slice `n` of ticket `id` starts at, as a full sha, or undefined when git cannot say (no such branch, no common history, no baseline, no clone). The first slice of this repository (the claim
 * branch's): the plan's `baseline:`. A later slice of this repository: the merge base of HEAD with the previous slice's branch of this repository, a local branch first and then origin's copy of it. A slice of
 * another repository is read in that repository's clone (`otherStart`).
 */
export function sliceStart(root: string, snapshot: RepoSnapshot, id: string, n: number): string | undefined {
  try {
    const home = sliceHome(slicesFor(snapshot, id, n), n, { id, claim: claimBranchOf(snapshot, id) });
    if (home === undefined) return undefined;
    if (home.repo !== undefined) return otherStart(root, snapshot, id, { ...home, repo: home.repo });
    if (home.previous === undefined) {
      const baseline = workOf(snapshot, id)?.plan?.baseline;
      return baseline === undefined ? undefined : commitOf(root, baseline);
    }
    for (const ref of [`refs/heads/${home.previous.branch}`, `refs/remotes/origin/${home.previous.branch}`]) {
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
export function branchRef(root: string, name: string): string | undefined {
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
 * Phase 08.9.3 D-14: "the claim branch for slice 1" and "slice n-1" are the slice's home and its previous slice of the SAME repository (`sliceHome`). A slice of another repository is read in that repository's clone: its own
 * branch there (no HEAD fallback, since the checkout is of this repository), over that clone's default branch for the first slice there and over the previous slice's branch after; no clone gives undefined.
 */
export function sliceRange(root: string, snapshot: RepoSnapshot, id: string, n: number): { base: string; tip: string } | undefined {
  const found = rangeIn(root, snapshot, id, n);
  return found === undefined ? undefined : { base: found.base, tip: found.tip };
}

/** `sliceRange` with the folder git must run in: this checkout, or the clone of the slice's repository. */
function rangeIn(root: string, snapshot: RepoSnapshot, id: string, n: number): { dir: string; base: string; tip: string } | undefined {
  try {
    const home = sliceHome(slicesFor(snapshot, id, n), n, { id, claim: claimBranchOf(snapshot, id) });
    if (home === undefined) return undefined;
    const other = home.repo !== undefined;
    const dir = home.repo === undefined ? root : cloneOf(root, snapshot, home.repo);
    if (dir === undefined) return undefined;
    const tip = branchRef(dir, home.branch) ?? (other ? undefined : 'HEAD');
    if (tip === undefined) return undefined;
    const def = defaultRefOf(dir);
    if (home.previous === undefined) {
      if (def !== undefined) return { dir, base: def, tip };
      const baseline = sliceStart(root, snapshot, id, n);
      return baseline === undefined ? undefined : { dir, base: baseline, tip };
    }
    const previous = branchRef(dir, home.previous.branch);
    if (previous === undefined) return undefined;
    return { dir, base: def !== undefined && isAncestor(dir, previous, def) ? def : previous, tip };
  } catch {
    return undefined;
  }
}

/**
 * The measured size of slice `n` of `id`: what its own branch adds over its base (`sliceRange`), with the ticket records, the files `accord skills sync` renders and the lockfiles left out; undefined when the range is unknown or git
 * fails, so no warning is made from a number nobody measured. `rendered` is the lazy list of copies accord writes (`renderedFilesOf` of the config): a loader imports no command, so the caller hands it over.
 */
export function gitSliceSize(root: string, snapshot: RepoSnapshot, id: string, n: number, rendered: () => SkillFile[]): (SliceSize & { n: number }) | undefined {
  const range = rangeIn(root, snapshot, id, n);
  if (range === undefined) return undefined;
  try {
    // the copies accord renders are this repository's files; the same names in another repository's clone are that repository's own
    const copies = new Set(range.dir === root ? rendered().map((f) => f.path) : []);
    const text = git(range.dir, ['diff', '--numstat', '--no-renames', '-z', `${range.base}...${range.tip}`, '--']);
    const excluded = (path: string): boolean => copies.has(path) || LOCKFILES.has(path.slice(path.lastIndexOf('/') + 1));
    return { n, ...sliceSizeOf(parseNumstat(text), excluded) };
  } catch {
    return undefined;
  }
}
