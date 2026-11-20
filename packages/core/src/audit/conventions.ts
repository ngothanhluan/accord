// Phase 8.1 G3a (D-08, D-09, D-11): what a repository's conventions file holds, and the one text `accord audit` prints.
// Pure: the CLI reads accord/product/conventions.md and gives the text here; nothing here touches a file.
import { stripHtmlComments } from '../load/sections.js';
import type { Line } from '../model/snapshot.js';

/** CONTEXT Ruling "What empty means": a file with fewer convention lines than this is thin. */
export const CONVENTIONS_THIN = 5;

const BOM = new RegExp('^' + String.fromCharCode(0xfeff));
const HEADING =/^#{1,6}(?:\s|$)/;
const MARKER = /^(?:[-*+]|\d+\.)\s+/;
const REJECTED = /^(?:(?:[-*+]|\d+\.)\s+)?Rejected:/;

/**
 * The convention lines of the file: every line that is not blank, not a heading, not inside an HTML comment and not a `Rejected:` line (a list
 * marker is allowed before it), with the list marker dropped. A byte order mark and CRLF are read away first.
 */
export function conventionLines(text: string): string[] {
  const lines: Line[] = text
    .replace(BOM, '')
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((t, i) => ({ line: i + 1, text: t }));
  const out: string[] = [];
  for (const { text: raw } of stripHtmlComments(lines)) {
    const t = raw.trim();
    if (t === '' || HEADING.test(t) || REJECTED.test(t)) continue;
    out.push(t.replace(MARKER, ''));
  }
  return out;
}

/** True when the file holds no convention line (D-11). */
export function conventionsEmpty(text: string): boolean {
  return conventionLines(text).length === 0;
}

/** One thing the audit found out about the repository without a model: `fact: <name>: <value>`. */
export interface AuditFact {
  name: string;
  value: string;
}

/** One thing the repository lacks, with the one command or concrete step that fixes it: `gap: <id>: <text> - fix: <fix>`. */
export interface AuditGap {
  id: string;
  text: string;
  fix: string;
}

/** The audit report (Ruling "audit output"): the facts, then the gaps, then `gaps: <n>` last. Callers pass values already made printable. */
export function auditLines(facts: readonly AuditFact[], gaps: readonly AuditGap[]): string {
  return [...facts.map((f) => `fact: ${f.name}: ${f.value}`), ...gaps.map((g) => `gap: ${g.id}: ${g.text} - fix: ${g.fix}`), `gaps: ${gaps.length}`].join('\n') + '\n';
}
