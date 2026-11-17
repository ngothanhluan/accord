// BUG-LN-18 (Phase 5, TRUST-02, D-04): a done ticket is frozen, so moving or renaming a test it names never forces an edit of it. `accord lint` stops checking the
// `@test:` tags of a done ticket against the report; a ticket not done is checked as before. On real files and real git, with the rule raised to `error` through
// `strictness.levels` (at its default level it is a warning, and lint exits 0 with or without the fix).
import { afterEach, expect, it } from 'vitest';
import { cleanup, commitMsg, gitRun, makeEmptyRepo, run, writeFiles } from './helpers/repo.js';
import { CONFIG, REPORT, building, done, junit, P } from '../../../test/helpers/lane.js';
import type { Files } from '../../../test/helpers/lane.js';

const repos: string[] = [];
afterEach(() => {
  while (repos.length > 0) cleanup(repos.pop() as string);
});

const RULE = 'lint.test-id-unknown';
const RAISED = CONFIG + 'strictness:\n  levels:\n    lint.test-id-unknown: error\n';
interface Found { rule: string; level: string; file: string; line?: number; reason: string }
const unknown = async (repo: string): Promise<{ code: number; found: Found[] }> => {
  const r = await run(['lint', '--json'], repo);
  return { code: r.code, found: (JSON.parse(r.out).findings as Found[]).filter((f) => f.rule === RULE) };
};

/** A repository whose base commit holds done T-1 (and what `more` adds) with its tests in the report, then a commit that moves the tests: the report names only the new ids. T-1's file is untouched. */
function movedTests(more: (files: Files) => void = () => undefined): string {
  const repo = makeEmptyRepo();
  repos.push(repo);
  const files: Files = {
    'accord/config.yml': RAISED,
    [REPORT]: junit({ 'export#writes-csv': 'passed', 'export#escapes-commas': 'passed' }),
    'test/export.spec.ts': 'export {};\n',
  };
  done(files, 'T-1');
  more(files);
  writeFiles(repo, files);
  commitMsg(repo, 'base: T-1 done, its tests green');
  gitRun(repo, 'branch', '-M', 'main');
  gitRun(repo, 'switch', '-q', '-c', 'move-tests');
  writeFiles(repo, { 'test/csv.spec.ts': 'export {};\n', [REPORT]: junit({ 'csv#writes-csv': 'passed', 'csv#escapes-commas': 'passed' }) });
  commitMsg(repo, 'move the export tests to csv');
  return repo;
}

it('ac-2 a pull request that moves a test a done ticket names passes accord lint (BUG-LN-18 18-ac-2)', async () => {
  const repo = movedTests();
  const moved = await unknown(repo);
  expect(moved.found, 'the done ticket is not asked for its test ids').toEqual([]);
  expect(moved.code).toBe(0);
  expect((await run(['lint'], repo)).code).toBe(0);
}, 120_000);

it('ac-2 a ticket not done that names the same moved test still fails accord lint (BUG-LN-18 18-ac-1)', async () => {
  const repo = movedTests((files) => building(files, 'T-2'));
  const moved = await unknown(repo);
  expect(moved.found.map((f) => f.file)).toEqual([P('T-2'), P('T-2')]);
  expect(moved.found.every((f) => f.level === 'error')).toBe(true);
  expect(moved.found[0].reason).toContain("ids are classname#name with spaces as '-'");
  expect(moved.code).toBe(1);
}, 120_000);
