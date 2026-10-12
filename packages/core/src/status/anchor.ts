// Spec §6 re-anchoring: after a compaction the orchestrator re-reads the owner's words instead of
// remembering them. Comments and blank lines are dropped; every other line is printed as written.
import { workOf } from '../gate/work.js';
import { headingKey, stripHtmlComments } from '../load/sections.js';
import type { RepoSnapshot } from '../model/snapshot.js';
import { progressOf } from './stage.js';
import type { Stage } from './stage.js';

const SECTIONS = ['Intent', 'Vetoes', 'Decisions', 'Corrections'];
const NEXT: Record<Exclude<Stage, 'build'>, string> = {
  intent: 'the owner approves the ticket (accord approve)',
  plan: 'write the plan and pass accord gate plan',
  review: 'review to convergence',
  verify: "verification and the owner's tick",
  done: 'nothing; run accord gate done',
};

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
    where = `${progress.stage}, next: ${NEXT[progress.stage]}`;
  }
  const out = [`# Anchor: ${id} "${ticket.frontmatter?.title ?? ''}"`, '', `Stage: ${where}`];
  for (const name of SECTIONS) {
    const s = ticket.sections.find((x) => headingKey(x.heading) === headingKey(name));
    const lines = s === undefined ? [] : stripHtmlComments(s.lines).map((l) => l.text).filter((t) => t.trim() !== '');
    out.push('', `## ${name}`, ...(lines.length === 0 ? ['(none)'] : lines));
  }
  const rulings = work?.ledger?.rulings ?? [];
  out.push('', '## Rulings', ...(rulings.length === 0 ? ['(none)'] : rulings));
  return out.join('\n') + '\n';
}
