// ST-LN-59 59-ac-1 (D-07, D-16): `accord brief` names a report file for the executor and `accord task-done` refuses a task whose report is missing or lacks its lines, from the
// 0.6.0 cut-off; a ticket claimed earlier gets today's brief byte for byte and records as before. Real files and real git; the CLI runs as 0.6.0 so HEAD's pin can be 0.6.0
// while a ticket was claimed under 0.5.1 (cutoff-pin.test.ts's reason).
import { chmodSync, existsSync, mkdirSync, readFileSync, realpathSync, rmSync, utimesSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { expect, it, vi } from 'vitest';
import { REPORT_CONTRACT } from '@accord-dev/accord-core';
import { cleanup, commitAll, commitMsg, gitRun, makeLaneRepo, run, writeFiles } from './helpers/repo.js';
import { CONFIG, pinned, REPORT } from '../../../test/helpers/lane.js';

vi.mock('../package.json', async (orig) => {
  const m = await orig<{ default: Record<string, unknown> }>();
  return { default: { ...m.default, version: '0.6.0' } };
});

const REL = '.accord-reports/T-1/task-1.md';
const LEDGER = (repo: string): string => join(repo, 'accord', 'tickets', 'T-1', 'ledger.md');
const RED = 'red reason: the export wrote nothing, so no csv file existed';
const SELF = 'self-review: missing: none; extra: none; misread: none';
const NO_COMMAND = 'No test command is configured: accord/config.yml has no tests.affected and no tests.full.';
const PLAN_OFF_LINE = 'The plan stage is off for lane M: build the whole ticket as task 1; every scenario that is not @ui needs one test that proves it.';
const OFF = 'strictness:\n  stages:\n    M:\n      plan: "off"\n';

/** Make the test report newer than HEAD, as running the tests after committing would. */
const freshen = (repo: string): void => {
  const later = new Date(Date.now() + 5000);
  utimesSync(join(repo, REPORT), later, later);
};
const status = (repo: string): string => gitRun(repo, 'status', '--porcelain');
const writeReport = (repo: string, text: string): void => {
  mkdirSync(dirname(join(repo, REL)), { recursive: true });
  writeFileSync(join(repo, REL), text);
};

/** A ticket claimed under `claimPin`, then worked on, HEAD at the running version's pin (0.6.0): only the claim pin can answer as before. */
function claimed(claimPin: string, files: Record<string, string> = {}): string {
  const repo = makeLaneRepo(files);
  const head = files['accord/config.yml'] ?? CONFIG;
  writeFiles(repo, { 'accord/config.yml': head.replace(/accord: "[^"]*"/, `accord: "${claimPin}"`) });
  commitMsg(repo, 'claim: T-1');
  writeFiles(repo, { 'accord/config.yml': head, 'notes.txt': 'work after the claim\n' });
  commitAll(repo, 'T-1 work');
  freshen(repo);
  return repo;
}

it('ac-1 brief names the report file and task-done refuses a task whose report is missing or lacks its lines (ST-LN-59 59-ac-1)', async () => {
  const repo = makeLaneRepo();
  try {
    commitMsg(repo, 'claim: T-1');
    freshen(repo);
    const brief = await run(['brief', 'T-1', '1'], repo);
    expect(brief.code).toBe(0);
    const path = /^Report file: (.+)$/m.exec(brief.out)?.[1];
    expect(path, 'the brief has no Report file: line').toBeDefined();
    expect(path).not.toContain('\\');
    expect(path!.endsWith('/' + REL)).toBe(true);
    expect(realpathSync.native(dirname(path!))).toBe(realpathSync.native(dirname(join(repo, REL))));
    // right under the line: the contract the executor of every runtime reads
    expect(brief.out).toContain('Report file: ' + path + '\n' + REPORT_CONTRACT);
    for (const key of ['red reason:', 'self-review: missing:', 'extra:', 'misread:']) expect(REPORT_CONTRACT).toContain(key);
    expect(status(repo)).toBe('');

    const none = await run(['task-done', 'T-1', '1'], repo);
    expect(none.code).toBe(1);
    expect(none.out).toContain(REL);
    expect(existsSync(LEDGER(repo))).toBe(false);

    writeReport(repo, SELF + '\n');
    expect(status(repo)).toBe('');
    const noRed = await run(['task-done', 'T-1', '1'], repo);
    expect(noRed.code).toBe(1);
    expect(noRed.out).toContain('red reason:');

    writeReport(repo, RED + '\nself-review: missing: none; extra: none\n');
    const noMisread = await run(['task-done', 'T-1', '1'], repo);
    expect(noMisread.code).toBe(1);
    expect(noMisread.out).toContain('misread');
    expect(existsSync(LEDGER(repo))).toBe(false);

    writeReport(repo, RED + '\n' + SELF + '\n');
    const done = await run(['task-done', 'T-1', '1'], repo);
    expect(done.code).toBe(0);
    expect(readFileSync(LEDGER(repo), 'utf8')).toContain('- task 1 done ');
  } finally {
    cleanup(repo);
  }
}, 120_000);

it('risk:regression a ticket claimed before 0.6.0 records a task with no report file (ST-LN-59 59-ac-1)', async () => {
  const repo = claimed('0.5.1');
  try {
    const done = await run(['task-done', 'T-1', '1'], repo);
    expect(done.out).toMatch(/^recorded task 1 done at /);
    expect(done.code).toBe(0);
    expect(readFileSync(LEDGER(repo), 'utf8')).toContain('- task 1 done ');
  } finally {
    cleanup(repo);
  }
}, 120_000);

it("risk:regression a ticket claimed before 0.6.0 gets today's brief byte for byte and accord brief writes nothing (ST-LN-59 59-ac-1)", async () => {
  const plan = { 'accord/tickets/T-1/plan.md': '---\nbaseline: abc1234\n---\n\n  \n\n## Task 1: A\ncovers: @ac-1\n' };
  for (const [name, files, expected] of [
    ['with a plan', plan, (ticket: string) => ticket.replace(/\n*$/, '\n') + '\n---\n\n## Task 1: A\ncovers: @ac-1\n' + '\n---\n\n' + NO_COMMAND + '\n'],
    ['with the plan stage off', { 'accord/config.yml': CONFIG + OFF }, (ticket: string) => ticket.replace(/\n*$/, '\n') + '\n---\n\n' + PLAN_OFF_LINE + '\n\n---\n\n' + NO_COMMAND + '\n'],
  ] as const) {
    const repo = claimed('0.5.1', files);
    try {
      const before = status(repo);
      const ticket = readFileSync(join(repo, 'accord/tickets/T-1.md'), 'utf8');
      const r = await run(['brief', 'T-1', '1'], repo);
      expect(r.code, name).toBe(0);
      expect(r.out, name).toBe(expected(ticket));
      expect(r.out, name).not.toContain('Report file:');
      expect(r.out, name).not.toContain('red reason:');
      expect(existsSync(join(repo, '.accord-reports')), name).toBe(false);
      expect(status(repo), name).toBe(before);
      // a report that is already there keeps its bytes
      writeReport(repo, 'kept as written\n');
      expect((await run(['brief', 'T-1', '1'], repo)).out, name).toBe(expected(ticket));
      expect(readFileSync(join(repo, REL), 'utf8'), name).toBe('kept as written\n');
      expect(existsSync(join(repo, '.accord-reports', '.gitignore')), name).toBe(false);
    } finally {
      cleanup(repo);
    }
  }
}, 120_000);

const OLD = new Date('2000-01-01T00:00:00Z');
const PAIRS = ['--test', 'ac-1=export#writes-csv', '--test', 'ac-2=export#escapes-commas'];
const FULL = RED + '\n' + SELF + '\n';
const gitHead = (repo: string): string => gitRun(repo, 'rev-parse', 'HEAD').trim();

it('risk:regression a stale or reused report does not record a task (ST-LN-59 59-ac-1)', async () => {
  const repo = makeLaneRepo();
  try {
    commitMsg(repo, 'claim: T-1');
    freshen(repo);
    expect((await run(['brief', 'T-1', '1'], repo)).code).toBe(0);

    // a full report written before HEAD's author time is refused, naming HEAD
    writeReport(repo, FULL);
    utimesSync(join(repo, REL), OLD, OLD);
    const stale = await run(['task-done', 'T-1', '1'], repo);
    expect(stale.code).toBe(1);
    expect(stale.out).toContain(REL + ' was written before HEAD');
    expect(stale.out).toContain(gitHead(repo).slice(0, 12));
    expect(existsSync(LEDGER(repo))).toBe(false);

    // a re-dispatch starts with none: the brief removes the old report, and task-done names it missing
    writeReport(repo, FULL);
    expect((await run(['brief', 'T-1', '1'], repo)).code).toBe(0);
    expect(existsSync(join(repo, REL))).toBe(false);
    const cleared = await run(['task-done', 'T-1', '1'], repo);
    expect(cleared.code).toBe(1);
    expect(cleared.out).toContain(REL + ' is missing');

    // a recorded task is answered as before: no report asked
    writeReport(repo, FULL);
    expect((await run(['task-done', 'T-1', '1'], repo)).code).toBe(0);
    rmSync(join(repo, REL));
    const again = await run(['task-done', 'T-1', '1'], repo);
    expect(again.code).toBe(0);
    expect(again.out).toBe('task 1 of T-1 is already recorded in accord/tickets/T-1/ledger.md\n');
  } finally {
    cleanup(repo);
  }

  // the plan-off task 1 goes through the same check
  const off = makeLaneRepo({ 'accord/config.yml': CONFIG + OFF });
  try {
    commitMsg(off, 'claim: T-1');
    freshen(off);
    const brief = await run(['brief', 'T-1', '1'], off);
    expect(brief.out).toContain('Report file: ');
    expect(brief.out).toContain(REPORT_CONTRACT);
    const none = await run(['task-done', 'T-1', '1', ...PAIRS], off);
    expect(none.code).toBe(1);
    expect(none.out).toContain(REL + ' is missing');
    writeReport(off, FULL);
    utimesSync(join(off, REL), OLD, OLD);
    expect((await run(['task-done', 'T-1', '1', ...PAIRS], off)).out).toContain('was written before HEAD');
    writeReport(off, RED + '\n');
    expect((await run(['task-done', 'T-1', '1', ...PAIRS], off)).out).toContain('"self-review:"');
    writeReport(off, FULL);
    const done = await run(['task-done', 'T-1', '1', ...PAIRS], off);
    expect(done.code).toBe(0);
    expect(readFileSync(LEDGER(off), 'utf8')).toContain('- task 1 done ');
  } finally {
    cleanup(off);
  }

  // two checkouts of one clone each read their own report: the path is per checkout root
  const first = makeLaneRepo();
  const second = first + '-wt';
  try {
    commitMsg(first, 'claim: T-1');
    gitRun(first, 'worktree', 'add', '-q', '-b', 'wt-branch', second);
    freshen(first);
    const later = new Date(Date.now() + 5000);
    utimesSync(join(second, REPORT), later, later);
    const a = await run(['brief', 'T-1', '1'], first);
    const b = await run(['brief', 'T-1', '1'], second);
    const pathA = /^Report file: (.+)$/m.exec(a.out)?.[1];
    const pathB = /^Report file: (.+)$/m.exec(b.out)?.[1];
    expect(pathA).toBeDefined();
    expect(pathB).toBeDefined();
    expect(pathA).not.toBe(pathB);
    expect(realpathSync.native(dirname(pathB!))).toBe(realpathSync.native(dirname(join(second, REL))));
    writeReport(first, FULL);
    const refused = await run(['task-done', 'T-1', '1'], second);
    expect(refused.code).toBe(1);
    expect(refused.out).toContain(REL + ' is missing');
    expect((await run(['task-done', 'T-1', '1'], first)).code).toBe(0);
    writeReport(second, FULL);
    expect((await run(['task-done', 'T-1', '1'], second)).code).toBe(0);
  } finally {
    cleanup(second);
    cleanup(first);
  }
}, 180_000);

it('risk:regression the report check and its contract hold in a repository whose runtimes install no accord agent (ST-LN-59 59-ac-1)', async () => {
  const seen: string[] = [];
  for (const runtimes of ['runtimes: [claude]', 'runtimes: [codex, cursor, copilot]']) {
    const repo = makeLaneRepo({ 'accord/config.yml': CONFIG.replace('runtimes: [claude]', runtimes) });
    try {
      expect(readFileSync(join(repo, 'accord', 'config.yml'), 'utf8')).toContain(runtimes);
      commitMsg(repo, 'claim: T-1');
      freshen(repo);
      const brief = await run(['brief', 'T-1', '1'], repo);
      expect(brief.code, runtimes).toBe(0);
      const path = /^Report file: (.+)$/m.exec(brief.out)?.[1];
      expect(path, runtimes).toBeDefined();
      expect(brief.out, runtimes).toContain('Report file: ' + path + '\n' + REPORT_CONTRACT);
      const none = await run(['task-done', 'T-1', '1'], repo);
      expect(none.code, runtimes).toBe(1);
      expect(none.out, runtimes).toContain(REL);
      seen.push(brief.out.replace(path!, '<path>'));
    } finally {
      cleanup(repo);
    }
  }
  // the two briefs differ only in the config's runtimes line, which sits in the ticket text of neither: whole text equal
  expect(seen[1]).toBe(seen[0]);
}, 120_000);

it("risk:regression a failed claim read gives the brief's report lines, its write and the check (ST-LN-59 59-ac-1)", async () => {
  const repo = makeLaneRepo();
  try {
    const base = commitAll(repo, 'base');
    writeFiles(repo, { 'accord/config.yml': pinned('0.5.1') + '# claimed\n' });
    commitMsg(repo, 'claim: T-1');
    writeFiles(repo, { 'accord/config.yml': CONFIG, 'notes.txt': 'work after the claim\n' });
    commitAll(repo, 'T-1 work');
    freshen(repo);
    // the claim commit's parent is lost: `git log` cannot walk to it, so the claim pin cannot be read
    const object = join(repo, '.git', 'objects', base.slice(0, 2), base.slice(2));
    chmodSync(object, 0o666);
    rmSync(object, { force: true });

    const brief = await run(['brief', 'T-1', '1'], repo);
    expect(brief.code).toBe(0);
    expect(brief.out).toContain('Report file: ');
    expect(brief.out).toContain(REPORT_CONTRACT);
    expect(existsSync(join(repo, '.accord-reports', '.gitignore'))).toBe(true);
    const none = await run(['task-done', 'T-1', '1'], repo);
    expect(none.code).toBe(1);
    expect(none.out).toContain(REL);
  } finally {
    cleanup(repo);
  }
}, 120_000);
