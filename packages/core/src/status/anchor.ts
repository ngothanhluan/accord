// Spec §6 re-anchoring: after a compaction the orchestrator re-reads the owner's words instead of
// remembering them. Comments and blank lines are dropped; every other line is printed as written.
import { shaEqual, unfinishedVerification } from '../gate/done.js';
import { unfinishedPlan } from '../gate/plan.js';
import { unfinishedDebug, workOf } from '../gate/work.js';
import { headingKey, sectionLines } from '../load/sections.js';
import { RULING } from '../load/work.js';
import type { RepoSnapshot } from '../model/snapshot.js';
import { productBlocks } from '../product/assemble.js';
import type { ProductRead } from '../product/assemble.js';
import { epicBlock } from './epic.js';
import { ticketWarnings } from './show.js';
import { laneRNext, laneSNext, nextStep, progressOf } from './stage.js';
import type { LaneRStage, LaneSStage } from './stage.js';

const SECTIONS = ['Intent', 'Vetoes', 'Decisions', 'Corrections'];
const has = (ticket: { sections: { heading: string }[] }, name: string): boolean => ticket.sections.some((x) => headingKey(x.heading) === headingKey(name));

/**
 * ST-LN-72 D-11 and its Ruling: the resume-or-restart fact for a plan.md, a verification.md or a debug.md that still carries the unfinished marker, in that order, for exactly the tickets the gates refuse them on
 * (unfinishedPlan, unfinishedVerification) and, for debug.md, the lanes of the debug stage (unfinishedDebug). The skills have no byte room for the rule, so the tool prints it and the skill follows the line. A verifier
 * resumes only on the work it began on: the frontmatter `commit:` is HEAD (shaEqual: both at least 7 hex characters), or the host found (`recordsSince`, the paths changed from that commit to HEAD) that nothing outside
 * the ticket's own folder accord/tickets/<id>/ changed since, which is what committing the partial verification.md before `accord worktree sync` does to HEAD (ST-LN-72 review round 2). Any other difference, no
 * `commit:`, no HEAD or no fact says start over.
 */
function unfinishedLines(snapshot: RepoSnapshot, id: string): string[] {
  const lines: string[] = [];
  const plan = unfinishedPlan(snapshot, id);
  if (plan !== undefined) lines.push(`Unfinished: ${plan.file}: resume the planner`);
  const v = unfinishedVerification(snapshot, id);
  if (v !== undefined) {
    const written = v.frontmatter?.commit;
    const head = snapshot.git?.commit;
    const since = written !== undefined && snapshot.recordsSince !== undefined && Object.hasOwn(snapshot.recordsSince, written) ? snapshot.recordsSince[written] : undefined;
    const same = written !== undefined && ((head !== undefined && shaEqual(written, head)) || (since !== undefined && since.every((p) => p.startsWith('accord/tickets/' + id + '/'))));
    lines.push(
      same
        ? `Unfinished: ${v.file}: resume the verifier`
        : `Unfinished: ${v.file}: written at ${written ?? 'unknown'}, HEAD is ${head ?? 'unknown'}: start the verifier over`,
    );
  }
  const debug = unfinishedDebug(snapshot, id);
  if (debug !== undefined) lines.push(`Unfinished: ${debug.file}: resume the debugger`);
  return lines;
}

/**
 * undefined when `id` is not a lane ticket in the snapshot. `header` is extra header lines the host supplies (ST-LN-50 D-08: `stages off for lane <L>: ...`); they close the base lines (Stage, Review base)
 * and come before the Unfinished lines, so the header reads in one order whoever prints it.
 * Phase 8.5 D-17: `product` is what the host read of the working branch's conventions.md (D-06; core reads nothing). A lane S ticket at `build` or `review`, the stages where its session writes code
 * with no brief, gets the conventions block of `productBlocks('lane-s-session')` last, after `## Rulings`, with its duty line and every line checked; any other ticket and stage, and a call without `product`, print today's text.
 */
export function anchorText(snapshot: RepoSnapshot, id: string, header: readonly string[] = [], product?: { conventions: ProductRead }): string | undefined {
  if (!Object.hasOwn(snapshot.tickets, id)) return undefined;
  const ticket = snapshot.tickets[id];
  const progress = progressOf(snapshot, ticket);
  if (progress === undefined) return undefined;
  const work = workOf(snapshot, id);
  let where: string;
  if (progress.stage === 'build') {
    const task = work?.plan?.tasks.find((t) => t.n === progress.next);
    where =
      `build ${progress.tasksDone}/${progress.tasksTotal}` + (task === undefined ? '' : `, next: task ${task.n} "${task.title}"`);
  } else {
    where = `${progress.stage}, next: ${nextStep(ticket, progress.stage)}`;
  }
  const lane = ticket.frontmatter?.lane;
  const out = [`# Anchor: ${id} "${ticket.frontmatter?.title ?? ''}"`, ''];
  // Phase 08.8.1 D-05: the session-resume hook prints this text into an agent's context, which must not read `build 0/3` or `plan` as fact for a ticket whose records git does not hold: the
  // not-committed text (an ignored accord/ only) takes the place of the Stage line, and any other warning (WR-01 an untracked plan.md, D-02 a gated plan held at plan) follows it. With none, today's anchor byte for byte.
  const warnings = ticketWarnings(snapshot, id);
  const notCommitted = warnings.find((w) => w.kind === 'not-committed');
  const stage = (line: string): string => notCommitted?.text ?? line;
  if (lane === 'S') out.push('Lane: S', stage(`Stage: ${progress.stage}, next: ${laneSNext(progress.stage as LaneSStage)}`));
  // ST-LN-94 94-ac-5: lane R prints its own stage and the three sections gate ready hashed.
  else if (lane === 'R') out.push('Lane: R', stage(`Stage: ${progress.stage}, next: ${laneRNext(progress.stage as LaneRStage)}`));
  else out.push(stage(`Stage: ${where}`));
  out.push(...warnings.filter((w) => w.kind !== 'not-committed').map((w) => w.text));
  if (progress.base !== undefined) out.push(`Review base: ${progress.base}`);
  out.push(...header, ...unfinishedLines(snapshot, id));
  const optional = (names: string[]) => names.filter((n) => has(ticket, n));
  const names =
    lane === 'S' ? ['Understood', 'Done when', ...optional(['Scope', 'Vetoes', 'Decisions', 'Corrections'])]
    : lane === 'R' ? ['Question', 'Timebox', 'Token budget', ...optional(['Vetoes', 'Decisions', 'Corrections'])]
    : SECTIONS;
  for (const name of names) {
    const lines = sectionLines(ticket.sections, name);
    out.push('', `## ${name}`, ...(lines.length === 0 ? ['(none)'] : lines));
  }
  // ST-LN-28 D-13: a story of an epic carries the epic's Vetoes and Decisions, built here, after its own sections.
  const epic = epicBlock(snapshot, id);
  if (epic !== undefined) out.push('', epic);
  // ST-LN-13: the research records the ticket lists, as written, in key order.
  const research = ticket.frontmatter?.research;
  if (research !== undefined && research.length > 0) out.push('', '## Research', ...research);
  // The section verbatim, so a Ruling in a form the parser does not read is never dropped; then any
  // parsed Ruling: line from elsewhere in the ledger that the section did not already print.
  const written = work?.ledger?.rulingsSection ?? [];
  const printed = new Set(written.map((l) => RULING.exec(l)?.[1]));
  const rulings = [...written, ...(work?.ledger?.rulings ?? []).filter((r) => !printed.has(r))];
  out.push('', '## Rulings', ...(rulings.length === 0 ? ['(none)'] : rulings));
  if (lane === 'S' && (progress.stage === 'build' || progress.stage === 'review') && product !== undefined) out.push('', ...productBlocks('lane-s-session', { conventions: product.conventions }));
  return out.join('\n') + '\n';
}
