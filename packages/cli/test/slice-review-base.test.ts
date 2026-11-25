// Phase 15 plan 16 (D-10): each slice is reviewed on its own diff. On a slice branch `accord anchor` says which slice the session is on and where it started, and `accord review-package <id>` with no --base
// before round 1 reads the diff from that slice's start (the merge base with the previous slice's branch), so slice 2's reviewer does not read slice 1 again. Real git in temporary sandboxes.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, expect, it } from 'vitest';
import { CONFIG, laneTicket, PLAN } from '../../../test/helpers/lane.js';
import { cleanup, commitAll, commitMsg, gitRun, makeLaneRepo, run, writeFiles } from './helpers/repo.js';

const dirs: string[] = [];
afterEach(() => {
  while (dirs.length > 0) cleanup(dirs.pop() as string);
});

const SLICES = ['## Slice 1: Writer', 'tasks: 1', 'covers: @ac-1', '', '## Slice 2: Escaping', 'tasks: 2', 'covers: @ac-2', '', '## Slice 3: Docs', 'tasks: 2', 'covers: @ac-2', ''].join('\n');

interface Box {
  repo: string;
  /** The fixture commit the plan's baseline names. */
  base: string;
  /** The tip of t/T-1 (slice 1's last commit). */
  one: string;
  /** The tip of slice/T-1/2 (slice 2's last commit). */
  two: string;
}

/**
 * T-1 with a plan of three slices (baseline = the fixture commit). t/T-1 holds the claim, the plan and src/one.ts; slice/T-1/2 is cut at its tip and adds src/two.ts; slice/T-1/3 is cut at that and adds
 * src/three.ts. The checkout is left on slice/T-1/2 and origin/main names the fixture commit.
 */
function sandbox(o: { slices?: string } = {}): Box {
  const repo = makeLaneRepo({ 'accord/config.yml': CONFIG, 'accord/tickets/T-1.md': laneTicket('T-1') });
  dirs.push(repo);
  const base = commitAll(repo);
  gitRun(repo, 'update-ref', 'refs/remotes/origin/main', base);
  gitRun(repo, 'switch', '-q', '-c', 't/T-1');
  commitMsg(repo, 'claim: T-1', undefined, true);
  writeFiles(repo, { 'accord/tickets/T-1/plan.md': PLAN.replace('baseline: abc1234', `baseline: ${base}`) + (o.slices ?? SLICES) });
  commitMsg(repo, 'plan: T-1');
  writeFiles(repo, { 'src/one.ts': 'export const one = 1;\n' });
  const one = commitMsg(repo, 'feat: slice one');
  gitRun(repo, 'switch', '-q', '-c', 'slice/T-1/2');
  writeFiles(repo, { 'src/two.ts': 'export const two = 2;\n' });
  const two = commitMsg(repo, 'feat: slice two');
  gitRun(repo, 'switch', '-q', '-c', 'slice/T-1/3');
  writeFiles(repo, { 'src/three.ts': 'export const three = 3;\n' });
  commitMsg(repo, 'feat: slice three');
  gitRun(repo, 'switch', '-q', 'slice/T-1/2');
  return { repo, base, one, two };
}

const short = (sha: string): string => sha.slice(0, 7);
const sliceLine = (out: string): string | undefined => out.split('\n').find((l) => l.startsWith('Slice: '));

it('risk:regression accord anchor on a slice branch prints Slice: n of m from the tip of the slice before it (D-10)', async () => {
  const { repo, base, one, two } = sandbox();
  const second = await run(['anchor'], repo);
  expect(second.code, second.out + second.err).toBe(0);
  expect(sliceLine(second.out)).toBe(`Slice: 2 of 3, from ${short(one)}`);

  // slice 3 starts at slice 2's tip; slice 1, the claim branch, at the plan's baseline
  gitRun(repo, 'switch', '-q', 'slice/T-1/3');
  expect(sliceLine((await run(['anchor'], repo)).out)).toBe(`Slice: 3 of 3, from ${short(two)}`);
  gitRun(repo, 'switch', '-q', 't/T-1');
  expect(sliceLine((await run(['anchor'], repo)).out)).toBe(`Slice: 1 of 3, from ${short(base)}`);
}, 120_000);

it("risk:regression the slice start is read from origin's copy of the previous slice's branch when no local one exists, and is left out when git cannot say (D-10)", async () => {
  const { repo, two } = sandbox();
  // as in CI, where only the remote refs exist: slice 2's tip is origin's, the local branch is gone
  gitRun(repo, 'update-ref', 'refs/remotes/origin/slice/T-1/2', two);
  gitRun(repo, 'switch', '-q', 'slice/T-1/3');
  gitRun(repo, 'branch', '-D', 'slice/T-1/2');
  expect(sliceLine((await run(['anchor'], repo)).out)).toBe(`Slice: 3 of 3, from ${short(two)}`);
  // neither copy: the line still says which slice, with no start
  gitRun(repo, 'update-ref', '-d', 'refs/remotes/origin/slice/T-1/2');
  expect(sliceLine((await run(['anchor'], repo)).out)).toBe('Slice: 3 of 3');
}, 120_000);

it('risk:regression a ticket whose plan has no slices prints no Slice line, on its claim branch or any other (D-10)', async () => {
  const { repo } = sandbox({ slices: '' });
  expect(sliceLine((await run(['anchor'], repo)).out)).toBeUndefined();
  gitRun(repo, 'switch', '-q', 't/T-1');
  const claim = await run(['anchor'], repo);
  expect(claim.code, claim.out + claim.err).toBe(0);
  expect(claim.out).toContain('Stage:');
  expect(claim.out).not.toContain('Slice:');
}, 120_000);

it("risk:regression review-package with no --base before round 1 reads slice 2's diff from slice 1's tip, so it does not hold slice 1's files (D-10)", async () => {
  const { repo, one } = sandbox();
  const r = await run(['review-package', 'T-1'], repo);
  expect(r.code, r.out + r.err).toBe(0);
  expect(r.out.split('\n')[0]).toBe(`# Review package: T-1 (${one}...HEAD)`);
  expect(r.out).toContain('src/two.ts');
  expect(r.out).not.toContain('src/one.ts');
}, 120_000);

it('risk:regression an explicit --base wins over the slice start, and a recorded round wins over both (D-10)', async () => {
  const { repo, base } = sandbox();
  const given = await run(['review-package', 'T-1', '--base', base], repo);
  expect(given.code, given.out + given.err).toBe(0);
  expect(given.out.split('\n')[0]).toBe(`# Review package: T-1 (${base}...HEAD)`);
  expect(given.out).toContain('src/one.ts');

  // round 1 was reviewed at the fixture commit: the package of the next round reads from that head, not from slice 1's tip
  const review = `Round record: 2\n\n## Round 1 head ${base}\n\nNo findings\n\nSecurity: no pattern matched\n\nverdict: converged\n`;
  writeFiles(repo, { 'accord/tickets/T-1/review.md': review });
  expect(readFileSync(join(repo, 'accord', 'tickets', 'T-1', 'review.md'), 'utf8')).toBe(review);
  commitMsg(repo, 'review: round 1');
  const next = await run(['review-package', 'T-1'], repo);
  expect(next.code, next.out + next.err).toBe(0);
  expect(next.out.split('\n')[0]).toBe(`# Review package: T-1 (${base}...HEAD)`);
  expect(next.out).toContain('src/one.ts');
}, 120_000);

it('risk:regression on the claim branch and for an unsliced ticket review-package keeps the plan baseline as its base (D-10)', async () => {
  const { repo, base } = sandbox();
  gitRun(repo, 'switch', '-q', 't/T-1');
  const claim = await run(['review-package', 'T-1'], repo);
  expect(claim.code, claim.out + claim.err).toBe(0);
  expect(claim.out.split('\n')[0]).toBe(`# Review package: T-1 (${base}...HEAD)`);
  expect(claim.out).toContain('src/one.ts');
}, 120_000);
