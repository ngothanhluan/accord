// ST-LN-57: from round 3 a new Must or Should that no fix explains needs a failing test or a reproducing command; code
// added by a debug episode or a merge starts its own count (ac-2, ac-3, D-03, D-05, D-13). Pure: the host supplies the
// round facts it read from git. No code runs at load but constants.
import { ownRecordsOnly } from '../gate/done.js';
import { laneTicket, workOf } from '../gate/work.js';
import type { GateDraft, GateRule } from '../gate/rules.js';
import type { RangeCommit, RepoSnapshot, RoundFinding, RoundRecord } from '../model/snapshot.js';
import { addedCode, factsOf, fixCommits, placedRounds, skipped, spanOf } from './scope.js';
import type { Placed } from './scope.js';

/** The count from which a new finding outside the last fix needs evidence. */
const FROM_ROUND = 3;

interface Ctx { rec: RoundRecord; placed: Placed[]; ranges: RangeCommit[][] }

/** The version 2 record of a lane ticket and the ranges the host read, when the evidence rule applies at all. */
function ctxOf(snapshot: RepoSnapshot, id: string): Ctx | undefined {
  const rec = workOf(snapshot, id)?.rounds;
  const facts = factsOf(snapshot, id);
  if (laneTicket(snapshot, id) === undefined || rec === undefined || rec.version !== 2 || facts === undefined || 'error' in facts) return undefined;
  if (skipped(snapshot, id)) return undefined;
  return { rec, placed: placedRounds(rec), ranges: facts.ranges };
}

/** The Terms' evidence count: the rounds of the cycle up to `at` not headed (final review), counted from the latest added-code round whose span added `file`. */
export function evidenceCount(placed: Placed[], ranges: RangeCommit[][], at: Placed, file: string | undefined, id: string): number {
  const cycle = placed.filter((q) => q.cycle === at.cycle && q.p <= at.p);
  const from = (a: number): number => cycle.filter((q) => q.p >= a && !q.round.final).length;
  if (file !== undefined) {
    for (let i = cycle.length - 1; i >= 0; i--) {
      const a = cycle[i];
      if (a.round.added !== true) continue;
      if (addedCode(id, spanOf(placed, ranges, a.j)).some((c) => c.files.includes(file))) return from(a.p);
    }
  }
  return from(1);
}

/** The Terms' last fix files of the round at record index `j`: the paths of range j-1's fix commits, the ticket's own records left out. */
export function lastFixFiles(id: string, ranges: RangeCommit[][], j: number): Set<string> {
  return new Set(
    fixCommits(id, ranges[j - 2] ?? [])
      .flatMap((c) => c.files)
      .filter((p) => !ownRecordsOnly(id, [p])),
  );
}

function needs(ctx: Ctx, id: string, at: Placed, f: RoundFinding): boolean {
  if (at.round.final || f.severity === 'Nice' || f.carried !== undefined || f.risk !== undefined) return false;
  if (evidenceCount(ctx.placed, ctx.ranges, at, f.file, id) < FROM_ROUND) return false;
  return f.file === undefined || !lastFixFiles(id, ctx.ranges, at.j).has(f.file);
}

/** True when `f`, a finding of the round `at`, is new, outside the last fix's files and so asks evidence (version 2 record with facts, not skipped). */
export function needsEvidence(snapshot: RepoSnapshot, id: string, at: Placed, f: RoundFinding): boolean {
  const ctx = ctxOf(snapshot, id);
  return ctx !== undefined && needs(ctx, id, at, f);
}

const hasLine = (snapshot: RepoSnapshot, id: string, p: number, n: number | undefined, cycle: number): boolean =>
  (workOf(snapshot, id)?.ledger?.deferred ?? []).some((d) => d.round === p && d.n === n && d.cycle === cycle);

/**
 * D-08: the findings of one cycle (0-based) that need evidence, are written deferred and have their line in the
 * ledger's Deferred; they leave ST-LN-17's stop. When the checks are skipped (D-10) every deferred finding with its line.
 */
export function deferredOf(snapshot: RepoSnapshot, id: string, cycle: number): ReadonlySet<RoundFinding> {
  const out = new Set<RoundFinding>();
  const rec = workOf(snapshot, id)?.rounds;
  if (laneTicket(snapshot, id) === undefined || rec === undefined || rec.version !== 2) return out;
  const ctx = ctxOf(snapshot, id);
  const free = ctx === undefined && skipped(snapshot, id);
  if (ctx === undefined && !free) return out;
  const placed = ctx?.placed ?? placedRounds(rec);
  rec.cycles[cycle]?.rounds.forEach((round, i) => {
    const at = placed.find((q) => q.cycle === cycle + 1 && q.p === i + 1);
    for (const f of round.findings) {
      if (f.state !== 'deferred' || !hasLine(snapshot, id, i + 1, f.n, cycle + 1)) continue;
      if (ctx === undefined ? free : at !== undefined && needs(ctx, id, at, f)) out.add(f);
    }
  });
  return out;
}

/** ac-2: each new Must or Should from round 3 outside the last fix's files with no test or command, not deferred with its line. */
export const findingEvidence: GateRule['check'] = (snapshot, id) => {
  const ctx = ctxOf(snapshot, id);
  if (ctx === undefined) return [];
  const out: GateDraft[] = [];
  for (const at of ctx.placed) {
    for (const f of at.round.findings) {
      if (f.test !== undefined || f.command !== undefined || !needs(ctx, id, at, f)) continue;
      if (f.state === 'deferred' && hasLine(snapshot, id, at.p, f.n, at.cycle)) continue;
      const where = f.file === undefined ? 'nowhere (none)' : `in ${f.file}, which the previous round's fix did not change`;
      const cycle = at.cycle >= 2 ? ` cycle ${at.cycle}` : '';
      out.push({
        file: ctx.rec.file,
        line: f.line,
        reason:
          `round ${at.p} of cycle ${at.cycle}, finding ${f.n}: from round 3 a new Must or Should located ${where} needs test: or command:, ` +
          `risk: data-loss or risk: security, or deferred with the ledger line - review ${at.p}.${f.n}${cycle}: <text> under ## Deferred`,
      });
    }
  }
  return out;
};
