// D-39 heading normalisation, D-40 duplicate headings, D-41 EARS lines; STACK Decision 4 fence-aware scanner.
import type { LoadFinding } from '../model/finding.js';
import type { Line, Section } from '../model/snapshot.js';

export interface Fence {
  info: string; // the info string after the opening fence, trimmed: 'gherkin'
  open: number; // Markdown line of the opening fence
  close: number; // Markdown line of the closing fence, or the last body line when unterminated
  content: Line[]; // every line between the fences
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

// ST-LN-91 D-09, group 2 round 3 (the owner's decision, 2026-11-14): a plan task holds an interfaces block in one form only, and the reader models no
// CommonMark container. The block opens on a line that is exactly ```interfaces at column 0 and ends at the first following line that is exactly ``` at
// column 0, trailing spaces, tabs and a carriage return allowed. Any other line that is fence-like is refused: one that, after any mix of leading spaces,
// tabs, `>` quote marks and list markers (`-`, `*`, `+`, `1.`, `1)`, with or without the space after them), starts with three or more backticks or tildes.
const INTERFACES_OPEN = /^```interfaces[ \t\r]*$/;
const INTERFACES_CLOSE = /^```[ \t\r]*$/;
const FENCE_LIKE = /^((?:[ \t>]|[-*+]|[0-9]+[.)])*)(`{3,}|~{3,})(.*)$/;

/** A line of a plan task that the one interfaces block form does not allow. */
export interface FenceLine {
  line: number; // Markdown line of the refused line: for `unclosed`, the opening line of the interfaces block no line closes
  kind: 'fence' | 'inside' | 'unclosed'; // a fence-like line outside the block, one inside it (`from` names its opening line), or a block left open
  info: string; // what follows the run of backticks or tildes, trimmed
  quoted: boolean; // a `>` precedes the run
  from?: number; // for `inside`: the opening line of the interfaces block the line sits in
}

/** Whether a fence-like line is quoted, and what follows its run; undefined when the line is not fence-like. */
const fenceLike = (text: string): { quoted: boolean; info: string } | undefined => {
  const m = FENCE_LIKE.exec(text);
  return m === null ? undefined : { quoted: m[1].includes('>'), info: m[3].trim() };
};

/**
 * ST-LN-91 D-09: the interfaces blocks of a plan task and every line the one accepted form does not allow, read from the lines as `accord brief` prints
 * them: an HTML comment hides nothing, and a comment delimiter inside the block is part of it. `blocks` holds each accepted block, opening and closing
 * line; `refused` every other fence-like line, in line order, an interfaces block that no line closes named at its opening line.
 */
export function taskBlocks(lines: Line[]): { blocks: { open: number; close: number }[]; refused: FenceLine[] } {
  const blocks: { open: number; close: number }[] = [];
  const refused: FenceLine[] = [];
  let open: number | undefined;
  for (const { line, text } of lines) {
    if (open !== undefined && INTERFACES_CLOSE.test(text)) {
      blocks.push({ open, close: line });
      open = undefined;
      continue;
    }
    if (open === undefined && INTERFACES_OPEN.test(text)) {
      open = line;
      continue;
    }
    const f = fenceLike(text);
    if (f !== undefined) refused.push({ line, kind: open === undefined ? 'fence' : 'inside', ...f, ...(open === undefined ? {} : { from: open }) });
  }
  if (open !== undefined) refused.push({ line: open, kind: 'unclosed', info: 'interfaces', quoted: false });
  return { blocks, refused: refused.sort((a, b) => a.line - b.line) };
}
