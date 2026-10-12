// The workflow-layer commands end to end, in-process through runCli (STACK Decision 7), each against its
// own sandbox so a write can never reach a fixture.
import { existsSync, readFileSync, utimesSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { cleanup, commitAll, makeLaneRepo, run } from './helpers/repo.js';
import { CONFIG, junit, laneTicket, REPORT } from '../../../test/helpers/lane.js';

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
    } finally {
      cleanup(repo);
    }
  });
});
