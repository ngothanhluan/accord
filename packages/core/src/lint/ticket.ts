// D-34 id verbatim: rules over ticket frontmatter. Levels live in rules.ts (D-57); no line, pointer only.
import { headingKey, LIST_MARKER, stripHtmlComments } from '../load/sections.js';
import type { Line, RepoSnapshot, Section, Ticket, TicketFrontmatter } from '../model/snapshot.js';
import type { Draft, Rule } from './rules.js';

/** `frontmatter.id` must equal the file stem, case-sensitively (D-34, T-03-07); skipped without frontmatter (D-32). */
export const idMismatch: Rule['check'] = (snapshot) =>
  Object.values(snapshot.tickets)
    .filter((t) => t.frontmatter !== undefined && t.frontmatter.id !== t.id)
    .map((t) => ({
      file: t.file,
      pointer: '/id',
      reason: `frontmatter id "${t.frontmatter?.id}" differs from the file name "${t.id}"`,
    }));

// D-71 required headings by type; `## Verification notes` is never required.
const REQUIRED: Record<'story' | 'bug' | 'epic', string[]> = {
  story: ['Intent', 'Requirements', 'Acceptance criteria', 'Open questions', 'Plan'],
  bug: ['Intent', 'Requirements', 'Acceptance criteria', 'Open questions', 'Plan'],
  epic: ['Intent', 'Requirements', 'Open questions'],
};
// D-73 sentinels: uppercase whole words, an angle-bracket placeholder outside HTML tags, a `...` step.
const WORD = /(?:^|[^A-Za-z0-9_])(TODO|TBD|FIXME|TICKET-ID)(?![A-Za-z0-9_])/g;
const PLACEHOLDER = /<[a-z][a-z]* [^<>="/]+>/g;
const PLACEHOLDER_STEP = /^\S+ \.\.\.$/;
const OPEN = /^\s*[-*+]\s+\[ \]/;
const DONE = /^\s*[-*+]\s+\[[xX]\]/;
// ROADMAP criterion 7: the seven phrases, case-insensitive, Unicode-letter boundaries.
const VAGUE = /(?<!\p{L})(depends|maybe|probably|mix of|somewhere between|not sure|TBD)(?!\p{L})/iu;
const AC = /@ac-[1-9][0-9]*/g;
const NOTE_BLOCK = /^###\s+@(ac-[1-9][0-9]*)\b/;
const LIMITS = { intent: 5, requirements: 15, scenarios: 5 };

const section = (t: Ticket, key: string): Section | undefined => t.sections.find((s) => headingKey(s.heading) === key);
const stripped = (t: Ticket, key: string): Line[] => {
  const s = section(t, key);
  return s === undefined ? [] : stripHtmlComments(s.lines);
};
const tickets = (snapshot: RepoSnapshot): Ticket[] => Object.values(snapshot.tickets);
type Typed = Ticket & { frontmatter: TicketFrontmatter };
/** Pitfall 9: type-dependent rules need a schema-valid frontmatter. */
const typed = (snapshot: RepoSnapshot): Typed[] => tickets(snapshot).filter((t): t is Typed => t.frontmatter !== undefined);

/** D-71: every required heading for the ticket's type, in table order, no line. */
export const headingMissing: Rule['check'] = (snapshot) =>
  typed(snapshot).flatMap((t) =>
    REQUIRED[t.frontmatter.type]
      .filter((name) => section(t, headingKey(name)) === undefined)
      .map((name) => ({ file: t.file, reason: `missing "## ${name}"` })),
  );

/** D-22: `tracker: {}` says nothing; drop the key or name an adapter. */
export const trackerEmpty: Rule['check'] = (snapshot) =>
  typed(snapshot)
    .filter((t) => t.frontmatter.tracker !== undefined && Object.keys(t.frontmatter.tracker).length === 0)
    .map((t) => ({ file: t.file, pointer: '/tracker', reason: 'tracker is empty; remove the key or add an adapter id' }));

/** LINT-05: a `verified` entry with no scenario carrying that exact `@ac-n` tag. */
export const tickOrphan: Rule['check'] = (snapshot) =>
  typed(snapshot).flatMap((t) =>
    (t.frontmatter.verified ?? [])
      .map((tag, i) => ({ tag, i }))
      .filter(({ tag }) => !t.scenarios.some((s) => s.acTag === tag))
      .map(({ tag, i }) => ({
        file: t.file,
        pointer: `/verified/${i}`,
        reason: `verified names "${tag}" but no scenario carries @${tag}`,
      })),
  );

/** D-73: one finding per `confirmed: false` assumption, by pointer. */
export const assumptionUnconfirmed: Rule['check'] = (snapshot) =>
  typed(snapshot).flatMap((t) =>
    (t.frontmatter.assumptions ?? [])
      .map((a, i) => ({ a, i }))
      .filter(({ a }) => a.confirmed === false)
      .map(({ a, i }) => ({
        file: t.file,
        pointer: `/assumptions/${i}/confirmed`,
        reason: `assumption "${a.text}" is not confirmed`,
      })),
  );

/** D-73: one finding per sentinel word, placeholder, or `...` step; comment text is skipped. */
export const sentinel: Rule['check'] = (snapshot) =>
  tickets(snapshot).flatMap((t) => {
    const out: Draft[] = [];
    for (const s of t.sections) {
      for (const l of stripHtmlComments(s.lines)) {
        for (const m of l.text.matchAll(WORD)) out.push({ file: t.file, line: l.line, reason: `contains sentinel "${m[1]}"` });
        for (const m of l.text.matchAll(PLACEHOLDER)) {
          out.push({ file: t.file, line: l.line, reason: `contains placeholder "${m[0]}"` });
        }
      }
    }
    for (const s of t.scenarios) {
      for (const step of s.steps.filter((x) => PLACEHOLDER_STEP.test(x))) {
        out.push({ file: t.file, line: s.line, reason: `scenario "${s.name}" has a placeholder step "${step}"` });
      }
    }
    return out;
  });

/** D-73: an unchecked `- [ ]` item under `## Open questions`, at its line. */
export const openQuestion: Rule['check'] = (snapshot) =>
  tickets(snapshot).flatMap((t) =>
    stripped(t, 'open questions')
      .filter((l) => OPEN.test(l.text))
      .map((l) => ({ file: t.file, line: l.line, reason: 'open question is unchecked' })),
  );

/** Criterion 7: requirement lines, acceptance-criteria lines, and answered open questions; first phrase per line. */
export const vagueWording: Rule['check'] = (snapshot) =>
  tickets(snapshot).flatMap((t) =>
    [...t.requirements, ...stripped(t, 'acceptance criteria'), ...stripped(t, 'open questions').filter((l) => DONE.test(l.text))]
      .map((l) => ({ line: l.line, m: VAGUE.exec(l.text) }))
      .filter((x): x is { line: number; m: RegExpExecArray } => x.m !== null)
      .map(({ line, m }) => ({ file: t.file, line, reason: `vague wording "${m[1]}"` })),
  );

// LINT-07: fires at the section heading line when the count exceeds the limit; the limit itself is silent.
const oversize = (name: string, count: (t: Ticket) => number, limit: number, unit: string): Rule['check'] =>
  (snapshot) =>
    tickets(snapshot).flatMap((t) => {
      const s = section(t, headingKey(name));
      const n = count(t);
      if (s === undefined || n <= limit) return [];
      return [{ file: t.file, line: s.line, reason: `## ${name} has ${n} ${unit}; the limit is ${limit}` }];
    });

/** LINT-07: non-blank, comment-stripped Intent lines. */
export const intentOversize = oversize(
  'Intent',
  (t) => stripped(t, 'intent').filter((l) => l.text.trim() !== '').length,
  LIMITS.intent,
  'lines',
);
/** LINT-07: EARS lines. */
export const requirementsOversize = oversize('Requirements', (t) => t.requirements.length, LIMITS.requirements, 'EARS lines');
/** LINT-07: scenarios. */
export const scenariosOversize = oversize('Acceptance criteria', (t) => t.scenarios.length, LIMITS.scenarios, 'scenarios');

/** D-74: the `## Plan` section and its list items after comment stripping; absent for epics and untyped tickets. */
function planItems(t: Ticket): { section: Section; items: Line[] } | undefined {
  if (t.frontmatter === undefined || t.frontmatter.type === 'epic') return undefined;
  const s = section(t, 'plan');
  if (s === undefined) return undefined;
  return { section: s, items: stripHtmlComments(s.lines).filter((l) => LIST_MARKER.test(l.text)) };
}
const acNumber = (tag: string): number => Number(tag.slice('@ac-'.length));
const missing = (from: Set<string>, of: Set<string>): string => {
  const tags = [...of].filter((x) => !from.has(x)).sort((a, b) => acNumber(a) - acNumber(b));
  return tags.length === 0 ? 'nothing' : tags.join(' ');
};

/** D-74: a plan step with no `@ac-n` tag, at its line. */
export const planStepUntagged: Rule['check'] = (snapshot) =>
  tickets(snapshot).flatMap((t) =>
    (planItems(t)?.items ?? [])
      .filter((l) => [...l.text.matchAll(AC)].length === 0)
      .map((l) => ({ file: t.file, line: l.line, reason: 'plan step carries no @ac-n tag' })),
  );

/** D-74: scenarios exist but `## Plan` has no list item. */
export const planEmpty: Rule['check'] = (snapshot) =>
  tickets(snapshot).flatMap((t) => {
    const p = planItems(t);
    if (p === undefined || p.items.length > 0 || t.scenarios.length === 0) return [];
    return [{ file: t.file, line: p.section.line, reason: 'ticket has scenarios but ## Plan has no step' }];
  });

/** D-74: the tag set across plan steps differs from the tag set across scenarios; one finding naming each side's gap. */
export const planTagsDiffer: Rule['check'] = (snapshot) =>
  tickets(snapshot).flatMap((t) => {
    const p = planItems(t);
    if (p === undefined || p.items.length === 0) return [];
    const plan = new Set(p.items.flatMap((l) => [...l.text.matchAll(AC)].map((m) => m[0])));
    const scenarios = new Set(t.scenarios.filter((s) => s.acTag !== undefined).map((s) => '@' + s.acTag));
    if (plan.size === scenarios.size && [...plan].every((x) => scenarios.has(x))) return [];
    return [
      {
        file: t.file,
        line: p.section.line,
        reason: `plan lacks ${missing(plan, scenarios)}; scenarios lack ${missing(scenarios, plan)}`,
      },
    ];
  });

/** D-70: a `### @ac-n` block under `## Verification notes` whose tag matches no scenario. */
export const noteOrphan: Rule['check'] = (snapshot) =>
  tickets(snapshot).flatMap((t) =>
    stripped(t, 'verification notes')
      .map((l) => ({ line: l.line, tag: NOTE_BLOCK.exec(l.text)?.[1] }))
      .filter((x): x is { line: number; tag: string } => x.tag !== undefined && !t.scenarios.some((s) => s.acTag === x.tag))
      .map(({ line, tag }) => ({ file: t.file, line, reason: `note block "@${tag}" matches no scenario` })),
  );

/** D-70: `## Verification notes`, when present, must be the last `##` section. */
export const notesNotLast: Rule['check'] = (snapshot) =>
  tickets(snapshot).flatMap((t) => {
    const s = section(t, 'verification notes');
    if (s === undefined || s === t.sections[t.sections.length - 1]) return [];
    return [{ file: t.file, line: s.line, reason: '"## Verification notes" must be the last section' }];
  });
