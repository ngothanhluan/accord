// Phase 15 D-06, SC-3: the measured size of one slice, as a reviewer meets it. Every line a reviewer reads counts, lines added plus lines deleted, split into code, test and docs (skills and agents
// count with docs): the owner rejected a count of product code alone, because a slice of few code lines and many test lines is still a long read. Ticket records (`accord/tickets/**`) and what the
// host marks as excluded (the copies accord renders, the lockfiles) are not counted. Pure: the host reads `git diff --numstat` and hands the lines over.

/** One `git diff --numstat` line: a binary file has no counts and arrives as 0 and 0. */
export interface NumstatLine {
  added: number;
  deleted: number;
  path: string;
}

/** The lines a slice holds, by what a reviewer reads them as; `total` is their sum. */
export interface SliceSize {
  code: number;
  test: number;
  docs: number;
  total: number;
}

export type SizeKind = 'code' | 'test' | 'docs';

const TEST_DIRS: ReadonlySet<string> = new Set(['test', 'tests', '__tests__']);
const DOCS_DIRS: ReadonlySet<string> = new Set(['skills', 'agents']);
const TEST_FILE = /\.(?:test|spec)\./;

/** The ticket records folder: never counted, whatever the host passes as excluded. */
const TICKET_RECORDS = 'accord/tickets/';

/**
 * What a path is to a reader: a test (a folder `test`, `tests` or `__tests__` on the way, or a name holding `.test.` or `.spec.`), docs (`docs/**`, any `.md`, anything under a `skills` or `agents`
 * folder), else code. A test is judged first, so a Markdown fixture under a test folder is a test.
 */
export function sizeKind(path: string): SizeKind {
  const parts = path.split('/');
  const name = parts[parts.length - 1];
  const dirs = parts.slice(0, -1);
  if (dirs.some((d) => TEST_DIRS.has(d)) || TEST_FILE.test(name)) return 'test';
  if (parts[0] === 'docs' || name.endsWith('.md') || dirs.some((d) => DOCS_DIRS.has(d))) return 'docs';
  return 'code';
}

/** The size of a diff: `excluded` names the paths the host leaves out (rendered copies, lockfiles); `accord/tickets/**` is always left out. */
export function sliceSizeOf(numstat: readonly NumstatLine[], excluded: (path: string) => boolean): SliceSize {
  const size: SliceSize = { code: 0, test: 0, docs: 0, total: 0 };
  for (const line of numstat) {
    if (line.path.startsWith(TICKET_RECORDS) || excluded(line.path)) continue;
    const lines = line.added + line.deleted;
    size[sizeKind(line.path)] += lines;
    size.total += lines;
  }
  return size;
}

/** `code 300, test 600, docs 150`: the split every size message shows, in this order, zero parts included. */
export const sliceSplit = (size: SliceSize): string => `code ${size.code}, test ${size.test}, docs ${size.docs}`;
