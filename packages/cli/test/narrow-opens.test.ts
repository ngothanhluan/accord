// Phase 08.9.2 Ruling-narrow, Ruling-structural: a command for one ticket opens the same number of files under accord/tickets/ in a repository with 5 extra tickets and in one with 50.
// The proof is a count of `readFileSync` calls (helpers/fs-opens.ts), never a stopwatch.
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, expect, it, vi } from 'vitest';
import { countedOpens } from './helpers/fs-opens.js';
import { cleanup, gitRun, run } from './helpers/repo.js';
import { narrowFixture, STORY } from './helpers/narrow-fixture.js';

vi.mock('node:fs', async (orig) => (await import('./helpers/fs-opens.js')).wrapFs(await orig()));

const repos: string[] = [];
const folders: string[] = [];
afterEach(() => {
  for (const f of folders.splice(0)) rmSync(f, { recursive: true, force: true, maxRetries: 5 });
  for (const r of repos.splice(0)) cleanup(r);
});

/** The ticket files, record files and folders a run read, as paths under accord/tickets/. */
const ticketOpens = (paths: readonly string[]): string[] => paths.filter((p) => p.includes('/accord/tickets/'));

/** Where a run starts: the repository itself, or a worktree of it on the story's claim branch. */
type Where = 'repository' | 'story worktree';

async function opensOf(extra: number, argv: string[], where: Where = 'repository', stdin?: (cwd: string) => string): Promise<{ count: number; paths: string[]; code: number }> {
  const repo = narrowFixture(extra);
  repos.push(repo);
  let cwd = repo;
  if (where === 'story worktree') {
    const folder = mkdtempSync(join(tmpdir(), 'accord-opens-wt-'));
    folders.push(folder);
    cwd = join(folder, 'wt');
    gitRun(repo, 'worktree', 'add', '-q', cwd, 't/' + STORY);
  }
  // one settling run, so a key the first passing gate writes into the ticket is written before the count
  await run(argv, cwd, { CI: '1' }, stdin?.(cwd));
  const { value, paths } = await countedOpens(() => run(argv, cwd, { CI: '1' }, stdin?.(cwd)));
  const opened = ticketOpens(paths);
  return { count: opened.length, paths: opened, code: value.code };
}

/** The count at 5 and at 50 extra tickets, which must be one number, and small. */
async function sameAt5And50(argv: string[], where: Where = 'repository', stdin?: (cwd: string) => string): Promise<number> {
  const few = await opensOf(5, argv, where, stdin);
  const many = await opensOf(50, argv, where, stdin);
  expect(few.code, argv.join(' ') + ' at 5 extra tickets did not fail to start').toBeLessThan(2);
  expect(many.code, argv.join(' ') + ' at 50 extra tickets did not fail to start').toBeLessThan(2);
  expect({ at5: few.count, at50: many.count }, `${argv.join(' ')} opened at 5: ${few.count}, at 50: ${many.count}`).toEqual({ at5: many.count, at50: many.count });
  expect(many.count, argv.join(' ') + ' opens a number that does not grow, and small').toBeLessThan(20);
  return many.count;
}

// Phase 08.9.2 Ruling-structural: the ticket files `gate ready` opens do not grow with the number of other tickets.
it('risk:resource gate ready opens as many ticket files at 5 and at 50 extra tickets (Ruling-structural)', async () => {
  await sameAt5And50(['gate', 'ready', STORY, '--json']);
}, 300_000);

// Phase 08.9.2 Ruling-structural: Plan, Done and the anchor of a story under an epic open the same ticket files at 5 and at 50 extra tickets, and the anchor on the default branch opens none.
it('risk:resource gate plan gate done and anchor open as many ticket files at 5 and at 50 extra tickets (Ruling-structural)', async () => {
  await sameAt5And50(['gate', 'plan', STORY, '--json']);
  await sameAt5And50(['gate', 'done', STORY, '--json']);
  await sameAt5And50(['anchor', STORY]);
  await sameAt5And50(['anchor'], 'story worktree');
  expect(await sameAt5And50(['anchor']), 'the anchor on the default branch names no ticket, so it opens no ticket file').toBe(0);
}, 600_000);

// Phase 08.9.2 Ruling-structural: the ticket files `show --json` and `show` open do not grow with the number of other tickets, for a story under an epic, for the epic and for a ticket with claimed dependencies.
it('risk:resource show json opens as many ticket files at 5 and at 50 extra tickets (Ruling-structural)', async () => {
  await sameAt5And50(['show', STORY, '--json']);
  await sameAt5And50(['show', STORY]);
  await sameAt5And50(['show', 'E-1', '--json']);
  await sameAt5And50(['show', 'V-1', '--json']);
}, 600_000);

// Phase 08.9.2 Ruling-structural: the executor dispatch check (pre-tool-use) and the epic role's SubagentStart open the same ticket files at 5 and at 50 extra tickets, in the story's worktree and on the default branch.
it('risk:resource the executor dispatch check and the epic role start open as many ticket files at 5 and at 50 extra tickets (Ruling-structural)', async () => {
  const dispatch = (cwd: string): string =>
    JSON.stringify({ session_id: 's-1', cwd, hook_event_name: 'PreToolUse', tool_name: 'Agent', tool_input: { subagent_type: 'accord-executor', model: 'sonnet', description: 'fix', prompt: 'Brief: b.md' } });
  const scout = (cwd: string): string => JSON.stringify({ session_id: 's-1', cwd, hook_event_name: 'SubagentStart', agent_type: 'accord-scout' });
  await sameAt5And50(['hook', 'pre-tool-use'], 'story worktree', dispatch);
  await sameAt5And50(['hook', 'subagent-start'], 'story worktree', scout);
  expect(await sameAt5And50(['hook', 'pre-tool-use'], 'repository', dispatch), 'the default branch names no ticket, so the dispatch check opens no ticket file').toBe(0);
  expect(await sameAt5And50(['hook', 'subagent-start'], 'repository', scout), 'and neither does the epic role start').toBe(0);
}, 900_000);
