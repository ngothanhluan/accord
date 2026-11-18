// ST-LN-22 D-09: what the scout at intent and the critic at approach are given about the tickets related to one ticket: the
// Vetoes and Decisions those tickets hold. Built here, by the CLI's `accord related <id>`, so no skill sends an agent to
// open other tickets. Pure: no node import, no filesystem; the CLI hands it the snapshot it loaded (working tree plus default branch).
import { headingKey, stripHtmlComments } from '../load/sections.js';
import type { RepoSnapshot, Ticket } from '../model/snapshot.js';
import { similarTickets, ticketFacts } from './similar.js';

/** The sections of a related ticket that are printed, in this order. */
const SECTIONS = ['Vetoes', 'Decisions'];

/**
 * The ticket as the working tree holds it, else as the default branch does (the choice `ticketFacts` makes: a copy that fails the schema
 * gives way to one that passes). A ticket that fails the schema everywhere is still returned, so the caller can tell it from no ticket.
 */
function copyOf(snapshot: RepoSnapshot, id: string): Ticket | undefined {
  const onDefault = snapshot.defaultRef?.snapshot.tickets;
  const copies = [snapshot.tickets, onDefault ?? {}].filter((tickets) => Object.hasOwn(tickets, id)).map((tickets) => tickets[id]);
  return copies.find((t) => t.frontmatter !== undefined) ?? copies[0];
}

/**
 * The ids of the tickets related to `id`, at most `limit`: first the ids its `related:` list names that are tickets of the working tree or
 * the default branch, in the order written, then the tickets the similarity search finds for its title and Intent, best first, with the
 * ticket itself and the ids already listed left out. A ticket that fails the schema has no status to print and is never listed. An id that
 * is no ticket gives an empty list.
 */
export function relatedIds(snapshot: RepoSnapshot, id: string, limit = 5): string[] {
  const own = copyOf(snapshot, id);
  if (own === undefined) return [];
  const facts = ticketFacts(snapshot);
  const known = new Set(facts.map((f) => f.id));
  const ids: string[] = [];
  for (const rid of own.frontmatter?.related ?? []) if (rid !== id && known.has(rid) && !ids.includes(rid)) ids.push(rid);
  const self = facts.find((f) => f.id === id);
  if (self !== undefined) {
    // the search is asked for every ticket: the ticket itself and the linked ones are dropped below, before the cut
    for (const hit of similarTickets([self.title, ...self.text].join('\n'), facts, facts.length)) {
      if (hit.id !== id && !ids.includes(hit.id)) ids.push(hit.id);
    }
  }
  return ids.slice(0, limit);
}

/** A title from a file anyone on the team wrote, on one line: every control character becomes a space. */
const printable = (text: string): string => text.replace(/\p{Cc}/gu, ' ');

/** The non-blank lines of one section of `ticket`, comments stripped and each line as written; `(none)` when there are none. */
function sectionLines(ticket: Ticket, name: string): string[] {
  const section = ticket.sections.find((s) => headingKey(s.heading) === headingKey(name));
  const lines = section === undefined ? [] : stripHtmlComments(section.lines).map((l) => l.text).filter((t) => t.trim() !== '');
  return lines.length === 0 ? ['(none)'] : lines;
}

/**
 * The text `accord related <id>` prints: `# Related tickets of <id>`, then for each of `relatedIds` a block `## <id> "<title>" (<status>)` with
 * its `### Vetoes` and `### Decisions` lines as written, or `(none)` under the header when nothing is related. undefined when `id` is no ticket
 * of the snapshot.
 */
export function relatedText(snapshot: RepoSnapshot, id: string): string | undefined {
  if (copyOf(snapshot, id) === undefined) return undefined;
  const out = [`# Related tickets of ${id}`];
  const ids = relatedIds(snapshot, id);
  if (ids.length === 0) out.push('', '(none)');
  for (const rid of ids) {
    const ticket = copyOf(snapshot, rid) as Ticket;
    const fm = ticket.frontmatter as NonNullable<Ticket['frontmatter']>;
    out.push('', `## ${rid} "${printable(fm.title)}" (${fm.status})`);
    for (const name of SECTIONS) out.push(`### ${name}`, ...sectionLines(ticket, name));
  }
  return out.join('\n') + '\n';
}
