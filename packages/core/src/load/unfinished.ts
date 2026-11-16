// ST-LN-72 D-11: the fixed line a planner, verifier or debugger leaves in a file it is still writing. Read on the raw text, never through the section readers,
// which strip HTML comments and would hide it. Pure: no node import.
import { normaliseText } from './frontmatter.js';
import { scan } from './sections.js';

/** The not-finished marker: alone on its line in the body, which a writer puts right after the frontmatter's closing `---`. The writer removes it as its last step. */
export const UNFINISHED_MARKER = '<!-- accord: unfinished -->';

/**
 * The 1-based line of UNFINISHED_MARKER in `body`, the part of a file after its frontmatter that the loader already split (`bodyOffset` lines precede it): the first body line that is the marker
 * once trimmed and lies outside every fenced code block (``` or ~~~, the fences of the section scanner); undefined otherwise. It fails closed (ST-LN-72 review round 2): a heading or a paragraph
 * before the marker does not hide it, so a half-written file cannot pass a gate. Only a quote inside a fence (pasted test output, a plan's example) is evidence rather than a flag. The marker in the
 * frontmatter is a YAML comment, never a body line. The body is normalised already (no BOM, LF), so a CRLF file reads as an LF one.
 */
export function unfinishedLine(body: string, bodyOffset = 0): number | undefined {
  const quoted = new Set<number>();
  for (const f of scan(body, bodyOffset).fences) for (let n = f.open; n <= f.close; n++) quoted.add(n);
  const i = body.split('\n').findIndex((l, k) => l.trim() === UNFINISHED_MARKER && !quoted.has(bodyOffset + k + 1));
  return i >= 0 ? bodyOffset + i + 1 : undefined;
}

/**
 * The 1-based line of UNFINISHED_MARKER in a debug.md when the episode still open is one the debugger has not finished: the first non-blank line under the last `## Episode <n>` heading
 * (outside a fence), with no `## Resolved` heading after it (the debug stage's own definition of an open episode). Earlier episodes are never read, so a finished episode's text stays
 * above the one being written. debug.md has no frontmatter. undefined otherwise.
 */
export function unfinishedEpisode(text: string): number | undefined {
  const { sections } = scan(normaliseText(text), 0);
  let last = -1;
  sections.forEach((s, i) => {
    if (/^Episode\s+\d+\b/.test(s.heading)) last = i;
  });
  if (last < 0 || sections.slice(last + 1).some((s) => s.heading === 'Resolved')) return undefined;
  const first = sections[last].lines.find((l) => l.text.trim() !== '');
  return first !== undefined && first.text.trim() === UNFINISHED_MARKER ? first.line : undefined;
}
