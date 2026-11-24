// Phase 08.9 D-07, split from worktree-clean.test.ts: a squash- or rebase-merged ticket branch is judged merged by `accord worktree clean` (ST-LN-96 t1-ac-5).
import { existsSync, rmSync } from 'node:fs';
import { afterEach, expect, it, vi } from 'vitest';
import * as limit from '../src/commands/fetch-limit.js';
import { spawnLog } from './helpers/git-spawns.js';
import { commitMsg, gitRun, run, writeFiles } from './helpers/repo.js';
import { copy, doneTicket, has, lines, pushMain, ticketWorktree, useSandboxes, verifyStage, withAction, type Clone } from './helpers/worktree.js';

vi.mock('../src/load/proc.js', async (orig) => {
  const real = await orig<typeof import('../src/load/proc.js')>();
  return { ...real, processTable: vi.fn(real.processTable) };
});
vi.mock('../src/commands/fetch-limit.js', async (orig) => {
  const real = await orig<typeof import('../src/commands/fetch-limit.js')>();
  return { ...real, fetchLimitMs: vi.fn(real.fetchLimitMs), cleanBudgetMs: vi.fn(real.cleanBudgetMs) };
});
vi.mock('node:child_process', async (orig) => (await import('./helpers/git-spawns.js')).wrapChildProcess(await orig<typeof import('node:child_process')>()));

afterEach(() => {
  vi.mocked(limit.cleanBudgetMs).mockReset();
  spawnLog.on = false;
  spawnLog.after = undefined;
  spawnLog.fail = undefined;
  spawnLog.calls = [];
});

useSandboxes([
  {},
]);

/**
 * ST-LN-96 t1-ac-5: ticket `id` (a worktree made by ticketWorktree, its code file `<id>.txt` holding one line) is verified on its branch by a
 * teammate and merged into the remote main by `how`, the way a host's squash or rebase button does it; no merge commit, so the branch tip is never
 * an ancestor of main. The branch's last commit (the one after the verified commit) sets the code file to `code`, deletes it, and adds `bulk`
 * files; `later` is a commit on main after the merge; `extra` is a commit on the branch after the merge that main lacks. The local branch is then
 * brought to the origin tip, so both are judged at it.
 */
function mergedBy(c: Clone, id: string, how: 'squash' | 'rebase', o: { file?: string; code?: string | null; bulk?: number; later?: string; extra?: Record<string, string> } = {}): { tip: string } {
  const other = c.otherClone();
  gitRun(other, 'fetch', '-q', 'origin');
  gitRun(other, 'switch', '-q', '--detach', `origin/t/${id}`);
  verifyStage(other, id);
  const v = gitRun(other, 'rev-parse', 'HEAD').trim();
  const files: Record<string, string> = { [`accord/tickets/${id}.md`]: doneTicket(id, v) };
  const file = o.file ?? `${id}.txt`;
  if (typeof o.code === 'string') files[file] = o.code;
  for (let i = 0; i < (o.bulk ?? 0); i++) files[`bulk/f${i}.txt`] = `f${i}\n`;
  writeFiles(other, files);
  if (o.code === null) rmSync(`${other}/${file}`);
  const tip = commitMsg(other, 'verify: ' + id);
  gitRun(other, 'push', '-q', 'origin', `${tip}:refs/heads/t/${id}`);
  gitRun(other, 'switch', '-q', 'main');
  if (how === 'squash') {
    gitRun(other, 'merge', '--squash', '-q', tip);
    commitMsg(other, 'merge ' + id);
  } else {
    // main moves first, so the replayed commits get new shas
    writeFiles(other, { 'elsewhere.txt': 'elsewhere\n' });
    commitMsg(other, 'elsewhere');
    gitRun(other, 'switch', '-q', '-c', 'replay', tip);
    gitRun(other, 'rebase', '-q', 'main');
    gitRun(other, 'switch', '-q', 'main');
    gitRun(other, 'merge', '--ff-only', '-q', 'replay');
  }
  if (o.later !== undefined) {
    writeFiles(other, { [file]: o.later });
    commitMsg(other, 'main edits ' + id);
  }
  gitRun(other, 'push', '-q', 'origin', 'main');
  c.git('fetch', '-q', 'origin');
  gitRun(c.sibling(id), 'merge', '--ff-only', '-q', `origin/t/${id}`);
  if (o.extra !== undefined) {
    writeFiles(c.sibling(id), o.extra);
    gitRun(c.sibling(id), 'add', '-A');
    commitMsg(c.sibling(id), 'after the merge');
    gitRun(c.sibling(id), 'push', '-q', 'origin', `t/${id}`);
  }
  return { tip: gitRun(c.sibling(id), 'rev-parse', 'HEAD').trim() };
}

for (const how of ['squash', 'rebase'] as const) {
  it(`risk:data-loss worktree clean treats a ${how}-merged branch as merged, even after main edits its files (ST-LN-96 t1-ac-5)`, async () => {
    for (const later of [undefined, 'ST-9 later\n']) {
      const c = copy();
      ticketWorktree(c, 'ST-9');
      const { tip } = mergedBy(c, 'ST-9', how, { code: 'ST-9 fixed\n', later });
      const r = await run(['worktree', 'clean'], c.root, {});
      expect(r.code).toBe(0);
      expect(lines(r.out), `${how}, main edited after: ${later !== undefined}`).toEqual([withAction(`removed ${c.sibling('ST-9')}`), withAction(`deleted t/ST-9 (was ${tip})`), withAction(`deleted origin/t/ST-9 (was ${tip})`)]);
      expect(has(c.root, 'refs/heads/t/ST-9')).toBe(false);
      expect(has(c.remote, 'refs/heads/t/ST-9')).toBe(false);
    }
  }, 120_000);

  it(`risk:data-loss worktree clean keeps a ${how}-merged branch with content main lacks (ST-LN-96 t1-ac-5)`, async () => {
    const reason = withAction('kept t/ST-9: merging it into origin/main conflicts');
    // one more commit after the merge that adds a file main lacks
    const plain = copy();
    ticketWorktree(plain, 'ST-9');
    mergedBy(plain, 'ST-9', how, { code: 'ST-9 fixed\n', extra: { 'extra.txt': 'extra\n' } });
    expect(lines((await run(['worktree', 'clean'], plain.root, {})).out)).toEqual([withAction('kept t/ST-9: it has commits after its verified commit')]);
    // the extra commit conflicts with a later edit on main, and main never held its blob
    const edited = copy();
    ticketWorktree(edited, 'ST-9');
    const { tip } = mergedBy(edited, 'ST-9', how, { code: 'ST-9 fixed\n', later: 'ST-9 later\n', extra: { 'ST-9.txt': 'ST-9 extra\n' } });
    expect(lines((await run(['worktree', 'clean'], edited.root, {})).out)).toEqual([reason]);
    expect(edited.git('rev-parse', 'refs/heads/t/ST-9').trim()).toBe(tip);
    expect(existsSync(edited.sibling('ST-9'))).toBe(true);
    // the branch's own change deleted a file that main has again, edited
    const deleted = copy();
    pushMain(deleted, 'shared.txt', 'shared\n');
    deleted.git('fetch', '-q', 'origin');
    ticketWorktree(deleted, 'ST-9');
    mergedBy(deleted, 'ST-9', how, { file: 'shared.txt', code: null, later: 'shared later\n' });
    expect(lines((await run(['worktree', 'clean'], deleted.root, {})).out)).toEqual([reason]);
    expect(has(deleted.remote, 'refs/heads/t/ST-9')).toBe(true);
    // more than 200 changed paths are never looked up
    const bulk = copy();
    ticketWorktree(bulk, 'ST-9');
    mergedBy(bulk, 'ST-9', how, { code: 'ST-9 fixed\n', later: 'ST-9 later\n', bulk: 201 });
    expect(lines((await run(['worktree', 'clean'], bulk.root, {})).out)).toEqual([reason]);
    expect(has(bulk.root, 'refs/heads/t/ST-9')).toBe(true);
  }, 180_000);
}

