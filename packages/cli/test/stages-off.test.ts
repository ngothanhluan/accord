// ST-LN-50 t2-ac-5 (stage half), t2-ac-6: `strictness.stages.M.review: "off"` on real files and real git. A lane M ticket built through task-done with no
// review.md is at verify (status and anchor), and `accord gate done` passes after verification without review.md. With no stages key every output is today's.
import { readFileSync, utimesSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { setFrontmatterKey } from '@accord-dev/accord-core';
import { expect, it } from 'vitest';
import { approve, CONFIG, discussFiles, discussPath, gateReadyIn, LANE_S_BODY, laneTicket, P, PLAN, type Files } from '../../../test/helpers/lane.js';
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

const OFF = (...stages: string[]): string => 'strictness:\n  stages:\n    M:\n' + stages.map((s) => `      ${s}: "off"\n`).join('');

it('risk:complex-branching approach off removes the approach critic, not the approval (ST-LN-50 t2-ac-5)', async () => {
  const repo = makeLaneRepo({ 'accord/config.yml': CONFIG + OFF('approach', 'plan') });
  try {
    commitMsg(repo, 'claim: T-1');
    // the critic is the stage: no round to count, exit 2, and the message names the switch
    const refused = await run(['round', 'T-1', '--approach'], repo);
    expect(refused.code).toBe(2);
    expect(refused.err).toContain('strictness.stages.M.approach');
    expect(refused.out).toBe('');
    const plan = await run(['round', 'T-1', '--plan'], repo);
    expect(plan.code).toBe(2);
    expect(plan.err).toContain('strictness.stages.M.plan');
    // review rounds are not the approach critique: review is not off, so they answer
    expect((await run(['round', 'T-1'], repo)).err).not.toContain('strictness.stages');

    // the approval is LOCKED: accord approve still hashes the ticket's sections
    const approved = await run(['approve', 'T-1'], repo);
    expect(approved.code).toBe(0);
    expect(approved.out).toMatch(/^approved accord\/tickets\/T-1\.md at /);

    // with the stages on, the critic answers as today
    writeFiles(repo, { 'accord/config.yml': CONFIG });
    const on = await run(['round', 'T-1', '--approach'], repo);
    expect(on.code).toBe(0);
    expect(on.out).toMatch(/^Round: 1 of /);
    expect((await run(['round', 'T-1', '--plan'], repo)).code).toBe(0);
  } finally {
    cleanup(repo);
  }
}, 120_000);

const cfg = (repo: string): string => readFileSync(join(repo, 'accord', 'config.yml'), 'utf8');

it('risk:security a floor stage cannot be turned off: lint, accord config and the gates say so (ST-LN-50 t2-ac-5)', async () => {
  const repo = await built(CONFIG);
  try {
    // accord config set refuses, names the stage and the floor it guards, and leaves config.yml byte-identical
    const kept = cfg(repo);
    for (const [key, floor] of [
      ['strictness.stages.M.intent', 'intent and acceptance criteria before code'],
      ['strictness.stages.L.build', 'the change itself'],
      ['strictness.stages.P.verify', 'independent verification before done'],
      ['strictness.stages.S.review', "lane S's only independent check before done"],
      ['strictness.stages.S.intent', 'lane S has no stage off the floor'],
      ['strictness.stages.R.research', 'lane R has no stage off the floor'],
    ] as const) {
      const r = await run(['config', 'set', key, 'off'], repo);
      expect(r.code, key).toBe(2);
      expect(r.err, key).toContain(key);
      expect(r.err, key).toContain(floor);
      expect(r.err, key).toContain('accord/config.yml was not changed');
      expect(cfg(repo), key).toBe(kept);
    }
    // a switch that may be turned off, and any key set to on, is not refused
    expect((await run(['config', 'set', 'strictness.stages.M.verify', 'on'], repo)).code).toBe(0);
    expect((await run(['config', 'set', 'strictness.stages.M.review', 'off'], repo)).code).toBe(0);

    // hand-edited into the file anyway: lint names the stage and the floor, config check exits 2
    writeFiles(repo, { 'accord/config.yml': CONFIG + 'strictness:\n  stages:\n    M:\n      review: "off"\n      verify: "off"\n' });
    const lint = await run(['lint', '--json'], repo);
    expect(lint.code).toBe(1);
    const floor = (JSON.parse(lint.out) as { findings: { rule: string; level: string; pointer?: string; reason: string }[] }).findings.filter((f) => f.rule === 'lint.config-floor');
    expect(floor).toHaveLength(1);
    expect(floor[0]).toMatchObject({ level: 'error', pointer: '/strictness/stages/M/verify' });
    expect(floor[0].reason).toContain('verify');
    expect(floor[0].reason).toContain('independent verification before done');
    expect((await run(['config', 'check'], repo)).code).toBe(2);

    // the engines ignore the verify key (review off is the team's own): the built ticket is at verify and gate done still fails without a verification
    expect(await stageOf(repo)).toBe('verify');
    const done = await run(['gate', 'done', 'T-1', '--json'], repo);
    expect(done.code).toBe(1);
    const rules = (JSON.parse(done.out) as { findings: { rule: string }[] }).findings.map((f) => f.rule);
    expect(rules).toContain('gate.verification-missing');
  } finally {
    cleanup(repo);
  }
}, 180_000);

it('risk:security a hand-edited S.review off still leaves a lane S ticket without review.md failing gate.review-missing (ST-LN-50 t2-ac-5)', async () => {
  const repo = makeLaneRepo({
    'accord/config.yml': CONFIG + 'strictness:\n  stages:\n    S:\n      review: "off"\n',
    'accord/tickets/S-1.md': laneTicket('S-1', { lane: 'S', body: LANE_S_BODY }),
  });
  try {
    commitMsg(repo, 'claim: S-1');
    const lint = await run(['lint', '--json'], repo);
    const floor = (JSON.parse(lint.out) as { findings: { rule: string; pointer?: string; reason: string }[] }).findings.filter((f) => f.rule === 'lint.config-floor');
    expect(floor.map((f) => f.pointer)).toEqual(['/strictness/stages/S/review']);
    expect(floor[0].reason).toContain("lane S's only independent check before done");
    const done = await run(['gate', 'done', 'S-1', '--json'], repo);
    expect(done.code).toBe(1);
    expect((JSON.parse(done.out) as { findings: { rule: string }[] }).findings.map((f) => f.rule)).toContain('gate.review-missing');
  } finally {
    cleanup(repo);
  }
}, 120_000);

const textOf = async (repo: string, ...args: string[]): Promise<string> => (await run(args, repo)).out;

it('risk:complex-branching status names the stages that are off (ST-LN-50 t2-ac-5)', async () => {
  const repo = makeLaneRepo({ 'accord/config.yml': CONFIG + OFF('review') });
  try {
    commitMsg(repo, 'claim: T-1');
    const json = JSON.parse(await textOf(repo, 'status', '--json')) as Record<string, unknown>[];
    expect(json[0].stagesOff).toEqual(['review']);
    const text = await textOf(repo, 'status');
    expect(text).toContain('stages off for lane M: review' + String.fromCharCode(10));
    // after the table, before the summary line
    expect(text.indexOf('stages off for lane M: review')).toBeLessThan(text.indexOf('1 ticket shown'));
    expect(text.indexOf('stages off for lane M: review')).toBeGreaterThan(text.indexOf('T-1'));

    // with nothing off the outputs are today's: no key, no line
    writeFiles(repo, { 'accord/config.yml': CONFIG });
    expect(JSON.stringify(JSON.parse(await textOf(repo, 'status', '--json')))).not.toContain('stagesOff');
    expect(await textOf(repo, 'status')).not.toContain('stages off');
  } finally {
    cleanup(repo);
  }
}, 120_000);

it('risk:complex-branching every view names the stages that are off (ST-LN-50 t2-ac-5)', async () => {
  const repo = makeLaneRepo({ 'accord/config.yml': CONFIG + OFF('discuss', 'review') });
  try {
    gitRun(repo, 'config', 'user.email', 'fixture@example.invalid');
    gitRun(repo, 'config', 'user.name', 'fixture');
    gitRun(repo, 'config', 'commit.gpgsign', 'false');
    commitMsg(repo, 'claim: T-1');
    const views: string[][] = [['anchor', 'T-1'], ['show', 'T-1'], ['show', 'T-1', '--approval'], ['show', 'T-1', '--approval', '--short'], ['dashboard'], ['status']];
    const LINE = 'stages off for lane M: discuss, review';
    for (const args of views) {
      const r = await run(args, repo);
      expect(r.code, args.join(' ')).toBe(0);
      expect(r.out, args.join(' ')).toContain(LINE);
      // one line, however often the view prints the lane
      expect(r.out.split(LINE).length, args.join(' ')).toBe(2);
    }
    // the machine views stay as they were: show --json holds no such line
    expect((await run(['show', 'T-1', '--json'], repo)).out).not.toContain('stages off');

    // the anchor names it with the stage, before the sections
    const anchor = (await run(['anchor', 'T-1'], repo)).out;
    expect(anchor.indexOf(LINE)).toBeGreaterThan(anchor.indexOf('Stage:'));
    expect(anchor.indexOf(LINE)).toBeLessThan(anchor.indexOf('## Intent'));

    // with nothing off none of them prints it
    writeFiles(repo, { 'accord/config.yml': CONFIG });
    for (const args of views) expect((await run(args, repo)).out, args.join(' ')).not.toContain('stages off');
  } finally {
    cleanup(repo);
  }
}, 120_000);

it('risk:complex-branching the anchor header keeps the stages-off line right after the Stage line and puts the Unfinished line after it (ST-LN-50 D-08, ST-LN-72 review round 1)', async () => {
  const marked = ['---', 'baseline: abc1234', '---', '<!-- accord: unfinished -->', '', '# Plan', ''].join('\n');
  const repo = makeLaneRepo({ 'accord/config.yml': CONFIG + OFF('discuss', 'review'), 'accord/tickets/T-1/plan.md': marked });
  try {
    gitRun(repo, 'config', 'user.email', 'fixture@example.invalid');
    gitRun(repo, 'config', 'user.name', 'fixture');
    gitRun(repo, 'config', 'commit.gpgsign', 'false');
    commitMsg(repo, 'claim: T-1');
    gitRun(repo, 'switch', '-q', '-c', 't/T-1');
    // ST-LN-72 review round 2: the session-resume hook prints the same header lines as `accord anchor` (one shared helper)
    const headers: string[][] = [];
    for (const args of [['anchor', 'T-1'], ['anchor'], ['hook', 'session-resume']]) {
      const lines = (await run(args, repo)).out.split('\n');
      const stage = lines.findIndex((l) => l.startsWith('Stage:'));
      expect(stage, args.join(' ')).toBeGreaterThan(-1);
      expect(lines[stage + 1], args.join(' ')).toBe('stages off for lane M: discuss, review');
      expect(lines[stage + 2], args.join(' ')).toBe('Unfinished: accord/tickets/T-1/plan.md: resume the planner');
      expect(lines[stage + 3], args.join(' ')).toBe('');
      expect(lines[stage + 4], args.join(' ')).toBe('## Intent');
      headers.push(lines.slice(stage, stage + 5));
    }
    expect(headers[1]).toEqual(headers[0]);
    expect(headers[2]).toEqual(headers[0]);
  } finally {
    cleanup(repo);
  }
}, 120_000);
