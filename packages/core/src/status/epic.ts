// ST-LN-28 D-13: the rules of an epic reach each of its stories as input the CLI builds, never as an instruction to go and read the epic.
// Pure: the host reads the default branch's copy of the tickets (snapshot.defaultRef); this builds the text.
import { sectionLines } from '../load/sections.js';
import type { RepoSnapshot } from '../model/snapshot.js';

/** The heading of the epic block's third part: what the epic's other stories learned (filled from their ledgers by a later plan of this group). */
export const EPIC_LESSONS = 'Epic lessons';

/**
 * The agents whose input carries the epic block (D-13): the ones that scout, plan, challenge and review a story. The executor, auditor, verifier, debugger and
 * researcher are left out on purpose.
 */
export const EPIC_ROLES: readonly string[] = ['accord-scout', 'accord-planner', 'accord-critic', 'accord-reviewer', 'accord-final-reviewer'];

/**
 * ST-LN-28 D-13: for a story whose frontmatter `parent:` names an epic, `## Epic <id> "<title>"` with the epic's `### Vetoes` and `### Decisions` lines as written
 * (`(none)` when a section is empty) and `### Epic lessons`. The epic is the default branch's copy when that holds one (a Decision added to the epic after the
 * story branched binds now), else the working tree's. A `parent:` that names no ticket, or a ticket that is not an epic, gives the one line
 * `parent <id> is not an epic in this clone`. undefined for a story without `parent:` (and for an id that is no ticket).
 */
export function epicBlock(snapshot: RepoSnapshot, id: string): string | undefined {
  if (!Object.hasOwn(snapshot.tickets, id)) return undefined;
  const parent = snapshot.tickets[id].frontmatter?.parent;
  if (parent === undefined) return undefined;
  const onDefault = snapshot.defaultRef?.snapshot.tickets;
  const found = onDefault !== undefined && Object.hasOwn(onDefault, parent) && onDefault[parent].frontmatter !== undefined ? onDefault[parent] : undefined;
  const epic = found ?? (Object.hasOwn(snapshot.tickets, parent) ? snapshot.tickets[parent] : undefined);
  if (epic?.frontmatter?.type !== 'epic') return `parent ${parent} is not an epic in this clone`;
  const part = (name: string): string[] => {
    const lines = sectionLines(epic.sections, name);
    return ['### ' + name, ...(lines.length === 0 ? ['(none)'] : lines)];
  };
  return [`## Epic ${parent} "${epic.frontmatter.title}"`, ...part('Vetoes'), ...part('Decisions'), '### ' + EPIC_LESSONS, '(none)'].join('\n');
}
