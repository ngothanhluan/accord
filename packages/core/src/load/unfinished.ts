// ST-LN-72 D-11: the fixed line a planner, verifier or debugger leaves in a file it is still writing. Read on the raw text, never through the section readers,
// which strip HTML comments and would hide it. Pure: no node import.
import { normaliseText } from './frontmatter.js';

/** The not-finished marker: alone on its line, the first body line right after the frontmatter's closing `---`. The writer removes it as its last step. */
export const UNFINISHED_MARKER = '<!-- accord: unfinished -->';

/**
 * The 1-based line of the first line of `text` that equals UNFINISHED_MARKER once the BOM and CRLF are normalised and the line is trimmed; undefined when no line does.
 * Anywhere in the file counts (a marker left lower down is still an unfinished file, so refusing it fails closed); the marker quoted inside a sentence is not a whole line.
 */
export function unfinishedLine(text: string): number | undefined {
  const lines = normaliseText(text).split('\n');
  for (let i = 0; i < lines.length; i++) if (lines[i].trim() === UNFINISHED_MARKER) return i + 1;
  return undefined;
}
