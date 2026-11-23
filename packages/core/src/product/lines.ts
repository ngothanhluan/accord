// Phase 8.5 D-01, D-08 to D-12, R-3: the one definition of the read-time line checks for product text (accord/product/conventions.md).
// Delivery (the briefs, packages and related files built in assemble.ts), `accord lint` (lint.conventions-file), `accord conventions write`, the `accord upgrade`
// listing and the `--fix` findings file of 08.5-03 all call it, so a line is judged the same way wherever it is read. Pure: no I/O, no `node:` import.
import type { Finding } from '../model/finding.js';
import type { Line, RepoSnapshot } from '../model/snapshot.js';

export const CONVENTIONS_FILE = 'accord/product/conventions.md';
/** D-10: a line is at most this many UTF-16 code units, measured before any expression runs on it. */
export const PRODUCT_MAX_LINE = 300;
/** Review 08.5 WR-01: a finding, a pasted pull request comment or a CI log line is longer than a convention rule, so the findings file of `--fix` is judged at this length. */
export const FINDING_MAX_LINE = 4000;
/** Phase 08.8 D-05: ticket Vetoes and Decisions are longer than a convention rule (this repository holds 681 such lines, 173 over 300 and none over 4000), so ticket text is judged at the findings length. */
export const TICKET_MAX_LINE = FINDING_MAX_LINE;

/** D-01 and R-3: the line starts the CLI itself writes in a brief, in the order D-01 then R-3 list them; matched case-insensitively after whitespace, blockquote and list markers. */
export const RESERVED_PREFIXES = ['Work dir:', 'Report file:', 'Test command:', '---', 'Commit rule:', 'Example that passes:', 'Test only:'] as const;
/** The fixed block headings accord writes, matched whole; a line reading one forges a block. */
export const RESERVED_HEADINGS = ['# accord rules', '## Conventions', '## Product files changed', '## Rejected', '## Findings'] as const;
/** Heading starts with a variable tail: the related-ticket block and the epic block. The task heading `## Task <n>:` is matched by its own shape. */
const HEADING_PREFIXES = ['# Related tickets of ', '## Epic '] as const;
const TASK_HEADING = /^## task \d+:/;

export type LineProblemKind = 'length' | 'bidi' | 'tag' | 'hidden' | 'reserved' | 'unclosed-comment';
export interface LineVerdict {
  kind: LineProblemKind;
  /** What is wrong with the line, never quoting the line or a hidden character in it (a code point is named as U+XXXX). */
  reason: string;
  fix: string;
}
export interface LineProblem extends LineVerdict {
  line: number;
}

const BOM = String.fromCharCode(0xfeff);
const HEX = (cp: number): string => 'U+' + cp.toString(16).toUpperCase().padStart(4, '0');
const isBidi = (cp: number): boolean => cp === 0x061c || cp === 0x200e || cp === 0x200f || (cp >= 0x202a && cp <= 0x202e) || (cp >= 0x2066 && cp <= 0x2069);
const isTag = (cp: number): boolean => cp >= 0xe0000 && cp <= 0xe007f;
/** The writer's class (`accord conventions write` refused it first): control, format, line and paragraph separators; TAB is a control character and is refused. */
const HIDDEN = /^[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]$/u;
/** Review 08.5 WR-03: invisible carriers outside that class: variation selectors, the combining grapheme joiner, the Hangul fillers and the Braille blank. */
const CARRIER = /^[\u{FE00}-\u{FE0F}\u{E0100}-\u{E01EF}\u{034F}\u{115F}\u{1160}\u{3164}\u{FFA0}\u{2800}]$/u;
const LETTER_OR_MARK = /^[\p{L}\p{M}]$/u;
const EMOJI_BASE = /^[\p{Extended_Pictographic}0-9#*]$/u;
const isSelector = (cp: number): boolean => (cp >= 0xfe00 && cp <= 0xfe0f) || (cp >= 0xe0100 && cp <= 0xe01ef);
const isEmojiSelector = (cp: number): boolean => cp === 0xfe0e || cp === 0xfe0f;
const joiner = (cp: number): boolean => cp === 0x200c || cp === 0x200d;

/**
 * Review 08.5 CR-01: a line as a reader reads it, for the reserved-start comparisons only: compatibility-normalised (a full-width letter is its plain form), the joiners dropped (the hidden
 * check lets them stand inside a word), every run of whitespace of any kind one space, a space before a colon gone, lower case. Called on a line of at most 300 code units.
 */
const fold = (s: string): string => s.normalize('NFKC').replace(/[\u200c\u200d]/g, '').replace(/[\p{Z}\s]+/gu, ' ').replace(/ :/g, ':').toLowerCase();
/** What may stand before a reserved start without changing how it reads: blockquote, list, heading, emphasis, code and quote marks and brackets, and whitespace. The alternatives start with different characters. */
const WRAPPERS = /^(?:[>*_~`#"'([]|[-+]\s|\d+[.)]\s|\s)+/;

/** The folded line without its leading wrappers: the text a prefix such as `work dir:` is looked for at the start of. */
const unwrapped = (line: string): string => {
  const f = fold(line);
  const m = WRAPPERS.exec(f);
  return m === null ? f : f.slice(m[0].length);
};

/**
 * The folded line as a heading reads: quote and list marks and emphasis marks gone, `#` marks separated from the text by one space, closing `#` marks gone, one space between words.
 * A line that is no heading comes out as its own words, so it is compared whole against the reserved headings.
 */
const headingOf = (line: string): string =>
  fold(line)
    .replace(/[*_~`]/g, '')
    .replace(/^(?:[>\s]|[-+]\s)+/, '')
    .replace(/^(#{1,6})\s*/, '$1 ')
    .replace(/[\s#]+$/, '')
    .replace(/\s+/g, ' ')
    .trim();

const verdict = (kind: LineProblemKind, reason: string, fix: string): LineVerdict => ({ kind, reason, fix });

/** The first code point of `cps` that is hidden by the rules of D-01: a control, format, separator or carrier character; U+200C and U+200D between two letters or marks and one emoji selector after an emoji do not count. */
function hiddenAt(cps: readonly number[]): number | undefined {
  for (let i = 0; i < cps.length; i++) {
    const c = String.fromCodePoint(cps[i]);
    if (!HIDDEN.test(c) && !CARRIER.test(c)) continue;
    const flanked = i > 0 && i < cps.length - 1 && LETTER_OR_MARK.test(String.fromCodePoint(cps[i - 1])) && LETTER_OR_MARK.test(String.fromCodePoint(cps[i + 1]));
    if (joiner(cps[i]) && flanked) continue;
    const emoji = isEmojiSelector(cps[i]) && i > 0 && EMOJI_BASE.test(String.fromCodePoint(cps[i - 1])) && (i === cps.length - 1 || !isSelector(cps[i + 1]));
    if (emoji) continue;
    return cps[i];
  }
  return undefined;
}

/**
 * D-01: why `line` may not be delivered, or undefined when it may. Checked in this order: length (before any expression runs, so every later check is bounded to 300
 * code units), bidi control or tag character (each named), any other hidden character (U+200C and U+200D stay between two letters or marks), a reserved prefix, a reserved
 * heading. The two reserved checks read the line folded as a reader reads it (CR-01). The reasons name a code point and never quote the line.
 */
export function lineProblem(line: string, maxLine: number = PRODUCT_MAX_LINE): LineVerdict | undefined {
  if (line.length > maxLine) return verdict('length', `is over ${maxLine} characters`, `split it into lines of at most ${maxLine} characters`);
  const cps = Array.from(line, (c) => c.codePointAt(0) as number);
  const bidi = cps.find(isBidi);
  if (bidi !== undefined) return verdict('bidi', `holds a bidi control character (${HEX(bidi)})`, `delete the character (${HEX(bidi)}) or retype the line`);
  const tag = cps.find(isTag);
  if (tag !== undefined) return verdict('tag', `holds a tag character (${HEX(tag)})`, `delete the character (${HEX(tag)}) or retype the line`);
  const hidden = hiddenAt(cps);
  if (hidden !== undefined) return verdict('hidden', `holds a control or invisible character (${HEX(hidden)})`, `delete the character (${HEX(hidden)}) or retype the line`);
  const bare = unwrapped(line);
  const prefix = RESERVED_PREFIXES.find((p) => bare.startsWith(fold(p)));
  if (prefix !== undefined) return verdict('reserved', `starts with "${prefix}", a line accord itself writes`, 'reword the line so it does not start that way');
  const heading = headingOf(line);
  const whole = RESERVED_HEADINGS.find((h) => heading === fold(h));
  if (whole !== undefined) return verdict('reserved', `reads as the heading "${whole}", which accord itself writes`, 'reword the line so it does not read as that heading');
  const start = HEADING_PREFIXES.find((h) => heading.startsWith(fold(h)));
  if (start !== undefined) return verdict('reserved', `reads as the heading "${start.trim()}", which accord itself writes`, 'reword the line so it does not read as that heading');
  if (TASK_HEADING.test(heading)) return verdict('reserved', 'reads as the heading "## Task <n>:", which accord itself writes', 'reword the line so it does not read as that heading');
  return undefined;
}

/** The line without its trailing spaces, tabs and carriage returns, found by one scan from the end (a regular expression for it is quadratic on a long run of spaces). */
export function trimLineEnd(s: string): string {
  let end = s.length;
  while (end > 0) {
    const c = s.charCodeAt(end - 1);
    if (c !== 0x20 && c !== 0x09 && c !== 0x0d) break;
    end--;
  }
  return end === s.length ? s : s.slice(0, end);
}

const UNCLOSED = verdict('unclosed-comment', 'opens an HTML comment that never closes', 'close the comment with --> or delete the <!--');

/**
 * The visible text of each line with HTML comments removed, line numbers kept, as `stripHtmlComments` (load/sections.ts) removes closed comments. It differs in one case:
 * a `<!--` that never closes would swallow every later line, so it is not a comment here: its own line is reported in `unclosed` (and withheld) and every line after it
 * is read again from the start (P7), so one hostile `<!--` cannot hide the rules below it. `commented` holds the lines that held a closed comment or a part of one, so a
 * reader that prints raw lines knows which ones to check as well as strip. One pass, linear in the size of the text: an opener closes if and only if a `-->` stands after it,
 * which the last `-->` of the file tells at once. Exported for the Rejected-line reader of tickets/related.ts and the legacy brief.
 */
export function visibleLines(raw: readonly string[]): { visible: string[]; unclosed: Set<number>; commented: Set<number> } {
  const visible: string[] = new Array<string>(raw.length).fill('');
  const unclosed = new Set<number>();
  const commented = new Set<number>();
  let lastLine = -1;
  let lastCol = -1;
  for (let i = raw.length - 1; i >= 0 && lastLine < 0; i--) {
    const at = raw[i].lastIndexOf('-->');
    if (at >= 0) {
      lastLine = i;
      lastCol = at;
    }
  }
  let inside = false;
  for (let i = 0; i < raw.length; i++) {
    const line = raw[i];
    let text = '';
    let pos = 0;
    while (pos < line.length) {
      if (inside) {
        const end = line.indexOf('-->', pos);
        commented.add(i);
        if (end < 0) break;
        pos = end + 3;
        inside = false;
      } else {
        const start = line.indexOf('<!--', pos);
        if (start < 0) {
          text += line.slice(pos);
          break;
        }
        text += line.slice(pos, start);
        // the opener closes when a `-->` stands at or after the end of the four characters that open it
        if (lastLine > i || (lastLine === i && lastCol >= start + 4)) {
          commented.add(i);
          inside = true;
          pos = start + 4;
        } else {
          // the opener's own line keeps the text before its `<!--`, so a reader can tell what the withheld line was about without ever printing it
          unclosed.add(i);
          break;
        }
      }
    }
    visible[i] = text;
  }
  return { visible, unclosed, commented };
}

const rawLines = (text: string): string[] => (text.startsWith(BOM) ? text.slice(1) : text).split(/\r\n|\r|\n/);

export interface ProductLine {
  /** The 1-based line of the file as written, so comment stripping keeps the numbering. */
  line: number;
  /** The visible text without trailing spaces and tabs; empty for a withheld line, whose text is never kept. */
  text: string;
  withheld: boolean;
}

/**
 * D-01, D-09: read the text of a product file. One BOM is dropped; CRLF, a lone CR and LF end a line; HTML comments are removed with the numbering kept; then each line that
 * is not blank (trailing spaces and tabs do not count) goes through `lineProblem`. `lines` holds the non-blank lines in order, a refused one with `withheld` true and no
 * text; `problems` holds one entry per refused line in line order. Delivery never fails on a refused line: it prints `withheldLine` in its place.
 */
export function checkProductText(text: string, options: { maxLine?: number } = {}): { lines: ProductLine[]; problems: LineProblem[] } {
  const maxLine = options.maxLine ?? PRODUCT_MAX_LINE;
  const raw = rawLines(text);
  const { visible, unclosed } = visibleLines(raw);
  const lines: ProductLine[] = [];
  const problems: LineProblem[] = [];
  visible.forEach((shown, i) => {
    const line = i + 1;
    if (unclosed.has(i)) {
      lines.push({ line, text: '', withheld: true });
      problems.push({ line, ...UNCLOSED });
      return;
    }
    const kept = trimLineEnd(shown);
    if (kept === '') return;
    const found = lineProblem(kept, maxLine);
    if (found === undefined) lines.push({ line, text: kept, withheld: false });
    else {
      lines.push({ line, text: '', withheld: true });
      problems.push({ line, ...found });
    }
  });
  return { lines, problems };
}

/** The first problem of a piece of a line that the comment marks cut it into; a blank piece has none. */
const firstSegmentProblem = (line: string): LineVerdict | undefined => {
  for (const part of line.split('<!--').flatMap((p) => p.split('-->'))) {
    const found = part.trim() === '' ? undefined : lineProblem(part);
    if (found !== undefined) return found;
  }
  return undefined;
};

/**
 * Review 08.5 CR-02: the lines of the file that hold a closed HTML comment, or part of one, and break a delivery rule as written. A comment never reaches a block that strips comments, but the
 * legacy brief prints raw lines, so a line is judged as it stands and again for each piece the comment marks cut it into, so the words inside a comment are read as text. One entry per
 * line, in line order; an unclosed opener is not here (checkProductText reports it).
 */
export function commentProblems(text: string): LineProblem[] {
  const raw = rawLines(text);
  const { commented, unclosed } = visibleLines(raw);
  const out: LineProblem[] = [];
  for (const i of [...commented].sort((a, b) => a - b)) {
    if (unclosed.has(i)) continue;
    const line = trimLineEnd(raw[i]);
    if (line === '') continue;
    const found = lineProblem(line) ?? (line.length > PRODUCT_MAX_LINE ? undefined : firstSegmentProblem(line));
    if (found !== undefined) out.push({ line: i + 1, ...found });
  }
  return out;
}

/** D-09: what stands in the place of a refused line; it never quotes the line. */
export const withheldLine = (file: string, n: number): string => `(accord withheld line ${n} of ${file}: it breaks a delivery rule; run accord lint)`;
/**
 * Phase 08.8 D-05: what stands in the place of a refused line of a ticket (an epic's or a related ticket's Vetoes, Decisions and lessons). Same position and form as `withheldLine`; only the repair
 * instruction differs, because no lint rule reports a ticket line, so "run accord lint" would send the reader to a command that finds nothing. It never quotes the line.
 */
export const withheldTicketLine = (file: string, n: number): string => `(accord withheld line ${n} of ${file}: it breaks a delivery rule; fix that line of the file)`;
/** The same for the findings file of `accord brief --fix` (08.5-03); it has no name a person can open. */
export const withheldFindingLine = (n: number): string => `(accord withheld line ${n} of the findings file: it breaks a delivery rule)`;
/** D-01: what stands in the place of a file that is a link or not a regular file; it names no byte of the target. */
export const notReadLine = (file: string): string => `(accord did not read ${file}: it is a link or not a regular file)`;

/** A title from a file anyone on the team wrote, on one line: every control, format (bidi marks, tag characters) and line or paragraph separator character becomes a space. */
export const printable = (text: string): string => text.replace(/[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/gu, ' ');

/**
 * Phase 08.8 D-05: the lines of one section of a ticket (an epic's or a related ticket's Vetoes and Decisions, a sibling's Epic lessons) as a subagent may read them, each through
 * `lineProblem` at `TICKET_MAX_LINE`. `lines` are the section's raw lines with their file line numbers; `file` is the ticket's repository path. A line with no comment is kept exactly as
 * written, one with a closed comment is kept without it; a blank line is dropped. A refused line, and a line holding a `<!--` that never closes, becomes `withheldTicketLine(file, <its file line>)`
 * in its place; every later line is read again from the start (P7, through `visibleLines`), so one hostile opener hides nothing after it.
 */
export function ticketLines(lines: readonly Line[], file: string): string[] {
  const raw = lines.map((l) => l.text);
  const { visible, unclosed } = visibleLines(raw);
  const out: string[] = [];
  raw.forEach((text, i) => {
    if (unclosed.has(i)) {
      out.push(withheldTicketLine(file, lines[i].line));
      return;
    }
    if (visible[i].trim() === '') return;
    // a line with a comment on it is kept without the comment; a line with none exactly as written
    const shown = visible[i] === text ? text : trimLineEnd(visible[i]);
    out.push(lineProblem(trimLineEnd(shown), TICKET_MAX_LINE) !== undefined ? withheldTicketLine(file, lines[i].line) : shown);
  });
  return out;
}

/** Every unsafe line of a conventions file in line order, one entry per line: what checkProductText refuses and what a comment hides from it. Lint and `accord upgrade` both list these. */
export function conventionsProblems(text: string): LineProblem[] {
  const problems = [...checkProductText(text).problems];
  for (const c of commentProblems(text)) if (!problems.some((p) => p.line === c.line)) problems.push(c);
  return problems.sort((a, b) => a.line - b.line);
}

/** The lint check of `lint.conventions-file` (D-09, D-11, R-4): one draft per unsafe line of the whole file, at its line, no claim cut-off. An absent file has none. */
export function conventionsFile(snapshot: RepoSnapshot): Omit<Finding, 'level' | 'rule'>[] {
  if (!Object.hasOwn(snapshot.files, CONVENTIONS_FILE)) return [];
  const text = snapshot.files[CONVENTIONS_FILE];
  return conventionsProblems(text).map((p) => ({
    file: CONVENTIONS_FILE,
    line: p.line,
    reason: `${p.reason}, so accord withholds it from every agent - fix: ${p.fix}`,
  }));
}
