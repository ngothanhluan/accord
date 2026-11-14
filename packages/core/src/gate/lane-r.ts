// ST-LN-94 D-10, D-13, 94-ac-1: the Ready rules of a lane R ticket. It holds a question, a timebox and a token budget in body sections and
// needs no approval, Approach, discuss record or scenario. Each check is silent unless the ticket exists with `lane: R`.
import { headingKey, LIST_MARKER, stripHtmlComments } from '../load/sections.js';
import type { RepoSnapshot, Section, Ticket } from '../model/snapshot.js';
import type { GateRule } from './rules.js';

export { LANE_R_SECTIONS } from './hash.js';

const ticketFile = (id: string) => 'accord/tickets/' + id + '.md';

/** The ticket when it exists with `lane: R`; `Object.hasOwn`, never `in`, as the id is caller-supplied. */
export const laneR = (snapshot: RepoSnapshot, id: string): Ticket | undefined => {
  const t = Object.hasOwn(snapshot.tickets, id) ? snapshot.tickets[id] : undefined;
  return t?.frontmatter?.lane === 'R' ? t : undefined;
};

const sectionOf = (t: Ticket, name: string): Section | undefined => t.sections.find((s) => headingKey(s.heading) === headingKey(name));

/** The first non-blank line of a section once HTML comments are stripped, trimmed; undefined when the section is absent or empty. */
export function sectionValue(t: Ticket, name: string): string | undefined {
  const s = sectionOf(t, name);
  if (s === undefined) return undefined;
  return stripHtmlComments(s.lines)
    .map((l) => l.text.trim())
    .find((x) => x !== '');
}

const firstLine = (text: string): string => text.split('\n').map((l) => l.trim()).find((l) => l !== '') ?? '';
// T-03-31: anchored, one quantifier per run and none nested, so a long line is read in linear time.
const TIMEBOX = /^([1-9][0-9]*)\s+(minutes?|hours?)$/;
const BUDGET = /^([1-9][0-9]*)(k|M)?\s+weighted tokens$/;
const safe = (n: number): number | undefined => (Number.isSafeInteger(n) ? n : undefined);

/** The timebox in minutes, read from the first non-blank line as `<n> minutes` or `<n> hours`; undefined when it does not read so. */
export function readTimebox(text: string): number | undefined {
  const m = TIMEBOX.exec(firstLine(text));
  if (m === null) return undefined;
  return safe(Number(m[1]) * (m[2].startsWith('hour') ? 60 : 1));
}

/** The token budget in weighted tokens, read from the first non-blank line as `<n> weighted tokens`, n optionally ending in k or M. */
export function readTokenBudget(text: string): number | undefined {
  const m = BUDGET.exec(firstLine(text));
  if (m === null) return undefined;
  return safe(Number(m[1]) * (m[2] === 'k' ? 1_000 : m[2] === 'M' ? 1_000_000 : 1));
}

const FIELDS: readonly { name: string; read?: (text: string) => number | undefined; form?: string }[] = [
  { name: 'Question' },
  { name: 'Timebox', read: readTimebox, form: '<n> minutes or <n> hours' },
  { name: 'Token budget', read: readTokenBudget, form: '<n> weighted tokens, n may end in k or M' },
];

/** 94-ac-1: one finding per section of the three that is absent, empty, or (Timebox, Token budget) does not read in its form. */
export const researchFieldMissing: GateRule['check'] = (snapshot, id) => {
  const t = laneR(snapshot, id);
  if (t === undefined) return [];
  return FIELDS.flatMap(({ name, read, form }) => {
    const s = sectionOf(t, name);
    const at = { file: ticketFile(id), ...(s === undefined ? {} : { line: s.line }) };
    const value = sectionValue(t, name);
    if (value === undefined) return [{ ...at, reason: `"## ${name}" is missing or empty; a lane R ticket needs it before research starts` }];
    if (read === undefined || read(value) !== undefined) return [];
    return [{ ...at, reason: `"## ${name}" does not read as ${form}` }];
  });
};

// T-03-47: case folded, every run of whitespace one space; plain string work, no regex over a Decisions item.
const fold = (text: string): string => text.split(/\s+/).filter((w) => w !== '').join(' ').toLowerCase();
const isWordChar = (c: string | undefined): boolean => c !== undefined && /[\p{L}\p{N}]/u.test(c);
const QUOTE_SEP = ' — ';

/** Whether `hay` holds `needle` with no letter or digit on either side, so `4 hours` is not read inside `14 hours`. */
function holdsValue(hay: string, needle: string): boolean {
  for (let at = hay.indexOf(needle); at !== -1; at = hay.indexOf(needle, at + 1)) {
    if (!isWordChar(hay[at - 1]) && !isWordChar(hay[at + needle.length])) return true;
  }
  return false;
}

/** The text after the item's last ` — ` is a double-quoted string holding a non-space character: the owner's sentence. */
function quotesOwner(item: string): boolean {
  const at = item.lastIndexOf(QUOTE_SEP);
  if (at === -1) return false;
  const tail = item.slice(at + QUOTE_SEP.length).trim();
  return tail.length >= 2 && tail.startsWith('"') && tail.endsWith('"') && tail.slice(1, -1).trim() !== '';
}

/** The list items under `## Decisions`, as decisionIds reads them: HTML comments stripped, lines inside a fence skipped, list marker dropped. */
function decisionItems(t: Ticket): string[] {
  const s = sectionOf(t, 'Decisions');
  if (s === undefined) return [];
  const items: string[] = [];
  let fenced = false;
  for (const { text } of stripHtmlComments(s.lines)) {
    const trimmed = text.trim();
    if (trimmed.startsWith('```') || trimmed.startsWith('~~~')) {
      fenced = !fenced;
      continue;
    }
    if (fenced) continue;
    const m = LIST_MARKER.exec(text);
    if (m !== null) items.push(text.slice(m[0].length).trim());
  }
  return items;
}

const BUDGETS: readonly { name: string; read: (text: string) => number | undefined; what: string }[] = [
  { name: 'Timebox', read: readTimebox, what: 'timebox' },
  { name: 'Token budget', read: readTokenBudget, what: 'token budget' },
];

/**
 * D-13: the owner sets an R ticket's timebox and token budget. Each readable value needs a `## Decisions` item that holds it as written
 * (case folded, whitespace runs as one) and ends with ` — "<the owner's sentence>"`; one item may hold both. An unreadable value is
 * gate.research-field-missing's finding, so this rule is silent for it. An extension is a new value, so it needs its own quoted item.
 */
export const researchBudgetUnanswered: GateRule['check'] = (snapshot, id) => {
  const t = laneR(snapshot, id);
  if (t === undefined) return [];
  const quoted = decisionItems(t).filter(quotesOwner).map(fold);
  return BUDGETS.flatMap(({ name, read, what }) => {
    const value = sectionValue(t, name);
    if (value === undefined || read(value) === undefined) return [];
    const want = fold(value);
    if (quoted.some((item) => holdsValue(item, want))) return [];
    const s = sectionOf(t, name);
    return [
      {
        file: ticketFile(id),
        ...(s === undefined ? {} : { line: s.line }),
        reason:
          `"## ${name}" ${value} is not quoted from the owner under ## Decisions: the owner sets the ${what}; ` +
          `ask, and write the answer as - D-nn ${name} ${value} — "<the owner's sentence>"`,
      },
    ];
  });
};
