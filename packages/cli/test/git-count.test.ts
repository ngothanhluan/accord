// ST-LN-63: tests that count the git processes accord itself starts, against the baseline in git-counts.before.json.
import { afterAll, beforeAll, expect, it, vi } from 'vitest';
import { CONFIG, laneTicket, PLAN, REPORT, junit } from '../../../test/helpers/lane.js';
import { counted } from './helpers/runs.js';
import { expectFewer } from './helpers/items.js';
import { cleanup, commitMsg, gitRun, makeEmptyRepo, writeFiles } from './helpers/repo.js';
import { prepareSamples, SAMPLE_BUILD_LIMIT, samples } from './helpers/samples.js';

vi.mock('node:child_process', async (orig) => (await import('./helpers/git-spawns.js')).wrapChildProcess(await orig<typeof import('node:child_process')>()));

beforeAll(() => prepareSamples(), SAMPLE_BUILD_LIMIT);
afterAll(() => {
  const { mixed, side } = samples();
  mixed.cleanup();
  side.cleanup();
});

const isAncestor = (a: string[]) => a[0] === 'merge-base' && a.includes('--is-ancestor');
const isLsTree = (a: string[]) => a.includes('ls-tree');
const isRecordsDiff = (a: string[]) => a[0] === 'diff' && ['--name-only', '-z', '--no-renames', 'HEAD'].every((f) => a.includes(f));
const history = (a: string[]) => isAncestor(a) || isLsTree(a) || isRecordsDiff(a);

type Finding = { rule: string; reason: string };
const rulesOf = (out: string): Finding[] => (JSON.parse(out) as { findings: Finding[] }).findings;
const planFor = (baseline: string, files = 'src/export.ts') => PLAN.replace('abc1234', baseline).replace('files: src/export.ts\nverify: export#escapes', `files: ${files}\nverify: export#escapes`);

// Six times the local time of this test (about 40 s of git work with the sample copy), at least.
const LIMIT = 600_000;

it('risk:complex-branching gate plan and gate done read baseline history for the gated ticket alone and the read commands read none', async () => {
  const repo = makeEmptyRepo();
  try {
    writeFiles(repo, {
      'accord/config.yml': CONFIG,
      [REPORT]: junit({ 'export#writes-csv': 'passed', 'export#escapes-commas': 'passed' }),
      'src/export.ts': 'export const write = 1;\n',
      'accord/tickets/T-1.md': laneTicket('T-1'),
      'accord/tickets/T-2.md': laneTicket('T-2'),
      'accord/tickets/T-3.md': laneTicket('T-3'),
      'accord/tickets/T-4.md': laneTicket('T-4'),
    });
    const base = commitMsg(repo, 'base');
    // A commit on a side branch: a real commit that is not an ancestor of HEAD.
    const main = gitRun(repo, 'rev-parse', '--abbrev-ref', 'HEAD').trim();
    gitRun(repo, 'checkout', '-q', '-b', 'side');
    writeFiles(repo, { 'side.txt': 'side\n' });
    const orphan = commitMsg(repo, 'side');
    gitRun(repo, 'checkout', '-q', main);
    writeFiles(repo, {
      'accord/tickets/T-1/plan.md': planFor(base),
      'accord/tickets/T-2/plan.md': planFor(base, 'src/export.ts, src/missing.ts'),
      'accord/tickets/T-3/plan.md': planFor(orphan),
    });
    const recorded = commitMsg(repo, 'plans');
    // T-4's ticks were made against the commit before HEAD, and HEAD changes only T-4's own records.
    writeFiles(repo, { 'accord/tickets/T-4.md': laneTicket('T-4', { frontmatter: [`verified_commit: "${recorded}"`] }) });
    commitMsg(repo, 'T-4 ticks');

    const plan1 = await counted(['gate', 'plan', 'T-1', '--json'], repo);
    expect(rulesOf(plan1.out).filter((f) => f.rule === 'gate.task-file-unknown')).toEqual([]);
    expect(plan1.argv.filter(isAncestor)).toHaveLength(1);
    expect(plan1.argv.filter(isLsTree)).toHaveLength(1);

    const plan2 = await counted(['gate', 'plan', 'T-2', '--json'], repo);
    const missing = rulesOf(plan2.out).filter((f) => f.rule === 'gate.task-file-unknown');
    expect(missing).toHaveLength(1);
    expect(missing[0].reason).toContain('src/missing.ts');

    const plan3 = await counted(['gate', 'plan', 'T-3', '--json'], repo);
    expect(rulesOf(plan3.out).map((f) => f.rule)).toContain('gate.plan-baseline-unknown');

    const done = await counted(['gate', 'done', 'T-4', '--json'], repo);
    expect(rulesOf(done.out).map((f) => f.rule)).not.toContain('gate.tick-stale-commit');
    expect(done.argv.filter(isRecordsDiff)).toHaveLength(1);

    for (const argv of [['status'], ['lint'], ['dashboard'], ['show', 'T-1'], ['anchor', 'T-1']]) {
      const r = await counted(argv, repo);
      expect(r.argv.filter(history), argv.join(' ')).toEqual([]);
    }
  } finally {
    cleanup(repo);
  }
  await expectFewer('main status', history);
}, LIMIT);
