// ST-LN-50 D-05: `accord new ticket` assigns ids from a team pattern, or takes a tracker key, and lint reads
// the same convention. Every case runs in its own sandbox repository through runCli, as new-ticket.test.ts does.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, expect, it } from 'vitest';
import { cleanup, commitAll, gitRun, makeEmptyRepo, run, writeFiles } from './helpers/repo.js';
import { CONFIG } from '../../../test/helpers/lane.js';

const repos: string[] = [];
afterEach(() => {
  while (repos.length > 0) cleanup(repos.pop() as string);
});

/** An empty repository holding one commit: the accord config plus `extra` lines of config. */
function sandbox(extra: string): string {
  const repo = makeEmptyRepo();
  repos.push(repo);
  writeFiles(repo, { 'accord/config.yml': CONFIG + extra });
  commitAll(repo);
  return repo;
}
const ticket = (repo: string, id: string): string => join(repo, 'accord', 'tickets', id + '.md');
const listing = (repo: string): string[] => (existsSync(join(repo, 'accord', 'tickets')) ? readdirSync(join(repo, 'accord', 'tickets')).sort() : []);

it('risk:complex-branching new ticket assigns from the team pattern (ST-LN-50 t2-ac-1)', async () => {
  const repo = sandbox('ids:\n  pattern: "FEAT-{n}"\n');
  const first = await run(['new', 'ticket', '--type', 'story'], repo);
  expect(first.code).toBe(0);
  expect(first.out).toBe('accord/tickets/FEAT-1.md\n');
  const second = await run(['new', 'ticket', '--type', 'story'], repo);
  expect(second.out).toBe('accord/tickets/FEAT-2.md\n');
  expect(readFileSync(ticket(repo, 'FEAT-2'), 'utf8')).toContain('id: "FEAT-2"');
  // a FEAT-7 held only on another branch of the clone is never reused
  gitRun(repo, 'update-ref', 'refs/remotes/origin/t/FEAT-7', 'HEAD');
  const third = await run(['new', 'ticket', '--type', 'story'], repo);
  expect(third.out).toBe('accord/tickets/FEAT-8.md\n');
  const lint = await run(['lint'], repo);
  expect(lint.err + lint.out).not.toContain('lint.id-convention');
  expect(lint.code).toBe(0);
});

it('risk:complex-branching a hand-typed id is refused while the pattern assigns (ST-LN-50 t2-ac-1)', async () => {
  const repo = sandbox('ids:\n  pattern: "FEAT-{n}"\n');
  const before = listing(repo);
  const { code, err } = await run(['new', 'ticket', 'FEAT-5'], repo);
  expect(code).toBe(2);
  expect(err).toContain('FEAT-5 was typed by hand');
  expect(err).toContain('ids');
  expect(listing(repo)).toEqual(before);
});

it('risk:complex-branching a pattern with {type} renders the configured prefix per type (ST-LN-50 t2-ac-1)', async () => {
  const repo = sandbox('ids:\n  pattern: "{type}-{n}"\n  types: { story: FEAT, bug: DEFECT, epic: EPIC }\n');
  expect((await run(['new', 'ticket', '--type', 'story'], repo)).out).toBe('accord/tickets/FEAT-1.md\n');
  expect((await run(['new', 'ticket', '--type', 'bug'], repo)).out).toBe('accord/tickets/DEFECT-1.md\n');
  expect((await run(['new', 'ticket', '--type', 'epic'], repo)).out).toBe('accord/tickets/EPIC-1.md\n');
  expect((await run(['new', 'ticket', '--type', 'story'], repo)).out).toBe('accord/tickets/FEAT-2.md\n');
});

it('risk:complex-branching a pattern with {initials} keeps the people flow (ST-LN-50 t2-ac-1)', async () => {
  const repo = sandbox('people:\n  "an@example.com": AN\nids:\n  pattern: "{type}-{initials}-{n}"\n  types: { story: FEAT }\n');
  gitRun(repo, 'config', 'user.email', 'an@example.com');
  expect((await run(['new', 'ticket', '--type', 'story'], repo)).out).toBe('accord/tickets/FEAT-AN-1.md\n');
  gitRun(repo, 'config', 'user.email', 'bo@example.com');
  const before = listing(repo);
  const refused = await run(['new', 'ticket', '--type', 'story'], repo);
  expect(refused.code).toBe(2);
  expect(refused.err).toContain('bo@example.com is not registered');
  expect(listing(repo)).toEqual(before);
});

it('risk:complex-branching with no ids key the ids are today\'s and a pattern-free repository needs an id (ST-LN-50 t2-ac-1)', async () => {
  const repo = sandbox('people:\n  "an@example.com": AN\n');
  gitRun(repo, 'config', 'user.email', 'an@example.com');
  expect((await run(['new', 'ticket', '--type', 'bug'], repo)).out).toBe('accord/tickets/BUG-AN-1.md\n');
  const bare = sandbox('');
  const { code, err } = await run(['new', 'ticket'], bare);
  expect(code).toBe(2);
  expect(err).toContain('a ticket id is required');
  expect(existsSync(ticket(bare, 'FEAT-1'))).toBe(false);
});
