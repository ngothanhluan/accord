// BUG-LN-18 (Phase 5, TRUST-02, D-04): a done ticket is frozen, so moving or renaming a test it names never forces an edit of it. `accord lint` stops checking the
// `@test:` tags of a done ticket against the report; a ticket not done is checked as before. On real files and real git, with the rule raised to `error` through
// `strictness.levels` (at its default level it is a warning, and lint exits 0 with or without the fix).
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
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

it('risk:regression a pull request that moves a test a done ticket names passes accord lint (BUG-LN-18 18-ac-2)', async () => {
  const repo = movedTests();
  const moved = await unknown(repo);
  expect(moved.found, 'the done ticket is not asked for its test ids').toEqual([]);
  expect(moved.code).toBe(0);
  expect((await run(['lint'], repo)).code).toBe(0);
}, 120_000);

it('risk:regression a ticket not done that names the same moved test still fails accord lint (BUG-LN-18 18-ac-1)', async () => {
  const repo = movedTests((files) => building(files, 'T-2'));
  const moved = await unknown(repo);
  expect(moved.found.map((f) => f.file)).toEqual([P('T-2'), P('T-2')]);
  expect(moved.found.every((f) => f.level === 'error')).toBe(true);
  expect(moved.found[0].reason).toContain("ids are classname#name with spaces as '-'");
  expect(moved.code).toBe(1);
}, 120_000);

// Phase 15 G1 (D-23, D-24, D-25): a done ticket is not edited. `gate done` reads "done" at the merge base with the default branch and, for such a ticket, compares every record
// of its folder with HEAD; real git, through the real command.
interface GateFound { rule: string; level: string; file: string; reason: string }
const gateDone = async (repo: string, id: string): Promise<{ code: number; found: GateFound[] }> => {
  const r = await run(['gate', 'done', id, '--json'], repo);
  return { code: r.code, found: (JSON.parse(r.out).findings as GateFound[]) };
};

/** A repository whose main holds done T-1 (and what `more` adds); HEAD is a new branch `work` with nothing changed yet. */
function doneOnMain(more: (files: Files) => void = () => undefined): string {
  const repo = makeEmptyRepo();
  repos.push(repo);
  const files: Files = {
    'accord/config.yml': CONFIG,
    [REPORT]: junit({ 'export#writes-csv': 'passed', 'export#escapes-commas': 'passed' }),
    'test/export.spec.ts': 'export {};\n',
  };
  done(files, 'T-1');
  more(files);
  writeFiles(repo, files);
  commitMsg(repo, 'base: T-1 done');
  gitRun(repo, 'branch', '-M', 'main');
  gitRun(repo, 'switch', '-q', '-c', 'work');
  return repo;
}

it('risk:regression a branch that edits the ticket file of a ticket done on the base branch fails gate done with one plain finding (D-23)', async () => {
  const repo = doneOnMain();
  writeFiles(repo, { [P('T-1')]: readFileSync(join(repo, P('T-1')), 'utf8') + '\nA late thought.\n' });
  commitMsg(repo, 'edit a done ticket');
  const edited = await gateDone(repo, 'T-1');
  expect(edited.found.map((f) => f.rule)).toEqual(['gate.done-ticket-edited']);
  expect(edited.found[0].level).toBe('error');
  expect(edited.found[0].file).toBe(P('T-1'));
  expect(edited.found[0].reason).toContain('done on the base branch');
  expect(edited.found[0].reason).toContain('a done ticket is not edited');
  expect(edited.found[0].reason).toContain(P('T-1'));
  expect(edited.code).toBe(1);
}, 120_000);

const VERIFICATION = [
  '---', 'ticket: T-1', 'commit: abc1234', 'reviewed_on: 2026-09-10', '---', '',
  '## @ac-1 Export writes a csv', '', 'Result: pass', '', 'Evidence: test/export.spec.ts#writes-csv', '',
  '## @ac-2 Commas are escaped', '', 'Result: pass', '', 'Evidence: test/export.spec.ts#escapes-commas', '',
].join('\n');

it('risk:regression a branch that deletes a file the done ticket cites and leaves the ticket alone passes gate done (D-24)', async () => {
  const repo = doneOnMain((files) => {
    files['accord/tickets/T-1/verification.md'] = VERIFICATION;
  });
  gitRun(repo, 'rm', '-q', 'test/export.spec.ts');
  commitMsg(repo, 'delete the export spec');
  const kept = await gateDone(repo, 'T-1');
  expect(kept.found).toEqual([]);
  expect(kept.code).toBe(0);
}, 120_000);

it('risk:regression a branch that edits only the ledger of a done ticket fails with one finding that names that file (D-23 folder)', async () => {
  const repo = doneOnMain();
  writeFiles(repo, { 'accord/tickets/T-1/ledger.md': readFileSync(join(repo, 'accord/tickets/T-1/ledger.md'), 'utf8') + '- task 3 done abc1234\n' });
  commitMsg(repo, 'touch the ledger of a done ticket');
  const edited = await gateDone(repo, 'T-1');
  expect(edited.found.map((f) => f.rule)).toEqual(['gate.done-ticket-edited']);
  expect(edited.found[0].reason).toContain('accord/tickets/T-1/ledger.md');
  expect(edited.found[0].reason).not.toContain(P('T-1') + ',');
  expect(edited.code).toBe(1);
}, 120_000);

it('risk:regression a branch that deletes a record of a done ticket fails with one finding (D-23 deletion)', async () => {
  const repo = doneOnMain();
  gitRun(repo, 'rm', '-q', 'accord/tickets/T-1/review.md');
  commitMsg(repo, 'delete the review of a done ticket');
  const edited = await gateDone(repo, 'T-1');
  expect(edited.found.map((f) => f.rule)).toEqual(['gate.done-ticket-edited']);
  expect(edited.found[0].reason).toContain('accord/tickets/T-1/review.md');
  expect(edited.code).toBe(1);
}, 120_000);

it('risk:regression a ticket that becomes done inside the branch is gated by today\'s Done rules, not the frozen rule (D-23 base)', async () => {
  const repo = doneOnMain((files) => building(files, 'T-2'));
  const files: Files = {};
  done(files, 'T-2');
  writeFiles(repo, files);
  commitMsg(repo, 'verify T-2');
  const gated = await gateDone(repo, 'T-2');
  expect(gated.found.map((f) => f.rule)).not.toContain('gate.done-ticket-edited');
  expect(gated.found.length).toBeGreaterThan(0);
  expect(gated.code).toBe(1);
}, 120_000);

it('risk:regression accord lint asks a done ticket for no ruleset key (D-23 format change)', async () => {
  const repo = doneOnMain();
  expect(readFileSync(join(repo, P('T-1')), 'utf8')).not.toContain('ruleset:');
  const r = await run(['lint', '--json'], repo);
  const findings = JSON.parse(r.out).findings as Found[];
  expect(findings.filter((f) => f.file.startsWith('accord/tickets/T-1') && /ruleset/i.test(f.reason + f.rule))).toEqual([]);
}, 120_000);
