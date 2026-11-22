// Phase 8.5 D-01, D-08 to D-12, R-3: the one definition of the read-time line checks for product text (accord/product/conventions.md).
// Delivery (the briefs, packages and related files built in assemble.ts), `accord lint` (lint.conventions-file), `accord conventions write`, the `accord upgrade`
// listing and the `--fix` findings file of 08.5-03 all call it, so a line is judged the same way wherever it is read. Pure: no I/O, no `node:` import.
import type { Finding } from '../model/finding.js';
import type { RepoSnapshot } from '../model/snapshot.js';

export const CONVENTIONS_FILE = 'accord/product/conventions.md';
/** D-10: a line is at most this many UTF-16 code units, measured before any expression runs on it. */
export const PRODUCT_MAX_LINE = 300;

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
const LETTER_OR_MARK = /^[\p{L}\p{M}]$/u;
const MARKER = /^(?:>[ \t]*|(?:[-*+]|\d+[.)])\s+)/;

/** The line as the prefix check reads it: leading whitespace gone, then repeatedly one blockquote marker or one list marker with the whitespace after it. */
function stripMarkers(line: string): string {
  let s = line.replace(/^\s+/, '');
  for (let m = MARKER.exec(s); m !== null; m = MARKER.exec(s)) s = s.slice(m[0].length);
  return s;
}

const verdict = (kind: LineProblemKind, reason: string, fix: string): LineVerdict => ({ kind, reason, fix });

/**
 * D-01: why `line` may not be delivered, or undefined when it may. Checked in this order: length (before any expression runs, so every later check is bounded to 300
 * code units), bidi control or tag character (each named), any other hidden character (U+200C and U+200D stay between two letters or marks), a reserved prefix, a reserved
 * heading. The reasons name a code point and never quote the line.
 */
export function lineProblem(line: string): LineVerdict | undefined {
  if (line.length > PRODUCT_MAX_LINE) return verdict('length', `is over ${PRODUCT_MAX_LINE} characters`, `split it into lines of at most ${PRODUCT_MAX_LINE} characters`);
  const cps = Array.from(line, (c) => c.codePointAt(0) as number);
  const bidi = cps.find(isBidi);
  if (bidi !== undefined) return verdict('bidi', `holds a bidi control character (${HEX(bidi)})`, `delete the character (${HEX(bidi)}) or retype the line`);
  const tag = cps.find(isTag);
  if (tag !== undefined) return verdict('tag', `holds a tag character (${HEX(tag)})`, `delete the character (${HEX(tag)}) or retype the line`);
  for (let i = 0; i < cps.length; i++) {
    if (!HIDDEN.test(String.fromCodePoint(cps[i]))) continue;
    const joiner = cps[i] === 0x200c || cps[i] === 0x200d;
    const flanked = i > 0 && i < cps.length - 1 && LETTER_OR_MARK.test(String.fromCodePoint(cps[i - 1])) && LETTER_OR_MARK.test(String.fromCodePoint(cps[i + 1]));
    if (joiner && flanked) continue;
    return verdict('hidden', `holds a control or invisible character (${HEX(cps[i])})`, `delete the character (${HEX(cps[i])}) or retype the line`);
  }
  const bare = stripMarkers(line).toLowerCase();
  const prefix = RESERVED_PREFIXES.find((p) => bare.startsWith(p.toLowerCase()));
  if (prefix !== undefined) return verdict('reserved', `starts with "${prefix}", a line accord itself writes`, 'reword the line so it does not start that way');
  const heading = line.trim().replace(/\s+/g, ' ').toLowerCase();
  const whole = RESERVED_HEADINGS.find((h) => heading === h.toLowerCase());
  if (whole !== undefined) return verdict('reserved', `reads as the heading "${whole}", which accord itself writes`, 'reword the line so it does not read as that heading');
  const start = HEADING_PREFIXES.find((h) => heading.startsWith(h.toLowerCase()));
  if (start !== undefined) return verdict('reserved', `reads as the heading "${start.trim()}", which accord itself writes`, 'reword the line so it does not read as that heading');
  if (TASK_HEADING.test(heading)) return verdict('reserved', 'reads as the heading "## Task <n>:", which accord itself writes', 'reword the line so it does not read as that heading');
  return undefined;
}

const UNCLOSED = verdict('unclosed-comment', 'opens an HTML comment that never closes', 'close the comment with --> or delete the <!--');

/**
 * The visible text of each line with HTML comments removed, line numbers kept, as `stripHtmlComments` (load/sections.ts) removes closed comments. It differs in one case:
 * a `<!--` that never closes would swallow every later line, so it is not a comment here: its own line is reported in `unclosed` (and withheld) and every line after it
 * is read again from the start (P7), so one hostile `<!--` cannot hide the rules below it.
 */
function visibleLines(raw: readonly string[]): { visible: string[]; unclosed: Set<number> } {
  const visible: string[] = new Array<string>(raw.length).fill('');
  const unclosed = new Set<number>();
  let from = 0;
  while (from < raw.length) {
    let inside = false;
    let openedAt = from;
    const out: string[] = [];
    for (let i = from; i < raw.length; i++) {
      let text = '';
      let rest = raw[i];
      while (rest.length > 0) {
        if (inside) {
          const end = rest.indexOf('-->');
          if (end < 0) rest = '';
          else {
            rest = rest.slice(end + 3);
            inside = false;
          }
        } else {
          const start = rest.indexOf('<!--');
          if (start < 0) {
            text += rest;
            rest = '';
          } else {
            text += rest.slice(0, start);
            rest = rest.slice(start + 4);
            inside = true;
            openedAt = i;
          }
        }
      }
      out.push(text);
    }
    if (!inside) {
      out.forEach((t, k) => (visible[from + k] = t));
      break;
    }
    for (let i = from; i < openedAt; i++) visible[i] = out[i - from];
    unclosed.add(openedAt);
    from = openedAt + 1;
  }
  return { visible, unclosed };
}

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
export function checkProductText(text: string): { lines: ProductLine[]; problems: LineProblem[] } {
  const raw = (text.startsWith(BOM) ? text.slice(1) : text).split(/\r\n|\r|\n/);
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
    const kept = shown.replace(/[ \t]+$/, '');
    if (kept === '') return;
    const found = lineProblem(kept);
    if (found === undefined) lines.push({ line, text: kept, withheld: false });
    else {
      lines.push({ line, text: '', withheld: true });
      problems.push({ line, ...found });
    }
  });
  return { lines, problems };
}

/** D-09: what stands in the place of a refused line; it never quotes the line. */
export const withheldLine = (file: string, n: number): string => `(accord withheld line ${n} of ${file}: it breaks a delivery rule; run accord lint)`;
/** The same for the findings file of `accord brief --fix` (08.5-03); it has no name a person can open. */
export const withheldFindingLine = (n: number): string => `(accord withheld line ${n} of the findings file: it breaks a delivery rule)`;
/** D-01: what stands in the place of a file that is a link or not a regular file; it names no byte of the target. */
export const notReadLine = (file: string): string => `(accord did not read ${file}: it is a link or not a regular file)`;

/** The lint check of `lint.conventions-file` (D-09, D-11, R-4): one draft per unsafe line of the whole file, at its line, no claim cut-off. An absent file has none. */
export function conventionsFile(snapshot: RepoSnapshot): Omit<Finding, 'level' | 'rule'>[] {
  if (!Object.hasOwn(snapshot.files, CONVENTIONS_FILE)) return [];
  return checkProductText(snapshot.files[CONVENTIONS_FILE]).problems.map((p) => ({
    file: CONVENTIONS_FILE,
    line: p.line,
    reason: `${p.reason}, so accord withholds it from every agent - fix: ${p.fix}`,
  }));
}
