// ST-LN-12 D-12: the deferred items of a ticket ledger that the owner is asked about at verify. Pure: no node import, no filesystem; the CLI
// hands it the text of accord/tickets/<id>/ledger.md. No gate reads this: an undecided item never stops a ticket. Phase 8.2 D-04, D-10: the owner's
// answer is a trailing mark on the item's own line, read here on every lane's ledger, so a decided item is no longer listed; this module changes no line.
import { normaliseText } from '../load/frontmatter.js';
import { LEGACY_ID } from '../lint/ids.js';
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
 * A mark is the end of the full line: a space, `→` (U+2192), a space, and either `declined`, a token of the ticket id shape (`LEGACY_ID`, the one id shape of lint: ST-LN-12, PROJ-123, web.login_7),
 * or `#<n>` when the id is only digits (Phase 08.9.1 D-03, so a prose arrow such as `3 → 5` stays prose). Phase 08.8 D-07: the id counts as a mark only when `known` says it is a ticket that exists,
 * so a team whose ids are bare numbers can mark an item queued, while a prose arrow that names no ticket (`0.9 → 0.10`, `v1 → v2`) stays listed and is never hidden from the owner. ASCII `->`
 * is not read on purpose: a note that happens to end in `-> name` must never hide a Must item, and `→` is what the verify skill writes. Read on the normalised line before the 160-character
 * short form, so a long item keeps its mark.
 */
const DEFERRED_MARK = / → (\S+)$/;
/** 08.9.1 D-03: an id of ASCII digits only; written bare it is prose, written with a leading `#` it is the mark. */
const DIGITS = /^[0-9]+$/;
const HASH_DIGITS = /^#([0-9]+)$/;

/** The mark ending `line` (a bullet may lead it), or undefined; `known(id)` says whether an id names a ticket (asked without any `#`). When a line ends with two marks the last counts. */
export function deferredMark(line: string, known: (id: string) => boolean): DeferredMark | undefined {
  const m = DEFERRED_MARK.exec(line.trimEnd());
  if (m === null) return undefined;
  const token = m[1];
  if (token === 'declined') return { kind: 'declined' };
  // 08.9.1 D-03: only an all-digit id changes; any other token reads as before.
  if (DIGITS.test(token)) return undefined;
  const hashed = HASH_DIGITS.exec(token);
  if (hashed !== null) return known(hashed[1]) ? { kind: 'queued', id: hashed[1] } : undefined;
  return LEGACY_ID.test(token) && known(token) ? { kind: 'queued', id: token } : undefined;
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
 * group in ledger order; Nice items are left out, and so is an item that ends in the owner's mark (deferredMark, D-04; `known` says which ids are tickets, Phase 08.8 D-07). Only list items count (`-`, `*` or `+`); comment text, fenced blocks, prose lines and
 * other sections are skipped. A text with no such item gives an empty list.
 */
export function ownerDeferred(ledgerText: string, known: (id: string) => boolean): OwnerDeferred[] {
  const { sections, fences } = scan(normaliseText(ledgerText), 0);
  const items: OwnerDeferred[] = [];
  for (const section of sections.filter((s) => headingKey(s.heading) === 'deferred')) {
    const unfenced = section.lines.filter((l) => !fences.some((f) => l.line >= f.open && l.line <= f.close));
    for (const l of stripHtmlComments(unfenced)) {
      const m = ITEM.exec(l.text.trimEnd());
      if (m === null || deferredMark(m[1], known) !== undefined) continue;
      const rating = ratingOf(m[1]);
      if (rating !== 'Nice') items.push({ rating, text: short(m[1]) });
    }
  }
  return [...items.filter((i) => i.rating === 'Must'), ...items.filter((i) => i.rating === 'Should')];
}
