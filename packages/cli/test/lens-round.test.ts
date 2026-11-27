// Phase 11 plan 06 (11-ac-6, D-05): `accord round` holds each recorded review round against the team lenses its own package printed, recomputed from git and the lens files at the default branch, on
// real git. The CLI here runs as the cut-off release (0.23.0), so a ticket claimed under it is judged.
import { afterEach, expect, it, vi } from 'vitest';
import { laneTicket, PLAN, pinned } from '../../../test/helpers/lane.js';
import { cleanup, commitMsg, gitRun, makeEmptyRepo, run, writeFiles } from './helpers/repo.js';

vi.mock('../package.json', async (orig) => {
  const m = await orig<{ default: Record<string, unknown> }>();
  return { default: { ...m.default, version: '0.23.0' } };
});

const REVIEW = 'accord/tickets/T-1/review.md';
const DB = '---\npaths: [src/db/]\non_finding: block\n---\n\n- Every query uses parameters.\n';
const dirs: string[] = [];
afterEach(() => {
  while (dirs.length > 0) cleanup(dirs.pop() as string);
});

const record = (head: string, ...lines: string[]): string => `Round record: 2\n\n## Round 1 head ${head}\n\n${['No findings', 'Security: no pattern matched', ...lines].join('\n')}\n`;

/** A lane M ticket claimed under 0.23.0 on its own branch: main holds the config, T-1 and the lenses; the branch has the claim, the plan and one code commit (`code`), then review.md headed by that commit. */
function claimed(o: { lenses?: Record<string, string>; code: Record<string, string>; review: (head: string) => string }): { repo: string; base: string; head: string } {
  const repo = makeEmptyRepo();
  dirs.push(repo);
  gitRun(repo, 'config', 'user.email', 'an@example.com');
  gitRun(repo, 'config', 'user.name', 'an');
  gitRun(repo, 'config', 'commit.gpgsign', 'false');
  writeFiles(repo, {
    'accord/config.yml': pinned('0.23.0'),
    'accord/tickets/T-1.md': laneTicket('T-1'),
    'src/run.ts': 'export const one = 1;\n',
    ...Object.fromEntries(Object.entries(o.lenses ?? {}).map(([name, text]) => [`accord/lenses/${name}.md`, text])),
  });
  const base = commitMsg(repo, 'base');
  gitRun(repo, 'branch', '-M', 'main');
  gitRun(repo, 'switch', '-q', '-c', 't/T-1');
  commitMsg(repo, 'claim: T-1', undefined, true);
  writeFiles(repo, { 'accord/tickets/T-1/plan.md': PLAN.replace('abc1234', base), ...o.code });
  const head = commitMsg(repo, 'code');
  writeFiles(repo, { [REVIEW]: o.review(head) });
  commitMsg(repo, 'round 1');
  return { repo, base, head };
}

it('risk:regression accord round refuses a round that skipped the printed db lens, naming the dispatch, and answers once the round records it, on real git (11-ac-6, D-05)', async () => {
  const box = claimed({ lenses: { db: DB }, code: { 'src/db/x.ts': 'export const q = 1;\n' }, review: (h) => record(h) });
  const refused = await run(['round', 'T-1'], box.repo);
  expect(refused.err).toBe('');
  expect(refused.code).toBe(1);
  expect(refused.out).toContain('refused:');
  expect(refused.out).toContain('round 1 of cycle 1');
  expect(refused.out).toContain('lens db (on_finding block)');
  expect(refused.out).toContain('accord review-package T-1 --lens db --round 1');

  // the round records the lens, and the refusal is gone
  writeFiles(box.repo, { [REVIEW]: record(box.head, 'Lens: db ran') });
  commitMsg(box.repo, 'lens review');
  const next = await run(['round', 'T-1'], box.repo);
  expect(next.out).not.toContain('refused:');
  expect(next.out).toContain('Round: 2');
  expect(next.code).toBe(0);
}, 240_000);
