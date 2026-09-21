import { execFileSync } from 'node:child_process';
import { readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const generated = fileURLToPath(new URL('../README.md', import.meta.url));
const source = fileURLToPath(new URL('../../../README.md', import.meta.url));
const manifest = fileURLToPath(new URL('../package.json', import.meta.url));
const script = fileURLToPath(new URL('../scripts/gen-readme.mjs', import.meta.url));
const BOM = String.fromCharCode(0xfeff);

const normalise = (text: string) => (text.startsWith(BOM) ? text.slice(1) : text).replace(/\r\n/g, '\n');

describe('generated README', () => {
  // Run the real generator into a throwaway file and compare bytes, rather than re-deriving the
  // expected text here. Re-derivation was fine while the only rule was a banner; once the generator
  // rewrites links it would be a second copy of those rules, and a test that agrees with its own copy
  // catches nothing. Spawning node by process.execPath is how this repository spawns node anywhere.
  it('matches what the generator produces from the repository root README (drift)', () => {
    const out = join(tmpdir(), `accord-readme-${process.pid}.md`);
    try {
      execFileSync(process.execPath, [script, out]);
      expect(readFileSync(generated, 'utf8'), 'packages/cli/README.md drifted: run npm run gen').toBe(
        readFileSync(out, 'utf8'),
      );
    } finally {
      rmSync(out, { force: true });
    }
  });

  // @ac-1: the registry serves this page from its own origin. A link that only resolves relative to the
  // repository sends a reader there to a 404, which is worse than no link, because it reads as a broken
  // project rather than as a missing page.
  it('leaves no repository-relative link for a reader on the registry page', () => {
    const links = [...readFileSync(generated, 'utf8').matchAll(/\]\(([^)]+)\)/g)].map(([, href]) => href);
    expect(links.length, 'packages/cli/README.md has no links at all, which is not what this checks').toBeGreaterThan(0);
    for (const href of links) {
      expect(href, `packages/cli/README.md links ${href}, which resolves to nothing off the repository`).toMatch(
        /^(?:\w+:|\/\/|#)/,
      );
    }
  });

  it('LF and no BOM on disk', () => {
    const raw = readFileSync(generated, 'utf8');
    expect(raw, 'packages/cli/README.md has CR').not.toContain('\r');
    expect(raw.startsWith(BOM), 'packages/cli/README.md has BOM').toBe(false);
  });

  // D-94 compares config.yml's pin and the running CLI as exact strings. The README's npx line is the
  // third place the version appears and the only one a reader copies by hand, so it gets the same rule
  // and the same absence of tolerance: a release that moves the version and leaves this line behind
  // sends every new reader to a version that is not the one being described.
  it('pins the run instruction to the version the package declares', () => {
    const { name, version } = JSON.parse(readFileSync(manifest, 'utf8')) as { name: string; version: string };
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pinned = [...normalise(readFileSync(source, 'utf8')).matchAll(new RegExp(`${escaped}@([^\\s\`)]+)`, 'g'))];
    expect(pinned.length, `README.md names no ${name}@<version> for a reader to run`).toBeGreaterThan(0);
    for (const [, found] of pinned) {
      expect(found, `README.md pins ${name}@${found}, package.json declares ${version}: run npm run gen`).toBe(version);
    }
  });

  // A hand-edited file that silently loses its banner is a file the next reader will hand-edit again.
  it('names its generator on the first line', () => {
    const first = readFileSync(generated, 'utf8').split('\n')[0];
    expect(first, 'packages/cli/README.md lost its banner: run npm run gen').toContain('gen-readme.mjs');
  });
});
