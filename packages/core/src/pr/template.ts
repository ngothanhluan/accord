// Phase 8.1 D-01, D-03: a pull request's body is the team's PR template with every heading kept and what the ticket already knows filled in; the title is `<id>: <title>`.
// Pure: the host reads the template file and writes the body file. A heading line is never rewritten or moved, so the fill only inserts lines.
import type { Ticket, Verification } from '../model/snapshot.js';
import { headingKey, sectionLines, stripHtmlComments } from '../load/sections.js';

/** One heading of a template (ATX, levels 1-6) and the lines under it up to the next heading of any level. */
export interface TemplateSection {
  level: number; // 1-6
  heading: string; // the text after the #s, trailing #s and spaces dropped
  line: number; // 0-based index of the heading line in the text as split (BOM and CRLF dropped)
  bodyStart: number; // index of the first line under the heading
  bodyEnd: number; // index one past the last line under it
}

/** What the ticket knows, each a list of lines as they go into the body. */
export interface PrFacts {
  id: string;
  title: string;
  intent: string[];
  criteria: string[];
  evidence: string[];
}

// Up to three spaces of indent are allowed before a heading or a fence (CommonMark); a fence closes on the same character, at least as long.
const FENCE = /^ {0,3}(`{3,}|~{3,})/;
const ATX = /^ {0,3}(#{1,6})[ \t]+(.+?)[ \t#]*$/;

const BOM = new RegExp('^\uFEFF');

/** The template text as lines: a byte order mark dropped, CRLF read as LF. */
const linesOf = (text: string): string[] => text.replace(BOM, '').replace(/\r\n/g, '\n').split('\n');

/** Every ATX heading outside a fenced block, with its body range. A line inside a fence is never a heading. */
export function templateSections(text: string): TemplateSection[] {
  const lines = linesOf(text);
  const out: TemplateSection[] = [];
  let fence: string | undefined;
  lines.forEach((l, i) => {
    const f = FENCE.exec(l);
    if (fence !== undefined) {
      if (f !== null && f[1][0] === fence[0] && f[1].length >= fence.length && l.slice(f[0].length).trim() === '') fence = undefined;
      return;
    }
    if (f !== null) {
      // CommonMark: a backtick fence's info string may not hold a backtick
      if (!(f[1][0] === '`' && l.slice(f[0].length).includes('`'))) fence = f[1];
      return;
    }
    const h = ATX.exec(l);
    if (h !== null) out.push({ level: h[1].length, heading: h[2].trim(), line: i, bodyStart: i + 1, bodyEnd: lines.length });
  });
  out.forEach((s, k) => {
    if (k + 1 < out.length) s.bodyEnd = out[k + 1].line;
  });
  return out;
}

/** The slot a heading names: lower case, punctuation dropped, whitespace collapsed (Ruling "fill"). */
const SLOTS = {
  intent: new Set(['summary', 'description', 'what', 'why', 'motivation', 'intent', 'context', 'overview']),
  criteria: new Set(['acceptance criteria', 'done when', 'criteria']),
  evidence: new Set(['test', 'tests', 'testing', 'test plan', 'how was this tested', 'verification']),
} as const;
type Slot = keyof typeof SLOTS;
const SLOT_ORDER: readonly Slot[] = ['intent', 'criteria', 'evidence'];
const OPENING_LABEL: Readonly<Record<Slot, string>> = { intent: 'Intent:', criteria: 'Acceptance criteria:', evidence: 'Test evidence:' };

const slotOf = (heading: string): Slot | undefined => {
  const key = headingKey(heading.replace(/[^\p{L}\p{N}\s]/gu, ' '));
  return SLOT_ORDER.find((s) => SLOTS[s].has(key));
};

/**
 * A line of ticket text that would read as a heading or open a fence in the body would change the template's own headings (or swallow them), so its first mark is escaped with a
 * backslash: it shows as the text it was.
 */
const plain = (line: string): string => line.replace(/^( {0,3})(#{1,6}[ \t]|`{3,}|~{3,})/, (_m, indent: string, mark: string) => `${indent}\\${mark}`);

/**
 * The template with the ticket's facts in it, and the headings of the sections nobody filled.
 *
 * A section whose body is blank or only HTML comments is filled when its heading names a slot (Intent, acceptance criteria, test evidence); the first such section takes the slot, the
 * filled lines go directly under the heading, and the section's own comment lines stay after them. A slot no section takes goes into the opening block, which always begins
 * `**<id>: <title>**`. Every other empty section is returned in `remaining`, in template order, for the agent to write; a heading that holds nothing but sub-headings is no section to write.
 * A slot with no lines (a lane R ticket has no criteria) fills nothing.
 */
export function fillTemplate(template: string, facts: PrFacts): { body: string; remaining: string[] } {
  const lines = linesOf(template);
  const sections = templateSections(template);
  const empty = (s: TemplateSection): boolean =>
    stripHtmlComments(lines.slice(s.bodyStart, s.bodyEnd).map((text, i) => ({ line: s.bodyStart + i, text }))).every((l) => l.text.trim() === '');

  const text: Record<Slot, string[]> = { intent: facts.intent, criteria: facts.criteria, evidence: facts.evidence };
  const taken = new Map<Slot, TemplateSection>();
  const remaining: string[] = [];
  sections.forEach((s, k) => {
    if (!empty(s)) return;
    const slot = slotOf(s.heading);
    if (slot !== undefined && !taken.has(slot) && text[slot].length > 0) {
      taken.set(slot, s);
      return;
    }
    const container = k + 1 < sections.length && sections[k + 1].level > s.level;
    if (!container) remaining.push(s.heading);
  });

  const opening: string[] = [`**${facts.id}: ${facts.title}**`, ''];
  for (const slot of SLOT_ORDER) {
    if (taken.has(slot) || text[slot].length === 0) continue;
    opening.push(OPENING_LABEL[slot], ...text[slot].map(plain), '');
  }

  const after = new Map<number, string[]>([...taken].map(([slot, s]) => [s.line, text[slot].map(plain)]));
  const out: string[] = [...opening];
  lines.forEach((l, i) => {
    out.push(l);
    const filled = after.get(i);
    if (filled !== undefined) out.push(...filled);
  });
  return { body: out.join('\n').replace(/\n*$/, '\n'), remaining };
}

/** The title of a ticket's pull request: its id, then its title (Ruling "title"). */
export const prTitle = (id: string, title: string): string => `${id}: ${title}`;

/** The lines of `## <name>` of a ticket as written, comments and blank lines dropped; empty when the section is absent. */
const linesUnder = (ticket: Ticket, name: string): string[] => sectionLines(ticket.sections, name);

/**
 * What the ticket knows (Ruling "sources per ticket kind"). Intent: `## Intent` (lane M, L, P and an epic), `## Understood` (lane S), `## Question` (lane R). Criteria: each scenario's name
 * with its `@ac-<n>` tag, or the `## Done when` lines of a lane S ticket; none for lane R. Evidence: per scenario its `@test:<id>` tags and the `Result:` of its verification.md block, or
 * `(not recorded)` when it has neither. Tags go in code spans, so a pull request body never mentions a GitHub user named `ac-1` or `test`.
 */
export function prFacts(ticket: Ticket, verification?: Verification): PrFacts {
  const lane = ticket.frontmatter?.lane;
  const intentOf = lane === 'S' ? 'Understood' : lane === 'R' ? 'Question' : 'Intent';
  const scenarios = lane === 'S' || lane === 'R' ? [] : ticket.scenarios;
  const criteria = lane === 'S' ? linesUnder(ticket, 'Done when') : scenarios.map((s) => (s.acTag === undefined ? `- ${s.name}` : `- \`@${s.acTag}\` ${s.name}`));
  const evidence = scenarios.map((s) => {
    const tests = s.tags.filter((t) => t.startsWith('@test:')).map((t) => `\`${t.slice('@test:'.length)}\``);
    const result = s.acTag === undefined ? undefined : verification?.blocks.find((b) => b.acTag === s.acTag)?.result;
    const said = [...(tests.length === 0 ? [] : [`tests ${tests.join(', ')}`]), ...(result === undefined ? [] : [`Result: ${result}`])];
    return `- ${s.acTag === undefined ? '' : `\`@${s.acTag}\` `}${s.name}: ${said.length === 0 ? '(not recorded)' : said.join('; ')}`;
  });
  return { id: ticket.id, title: ticket.frontmatter?.title ?? ticket.id, intent: linesUnder(ticket, intentOf), criteria, evidence };
}
