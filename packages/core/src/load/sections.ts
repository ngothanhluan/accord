// D-39 heading normalisation, D-40 duplicate headings, D-41 EARS lines; STACK Decision 4 fence-aware scanner.
import type { Finding } from '../model/finding.js';
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

/** Identity for ticket sections: one of the five D-07 headings, or undefined when untracked. */
export const d07Key = (s: Section): string | undefined => {
  const k = headingKey(s.heading);
  return D07_KEYS.has(k) ? k : undefined;
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
): Finding[] {
  const seen = new Set<string>();
  const findings: Finding[] = [];
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

const LIST_MARKER = /^\s*(?:[-*+]|\d+\.)\s+/;

/** D-41: every non-blank line outside fences and comments, list marker stripped, with its line. */
export function requirementLines(section: Section, fences: Fence[]): Line[] {
  const inFence = (n: number) => fences.some((f) => n >= f.open && n <= f.close);
  return stripHtmlComments(section.lines.filter((l) => !inFence(l.line)))
    .filter((l) => !/^#{1,6}\s/.test(l.text))
    .map((l) => ({ line: l.line, text: l.text.replace(LIST_MARKER, '').trim() }))
    .filter((l) => l.text !== ''); // after the marker: a bullet with no text is not a requirement
}
