// Phase 15 D-12 to D-15, D-33 (15-09): `accord worktree push <id>` sends the claim branch's commits to refs/accord/<id>, a ref that is not a branch and starts no CI, and only
// where `progress.push` allows it. Every origin here is a bare repository in a temporary folder: no test touches a network or a real host.
import { expect, it } from 'vitest';
import { CONFIG } from '../../../test/helpers/lane.js';
import { commitMsg, gitRun, run, writeFiles } from './helpers/repo.js';
import { makeClone, type Clone } from './helpers/worktree.js';

/** The claim worktree of ST-9 with the claim branch pushed, then `accord/config.yml` set to `extra` in one local commit (not pushed). */
function claimed(c: Clone, extra: string): string {
  c.git('worktree', 'add', '-q', '-b', 't/ST-9', c.sibling('ST-9'), 'origin/main');
  const wt = c.sibling('ST-9');
  writeFiles(wt, { 'src/export.ts': 'export const write = 1;\n' });
  commitMsg(wt, 'claim: ST-9');
  gitRun(wt, 'push', '-q', '-u', 'origin', 't/ST-9');
  if (extra !== '') {
    writeFiles(wt, { 'accord/config.yml': CONFIG + extra });
    commitMsg(wt, 'config: progress push');
  }
  writeFiles(wt, { 'notes.txt': 'notes\n' });
  commitMsg(wt, 'build: ST-9 task 1');
  return wt;
}

const head = (dir: string) => gitRun(dir, 'rev-parse', 'HEAD').trim();
const branchOnOrigin = (c: Clone) => gitRun(c.remote, 'rev-parse', 'refs/heads/t/ST-9').trim();
const refOnOrigin = (c: Clone): string | undefined => {
  try {
    return gitRun(c.remote, 'rev-parse', '--verify', '-q', 'refs/accord/ST-9').trim();
  } catch {
    return undefined;
  }
};

it('risk:regression with progress.push ref a stage push lands on refs/accord/<id> and the claim branch on origin does not move (D-12, D-14)', async () => {
  const c = makeClone();
  try {
    const wt = claimed(c, 'progress:\n  push: ref\n');
    const claimTip = branchOnOrigin(c);
    expect(claimTip).not.toBe(head(wt));

    const r = await run(['worktree', 'push', 'ST-9'], wt);
    expect(r).toEqual({ code: 0, out: 'pushed: refs/accord/ST-9\n', err: '' });
    expect(refOnOrigin(c)).toBe(head(wt));
    expect(branchOnOrigin(c)).toBe(claimTip);
  } finally {
    c.cleanupAll();
  }
}, 120_000);
