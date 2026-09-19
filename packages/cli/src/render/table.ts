// CLI-05 status table (STACK Decision 5, PITFALLS section 12): a hand-rolled `padEnd` table, ASCII
// only — no box drawing, no dependency, and no terminal dimension read, so the output is byte-identical
// on every host and can be pinned by a golden. A narrow terminal wraps, which is the shell's job.
// Pure and colour-free, the same shape as core's lint/render.ts: data in, text out, ending in a
// newline; the caller decides about colour.
import type { StatusRow } from '@accord-dev/accord-core';

/**
 * The "nothing recorded" cell. D-91 and D-100 write it as an em dash, which is outside ASCII and
 * renders as garbage on a legacy Windows code page; the ASCII hyphen carries the same intent. One
 * constant, so reversing the choice is a one-line change.
 */
export const EMPTY_CELL = '-';

/** Two spaces between columns; the separator row is ASCII hyphens. Nothing here is box drawing. */
const GAP = '  ';

interface Column {
  head: string;
  budget: number;
  cell: (row: StatusRow, tracker: string | undefined) => string;
}

/** `{ 'github-issues': '1e3' }` becomes `github-issues:1e3`; several keys are joined by one space. */
function flatten(tracker: Record<string, string> | undefined): string {
  const pairs = Object.entries(tracker ?? {}).map(([k, v]) => k + ':' + v);
  return pairs.length === 0 ? EMPTY_CELL : pairs.join(' ');
}

const COLUMNS: Column[] = [
  { head: 'id', budget: 28, cell: (r) => r.id },
  // A ticket whose frontmatter failed the schema has no `type` and no `status`; those cells render as
  // empty padding rather than a sentinel glyph (owner ruling on the 05-02 finding). The err/warn
  // column is what distinguishes a broken ticket from a merely sparse one.
  { head: 'type', budget: 6, cell: (r) => r.type ?? '' },
  { head: 'status', budget: 8, cell: (r) => r.status ?? '' },
  { head: 'parent', budget: 28, cell: (r) => r.parent ?? EMPTY_CELL },
  { head: 'ui', budget: 3, cell: (r) => (r.ui ? 'yes' : 'no') },
  { head: 'err/warn', budget: 9, cell: (r) => r.errors + '/' + r.warnings },
  { head: 'ready', budget: 5, cell: (r) => (r.ready === 'none' ? EMPTY_CELL : r.ready) },
  {
    head: 'ticks',
    budget: 12,
    // Both counts zero is what makes an epic's ticks cell empty without the renderer knowing what an
    // epic is.
    cell: (r) =>
      r.ticksTagged === 0 && r.ticksVerified === 0
        ? EMPTY_CELL
        : r.ticksVerified + '/' + r.ticksTagged + ' ' + r.ticksBinding,
  },
  // `trackerCells` is the seam the tracker adapter fills later; nothing else in this file changes when
  // it arrives. Absent, the row's own tracker map is flattened.
  { head: 'tracker', budget: 32, cell: (r, tracker) => tracker ?? flatten(r.tracker) },
];

// T-05-11: a frontmatter value is untrusted text rendered into a terminal. Anything outside printable
// ASCII becomes a space before anything is measured, which is two invariants in one predicate: an
// escape or a C0 control cannot inject an ANSI sequence or forge a row, and a box-drawing glyph or a
// multi-byte character cannot reach a legacy Windows console (STACK Decision 5) through a tracker id
// or a file stem. A control-only scan leaves that second half unenforced. Mirrors `ascii()` in
// src/tracker/github-issues.ts, which is why a tracker-fetched cell was already safe and a
// row-derived one was not. Written as a code-point scan rather than a regular expression: a character
// class of control characters is exactly what eslint's no-control-regex refuses, and no file in this
// repository suppresses a rule. It also keeps `.length` equal to the rendered width, so `padEnd`
// cannot mis-measure a column.
const isPrintable = (ch: string): boolean => {
  const cp = ch.codePointAt(0) ?? 0;
  return cp >= 0x20 && cp <= 0x7e;
};
const sanitise = (v: string): string =>
  [...v]
    .map((ch) => (isPrintable(ch) ? ch : ' '))
    .join('')
    .replace(/ +/g, ' ')
    .trim();

// T-05-12: a multi-megabyte frontmatter value cannot produce an unbounded line. Three ASCII dots make
// the cut visible. Only ever called on a sanitised value, and the ordering is load-bearing: `slice`
// cuts by UTF-16 unit, so on unsanitised input it could halve a surrogate pair. Nothing above 0x7e
// survives `sanitise`, which is what makes that unreachable rather than merely unlikely.
const fit = (v: string, budget: number): string => (v.length <= budget ? v : v.slice(0, budget - 3) + '...');

/**
 * One header line, one hyphen separator, one line per row, in the order `statusRows` returned them
 * (D-92 — the CLI never re-sorts). Every column is padded, including the last, so every line is the
 * same length and a truncated cell is visible against its neighbours.
 */
export function renderRows(rows: StatusRow[], trackerCells?: Record<string, string>): string {
  const cells = rows.map((r) => COLUMNS.map((c) => fit(sanitise(c.cell(r, trackerCells?.[r.id])), c.budget)));
  const widths = COLUMNS.map((c, i) => Math.max(c.head.length, ...cells.map((row) => row[i].length)));
  const line = (values: string[]): string => values.map((v, i) => v.padEnd(widths[i])).join(GAP);
  return (
    [line(COLUMNS.map((c) => c.head)), line(widths.map((w) => '-'.repeat(w))), ...cells.map(line)].join('\n') + '\n'
  );
}
