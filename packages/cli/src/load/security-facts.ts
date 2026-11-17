// ST-LN-36 D-05 (5): the security triggers of each recorded review round's own package, read from git for `accord gate done` (plan 05-06) and for `accord round` and
// `accord review-package --security --round` (plan 05-07). Round 1 is the package from its base (roundOneBase), each later round the package from the previous round's head, in record
// order across cycles, so a round that fixed something is asked only when its fix matches a pattern. The triggers of a package come from packageDiff, the function review-package prints from.
// Every git failure is an `error` fact, which the rule reports (fail closed); nothing here writes.
import { execFileSync } from 'node:child_process';
import { claimPinBefore, reviewSkipped, SECURITY_TRIGGER_FROM, securityExemptRounds, securitySpec, securityTriggers, triggerText, workOf } from '@accord-dev/accord-core';
import type { RepoSnapshot, SecurityFacts } from '@accord-dev/accord-core';
import { defaultRefOf, UsageError } from './fs.js';
import { packageDiff, roundOneBase, why } from './package-diff.js';
import { whyGit } from './round-facts.js';

/** One recorded round's package range: `base` is round 1's base or the previous round's head, `head` the round's own head as a full sha, `final` a `(final review)` round. */
export interface SecurityRange {
  base: string;
  head: string;
  final: boolean;
}

/** The typed heads as full commit shas in one `git cat-file --batch-check`; a head that names no commit is an error naming it. */
function resolveHeads(root: string, heads: readonly string[]): { error: string } | { shas: string[] } {
  let raw: string;
  try {
    raw = execFileSync('git', ['cat-file', '--batch-check'], {
      cwd: root,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
      maxBuffer: 64 * 1024 * 1024,
      input: heads.map((h) => `${h}^{commit}\n`).join(''),
    });
  } catch (e) {
    return { error: 'git cat-file --batch-check failed: ' + whyGit(e) };
  }
  const lines = raw.split('\n');
  const shas: string[] = [];
  for (const [k, h] of heads.entries()) {
    const m = /^([0-9a-f]{40,64}) commit \d+$/.exec(lines[k] ?? '');
    if (m === null) return { error: `head ${h} names no commit in this repository` };
    shas.push(m[1]);
  }
  return { shas };
}

/**
 * The package range of each recorded round of `id`, in record order (cycles flattened, so entry k - 1 is the k-th `## Round` section of review.md in file order): round 1 from
 * roundOneBase, every later round from the previous round's head, a final review's head included (D-10: the re-review round after a final review reads exactly the final review's fix).
 * Holds no pin gate and reads only what the ranges need; a round with no head, a head git cannot resolve, or no base for round 1 is an `error`.
 */
export function securityRoundRanges(root: string, snapshot: RepoSnapshot, id: string): { error: string } | { rounds: SecurityRange[] } {
  const recorded = (workOf(snapshot, id)?.rounds?.cycles ?? []).flatMap((c) => c.rounds);
  let base = roundOneBase(root, snapshot, id);
  if (base === undefined) return { error: 'review round 1 has no base: the plan records no baseline' };
  const typed: string[] = [];
  for (const [k, r] of recorded.entries()) {
    if (r.head === undefined) return { error: `review round ${k + 1} names no head` };
    typed.push(r.head.toLowerCase());
  }
  const resolved = resolveHeads(root, typed);
  if ('error' in resolved) return resolved;
  const rounds: SecurityRange[] = [];
  for (const [k, r] of recorded.entries()) {
    rounds.push({ base, head: resolved.shas[k], final: r.final === true });
    base = resolved.shas[k];
  }
  return { rounds };
}

function factsFor(root: string, snapshot: RepoSnapshot, id: string): SecurityFacts {
  try {
    const ranges = securityRoundRanges(root, snapshot, id);
    if ('error' in ranges) return { error: ranges.error };
    const spec = securitySpec(snapshot);
    const generated = snapshot.config?.generated ?? [];
    const def = defaultRefOf(root);
    const exempt = securityExemptRounds(snapshot, id);
    const rounds = ranges.rounds.map((r, k) => {
      if (exempt.has(k + 1)) return { head: r.head, triggers: [] }; // D-10: a final review that follows a round of its stretch is exempt; a lone one is read like any round
      let pkg;
      try {
        pkg = packageDiff(root, { base: r.base, head: r.head, def, allowPlainLog: false });
      } catch (e) {
        throw new Error(`git failed reading the package of review round ${k + 1}: ${e instanceof UsageError ? e.message : why(e)}`, { cause: e });
      }
      return { head: r.head, triggers: securityTriggers(spec, pkg.diff, pkg.changed, { generated, unreadable: pkg.unread }).map(triggerText) };
    });
    return { rounds };
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'git failed reading the security triggers: ' + whyGit(e) };
  }
}

/**
 * `snapshot` with securityFacts[id] set; `snapshot` itself when the ticket has no lane, no version 2 review record with a round, no git, the review checks are skipped (HEAD on the
 * default branch, or the ticket done there), or the rule does not apply to it: ST-LN-36, Orchestrator Ruling (route a), a ticket whose claim pin is before SECURITY_TRIGGER_FROM answers as
 * before and starts no git read for it. The claim fact is the one the caller already loaded (gate done, accord round); this never calls withClaimPins, so the pin gate adds no git read. A failed
 * claim read is false in claimPinBefore (fail closed), so the facts are read and the rule applies. Each of those is decided on the snapshot, before the first git call.
 */
export function withSecurityFacts(root: string, snapshot: RepoSnapshot, id: string): RepoSnapshot {
  const rec = workOf(snapshot, id)?.rounds;
  const lane = Object.hasOwn(snapshot.tickets, id) ? snapshot.tickets[id].frontmatter?.lane : undefined;
  if (lane === undefined || rec === undefined || rec.version !== 2 || rec.cycles.every((c) => c.rounds.length === 0) || snapshot.git === undefined || reviewSkipped(snapshot, id)) return snapshot;
  if (claimPinBefore(snapshot, id, SECURITY_TRIGGER_FROM)) return snapshot;
  return { ...snapshot, securityFacts: { ...snapshot.securityFacts, [id]: factsFor(root, snapshot, id) } };
}
