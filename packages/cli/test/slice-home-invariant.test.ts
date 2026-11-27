// Phase 08.9.3 D-14, Pitfall 7: where slice n of a ticket lives, and which slice is its previous one, is said once, by core's `sliceHome`. "Slice 1 is the claim branch" and "the previous slice is slice n-1" are true only
// for a plan of one repository: with a slice in another repository the claim branch holds the first slice of THIS repository, whatever its number, and the previous slice is the previous one of the SAME repository.
// This test reads every source file of the CLI and fails when a line chooses a slice's branch by its number (`n === 1 ? claim ...`) or builds a neighbour's branch by arithmetic (`sliceBranch(id, n - 1)`,
// `slice/${id}/${n - 1}`), so a new reader cannot bring the Phase 15 shortcut back.
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, it } from 'vitest';

const SRC = fileURLToPath(new URL('../src', import.meta.url));

/** The shortcuts: a ternary on the slice number that picks the claim branch, and a slice branch built from a number plus or minus a literal. */
const SHORTCUTS: readonly RegExp[] = [
  /===?\s*[12]\s*\?[^;]*\bclaim/i, // n === 1 ? claimBranch : ...
  /!==?\s*[12]\s*\?[^;:]*:[^;]*\bclaim/i, // n !== 1 ? slice(...) : claimBranch
  /\b(?:sliceBranch|sliceBranchName)\(\s*[^,()]+,\s*[^()]*[-+]\s*[0-9]+\s*\)/, // sliceBranch(id, n - 1)
  /slice\/\$\{[^}]+\}\/\$\{[^}]*[-+]\s*[0-9]+[^}]*\}/, // `slice/${id}/${n - 1}`
  /\bclaim\w*\s*:\s*[^,;]*\bn\s*===?\s*1\b/i, // { claim: n === 1 }
];

/** The code of a source line: comments are the place the shortcut is named and explained, so a `//` comment and the text of a block comment line are not read. */
function codeOf(line: string): string {
  const t = line.trim();
  if (t.startsWith('//') || t.startsWith('*') || t.startsWith('/*')) return '';
  const at = line.indexOf(' // ');
  return at < 0 ? line : line.slice(0, at);
}

/** Every line of `text` that holds a shortcut, as `<line number>: <text>`. */
function offences(text: string): string[] {
  return text
    .split('\n')
    .flatMap((line, i) => (SHORTCUTS.some((re) => re.test(codeOf(line))) ? [`${i + 1}: ${line.trim()}`] : []));
}

function sources(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const path = join(dir, e.name);
    return e.isDirectory() ? sources(path) : e.name.endsWith('.ts') ? [path] : [];
  });
}

it('risk:regression no source file of the CLI picks a slice branch by the slice number or builds the previous slice by arithmetic: every reader asks sliceHome (D-14)', () => {
  const files = sources(SRC);
  expect(files.length).toBeGreaterThan(20);
  const found = files.flatMap((f) => offences(readFileSync(f, 'utf8')).map((o) => `${relative(SRC, f).replaceAll('\\', '/')}:${o}`));
  expect(found, 'ask sliceHome (core) for the branch and the previous slice instead of computing them').toEqual([]);
});

it('risk:regression the scan matches the shortcuts it exists to keep out, and not the comments that name them (guard the guard, D-14)', () => {
  const bad = [
    "const branch = k === 1 ? claimBranch : sliceBranch(id, k);",
    "const branch = n == 1 ? claim : `slice/${id}/${n}`;",
    "const branch = n !== 1 ? sliceBranch(id, n) : claimBranch;",
    "const previous = sliceBranch(id, n - 1);",
    "const previous = `slice/${id}/${n - 1}`;",
    "return { n, claim: n === 1 };",
  ];
  for (const line of bad) expect(offences(line), line).toHaveLength(1);
  const fine = [
    "// the claim branch for slice 1 is sliceHome's say; slice/<id>/<n-1> after it",
    " * \"the claim branch for slice 1\" and \"slice n-1\" are the slice's home",
    "const home = sliceHomeOf(snapshot, id, n);",
    "const branch = sliceBranch(id, e.n);",
    "const label = n === 1 ? 'first' : 'later';",
  ];
  for (const line of fine) expect(offences(line), line).toEqual([]);
});
