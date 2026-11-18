// ST-LN-22 D-08: the duplicate check of `accord new ticket`. The one function that judges which existing tickets a new
// request is most like: plain word overlap between the request and each ticket's title and Intent, no model and no
// score. Pure: no node import, no filesystem; the CLI hands it the snapshot it loaded (working tree plus default branch).
import type { RepoSnapshot, Ticket } from '../model/snapshot.js';
import { headingKey, stripHtmlComments } from '../load/sections.js';
import { cmpId } from '../status/dashboard.js';

/** English words that carry no meaning of their own, plus the four words every accord request holds. */
export const STOP_WORDS: ReadonlySet<string> = new Set([
  // articles and pronouns
  'the', 'an', 'we', 'our', 'ours', 'us', 'you', 'your', 'yours', 'he', 'him', 'his', 'she', 'her', 'hers', 'it', 'its',
  'they', 'them', 'their', 'theirs', 'this', 'that', 'these', 'those', 'me', 'my', 'mine', 'who', 'whom', 'which', 'what',
  // auxiliaries
  'am', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'having', 'do', 'does', 'did', 'doing',
  'will', 'would', 'shall', 'should', 'can', 'could', 'may', 'might', 'must',
  // prepositions
  'of', 'in', 'on', 'at', 'by', 'for', 'with', 'about', 'against', 'between', 'into', 'through', 'during', 'before',
  'after', 'above', 'below', 'to', 'from', 'up', 'down', 'out', 'off', 'over', 'under', 'again', 'further', 'then', 'once',
  // conjunctions and adverbs
  'and', 'but', 'or', 'nor', 'so', 'if', 'because', 'as', 'until', 'while', 'than', 'too', 'very', 'not', 'no', 'only',
  'here', 'there', 'where', 'why', 'how', 'all', 'any', 'both', 'each', 'few', 'more', 'most', 'other', 'some', 'such',
  'own', 'same', 'just', 'also',
  // the words every request in an accord repository holds
  'ticket', 'accord', 'when',
]);

/** The distinct meaning-bearing words of `text`: lowercase, split on anything but `a`-`z` and `0`-`9`, two characters or more, no stop word. */
export function requestWords(text: string): Set<string> {
  const words = new Set<string>();
  for (const w of text.toLowerCase().split(/[^a-z0-9]+/)) if (w.length >= 2 && !STOP_WORDS.has(w)) words.add(w);
  return words;
}

/** What the judge knows of one ticket: its title and status, and the lines of the section that states what it is for. */
export interface SimilarFact {
  id: string;
  title: string;
  status: string;
  text: string[];
}

export interface SimilarTicket {
  id: string;
  title: string;
  status: string;
  shared: number; // how many words the request and the ticket have in common
}

// A lane M, L or P ticket states its purpose under Intent; a lane S ticket under Understood and a lane R one under Question.
const PURPOSE = ['intent', 'understood', 'question'];

/** The non-empty lines, comments stripped, of the first of the purpose sections the ticket has with any text. */
function purposeLines(t: Ticket): string[] {
  for (const key of PURPOSE) {
    const section = t.sections.find((s) => headingKey(s.heading) === key);
    if (section === undefined) continue;
    const lines = stripHtmlComments(section.lines)
      .map((l) => l.text.trim())
      .filter((l) => l !== '');
    if (lines.length > 0) return lines;
  }
  return [];
}

/**
 * The facts of every ticket of `snapshot` and of its default branch (`snapshot.defaultRef`), whatever its status, in the
 * dashboard's id order. A ticket on both is read once, from the working tree. A ticket that fails the schema has no
 * status to print and is left out.
 */
export function ticketFacts(snapshot: RepoSnapshot): SimilarFact[] {
  const byId = new Map<string, SimilarFact>();
  for (const tickets of [snapshot.defaultRef?.snapshot.tickets ?? {}, snapshot.tickets]) {
    for (const t of Object.values(tickets)) {
      if (t.frontmatter === undefined) continue;
      byId.set(t.id, { id: t.id, title: t.frontmatter.title, status: t.frontmatter.status, text: purposeLines(t) });
    }
  }
  return [...byId.values()].sort((a, b) => cmpId(a.id, b.id));
}

/**
 * The tickets of `facts` most like `request`: those sharing at least one word with it, most shared words first, ties in
 * the dashboard's id order, at most `limit`. The same request over the same facts always gives the same answer.
 */
export function similarTickets(request: string, facts: readonly SimilarFact[], limit = 5): SimilarTicket[] {
  const wanted = requestWords(request);
  if (wanted.size === 0) return [];
  const found: SimilarTicket[] = [];
  for (const f of facts) {
    const have = requestWords([f.title, ...f.text].join('\n'));
    let shared = 0;
    for (const w of wanted) if (have.has(w)) shared++;
    if (shared > 0) found.push({ id: f.id, title: f.title, status: f.status, shared });
  }
  found.sort((a, b) => b.shared - a.shared || cmpId(a.id, b.id));
  return found.slice(0, limit);
}
