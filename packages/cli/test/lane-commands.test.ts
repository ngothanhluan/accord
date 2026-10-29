// The workflow-layer commands end to end, in-process through runCli (STACK Decision 7), each against its
// own sandbox so a write can never reach a fixture.
import { existsSync, readFileSync, rmSync, statSync, utimesSync, writeFileSync } from 'node:fs';
import { platform } from 'node:os';
import { join } from 'node:path';
import { templates } from '@accord-dev/accord-core';
import { describe, expect, it } from 'vitest';
import { cleanup, commitAll, commitAllAt, gitRun, makeEmptyRepo, makeLaneRepo, makeRepo, run, writeFiles } from './helpers/repo.js';
import { CONFIG, junit, LANE_BODY, laneTicket, PLAN, REPORT } from '../../../test/helpers/lane.js';
import { taskNumber } from '../src/commands/lane-args.js';
import { commitSeconds } from '../src/commands/task-done.js';

const ticketText = (repo: string, id = 'T-1') => readFileSync(join(repo, 'accord', 'tickets', id + '.md'), 'utf8');

describe('accord approve', () => {
  it('writes approved_hash once and is a no-op the second time', async () => {
    const repo = makeLaneRepo();
    try {
      const first = await run(['approve', 'T-1'], repo);
      expect(first.code).toBe(0);
      expect(first.out).toMatch(/^approved accord\/tickets\/T-1\.md at fnv1a64:[0-9a-f]{16}\n$/);
      const text = ticketText(repo);
      expect(text).toMatch(/\napproved_hash: "fnv1a64:[0-9a-f]{16}"\n/);
      const second = await run(['approve', 'T-1'], repo);
      expect(second.code).toBe(0);
      expect(second.out).toMatch(/^already approved accord\/tickets\/T-1\.md/);
      expect(ticketText(repo)).toBe(text);
    } finally {
      cleanup(repo);
    }
  });

  it('refuses a ticket without lane, exit 2', async () => {
    const repo = makeLaneRepo({ 'accord/tickets/T-2.md': laneTicket('T-2', { lane: '' }) });
    try {
      const r = await run(['approve', 'T-2'], repo);
      expect(r.code).toBe(2);
      expect(r.err).toContain('accord/tickets/T-2.md has no lane:');
    } finally {
      cleanup(repo);
    }
  });

  it('refuses an unknown ticket, exit 2', async () => {
    const repo = makeLaneRepo();
    try {
      const r = await run(['approve', 'NOPE'], repo);
      expect(r.code).toBe(2);
      expect(r.err).toContain('no ticket NOPE in accord/tickets/');
    } finally {
      cleanup(repo);
    }
  });

  it('after approval gate ready passes', async () => {
    const repo = makeLaneRepo();
    try {
      expect((await run(['gate', 'ready', 'T-1'], repo)).code).toBe(1);
      await run(['approve', 'T-1'], repo);
      expect((await run(['gate', 'ready', 'T-1'], repo)).code).toBe(0);
    } finally {
      cleanup(repo);
    }
  });
});

const REPORT_PATH = (repo: string) => join(repo, 'reports', 'junit.xml');
const LEDGER_PATH = (repo: string) => join(repo, 'accord', 'tickets', 'T-1', 'ledger.md');
const ledger = (repo: string) => readFileSync(LEDGER_PATH(repo), 'utf8');
/** Make the report newer than HEAD, as running the tests after committing would. */
const freshen = (repo: string, file = REPORT_PATH(repo)) => {
  const later = new Date(Date.now() + 5000);
  utimesSync(file, later, later);
};
const OLD = new Date('2000-01-01T00:00:00Z');

describe('accord task-done', () => {
  it('records a task whose verify cases passed, once', async () => {
    const repo = makeLaneRepo();
    try {
      const sha = commitAll(repo);
      freshen(repo);
      const first = await run(['task-done', 'T-1', '1'], repo);
      expect(first.code).toBe(0);
      expect(first.out).toBe(`recorded task 1 done at ${sha.slice(0, 12)} in accord/tickets/T-1/ledger.md\n`);
      expect(ledger(repo)).toContain(`- task 1 done ${sha.slice(0, 12)}\n`);
      const second = await run(['task-done', 'T-1', '1'], repo);
      expect(second.code).toBe(0);
      expect(second.out).toBe('task 1 of T-1 is already recorded in accord/tickets/T-1/ledger.md\n');
      expect(ledger(repo).match(/task 1 done/g)).toHaveLength(1);
    } finally {
      cleanup(repo);
    }
  });

  it('says already recorded after the ledger line is committed and the report is older than HEAD', async () => {
    const repo = makeLaneRepo();
    try {
      commitAll(repo);
      freshen(repo);
      expect((await run(['task-done', 'T-1', '1'], repo)).code).toBe(0);
      commitAll(repo);
      utimesSync(REPORT_PATH(repo), OLD, OLD);
      const later = new Date(Date.now() + 5000);
      utimesSync(join(repo, 'reports', 'junit.xml'), later, later); // task-done needs a report newer than the commit
      const again = await run(['task-done', 'T-1', '1'], repo);
      expect(again.code).toBe(0);
      expect(again.out).toBe('task 1 of T-1 is already recorded in accord/tickets/T-1/ledger.md\n');
      expect(ledger(repo).match(/task 1 done/g)).toHaveLength(1);
    } finally {
      cleanup(repo);
    }
  });

  it('reads a CRLF ledger as it reads an LF one', async () => {
    const crlf = '# Ledger\r\n\r\n## Tasks\r\n- task 1 done abc1234\r\n';
    const repo = makeLaneRepo({ 'accord/tickets/T-1/ledger.md': crlf });
    try {
      const sha = commitAll(repo);
      freshen(repo);
      const later = new Date(Date.now() + 5000);
      utimesSync(join(repo, 'reports', 'junit.xml'), later, later); // task-done needs a report newer than the commit
      const again = await run(['task-done', 'T-1', '1'], repo);
      expect(again.code).toBe(0);
      expect(again.out).toBe('task 1 of T-1 is already recorded in accord/tickets/T-1/ledger.md\n');
      expect(ledger(repo)).toBe(crlf);
      expect((await run(['task-done', 'T-1', '2'], repo)).code).toBe(0);
      expect(ledger(repo)).toBe(`# Ledger\n\n## Tasks\n- task 1 done abc1234\n- task 2 done ${sha.slice(0, 12)}\n`);
    } finally {
      cleanup(repo);
    }
  });

  it('refuses a failed verify case, exit 1, and writes nothing', async () => {
    const repo = makeLaneRepo({
      'reports/junit.xml': junit({ 'export#writes-csv': 'failed', 'export#escapes-commas': 'passed' }),
    });
    try {
      commitAll(repo);
      freshen(repo);
      const r = await run(['task-done', 'T-1', '1'], repo);
      expect(r.code).toBe(1);
      expect(r.out).toBe('task 1 of T-1 is not done:\n  export#writes-csv is recorded failed in reports/junit.xml\n');
      expect(existsSync(LEDGER_PATH(repo))).toBe(false);
    } finally {
      cleanup(repo);
    }
  });

  it('refuses a report older than the commit, exit 1, and writes nothing', async () => {
    const repo = makeLaneRepo();
    try {
      commitAll(repo);
      utimesSync(REPORT_PATH(repo), OLD, OLD);
      const r = await run(['task-done', 'T-1', '1'], repo);
      expect(r.code).toBe(1);
      expect(r.out).toBe(
        'task 1 of T-1 is not done:\n  reports/junit.xml was written before the last commit; run the tests again\n',
      );
      expect(existsSync(LEDGER_PATH(repo))).toBe(false);
    } finally {
      cleanup(repo);
    }
  });

  it('prints a backslashed tests.report with forward slashes (D-51)', async () => {
    const repo = makeLaneRepo({
      'accord/config.yml': CONFIG.replace(`report: ${REPORT}`, 'report: "out\\\\report.xml"'),
      'out/report.xml': junit({ 'export#writes-csv': 'passed' }),
    });
    try {
      commitAll(repo);
      const file = join(repo, 'out', 'report.xml');
      utimesSync(file, OLD, OLD);
      const stale = await run(['task-done', 'T-1', '1'], repo);
      expect(stale.code).toBe(1);
      expect(stale.out).toContain('  out/report.xml was written before the last commit');
      freshen(repo, file);
      const missing = await run(['task-done', 'T-1', '2'], repo);
      expect(missing.out).toContain('  export#escapes-commas is not in out/report.xml\n');
      expect(stale.out + missing.out).not.toContain('\\');
    } finally {
      cleanup(repo);
    }
  });

  it('refuses a task number that is not one, and a repository with no commit, exit 2', async () => {
    const repo = makeLaneRepo();
    try {
      for (const bad of ['x']) {
        const r = await run(['task-done', 'T-1', bad], repo);
        expect(r.code, bad).toBe(2);
        expect(r.err, bad).toContain('not a task number: ' + bad);
      }
      const r = await run(['task-done', 'T-1', '1'], repo);
      expect(r.code).toBe(2);
      expect(r.err).toContain('the repository has no commit');
    } finally {
      cleanup(repo);
    }
  });

  it('risk:parsing a task number of 0, 01, -1 or 1.5 is refused', () => {
    for (const bad of ['0', '01', '-1', '1.5']) {
      expect(() => taskNumber(bad), bad).toThrow('not a task number: ' + bad);
    }
  });

  it('refuses an unknown ticket and a ticket without lane, exit 2', async () => {
    const repo = makeLaneRepo({ 'accord/tickets/T-2.md': laneTicket('T-2', { lane: '' }) });
    try {
      commitAll(repo);
      const unknown = await run(['task-done', 'NOPE', '1'], repo);
      expect(unknown.code).toBe(2);
      expect(unknown.err).toContain('no ticket NOPE in accord/tickets/');
      const plain = await run(['task-done', 'T-2', '1'], repo);
      expect(plain.code).toBe(2);
      expect(plain.err).toContain('accord/tickets/T-2.md has no lane:');
      // D-51: a refusal that echoes a backslash prints it as a forward slash.
      const slashed = await run(['task-done', 'NO\\PE', '1'], repo);
      expect(slashed.code).toBe(2);
      expect(slashed.err).toBe('no ticket NO/PE in accord/tickets/\n');
    } finally {
      cleanup(repo);
    }
  });

  it('reads the HEAD commit time only as whole seconds; anything else is an environment error', () => {
    expect(commitSeconds('1760000000\n')).toBe(1760000000);
    for (const bad of ['', '\n', 'abc', '-5', '1.5', '17e8']) {
      expect(() => commitSeconds(bad), JSON.stringify(bad)).toThrow('git printed no commit time for HEAD');
    }
  });
});

describe('accord brief', () => {
  it('prints the ticket verbatim, then the one task', async () => {
    const repo = makeLaneRepo();
    try {
      const r = await run(['brief', 'T-1', '2'], repo);
      expect(r.code).toBe(0);
      expect(r.out.startsWith('---\nid: "T-1"\n')).toBe(true);
      expect(r.out).toContain('\n---\n\n# Plan\n\n## Task 2: Escaping\ncovers: @ac-2\n');
      expect(r.out).not.toContain('Task 1: Writer');
    } finally {
      cleanup(repo);
    }
  });

  it('refuses a task the plan does not have, exit 2', async () => {
    const repo = makeLaneRepo();
    try {
      const r = await run(['brief', 'T-1', '9'], repo);
      expect(r.code).toBe(2);
      expect(r.err).toContain('accord/tickets/T-1/plan.md has no "## Task 9"');
    } finally {
      cleanup(repo);
    }
  });
});

const BRIEF_RULE = 'Shared rule: run the build first.';
const NO_COMMAND = 'No test command is configured: accord/config.yml has no tests.affected and no tests.full.';
const ONLY = 'This is the only test command the executor runs for this task.';
const withTests = (lines: string[]) => CONFIG.replace('  report: ' + REPORT + '\n', '  report: ' + REPORT + '\n' + lines.map((l) => '  ' + l + '\n').join(''));

it('ac-1 a brief carries the plan preamble', async () => {
  const repo = makeLaneRepo({
    'accord/tickets/T-1/plan.md': '---\nbaseline: abc1234\n---\n\n' + BRIEF_RULE + '\n\n## Task 1: A\ncovers: @ac-1\n\n## Task 2: B\ncovers: @ac-2\n',
  });
  try {
    const ticket = readFileSync(join(repo, 'accord/tickets/T-1.md'), 'utf8');
    const r = await run(['brief', 'T-1', '2'], repo);
    expect(r.code).toBe(0);
    expect(r.out).toBe(ticket.replace(/\n*$/, '\n') + '\n---\n\n' + BRIEF_RULE + '\n\n## Task 2: B\ncovers: @ac-2\n' + '\n---\n\n' + NO_COMMAND + '\n');
    expect(r.out).not.toContain('Task 1');
  } finally {
    cleanup(repo);
  }
});

it('ac-2 a plan with no preamble gives the same brief as before', async () => {
  const repo = makeLaneRepo({
    'accord/tickets/T-1/plan.md': '---\nbaseline: abc1234\n---\n\n  \n\n## Task 1: A\ncovers: @ac-1\n',
  });
  try {
    const ticket = readFileSync(join(repo, 'accord/tickets/T-1.md'), 'utf8');
    const r = await run(['brief', 'T-1', '1'], repo);
    expect(r.code).toBe(0);
    expect(r.out).toBe(ticket.replace(/\n*$/, '\n') + '\n---\n\n## Task 1: A\ncovers: @ac-1\n' + '\n---\n\n' + NO_COMMAND + '\n');
  } finally {
    cleanup(repo);
  }
});

describe('accord review-package', () => {
  it('prints commits, stat, and diff since the base', async () => {
    const repo = makeLaneRepo();
    try {
      const base = commitAll(repo);
      writeFiles(repo, { 'src/x.ts': 'export const x = 1;\n' });
      commitAll(repo);
      const r = await run(['review-package', 'T-1', '--base', base], repo);
      expect(r.code).toBe(0);
      expect(r.out).toContain('## Commits\n');
      expect(r.out).toContain(' fixture\n');
      expect(r.out).toContain('## Stat\n');
      expect(r.out).toContain('src/x.ts');
      expect(r.out).toContain('+export const x = 1;');
    } finally {
      cleanup(repo);
    }
  });

  it('refuses a malformed or unknown base, exit 2', async () => {
    const repo = makeLaneRepo();
    try {
      commitAll(repo);
      expect((await run(['review-package', 'T-1', '--base', 'no such ref'], repo)).code).toBe(2);
      const r = await run(['review-package', 'T-1', '--base', 'deadbeef'], repo);
      expect(r.code).toBe(2);
      expect(r.err).toContain('unknown base ref: deadbeef');
      expect((await run(['review-package', 'T-1', '--base', '-p'], repo)).err).toBe('not a git ref: -p\n');
    } finally {
      cleanup(repo);
    }
  });

  it('accepts a relative ref such as HEAD~1', async () => {
    const repo = makeLaneRepo();
    try {
      commitAll(repo);
      writeFiles(repo, { 'src/x.ts': 'export const x = 1;\n' });
      commitAll(repo);
      const r = await run(['review-package', 'T-1', '--base', 'HEAD~1'], repo);
      expect(r.code).toBe(0);
      expect(r.out).toContain('+export const x = 1;');
    } finally {
      cleanup(repo);
    }
  });
});

describe('plan baseline', () => {
  const withBaseline = (sha: string) => PLAN.replace('abc1234', sha);

  it('gate plan passes with the first commit as baseline and fails closed on an unknown one', async () => {
    const repo = makeLaneRepo();
    try {
      await run(['approve', 'T-1'], repo);
      const first = commitAll(repo);
      writeFiles(repo, { 'accord/tickets/T-1/plan.md': withBaseline(first) });
      commitAll(repo);
      const ok = await run(['gate', 'plan', 'T-1'], repo);
      expect(ok.code).toBe(0);
      expect(ok.out).toContain('gate.tests-baseline-missing');
      writeFiles(repo, { 'accord/tickets/T-1/plan.md': withBaseline('0000000') });
      const r = await run(['gate', 'plan', 'T-1'], repo);
      expect(r.code).toBe(1);
      expect(r.out).toContain('gate.plan-baseline-unknown');
      // A bad baseline never breaks the commands that do not gate on it.
      expect((await run(['status'], repo)).code).toBe(0);
    } finally {
      cleanup(repo);
    }
  });

  it('review-package defaults its base to the plan baseline', async () => {
    const repo = makeLaneRepo();
    try {
      const first = commitAll(repo);
      writeFiles(repo, { 'accord/tickets/T-1/plan.md': withBaseline(first), 'src/x.ts': 'export const x = 1;\n' });
      commitAll(repo);
      const r = await run(['review-package', 'T-1'], repo);
      expect(r.code).toBe(0);
      expect(r.out).toContain(`(${first}...HEAD)`);
      expect(r.out).toContain('+export const x = 1;');
    } finally {
      cleanup(repo);
    }
  });

  it('review-package with no --base and no baseline exits 2', async () => {
    const repo = makeLaneRepo({ 'accord/tickets/T-1/plan.md': '## Task 1: A\n' });
    try {
      commitAll(repo);
      const r = await run(['review-package', 'T-1'], repo);
      expect(r.code).toBe(2);
      expect(r.err).toContain('no --base given and plan.md records no baseline:');
    } finally {
      cleanup(repo);
    }
  });
});

describe('brief and review-package edge cases', () => {
  it('brief keeps a fenced "## Task" line inside its task and stops at the next real one', async () => {
    const plan = [
      '# Plan',
      '',
      '## Task 1: First',
      'covers: @ac-1',
      '```md',
      '## Task 9: x',
      '```',
      '',
      '## Task 2: Second',
      'covers: @ac-2',
      '',
    ].join('\n');
    const repo = makeLaneRepo({ 'accord/tickets/T-1/plan.md': plan });
    try {
      const r = await run(['brief', 'T-1', '1'], repo);
      expect(r.code).toBe(0);
      expect(r.out).toContain('```md\n## Task 9: x\n```\n');
      expect(r.out).not.toContain('Task 2: Second');
    } finally {
      cleanup(repo);
    }
  });

  it('brief refuses a ticket with no plan, exit 2', async () => {
    const repo = makeLaneRepo();
    try {
      rmSync(join(repo, 'accord', 'tickets', 'T-1', 'plan.md'));
      const r = await run(['brief', 'T-1', '1'], repo);
      expect(r.code).toBe(2);
      expect(r.err).toContain('no plan at accord/tickets/T-1/plan.md');
    } finally {
      cleanup(repo);
    }
  });

  it('both refuse a ticket without lane, exit 2', async () => {
    const repo = makeLaneRepo({ 'accord/tickets/T-2.md': laneTicket('T-2', { lane: '' }) });
    try {
      for (const argv of [['brief', 'T-2', '1'], ['review-package', 'T-2']]) {
        const r = await run(argv, repo);
        expect(r.code).toBe(2);
        expect(r.err).toContain('has no lane:');
      }
    } finally {
      cleanup(repo);
    }
  });

  it('review-package on an empty range prints none and exits 0', async () => {
    const repo = makeLaneRepo();
    try {
      const head = commitAll(repo);
      const r = await run(['review-package', 'T-1', '--base', head], repo);
      expect(r.code).toBe(0);
      expect(r.out).toContain('## Commits\n\n(none)');
      expect(r.out).toContain('## Diff\n\n(no changes)');
    } finally {
      cleanup(repo);
    }
  });

  it('review-package refuses an unrelated base cleanly, exit 2', async () => {
    const repo = makeLaneRepo();
    try {
      commitAll(repo);
      const home = gitRun(repo, 'rev-parse', '--abbrev-ref', 'HEAD').trim();
      gitRun(repo, 'checkout', '-q', '--orphan', 'other');
      writeFiles(repo, { 'o.txt': 'o\n' });
      const orphan = commitAll(repo);
      gitRun(repo, 'checkout', '-q', home);
      const r = await run(['review-package', 'T-1', '--base', orphan], repo);
      expect(r.code).toBe(2);
      expect(r.err).toContain('cannot diff');
      expect(r.err).not.toContain('Command failed');
    } finally {
      cleanup(repo);
    }
  });
});

describe('accord tests baseline', () => {
  const report = junit({ 'export#writes-csv': 'passed', 'export#escapes-commas': 'passed', 'util#formats-dates': 'passed' });

  it('writes the untraced cases once and refuses a second time', async () => {
    const repo = makeLaneRepo({ [REPORT]: report });
    try {
      const first = await run(['tests', 'baseline'], repo);
      expect(first.code).toBe(0);
      expect(first.out).toBe('wrote 1 case id to accord/tests-baseline.txt\n');
      const text = readFileSync(join(repo, 'accord', 'tests-baseline.txt'), 'utf8');
      expect(text.split('\n').filter((l) => l !== '' && !l.startsWith('#'))).toEqual(['util#formats-dates']);
      const second = await run(['tests', 'baseline'], repo);
      expect(second.code).toBe(2);
      expect(second.err).toContain('accord/tests-baseline.txt already exists');
      expect(readFileSync(join(repo, 'accord', 'tests-baseline.txt'), 'utf8')).toBe(text);
      expect((await run(['lint'], repo)).out).not.toContain('lint.test-untraced');
    } finally {
      cleanup(repo);
    }
  });

  it('refuses a repository with no tests.report, exit 2', async () => {
    const repo = makeLaneRepo({ 'accord/config.yml': CONFIG.replace(/tests:\n {2}report: .*\n/, '') });
    try {
      const r = await run(['tests', 'baseline'], repo);
      expect(r.code).toBe(2);
      expect(r.err).toContain('no tests.report');
      expect(existsSync(join(repo, 'accord', 'tests-baseline.txt'))).toBe(false);
    } finally {
      cleanup(repo);
    }
  });

  it('refuses when the configured report file is missing, exit 2, writing nothing', async () => {
    const repo = makeLaneRepo();
    try {
      rmSync(join(repo, ...REPORT.split('/')));
      const r = await run(['tests', 'baseline'], repo);
      expect(r.code).toBe(2);
      expect(r.err).toContain('was not found');
      expect(r.err).not.toContain('\\');
      expect(existsSync(join(repo, 'accord', 'tests-baseline.txt'))).toBe(false);
    } finally {
      cleanup(repo);
    }
  });

  it('prints a backslashed tests.report with forward slashes (D-51)', async () => {
    const repo = makeLaneRepo({ 'accord/config.yml': CONFIG.replace('report: ' + REPORT, 'report: reports\\junit.xml') });
    try {
      rmSync(join(repo, ...REPORT.split('/')));
      const r = await run(['tests', 'baseline'], repo);
      expect(r.code).toBe(2);
      expect(r.err).toBe('tests.report "reports/junit.xml" was not found; run the tests first\n');
    } finally {
      cleanup(repo);
    }
  });

  it('round-trips a case id that starts with # and skips empty-named cases with a notice', async () => {
    const xml =
      '<testsuites><testsuite name="all">' +
      '<testcase classname="export" name="writes-csv"/><testcase classname="export" name="escapes-commas"/>' +
      '<testcase name="#123 handles x"/><testcase name=""/>' +
      '</testsuite></testsuites>\n';
    const repo = makeLaneRepo({ [REPORT]: xml });
    try {
      const r = await run(['tests', 'baseline'], repo);
      expect(r.code).toBe(0);
      expect(r.out).toBe('wrote 1 case id to accord/tests-baseline.txt\n');
      expect(r.err).toContain('skipped 1 case(s) with an empty name');
      const text = readFileSync(join(repo, 'accord', 'tests-baseline.txt'), 'utf8');
      expect(text.split('\n').filter((l) => l !== '' && !l.startsWith('# '))).toEqual(['#123-handles-x']);
      expect((await run(['lint'], repo)).out).not.toContain('#123-handles-x');
    } finally {
      cleanup(repo);
    }
  });
});

describe('status, claims, and next', () => {
  it('a branch t/<id> claims the ticket for its tip author, ids with dots and underscores included', async () => {
    const repo = makeLaneRepo({ 'accord/tickets/T-1.2_a.md': laneTicket('T-1.2_a') });
    try {
      commitAll(repo);
      gitRun(repo, 'branch', 't/T-1.2_a');
      const result = await run(['status', '--json'], repo);
      const rows = JSON.parse(result.out) as { id: string; claimedBy?: string }[];
      expect(rows.find((r) => r.id === 'T-1.2_a')?.claimedBy).toBe('fixture@example.invalid');
      expect(rows.find((r) => r.id === 'T-1')).not.toHaveProperty('claimedBy');
      const table = (await run(['status'], repo)).out;
      expect(table).toContain('fixture@example.invalid');
      expect(result.out + table).not.toContain('\\');
    } finally {
      cleanup(repo);
    }
  });

  it('a pushed branch under refs/remotes/<remote>/t/<id> claims the ticket too', async () => {
    const repo = makeLaneRepo();
    try {
      commitAll(repo);
      gitRun(repo, 'update-ref', 'refs/remotes/origin/t/T-1', 'HEAD');
      const rows = JSON.parse((await run(['status', '--json'], repo)).out) as { id: string; claimedBy?: string }[];
      expect(rows.find((r) => r.id === 'T-1')?.claimedBy).toBe('fixture@example.invalid');
    } finally {
      cleanup(repo);
    }
  });

  it('the pushed claim wins over a local branch of the same name with a different tip author', async () => {
    const repo = makeLaneRepo();
    try {
      commitAll(repo);
      gitRun(repo, 'branch', 't/T-1');
      const sha = gitRun(
        repo,
        '-c', 'user.email=remote@example.invalid',
        '-c', 'user.name=remote',
        'commit-tree', 'HEAD^{tree}', '-p', 'HEAD', '-m', 'remote',
      ).trim();
      gitRun(repo, 'update-ref', 'refs/remotes/origin/t/T-1', sha);
      const rows = JSON.parse((await run(['status', '--json'], repo)).out) as { id: string; claimedBy?: string }[];
      expect(rows.find((r) => r.id === 'T-1')?.claimedBy).toBe('remote@example.invalid');
    } finally {
      cleanup(repo);
    }
  });

  it('a broken claim ref is an environment error, never a silently unclaimed ticket', async () => {
    const repo = makeLaneRepo();
    try {
      commitAll(repo);
      writeFiles(repo, { '.git/refs/heads/t/T-1': '1111111111111111111111111111111111111111\n' });
      const result = await run(['next'], repo);
      expect(result.code).toBe(2);
      expect(result.err).toContain('git for-each-ref failed');
      expect(result.out).toBe('');
    } finally {
      cleanup(repo);
    }
  });

  it('a ticket without lane is unchanged by a t/<id> branch, in the table and under --json', async () => {
    const repo = makeEmptyRepo();
    try {
      writeFiles(repo, { 'accord/config.yml': CONFIG, 'accord/tickets/L-1.md': laneTicket('L-1', { lane: '' }) });
      commitAll(repo);
      const before = [await run(['status'], repo), await run(['status', '--json'], repo)];
      gitRun(repo, 'branch', 't/L-1');
      const after = [await run(['status'], repo), await run(['status', '--json'], repo)];
      expect(after).toEqual(before);
      expect(before[0].out.split('\n')[0]).not.toContain('stage');
      const row = (JSON.parse(before[1].out) as Record<string, unknown>[])[0];
      for (const key of ['lane', 'stage', 'tasksDone', 'tasksTotal', 'dependsOn', 'blockedBy', 'claimedBy', 'branch', 'title']) {
        expect(row).not.toHaveProperty(key);
      }
    } finally {
      cleanup(repo);
    }
  });

  it('the status table gains stage, who, and blocked by columns when a lane ticket exists', async () => {
    const repo = makeLaneRepo();
    try {
      const out = (await run(['status'], repo)).out;
      expect(out.split('\n')[0]).toMatch(/stage\s+who\s+blocked by\s+tracker/);
      expect(out).toContain('intent');
    } finally {
      cleanup(repo);
    }
  });

  // makeLaneRepo always writes a plan, but it is never committed, so the approved ticket sits at stage plan.
  it('next lists an approved, Ready, unclaimed ticket, and nothing once it is claimed', async () => {
    const repo = makeLaneRepo();
    try {
      await run(['approve', 'T-1'], repo);
      expect((await run(['next'], repo)).out).toBe('no ticket is ready to pick up\n');
      expect((await run(['gate', 'ready', 'T-1'], repo)).code).toBe(0);
      const listed = await run(['next'], repo);
      expect(listed.code).toBe(0);
      expect(listed.out).toContain('T-1');
      expect(listed.out.split('\n').find((l) => l.includes('T-1'))).toContain('plan');
      const json = JSON.parse((await run(['next', '--json'], repo)).out) as { id: string }[];
      expect(json.map((r) => r.id)).toEqual(['T-1']);
      commitAll(repo);
      gitRun(repo, 'branch', 't/T-1');
      expect((await run(['next'], repo)).out).toBe('no ticket is ready to pick up\n');
      expect((await run(['next', '--json'], repo)).out).toBe('[]\n');
    } finally {
      cleanup(repo);
    }
  });
});

describe('accord anchor', () => {
  it('anchors the ticket the current branch names', async () => {
    const repo = makeLaneRepo();
    try {
      commitAll(repo);
      gitRun(repo, 'checkout', '-q', '-b', 't/T-1');
      const r = await run(['anchor'], repo);
      expect(r.code).toBe(0);
      expect(r.out.startsWith('# Anchor: T-1 "Export"\n')).toBe(true);
    } finally {
      cleanup(repo);
    }
  });

  it('prints nothing on a branch that names no ticket', async () => {
    const repo = makeLaneRepo();
    try {
      commitAll(repo);
      const r = await run(['anchor'], repo);
      expect(r).toMatchObject({ code: 0, out: '' });
    } finally {
      cleanup(repo);
    }
  });

  it('prints nothing on a detached HEAD, exit 0', async () => {
    const repo = makeLaneRepo();
    try {
      commitAll(repo);
      gitRun(repo, 'checkout', '-q', '--detach');
      const r = await run(['anchor'], repo);
      expect(r).toMatchObject({ code: 0, out: '' });
    } finally {
      cleanup(repo);
    }
  });

  it('refuses an explicit id that is not a lane ticket, exit 2', async () => {
    const repo = makeLaneRepo();
    try {
      const r = await run(['anchor', 'NOPE'], repo);
      expect(r.code).toBe(2);
      expect(r.err).toContain('no ticket NOPE in accord/tickets/');
    } finally {
      cleanup(repo);
    }
  });
});

describe('accord new ticket --lane', () => {
  it('writes a lane story from ticket-lane.md with the lane set', async () => {
    const repo = makeRepo('valid-build');
    try {
      const r = await run(['new', 'ticket', 'NEW-1', '--lane', 'L'], repo);
      expect(r.code).toBe(0);
      const text = ticketText(repo, 'NEW-1');
      expect(text).toContain('id: "NEW-1"');
      expect(text).toMatch(/\nlane: "L"/);
      expect(text).toContain('\n## Vetoes\n');
      expect(text).not.toContain('\n## Requirements\n');
    } finally {
      cleanup(repo);
    }
  });

  it('an epic with --lane uses epic-lane.md', async () => {
    const repo = makeRepo('valid-build');
    try {
      await run(['new', 'ticket', 'EP-1', '--type', 'epic', '--lane', 'P'], repo);
      const text = ticketText(repo, 'EP-1');
      // setFrontmatterKey double-quotes every string it writes (D-45).
      expect(text).toContain('type: "epic"');
      expect(text).toMatch(/\nlane: "P"/);
      expect(text).not.toContain('## Acceptance criteria');
    } finally {
      cleanup(repo);
    }
  });

  it('an epic in lane M is refused, exit 2, nothing written', async () => {
    const repo = makeRepo('valid-build');
    try {
      const r = await run(['new', 'ticket', 'EP-2', '--type', 'epic', '--lane', 'M'], repo);
      expect(r.code).toBe(2);
      expect(r.err).toContain('an epic is lane L or P, not M');
      expect(existsSync(join(repo, 'accord', 'tickets', 'EP-2.md'))).toBe(false);
    } finally {
      cleanup(repo);
    }
  });
});

describe('plan contract checks', () => {
  const planPath = (repo: string) => join(repo, 'accord', 'tickets', 'T-1', 'plan.md');
  const committed = async (plan: string) => {
    const repo = makeLaneRepo();
    await run(['approve', 'T-1'], repo);
    const first = commitAll(repo);
    writeFiles(repo, { 'accord/tickets/T-1/plan.md': plan.replace('abc1234', first) });
    commitAll(repo);
    return repo;
  };

  it('gate plan names a file missing at baseline; (new) passes', async () => {
    const repo = await committed(PLAN.replace('files: src/export.ts\nverify: export#writes-csv', 'files: src/nope.ts\nverify: export#writes-csv'));
    try {
      const r = await run(['gate', 'plan', 'T-1'], repo);
      expect(r.code).toBe(1);
      expect(r.out).toContain('gate.task-file-unknown');
      expect(r.out).toContain('src/nope.ts');
      writeFiles(repo, { 'accord/tickets/T-1/plan.md': readFileSync(planPath(repo), 'utf8').replace('src/nope.ts', 'src/nope.ts (new)') });
      expect((await run(['gate', 'plan', 'T-1'], repo)).code).toBe(0);
    } finally {
      cleanup(repo);
    }
  });

  it('a passing gate plan writes plan_hash once; an edited plan stops task-done until gate plan runs again', async () => {
    const repo = await committed(PLAN.replace(/plan_hash: .*\n/, ''));
    try {
      expect((await run(['gate', 'plan', 'T-1'], repo)).code).toBe(0);
      const written = readFileSync(planPath(repo), 'utf8');
      expect(written).toMatch(/^plan_hash: "fnv1a64:[0-9a-f]{16}"$/m);
      const mtime = statSync(planPath(repo)).mtimeMs;
      expect((await run(['gate', 'plan', 'T-1'], repo)).code).toBe(0);
      expect(readFileSync(planPath(repo), 'utf8')).toBe(written);
      expect(statSync(planPath(repo)).mtimeMs).toBe(mtime);

      commitAll(repo);
      writeFiles(repo, { 'accord/tickets/T-1/plan.md': written.replace('Add a csv branch to the writer.', 'Add a csv branch to the report writer.') });
      const stale = await run(['task-done', 'T-1', '1'], repo);
      expect(stale.code).toBe(1);
      expect(stale.out + stale.err).toContain('plan.md changed after accord gate plan last passed');
      expect((await run(['gate', 'plan', 'T-1'], repo)).code).toBe(0);
      const later = new Date(Date.now() + 5000);
      utimesSync(join(repo, 'reports', 'junit.xml'), later, later); // task-done needs a report newer than the commit
      const again = await run(['task-done', 'T-1', '1'], repo);
      expect(again.code).toBe(0);
      expect(readFileSync(join(repo, 'accord', 'tickets', 'T-1', 'ledger.md'), 'utf8')).toMatch(/- task 1 done [0-9a-f]{7,}/);
    } finally {
      cleanup(repo);
    }
  }, 30000);

  it('a directory token passes when it exists at baseline and fails when it does not', async () => {
    const dirPlan = (token: string) => PLAN.replace('files: src/export.ts\nverify: export#writes-csv', `files: ${token}\nverify: export#writes-csv`);
    const repo = await committed(dirPlan('src/'));
    try {
      expect((await run(['gate', 'plan', 'T-1'], repo)).code).toBe(0);
      for (const [token, code] of [['src', 0], ['docs/', 1]] as const) {
        writeFiles(repo, { 'accord/tickets/T-1/plan.md': readFileSync(planPath(repo), 'utf8').replace(/files: (src\/|src|docs\/)\nverify: export#writes-csv/, `files: ${token}\nverify: export#writes-csv`) });
        const r = await run(['gate', 'plan', 'T-1'], repo);
        expect([token, r.code]).toEqual([token, code]);
        if (code === 1) expect(r.out).toContain('gate.task-file-unknown');
      }
    } finally {
      cleanup(repo);
    }
  }, 30000);

  it.each(['../x.ts', '/etc/x.ts', 'C:/x.ts', 'C:\\x.ts'])('the path %s is a finding, not a usage error', async (token) => {
    const repo = await committed(PLAN.replace('files: src/export.ts\nverify: export#writes-csv', `files: ${token}\nverify: export#writes-csv`));
    try {
      expect((await run(['status'], repo)).code).toBe(0);
      const r = await run(['gate', 'plan', 'T-1'], repo);
      expect(r.code).toBe(1);
      expect(r.out).toContain('gate.task-file-unknown');
    } finally {
      cleanup(repo);
    }
  }, 30000);

  it('review-package prints (no plan) for a ticket without one', async () => {
    const repo = makeLaneRepo();
    try {
      const base = commitAll(repo);
      rmSync(planPath(repo));
      const r = await run(['review-package', 'T-1', '--base', base], repo);
      expect(r.code).toBe(0);
      expect(r.out).toContain('## Undeclared files\n\n(no plan)');
    } finally {
      cleanup(repo);
    }
  });

  it('review-package lists undeclared files, or (none)', async () => {
    const repo = makeLaneRepo();
    try {
      const base = commitAll(repo);
      writeFiles(repo, { 'accord/tickets/T-1/plan.md': PLAN.replace('abc1234', base) });
      const same = commitAll(repo);
      const none = await run(['review-package', 'T-1', '--base', same], repo);
      expect(none.out).toContain('## Undeclared files\n\n(none)');
      writeFiles(repo, { 'src/export.ts': 'export const write = 2;\n', 'docs/notes.md': 'n\n' });
      commitAll(repo);
      const r = await run(['review-package', 'T-1'], repo);
      expect(r.code).toBe(0);
      expect(r.out).toMatch(/## Stat[\s\S]*## Undeclared files\n\ndocs\/notes\.md\n\n## Diff/);
    } finally {
      cleanup(repo);
    }
  });
});

const TAGLESS = laneTicket('T-1', { body: LANE_BODY.replace(' @test:export#writes-csv', '').replace(' @test:export#escapes-commas', '') });
const MAPPED_PLAN = PLAN.replace(/verify: export#writes-csv[^\n]*\n/, 'verify: export#writes-csv (@ac-1)\n');

async function atBaseline(extra: Record<string, string>, plan: string): Promise<string> {
  const repo = makeLaneRepo(extra);
  await run(['approve', 'T-1'], repo);
  await run(['gate', 'ready', 'T-1'], repo);
  const first = commitAll(repo);
  writeFiles(repo, { 'accord/tickets/T-1/plan.md': plan.replace('abc1234', first).replace(/plan_hash: .*\n/, '') }); // gate plan writes the hash
  commitAll(repo);
  expect((await run(['gate', 'plan', 'T-1'], repo)).code).toBe(0);
  commitAll(repo);
  freshen(repo);
  return repo;
}

it('ac-1 task-done writes the tag of the scenario a verify entry proves', async () => {
  const repo = await atBaseline({ 'accord/tickets/T-1.md': TAGLESS }, MAPPED_PLAN);
  try {
    const before = ticketText(repo);
    const hashes = (t: string) => [/^approved_hash:.*$/m.exec(t)?.[0], /^ac_hash:.*$/m.exec(t)?.[0]];
    expect(hashes(before).every((h) => h !== undefined)).toBe(true);
    const row = async () => JSON.parse((await run(['status', '--json'], repo)).out).find((r: { id: string }) => r.id === 'T-1')?.stage;
    const stage = await row();
    const r = await run(['task-done', 'T-1', '1'], repo);
    expect(r.code).toBe(0);
    const after = ticketText(repo);
    expect(after).toContain('\n  @ac-1 @test:export#writes-csv\n');
    expect(after).toContain('\n  @ac-2\n');
    expect(hashes(after)).toEqual(hashes(before));
    expect(await row()).toBe(stage);
  } finally {
    cleanup(repo);
  }
}, 30000);

it('risk:complex-branching a failed mapped test writes no tag', async () => {
  const repo = await atBaseline({ 'accord/tickets/T-1.md': TAGLESS, [REPORT]: junit({ 'export#writes-csv': 'failed', 'export#escapes-commas': 'passed' }) }, MAPPED_PLAN);
  try {
    const before = ticketText(repo);
    expect((await run(['task-done', 'T-1', '1'], repo)).code).toBe(1);
    expect(ticketText(repo)).toBe(before);
    expect(existsSync(LEDGER_PATH(repo))).toBe(false);
  } finally {
    cleanup(repo);
  }
}, 30000);

it('ac-4 an unmapped verify id and an unmapped ui scenario need no tag', async () => {
  const ticket = laneTicket('T-1', { body: LANE_BODY.replace('@ac-2 @test:export#escapes-commas', '@ac-2 @ui').replace(' @test:export#writes-csv', '') });
  const plan = MAPPED_PLAN.replace(/verify: export#escapes-commas[^\n]*\n/, 'verify: export#escapes-commas\n');
  const repo = await atBaseline({ 'accord/tickets/T-1.md': ticket }, plan);
  try {
    const before = ticketText(repo);
    expect((await run(['task-done', 'T-1', '2'], repo)).code).toBe(0);
    expect(readFileSync(LEDGER_PATH(repo), 'utf8')).toContain('task 2 done');
    expect(ticketText(repo)).toBe(before);
  } finally {
    cleanup(repo);
  }
}, 30000);

it('ac-5 task-done never overwrites a different test tag', async () => {
  const ticket = laneTicket('T-1', { body: LANE_BODY.replace('@test:export#writes-csv', '@test:export#old-name') });
  const repo = makeLaneRepo({ 'accord/tickets/T-1.md': ticket });
  try {
    commitAll(repo);
    freshen(repo);
    const before = ticketText(repo);
    const r = await run(['task-done', 'T-1', '1'], repo);
    expect(r.code).toBe(1);
    for (const s of ['@ac-1', 'export#old-name', 'export#writes-csv']) expect(r.out).toContain(s);
    expect(ticketText(repo)).toBe(before);
    expect(existsSync(LEDGER_PATH(repo))).toBe(false);
  } finally {
    cleanup(repo);
  }
}, 30000);

it('risk:complex-branching a recorded task with a failed mapped test and a missing tag is refused', async () => {
  const ledgerText = '# Ledger\n\n## Tasks\n- task 1 done abc1234\n';
  const ticket = laneTicket('T-1', { body: LANE_BODY.replace(' @test:export#writes-csv', '') });
  const repo = makeLaneRepo({
    'accord/tickets/T-1.md': ticket,
    'accord/tickets/T-1/ledger.md': ledgerText,
    [REPORT]: junit({ 'export#writes-csv': 'failed', 'export#escapes-commas': 'passed' }),
  });
  try {
    commitAll(repo);
    freshen(repo);
    const before = ticketText(repo);
    const r = await run(['task-done', 'T-1', '1'], repo);
    expect(r.code).toBe(1);
    for (const s of ['export#writes-csv', '@ac-1']) expect(r.out).toContain(s);
    expect(ticketText(repo)).toBe(before);
    expect(ledger(repo)).toBe(ledgerText);
  } finally {
    cleanup(repo);
  }
}, 30000);

it('risk:complex-branching a re-run on a recorded task fills a missing tag', async () => {
  const ledgerText = '# Ledger\n\n## Tasks\n- task 1 done abc1234\n';
  const ticket = laneTicket('T-1', { body: LANE_BODY.replace(' @test:export#writes-csv', '') });
  const repo = makeLaneRepo({ 'accord/tickets/T-1.md': ticket, 'accord/tickets/T-1/ledger.md': ledgerText });
  try {
    commitAll(repo);
    freshen(repo);
    const r = await run(['task-done', 'T-1', '1'], repo);
    expect(r.code).toBe(0);
    expect(r.out).toContain('wrote @test:export#writes-csv on @ac-1');
    expect(r.out).toContain('task 1 of T-1 is already recorded');
    expect(ticketText(repo)).toContain('\n  @ac-1 @test:export#writes-csv\n');
    expect(ledger(repo)).toBe(ledgerText);
  } finally {
    cleanup(repo);
  }
}, 30000);

const baselineRepo = () =>
  makeLaneRepo({ [REPORT]: junit({ 'export#writes-csv': 'passed', 'export#escapes-commas': 'passed', 'util#formats-dates': 'passed' }) });

it('ac-5 tests baseline refuses a report older than the last commit', async () => {
  const repo = baselineRepo();
  try {
    commitAll(repo);
    utimesSync(REPORT_PATH(repo), OLD, OLD);
    const r = await run(['tests', 'baseline'], repo);
    expect(r.code).toBe(2);
    expect(r.err).toContain('run the tests again');
    expect(existsSync(join(repo, 'accord', 'tests-baseline.txt'))).toBe(false);
  } finally {
    cleanup(repo);
  }
}, 30000);

it('risk:complex-branching tests baseline writes from a report newer than the last commit', async () => {
  const repo = baselineRepo();
  try {
    commitAll(repo);
    freshen(repo);
    const r = await run(['tests', 'baseline'], repo);
    expect(r.code).toBe(0);
    expect(r.out).toBe('wrote 1 case id to accord/tests-baseline.txt\n');
    expect(existsSync(join(repo, 'accord', 'tests-baseline.txt'))).toBe(true);
  } finally {
    cleanup(repo);
  }
}, 30000);

async function gatePlanWith(verify: string): Promise<{ code: number; out: string }> {
  const repo = makeLaneRepo();
  try {
    await run(['approve', 'T-1'], repo);
    const first = commitAll(repo);
    writeFiles(repo, {
      'accord/tickets/T-1/plan.md': PLAN.replace('abc1234', first).replace(
        'verify: export#escapes-commas (@ac-2)',
        verify,
      ),
    });
    commitAll(repo);
    return await run(['gate', 'plan', 'T-1'], repo);
  } finally {
    cleanup(repo);
  }
}

const atLine = (out: string) =>
  out.split('\n').some((l) => l.startsWith('accord/tickets/T-1/plan.md:') && l.includes('gate.plan-verify-at'));

it('ac-1 gate plan fails on a verify id whose test name holds an at sign', async () => {
  const r = await gatePlanWith('verify: export#escapes-commas (@ac-2), src/x.test.ts#@test-ac-1-writes');
  expect(r.code).toBe(1);
  expect(r.out).toContain('gate.plan-verify-at');
  expect(r.out).toContain('src/x.test.ts#@test-ac-1-writes');
  expect(atLine(r.out)).toBe(true);
}, 30000);

it('ac-2 gate plan fails on a verify id whose path holds an at sign', async () => {
  const r = await gatePlanWith('verify: export#escapes-commas (@ac-2), packages/@scope/x.test.ts#writes');
  expect(r.code).toBe(1);
  expect(r.out).toContain('gate.plan-verify-at');
  expect(r.out).toContain('packages/@scope/x.test.ts#writes');
  expect(atLine(r.out)).toBe(true);
}, 30000);

it('ac-3 gate plan fails on a comma inside a verify id', async () => {
  const r = await gatePlanWith('verify: export#escapes-commas (@ac-2), src/x.test.ts#refuses-x,-exit-2');
  expect(r.code).toBe(1);
  expect(r.out).toContain('gate.plan-verify-comma');
  expect(r.out).toContain('src/x.test.ts#refuses-x,-exit-2');
  expect(
    r.out.split('\n').some((l) => l.startsWith('accord/tickets/T-1/plan.md:') && l.includes('gate.plan-verify-comma')),
  ).toBe(true);
}, 30000);

const BRANCHED = CONFIG + 'branch: "feature/{id}"\n';

it('ac-1 anchor finds the active ticket from a branch named by the template', async () => {
  const repo = makeLaneRepo({ 'accord/config.yml': BRANCHED, 'accord/tickets/ST-AN-2.md': laneTicket('ST-AN-2') });
  try {
    commitAll(repo);
    gitRun(repo, 'checkout', '-q', '-b', 'feature/ST-AN-2');
    const r = await run(['anchor'], repo);
    expect(r.code).toBe(0);
    expect(r.out.startsWith('# Anchor: ST-AN-2 "Export"\n')).toBe(true);
    const h = await run(['hook', 'session-resume'], repo);
    expect(h.out).toContain('# Anchor: ST-AN-2 "Export"');
  } finally {
    cleanup(repo);
  }
});

it('risk:complex-branching a template on the default branch is in force without the key in the working tree', async () => {
  const repo = makeLaneRepo({ 'accord/config.yml': BRANCHED, 'accord/tickets/ST-AN-2.md': laneTicket('ST-AN-2') });
  try {
    commitAll(repo);
    gitRun(repo, 'update-ref', 'refs/remotes/origin/main', 'HEAD');
    gitRun(repo, 'symbolic-ref', 'refs/remotes/origin/HEAD', 'refs/remotes/origin/main');
    writeFiles(repo, { 'accord/config.yml': CONFIG });
    commitAll(repo);
    gitRun(repo, 'checkout', '-q', '-b', 'feature/ST-AN-2');
    const r = await run(['anchor'], repo);
    expect(r.out.startsWith('# Anchor: ST-AN-2 "Export"\n')).toBe(true);
    gitRun(repo, 'symbolic-ref', '--delete', 'refs/remotes/origin/HEAD');
    const r2 = await run(['anchor'], repo);
    expect(r2.out.startsWith('# Anchor: ST-AN-2 "Export"\n')).toBe(true);
  } finally {
    cleanup(repo);
  }
});

it('risk:complex-branching a template on a ref other than the default branch sets nothing', async () => {
  const repo = makeLaneRepo({ 'accord/config.yml': BRANCHED, 'accord/tickets/ST-AN-2.md': laneTicket('ST-AN-2') });
  try {
    commitAll(repo);
    gitRun(repo, 'update-ref', 'refs/remotes/origin/other', 'HEAD');
    writeFiles(repo, { 'accord/config.yml': CONFIG });
    commitAll(repo);
    gitRun(repo, 'checkout', '-q', '-b', 'feature/ST-AN-2');
    const r = await run(['anchor'], repo);
    expect(r.code).toBe(0);
    expect(r.out).toBe('');
  } finally {
    cleanup(repo);
  }
});

it('ac-2 template branches and t branches both count as claims', async () => {
  const repo = makeLaneRepo({
    'accord/config.yml': BRANCHED,
    'accord/tickets/ST-AN-2.md': laneTicket('ST-AN-2'),
    'accord/tickets/ST-AN-3.md': laneTicket('ST-AN-3'),
    'accord/tickets/ST-AN-4.md': laneTicket('ST-AN-4'),
  });
  try {
    for (const id of ['ST-AN-2', 'ST-AN-3', 'ST-AN-4']) {
      expect((await run(['approve', id], repo)).code).toBe(0);
      expect((await run(['gate', 'ready', id], repo)).code).toBe(0);
    }
    commitAll(repo);
    for (const [email, ref] of [
      ['an@example.com', 'refs/remotes/origin/feature/ST-AN-2'],
      ['bo@example.com', 'refs/remotes/origin/t/ST-AN-3'],
    ]) {
      const sha = gitRun(repo, '-c', 'user.email=' + email, '-c', 'user.name=x', 'commit-tree', 'HEAD^{tree}', '-p', 'HEAD', '-m', 'claim').trim();
      gitRun(repo, 'update-ref', ref, sha);
    }
    const rows = JSON.parse((await run(['status', '--json'], repo)).out) as { id: string; claimedBy?: string; branch?: string }[];
    const row = (id: string) => rows.find((r) => r.id === id);
    expect(row('ST-AN-2')).toMatchObject({ claimedBy: 'an@example.com', branch: 'feature/ST-AN-2' });
    expect(row('ST-AN-3')).toMatchObject({ claimedBy: 'bo@example.com', branch: 't/ST-AN-3' });
    expect(row('ST-AN-4')).not.toHaveProperty('claimedBy');
    const next = JSON.parse((await run(['next', '--json'], repo)).out) as { id: string; branch?: string }[];
    expect(next.map((r) => r.id)).toEqual(['ST-AN-4']);
    expect(next[0].branch).toBe('feature/ST-AN-4');
  } finally {
    cleanup(repo);
  }
}, 60000);

it('risk:complex-branching among claim refs for one ticket a pushed ref wins and then the newest tip', async () => {
  const repo = makeLaneRepo({ 'accord/config.yml': BRANCHED, 'accord/tickets/ST-AN-2.md': laneTicket('ST-AN-2') });
  try {
    commitAllAt(repo, OLD);
    gitRun(repo, 'update-ref', 'refs/remotes/origin/t/ST-AN-2', 'HEAD');
    writeFiles(repo, { 'src/a.ts': 'export const a = 1;\n' });
    commitAllAt(repo, new Date('2010-01-01T00:00:00Z'));
    gitRun(repo, 'update-ref', 'refs/remotes/origin/feature/ST-AN-2', 'HEAD');
    writeFiles(repo, { 'src/b.ts': 'export const b = 1;\n' });
    commitAll(repo);
    gitRun(repo, 'branch', 't/ST-AN-2');
    const rows = JSON.parse((await run(['status', '--json'], repo)).out) as { id: string; branch?: string }[];
    expect(rows.find((r) => r.id === 'ST-AN-2')?.branch).toBe('feature/ST-AN-2');
  } finally {
    cleanup(repo);
  }
});

it('risk:complex-branching a new claim is named by the default branch template before the working tree one', async () => {
  const repo = makeLaneRepo({ 'accord/config.yml': CONFIG, 'accord/tickets/ST-AN-4.md': laneTicket('ST-AN-4') });
  const branchOf = async () =>
    (JSON.parse((await run(['status', '--json'], repo)).out) as { id: string; branch?: string }[]).find((r) => r.id === 'ST-AN-4')?.branch;
  try {
    commitAll(repo);
    gitRun(repo, 'update-ref', 'refs/remotes/origin/main', 'HEAD');
    writeFiles(repo, { 'accord/config.yml': BRANCHED });
    expect(await branchOf()).toBe('t/ST-AN-4');
    writeFiles(repo, { 'accord/config.yml': CONFIG + 'branch: "team/{id}"\n' });
    commitAll(repo);
    gitRun(repo, 'update-ref', 'refs/remotes/origin/main', 'HEAD');
    writeFiles(repo, { 'accord/config.yml': BRANCHED });
    expect(await branchOf()).toBe('team/ST-AN-4');
    gitRun(repo, 'update-ref', '-d', 'refs/remotes/origin/main');
    expect(await branchOf()).toBe('feature/ST-AN-4');
  } finally {
    cleanup(repo);
  }
}, 60000);

it('ac-3 lint rejects an invalid template and anchor still reads the t branch', async () => {
  const repo = makeLaneRepo({ 'accord/tickets/ST-AN-2.md': laneTicket('ST-AN-2') });
  try {
    commitAll(repo);
    gitRun(repo, 'checkout', '-q', '-b', 't/ST-AN-2');
    for (const value of ['{id}', 'feature/{id}/{id}', 'feature/x', 'feature {id}', 'feature/..{id}']) {
      writeFiles(repo, { 'accord/config.yml': CONFIG + 'branch: "' + value + '"\n' });
      const l = await run(['lint', '--json'], repo);
      expect(l.code, value).toBe(1);
      const f = (JSON.parse(l.out).findings as { pointer?: string; rule: string }[]).filter((x) => x.pointer === '/branch');
      expect(f.length, value).toBeGreaterThan(0);
      expect(f.every((x) => x.rule.startsWith('schema.'))).toBe(true);
      const a = await run(['anchor'], repo);
      expect(a.code).toBe(0);
      expect(a.out.startsWith('# Anchor: ST-AN-2 "Export"\n')).toBe(true);
    }
    writeFiles(repo, { 'accord/config.yml': BRANCHED });
    const ok = await run(['lint', '--json'], repo);
    expect((JSON.parse(ok.out).findings as { pointer?: string }[]).filter((x) => x.pointer === '/branch')).toEqual([]);
  } finally {
    cleanup(repo);
  }
}, 60000);

it('ac-4 without the branch key t branches count and template branches do not', async () => {
  const repo = makeLaneRepo({ 'accord/tickets/ST-AN-2.md': laneTicket('ST-AN-2'), 'accord/tickets/ST-AN-3.md': laneTicket('ST-AN-3') });
  try {
    commitAll(repo);
    gitRun(repo, 'update-ref', 'refs/remotes/origin/feature/ST-AN-3', 'HEAD');
    gitRun(repo, 'checkout', '-q', '-b', 't/ST-AN-2');
    const a = await run(['anchor'], repo);
    expect(a.out.startsWith('# Anchor: ST-AN-2 "Export"\n')).toBe(true);
    const rows = JSON.parse((await run(['status', '--json'], repo)).out) as { id: string; claimedBy?: string }[];
    expect(rows.find((r) => r.id === 'ST-AN-2')?.claimedBy).toBeTruthy();
    expect(rows.find((r) => r.id === 'ST-AN-3')?.claimedBy).toBeUndefined();
  } finally {
    cleanup(repo);
  }
}, 60000);

it('risk:complex-branching an invalid template names no claim', async () => {
  const repo = makeLaneRepo({ 'accord/config.yml': CONFIG + 'branch: "{id}"\n', 'accord/tickets/ST-AN-2.md': laneTicket('ST-AN-2') });
  try {
    commitAll(repo);
    gitRun(repo, 'update-ref', 'refs/remotes/origin/main', 'HEAD');
    gitRun(repo, 'branch', 'ST-AN-2');
    gitRun(repo, 'update-ref', 'refs/remotes/origin/ST-AN-2', 'HEAD');
    const rows = JSON.parse((await run(['status', '--json'], repo)).out) as { id: string; claimedBy?: string; branch?: string }[];
    const row = rows.find((r) => r.id === 'ST-AN-2');
    expect(row?.claimedBy).toBeUndefined();
    expect(row?.branch).toBe('t/ST-AN-2');
  } finally {
    cleanup(repo);
  }
}, 60000);

it('ac-4 tests skipped prints every case the report records as skipped with the operating system', async () => {
  const repo = makeLaneRepo({ [REPORT]: junit({ 'export#writes-csv': 'passed', 'util#b': 'skipped', 'export#escapes-commas': 'skipped' }) });
  try {
    commitAll(repo);
    freshen(repo);
    const r = await run(['tests', 'skipped'], repo);
    expect(r.code).toBe(0);
    expect(r.out).toBe(`skipped on ${platform()}: 2\nexport#escapes-commas\nutil#b\n`);
    utimesSync(REPORT_PATH(repo), OLD, OLD);
    const stale = await run(['tests', 'skipped'], repo);
    expect(stale.code).toBe(2);
    expect(stale.err).toContain('run the tests again');
    writeFiles(repo, { [REPORT]: junit({ 'export#writes-csv': 'passed' }) });
    freshen(repo);
    const none = await run(['tests', 'skipped'], repo);
    expect(none.code).toBe(0);
    expect(none.out).toBe(`skipped on ${platform()}: 0\n`);
  } finally {
    cleanup(repo);
  }
  const bare = makeLaneRepo({ 'accord/config.yml': CONFIG.replace(/tests:\n {2}report: .*\n/, '') });
  try {
    const r = await run(['tests', 'skipped'], bare);
    expect(r.code).toBe(2);
    expect(r.err).toContain('no tests.report');
  } finally {
    cleanup(bare);
  }
}, 30000);

it('ac-2 every brief ends with the repository conventions', async () => {
  const repo = makeLaneRepo();
  const conv = join(repo, 'accord', 'product', 'conventions.md');
  const brief = async () => (await run(['brief', 'T-1', '2'], repo)).out;
  try {
    const before = await brief();
    expect(before.endsWith('\n')).toBe(true);
    expect(before.endsWith('\n\n')).toBe(false);
    expect(before).not.toContain('conventions');
    expect((await run(['init'], repo)).code).toBe(0);
    expect(readFileSync(conv, 'utf8')).toBe(templates['conventions.md']);
    expect(await brief()).toBe(before + '\n---\n\n' + templates['conventions.md']);
    writeFileSync(conv, '- Never add a commit trailer.');
    expect(await brief()).toBe(before + '\n---\n\n- Never add a commit trailer.');
    const crlf = '﻿- A\r\n- B\r\n';
    writeFileSync(conv, crlf);
    expect(await brief()).toBe(before + '\n---\n\n' + crlf);
    for (const blank of ['', ' \n\t\r\n', '﻿', '﻿\n  ﻿\n']) {
      writeFileSync(conv, blank);
      expect(await brief()).toBe(before);
    }
    rmSync(conv);
    expect(await brief()).toBe(before);
  } finally {
    cleanup(repo);
  }
}, 60_000);

it('ac-1 the brief prints the task tests.affected command as the only one to run', async () => {
  const plan =
    '---\nbaseline: abc1234\n---\n\n## Task 1: A\ncovers: @ac-1\n\n## Task 2: B\ncovers: @ac-2\nfiles: src/export.ts, src/csv.ts\nverify: test/csv.test.ts#quotes-cells (@ac-2), test/export.test.ts#writes-csv, src/csv.ts#direct\n';
  const repo = makeLaneRepo({
    'accord/config.yml': withTests(['affected: npx vitest related --run {files} --reporter=junit', 'full: npx vitest run --reporter=junit']),
    'accord/tickets/T-1/plan.md': plan,
    'src/csv.ts': 'export const csv = 1;\n',
    'test/csv.test.ts': '',
    'test/export.test.ts': '',
  });
  try {
    const ticket = readFileSync(join(repo, 'accord/tickets/T-1.md'), 'utf8');
    const r = await run(['brief', 'T-1', '2'], repo);
    expect(r.code).toBe(0);
    expect(r.out).toBe(
      ticket.replace(/\n*$/, '\n') +
        '\n---\n\n## Task 2: B\ncovers: @ac-2\nfiles: src/export.ts, src/csv.ts\nverify: test/csv.test.ts#quotes-cells (@ac-2), test/export.test.ts#writes-csv, src/csv.ts#direct\n' +
        '\n---\n\nTest command: npx vitest related --run src/export.ts src/csv.ts test/csv.test.ts test/export.test.ts --reporter=junit\n' +
        ONLY +
        '\n',
    );
  } finally {
    cleanup(repo);
  }
});

it('ac-2 without tests.affected the brief prints tests.full and says why', async () => {
  const repo = makeLaneRepo({ 'accord/config.yml': withTests(['full: npx vitest run --reporter=junit']) });
  try {
    const r = await run(['brief', 'T-1', '2'], repo);
    expect(r.code).toBe(0);
    expect(
      r.out.endsWith(
        '\n---\n\nTest command: npx vitest run --reporter=junit\n' + ONLY + '\ntests.full is printed because accord/config.yml has no tests.affected.\n',
      ),
    ).toBe(true);
  } finally {
    cleanup(repo);
  }
});

it('ac-3 without either command the brief says no test command is configured', async () => {
  const repo = makeLaneRepo();
  try {
    for (const n of ['1', '2']) {
      const r = await run(['brief', 'T-1', n], repo);
      expect(r.code).toBe(0);
      expect(r.out.endsWith('\n---\n\n' + NO_COMMAND + '\n')).toBe(true);
      expect(r.out).not.toContain('Test command:');
    }
  } finally {
    cleanup(repo);
  }
});
