// ST-LN-94 D-10, D-13, 94-ac-1: the Ready rules of a lane R ticket. It holds a question, a timebox and a token budget in body sections and
// needs no approval, Approach, discuss record or scenario. Each check is silent unless the ticket exists with `lane: R`.
import { headingKey, stripHtmlComments } from '../load/sections.js';
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
