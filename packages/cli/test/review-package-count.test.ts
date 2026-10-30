// ST-LN-63 task 14: review-package reads the default ref once for itself and the branch fact, not once each.
import { expect, it, vi } from 'vitest';
import { cleanup, commitMsg, gitRun, makeEmptyRepo, run, writeFiles } from './helpers/repo.js';
import { spawnLog } from './helpers/git-spawns.js';
import { CONFIG, LANE_S_BODY, laneTicket } from '../../../test/helpers/lane.js';

vi.mock('node:child_process', async (orig) => (await import('./helpers/git-spawns.js')).wrapChildProcess(await orig()));

it('risk:complex-branching the review package reads the default ref once for its exclusion and the branch fact', async () => {
  const repo = makeEmptyRepo();
  try {
    gitRun(repo, 'config', 'user.email', 'an@example.com');
    gitRun(repo, 'config', 'user.name', 'an');
    gitRun(repo, 'config', 'commit.gpgsign', 'false');
    writeFiles(repo, {
      'accord/config.yml': CONFIG,
      'accord/tickets/S-1.md': laneTicket('S-1', { lane: 'S', body: LANE_S_BODY + '\n## Scope\nsrc/a.ts\n' }),
      'src/a.ts': 'a\n',
    });
    commitMsg(repo, 'base');
    gitRun(repo, 'branch', '-M', 'main');
    gitRun(repo, 'switch', '-q', '-c', 't/S-1');
    writeFiles(repo, { 'src/b.ts': 'b\n' });
    commitMsg(repo, 'change');
    spawnLog.calls = [];
    spawnLog.on = true;
    let r;
    try {
      r = await run(['review-package', 'S-1'], repo);
    } finally {
      spawnLog.on = false;
    }
    expect(r.code).toBe(0);
    expect(r.out).toContain('## Out-of-scope files');
    // The loader reads it once; review-package reads it once and hands it to the branch fact.
    const reads = spawnLog.calls.filter((c) => c.includes('for-each-ref') && c.includes('refs/remotes/origin/HEAD'));
    expect(reads.length).toBe(2);
  } finally {
    cleanup(repo);
  }
}, 120_000);
