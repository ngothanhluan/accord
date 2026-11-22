// ST-LN-28 D-13: the rules of an epic reach each of its stories as input the CLI builds, never as an instruction to go and read the epic.
// Pure: the host reads the default branch's copy of the tickets (snapshot.defaultRef); this builds the text.
import { sectionLines } from '../load/sections.js';
import type { RepoSnapshot } from '../model/snapshot.js';
import { cmpId } from './dashboard.js';

/** The heading of the epic block's third part: what the epic's other stories learned, taken from their ledgers on the default branch (D-15). */
export const EPIC_LESSONS = 'Epic lessons';

/**
 * The agents whose input carries the epic block (D-13): the ones that scout, plan, challenge and review a story, and the judge of 08.4-01, which decides whether a
 * piece of feedback holds and so must know an epic-level Veto. The executor, verifier, debugger and researcher are left out on purpose.
 */
export const EPIC_ROLES: readonly string[] = ['accord-scout', 'accord-planner', 'accord-critic', 'accord-reviewer', 'accord-final-reviewer', 'accord-judge'];

/**
 * ST-LN-28 D-13: for a story whose frontmatter `parent:` names an epic, `## Epic <id> "<title>"` with the epic's `### Vetoes` and `### Decisions` lines as written
 * (`(none)` when a section is empty) and `### Epic lessons`. The epic is the default branch's copy when that holds one (a Decision added to the epic after the
 * story branched binds now), else the working tree's. A `parent:` that names no ticket, or a ticket that is not an epic, gives the one line
 * `parent <id> is not an epic in this clone`. undefined for a story without `parent:` (and for an id that is no ticket).
 * ST-LN-28 D-15: `### Epic lessons` holds `- <sibling id>: <line>` for every `## Epic lessons` line in the ledger of each other story of the epic (same `parent:`), read
 * from the default branch only, siblings in the dashboard's id order and lines in ledger order; a lesson not yet on the default branch is not shown. No shared file is read.
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
  const lessons = siblingLessons(snapshot.defaultRef?.snapshot, parent, id);
  return [`## Epic ${parent} "${epic.frontmatter.title}"`, ...part('Vetoes'), ...part('Decisions'), '### ' + EPIC_LESSONS, ...(lessons.length === 0 ? ['(none)'] : lessons)].join('\n');
}

/** The lessons of every story of `epic` but `self` on the default branch, as `- <id>: <line>`. */
function siblingLessons(def: RepoSnapshot | undefined, epic: string, self: string): string[] {
  if (def === undefined) return [];
  return Object.keys(def.tickets)
    .filter((sibling) => sibling !== self && def.tickets[sibling].frontmatter?.parent === epic)
    .sort(cmpId)
    .flatMap((sibling) => (def.work?.[sibling]?.ledger?.epicLessons ?? []).map((line) => '- ' + sibling + ': ' + line));
}
