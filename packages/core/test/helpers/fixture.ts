// D-53 fixture reader and in-memory variants; test-only, so Node built-ins are allowed here.
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { SnapshotInput } from '../../src/index.js';

const BOM = String.fromCharCode(0xfeff);

/** Read `test/fixtures/<name>/` into a SnapshotInput with forward-slash keys. */
export function readFixture(name: string): SnapshotInput {
  const root = fileURLToPath(new URL('../fixtures/' + name + '/', import.meta.url));
  const files: Record<string, string> = {};
  for (const d of readdirSync(root, { recursive: true, withFileTypes: true })) {
    if (!d.isFile()) continue;
    const abs = join(d.parentPath, d.name);
    files[relative(root, abs).split(sep).join('/')] = readFileSync(abs, 'utf8');
  }
  return { files, tree: Object.keys(files).sort() };
}

const mapValues = (files: Record<string, string>, f: (v: string) => string) =>
  Object.fromEntries(Object.entries(files).map(([k, v]) => [k, f(v)]));

const crlf = (v: string) => v.replace(/\n/g, '\r\n');
// Only even-indexed line terminators become CRLF; the tail after the last '\n' is untouched.
const mixed = (v: string) => {
  const parts = v.split('\n');
  return parts.map((p, i) => (i < parts.length - 1 && i % 2 === 0 ? p + '\r' : p)).join('\n');
};
const backslashKey = (k: string) => '.\\' + k.replace(/\//g, '\\');

export interface Variants {
  lf: SnapshotInput;
  crlf: SnapshotInput;
  bomCrlf: SnapshotInput;
  mixed: SnapshotInput;
  backslash: SnapshotInput;
}

export function variants(input: SnapshotInput): Variants {
  return {
    lf: input,
    crlf: { files: mapValues(input.files, crlf), tree: [...input.tree] },
    bomCrlf: { files: mapValues(input.files, (v) => BOM + crlf(v)), tree: [...input.tree] },
    mixed: { files: mapValues(input.files, mixed), tree: [...input.tree] },
    backslash: {
      files: Object.fromEntries(Object.entries(input.files).map(([k, v]) => [backslashKey(k), v])),
      tree: input.tree.map(backslashKey),
    },
  };
}

/** JSON with object keys sorted at every depth; arrays keep their order. */
export function stableJson(x: unknown): string {
  return JSON.stringify(
    x,
    (_key, value: unknown) =>
      value !== null && typeof value === 'object' && !Array.isArray(value)
        ? Object.fromEntries(
            Object.keys(value as Record<string, unknown>)
              .sort()
              .map((k) => [k, (value as Record<string, unknown>)[k]]),
          )
        : value,
    2,
  );
}
