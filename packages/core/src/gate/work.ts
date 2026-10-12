// Spec §7-§11: the lane-ticket records under accord/tickets/<id>/ and the rules that read them. Every path
// is built from the snapshot's own ticket id, so no absolute path and no backslash reaches a reason (D-51).
import type { RepoSnapshot, Ticket, TicketWork } from '../model/snapshot.js';

export const planFile = (id: string): string => 'accord/tickets/' + id + '/plan.md';
export const ledgerFile = (id: string): string => 'accord/tickets/' + id + '/ledger.md';
export const reviewFile = (id: string): string => 'accord/tickets/' + id + '/review.md';

/** Spec §10: the two review verdicts Done accepts. */
export const VERDICTS: readonly string[] = ['converged', 'accepted-by-owner'];

/** `Object.hasOwn`, never `in`: the id is caller-supplied. */
export const workOf = (snapshot: RepoSnapshot, id: string): TicketWork | undefined =>
  snapshot.work !== undefined && Object.hasOwn(snapshot.work, id) ? snapshot.work[id] : undefined;

/** The ticket when it exists and carries `lane:`; every workflow-layer rule is silent otherwise. */
export const laneTicket = (snapshot: RepoSnapshot, id: string): Ticket | undefined => {
  const t = Object.hasOwn(snapshot.tickets, id) ? snapshot.tickets[id] : undefined;
  return t?.frontmatter?.lane === undefined ? undefined : t;
};
