// ST-LN-50 D-10 (t2-ac-7): a team's own sections in the ticket template. `template.sections: [{ name, after? }]` in accord/config.yml adds `## <name>` to every story and bug
// ticket `accord new ticket` writes: after the section `after` names, or when `after` is absent or not in that template before `## Open questions`, else before
// `## Verification notes`, else at the end, so `## Verification notes` stays last. Pure text in, text out; nothing here reads a file or the config.
import { headingKey, scan } from '../load/sections.js';

/** One entry of `template.sections`. */
export interface TeamSection {
  name: string;
  after?: string;
}

/** The one line under each team heading: a hint that is an HTML comment, so no check reads it as content. */
export const TEAM_HINT = '<!-- A team section from accord/config.yml template.sections; accord does not check its content. -->';

/** The line after the frontmatter's closing `---`, or 0 for a text without one. */
function bodyStart(lines: string[]): number {
  if (lines[0]?.trimEnd() !== '---') return 0;
  for (let i = 1; i < lines.length; i++) if (lines[i].trimEnd() === '---') return i + 1;
  return 0;
}

/**
 * `text` with the team's sections put in, in the order given. A heading is found the way accord finds one (`## ` at column 0, outside a fence, compared by key),
 * so a fenced `## ` line is not a section. An entry with no list, an empty list or nothing to insert returns `text` itself, byte for byte.
 */
export function insertTeamSections(text: string, sections: readonly TeamSection[] | undefined): string {
  if (sections === undefined || sections.length === 0) return text;
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
