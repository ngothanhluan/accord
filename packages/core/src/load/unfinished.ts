// ST-LN-72 D-11: the fixed line a planner, verifier or debugger leaves in a file it is still writing. Read on the raw text, never through the section readers,
// which strip HTML comments and would hide it. Pure: no node import.
import { normaliseText } from './frontmatter.js';
import { headingKey, scan } from './sections.js';

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
 * The one definition of an open debug episode, read by the marker reader below, by the pre-tool-use hook and worded the same in the debug skill and resume.md: an episode is open while no `## Resolved`
 * heading follows the last `## Episode <n>` heading (a heading inside a fence is no heading). A later heading after `## Resolved` (a `## Fixes`) does not reopen it; a new `## Episode` opens a new one. A
 * record with no `## ` heading at all is not open, and one with headings but no episode heading is open until some `## Resolved`. Returns the index of that last episode's section in `sections` (-1 when none), or undefined when it is closed.
 */
const openEpisode = (sections: readonly { heading: string }[]): number | undefined => {
  let last = -1;
  sections.forEach((s, i) => {
    if (/^episode\b/i.test(headingKey(s.heading))) last = i;
  });
  if (sections.length === 0) return undefined;
  return sections.slice(last + 1).some((s) => headingKey(s.heading) === 'resolved') ? undefined : last;
};

/** True when a debug.md text has an open episode (openEpisode's definition). */
export const debugOpen = (text: string): boolean => openEpisode(scan(normaliseText(text), 0).sections) !== undefined;

/**
 * The 1-based line of UNFINISHED_MARKER in a debug.md when the episode still open is one the debugger has not finished: the first non-blank line under the last `## Episode <n>` heading
 * (outside a fence) of an open episode (debugOpen's definition). Earlier episodes are never read, so a finished episode's text stays above the one being written. debug.md has no frontmatter.
 * undefined otherwise.
 */
export function unfinishedEpisode(text: string): number | undefined {
  const { sections } = scan(normaliseText(text), 0);
  const last = openEpisode(sections);
  if (last === undefined || last < 0) return undefined;
  const first = sections[last].lines.find((l) => l.text.trim() !== '');
  return first !== undefined && first.text.trim() === UNFINISHED_MARKER ? first.line : undefined;
}
