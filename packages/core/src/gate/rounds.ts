// ST-LN-17 AC-3, AC-4: Done and the plan gate read the round records. A round run past the cap or past a stop,
// a stop the owner has not lifted, and a record accord cannot read each fail, so the cap and the stop hold in
// every tool and not only where a session asked `accord round`.
import { allowancesOf, cycleState, deferredFor, planStopOf, recordProblems } from '../round/next.js';
import { cycleOpen } from '../round/record.js';
import { scopeProblems } from '../round/scope.js';
import { doneOnDefault } from '../status/stage.js';
import type { RepoSnapshot, RoundRecord } from '../model/snapshot.js';
import type { RoundKind } from '../round/next.js';
import { laneTicket, workOf } from './work.js';
import type { GateDraft, GateRule } from './rules.js';

function check(snapshot: RepoSnapshot, id: string, kind: RoundKind): GateDraft[] {
  const ticket = laneTicket(snapshot, id);
  const work = workOf(snapshot, id);
  const rec: RoundRecord | undefined = kind === 'review' ? work?.rounds : work?.planRounds;
  if (ticket === undefined || rec === undefined) return [];
  const name = kind === 'review' ? 'review.md' : 'plan-review.md';
  const out: GateDraft[] = [];
  const add = (line: number | undefined, reason: string) =>
    out.push({ file: rec.file, ...(line === undefined ? {} : { line }), reason });

  if (!rec.versioned) {
    // An unversioned record is read by the old rules: where the host gave no default ref, or the ticket is done there.
    if (rec.cycles.every((c) => c.rounds.length === 0) || snapshot.defaultRef === undefined || doneOnDefault(snapshot, id)) return [];
    // ST-LN-57: when gate.review-scope refuses version 1 (or cannot read the facts), it already tells how to fix the record.
    if (kind === 'review' && scopeProblems(snapshot, id).length > 0) return [];
    add(undefined, `${name} has no record version line; add the line "Round record: 1" above its first ## heading`);
    return out;
  }

  for (const p of recordProblems(snapshot, id, kind)) add(p.line, p.reason);

  const all = allowancesOf(snapshot, id, kind);
  rec.cycles.forEach((cycle, i) => {
    const state = cycleState(cycle, all.filter((a) => a.cycle === i + 1), kind, deferredFor(snapshot, id, kind, i));
    for (let p = 1; p <= cycle.rounds.length; p++) {
      if (state.allowed(p)) continue;
      const why = p > state.cap ? `past the cap of ${state.cap} rounds` : `after the stop at round ${state.stopAt(p - 1)}`;
      add(cycle.rounds[p - 1].line, `round ${p} of cycle ${i + 1} ran without an owner Ruling allowing it: ${why}`);
      break;
    }
  });

  const k = rec.cycles.length;
  const last = rec.cycles[k - 1];
  const mine = all.filter((a) => a.cycle === k);
  if (kind === 'review') {
    const s = cycleState(last, mine, kind, deferredFor(snapshot, id, kind, k - 1)).stopAt(last.rounds.length);
    const verdict = last.verdicts[last.verdicts.length - 1];
    if (s !== undefined && !(verdict?.value === 'accepted-by-owner' && verdict.quoted)) {
      add(
        last.rounds[s - 1].line,
        `round ${s} of cycle ${k} still reports a Should or a Must, so the loop stopped for the owner; Done needs the cycle to end with verdict: accepted-by-owner "<the owner's sentence>", or a round allowed by the owner that reports no findings followed by verdict: converged`,
      );
    }
    if (ticket.frontmatter?.lane !== 'S' && k >= 2 && cycleOpen(last)) {
      add(
        last.rounds[last.rounds.length - 1].line,
        `cycle ${k} of the review record has rounds and no verdict: line after its last round; Done needs it to end with verdict: converged, or verdict: accepted-by-owner "<the owner's sentence>"`,
      );
    }
  } else {
    const s = planStopOf(last, mine);
    if (s !== undefined) {
      const cap = cycleState(last, mine, kind).cap;
      add(
        last.rounds[s - 1].line,
        `round ${s} of plan critique cycle ${k} stops the loop for the owner (a Should or a Must from round 3, or the cap of ${cap} rounds); gate plan needs verdict: accepted-by-owner "<the owner's sentence>" after that round, or a round allowed by the owner that reports no findings`,
      );
    }
  }
  return out;
}

/** AC-3: the review record of a lane ticket at Done. */
export const reviewRounds: GateRule['check'] = (snapshot, id) => check(snapshot, id, 'review');

/** AC-4: the plan critique record of a lane ticket at the plan gate. */
export const planRounds: GateRule['check'] = (snapshot, id) => check(snapshot, id, 'plan');
