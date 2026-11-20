// Phase 8.1 D-14, D-20: the slop hits of a ticket's cumulative diff, read from git for `accord review-package` (and, in 08.1-06, for `accord gate done`). The range is the one the ticket's first
// review round has: from roundOneBase to HEAD, through packageDiff, the function review-package prints from, so a reviewer of any round sees exactly what the gate judges (05-REVIEW WR-03).
// A git failure is an `error` fact, never an empty list (fail closed); nothing here writes. Every git call is `git` by name with a literal argument array: a file name from the branch is a
// fixed string after `-e` (git grep -F), a literal pathspec (`:(exclude,literal)`) or a `<ref>:<path>` spec, never an option, a glob or a shell word (T-08.1-23).
import { execFileSync } from 'node:child_process';
import {
  diffFiles,
  growthHits,
  isManifest,
  maxFileLines,
  newDependencies,
  orphanCandidates,
  orphanHits,
  orphanTerms,
  slopHits,
  slopSkipped,
  slopSpec,
  sortHits,
} from '@accord-dev/accord-core';
import type { RepoSnapshot, SkillFile, SlopHit } from '@accord-dev/accord-core';
import { defaultRefOf, gitFilesAt, UsageError } from './fs.js';
import { packageDiff, roundOneBase, why } from './package-diff.js';
import { exemptCopies } from './security-facts.js';
import { whyGit } from './round-facts.js';

/** The hits, and how many lines of the team's slop file did not read; or why the list could not be made. */
export type SlopFacts = { hits: SlopHit[]; unread: number } | { error: string };

/** At most this many new files are searched for a file that names them, so one commit of generated files never starts thousands of searches. */
const MAX_ORPHAN_SEARCH = 200;
/** The paths read in one `git cat-file --batch`. */
const BATCH = 100;

const git = (root: string, args: string[]): string => execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 64 * 1024 * 1024 });

/** The commit the package's diff starts from: `git diff <base>...HEAD` compares HEAD with the merge base, so the manifests and line counts are read there too. */
const mergeBaseOf = (root: string, base: string): string => git(root, ['merge-base', base, 'HEAD']).trim();

/** Letters and digits only, lower case: a requirement name and the text of its line compare this way (`Flask_SQLAlchemy` is `flask-sqlalchemy`). */
const squashed = (text: string): string => text.toLowerCase().replace(/[^a-z0-9]/g, '');

const lineCount = (text: string): number => (text === '' ? 0 : text.split('\n').length - (text.endsWith('\n') ? 1 : 0));

const chunks = <T>(list: readonly T[], size: number): T[][] => Array.from({ length: Math.ceil(list.length / size) }, (_, i) => list.slice(i * size, i * size + size));

/** The files of `at..HEAD` whose lines grew, from one `git diff --numstat -z`: path -> net lines added. A file git calls binary has no count and is left out. */
function netGrowth(root: string, at: string): Map<string, number> {
  const grown = new Map<string, number>();
  for (const record of git(root, ['diff', '--numstat', '-z', '--no-renames', '--no-color', '--no-ext-diff', at, 'HEAD', '--']).split('\0')) {
    const m = /^(\d+)\t(\d+)\t([\s\S]+)$/.exec(record);
    if (m !== null && Number(m[1]) > Number(m[2])) grown.set(m[3], Number(m[1]) - Number(m[2]));
  }
  return grown;
}

/** True when some tracked file at HEAD other than `path` holds one of `terms` (git grep -F: a fixed string, never a pattern; `:(exclude,literal)` leaves `path` itself out). */
function named(root: string, path: string, terms: readonly string[]): boolean {
  const args = ['grep', '-l', '-I', '-F', '-z', ...terms.flatMap((t) => ['-e', t]), 'HEAD', '--', '.', ':(exclude,literal)' + path];
  try {
    return git(root, args).length > 0;
  } catch (e) {
    if ((e as { status?: number }).status === 1) return false; // git grep: no match
    throw e;
  }
}

/**
 * The slop hits of ticket `id` over its cumulative diff. `rendered` is the files `accord skills sync` writes (renderedFilesOf of the config), called at most once, so a copy sync just wrote
 * is no hit. `known` hands over a default ref the caller already read, so no extra `git for-each-ref` runs (ST-LN-63). An error names why: no round-one base (the plan records no
 * baseline), or a git failure.
 */
export function slopFacts(root: string, snapshot: RepoSnapshot, id: string, rendered: () => readonly SkillFile[], known?: { defaultRef: string | undefined }): SlopFacts {
  try {
    const def = known === undefined ? defaultRefOf(root) : known.defaultRef;
    const base = roundOneBase(root, snapshot, id, { defaultRef: def });
    if (base === undefined) return { error: 'the ticket has no round-one base: the plan records no baseline' };
    let pkg;
    try {
      pkg = packageDiff(root, { base, head: 'HEAD', def, allowPlainLog: false });
    } catch (e) {
      throw new Error(`git failed reading the ticket's diff: ${e instanceof UsageError ? e.message : why(e)}`, { cause: e });
    }
    const spec = slopSpec(snapshot);
    const off = (kind: string): boolean => spec.removed.some((r) => r.id === kind);
    const generated = snapshot.config?.generated ?? [];
    const exempt = exemptCopies(root, 'HEAD', pkg.changed, rendered);
    const skipped = (p: string): boolean => slopSkipped(p, generated, exempt);
    const hits = slopHits(spec, pkg.diff, { generated, exempt });
    const files = diffFiles(pkg.diff);
    const scanned = pkg.changed.filter((p) => !skipped(p));
    const needsBase = (!off('new-dependency') && scanned.some(isManifest)) || !off('file-growth');
    const at = needsBase && scanned.length > 0 ? mergeBaseOf(root, base) : undefined;

    if (at !== undefined && !off('new-dependency')) {
      const manifests = scanned.filter(isManifest);
      if (manifests.length > 0) {
        const before = gitFilesAt(root, at, manifests);
        const after = gitFilesAt(root, 'HEAD', manifests);
        for (const path of manifests) {
          // a merge from the default branch is left out of the package (ST-LN-26): then a name is the ticket's only when its own added lines hold it
          const own = pkg.excluded ? squashed(files.filter((f) => f.path === path).flatMap((f) => f.added.map((l) => l.text)).join('\n')) : undefined;
          for (const d of newDependencies(path, before[path], after[path])) {
            if (own !== undefined && !own.includes(squashed(d.name))) continue;
            hits.push({ kind: 'new-dependency', path, line: d.line, label: `a new dependency: ${d.name}` });
          }
        }
      }
    }

    if (at !== undefined && !off('file-growth')) {
      // only a file that gained lines can cross the bound or grow past it, so only those are read
      const growing = netGrowth(root, at);
      const counted = scanned.filter((p) => growing.has(p));
      const sizes: { path: string; baseLines: number; headLines: number }[] = [];
      for (const batch of chunks(counted, BATCH)) {
        const before = gitFilesAt(root, at, batch);
        const after = gitFilesAt(root, 'HEAD', batch);
        for (const path of batch) if (after[path] !== undefined) sizes.push({ path, baseLines: lineCount(before[path] ?? ''), headLines: lineCount(after[path]) });
      }
      hits.push(...growthHits(sizes, maxFileLines(snapshot.config)));
    }

    if (!off('orphan-file')) {
      const added = files.filter((f) => !f.binary && f.path !== undefined && f.header.some((h) => h.startsWith('new file mode'))).map((f) => f.path as string);
      // a name with a line break cannot be a fixed-string search term; it is left unsearched, with no hit
      let candidates = orphanCandidates(added.filter((p) => !skipped(p) && !/[\r\n]/.test(p)));
      // in a package without a merge from the default branch a new file is still there at HEAD; with one, a file may have been added and deleted again
      if (pkg.excluded) {
        const present = new Set<string>();
        for (const batch of chunks(candidates, BATCH)) for (const p of Object.keys(gitFilesAt(root, 'HEAD', batch))) present.add(p);
        candidates = candidates.filter((p) => present.has(p));
      }
      candidates = candidates.slice(0, MAX_ORPHAN_SEARCH);
      const found = new Set(candidates.filter((p) => named(root, p, orphanTerms(p))));
      hits.push(...orphanHits(candidates, found));
    }
    return { hits: sortHits(hits), unread: spec.problems.length };
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'git failed reading the slop facts: ' + whyGit(e) };
  }
}
