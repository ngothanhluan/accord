// ST-LN-36 D-05 (3), (5), D-10, the cut-off Ruling and the orchestrator Ruling of 2026-11-17: the security review a review round's own package asked for. A version 2 round records
// `Security: no pattern matched` or `Security: lens security ran`; from SECURITY_TRIGGER_FROM a round whose package had security triggers needs the second, and every round but a
// `(final review)` that follows a round which was not one in its stretch (D-10: the final reviewer reads the whole ticket; a lone final review is asked like any round) needs a `Security:` line. ONE rule (securityProblems) that `accord gate done` reads
// through gate.security-unreviewed and `accord round` reads whole. Pure: the host supplies each round's triggers, recomputed from git (securityFacts), and the claim pin. No code runs at load but constants.
import { stageOff } from '../gate/floor.js';
import { laneTicket, ledgerFile, workOf } from '../gate/work.js';
import type { GateRule } from '../gate/rules.js';
import type { RepoSnapshot } from '../model/snapshot.js';
import { SECURITY_FILE, securitySpec } from '../security/spec.js';
import { SECURITY_TRIGGER_FROM, claimPinBefore } from './pin.js';
import { allowancesOf } from './next.js';
import { placedRounds, skipped, stretchOf } from './scope.js';

/**
 * True when the security record rule applies to the ticket: a lane ticket with a version 2 review record, not skipped (HEAD on the default branch, or the ticket done in the default ref's records,
 * as every review scope rule), whose claim pin is not before SECURITY_TRIGGER_FROM. A failed claim read is not before it (claimPinBefore fails closed), so the rule applies.
 */
export function securityOn(snapshot: RepoSnapshot, id: string): boolean {
  const rec = workOf(snapshot, id)?.rounds;
  if (laneTicket(snapshot, id) === undefined || rec === undefined || rec.version !== 2 || skipped(snapshot, id)) return false;
  return !claimPinBefore(snapshot, id, SECURITY_TRIGGER_FROM);
}

/** One way the security record is wrong: the line it is about and what to do. */
export interface SecurityProblem {
  line: number;
  reason: string;
}

const RECORD = 'Security: lens security ran at <sha>';
const LINES = 'write "Security: no pattern matched" or "Security: lens security ran"';

/** The first five triggers, and how many more there are. */
function listed(triggers: readonly string[]): string {
  const shown = triggers.slice(0, 5).join('; ');
  return triggers.length > 5 ? `${shown}, and ${triggers.length - 5} more` : shown;
}

/**
 * The record indexes (`j`, 1-based, cycles flattened) of the rounds the security rule leaves out: a `(final review)` round with a round that is not one before it in its own stretch (D-10).
 * A final review with no such round before it, a ticket's only round for one, is asked like any round: the mark alone never removes a round from the rule.
 */
export function securityExemptRounds(snapshot: RepoSnapshot, id: string): Set<number> {
  const rec = workOf(snapshot, id)?.rounds;
  const out = new Set<number>();
  if (rec === undefined) return out;
  const placed = placedRounds(rec);
  const allowances = allowancesOf(snapshot, id, 'review');
  for (const at of placed) {
    if (at.round.final !== true) continue;
    const { start } = stretchOf(allowances, at.cycle, rec.cycles[at.cycle - 1].rounds.length, at.p);
    if (placed.some((q) => q.cycle === at.cycle && q.p >= start && q.p < at.p && q.round.final !== true)) out.add(at.j);
  }
  return out;
}

/**
 * The security record problems of the review record, in record line order: a round (not an exempt final review) whose package had triggers and that records no `Security: lens security ran`, a
 * `Security:` line that is neither form, and a round with no trigger that records no `Security:` line at all. None when the rule does not apply (securityOn) or the host supplied no fact.
 * 8-ac-5, D-10: a team pattern line of the security file that is not in force (it does not compile, or the guard refuses it as slow) comes first, before the trigger facts, because every
 * round's triggers were computed without that pattern and cannot be trusted until it is fixed; it is returned even when the host supplied no fact.
 */
export function securityProblems(snapshot: RepoSnapshot, id: string): SecurityProblem[] {
  if (stageOff(snapshot, id, 'review')) return securityOffProblems(snapshot, id); // Phase 08.8 D-03: the review stage is off, so the ledger holds the record
  const rec = workOf(snapshot, id)?.rounds;
  if (rec === undefined || !securityOn(snapshot, id)) return [];
  const inactive = securitySpec(snapshot).problems.filter((p) => p.pattern === true);
  if (inactive.length > 0) {
    return inactive.map((p) => ({ line: 1, reason: `${SECURITY_FILE}:${p.line}: ${p.reason}; the pattern is not in force, so fix the line, then run accord lint` }));
  }
  const fact = Object.hasOwn(snapshot.securityFacts ?? {}, id) ? snapshot.securityFacts![id] : undefined;
  if (fact === undefined) return [];
  if ('error' in fact) return [{ line: 1, reason: `the security review cannot be checked: ${fact.error}` }];
  if (!('rounds' in fact)) return [{ line: 1, reason: 'the security review cannot be checked: the host read the triggers of the whole ticket, and review.md records rounds' }];
  const placed = placedRounds(rec);
  if (fact.rounds.length !== placed.length) {
    return [{ line: 1, reason: `the security review cannot be checked: the host read the triggers of ${fact.rounds.length} rounds and review.md records ${placed.length}` }];
  }
  const out: SecurityProblem[] = [];
  const exempt = securityExemptRounds(snapshot, id);
  for (const at of placed) {
    if (exempt.has(at.j)) continue; // D-10
    const where = `round ${at.p} of cycle ${at.cycle}`;
    const triggers = fact.rounds[at.j - 1].triggers;
    if (triggers.length > 0 && at.round.security !== 'ran') {
      out.push({
        line: at.round.line,
        reason:
          `${where}: its review package had security triggers (${listed(triggers)}), and the round records no security review; ` +
          `dispatch accord-reviewer with lens security on accord review-package ${id} --security --round ${at.j} and write "Security: lens security ran" in the round`,
      });
    }
    for (const u of at.round.securityUnread ?? []) out.push({ line: u.line, reason: `${where}: "${u.text}" is not read; ${LINES}` });
    if (triggers.length === 0 && at.round.security === undefined && (at.round.securityUnread ?? []).length === 0) {
      out.push({ line: at.round.line, reason: `${where} records no Security: line; its review package had no security trigger, so write "Security: no pattern matched" in the round and commit` });
    }
  }
  return out.sort((a, b) => a.line - b.line);
}

/**
 * Phase 08.8 D-03: the security record problems of a ticket whose review stage is off, in the order a reader fixes them. Applies to a lane M, L or P ticket with `stageOff(review)` that the review checks do not
 * skip (as for review.md: HEAD on the default branch, or the ticket done in the default ref's records). A team pattern that is not in force comes first, as for the rounds; with no host fact there is nothing
 * to judge, a fact with `error` is one problem. With triggers in the ticket's whole diff and no `Security: lens security ran at <sha>` line in the ledger's `## Security` section the record is missing; with triggers
 * since the recorded sha the review is stale; every other line of that section is not read. A ticket whose diff has no trigger needs no line (nobody is there to state it).
 */
export function securityOffProblems(snapshot: RepoSnapshot, id: string): SecurityProblem[] {
  if (laneTicket(snapshot, id) === undefined || !stageOff(snapshot, id, 'review') || skipped(snapshot, id)) return [];
  const inactive = securitySpec(snapshot).problems.filter((p) => p.pattern === true);
  if (inactive.length > 0) {
    return inactive.map((p) => ({ line: 1, reason: `${SECURITY_FILE}:${p.line}: ${p.reason}; the pattern is not in force, so fix the line, then run accord lint` }));
  }
  const fact = Object.hasOwn(snapshot.securityFacts ?? {}, id) ? snapshot.securityFacts![id] : undefined;
  if (fact === undefined) return [];
  if ('error' in fact) return [{ line: 1, reason: `the security review cannot be checked: ${fact.error}` }];
  if (!('ticket' in fact)) return [{ line: 1, reason: 'the security review cannot be checked: the host read the triggers of review rounds, and the review stage is off' }];
  const ledger = workOf(snapshot, id)?.ledger;
  const out: SecurityProblem[] = [];
  const { triggers, sinceReview } = fact.ticket;
  if (triggers.length === 0) return []; // no trigger in the ticket's diff: nothing to review, and no line to read
  if (ledger?.securityReview === undefined) {
    out.push({
      line: 1,
      reason:
        `the ticket's changes have security triggers (${listed(triggers)}), the review stage is off, and the ledger records no security review; ` +
        `run accord review-package ${id} --security, dispatch accord-reviewer with lens security on it, fix what it finds, ` +
        `write "${RECORD}" under "## Security" in ${ledger?.file ?? ledgerFile(id)} and commit`,
    });
  }
  if (ledger?.securityReview !== undefined && sinceReview !== undefined && sinceReview.length > 0) {
    out.push({
      line: ledger.securityReview.line,
      reason: `the code changed after the security review recorded at ${ledger.securityReview.head}, with security triggers (${listed(sinceReview)}); review it again and write the new commit in "${RECORD}"`,
    });
  }
  for (const u of ledger?.securityUnread ?? []) out.push({ line: u.line, reason: `"${u.text}" is not read; under "## Security" write "${RECORD}"` });
  return out.sort((a, b) => a.line - b.line);
}

/**
 * gate.security-unreviewed: each security record problem of review.md, from SECURITY_TRIGGER_FROM, in lane M and lane S; with the review stage off (Phase 08.8 D-03, lane M, L and P) each problem of the
 * ledger's `## Security` record instead, reported against the ledger.
 */
export const securityUnreviewed: GateRule['check'] = (snapshot, id) => {
  if (stageOff(snapshot, id, 'review')) {
    const file = workOf(snapshot, id)?.ledger?.file ?? ledgerFile(id);
    return securityOffProblems(snapshot, id).map((p) => ({ file, line: p.line, reason: p.reason }));
  }
  const rec = workOf(snapshot, id)?.rounds;
  if (rec === undefined) return [];
  return securityProblems(snapshot, id).map((p) => ({ file: rec.file, line: p.line, reason: p.reason }));
};
