// Phase 8.5 G2 (D-21, D-22, D-03, D-06, R-8, R-11): a ticket claimed at or after PRODUCT_TEXT_FROM gets the task brief in the shared layout (the ruleset first, the conventions under
// `## Conventions`, the lines accord writes last); a ticket claimed before it keeps today's brief. The CLI runs as 0.13.0 here, so HEAD's pin can be 0.13.0 while a ticket was
// claimed under 0.12.2 (task-report.test.ts's reason).
import { mkdtempSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, expect, it, vi } from 'vitest';
import { FINDINGS_DUTY, REPORT_CONTRACT, WRITER_DUTY, rulesetText } from '@accord-dev/accord-core';
import { LANE_BODY, PLAN, REPORT, laneTicket, pinned } from '../../../test/helpers/lane.js';
import pkg from '../package.json' with { type: 'json' };
import { claimedUnder, cleanup, commitAll, gitRun, makeLaneRepo, run, writeFiles } from './helpers/repo.js';

vi.mock('../package.json', async (orig) => {
  const m = await orig<{ default: Record<string, unknown> }>();
  return { default: { ...m.default, version: '0.13.0' } };
});

const WORK_DIR_RULE = 'Work only in this folder: run every command and make every commit there, give every path as an absolute path under it, and never merge, rebase or push.';
const ONLY = 'This is the only test command the executor runs for this task.';
const NO_FILES = 'No file list applies: the plan stage is off, so no task names files; {files} is left out of the command.';
const PLAN_OFF_LINE = 'The plan stage is off for lane M: build the whole ticket as task 1; every scenario that is not @ui needs one test that proves it.';
const OFF = 'strictness:\n  stages:\n    M:\n      plan: "off"\n';
const CONFIG_013 = pinned('0.13.0').replace(`  report: ${REPORT}\n`, `  report: ${REPORT}\n  affected: "npx vitest run {files}"\n`) + 'commits:\n  message:\n    preset: conventional\n';
const L1 = '- Rule one of the team.';
const L2 = '- Rule two of the team.';
const COMMIT_RULE = [
  'Commit rule: the first line of every commit message matches commits.message.preset conventional.',
  'Example that passes: feat(cart): add coupon field',
  'Merge commits and Revert "..." subjects are exempt.',
  'Check each message with accord commit check <file> before you commit it; accord task-done refuses a commit that breaks the rule.',
];
const TASK_1 = ['# Plan', '', '## Task 1: Writer csv mode', 'covers: @ac-1, D-01', 'files: src/export.ts', 'verify: export#writes-csv (@ac-1)', 'after: none', 'Add a csv branch to the writer.'].join('\n');
const VETO = '- No lemon squeezers in the epic.';

const repos: string[] = [];
afterEach(() => {
  while (repos.length > 0) cleanup(repos.pop() as string);
});

/** A lane M sandbox at the 0.13.0 pin with the team's two rules, its ticket claimed under `claim`. */
function sandbox(claim: string, config = CONFIG_013, extra: Record<string, string> = {}): string {
  const repo = makeLaneRepo({ 'accord/config.yml': config, 'accord/product/conventions.md': L1 + '\n' + L2 + '\n', ...extra });
  repos.push(repo);
  claimedUnder(repo, claim);
  return repo;
}

const ruleset = (): string => rulesetText(`npx --yes ${pkg.name}@${pkg.version}`).replace(/\n+$/, '');
const dirOf = (out: string): string => /^Work dir: (.+)$/m.exec(out)?.[1] ?? '';
const ticketText = (repo: string, id = 'T-1'): string => readFileSync(join(repo, 'accord', 'tickets', id + '.md'), 'utf8').replace(/\n+$/, '');
const conventionsBlock = ['## Conventions', WRITER_DUTY, L1, L2].join('\n');

/** The brief the task path must print at or after the cut-off. */
function newBrief(repo: string, dir: string, section: string, test: string[]): string {
  const cli = [
    'Work dir: ' + dir,
    WORK_DIR_RULE,
    'Report file: ' + dir + '/.accord-reports/T-1/task-1.md',
    ...REPORT_CONTRACT.split('\n').filter((l) => l !== ''),
    ...test,
    ...COMMIT_RULE,
  ];
  return [ruleset(), ticketText(repo), section, conventionsBlock].join('\n\n') + '\n\n' + cli.join('\n') + '\n';
}

it('risk:regression a ticket claimed at the cut-off gets the ruleset first and the lines accord writes last (8.5-ac-10 D-21)', async () => {
  const repo = sandbox('0.13.0');
  const r = await run(['brief', 'T-1', '1'], repo);
  expect(r.code, r.err).toBe(0);
  const dir = dirOf(r.out);
  expect(realpathSync.native(dir)).toBe(realpathSync.native(repo));
  expect(r.out).toBe(newBrief(repo, dir, TASK_1, ['Test command: npx vitest run src/export.ts', ONLY]));
  expect(r.out.startsWith(ruleset())).toBe(true);
  expect(r.out.trimEnd().split('\n').pop()).toBe(COMMIT_RULE[3]);

  const off = sandbox('0.13.0', CONFIG_013 + OFF);
  const planOff = await run(['brief', 'T-1', '1'], off);
  expect(planOff.code, planOff.err).toBe(0);
  expect(planOff.out).toBe(newBrief(off, dirOf(planOff.out), PLAN_OFF_LINE, ['Test command: npx vitest run', ONLY, NO_FILES]));
}, 120_000);

it('risk:security the brief reads the working branch\'s conventions (8.5-ac-10 D-06)', async () => {
  const repo = sandbox('0.13.0'); // the claim commit holds the conventions on the default branch
  gitRun(repo, 'checkout', '-q', '-b', 't/T-1');
  writeFiles(repo, { 'accord/product/conventions.md': L1 + '\n' });
  commitAll(repo, 'the branch deleted a line');
  const r = await run(['brief', 'T-1', '1'], repo);
  expect(r.code, r.err).toBe(0);
  expect(r.out).toContain(['## Conventions', WRITER_DUTY, L1].join('\n') + '\n\nWork dir:');
  expect(r.out).not.toContain(L2);
}, 120_000);

it('risk:regression the fix brief\'s conventions block equals the task brief\'s byte for byte (8.5-ac-4 D-02)', async () => {
  const repo = sandbox('0.13.0');
  const folder = mkdtempSync(join(tmpdir(), 'accord-findings-'));
  repos.push(folder);
  const file = join(folder, 'findings.md');
  writeFileSync(file, '1. src/export.ts:3 - the header row is dropped.\n');
  const block = (out: string): string => out.slice(out.indexOf('## Conventions'), out.indexOf('\n\nWork dir:'));
  const task = await run(['brief', 'T-1', '1'], repo);
  const fix = await run(['brief', 'T-1', '--fix', file], repo);
  expect(task.code, task.err).toBe(0);
  expect(fix.code, fix.err).toBe(0);
  expect(block(task.out)).toBe(conventionsBlock);
  expect(block(fix.out)).toBe(block(task.out));
  expect(fix.out).toContain(FINDINGS_DUTY);
}, 120_000);

it('risk:security the executor\'s brief holds no epic block (8.5-ac-12 D-03)', async () => {
  const epic = laneTicket('E-1', { lane: 'L', body: ['## Intent', 'Group the stories.', '', '## Vetoes', VETO, '', '## Decisions', '- D-01 One cart — "one cart"', '', '## Corrections', ''].join('\n') })
    .replace('type: story', 'type: epic')
    .replace('title: "Export"', 'title: "Checkout epic"');
  const repo = sandbox('0.13.0', CONFIG_013, {
    'accord/tickets/E-1.md': epic,
    'accord/tickets/S-1.md': laneTicket('S-1', { frontmatter: ['parent: "E-1"'], body: LANE_BODY }),
    'accord/tickets/S-1/plan.md': PLAN,
  });
  claimedUnder(repo, '0.13.0', 'S-1');
  // the epic reaches the roles that plan and judge: the story's anchor holds its Veto
  expect((await run(['anchor', 'S-1'], repo)).out).toContain(VETO);
  const folder = mkdtempSync(join(tmpdir(), 'accord-findings-'));
  repos.push(folder);
  const file = join(folder, 'findings.md');
  writeFileSync(file, '1. src/export.ts:3 - the header row is dropped.\n');
  for (const argv of [['brief', 'S-1', '1'], ['brief', 'S-1', '--fix', file]]) {
    const r = await run(argv, repo);
    expect(r.code, argv.join(' ') + ': ' + r.err).toBe(0);
    expect(r.out, argv.join(' ')).not.toContain('## Epic');
    expect(r.out, argv.join(' ')).not.toContain('lemon squeezers');
  }
}, 120_000);

it('risk:regression a ticket claimed under 0.12.2 still gets today\'s brief while the CLI is 0.13.0 (8.5-ac-6 D-22)', async () => {
  const repo = sandbox('0.12.2');
  const r = await run(['brief', 'T-1', '1'], repo);
  expect(r.code, r.err).toBe(0);
  // today's shape: the ticket, ---, the task, ---, the lines accord writes, the commit rule block, the raw conventions append
  expect(r.out.startsWith(ticketText(repo) + '\n\n---\n\n# Plan\n\n## Task 1:')).toBe(true);
  expect(r.out).not.toContain('# accord rules');
  expect(r.out).not.toContain('## Conventions');
  expect(r.out.endsWith('\n---\n\n' + COMMIT_RULE.join('\n') + '\n\n---\n\n' + L1 + '\n' + L2 + '\n')).toBe(true);
}, 120_000);

it('risk:regression the fix brief has one layout for any claim pin (8.5-ac-4 R-11 D-22 D-31)', async () => {
  const folder = mkdtempSync(join(tmpdir(), 'accord-findings-'));
  repos.push(folder);
  const file = join(folder, 'findings.md');
  writeFileSync(file, '1. src/export.ts:3 - the header row is dropped.\n');
  const texts: string[] = [];
  for (const claim of ['0.12.2', '0.13.0']) {
    const repo = sandbox(claim);
    const r = await run(['brief', 'T-1', '--fix', file], repo);
    expect(r.code, claim + ': ' + r.err).toBe(0);
    const forms = new Set([repo, realpathSync.native(repo)].flatMap((p) => [p, p.replace(/\\/g, '/')]));
    let text = r.out;
    for (const form of [...forms].sort((a, b) => b.length - a.length)) text = text.split(form).join('<root>');
    texts.push(text);
    expect(r.out.startsWith(ruleset()), claim).toBe(true);
    expect(r.out.trimEnd().split('\n').pop(), claim).toBe(COMMIT_RULE[3]);
  }
  expect(texts[0]).toBe(texts[1]);
}, 120_000);
