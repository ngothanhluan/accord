// WR-07: a raw NUL byte in a source file makes grep, rg and editors treat the file as binary, so a search silently skips it, and a
// formatter that strips NULs would turn a `split('<NUL>')` into `split('')` with no type error. A NUL in code is written '\0'.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const packages = fileURLToPath(new URL('../../', import.meta.url));

/** Every source file under packages/<name>/src, as a path relative to packages/. */
function sources(): string[] {
  const found: string[] = [];
  for (const pkg of readdirSync(packages, { withFileTypes: true })) {
    if (!pkg.isDirectory()) continue;
    const src = join(packages, pkg.name, 'src');
    let entries: string[];
    try {
      entries = readdirSync(src, { recursive: true, encoding: 'utf8' });
    } catch {
      continue; // a package with no src folder
    }
    for (const entry of entries) if (/\.(?:[cm]?[jt]s|json)$/.test(entry)) found.push(join(pkg.name, 'src', entry));
  }
  return found;
}

describe('no raw NUL byte in a source file (WR-07)', () => {
  it('risk:regression no file under packages/*/src holds a 0x00 byte', () => {
    const files = sources();
    expect(files.length).toBeGreaterThan(50);
    const bad = files.filter((f) => readFileSync(join(packages, f)).includes(0)).map((f) => f.replaceAll('\\', '/'));
    expect(bad).toEqual([]);
  });
});
