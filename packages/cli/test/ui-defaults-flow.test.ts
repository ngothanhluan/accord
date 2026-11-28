// Phase 11 G3 (D-07, 11-ac-8): a `ui: true` lane M ticket in a repository with no `ui.*` key reaches Done through accord's own defaults: a prototype for `gate ready`, the built-in `ui` lens recorded as
// `Lens: ui ran` in round 1 and the final review, a screenshot at `Tier: manual` or an owner check for `gate done`; `accord brief` prints no `agent:` line and `accord skills sync` renders no UI agent file.
// From the cut-off release (0.23.0, mocked below). Real git, real commands, one sandbox.
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { setFrontmatterKey } from '@accord-dev/accord-core';
import { afterEach, expect, it, vi } from 'vitest';
import { discussFiles, junit, LANE_BODY, laneTicket, P, PLAN, pinned, REPORT, writeReport } from '../../../test/helpers/lane.js';
import { cleanup, commitAll, commitMsg, gitRun, makeLaneRepo, run, writeFiles } from './helpers/repo.js';

vi.mock('../package.json', async (orig) => {
  const m = await orig<{ default: Record<string, unknown> }>();
  return { default: { ...m.default, version: '0.23.0' } };
});

const dirs: string[] = [];
afterEach(() => {
  while (dirs.length > 0) cleanup(dirs.pop() as string);
});

const VERIFICATION = 'accord/tickets/T-1/verification.md';
const EVIDENCE = 'accord/tickets/T-1/evidence/ac-1-empty.png';
// the plan of the helpers, with task 1's verify id unmapped and the report holding only the test of @ac-2: a @ui scenario carries no @test tag, so no verify id maps to it and no test of it exists
const UI_PLAN = PLAN.replace('verify: export#writes-csv (@ac-1)', 'verify: export#escapes-commas');
const BODY = LANE_BODY.replace('@ac-1 @test:export#writes-csv', '@ac-1 @ui');
const block = (...lines: string[]): string => ['## @ac-1 export writes a csv', '', 'Result: pass', ...lines, ''].join('\n');
const verification = (sha: string, first: string): string =>
  ['---', 'ticket: "T-1"', `commit: "${sha}"`, 'reviewed_on: "2026-11-28"', '---', '', first, '## @ac-2 commas are escaped', '', 'Result: pass', '', 'Evidence: export#escapes-commas passed in reports/junit.xml', ''].join('\n');

/**
 * A repository with no `ui` key in its config and the ui: true ticket T-1, a prototype for it, its plan and report, on branch t/T-1. Brought through approve, Ready and plan with the CLI, then the work, a
 * version 2 review of two rounds (round 2 is the final review) that record `Lens: ui ran`, and a verification.md with the `@ui` block (`block`) bound to the commit the ticks name.
 */
async function toDone(first: (sha: string) => string): Promise<string> {
  const repo = makeLaneRepo({
    'accord/config.yml': pinned('0.23.0'),
    [REPORT]: junit({ 'export#escapes-commas': 'passed' }),
    [P('T-1')]: laneTicket('T-1', { body: BODY }).replace('ui: false', 'ui: true'),
    'accord/assets/T-1/prototype.html': '<!doctype html><title>export</title>\n',
    ...discussFiles('T-1'),
  });
  dirs.push(repo);
  gitRun(repo, 'config', 'user.email', 'fixture@example.invalid');
  gitRun(repo, 'config', 'user.name', 'fixture');
  gitRun(repo, 'config', 'commit.gpgsign', 'false');
  commitAll(repo, 'base');
  gitRun(repo, 'branch', '-M', 'main');
  gitRun(repo, 'switch', '-q', '-c', 't/T-1');
  commitMsg(repo, 'claim: T-1', undefined, true);

  expect((await run(['approve', 'T-1'], repo)).code).toBe(0);
  const ready = await run(['gate', 'ready', 'T-1'], repo);
  expect(ready.code, ready.out + ready.err).toBe(0);
  const baseline = commitAll(repo, 'ready');
  writeFiles(repo, { 'accord/tickets/T-1/plan.md': UI_PLAN.replace('abc1234', baseline) });
  const plan = await run(['gate', 'plan', 'T-1'], repo);
  expect(plan.code, plan.out + plan.err).toBe(0);
  commitAll(repo, 'plan');

  writeFiles(repo, { 'src/export.ts': 'export const write = 1;\n// both tasks\n', 'accord/tickets/T-1/ledger.md': '## Tasks\n- task 1 done abc1234\n- task 2 done abc1234\n' });
  const work = commitMsg(repo, 'work');
  const text = [
    'Round record: 2',
    '',
    `## Round 1 head ${work}`,
    '',
    'No findings',
    'Security: no pattern matched',
    'Lens: ui ran',
    '',
    `## Round 2 head ${work} (final review)`,
    '',
    'No findings',
    'Security: no pattern matched',
    'Lens: ui ran',
    '',
    'verdict: converged',
    '',
  ].join('\n');
  writeFiles(repo, { 'accord/tickets/T-1/review.md': text });
  for (const n of [1, 2]) writeReport(repo, 'T-1', n);
  const sha = commitAll(repo, 'review');

  const file = join(repo, 'accord', 'tickets', 'T-1.md');
  let ticket = readFileSync(file, 'utf8');
  ticket = setFrontmatterKey(ticket, 'verified', ['ac-1', 'ac-2']);
  ticket = setFrontmatterKey(ticket, 'verified_hash', /^ac_hash: "(.+)"$/m.exec(ticket)?.[1] as string);
  ticket = setFrontmatterKey(ticket, 'verified_commit', sha);
  writeFileSync(file, ticket);
  writeFiles(repo, { [VERIFICATION]: verification(sha, first(sha)) });
  return repo;
}

const MANUAL = (sha: string): string => block('Tier: manual', `Evidence commit: ${sha}`, 'Evidence: accord/assets/T-1/prototype.html and the screenshot under accord/tickets/T-1/evidence/');
const OWNER = (): string => block('Tier: owner check', 'Owner: "the empty state shows the message on my phone"', 'Evidence: src/export.ts:3');

it('risk:regression a ui ticket with no ui keys passes every gate through the built-in defaults (11-ac-8, D-07)', async () => {
  const repo = await toDone(MANUAL);
  writeFiles(repo, { [EVIDENCE]: 'png' });
  const done = await run(['gate', 'done', 'T-1', '--json'], repo);
  const found = (JSON.parse(done.out).findings as { rule: string; level: string; reason: string }[]).filter((f) => f.level === 'error');
  expect(found).toEqual([]);
  expect(done.code, done.out + done.err).toBe(0);

  // the screenshot is what the tier rests on: without the file the same record is refused, naming the scenario
  rmSync(join(repo, ...EVIDENCE.split('/')));
  const refused = await run(['gate', 'done', 'T-1', '--json'], repo);
  expect(refused.code).toBe(1);
  const ui = (JSON.parse(refused.out).findings as { rule: string; reason: string }[]).filter((f) => f.rule === 'gate.ui-evidence-missing');
  expect(ui).toHaveLength(1);
  expect(ui[0].reason).toContain('@ac-1');
}, 300_000);

it('risk:regression the same ticket with an owner check, the owner\'s words and a cited path and no screenshot passes gate done (11-ac-8, D-16)', async () => {
  const repo = await toDone(OWNER);
  expect(existsSync(join(repo, ...EVIDENCE.split('/')))).toBe(false);
  const done = await run(['gate', 'done', 'T-1'], repo);
  expect(done.out).not.toContain(' error ');
  expect(done.code, done.out + done.err).toBe(0);

  // the brief of its task names no UI executor and a sync renders no UI agent file
  const brief = await run(['brief', 'T-1', '1', '--out', 'brief-1.md'], repo);
  expect(brief.code, brief.err).toBe(0);
  expect(brief.out).not.toMatch(/^agent: /m);
  expect(readFileSync(join(repo, '.accord-reports', 'T-1', 'brief-1.md'), 'utf8')).not.toContain('accord-executor-ui');
  const sync = await run(['skills', 'sync'], repo);
  expect(sync.code, sync.err).toBe(0);
  for (const name of ['accord-executor-ui.md', 'accord-reviewer-ui.md']) expect(existsSync(join(repo, '.claude', 'agents', name)), name).toBe(false);
}, 300_000);
