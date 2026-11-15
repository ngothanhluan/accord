// ST-LN-50 t2-ac-5 (stage half), t2-ac-6: `strictness.stages.M.review: "off"` on real files and real git. A lane M ticket built through task-done with no
// review.md is at verify (status and anchor), and `accord gate done` passes after verification without review.md. With no stages key every output is today's.
import { readFileSync, utimesSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { setFrontmatterKey } from '@accord-dev/accord-core';
import { expect, it } from 'vitest';
import { approve, CONFIG, discussFiles, discussPath, gateReadyIn, P, PLAN, type Files } from '../../../test/helpers/lane.js';
import { cleanup, commitAll, commitMsg, gitRun, makeLaneRepo, run, writeFiles } from './helpers/repo.js';

const STAGES = 'strictness:\n  stages:\n    M:\n      review: "off"\n';

const evidence = (sha: string): string =>
  [
    '---', 'ticket: "T-1"', `commit: "${sha}"`, 'reviewed_on: "2026-10-12"', '---', '',
    '## @ac-1 export writes a csv', '', 'Result: pass', '', 'Evidence: export#writes-csv passed in reports/junit.xml', '',
    '## @ac-2 commas are escaped', '', 'Result: pass', '', 'Evidence: export#escapes-commas passed in reports/junit.xml', '',
  ].join('\n');

/** The orchestrator ran the suite after the last commit: task-done refuses a report older than HEAD. */
function freshReport(repo: string): void {
  const later = new Date(Date.now() + 5000);
  utimesSync(join(repo, 'reports', 'junit.xml'), later, later);
}

/** A lane M repository built to its last task: approved, Ready, planned, both tasks recorded with task-done, no review.md. */
async function built(config: string): Promise<string> {
  const repo = makeLaneRepo({ ...discussFiles('T-1'), 'accord/config.yml': config });
  try {
    gitRun(repo, 'config', 'user.email', 'fixture@example.invalid');
    gitRun(repo, 'config', 'user.name', 'fixture');
    gitRun(repo, 'config', 'commit.gpgsign', 'false');
    commitMsg(repo, 'base');
    gitRun(repo, 'switch', '-q', '-c', 't/T-1');
    const files: Files = {};
    for (const rel of ['accord/config.yml', P('T-1'), 'accord/tickets/T-1/plan.md', discussPath('T-1')]) {
      files[rel] = readFileSync(join(repo, ...rel.split('/')), 'utf8');
    }
    approve(files, 'T-1');
    expect(gateReadyIn(files, 'T-1')).toBe('pass');
    writeFiles(repo, { [P('T-1')]: files[P('T-1')] });
    const baseline = commitMsg(repo, 'fixture');
    writeFiles(repo, { 'accord/tickets/T-1/plan.md': PLAN.replace('abc1234', baseline) });
    commitMsg(repo, 'plan: T-1 ready');
    freshReport(repo);
    expect((await run(['task-done', 'T-1', '1'], repo)).code).toBe(0);
    commitAll(repo);
    freshReport(repo);
    expect((await run(['task-done', 'T-1', '2'], repo)).code).toBe(0);
    return repo;
  } catch (e) {
    cleanup(repo);
    throw e;
  }
}

const stageOf = async (repo: string): Promise<unknown> => (JSON.parse((await run(['status', '--json'], repo)).out) as Record<string, unknown>[])[0].stage;

it('risk:complex-branching review off lets a built lane M ticket reach verify and done (ST-LN-50 t2-ac-5)', async () => {
  const repo = await built(CONFIG + STAGES);
  try {
    // verify after the last task, in status and in the anchor
    expect(await stageOf(repo)).toBe('verify');
    const anchor = await run(['anchor', 'T-1'], repo);
    expect(anchor.out).toContain('Stage: verify');
    expect(anchor.out).not.toContain('Stage: review');

    // the reviewer's evidence and ticks at the gated commit; there is no review.md
    const sha = commitAll(repo);
    const file = join(repo, 'accord', 'tickets', 'T-1.md');
    let ticket = readFileSync(file, 'utf8');
    const hash = /^ac_hash: "(.+)"$/m.exec(ticket)?.[1] as string;
    ticket = setFrontmatterKey(ticket, 'verified', ['ac-1', 'ac-2']);
    ticket = setFrontmatterKey(ticket, 'verified_hash', hash);
    ticket = setFrontmatterKey(ticket, 'verified_commit', sha);
    writeFileSync(file, ticket);
    writeFiles(repo, { 'accord/tickets/T-1/verification.md': evidence(sha) });

    const done = await run(['gate', 'done', 'T-1'], repo);
    expect(done.out).not.toContain(' error ');
    expect(done.out).not.toContain('gate.review-missing');
    expect(done.code).toBe(0);
    expect(await stageOf(repo)).toBe('done');

    // the same records with the key removed are today's: review is back, and gate done refuses
    writeFiles(repo, { 'accord/config.yml': CONFIG });
    expect(await stageOf(repo)).toBe('review');
    const back = await run(['gate', 'done', 'T-1'], repo);
    expect(back.code).toBe(1);
    expect(back.out).toContain('gate.review-missing');
  } finally {
    cleanup(repo);
  }
}, 180_000);

it('risk:security an unverified ticket with review off still fails gate.verification-missing (ST-LN-50 t2-ac-5)', async () => {
  const repo = await built(CONFIG + STAGES);
  try {
    const done = await run(['gate', 'done', 'T-1', '--json'], repo);
    expect(done.code).toBe(1);
    const findings = (JSON.parse(done.out) as { findings: { rule: string; level: string }[] }).findings;
    expect(findings.find((f) => f.rule === 'gate.verification-missing')?.level).toBe('error');
    expect(findings.some((f) => f.rule === 'gate.review-missing')).toBe(false);
  } finally {
    cleanup(repo);
  }
}, 180_000);
