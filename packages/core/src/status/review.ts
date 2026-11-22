// Phase 08.7 D-04: one ticket's review rounds counted for the flightdeck pane, so the pane counts nothing. The count is per round and per severity because review.md never records which lens
// a finding came from (A-01; per lens waits for a lens mark in Phase 10's review record). Only numbers and closed values leave this file: no finding text reaches the JSON (T-08.7-23).
import { VERDICTS, workOf } from '../gate/work.js';
import type { RepoSnapshot, Severity } from '../model/snapshot.js';
import { capRulesOf } from '../round/next.js';

export interface FindingTally { open: number; fixed: number; deferred: number }
export interface ReviewRoundSummary {
  n: number; // the round's 1-based place in its cycle
  findings: Record<Severity, FindingTally>;
  final?: true;
  added?: true;
  security?: 'ran' | 'none';
}
export interface ReviewSummary {
  cycle: number; // the number of cycles; a return from verify opens the next one
  round: number; // the rounds the last cycle holds (0 right after a return from verify)
  cap: number; // capRulesOf(snapshot, id, 'review').cap, the one seam the cap is read through
  verdict?: string; // the last cycle's verdict when it follows the last round and Done accepts it
  rounds: ReviewRoundSummary[]; // the last cycle's rounds
}

const SEVERITIES: readonly Severity[] = ['Must', 'Should', 'Nice'];

/** undefined unless the ticket has a review record holding at least one round. Optional keys are omitted, never undefined. */
export function reviewSummary(snapshot: RepoSnapshot, id: string): ReviewSummary | undefined {
  const record = workOf(snapshot, id)?.rounds;
  if (record === undefined || !record.cycles.some((c) => c.rounds.length > 0)) return undefined;
  const last = record.cycles[record.cycles.length - 1];
  const rounds = last.rounds.map((r, i): ReviewRoundSummary => {
    const findings = Object.fromEntries(SEVERITIES.map((s) => [s, { open: 0, fixed: 0, deferred: 0 }])) as Record<Severity, FindingTally>;
    for (const f of r.findings) {
      // a version 1 record writes no state, and an unknown state counts open
      const state = f.state === 'fixed' || f.state === 'deferred' ? f.state : 'open';
      findings[f.severity][state]++;
    }
    return { n: i + 1, findings, ...(r.final === true ? { final: true as const } : {}), ...(r.added === true ? { added: true as const } : {}), ...(r.security === undefined ? {} : { security: r.security }) };
  });
  const lastRound = last.rounds[last.rounds.length - 1];
  const verdict = last.verdicts[last.verdicts.length - 1];
  const shown = lastRound !== undefined && verdict !== undefined && verdict.line > lastRound.line && VERDICTS.includes(verdict.value) ? verdict.value : undefined;
  return {
    cycle: record.cycles.length,
    round: rounds.length,
    cap: capRulesOf(snapshot, id, 'review').cap,
    ...(shown === undefined ? {} : { verdict: shown }),
    rounds,
  };
}
