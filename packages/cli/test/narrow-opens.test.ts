// Phase 08.9.2 Ruling-narrow, Ruling-structural: a command for one ticket opens the same number of files under accord/tickets/ in a repository with 5 extra tickets and in one with 50.
// The proof is a count of `readFileSync` calls (helpers/fs-opens.ts), never a stopwatch.
import { afterEach, expect, it, vi } from 'vitest';
import { countedOpens } from './helpers/fs-opens.js';
import { cleanup, run } from './helpers/repo.js';
import { narrowFixture, STORY } from './helpers/narrow-fixture.js';

vi.mock('node:fs', async (orig) => (await import('./helpers/fs-opens.js')).wrapFs(await orig()));

const repos: string[] = [];
afterEach(() => {
  for (const r of repos.splice(0)) cleanup(r);
});

/** The ticket files, record files and folders a run read, as paths under accord/tickets/. */
const ticketOpens = (paths: readonly string[]): string[] => paths.filter((p) => p.includes('/accord/tickets/'));

async function opensOf(extra: number, argv: string[]): Promise<{ count: number; paths: string[]; code: number }> {
  const repo = narrowFixture(extra);
  repos.push(repo);
  // one settling run, so a key the first passing gate writes into the ticket is written before the count
  await run(argv, repo, { CI: '1' });
  const { value, paths } = await countedOpens(() => run(argv, repo, { CI: '1' }));
  const opened = ticketOpens(paths);
  return { count: opened.length, paths: opened, code: value.code };
}

// Phase 08.9.2 Ruling-structural: the ticket files `gate ready` opens do not grow with the number of other tickets.
it('risk:resource gate ready opens as many ticket files at 5 and at 50 extra tickets (Ruling-structural)', async () => {
  const argv = ['gate', 'ready', STORY, '--json'];
  const few = await opensOf(5, argv);
  const many = await opensOf(50, argv);
  expect(few.code, 'the run at 5 extra tickets did not fail to start').toBeLessThan(2);
  expect(many.code, 'the run at 50 extra tickets did not fail to start').toBeLessThan(2);
  expect({ at5: few.count, at50: many.count }, `opened at 5: ${few.count}, at 50: ${many.count}`).toEqual({ at5: many.count, at50: many.count });
  expect(many.count, 'a number that does not grow, and small').toBeLessThan(20);
}, 300_000);
