// ST-LN-28 D-14 (7-ac-9): `accord new ticket --type epic --lane L --split <file>` writes an approved epic and every story in one
// step, in the working tree or, with --queue, as one commit on one backlog branch. Real files and real git in tmp sandboxes.
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, expect, it } from 'vitest';
import { cleanup, commitAll, gitRun, makeEmptyRepo, run, writeFiles } from './helpers/repo.js';
import { CONFIG } from '../../../test/helpers/lane.js';

const repos: string[] = [];
afterEach(() => {
  while (repos.length > 0) cleanup(repos.pop() as string);
});

/** A repository whose config assigns ids to the person AN, with one commit. */
function sandbox(): string {
  const repo = makeEmptyRepo();
  repos.push(repo);
  writeFiles(repo, { 'accord/config.yml': CONFIG + 'people:\n  "an@example.com": AN\n' });
  commitAll(repo);
  gitRun(repo, 'config', 'user.email', 'an@example.com');
  return repo;
}
const listing = (repo: string): string[] => (existsSync(join(repo, 'accord', 'tickets')) ? readdirSync(join(repo, 'accord', 'tickets')).sort() : []);
const lines = (s: string): string[] => s.split('\n').filter((l) => l !== '');
const text = (repo: string, id: string): string => readFileSync(join(repo, 'accord', 'tickets', id + '.md'), 'utf8');

/** The three-story split of the plan: the third story comes after the first two. */
const SPLIT = [
  'title: Checkout redesign',
  'intent:',
  '  - Buyers pay with fewer taps.',
  '  - Success is a faster checkout.',
  'vetoes:',
  '  - No new dependency.',
  'stories:',
  '  - title: Cart summary',
  '    intent:',
  '      - Show the cart before payment.',
  '  - title: Payment form',
  '    intent: [Collect the card details.]',
  '    after: [1]',
  '  - title: Receipt email',
  '    intent: [Send a receipt after payment.]',
  '    after: [1, 2]',
  '',
].join('\n');

it('ac-9 an approved split creates the epic and every story in one step (ST-LN-28 7-ac-9)', async () => {
  const repo = sandbox();
  writeFileSync(join(repo, 'split.yml'), SPLIT);
  const branches = gitRun(repo, 'branch', '--list');
  const r = await run(['new', 'ticket', '--type', 'epic', '--lane', 'L', '--split', 'split.yml', '--related', 'none'], repo);
  expect(r.code, r.out + r.err).toBe(0);

  // four files, each path printed once in file order: the epic, then the stories with ascending ids
  const paths = lines(r.out).filter((l) => l.startsWith('accord/tickets/'));
  expect(paths).toEqual(['accord/tickets/EP-AN-1.md', 'accord/tickets/ST-AN-1.md', 'accord/tickets/ST-AN-2.md', 'accord/tickets/ST-AN-3.md']);
  expect(listing(repo)).toEqual(['EP-AN-1.md', 'ST-AN-1.md', 'ST-AN-2.md', 'ST-AN-3.md']);

  const epic = text(repo, 'EP-AN-1');
  expect(epic).toContain('\nid: "EP-AN-1"');
  expect(epic).toContain('\ntype: epic');
  expect(epic).toContain('\nlane: "L"');
  expect(epic).toContain('\ntitle: "Checkout redesign"');
  expect(epic).toContain('Buyers pay with fewer taps.\nSuccess is a faster checkout.\n');
  expect(epic).toContain('\n- No new dependency.\n');

  const [one, two, three] = ['ST-AN-1', 'ST-AN-2', 'ST-AN-3'].map((id) => text(repo, id));
  for (const [i, t] of [one, two, three].entries()) {
    expect(t, 'story ' + (i + 1)).toContain('\ntype: story');
    expect(t, 'story ' + (i + 1)).toContain('\nlane: "M"');
    expect(t, 'story ' + (i + 1)).toContain('\nparent: "EP-AN-1"');
  }
  expect(one).toContain('\ntitle: "Cart summary"');
  expect(one).toContain('Show the cart before payment.');
  expect(one).not.toMatch(/^depends_on:/m);
  expect(two).toMatch(/^depends_on:\n {2}- "ST-AN-1"\n/m);
  expect(three).toMatch(/^depends_on:\n {2}- "ST-AN-1"\n {2}- "ST-AN-2"\n/m);

  // the files lint clean; no worktree, branch or claim came with them
  const lint = await run(['lint'], repo);
  expect(lint.code, lint.out + lint.err).toBe(0);
  expect(lint.out + lint.err).not.toMatch(/ST-AN-|EP-AN-/);
  expect(lines(gitRun(repo, 'worktree', 'list'))).toHaveLength(1);
  expect(gitRun(repo, 'branch', '--list')).toBe(branches);
  expect(existsSync(join(repo, '.git', 'accord'))).toBe(false);
});
