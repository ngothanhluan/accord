// Spec §6: where a lane ticket stands, read from its records. A trace, never a verdict (D-91): only
// `gate ready` decides Ready and only `gate done` decides Done.
import { handMade, shaEqual } from '../gate/done.js';
import { acHash, approvedHash, laneRHash, laneSHash } from '../gate/hash.js';
import { hasOwnSpentRecord } from '../gate/lane-r.js';
import { VERDICTS, workOf } from '../gate/work.js';
import { headingKey, stripHtmlComments } from '../load/sections.js';
import { cycleOpen } from '../round/record.js';
import type { AfterVerifyCommit, RepoSnapshot, Ticket } from '../model/snapshot.js';

// ST-LN-94 D-10: 'research' is lane R's own stage, between Ready and its record.
export type Stage = 'intent' | 'plan' | 'build' | 'review' | 'verify' | 'done' | 'research';

export interface Progress {
  stage: Stage;
  tasksDone: number;
  tasksTotal: number;
  next?: number; // the lowest task number without a completion line, during build
  base?: string; // during review of changes made after verify: the commit before the first hand-made one
}

const ticksBound = (ticket: Ticket): boolean => {
  const fm = ticket.frontmatter;
  const hash = acHash(ticket.scenarios);
  return fm !== undefined && (fm.verified ?? []).length > 0 && hash !== undefined && fm.verified_hash === hash;
};

const planReady = (facts: NonNullable<RepoSnapshot['planFacts']>, id: string): boolean =>
  Object.hasOwn(facts, id) && facts[id].clean && facts[id].subject === `plan: ${id} ready`;

const NEXT: Record<Exclude<Stage, 'build' | 'intent' | 'research'>, string> = {
  plan: 'write the plan and pass accord gate plan',
  review: 'review to convergence',
  verify: "verification and the owner's tick",
  done: 'the pull request; run accord gate done',
};

/** Spec §6: what comes after `stage`. An unwritten intent (no Intent text, or only the template's scenario) points to the interview. */
export function nextStep(ticket: Ticket, stage: Exclude<Stage, 'build'>): string {
  if (ticket.frontmatter?.lane === 'S') return laneSNext(stage as LaneSStage);
  if (ticket.frontmatter?.lane === 'R') return laneRNext(stage as LaneRStage);
  if (stage === 'research') return laneRNext(stage); // unreachable: only lane R has it
  if (stage !== 'intent') return NEXT[stage];
  const intent = ticket.sections.find((s) => headingKey(s.heading) === 'intent');
  const written = intent !== undefined && stripHtmlComments(intent.lines).some((l) => l.text.trim() !== '');
  const scenario = ticket.scenarios.some((s) => s.name !== '<observable outcome>');
  return written && scenario ? 'the owner approves the ticket (accord approve)' : 'the intent interview (accord-intent)';
}

/** The parent of the first hand-made commit after the last recorded review round; undefined when none is unreviewed. */
function reviewBase(snapshot: RepoSnapshot, id: string, after: AfterVerifyCommit[]): string | undefined {
  const work = workOf(snapshot, id);
  const recorded = snapshot.verifications[id]?.frontmatter?.commit;
  const at = recorded === undefined ? -1 : after.findIndex((c) => shaEqual(c.sha, recorded));
  let first: AfterVerifyCommit | undefined;
  for (const c of after.slice(at + 1)) {
    if (handMade(id, c)) first ??= c;
    if (work?.review?.trailing !== true && c.files?.includes(`accord/tickets/${id}/review.md`)) first = undefined;
  }
  return first?.parents[0];
}

export type LaneSStage = 'intent' | 'build' | 'review' | 'done';

const LANE_S_NEXT: Record<LaneSStage, string> = {
  intent: 'write ## Understood and ## Done when, then pass accord gate ready (lane-s.md)',
  build: 'the change and the tests.affected command (lane-s.md)',
  review: 'the next review round, numbered after the last ## Round in review.md (lane-s.md)',
  done: 'the pull request; run accord gate done (lane-s.md)',
};

export const laneSNext = (stage: LaneSStage): string => LANE_S_NEXT[stage];

function laneSStage(snapshot: RepoSnapshot, ticket: Ticket): LaneSStage {
  if (ticket.frontmatter?.ac_hash !== laneSHash(ticket)) return 'intent';
  const review = workOf(snapshot, ticket.id)?.review;
  if (review === undefined) return 'build';
  const after = snapshot.afterVerify !== undefined && Object.hasOwn(snapshot.afterVerify, ticket.id) ? snapshot.afterVerify[ticket.id] : [];
  const closed = VERDICTS.includes(review.verdict ?? '') && review.trailing !== true && !after.some((c) => handMade(ticket.id, c));
  return closed ? 'done' : 'review';
}

// ST-LN-94 D-10, 94-ac-5: lane R is intent until gate ready recorded ac_hash over its three sections, research until a record its
// research: lists, added or changed since the claim (CR-01) and holding a Spent line, is in the snapshot, then done. It has no plan and no review, so it never reaches build, review or verify.
export type LaneRStage = 'intent' | 'research' | 'done';

export const LANE_R_NEXT: Record<LaneRStage, string> = {
  intent: 'write ## Question, ask the owner to set ## Timebox and ## Token budget and quote the answer under ## Decisions, then pass accord gate ready (lane-r.md)',
  research: 'the research, accord budget <id> between steps, and the record under accord/research/ listed in research: (lane-r.md)',
  done: 'the pull request; run accord gate done (lane-r.md)',
};

export const laneRNext = (stage: LaneRStage): string => LANE_R_NEXT[stage];

function laneRStage(snapshot: RepoSnapshot, ticket: Ticket): LaneRStage {
  if (ticket.frontmatter?.ac_hash !== laneRHash(ticket)) return 'intent';
  // T-03-33, CR-01: only a Markdown record under accord/research/ that the branch added or changed since the claim commit, with a Spent line,
  // makes it done; an older record listed as evidence never does, and with no research fact from the host the stage stays research.
  return hasOwnSpentRecord(snapshot, ticket) ? 'done' : 'research';
}

/** undefined for a ticket without lane, or whose frontmatter failed the schema. */
export function progressOf(snapshot: RepoSnapshot, ticket: Ticket): Progress | undefined {
  const fm = ticket.frontmatter;
  if (fm?.lane === undefined) return undefined;
  if (fm.lane === 'S') return { stage: laneSStage(snapshot, ticket), tasksDone: 0, tasksTotal: 0 };
  if (fm.lane === 'R') return { stage: laneRStage(snapshot, ticket), tasksDone: 0, tasksTotal: 0 };
  const work = workOf(snapshot, ticket.id);
  const tasks = [...(work?.plan?.tasks ?? [])].sort((a, b) => a.n - b.n);
  const done = work?.ledger?.done ?? {};
  const open = tasks.filter((t) => !Object.hasOwn(done, String(t.n)));
  const counts = { tasksDone: tasks.length - open.length, tasksTotal: tasks.length };
  if (fm.approved_hash === undefined || fm.approved_hash !== approvedHash(ticket)) return { stage: 'intent', ...counts };
  if (tasks.length === 0) return { stage: 'plan', ...counts };
  // BUG-LN-2: a host that supplies plan facts holds the ticket at plan until plan.md's ready commit.
  if (open.length > 0 && snapshot.planFacts !== undefined && !planReady(snapshot.planFacts, ticket.id)) return { stage: 'plan', ...counts };
  if (open.length > 0) return { stage: 'build', ...counts, next: open[0].n };
  if (!VERDICTS.includes(work?.review?.verdict ?? '')) return { stage: 'review', ...counts };
  // ST-LN-17: a versioned record that ends in an open cycle is at review, whatever the after-verify window reads.
  const midCycle = work?.rounds?.versioned === true && cycleOpen(work.rounds.cycles[work.rounds.cycles.length - 1]);
  const after = snapshot.afterVerify !== undefined && Object.hasOwn(snapshot.afterVerify, ticket.id) ? snapshot.afterVerify[ticket.id] : undefined;
  if (after !== undefined && after.some((c) => c.parents.length > 1 || handMade(ticket.id, c))) {
    const base = reviewBase(snapshot, ticket.id, after);
    return base === undefined ? { stage: midCycle ? 'review' : 'verify', ...counts } : { stage: 'review', ...counts, base };
  }
  if (midCycle) return { stage: 'review', ...counts };
  return { stage: ticksBound(ticket) ? 'done' : 'verify', ...counts };
}

/** A dependency is satisfied when its records say done; a ticket without lane counts when its ticks are bound. */
export function isDone(snapshot: RepoSnapshot, id: string): boolean {
  if (!Object.hasOwn(snapshot.tickets, id)) return false;
  const ticket = snapshot.tickets[id];
  if (ticket.frontmatter?.status === 'dropped') return false;
  const progress = progressOf(snapshot, ticket);
  return progress === undefined ? ticksBound(ticket) : progress.stage === 'done';
}

/** BUG-LN-13 D-01, D-04: done for the dashboard and for dependants: on the default ref the host read, else in `fallback` (BUG-LN-2 D-04). */
export function doneOnDefault(snapshot: RepoSnapshot, id: string, fallback: RepoSnapshot = snapshot): boolean {
  return isDone(snapshot.defaultRef?.snapshot ?? fallback, id);
}
