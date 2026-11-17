// ST-LN-36 (05-04): three repositories whose `accord review-package` text was recorded from origin/main's logic before the security section existed
// (fixtures/review-package-before/<kind>.txt), so a test can show the refactor of the package diff changed no byte of what the command printed.
import { cleanup, commitMsg, gitRun, makeEmptyRepo, mergeMsg, writeFiles } from './repo.js';
import { CONFIG, LANE_S_BODY, laneTicket, PLAN } from '../../../../test/helpers/lane.js';

export type PackageFixture = 'lane-m' | 'lane-s' | 'excluded';
export const PACKAGE_FIXTURES: PackageFixture[] = ['lane-m', 'lane-s', 'excluded'];

/** The ticket id each fixture reviews. */
export const fixtureTicket = (kind: PackageFixture): string => (kind === 'lane-s' ? 'S-1' : 'T-1');

const RUN_BASE = 'export const one = 1;\nexport const two = 2;\nexport const three = 3;\n';

/** Build the repository of `kind` with the branch checked out; the caller cleans it up. */
export function packageFixture(kind: PackageFixture): string {
  const repo = makeEmptyRepo();
  try {
    gitRun(repo, 'config', 'user.email', 'an@example.com');
    gitRun(repo, 'config', 'user.name', 'an');
    gitRun(repo, 'config', 'commit.gpgsign', 'false');
    writeFiles(repo, {
      'accord/config.yml': CONFIG,
      'accord/tickets/T-1.md': laneTicket('T-1'),
      'accord/tickets/S-1.md': laneTicket('S-1', { lane: 'S', body: LANE_S_BODY }),
      'src/run.ts': RUN_BASE,
      'docs/notes.md': 'notes\n',
    });
    const base = commitMsg(repo, 'base');
    gitRun(repo, 'branch', '-M', 'main');
    if (kind === 'lane-s') {
      gitRun(repo, 'switch', '-q', '-c', 't/S-1');
      writeFiles(repo, { 'src/run.ts': RUN_BASE + "spawnSync('git', ['status']);\n", 'docs/notes.md': 'notes\nmore notes\n' });
      commitMsg(repo, 'spawn and notes');
      return repo;
    }
    gitRun(repo, 'switch', '-q', '-c', 't/T-1');
    writeFiles(repo, { 'accord/tickets/T-1/plan.md': PLAN.replace('abc1234', base), 'src/a.ts': 'export const a = 1;\n' });
    commitMsg(repo, 'plan and first code');
    if (kind === 'lane-m') {
      writeFiles(repo, { 'src/run.ts': RUN_BASE + "spawnSync('git', ['status']);\n", 'docs/notes.md': 'notes\nmore notes\n', '.github/workflows/ci.yml': 'name: ci\n' });
      commitMsg(repo, 'spawn, notes and a workflow');
      return repo;
    }
    // excluded: the default branch moved, was merged into the branch, and a fix followed the merge
    gitRun(repo, 'switch', '-q', 'main');
    writeFiles(repo, { 'src/m.ts': 'export const m = 1;\n' });
    commitMsg(repo, 'main moves');
    gitRun(repo, 'switch', '-q', 't/T-1');
    mergeMsg(repo, 'main', 'merge main');
    writeFiles(repo, { 'src/a.ts': "export const a = 1;\nexecSync('ls');\n" });
    commitMsg(repo, 'fix after the merge');
    return repo;
  } catch (e) {
    cleanup(repo);
    throw e;
  }
}
