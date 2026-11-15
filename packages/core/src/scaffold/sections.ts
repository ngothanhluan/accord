// ST-LN-50 D-10 (t2-ac-7): a team's own sections in the ticket template. `template.sections: [{ name, after? }]` in accord/config.yml adds `## <name>` to every story and bug
// ticket `accord new ticket` writes: after the section `after` names, or when `after` is absent or not in that template before `## Open questions`, else before
// `## Verification notes`, else at the end, so `## Verification notes` stays last. Pure text in, text out; nothing here reads a file or the config.
import { templates } from '../generated/templates.js';
import { LANE_R_REQUIRED, LANE_REQUIRED, LANE_S_REQUIRED, REQUIRED } from '../lint/ticket.js';
import { headingKey, scan } from '../load/sections.js';

/** One entry of `template.sections`. */
export interface TeamSection {
  name: string;
  after?: string;
}

/** The one line under each team heading: a hint that is an HTML comment, so no check reads it as content. */
export const TEAM_HINT = '<!-- A team section from accord/config.yml template.sections; accord does not check its content. -->';

let reserved: ReadonlySet<string> | undefined;

/**
 * The heading keys a team section may not take: every heading of every shipped ticket and epic template and every heading a required list names (D-10 "required sections and forms stay").
 * A key that names acceptance criteria in any wording is refused as well, by `teamSectionProblems`.
 */
export function reservedSections(): ReadonlySet<string> {
  if (reserved !== undefined) return reserved;
  const keys = new Set<string>();
  for (const [name, text] of Object.entries(templates)) {
    if (name.startsWith('ticket-') || name.startsWith('epic')) for (const h of scan(text, 0).sections) keys.add(headingKey(h.heading));
  }
  for (const list of [REQUIRED, LANE_REQUIRED, LANE_S_REQUIRED, LANE_R_REQUIRED]) {
    for (const headings of Object.values(list)) for (const h of headings) keys.add(headingKey(h));
  }
  reserved = keys;
  return keys;
}

/** Why each entry of `template.sections` is refused, by its index; an entry that is not an object with a string name is the schema's to refuse, not listed here. */
function refusals(sections: unknown): { index: number; pointer: string; reason: string }[] {
  if (!Array.isArray(sections)) return [];
  const reservedKeys = reservedSections();
  const seen = new Set<string>();
  const found: { index: number; pointer: string; reason: string }[] = [];
  sections.forEach((entry: unknown, index) => {
    const name = typeof entry === 'object' && entry !== null ? (entry as { name?: unknown }).name : undefined;
    if (typeof name !== 'string') return;
    const key = headingKey(name);
    const pointer = `/template/sections/${index}/name`;
    let reason: string | undefined;
    if (reservedKeys.has(key)) reason = `${name} is a section accord requires or ships; a team section cannot replace it`;
    else if (key.includes('acceptance')) reason = `${name}: acceptance criteria are the Gherkin block under ## Acceptance criteria; a team section cannot hold them in another form`;
    else if (seen.has(key)) reason = `${name} is listed twice in template.sections; a section is added once`;
    seen.add(key);
    if (reason !== undefined) found.push({ index, pointer, reason });
  });
  return found;
}

/** The `template.sections` entries the template skips and lint refuses, each with the JSON pointer of its name and why (D-10, t2-ac-7). */
export function teamSectionProblems(sections: unknown): { pointer: string; reason: string }[] {
  return refusals(sections).map(({ pointer, reason }) => ({ pointer, reason }));
}

/** The line after the frontmatter's closing `---`, or 0 for a text without one. */
function bodyStart(lines: string[]): number {
  if (lines[0]?.trimEnd() !== '---') return 0;
  for (let i = 1; i < lines.length; i++) if (lines[i].trimEnd() === '---') return i + 1;
  return 0;
}

/**
 * `text` with the team's sections put in, in the order given. A heading is found the way accord finds one (`## ` at column 0, outside a fence, compared by key),
 * so a fenced `## ` line is not a section. An entry `teamSectionProblems` names is skipped, so a required section is never doubled; no list, an empty list or nothing
 * left to insert returns `text` itself, byte for byte.
 */
export function insertTeamSections(text: string, given: readonly TeamSection[] | undefined): string {
  const refused = new Set(refusals(given).map((r) => r.index));
  const sections = (given ?? []).filter((_, i) => !refused.has(i));
  if (sections.length === 0) return text;
  const lines = text.split('\n');
  const trailing = lines[lines.length - 1] === '';
  if (trailing) lines.pop();
  const start = bodyStart(lines);
  const headings = (): { key: string; index: number }[] =>
    scan(lines.slice(start).join('\n'), start).sections.map((s) => ({ key: headingKey(s.heading), index: s.line - 1 }));
  // the section each inserted team heading was put after, so two entries on one anchor keep the order the config gives them
  const placedAfter = new Map<string, string>();
  for (const entry of sections) {
    const found = headings();
    const anchorKey = entry.after === undefined ? undefined : headingKey(entry.after);
    const anchor = anchorKey === undefined || anchorKey === 'verification notes' ? -1 : found.findIndex((h) => h.key === anchorKey);
    let at: number;
    if (anchor >= 0) {
      let next = anchor + 1;
      while (next < found.length && placedAfter.get(found[next].key) === anchorKey) next++;
      at = next < found.length ? found[next].index : lines.length;
    } else {
      // `after: Verification notes` would end the file with something else: the section goes before it
      const before =
        (anchorKey === 'verification notes' ? found.find((h) => h.key === 'verification notes') : undefined) ??
        found.find((h) => h.key === 'open questions') ??
        found.find((h) => h.key === 'verification notes');
      at = before === undefined ? lines.length : before.index;
    }
    const lead = at > 0 && lines[at - 1] !== '' ? [''] : [];
    lines.splice(at, 0, ...lead, '## ' + entry.name, TEAM_HINT, ...(at === lines.length ? [] : ['']));
    if (anchor >= 0 && anchorKey !== undefined) placedAfter.set(headingKey(entry.name), anchorKey);
  }
  return lines.join('\n') + (trailing ? '\n' : '');
}
