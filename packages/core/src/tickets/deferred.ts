// ST-LN-12 D-12: the deferred items of a ticket ledger that the owner is asked about at verify. Pure: no node import, no filesystem; the CLI
// hands it the text of accord/tickets/<id>/ledger.md. No gate reads this: an undecided item never stops a ticket, and no ledger line is changed.
import { normaliseText } from '../load/frontmatter.js';
import { headingKey, scan, stripHtmlComments } from '../load/sections.js';

export type DeferredRating = 'Must' | 'Should' | 'Nice';

/** One deferred item the owner is shown: its rating (never Nice) and its short form. */
export interface OwnerDeferred {
  rating: 'Must' | 'Should';
  text: string;
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
 * group in ledger order; Nice items are left out. Only list items count (`-`, `*` or `+`); comment text, fenced blocks, prose lines and
 * other sections are skipped. A text with no such item gives an empty list.
 */
export function ownerDeferred(ledgerText: string): OwnerDeferred[] {
  const { sections, fences } = scan(normaliseText(ledgerText), 0);
  const items: OwnerDeferred[] = [];
  for (const section of sections.filter((s) => headingKey(s.heading) === 'deferred')) {
    const unfenced = section.lines.filter((l) => !fences.some((f) => l.line >= f.open && l.line <= f.close));
    for (const l of stripHtmlComments(unfenced)) {
      const m = ITEM.exec(l.text.trimEnd());
      if (m === null) continue;
      const rating = ratingOf(m[1]);
      if (rating !== 'Nice') items.push({ rating, text: short(m[1]) });
    }
  }
  return [...items.filter((i) => i.rating === 'Must'), ...items.filter((i) => i.rating === 'Should')];
}
