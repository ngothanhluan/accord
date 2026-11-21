// G-07-2: the rendered ids.md, worktree.md and accord/queue.md say where the people entry goes: the queue command commits it with the draft,
// new ticket reads initials from other branches, and the carry rule covers an entry an earlier run left uncommitted.
import { expect, it } from 'vitest';
import { skillTargets } from '../src/index.js';
import type { AccordConfig } from '../src/index.js';

const config: AccordConfig = {
  accord: '0.1.0',
  profile: 'build',
  tracker: { adapter: 'none' },
  design: { tokens: '' },
  roles: ['ba', 'dev'],
  runtimes: ['claude'],
};
const files = skillTargets(config);
const flat = (text: string): string => text.replace(/\s+/g, ' ');
const rendered = (suffix: string): { path: string; text: string }[] => files.filter((f) => f.path.startsWith('.claude/skills/') && f.path.endsWith(suffix)).map((f) => ({ path: f.path, text: flat(f.text) }));

it('risk:regression 7-ac-4 G-07-2 every rendered ids.md says the queue commits the entry and where new ticket reads initials', () => {
  const ids = rendered('/ids.md');
  expect(ids.length).toBe(6);
  const missing = ids.flatMap(({ path, text }) =>
    [
      "then from origin's default branch, then from any fetched branch whose entries agree",
      "The queue route needs no carry: its command commits your entry with the draft when origin's default branch does not list you, and prints a `people:` line.",
      'remove it, and only it, leaving every other line of the file as it is',
    ]
      .filter((phrase) => !text.includes(phrase))
      .map((phrase) => path + ': ' + phrase),
  );
  expect(missing).toEqual([]);
});

it('risk:regression 7-ac-4 G-07-2 every rendered worktree.md carries an entry an earlier run left uncommitted', () => {
  const worktree = rendered('/worktree.md');
  expect(worktree.length).toBe(5);
  const missing = worktree.flatMap(({ path, text }) =>
    [
      '`git diff HEAD -- accord/config.yml` here shows your entry under `people` as added',
      'in this run or an earlier one',
      'carry it to the worktree before you stop or move into it',
      'already lists your email',
    ]
      .filter((phrase) => !text.includes(phrase))
      .map((phrase) => path + ': ' + phrase),
  );
  expect(missing).toEqual([]);
});

it('risk:regression 7-ac-4 G-07-2 the rendered accord/queue.md says what its commit holds and follows the people line', () => {
  const queue = flat(files.find((f) => f.path === '.claude/skills/accord/queue.md')?.text ?? '');
  expect(queue).not.toBe('');
  expect(queue).toContain('then a `people:` line when it committed your entry; do what that line says');
  expect(queue).toContain('except the `people` entry `./ids.md` has you add and a `people:` line has you remove');
  // the claim as it stood: the commit held the draft alone
  expect(queue).not.toContain('holding only the draft');
});
