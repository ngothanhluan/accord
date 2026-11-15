// ST-LN-50 t2-ac-5 (stage half), D-08 and its Ruling: `strictness.stages.M.plan: "off"` on real files and real git. An approved lane M ticket with no plan.md is at build with
// task 1, the whole ticket. `accord brief T-1 1` briefs the ticket itself and `accord task-done T-1 1 --test ac-<n>=<test id>` ties each scenario to a passing test.
import { existsSync, readFileSync, rmSync, utimesSync } from 'node:fs';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { approve, CONFIG, discussFiles, junit, LANE_BODY, laneTicket, P, REPORT, type Files } from '../../../test/helpers/lane.js';
import { cleanup, commitAll, commitMsg, gitRun, makeLaneRepo, run, writeFiles } from './helpers/repo.js';

const OFF = 'strictness:\n  stages:\n    M:\n      plan: "off"\n';
const AFFECTED = CONFIG.replace(`  report: ${REPORT}\n`, `  report: ${REPORT}\n  affected: "npx vitest run {files}"\n`);
const UNTAGGED = LANE_BODY.replace(/ @test:\S+/g, '');
const PLAN_OFF_LINE = 'The plan stage is off for lane M: build the whole ticket as task 1; every scenario that is not @ui needs one test that proves it.';
const T1 = join('accord', 'tickets', 'T-1.md');

/** A lane M repository, approved, whose scenarios carry no @test: tag, with or without a plan.md. */
function repoWith(config: string, withPlan = false): string {
  const files: Files = { 'accord/config.yml': config, [P('T-1')]: laneTicket('T-1', { body: UNTAGGED }), ...discussFiles('T-1') };
  approve(files, 'T-1');
  const repo = makeLaneRepo(files);
  try {
    if (!withPlan) rmSync(join(repo, 'accord', 'tickets', 'T-1', 'plan.md'));
    gitRun(repo, 'config', 'user.email', 'fixture@example.invalid');
    gitRun(repo, 'config', 'user.name', 'fixture');
    gitRun(repo, 'config', 'commit.gpgsign', 'false');
    commitMsg(repo, 'claim: T-1');
    return repo;
  } catch (e) {
    cleanup(repo);
    throw e;
  }
}

const row = async (repo: string): Promise<Record<string, unknown>> => (JSON.parse((await run(['status', '--json'], repo)).out) as Record<string, unknown>[])[0];
const fresh = (repo: string, offsetMs: number): void => {
  const at = new Date(Date.now() + offsetMs);
  utimesSync(join(repo, REPORT), at, at);
};
const PAIRS = ['--test', 'ac-1=export#writes-csv', '--test', 'ac-2=export#escapes-commas'];

it('risk:complex-branching a ticket builds without a plan and reaches review with its tests tagged (ST-LN-50 t2-ac-5)', async () => {
  const repo = repoWith(AFFECTED + OFF);
  try {
    // at build, task 1 of 1, with no plan.md
    expect(existsSync(join(repo, 'accord', 'tickets', 'T-1', 'plan.md'))).toBe(false);
    expect(await row(repo)).toMatchObject({ stage: 'build', tasksTotal: 1, tasksDone: 0 });
    expect((await run(['anchor', 'T-1'], repo)).out).toContain('Stage: build');

    // the brief: the ticket verbatim, the plan-off line, the test command with no file list, no plan text
    const brief = await run(['brief', 'T-1', '1'], repo);
    expect(brief.code).toBe(0);
    expect(brief.out.startsWith(readFileSync(join(repo, T1), 'utf8').replace(/\n*$/, '\n') + '\n---\n\n' + PLAN_OFF_LINE + '\n')).toBe(true);
    expect(brief.out).toContain('Test command: npx vitest run \n');
    expect(brief.out).not.toContain('## Task');
    // the whole ticket is task 1: nothing else exists, and the message names the switch
    for (const cmd of [['brief', 'T-1', '2'], ['task-done', 'T-1', '2', ...PAIRS]]) {
      const bad = await run(cmd, repo);
      expect(bad.code, cmd.join(' ')).toBe(2);
      expect(bad.err, cmd.join(' ')).toContain('strictness.stages.M.plan');
    }

    // a scenario left without --test: exit 1 naming it; nothing recorded, no tag written
    const ticket = readFileSync(join(repo, T1), 'utf8');
    writeFiles(repo, { 'src/export.test.ts': 'export {};\n' });
    commitAll(repo, 'tests');
    fresh(repo, 5000);
    const partial = await run(['task-done', 'T-1', '1', '--test', 'ac-1=export#writes-csv'], repo);
    expect(partial.code).toBe(1);
    expect(partial.out).toContain('@ac-2');
    expect(existsSync(join(repo, 'accord', 'tickets', 'T-1', 'ledger.md'))).toBe(false);
    expect(readFileSync(join(repo, T1), 'utf8')).toBe(ticket);

    // a named test that failed in the report, then one that is not in it
    writeFiles(repo, { [REPORT]: junit({ 'export#writes-csv': 'passed', 'export#escapes-commas': 'failed' }) });
    fresh(repo, 5000);
    const failed = await run(['task-done', 'T-1', '1', ...PAIRS], repo);
    expect(failed.code).toBe(1);
    expect(failed.out).toContain('export#escapes-commas is recorded failed');
    expect((await run(['task-done', 'T-1', '1', '--test', 'ac-1=export#writes-csv', '--test', 'ac-2=export#gone'], repo)).out).toContain('export#gone is not in');

    // a report older than HEAD
    writeFiles(repo, { [REPORT]: junit({ 'export#writes-csv': 'passed', 'export#escapes-commas': 'passed' }) });
    fresh(repo, -60_000);
    const stale = await run(['task-done', 'T-1', '1', ...PAIRS], repo);
    expect(stale.code).toBe(1);
    expect(stale.out).toContain('was written before the last commit');
    expect(readFileSync(join(repo, T1), 'utf8')).toBe(ticket);

    // both pass, report fresh: two tags, the ledger line
    fresh(repo, 5000);
    const ok = await run(['task-done', 'T-1', '1', ...PAIRS], repo);
    expect(ok.out).toContain('wrote @test:export#writes-csv on @ac-1 in accord/tickets/T-1.md\n');
    expect(ok.out).toContain('wrote @test:export#escapes-commas on @ac-2 in accord/tickets/T-1.md\n');
    expect(ok.out).toMatch(/recorded task 1 done at [0-9a-f]{12} in accord\/tickets\/T-1\/ledger\.md\n$/);
    expect(ok.code).toBe(0);
    const tagged = readFileSync(join(repo, T1), 'utf8');
    expect(tagged).toContain('@ac-1 @test:export#writes-csv');
    expect(tagged).toContain('@ac-2 @test:export#escapes-commas');

    // the ticket goes on as any other: review next, a second run is a no-op
    expect(await row(repo)).toMatchObject({ stage: 'review', tasksTotal: 1, tasksDone: 1 });
    const again = await run(['task-done', 'T-1', '1', ...PAIRS], repo);
    expect(again.code).toBe(0);
    expect(again.out).toContain('already recorded');
  } finally {
    cleanup(repo);
  }
}, 180_000);

it('risk:complex-branching the brief prints tests.full when there is no tests.affected, a note with neither, and ignores a plan.md (ST-LN-50 t2-ac-5)', async () => {
  const repo = repoWith(CONFIG.replace(`  report: ${REPORT}\n`, `  report: ${REPORT}\n  full: "npm test"\n`) + OFF, true);
  try {
    // plan.md exists anyway: ignored (the Ruling)
    expect(await row(repo)).toMatchObject({ stage: 'build', tasksTotal: 1 });
    const full = await run(['brief', 'T-1', '1'], repo);
    expect(full.code).toBe(0);
    expect(full.out).toContain(PLAN_OFF_LINE);
    expect(full.out).toContain('Test command: npm test\n');
    expect(full.out).not.toContain('Writer csv mode');
    expect(full.out).not.toContain('## Task');

    writeFiles(repo, { 'accord/config.yml': CONFIG + OFF });
    expect((await run(['brief', 'T-1', '1'], repo)).out).toContain('No test command is configured');
  } finally {
    cleanup(repo);
  }
}, 120_000);

it("risk:complex-branching with the plan stage on brief and task-done are today's and --test is refused (ST-LN-50 t2-ac-5)", async () => {
  const repo = repoWith(CONFIG, true);
  try {
    expect(await row(repo)).toMatchObject({ stage: 'plan', tasksTotal: 2 });
    const brief = await run(['brief', 'T-1', '1'], repo);
    expect(brief.code).toBe(0);
    expect(brief.out).toContain('## Task 1: Writer csv mode');
    expect(brief.out).not.toContain('The plan stage is off');
    const refused = await run(['task-done', 'T-1', '1', '--test', 'ac-1=export#writes-csv'], repo);
    expect(refused.code).toBe(2);
    expect(refused.err).toContain('strictness.stages.M.plan');
    expect(existsSync(join(repo, 'accord', 'tickets', 'T-1', 'ledger.md'))).toBe(false);
    // without --test it is the plan task's own path: the option is not what refuses it
    expect((await run(['task-done', 'T-1', '1'], repo)).err).not.toContain('--test');
  } finally {
    cleanup(repo);
  }
}, 120_000);

it('risk:security a malformed --test pair exits 2 and writes nothing (ST-LN-50 t2-ac-5)', async () => {
  const repo = repoWith(AFFECTED + OFF);
  try {
    const ticket = readFileSync(join(repo, T1), 'utf8');
    for (const bad of ['ac-1', 'ac-1=', '=export#a', 'ac-0=export#a', 'ac-01=export#a', 'AC-1=export#a', 'ac-1=a b', '@ac-1=export#a', 'ac-1=a=b c']) {
      const r = await run(['task-done', 'T-1', '1', '--test', bad], repo);
      expect(r.code, bad).toBe(2);
      expect(r.err, bad).toContain('ac-<n>=<test id>');
    }
    expect(readFileSync(join(repo, T1), 'utf8')).toBe(ticket);
    expect(existsSync(join(repo, 'accord', 'tickets', 'T-1', 'ledger.md'))).toBe(false);
  } finally {
    cleanup(repo);
  }
}, 120_000);
