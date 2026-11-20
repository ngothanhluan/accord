// Phase 8.1 D-14, D-20: the slop hits of a ticket's cumulative diff, read from git for `accord review-package` (and, in 08.1-06, for `accord gate done`). The range is the one the ticket's first
// review round has: from roundOneBase to HEAD, through packageDiff, the function review-package prints from, so a reviewer of any round sees exactly what the gate judges (05-REVIEW WR-03).
// A git failure is an `error` fact, never an empty list (fail closed); nothing here writes.
import { execFileSync } from 'node:child_process';
import { diffFiles, isManifest, newDependencies, slopHits, slopSkipped, slopSpec, sortHits } from '@accord-dev/accord-core';
import type { RepoSnapshot, SkillFile, SlopHit } from '@accord-dev/accord-core';
import { defaultRefOf, gitFilesAt, UsageError } from './fs.js';
import { packageDiff, roundOneBase, why } from './package-diff.js';
import { exemptCopies } from './security-facts.js';
import { whyGit } from './round-facts.js';

/** The hits, and how many lines of the team's slop file did not read; or why the list could not be made. */
export type SlopFacts = { hits: SlopHit[]; unread: number } | { error: string };

/** The commit the package's diff starts from: `git diff <base>...HEAD` compares HEAD with the merge base, so the manifests are read there too. */
function mergeBaseOf(root: string, base: string): string {
  return execFileSync('git', ['merge-base', base, 'HEAD'], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}

/** Letters and digits only, lower case: a requirement name and the text of its line compare this way (`Flask_SQLAlchemy` is `flask-sqlalchemy`). */
const squashed = (text: string): string => text.toLowerCase().replace(/[^a-z0-9]/g, '');

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
    const generated = snapshot.config?.generated ?? [];
    const exempt = exemptCopies(root, 'HEAD', pkg.changed, rendered);
    const hits = slopHits(spec, pkg.diff, { generated, exempt });

    if (!spec.removed.some((r) => r.id === 'new-dependency')) {
      const manifests = pkg.changed.filter((p) => isManifest(p) && !slopSkipped(p, generated, exempt));
      if (manifests.length > 0) {
        const at = mergeBaseOf(root, base);
        const before = gitFilesAt(root, at, manifests);
        const after = gitFilesAt(root, 'HEAD', manifests);
        const files = diffFiles(pkg.diff);
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
    return { hits: sortHits(hits), unread: spec.problems.length };
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'git failed reading the slop facts: ' + whyGit(e) };
  }
}
