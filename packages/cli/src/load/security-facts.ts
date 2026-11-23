// ST-LN-36 D-05 (5): the security triggers of each recorded review round's own package, read from git for `accord gate done` (plan 05-06) and for `accord round` and
// `accord review-package --security --round` (plan 05-07). Round 1 is the package from its base (roundOneBase), each later round the package from the previous round's head, in record
// order across cycles, so a round that fixed something is asked only when its fix matches a pattern. The triggers of a package come from packageDiff, the function review-package prints from.
// Every git failure is an `error` fact, which the rule reports (fail closed); nothing here writes.
import { execFileSync } from 'node:child_process';
import { claimPinBefore, normaliseText, reviewSkipped, SECURITY_OFF_FROM, SECURITY_TRIGGER_FROM, securityExemptRounds, securitySpec, securityTriggers, stageOff, triggerText, workOf } from '@accord-dev/accord-core';
import type { RepoSnapshot, SecurityFacts, SkillFile } from '@accord-dev/accord-core';
import { defaultRefOf, gitFilesAt, UsageError } from './fs.js';
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

/**
 * BUG-LN-25 D-06, D-07, D-09, D-11, D-17: the changed paths that are exactly a copy `accord skills sync` writes, in `changed` order: each path `rendered()` holds whose text at `head` equals
 * the render after normaliseText. A path absent at `head` (deleted) or differing from the running accord's render (edited by hand, or written by an older accord) is not exempt, so it is
 * scanned; the marker hash is never read. `rendered` is called and git started only when a changed path lies under `.claude/` or `.agents/`, the two roots every rendered path has. A git failure throws.
 */
export function exemptCopies(root: string, head: string, changed: readonly string[], rendered: () => readonly SkillFile[]): string[] {
  if (!changed.some((p) => p.startsWith('.claude/') || p.startsWith('.agents/'))) return [];
  const touched = new Set(changed);
  const copies = rendered().filter((f) => touched.has(f.path));
  if (copies.length === 0) return [];
  const at = gitFilesAt(root, head, copies.map((f) => f.path));
  const same = new Set(copies.filter((f) => at[f.path] !== undefined && normaliseText(at[f.path]) === f.text).map((f) => f.path));
  return changed.filter((p) => same.has(p));
}

function factsFor(root: string, snapshot: RepoSnapshot, id: string, rendered: () => readonly SkillFile[]): SecurityFacts {
  try {
    const ranges = securityRoundRanges(root, snapshot, id);
    if ('error' in ranges) return { error: ranges.error };
    const spec = securitySpec(snapshot);
    const generated = snapshot.config?.generated ?? [];
    const def = defaultRefOf(root);
    const exemptRounds = securityExemptRounds(snapshot, id);
    let list: readonly SkillFile[] | undefined;
    const once = (): readonly SkillFile[] => (list ??= rendered()); // at most one render per command
    const rounds = ranges.rounds.map((r, k) => {
      if (exemptRounds.has(k + 1)) return { head: r.head, triggers: [] }; // D-10: a final review that follows a round of its stretch is exempt; a lone one is read like any round
      let pkg;
      try {
        pkg = packageDiff(root, { base: r.base, head: r.head, def, allowPlainLog: false });
      } catch (e) {
        throw new Error(`git failed reading the package of review round ${k + 1}: ${e instanceof UsageError ? e.message : why(e)}`, { cause: e });
      }
      const exempt = exemptCopies(root, r.head, pkg.changed, once);
      return { head: r.head, triggers: securityTriggers(spec, pkg.diff, pkg.changed, { generated, unreadable: pkg.unread, exempt }).map(triggerText) };
    });
    return { rounds };
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'git failed reading the security triggers: ' + whyGit(e) };
  }
}

/** Whether `from` is `to` or an ancestor of it, by `git merge-base --is-ancestor`: exit 1 is no, any other failure throws. */
function isAncestor(root: string, from: string, to: string): boolean {
  try {
    execFileSync('git', ['merge-base', '--is-ancestor', from, to], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    return true;
  } catch (e) {
    if ((e as { status?: number }).status === 1) return false;
    throw e;
  }
}

/**
 * Phase 08.8 D-03: the security facts of a ticket whose review stage is off: the triggers of its cumulative diff (round-one base to HEAD, as slopFacts reads it: the same package, exempt copies and
 * generated paths skipped) and, when the ledger records a security review, the triggers of the diff from that commit to HEAD. A commit the ledger names that no commit has, or that is not an
 * ancestor of HEAD, is an `error` fact naming it, like every git failure and a plan with no baseline (fail closed): nothing here reads "no triggers" off a failed read.
 * Phase 08.8 review CR-02: undefined when HEAD is on the default branch (the default ref holds it), the skip the review rounds take as `skip: 'on-default'` (round-facts.ts), so a review-off
 * ticket gated on the default branch is not judged on the default branch's later commits.
 */
export function reviewOffFacts(root: string, snapshot: RepoSnapshot, id: string, rendered: () => readonly SkillFile[]): SecurityFacts | undefined {
  try {
    const def = defaultRefOf(root);
    if (def !== undefined && isAncestor(root, 'HEAD', def)) return undefined;
    const base = roundOneBase(root, snapshot, id, { defaultRef: def });
    if (base === undefined) return { error: 'the ticket has no round-one base: the plan records no baseline' };
    const spec = securitySpec(snapshot);
    const generated = snapshot.config?.generated ?? [];
    let list: readonly SkillFile[] | undefined;
    const once = (): readonly SkillFile[] => (list ??= rendered()); // at most one render per command
    const triggersFrom = (from: string): string[] => {
      let pkg;
      try {
        pkg = packageDiff(root, { base: from, head: 'HEAD', def, allowPlainLog: false });
      } catch (e) {
        throw new Error(`git failed reading the ticket's diff from ${from}: ${e instanceof UsageError ? e.message : why(e)}`, { cause: e });
      }
      const exempt = exemptCopies(root, 'HEAD', pkg.changed, once);
      return securityTriggers(spec, pkg.diff, pkg.changed, { generated, unreadable: pkg.unread, exempt }).map(triggerText);
    };
    const triggers = triggersFrom(base);
    const named = workOf(snapshot, id)?.ledger?.securityReview?.head;
    if (named === undefined) return { ticket: { triggers } };
    const resolved = resolveHeads(root, [named.toLowerCase()]);
    if ('error' in resolved) return resolved;
    const sha = resolved.shas[0];
    if (!isAncestor(root, sha, 'HEAD')) return { error: `the security review is recorded at ${named}, which is not an ancestor of HEAD` };
    return { ticket: { triggers, sinceReview: triggersFrom(sha) } };
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'git failed reading the security triggers: ' + whyGit(e) };
  }
}

/**
 * `snapshot` with securityFacts[id] set; `snapshot` itself when the ticket has no lane, no git, the review checks are skipped (HEAD on the default branch, or the ticket done there), the ticket
 * has neither a version 2 review record with a round nor its review stage off, or the rule does not apply to it: ST-LN-36, Orchestrator Ruling (route a), a ticket whose claim pin is before
 * SECURITY_TRIGGER_FROM answers as before and starts no git read for it. The claim fact is the one the caller already loaded (gate done, accord round); this never calls withClaimPins, so the pin gate
 * adds no git read. A failed claim read is false in claimPinBefore (fail closed), so the facts are read and the rule applies. Each of those is decided on the snapshot, before the first git call.
 * Phase 08.8 D-03: a ticket whose review stage is off (stageOff) has no rounds; its fact is `{ ticket }`, read by reviewOffFacts over the ticket's whole diff.
 * BUG-LN-25 D-16: `rendered` is the files `accord skills sync` writes (renderedFiles of the config), called at most once, so a copy sync just wrote raises no trigger.
 */
export function withSecurityFacts(root: string, snapshot: RepoSnapshot, id: string, rendered: () => readonly SkillFile[]): RepoSnapshot {
  const rec = workOf(snapshot, id)?.rounds;
  const lane = Object.hasOwn(snapshot.tickets, id) ? snapshot.tickets[id].frontmatter?.lane : undefined;
  if (lane !== undefined && stageOff(snapshot, id, 'review')) {
    if (snapshot.git === undefined || reviewSkipped(snapshot, id)) return snapshot;
    if (claimPinBefore(snapshot, id, SECURITY_OFF_FROM)) return snapshot; // Phase 08.8 D-03: a ticket claimed before the cut-off starts no git read
    const fact = reviewOffFacts(root, snapshot, id, rendered);
    return fact === undefined ? snapshot : { ...snapshot, securityFacts: { ...snapshot.securityFacts, [id]: fact } }; // undefined: HEAD on the default branch (CR-02)
  }
  if (lane === undefined || rec === undefined || rec.version !== 2 || rec.cycles.every((c) => c.rounds.length === 0) || snapshot.git === undefined || reviewSkipped(snapshot, id)) return snapshot;
  if (claimPinBefore(snapshot, id, SECURITY_TRIGGER_FROM)) return snapshot;
  return { ...snapshot, securityFacts: { ...snapshot.securityFacts, [id]: factsFor(root, snapshot, id, rendered) } };
}
