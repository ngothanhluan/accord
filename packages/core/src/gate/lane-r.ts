// ST-LN-94 D-10, D-13, 94-ac-1: the Ready rules of a lane R ticket. It holds a question, a timebox and a token budget in body sections and
// needs no approval, Approach, discuss record or scenario. Each check is silent unless the ticket exists with `lane: R`.
import { isResearchRecord } from '../load/research.js';
import { headingKey, LIST_MARKER, stripHtmlComments } from '../load/sections.js';
import type { Line, RepoSnapshot, Section, Ticket } from '../model/snapshot.js';
import { laneRHash } from './hash.js';
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

/**
 * ST-LN-94 D-10, research Pitfall 8: lane R has no plan, so gate plan refuses an R ticket through PLAN_R_RULES and no lane M plan rule
 * reads its records. Silent unless the ticket exists with `lane: R`.
 */
export const laneRPlan: GateRule['check'] = (snapshot, id) =>
  laneR(snapshot, id) === undefined
    ? []
    : [
        {
          file: ticketFile(id),
          pointer: '/lane',
          reason:
            'lane R has no plan: a research ticket ends in a record under accord/research/ that its research: lists; ' +
            'run accord gate done ' + id + ' when the record is written',
        },
      ];

// ST-LN-94 D-10, D-11, 94-ac-2, 94-ac-3: the Done rules of a lane R ticket (DONE_R_RULES). It is done when a research record its
// research: lists is in the checkout with a Spent line, and its branch changes nothing under packages/. Each check is silent unless the
// ticket exists with `lane: R`.

/** ST-LN-31's lane S rule for lane R: gate ready recorded the ticket's ac_hash. */
export const researchReadyMissing: GateRule['check'] = (snapshot, id) => {
  const t = laneR(snapshot, id);
  if (t === undefined || t.frontmatter?.ac_hash !== undefined) return [];
  return [{ file: ticketFile(id), pointer: '/ac_hash', reason: `gate ready has recorded no ac_hash for this lane R ticket; run accord gate ready ${id}` }];
};

/** ST-LN-31's lane S rule for lane R: the question, timebox and token budget still hash to the ac_hash gate ready recorded. */
export const researchSectionsChanged: GateRule['check'] = (snapshot, id) => {
  const t = laneR(snapshot, id);
  const recorded = t?.frontmatter?.ac_hash;
  if (t === undefined || recorded === undefined) return [];
  const now = laneRHash(t);
  if (recorded === now) return [];
  return [
    {
      file: ticketFile(id),
      pointer: '/ac_hash',
      reason: `## Question, ## Timebox or ## Token budget changed since gate ready: ac_hash records ${recorded}, they hash to ${now} now; run accord gate ready ${id}`,
    },
  ];
};

/** T-03-33: the entries of research: that name a Markdown record under accord/research/ (no `..`, no backslash) the checkout holds. */
function presentRecords(snapshot: RepoSnapshot, t: Ticket): string[] {
  return (t.frontmatter?.research ?? []).filter((p) => isResearchRecord(p) && Object.hasOwn(snapshot.files, p));
}

/** A record's lines with HTML comments stripped and each line trimmed. */
const recordLines = (text: string): Line[] =>
  stripHtmlComments(text.split('\n').map((l, i) => ({ line: i + 1, text: l }))).map((l) => ({ line: l.line, text: l.text.trim() }));

const SPENT = 'Spent: ';
const SPENT_FORM = 'Spent: <h>h <m>m of <timebox>; <tokens or not measured> of <budget>';
// T-03-49: anchored, on the short part before the first ` of ` only; the rest of the line is read with indexOf.
const SPENT_TIME = /^([0-9]+)h ([0-9]+)m$/;
const WHOLE = /^[0-9]+$/;

/** Splits `text` once at the first `sep`; undefined when `sep` is absent or a side is empty. */
function splitOnce(text: string, sep: string): [string, string] | undefined {
  const at = text.indexOf(sep);
  if (at === -1) return undefined;
  const [a, b] = [text.slice(0, at).trim(), text.slice(at + sep.length).trim()];
  return a === '' || b === '' ? undefined : [a, b];
}

/**
 * D-11: a record's spend, read from `Spent: <h>h <m>m of <timebox>; <tokens or not measured> of <budget>` (the line accord budget prints):
 * after `Spent: `, split once on `; ` and each half once on ` of `. The time spent reads `<h>h <m>m` and nothing else; the tokens spent are
 * a whole number or `not measured` (D-20: a partial count is never a figure), `tokens` then undefined. Anything else is undefined.
 */
export function parseSpent(line: string): { minutes: number; tokens: number | undefined; time: string; tokensText: string } | undefined {
  const text = line.trim();
  if (!text.startsWith(SPENT)) return undefined;
  const halves = splitOnce(text.slice(SPENT.length), '; ');
  if (halves === undefined) return undefined;
  const [time, tokens] = [splitOnce(halves[0], ' of '), splitOnce(halves[1], ' of ')];
  if (time === undefined || tokens === undefined) return undefined;
  const m = SPENT_TIME.exec(time[0]);
  if (m === null) return undefined;
  const minutes = Number(m[1]) * 60 + Number(m[2]);
  if (!Number.isSafeInteger(minutes)) return undefined;
  if (tokens[0] === 'not measured') return { minutes, tokens: undefined, time: time[0], tokensText: tokens[0] };
  if (!WHOLE.test(tokens[0]) || !Number.isSafeInteger(Number(tokens[0]))) return undefined;
  return { minutes, tokens: Number(tokens[0]), time: time[0], tokensText: tokens[0] };
}

/** 94-ac-2: none of the research: entries is a record under accord/research/ this checkout holds. */
export const researchRecordMissing: GateRule['check'] = (snapshot, id) => {
  const t = laneR(snapshot, id);
  if (t === undefined || presentRecords(snapshot, t).length > 0) return [];
  return [
    {
      file: ticketFile(id),
      pointer: '/research',
      reason: 'no record under accord/research/ that research: lists is in this checkout; a lane R ticket is done when its research record merges',
    },
  ];
};

/** 94-ac-2, D-11: each listed record present holds a Spent line, outside HTML comments, that parseSpent reads. */
export const researchSpentMissing: GateRule['check'] = (snapshot, id) => {
  const t = laneR(snapshot, id);
  if (t === undefined) return [];
  return presentRecords(snapshot, t)
    .filter((p) => !recordLines(snapshot.files[p]).some((l) => parseSpent(l.text) !== undefined))
    .map((p) => ({ file: p, reason: `${p} has no "${SPENT_FORM}" line; copy the one accord budget ${id} prints` }));
};

/** 94-ac-3, D-10: every path under packages/ the branch changes, in any way, is shipped code; a research ticket ships none. */
export const researchShipped: GateRule['check'] = (snapshot, id) => {
  if (laneR(snapshot, id) === undefined) return [];
  const facts = snapshot.branchFacts;
  const fact = facts !== undefined && Object.hasOwn(facts, id) ? facts[id] : undefined;
  if (fact === undefined || 'error' in fact) return [];
  return fact.changes
    .filter((c) => c.path.startsWith('packages/'))
    .map((c) => ({
      file: c.path,
      reason: c.path + ' is under packages/: a research ticket ships no code; a script that should ship is a new lane S or M ticket',
    }));
};
