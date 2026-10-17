// Spec §6: where a lane ticket stands, read from its records. A trace, never a verdict (D-91): only
// `gate ready` decides Ready and only `gate done` decides Done.
import { acHash, approvedHash } from '../gate/hash.js';
import { VERDICTS, workOf } from '../gate/work.js';
import { headingKey, stripHtmlComments } from '../load/sections.js';
import type { RepoSnapshot, Ticket } from '../model/snapshot.js';

export type Stage = 'intent' | 'plan' | 'build' | 'review' | 'verify' | 'done';

export interface Progress {
  stage: Stage;
  tasksDone: number;
  tasksTotal: number;
  next?: number; // the lowest task number without a completion line, during build
}

const ticksBound = (ticket: Ticket): boolean => {
  const fm = ticket.frontmatter;
  const hash = acHash(ticket.scenarios);
  return fm !== undefined && (fm.verified ?? []).length > 0 && hash !== undefined && fm.verified_hash === hash;
};

const planReady = (facts: NonNullable<RepoSnapshot['planFacts']>, id: string): boolean =>
  Object.hasOwn(facts, id) && facts[id].clean && facts[id].subject === `plan: ${id} ready`;

const NEXT: Record<Exclude<Stage, 'build' | 'intent'>, string> = {
  plan: 'write the plan and pass accord gate plan',
  review: 'review to convergence',
  verify: "verification and the owner's tick",
  done: 'nothing; run accord gate done',
};

/** Spec §6: what comes after `stage`. An unwritten intent (no Intent text, or only the template's scenario) points to the interview. */
export function nextStep(ticket: Ticket, stage: Exclude<Stage, 'build'>): string {
  if (stage !== 'intent') return NEXT[stage];
  const intent = ticket.sections.find((s) => headingKey(s.heading) === 'intent');
  const written = intent !== undefined && stripHtmlComments(intent.lines).some((l) => l.text.trim() !== '');
  const scenario = ticket.scenarios.some((s) => s.name !== '<observable outcome>');
  return written && scenario ? 'the owner approves the ticket (accord approve)' : 'the intent interview (accord-intent)';
}

/** undefined for a ticket without lane, or whose frontmatter failed the schema. */
export function progressOf(snapshot: RepoSnapshot, ticket: Ticket): Progress | undefined {
  const fm = ticket.frontmatter;
  if (fm?.lane === undefined) return undefined;
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
