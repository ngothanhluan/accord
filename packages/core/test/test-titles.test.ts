// Phase 8 D-13 (8-ac-7): a test title is defined in one test file only. `-t "<id>"` selection and the test-to-criterion map read a title,
// and a title shared by two files makes both answer to one name.
//
// The scan is deliberately small: it reads every `*.test.ts` under packages/core/test and packages/cli/test (fixtures and __golden__ left out)
// and takes the first quoted, double-quoted or backtick literal that follows `it(`, `test(`, `describe(` or their `.skip`, `.only`, `.todo`,
// `.concurrent` and `.each(...)(` forms, when the call starts a line and the literal is on that line. A title split over lines, built from a
// variable, a template with `${}`, or a call that does not start its line is not seen, so a duplicate written that way passes; the check names
// what it covers instead of claiming more.
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, it } from 'vitest';

/**
 * The 13 titles that were already defined in two files before Phase 8 (found at origin/main fd2cb1d4). They are out of D-13, which names the
 * Phase 7 titles, and they stay as they are; every other title found in two files fails the check. Sorted by code point.
 */
const KNOWN_OLDER_DUPLICATES: readonly string[] = [];

const TEST_ROOTS = ['../../core/test', '../../cli/test'].map((p) => fileURLToPath(new URL(p, import.meta.url)));
const SKIPPED = new Set(['fixtures', '__golden__', 'node_modules']);
// `it(`, `test(`, `describe(` at the start of a line, with an optional modifier and an optional `.each(...)`, then the literal; the anchor keeps a
// string that merely mentions `describe(` out.
const TITLE = /^\s*(?:it|test|describe)(?:\.(?:skip|only|todo|concurrent|sequential))?(?:\.each\(.*?\))?\(\s*(?:'((?:\\.|[^'\\])*)'|"((?:\\.|[^"\\])*)"|`((?:\\.|[^`\\$])*)`)/g;

function testFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    if (SKIPPED.has(e.name)) return [];
    const path = join(dir, e.name);
    if (e.isDirectory()) return testFiles(path);
    return e.name.endsWith('.test.ts') ? [path] : [];
  });
}

/** Every title literal of the test files, with the set of files that define it. */
function titlesByFile(): Map<string, Set<string>> {
  const found = new Map<string, Set<string>>();
  for (const root of TEST_ROOTS) {
    for (const file of testFiles(root)) {
      for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
        for (const m of line.matchAll(TITLE)) {
          const title = m[1] ?? m[2] ?? m[3] ?? '';
          const files = found.get(title) ?? new Set<string>();
          files.add(file);
          found.set(title, files);
        }
      }
    }
  }
  return found;
}

it('risk:regression no test title is defined in two test files except the 13 older ones this test lists (8-ac-7)', () => {
  const found = titlesByFile();
  expect(found.size, 'the scan found test titles').toBeGreaterThan(1000);
  const twice = [...found].filter(([, files]) => files.size > 1).map(([title]) => title).sort();
  const expected = [...KNOWN_OLDER_DUPLICATES].sort();
  expect(KNOWN_OLDER_DUPLICATES.length, 'the older list is empty').toBe(0);
  expect(
    twice.filter((t) => !expected.includes(t)),
    'a title defined in two test files: rename one so each title is unique (add a risk: kind or the criterion it checks)',
  ).toEqual([]);
  expect(
    expected.filter((t) => !twice.includes(t)),
    'a title listed in KNOWN_OLDER_DUPLICATES that is no longer defined in two files: remove it from the list',
  ).toEqual([]);
});
