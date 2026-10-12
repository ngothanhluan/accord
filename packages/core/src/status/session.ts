// Spec §17 session line: one line of position for the SessionStart hook, counted from status rows.
import { templates } from '../generated/templates.js';
import { nextRows } from './rows.js';
import type { StatusRow } from './rows.js';

/** The shipped ruleset with the pinned invocation filled in. */
export const rulesetText = (invocation: string): string => templates['ruleset.md'].replace('{{invocation}}', invocation);

const WORKING = ['plan', 'build', 'review', 'verify'];

/** No newline. Dropped and archived rows count nowhere. */
export function sessionLine(rows: StatusRow[]): string {
  const lane = rows.filter((r) => r.lane !== undefined && r.status !== 'archived' && r.status !== 'dropped');
  if (lane.length === 0) return 'accord: no lane tickets yet · type /accord <request> to start one';
  const ready = nextRows(rows);
  const inProgress = lane.filter((r) => r.stage !== undefined && WORKING.includes(r.stage) && !ready.includes(r)).length;
  return `accord: ${inProgress} in progress, ${ready.length} ready to pick up · type /accord`;
}
