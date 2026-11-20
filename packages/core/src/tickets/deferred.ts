// ST-LN-12 D-12: the deferred items of a ticket ledger that the owner is asked about at verify. Pure: no node import, no filesystem; the CLI
// hands it the text of accord/tickets/<id>/ledger.md. No gate reads this: an undecided item never stops a ticket. Phase 8.2 D-04, D-10: the owner's
// answer is a trailing mark on the item's own line, read here on every lane's ledger, so a decided item is no longer listed; this module changes no line.
import { normaliseText } from '../load/frontmatter.js';
import { headingKey, scan, stripHtmlComments } from '../load/sections.js';

export type DeferredRating = 'Must' | 'Should' | 'Nice';

/** One deferred item the owner is shown: its rating (never Nice) and its short form. */
export interface OwnerDeferred {
  rating: 'Must' | 'Should';
  text: string;
}

/** The owner's answer on a deferred item (Phase 8.2 D-04): queued as a ticket with that id, or declined. */
export type DeferredMark = { kind: 'queued'; id: string } | { kind: 'declined' };

/**
 * A mark is the end of the full line: a space, `→` (U+2192), a space, and either `declined` or a ticket id shape (Review WR-01): a letter first, then letters and digits joined by `-`,
 * ending in `-<digits>` (ST-LN-12, BUG-LN-9, PROJ-123, T-9). A prose arrow such as `0.9 → 0.10` or `v1 → v2` is no mark, so that line stays listed and is never hidden from the owner;
 * an id of another shape is not read as a mark either, which errs towards showing the item. ASCII `->` is not read on purpose: a note that happens to end in `-> name` must never hide
 * a Must item, and `→` is what the verify skill writes. Read on the normalised line before the 160-character short form, so a long item keeps its mark.
 */
const DEFERRED_MARK = / → (declined|[A-Za-z][A-Za-z0-9]*(?:-[A-Za-z0-9]+)*-[0-9]+)$/;

/** The mark ending `line` (a bullet may lead it), or undefined; when a line ends with two marks the last counts. */
export function deferredMark(line: string): DeferredMark | undefined {
  const m = DEFERRED_MARK.exec(line.trimEnd());
  if (m === null) return undefined;
  if (m[1] === 'declined') return { kind: 'declined' };
  return { kind: 'queued', id: m[1] };
}

/** The longest short form, the ellipsis included. */
const SHORT = 160;
const MARK = /\((Must|Should|Nice)\)/;
const ITEM = /^[-*+]\s+(\S.*)$/;

/**
 * A line's rating: its first `(Must)`, `(Should)` or `(Nice)` mark by position, matched exactly (case and brackets as written); a line with
 * no mark counts as Should, so an item nobody rated is never hidden from the owner (D-12 Ruling "Deferred-item ratings").
 */
export function ratingOf(line: string): DeferredRating {
  const m = MARK.exec(line);
  return m === null ? 'Should' : (m[1] as DeferredRating);
}

/** The line cut to SHORT characters, a cut ending in `…`; counted in code points, so a pair is never split. */
function short(text: string): string {
  const points = Array.from(text);
  return points.length <= SHORT ? text : points.slice(0, SHORT - 1).join('') + '…';
}

/**
 * The Must and Should items under every `## Deferred` section of a ledger, in short form: the Must items first, then the Should items, each
 * group in ledger order; Nice items are left out, and so is an item that ends in the owner's mark (deferredMark, D-04). Only list items count (`-`, `*` or `+`); comment text, fenced blocks, prose lines and
 * other sections are skipped. A text with no such item gives an empty list.
 */
export function ownerDeferred(ledgerText: string): OwnerDeferred[] {
  const { sections, fences } = scan(normaliseText(ledgerText), 0);
  const items: OwnerDeferred[] = [];
  for (const section of sections.filter((s) => headingKey(s.heading) === 'deferred')) {
    const unfenced = section.lines.filter((l) => !fences.some((f) => l.line >= f.open && l.line <= f.close));
    for (const l of stripHtmlComments(unfenced)) {
      const m = ITEM.exec(l.text.trimEnd());
      if (m === null || deferredMark(m[1]) !== undefined) continue;
      const rating = ratingOf(m[1]);
      if (rating !== 'Nice') items.push({ rating, text: short(m[1]) });
    }
  }
  return [...items.filter((i) => i.rating === 'Must'), ...items.filter((i) => i.rating === 'Should')];
}
