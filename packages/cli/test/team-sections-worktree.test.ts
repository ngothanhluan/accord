// ST-LN-50 t2-ac-7, D-10: the two paths of `accord new ticket` that team-sections.test.ts leaves out. With `--worktree` the ticket is committed on its own
// branch with the team's sections in it, and a `template` key the schema refuses stops the command with exit 2 before anything is written. Real git in
// sandboxes with a bare remote, as subject-templates.test.ts.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { expect, it, vi } from 'vitest';
import { CONFIG } from '../../../test/helpers/lane.js';
import { commitMsg, run } from './helpers/repo.js';
import { copy, useSandboxes } from './helpers/worktree.js';

vi.mock('../src/load/proc.js', async (orig) => {
  const real = await orig<typeof import('../src/load/proc.js')>();
  return { ...real, processTable: vi.fn(real.processTable) };
});
vi.mock('../src/commands/fetch-limit.js', async (orig) => {
  const real = await orig<typeof import('../src/commands/fetch-limit.js')>();
  return { ...real, fetchLimitMs: vi.fn(real.fetchLimitMs) };
});

useSandboxes([{ tickets: [] }]);

const HINT = '<!-- A team section from accord/config.yml template.sections; accord does not check its content. -->';
const headings = (text: string): string[] => [...text.matchAll(/^## (.*)$/gm)].map((m) => m[1]);

it('risk:complex-branching new ticket --worktree commits the team sections with the ticket (ST-LN-50 t2-ac-7)', async () => {
  const c = copy({ tickets: [] });
  writeFileSync(`${c.root}/accord/config.yml`, CONFIG + 'template:\n  sections:\n    - name: Problem\n      after: Intent\n    - name: Rollout\n');
  commitMsg(c.root, 'config: team sections');
  c.git('push', '-q', 'origin', 'main');

  const made = await run(['new', 'ticket', 'ST-9', '--lane', 'M', '--worktree', '--no-dup-check'], c.root);
  expect(made.err).toBe('');
  expect(made.code).toBe(0);

  // the claim commit holds the ticket as accord new ticket wrote it, sections in place
  const committed = c.git('show', 't/ST-9:accord/tickets/ST-9.md');
  expect(headings(committed)).toEqual(['Intent', 'Problem', 'Acceptance criteria', 'Vetoes', 'Decisions', 'Corrections', 'Rollout', 'Open questions', 'Approach']);
  expect(committed).toContain('## Problem\n' + HINT + '\n\n## Acceptance criteria\n');
  expect(committed).toContain('## Rollout\n' + HINT + '\n\n## Open questions\n');

  // and so does the file in the ticket's own worktree
  const inTree = `${c.sibling('ST-9')}/accord/tickets/ST-9.md`;
  expect(existsSync(inTree)).toBe(true);
  expect(readFileSync(inTree, 'utf8')).toBe(committed);
}, 180_000);

it('risk:security new ticket exits 2 on a template key the schema refuses and writes nothing (ST-LN-50 t2-ac-7)', async () => {
  const c = copy({ tickets: [] });
  writeFileSync(`${c.root}/accord/config.yml`, CONFIG + 'template:\n  sections:\n    - name: lower case start\n');
  commitMsg(c.root, 'config: refused team section');
  c.git('push', '-q', 'origin', 'main');
  const before = c.git('status', '--porcelain');

  for (const args of [['new', 'ticket', 'ST-9', '--lane', 'M', '--no-dup-check'], ['new', 'ticket', 'ST-9', '--lane', 'M', '--worktree', '--no-dup-check']]) {
    const r = await run(args, c.root);
    expect(r.code, args.join(' ')).toBe(2);
    expect(r.err, args.join(' ')).toContain('accord/config.yml');
    expect(r.err, args.join(' ')).toContain('template');
    expect(r.err, args.join(' ')).toContain('fix accord/config.yml before creating a ticket');
    expect(r.out, args.join(' ')).toBe('');
  }

  // nothing written: no ticket file, no branch, no sibling worktree, a tree as clean as it was
  expect(existsSync(`${c.root}/accord/tickets/ST-9.md`)).toBe(false);
  expect(c.git('branch', '--list', 't/ST-9').trim()).toBe('');
  expect(existsSync(c.sibling('ST-9'))).toBe(false);
  expect(c.git('status', '--porcelain')).toBe(before);
}, 180_000);
