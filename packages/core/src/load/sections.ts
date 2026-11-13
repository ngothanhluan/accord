// D-39 heading normalisation, D-40 duplicate headings, D-41 EARS lines; STACK Decision 4 fence-aware scanner.
import type { LoadFinding } from '../model/finding.js';
import type { Line, Section } from '../model/snapshot.js';

export interface Fence {
  info: string; // the info string after the opening fence, trimmed: 'gherkin'
  open: number; // Markdown line of the opening fence
  close: number; // Markdown line of the closing fence, or the last body line when unterminated
  content: Line[]; // every line between the fences
  quoted?: true; // opened inside a block quote: only fencedBlocks sets it, and only plan tasks read it
}

/** Case-insensitive, whitespace-collapsed heading identity (D-39). */
export function headingKey(heading: string): string {
  return heading.trim().replace(/\s+/g, ' ').toLowerCase();
}

const D07_KEYS = new Set(['intent', 'requirements', 'acceptance criteria', 'open questions', 'plan']);
// Spec §4: a ticket with `lane:` also tracks its four owner headings; a ticket without keeps the 0.1.0 set.
const LANE_KEYS = new Set([...D07_KEYS, 'vetoes', 'decisions', 'corrections', 'approach', 'understood', 'done when']);

/** Identity for ticket sections: one of the five D-07 headings, or undefined when untracked. */
export const d07Key = (s: Section): string | undefined => {
  const k = headingKey(s.heading);
  return D07_KEYS.has(k) ? k : undefined;
};

/** Identity for lane-ticket sections: a D-07 heading or a lane heading, or undefined when untracked. */
export const laneKey = (s: Section): string | undefined => {
  const k = headingKey(s.heading);
  return LANE_KEYS.has(k) ? k : undefined;
};

const FENCE_OPEN = /^(`{3,}|~{3,})(.*)$/;
const HEADING = /^##\s+(.*)$/;

/**
 * Split `body` into `## ` sections and fenced blocks. Headings count only at column 0 outside a
 * fence; `###` sub-headings and fences belong to the enclosing section. Lines before the first
 * `## ` heading are not stored. A trailing newline does not produce a phantom empty line.
 */
export function scan(body: string, bodyOffset: number): { sections: Section[]; fences: Fence[] } {
  const raw = body.split('\n');
  if (raw.length > 0 && raw[raw.length - 1] === '') raw.pop();
  const sections: Section[] = [];
  const fences: Fence[] = [];
  let current: Section | undefined;
  let fence: { marker: string; fence: Fence } | undefined;

  for (let i = 0; i < raw.length; i++) {
    const line = bodyOffset + i + 1;
    const text = raw[i];
    if (fence) {
      // Closing fence: the same character, at least the opener's length, then only whitespace.
      const close = /^(`{3,}|~{3,})\s*$/.exec(text);
      if (close && close[1][0] === fence.marker[0] && close[1].length >= fence.marker.length) {
        fence.fence.close = line;
        fence = undefined;
      } else {
        fence.fence.content.push({ line, text });
        fence.fence.close = line;
      }
      current?.lines.push({ line, text });
      continue;
    }
    const open = FENCE_OPEN.exec(text);
    // CommonMark: a backtick fence's info string may not contain a backtick.
    if (open && !(open[1][0] === '`' && open[2].includes('`'))) {
      const f: Fence = { info: open[2].trim(), open: line, close: line, content: [] };
      fences.push(f);
      fence = { marker: open[1], fence: f };
      current?.lines.push({ line, text });
      continue;
    }
    const h = HEADING.exec(text);
    if (h) {
      current = { heading: h[1].replace(/\s+#+\s*$/, '').trim(), line, lines: [] };
      sections.push(current);
      continue;
    }
    current?.lines.push({ line, text });
  }
  return { sections, fences };
}

/** D-40: the second section with the same identity is an error; the first is used. */
export function duplicateHeadings(
  file: string,
  sections: Section[],
  keyOf: (section: Section) => string | undefined,
): LoadFinding[] {
  const seen = new Set<string>();
  const findings: LoadFinding[] = [];
  for (const section of sections) {
    const k = keyOf(section);
    if (k === undefined) continue;
    if (seen.has(k)) {
      findings.push({
        file,
        line: section.line,
        rule: 'load.heading-duplicate',
        reason: `duplicate heading "## ${section.heading}"; the first occurrence is used`,
      });
    } else {
      seen.add(k);
    }
  }
  return findings;
}

/** Remove single-line and multi-line HTML comments; line count and numbers are kept. */
export function stripHtmlComments(lines: Line[]): Line[] {
  let inside = false;
  return lines.map(({ line, text }) => {
    let out = '';
    let rest = text;
    while (rest.length > 0) {
      if (inside) {
        const end = rest.indexOf('-->');
        if (end < 0) {
          rest = '';
        } else {
          rest = rest.slice(end + 3);
          inside = false;
        }
      } else {
        const start = rest.indexOf('<!--');
        if (start < 0) {
          out += rest;
          rest = '';
        } else {
          out += rest.slice(0, start);
          rest = rest.slice(start + 4);
          inside = true;
        }
      }
    }
    return { line, text: out };
  });
}

export const LIST_MARKER = /^\s*(?:[-*+]|\d+\.)\s+/;

/** D-41: every non-blank line outside fences and comments, list marker stripped, with its line. */
export function requirementLines(section: Section, fences: Fence[]): Line[] {
  const inFence = (n: number) => fences.some((f) => n >= f.open && n <= f.close);
  return stripHtmlComments(section.lines.filter((l) => !inFence(l.line)))
    .filter((l) => !/^#{1,6}\s/.test(l.text))
    .map((l) => ({ line: l.line, text: l.text.replace(LIST_MARKER, '').trim() }))
    .filter((l) => l.text !== ''); // after the marker: a bullet with no text is not a requirement
}

// A block opens on any line whose first non-blank characters, after any block-quote markers and list markers, are a run of three backticks or
// tildes: a fence on a list item's marker line or in a block quote is still a fence here, so a plan task cannot hold code by nesting it (a false
// reading refuses and names the line it opens on). One quote level or list marker is stripped per pass, up to a few levels.
const QUOTE_PREFIX = /^[ \t]*>[ \t]?/;
const ITEM_PREFIX = /^[ \t]*(?:[-*+]|\d+[.)])[ \t]+/;
const FENCE_RUN = /^[ \t]*(`{3,}|~{3,})(.*)$/;
const BLOCK_CLOSE = /^[ \t]*(`{3,}|~{3,})\s*$/;

/** The fence a line opens, if any: its marker run, its info string and whether a block-quote marker precedes it. */
function opening(text: string): { marker: string; info: string; quoted: boolean } | undefined {
  let rest = text;
  let quoted = false;
  for (let i = 0; i < 8; i++) {
    const q = QUOTE_PREFIX.exec(rest);
    const m = q ?? ITEM_PREFIX.exec(rest);
    if (m === null) break;
    if (q !== null) quoted = true;
    rest = rest.slice(m[0].length);
  }
  const m = FENCE_RUN.exec(rest);
  // CommonMark: a backtick fence's info string may not contain a backtick.
  if (m === null || (m[1][0] === '`' && m[2].includes('`'))) return undefined;
  return { marker: m[1], info: m[2].trim(), quoted };
}

/** The closing run of a line inside a fence; a fence opened in a block quote closes on a line that carries the quote markers too. */
function closing(text: string, quoted: boolean): RegExpExecArray | null {
  let rest = text;
  if (quoted) while (QUOTE_PREFIX.test(rest)) rest = rest.replace(QUOTE_PREFIX, '');
  return BLOCK_CLOSE.exec(rest);
}

/**
 * ST-LN-91 D-09, WR-01, WR-02: the fenced blocks of a plan task, read as `accord brief` prints the task: the lines as written. An HTML comment hides
 * nothing: a fence inside a comment is a fence, a comment mark in inline code opens nothing, and every comment line counts toward the length. A
 * comment delimiter inside a fence is code. `quoted` marks a block inside a block quote, which a plan task may not hold. An unterminated block
 * closes at the last line.
 */
export function fencedBlocks(lines: Line[]): Fence[] {
  const fences: Fence[] = [];
  let open: { marker: string; quoted: boolean; fence: Fence } | undefined;
  for (const { line, text } of lines) {
    if (open) {
      const close = closing(text, open.quoted);
      if (close && close[1][0] === open.marker[0] && close[1].length >= open.marker.length) {
        open.fence.close = line;
        open = undefined;
      } else {
        open.fence.content.push({ line, text });
        open.fence.close = line;
      }
      continue;
    }
    const m = opening(text);
    if (m) {
      const fence: Fence = { info: m.info, open: line, close: line, content: [], ...(m.quoted ? { quoted: true as const } : {}) };
      fences.push(fence);
      open = { marker: m.marker, quoted: m.quoted, fence };
    }
  }
  return fences;
}
