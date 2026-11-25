// Phase 08.9.2 Ruling-fnv32 (L-04): `fnv1a64` moved from BigInt to two 32-bit halves because the BigInt loop cost 346 ms on 436 files
// against 61 ms for the halves (measured 2026-11-23), and every command hashes every plan body. A stored hash (`ac_hash`, `approved_hash`,
// `plan_hash`, a skill marker) must not change, so the BigInt version survives here, and only here, as the reference the halves are held to.
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, it } from 'vitest';
import { fnv1a64 } from '../src/gate/hash.js';
import { contentHash } from '../src/skills/render.js';

const OFFSET = 0xcbf29ce484222325n;
const PRIME = 0x100000001b3n;
const MASK = 0xffffffffffffffffn;

// The pre-08.9.2 implementation, kept verbatim as the oracle.
function reference(input: string): string {
  let h = OFFSET;
  for (const byte of new TextEncoder().encode(input)) h = ((h ^ BigInt(byte)) * PRIME) & MASK;
  return 'fnv1a64:' + h.toString(16).padStart(16, '0');
}

const accordDir = fileURLToPath(new URL('../../../accord/', import.meta.url));
const hashSource = fileURLToPath(new URL('../src/gate/hash.ts', import.meta.url));
const renderSource = fileURLToPath(new URL('../src/skills/render.ts', import.meta.url));

// Phase 08.9.2 Ruling-fnv32: the output guard; it passes before the change by design and must keep passing after it.
it('risk:regression fnv1a64 on 32-bit halves equals the BigInt reference on vectors and every accord file (Ruling-fnv32)', () => {
  expect(fnv1a64('')).toBe('fnv1a64:cbf29ce484222325');
  expect(fnv1a64('a')).toBe('fnv1a64:af63dc4c8601ec8c');
  expect(fnv1a64('foobar')).toBe('fnv1a64:85944171f73967e8');
  for (const text of ['\u0000', '\u0001\u0000ÿ', '\u0102n c\u01a1m \u{1F35A}', 'a\u0000b\r\nc\n', 'x'.repeat(4097)]) {
    expect(fnv1a64(text)).toBe(reference(text));
  }
  let read = 0;
  for (const entry of readdirSync(accordDir, { recursive: true, withFileTypes: true })) {
    if (!entry.isFile()) continue;
    const text = readFileSync(join(entry.parentPath, entry.name), 'utf8');
    expect(fnv1a64(text), join(entry.parentPath, entry.name)).toBe(reference(text));
    read += 1;
  }
  expect(read).toBeGreaterThanOrEqual(100);
});

// Phase 08.9.2 Ruling-fnv32 and Pitfall 9: one implementation of the algorithm in core, and neither copy keeps BigInt.
it('risk:regression contentHash and fnv1a64 are one implementation with no BigInt (Ruling-fnv32)', () => {
  for (const text of ['', 'a', 'foobar', '\u0000', '\u0102n c\u01a1m \u{1F35A}', 'line one\nline two\n']) {
    expect(contentHash(text)).toBe(fnv1a64(text));
  }
  const code = (path: string): string =>
    readFileSync(path, 'utf8')
      .split('\n')
      .filter((line) => !line.trimStart().startsWith('//'))
      .join('\n');
  for (const path of [hashSource, renderSource]) {
    expect(code(path), path).not.toContain('BigInt(');
    expect(code(path), path).not.toContain('0x100000001b3n');
  }
});
