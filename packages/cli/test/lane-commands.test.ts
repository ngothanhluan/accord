// The workflow-layer commands end to end, in-process through runCli (STACK Decision 7), each against its
// own sandbox so a write can never reach a fixture.
import { existsSync, readFileSync, rmSync, statSync, utimesSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { cleanup, commitAll, gitRun, makeEmptyRepo, makeLaneRepo, makeRepo, run, writeFiles } from './helpers/repo.js';
import { CONFIG, junit, laneTicket, PLAN, REPORT } from '../../../test/helpers/lane.js';
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
      for (const bad of ['x', '0', '01', '-1', '1.5']) {
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
      expect(r.out).toContain('\n---\n\n## Task 2: Escaping\ncovers: @ac-2\n');
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
      expect((await run(['gate', 'plan', 'T-1'], repo)).code).toBe(0);
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
      for (const key of ['lane', 'stage', 'tasksDone', 'tasksTotal', 'dependsOn', 'blockedBy', 'claimedBy']) {
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

  // makeLaneRepo always writes a plan, so the approved ticket sits at build 0/2: approved, nothing recorded.
  it('next lists an approved, Ready, unclaimed ticket, and nothing once it is claimed', async () => {
    const repo = makeLaneRepo();
    try {
      await run(['approve', 'T-1'], repo);
      expect((await run(['next'], repo)).out).toBe('no ticket is ready to pick up\n');
      expect((await run(['gate', 'ready', 'T-1'], repo)).code).toBe(0);
      const listed = await run(['next'], repo);
      expect(listed.code).toBe(0);
      expect(listed.out).toContain('T-1');
      expect(listed.out).toContain('build 0/2');
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
      writeFiles(repo, { 'accord/tickets/T-1/plan.md': written.replace('verify: export#writes-csv', 'verify: export#escapes-commas') });
      const stale = await run(['task-done', 'T-1', '1'], repo);
      expect(stale.code).toBe(1);
      expect(stale.out + stale.err).toContain('plan.md changed after accord gate plan last passed');
      expect((await run(['gate', 'plan', 'T-1'], repo)).code).toBe(0);
      expect((await run(['task-done', 'T-1', '1'], repo)).out).not.toContain('plan.md changed');
    } finally {
      cleanup(repo);
    }
}, 30000);

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
