// GATE-01/GATE-03 AC hash (D-75, D-77): FNV-1a 64-bit over the `@ac-n` tags and their steps, written
// `fnv1a64:<16 lowercase hex>`. Hand-written on TextEncoder and BigInt: core is isomorphic, so
// node:crypto is banned (CORE-01), and Web Crypto's subtle.digest would make every gate async for
// forty bytes. The algorithm prefix makes a future change fail loudly instead of comparing wrong.
import type { ScenarioRef } from '../model/snapshot.js';

type Tagged = ScenarioRef & { acTag: string };
const tagged = (s: ScenarioRef): s is Tagged => s.acTag !== undefined;

// U+0000 cannot occur in Markdown source, so the join is injective: no step text can impersonate a
// tag field, and no two different criteria sets share an input string (T-04-02).
const SEP = '\u0000';
const OFFSET = 0xcbf29ce484222325n;
const PRIME = 0x100000001b3n;
const MASK = 0xffffffffffffffffn;

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
  let h = OFFSET;
  for (const byte of new TextEncoder().encode(hashInput(scenarios))) h = ((h ^ BigInt(byte)) * PRIME) & MASK;
  return 'fnv1a64:' + h.toString(16).padStart(16, '0');
}
