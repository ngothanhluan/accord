// Spec §6 re-anchoring: after a compaction the orchestrator re-reads the owner's words instead of
// remembering them. Comments and blank lines are dropped; every other line is printed as written.
import { workOf } from '../gate/work.js';
import { headingKey, stripHtmlComments } from '../load/sections.js';
import { RULING } from '../load/work.js';
import type { RepoSnapshot } from '../model/snapshot.js';
import { laneRNext, laneSNext, nextStep, progressOf } from './stage.js';
import type { LaneRStage, LaneSStage } from './stage.js';

const SECTIONS = ['Intent', 'Vetoes', 'Decisions', 'Corrections'];
const has = (ticket: { sections: { heading: string }[] }, name: string): boolean => ticket.sections.some((x) => headingKey(x.heading) === headingKey(name));

/** undefined when `id` is not a lane ticket in the snapshot. */
export function anchorText(snapshot: RepoSnapshot, id: string): string | undefined {
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
  if (lane === 'S') out.push('Lane: S', `Stage: ${progress.stage}, next: ${laneSNext(progress.stage as LaneSStage)}`);
  // ST-LN-94 94-ac-5: lane R prints its own stage and the three sections gate ready hashed.
  else if (lane === 'R') out.push('Lane: R', `Stage: ${progress.stage}, next: ${laneRNext(progress.stage as LaneRStage)}`);
  else out.push(`Stage: ${where}`);
  if (progress.base !== undefined) out.push(`Review base: ${progress.base}`);
  const optional = (names: string[]) => names.filter((n) => has(ticket, n));
  const names =
    lane === 'S' ? ['Understood', 'Done when', ...optional(['Scope', 'Vetoes', 'Decisions', 'Corrections'])]
    : lane === 'R' ? ['Question', 'Timebox', 'Token budget', ...optional(['Vetoes', 'Decisions', 'Corrections'])]
    : SECTIONS;
  for (const name of names) {
    const s = ticket.sections.find((x) => headingKey(x.heading) === headingKey(name));
    const lines = s === undefined ? [] : stripHtmlComments(s.lines).map((l) => l.text).filter((t) => t.trim() !== '');
    out.push('', `## ${name}`, ...(lines.length === 0 ? ['(none)'] : lines));
  }
  // ST-LN-13: the research records the ticket lists, as written, in key order.
  const research = ticket.frontmatter?.research;
  if (research !== undefined && research.length > 0) out.push('', '## Research', ...research);
  // The section verbatim, so a Ruling in a form the parser does not read is never dropped; then any
  // parsed Ruling: line from elsewhere in the ledger that the section did not already print.
  const written = work?.ledger?.rulingsSection ?? [];
  const printed = new Set(written.map((l) => RULING.exec(l)?.[1]));
  const rulings = [...written, ...(work?.ledger?.rulings ?? []).filter((r) => !printed.has(r))];
  out.push('', '## Rulings', ...(rulings.length === 0 ? ['(none)'] : rulings));
  return out.join('\n') + '\n';
}
