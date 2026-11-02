// ST-LN-81: the scout's fixed reply form, parsed. Pure string rules, no node import (core purity); the host
// decides which files exist and what they hold, and `check.ts` judges the parsed report against those facts.
import { normaliseText } from '../load/frontmatter.js';
import { headingKey, LIST_MARKER, scan, stripHtmlComments } from '../load/sections.js';
import type { Line, Section } from '../model/snapshot.js';
import type { Fence } from '../load/sections.js';

export interface AbsentRow {
  line: number;
  claim: string;
  pattern: string;
  folders: string[];
  allowed: string[];
}
export interface Citation {
  text: string;
  path: string;
  numbers: number[];
}
export interface ScoutReport {
  files?: string[];
  newFiles: string[];
  absent: AbsentRow[];
  faults: string[];
  citations: Citation[];
  skipped?: string;
}

const HEADER = ['claim', 'pattern', 'folders', 'allowed hits'];
const SKIPPED = /^\s*(?:[-*+]\s+)?skipped:\s*(\S.*)$/;
// A path, a colon and line numbers. A path preceded by `/`, `:` or another path character never starts a match,
// so a URL or an absolute path is no citation.
const CITATION =
  /(?<![\p{L}\p{N}_.@+\-[\]/:])((?:[\p{L}\p{N}_.@+\-[\]]+\/)*[\p{L}\p{N}_.@+\-[\]]+):(\d+(?:-\d+)?(?:,\d+(?:-\d+)?)*)(?![\p{L}\p{N}_])/gu;

/** One wrapping pair of backticks, when the text is at least two characters and starts and ends with one. */
function unwrap(text: string): string {
  return text.length >= 2 && text.startsWith('`') && text.endsWith('`') ? text.slice(1, -1) : text;
}

/** The lines of a section outside fences and HTML comments. */
function bodyLines(section: Section, fences: Fence[]): Line[] {
  const inFence = (n: number) => fences.some((f) => n >= f.open && n <= f.close);
  return stripHtmlComments(section.lines.filter((l) => !inFence(l.line)));
}

/** The paths of a `## Files` or `## New files` list: the first token of each list line, cleaned. */
function listEntries(lines: Line[]): string[] {
  const out: string[] = [];
  for (const { text } of lines) {
    if (!LIST_MARKER.test(text)) continue;
    const token = text.replace(LIST_MARKER, '').trim().split(/\s+/)[0] ?? '';
    const entry = unwrap(token).replace(/\\/g, '/').replace(/^\.\//, '').replace(/:\d+(?:[-,]\d+)*$/, '');
    if (entry !== '') out.push(entry);
  }
  return out;
}

/** The cells of one table line: edge pipes dropped, split on a pipe that is not `\|`, each cell unescaped. */
function cellsOf(text: string): string[] {
  let t = text.trim();
  if (t.startsWith('|')) t = t.slice(1);
  if (t.endsWith('|') && !t.endsWith('\\|')) t = t.slice(0, -1);
  return t.split(/(?<!\\)\|/).map((c) => unwrap(c.replace(/\\\|/g, '|').trim()));
}

/** A Folders or Allowed hits cell: entries split on whitespace and commas, each losing a wrapping backtick. */
function entriesOf(cell: string): string[] {
  return cell
    .split(/[\s,]+/)
    .map((e) => e.replace(/^`/, '').replace(/`$/, ''))
    .filter((e) => e !== '');
}

export function parseScoutReport(text: string): ScoutReport {
  const norm = normaliseText(text);
  const { sections, fences } = scan(norm, 0);
  const section = (key: string) => sections.find((s) => headingKey(s.heading) === key);
  const filesSection = section('files');
  const newSection = section('new files');
  const absentSection = section('absent');
  const report: ScoutReport = {
    newFiles: newSection === undefined ? [] : listEntries(bodyLines(newSection, fences)),
    absent: [],
    faults: [],
    citations: [],
  };
  if (filesSection !== undefined) report.files = listEntries(bodyLines(filesSection, fences));

  if (absentSection !== undefined) {
    const table = bodyLines(absentSection, fences).filter((l) => l.text.trim().startsWith('|'));
    if (table.length > 0) {
      const header = cellsOf(table[0].text).map((c) => c.toLowerCase());
      if (header.length !== HEADER.length || header.some((c, i) => c !== HEADER[i])) {
        report.faults.push('the ## Absent table header is not | Claim | Pattern | Folders | Allowed hits |');
      } else {
        for (const { line, text: rowText } of table.slice(1)) {
          const cells = cellsOf(rowText);
          if (cells.every((c) => /^:?-+:?$/.test(c))) continue;
          if (cells.length !== 4) {
            report.faults.push('## Absent row at line ' + line + ' has ' + cells.length + ' cells, not 4: escape a pipe inside a cell');
            continue;
          }
          const folders = entriesOf(cells[2]);
          report.absent.push({
            line,
            claim: cells[0],
            pattern: cells[1],
            folders: folders.length === 0 ? [''] : folders,
            allowed: entriesOf(cells[3]),
          });
        }
      }
    }
  }

  const seen = new Set<string>();
  for (const m of norm.matchAll(CITATION)) {
    const path = m[1];
    if ((!path.includes('/') && !path.includes('.')) || seen.has(m[0])) continue;
    seen.add(m[0]);
    report.citations.push({ text: m[0], path, numbers: (m[2].match(/\d+/g) ?? []).map(Number) });
  }

  const inFence = (n: number) => fences.some((f) => n >= f.open && n <= f.close);
  const raw = norm.split('\n');
  for (let i = 0; i < raw.length; i++) {
    if (inFence(i + 1)) continue;
    const m = SKIPPED.exec(raw[i]);
    if (m) {
      report.skipped = m[1].trim();
      break;
    }
  }
  return report;
}
