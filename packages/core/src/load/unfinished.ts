// ST-LN-72 D-11: the fixed line a planner, verifier or debugger leaves in a file it is still writing. Read on the raw text, never through the section readers,
// which strip HTML comments and would hide it. Pure: no node import.
import { normaliseText, splitFrontmatter } from './frontmatter.js';
import { scan } from './sections.js';

/** The not-finished marker: alone on its line, the first body line right after the frontmatter's closing `---`. The writer removes it as its last step. */
export const UNFINISHED_MARKER = '<!-- accord: unfinished -->';

/**
 * The 1-based line of UNFINISHED_MARKER in `text` when it is the first non-blank line of the body (the lines after the frontmatter's closing `---`, or the whole text when there is no
 * frontmatter), once the BOM and CRLF are normalised and the line is trimmed; undefined otherwise. Only that line counts (ST-LN-72 review round 1): the marker quoted as a whole line lower down,
 * in a fence or in pasted evidence, is not a flag, and the marker inside the frontmatter is a YAML comment. Blank lines before it are skipped, so a stray one cannot hide a flag.
 */
export function unfinishedLine(text: string): number | undefined {
  const { body, bodyOffset } = splitFrontmatter(text);
  const lines = body.split('\n');
  const i = lines.findIndex((l) => l.trim() !== '');
  return i >= 0 && lines[i].trim() === UNFINISHED_MARKER ? bodyOffset + i + 1 : undefined;
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
