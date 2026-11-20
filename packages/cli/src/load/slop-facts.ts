// Phase 8.1 D-14, D-20: the slop hits of a ticket's cumulative diff, read from git for `accord review-package` (and, in 08.1-06, for `accord gate done`). The range is the one the ticket's first
// review round has: from roundOneBase to HEAD, through packageDiff, the function review-package prints from, so a reviewer of any round sees exactly what the gate judges (05-REVIEW WR-03).
// A git failure is an `error` fact, never an empty list (fail closed); nothing here writes.
import { slopHits, slopSpec } from '@accord-dev/accord-core';
import type { RepoSnapshot, SkillFile, SlopHit } from '@accord-dev/accord-core';
import { defaultRefOf, UsageError } from './fs.js';
import { packageDiff, roundOneBase, why } from './package-diff.js';
import { exemptCopies } from './security-facts.js';
import { whyGit } from './round-facts.js';

/** The hits, and how many lines of the team's slop file did not read; or why the list could not be made. */
export type SlopFacts = { hits: SlopHit[]; unread: number } | { error: string };

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
    const exempt = exemptCopies(root, 'HEAD', pkg.changed, rendered);
    const hits = slopHits(spec, pkg.diff, { generated: snapshot.config?.generated ?? [], exempt });
    return { hits, unread: spec.problems.length };
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'git failed reading the slop facts: ' + whyGit(e) };
  }
}
