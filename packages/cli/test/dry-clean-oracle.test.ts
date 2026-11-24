// Phase 08.9 D-02 clarification and D-08: the offline dry clean `accord audit` runs, read in batches against read per branch, on a repository that does not change while the clean runs.
// Only how facts are fetched differs between the two runs; every printed line, every merge-tree step and everything the run leaves behind must be the same.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { PassThrough } from 'node:stream';
import { afterEach, expect, it, vi } from 'vitest';
import { loadSnapshot } from '@accord-dev/accord-core';
import { laneTicket } from '../../../test/helpers/lane.js';
import { worktreeClean } from '../src/commands/worktree.js';
import * as limit from '../src/commands/fetch-limit.js';
import { loadFromFs } from '../src/load/fs.js';
import * as proc from '../src/load/proc.js';
import { readCleanFacts } from '../src/load/clean-facts.js';
import type { CleanFacts } from '../src/load/clean-facts.js';
import type { CommandContext } from '../src/run.js';
import { ALIVE } from './helpers/done.js';
import { countedSync, spawnLog } from './helpers/git-spawns.js';
import { commitMsg, gitRun, writeFiles } from './helpers/repo.js';
import { claimWorktree, copy, dropAndMerge, doneOnRemote, lines, ticketWorktree, useSandboxes } from './helpers/worktree.js';
import type { Clone } from './helpers/worktree.js';

vi.mock('../src/load/proc.js', async (orig) => {
  const real = await orig<typeof import('../src/load/proc.js')>();
  return { ...real, processTable: vi.fn(real.processTable) };
});
vi.mock('../src/commands/fetch-limit.js', async (orig) => {
  const real = await orig<typeof import('../src/commands/fetch-limit.js')>();
  return { ...real, fetchLimitMs: vi.fn(real.fetchLimitMs), cleanBudgetMs: vi.fn(real.cleanBudgetMs) };
});
vi.mock('../src/load/clean-facts.js', async (orig) => {
  const real = await orig<typeof import('../src/load/clean-facts.js')>();
  return { ...real, readCleanFacts: vi.fn(real.readCleanFacts) };
});
vi.mock('node:child_process', async (orig) => (await import('./helpers/git-spawns.js')).wrapChildProcess(await orig<typeof import('node:child_process')>()));

afterEach(() => {
  vi.mocked(limit.cleanBudgetMs).mockReset();
  spawnLog.on = false;
  spawnLog.after = undefined;
  spawnLog.fail = undefined;
  spawnLog.calls = [];
});

useSandboxes([{ tickets: ['ST-9', 'ST-10', 'ST-11', 'ST-12', 'ST-13'] }]);

/** The directory accord keeps its holds, records and locks in. */
const accordDir = (c: Clone) => c.git('rev-parse', '--path-format=absolute', '--git-common-dir').trim() + '/accord';

/** A git call that deletes, moves a ref, or prunes, by the arguments it carries; a `remote prune` is allowed only with `--dry-run`. */
const deleting = (a: string[]) =>
  a.includes('update-ref') || a.includes('push') || (a.includes('worktree') && (a.includes('remove') || a.includes('prune'))) || (a.includes('remote') && a.includes('prune') && !a.includes('--dry-run'));

const isRefsTable = (a: string[]) => a[0] === 'for-each-ref' && a.some((x) => x.includes('objecttype'));

/** The names and texts of the files under accord's own folder in the git directory. */
function accordFiles(dir: string): Record<string, string> {
  if (!existsSync(dir)) return {};
  return Object.fromEntries(readdirSync(dir).sort().map((n) => [n, statSync(`${dir}/${n}`).isFile() ? readFileSync(`${dir}/${n}`, 'utf8') : '<folder>']));
}

/** Everything a dry run must leave as it found it: every ref, the worktree list, the status of the main checkout and of each worktree, accord's own files. */
function stateOf(c: Clone) {
  const list = c.git('worktree', 'list', '--porcelain');
  const paths = list.split('\n').filter((l) => l.startsWith('worktree ')).map((l) => l.slice('worktree '.length).trim());
  return {
    refs: c.git('for-each-ref'),
    worktrees: list,
    status: Object.fromEntries(paths.map((p) => [p, gitRun(p, 'status', '--porcelain')])),
    accord: accordFiles(accordDir(c)),
  };
}

/** The offline dry clean of the audit, on a context loaded before the run; `perBranch` has the facts lookup answer nothing, so every read is today's per-branch read. */
function dry(c: Clone, perBranch: boolean) {
  let text = '';
  const stdout = {
    write(chunk: unknown) {
      text += String(chunk);
      return true;
    },
  } as unknown as NodeJS.WritableStream;
  const ctx = { root: c.root, snapshot: loadSnapshot(loadFromFs(c.root)), stdout, stderr: new PassThrough(), env: {} } as CommandContext;
  vi.mocked(readCleanFacts).mockClear();
  if (perBranch) vi.mocked(readCleanFacts).mockReturnValueOnce(undefined as unknown as CleanFacts);
  const { argv } = countedSync(() => worktreeClean(ctx, { fetched: 'ok', dry: 'offline' }));
  return { lines: lines(text), argv, facts: vi.mocked(readCleanFacts).mock.calls.length };
}

/** One repository holding the D-08 fixtures; fetched once at the end, because the offline clean fetches nothing. */
async function sandbox() {
  const c = copy({ tickets: ['ST-9', 'ST-10', 'ST-11', 'ST-12', 'ST-13'] });
  vi.mocked(proc.processTable).mockReturnValue(ALIVE);
  // (a) not accord's: a branch in a worktree of the user's own, and a branch that names no ticket anywhere
  c.git('worktree', 'add', '-q', '-b', 'topic/p89', c.sibling('topic-p89'), 'origin/main');
  writeFiles(c.sibling('topic-p89'), { 'topic.txt': 't\n' });
  commitMsg(c.sibling('topic-p89'), 'topic');
  const zz = c.git('commit-tree', c.git('rev-parse', 'origin/main^{tree}').trim(), '-p', 'origin/main', '-m', 'zz').trim();
  c.git('update-ref', 'refs/heads/t/ZZ-9', zz);
  // (b) the user's own worktree on a ticket branch in flight: the ticket is neither done nor dropped
  claimWorktree(c, 'ST-10');
  // (f) a done ticket with its worktree and its branch pushed, (c) a done ticket whose worktree holds uncommitted work, (d) a done ticket whose branch has a commit after its verified commit
  for (const id of ['ST-9', 'ST-11', 'ST-12']) ticketWorktree(c, id);
  doneOnRemote(c, ['ST-9', 'ST-11', 'ST-12'], { local: true });
  writeFiles(c.sibling('ST-11'), { 'dirty.txt': 'uncommitted\n' });
  writeFiles(c.sibling('ST-12'), { 'after.txt': 'after the verified commit\n' });
  commitMsg(c.sibling('ST-12'), 'after verify');
  // (e) a live claim: a teammate's pushed branch whose ticket lives only on that branch
  const o = c.otherClone();
  gitRun(o, 'switch', '-q', '-c', 't/ZZ-5', 'main');
  writeFiles(o, { 'accord/tickets/ZZ-5.md': laneTicket('ZZ-5') });
  commitMsg(o, 'claim: ZZ-5');
  gitRun(o, 'push', '-q', 'origin', 't/ZZ-5');
  // (g) a dropped ticket
  claimWorktree(c, 'ST-13', { 'accord/tickets/ST-13.md': laneTicket('ST-13'), 'src/a.ts': 'a\n' });
  await dropAndMerge(c, 'ST-13');
  // (h) a squash-merged backlog branch
  c.git('switch', '-q', '-c', 'backlog/p89', 'main');
  writeFiles(c.root, { 'backlog-p89.txt': 'b\n' });
  c.git('add', '-A');
  c.git('commit', '-q', '-m', 'backlog/p89');
  c.git('push', '-q', 'origin', 'backlog/p89');
  c.git('switch', '-q', 'main');
  const t = c.otherClone();
  gitRun(t, 'fetch', '-q', 'origin');
  gitRun(t, 'merge', '--squash', '-q', 'origin/backlog/p89');
  commitMsg(t, 'squash backlog/p89');
  gitRun(t, 'push', '-q', 'origin', 'main');
  c.git('fetch', '-q', 'origin');
  return c;
}

// Phase 08.9 D-08: the audit's dry clean, batched, prints what the per-branch dry clean prints and writes nothing.
it('risk:data-loss the batched dry clean of the audit prints the lines the per-branch dry clean prints and writes nothing (D-08)', async () => {
  const c = await sandbox();
  const before = stateOf(c);
  const dir = accordDir(c);
  let locked = false;
  spawnLog.after = () => {
    if (existsSync(dir + '/clean.lock') || existsSync(dir + '/holds.lock')) locked = true;
  };
  const batched = dry(c, false);
  const after = stateOf(c);
  const single = dry(c, true);
  spawnLog.after = undefined;

  expect(batched.lines).toEqual(single.lines);

  // the decision line each fixture exists for, on the per-branch path
  const all = single.lines.join('\n');
  expect(single.lines.some((l) => l.startsWith(`removed ${c.sibling('ST-9')}`)), all).toBe(true); // (f)
  expect(single.lines.some((l) => l.startsWith('deleted t/ST-9 (was ')), all).toBe(true);
  expect(single.lines.some((l) => l.startsWith('deleted origin/t/ST-9 (was ')), all).toBe(true);
  expect(single.lines.some((l) => l.startsWith(`kept ${c.sibling('ST-11')}: `) && l.includes('uncommitted work')), all).toBe(true); // (c)
  expect(single.lines.some((l) => l.startsWith('kept t/ST-12: it has commits after its verified commit')), all).toBe(true); // (d)
  expect(single.lines.some((l) => l.startsWith(`removed ${c.sibling('ST-13')}`)), all).toBe(true); // (g)
  expect(single.lines.some((l) => l.startsWith('deleted backlog/p89: merged into origin/main (was ')), all).toBe(true); // (h)
  for (const never of ['topic', 'ZZ-9', 'ZZ-5', 'ST-10']) expect(all.toLowerCase().includes(never.toLowerCase()), `${never} is named in: ${all}`).toBe(false); // (a) (b) (e)

  // the run wrote nothing
  expect(after).toEqual(before);
  expect(stateOf(c)).toEqual(before);
  expect(locked).toBe(false);
  expect(batched.argv.filter(deleting)).toEqual([]);
  expect(single.argv.filter(deleting)).toEqual([]);

  // the same merge-tree steps, and one read of the refs table
  const mergeTrees = (argv: string[][]) => argv.filter((a) => a.includes('merge-tree'));
  expect(mergeTrees(batched.argv)).toEqual(mergeTrees(single.argv));
  expect(mergeTrees(batched.argv).length).toBeGreaterThan(0);
  expect(batched.facts).toBe(1);
  expect(single.facts).toBe(1);
  expect(batched.argv.filter(isRefsTable)).toHaveLength(1);
  expect(single.argv.filter(isRefsTable)).toHaveLength(0);
}, 180_000);

// Phase 08.9 D-03 and D-08: a batched read that fails gives the per-branch lines, for each table alone and for all of them at once.
it('risk:data-loss the batched dry clean prints the per-branch lines when any of its batched reads fails (D-03 D-08)', async () => {
  const c = await sandbox();
  const reference = dry(c, true).lines;
  expect(reference.length).toBeGreaterThan(0);
  type Call = [string[], { input?: unknown } | undefined];
  // each table's own calls, told apart from every other git call of the clean by their arguments and the lines they are fed
  const fed = (o: Call[1], start: string) => String(o?.input ?? '').split('\n').some((l) => l.startsWith(start));
  const tables: Record<string, (a: string[], o: Call[1]) => boolean> = {
    refs: (a) => isRefsTable(a),
    reach: (a, o) => a[0] === 'rev-list' && a.includes('--stdin') && fed(o, '^'),
    objects: (a, o) => a[0] === 'cat-file' && a.includes('--batch-check') && String(o?.input ?? '').includes('^{commit}'),
  };
  const runs: Array<[string, string[]]> = [...Object.keys(tables).map((n): [string, string[]] => [n, [n]]), ['all three', Object.keys(tables)]];
  for (const [label, failing] of runs) {
    let hits = 0;
    spawnLog.fail = (a, o) => {
      const hit = failing.some((n) => tables[n](a, o));
      if (hit) hits++;
      return hit;
    };
    const batched = dry(c, false);
    spawnLog.fail = undefined;
    expect(hits, `${label}: its read was never started`).toBeGreaterThan(0);
    expect(batched.lines, label).toEqual(reference);
  }
}, 180_000);
