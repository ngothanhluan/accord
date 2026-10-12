// GATE-01/GATE-03 AC hash (D-75, D-77): FNV-1a 64-bit over the `@ac-n` tags and their steps, written
// `fnv1a64:<16 lowercase hex>`. Hand-written on TextEncoder and BigInt: core is isomorphic, so
// node:crypto is banned (CORE-01), and Web Crypto's subtle.digest would make every gate async for
// forty bytes. The algorithm prefix makes a future change fail loudly instead of comparing wrong.
import { headingKey, stripHtmlComments } from '../load/sections.js';
import type { ScenarioRef, Ticket } from '../model/snapshot.js';

type Tagged = ScenarioRef & { acTag: string };
const tagged = (s: ScenarioRef): s is Tagged => s.acTag !== undefined;

// U+0000 cannot occur in Markdown source, so the join is injective: no step text can impersonate a
// tag field, and no two different criteria sets share an input string (T-04-02).
const SEP = '\u0000';
const OFFSET = 0xcbf29ce484222325n;
const PRIME = 0x100000001b3n;
const MASK = 0xffffffffffffffffn;

/** FNV-1a 64-bit over the UTF-8 bytes of `input`, written `fnv1a64:<16 lowercase hex>` (D-75). */
export function fnv1a64(input: string): string {
  let h = OFFSET;
  for (const byte of new TextEncoder().encode(input)) h = ((h ^ BigInt(byte)) * PRIME) & MASK;
  return 'fnv1a64:' + h.toString(16).padStart(16, '0');
}

/**
 * D-77: per scenario carrying an `@ac-n` tag, the bare tag then that scenario's steps, sorted by the
 * numeric part of the tag. Every other tag stays outside, so a `@test:` added after Ready does not
 * move the hash (D-69). Exported for the unit test; the gate calls `acHash`.
 */
export function hashInput(scenarios: readonly ScenarioRef[]): string {
  return scenarios
    .filter(tagged) // a new array, so the caller's order is never disturbed
    // Two scenarios with the same tag keep document order; lint.ac-tag-duplicate has already failed Ready.
    .sort((a, b) => Number(a.acTag.slice(3)) - Number(b.acTag.slice(3)))
    .flatMap((s) => [s.acTag, ...s.steps])
    .join(SEP);
}

/** D-75: `fnv1a64:` plus 16 lowercase hex digits, or undefined when no scenario carries an `@ac-n` tag. */
export function acHash(scenarios: readonly ScenarioRef[]): string | undefined {
  if (!scenarios.some(tagged)) return undefined;
  return fnv1a64(hashInput(scenarios));
}

/** Spec §4: the owner-approved sections, in a fixed order. Open questions is not one of them. */
export const APPROVED_SECTIONS = ['intent', 'acceptance criteria', 'vetoes', 'decisions', 'corrections', 'approach'] as const;

/**
 * Each approved section as its key, its line count, then its non-blank lines, comment-stripped and
 * trimmed. Acceptance criteria use `hashInput`, so a `@test:` tag added during build never stales an
 * approval, exactly as it never stales `ac_hash`. The count keeps the join injective across sections.
 */
export function approvedInput(ticket: Ticket): string {
  return APPROVED_SECTIONS.flatMap((key) => {
    if (key === 'acceptance criteria') return [key, hashInput(ticket.scenarios)];
    const s = ticket.sections.find((x) => headingKey(x.heading) === key);
    const lines =
      s === undefined
        ? []
        : stripHtmlComments(s.lines)
            .map((l) => l.text.trim())
            .filter((t) => t !== '');
    return [key, String(lines.length), ...lines];
  }).join(SEP);
}

/** Spec §4: recorded by `accord approve`; Ready fails when the ticket no longer hashes to it. */
export function approvedHash(ticket: Ticket): string {
  return fnv1a64(approvedInput(ticket));
}
