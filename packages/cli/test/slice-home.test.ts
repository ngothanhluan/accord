// Phase 08.9.3 D-08, D-11, D-14: one function, `sliceHome`, says where a slice of a ticket lives, and every read-only slice reader asks it: the claim branch holds the first slice of this repository,
// a slice of another repository is `slice/<id>/<n>` in that repository's clone, and the slice order is the deploy order. Pure cases over core, then real git in two sibling clones (helpers/repos.ts).
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { firstMainSlice, REPOS_FROM, setFrontmatterKey, sliceBranchName, sliceHome, sliceInWork } from '@accord-dev/accord-core';
import { claimedUnder, commitAll, run, writeFiles } from './helpers/repo.js';
import { reposCopy, useRepoSandboxes, type Repos } from './helpers/repos.js';

useRepoSandboxes();

const CLAIM = 't/ST-9';
const MIXED = [{ n: 1, repo: 'tools' }, { n: 2 }, { n: 3 }, { n: 4, repo: 'tools' }];
const HERE = [{ n: 1 }, { n: 2 }, { n: 3 }];
const home = (slices: { n: number; repo?: string }[], n: number) => sliceHome(slices, n, { id: 'ST-9', claim: CLAIM });

it('risk:complex-branching sliceHome puts the first slice of this repository on the claim branch and every other slice on slice/<id>/<n> (D-14)', () => {
  expect(firstMainSlice(MIXED)).toBe(2);
  expect(firstMainSlice([{ n: 1, repo: 'tools' }])).toBeUndefined();
  expect(home(MIXED, 1)).toEqual({ n: 1, repo: 'tools', branch: 'slice/ST-9/1', claim: false });
  expect(home(MIXED, 2)).toEqual({ n: 2, branch: CLAIM, claim: true });
  expect(home(MIXED, 3)).toEqual({ n: 3, branch: 'slice/ST-9/3', claim: false, previous: { n: 2, branch: CLAIM } });
  expect(home(MIXED, 4)).toEqual({ n: 4, repo: 'tools', branch: 'slice/ST-9/4', claim: false, previous: { n: 1, repo: 'tools', branch: 'slice/ST-9/1' } });
  // no such slice, and an id that could not name a branch, have no home
  expect(home(MIXED, 5)).toBeUndefined();
  expect(sliceHome(MIXED, 3, { id: '-x', claim: CLAIM })).toBeUndefined();
});

it('risk:regression a plan with no repo: line gives the Phase 15 answers: slice 1 is the claim branch, slice n stacks on n-1 (D-14)', () => {
  expect(firstMainSlice(HERE)).toBe(1);
  expect(home(HERE, 1)).toEqual({ n: 1, branch: CLAIM, claim: true });
  expect(home(HERE, 2)).toEqual({ n: 2, branch: 'slice/ST-9/2', claim: false, previous: { n: 1, branch: CLAIM } });
  expect(home(HERE, 3)).toEqual({ n: 3, branch: 'slice/ST-9/3', claim: false, previous: { n: 2, branch: 'slice/ST-9/2' } });
});

it('risk:parsing sliceBranchName names only a safe id and a slice number from 1 to 99 (D-14)', () => {
  expect(sliceBranchName('ST-9', 1)).toBe('slice/ST-9/1');
  expect(sliceBranchName('ST-9', 99)).toBe('slice/ST-9/99');
  for (const n of [0, 100, -1, 1.5, Number.NaN]) expect(sliceBranchName('ST-9', n)).toBeUndefined();
  for (const id of ['-x', '', 'a b', '../x']) expect(sliceBranchName(id, 2)).toBeUndefined();
});

it('risk:complex-branching sliceInWork is the lowest slice worked from this branch whose criteria are not all verified (D-08, Ruling R11)', () => {
  const plan = [{ n: 1, repo: 'tools', covers: ['@ac-1'] }, { n: 2, covers: ['@ac-2'] }];
  expect(sliceInWork(plan, 2, [])).toBe(1);
  expect(sliceInWork(plan, 2, ['ac-1'])).toBe(2);
  expect(sliceInWork(plan, 2, ['ac-1', 'ac-2'])).toBe(2);
  // a tools slice between this repository's slices is worked from the first of them, not from a later one
  const mixed = [{ n: 1, covers: ['@ac-1'] }, { n: 2, repo: 'tools', covers: ['@ac-2'] }, { n: 3, covers: ['@ac-3'] }];
  expect(sliceInWork(mixed, 1, ['ac-1'])).toBe(2);
  expect(sliceInWork(mixed, 1, [])).toBe(1);
  expect(sliceInWork(mixed, 3, [])).toBe(3);
  // a plan with no repo: line is the slice the branch is on
  expect(sliceInWork([{ n: 1, covers: ['@ac-1'] }, { n: 2, covers: ['@ac-2'] }], 2, [])).toBe(2);
});

const task = (n: number, files: string): string => `## Task ${n}: Step ${n}\ncovers: @ac-${n}\nfiles: ${files}\nverify: export#step-${n} (@ac-${n})\nafter: none\nDo step ${n}.\n`;
const slice = (n: number, tasks: string, repo?: string): string => `## Slice ${n}: Part ${n}\n${repo === undefined ? '' : `repo: ${repo}\n`}tasks: ${tasks}\ncovers: @ac-${n}\n`;

/** ST-9 claimed at REPOS_FROM on t/ST-9 of the svc clone, its plan of slice 1 in tools and slice 2 here committed. `base` is the plan's baseline, `toolsSha` the tools baseline. */
async function planned(r: Repos): Promise<{ base: string; toolsSha: string }> {
  r.git(r.svc, 'switch', '-q', '-c', CLAIM);
  claimedUnder(r.svc, REPOS_FROM, 'ST-9');
  expect((await run(['approve', 'ST-9'], r.svc)).code).toBe(0);
  writeFiles(r.svc, { 'src/svc.ts': 'export const svc = 1;\n' });
  const base = commitAll(r.svc);
  const toolsSha = r.git(r.tools, 'rev-parse', 'refs/remotes/origin/main').trim();
  const text = ['---', `baseline: ${base}`, `baseline_tools: ${toolsSha}`, '---', '', '# Plan', '', task(1, 'tools:src/Tools.cs'), task(2, 'src/svc.ts'), slice(1, '1', 'tools'), slice(2, '2')].join('\n');
  writeFiles(r.svc, { 'accord/tickets/ST-9/plan.md': text });
  commitAll(r.svc);
  return { base, toolsSha };
}

const sliceLine = (out: string): string | undefined => out.split('\n').find((l) => l.startsWith('Slice: '));

it('risk:complex-branching on the claim branch of a plan whose slice 1 is in tools, accord anchor names slice 1 in tools until its criteria are verified, then slice 2 here (D-08, D-14)', async () => {
  const r = reposCopy();
  const { base, toolsSha } = await planned(r);
  const first = await run(['anchor'], r.svc);
  expect(first.code, first.out + first.err).toBe(0);
  expect(sliceLine(first.out)).toBe(`Slice: 1 of 2 in repository tools, from ${toolsSha.slice(0, 7)}`);
  // the slice in work comes from the ticks alone: no state was written for it
  const file = join(r.svc, 'accord', 'tickets', 'ST-9.md');
  writeFiles(r.svc, { 'accord/tickets/ST-9.md': setFrontmatterKey(readFileSync(file, 'utf8'), 'verified', ['ac-1']) });
  commitAll(r.svc);
  const second = await run(['anchor'], r.svc);
  expect(second.code, second.out + second.err).toBe(0);
  expect(sliceLine(second.out)).toBe(`Slice: 2 of 2, from ${base.slice(0, 7)}`);
}, 120_000);

it('risk:complex-branching gate done --slice auto on the claim branch judges the first slice of this repository, so CI gates its pull request as that slice (D-14)', async () => {
  const r = reposCopy();
  await planned(r);
  const res = await run(['gate', 'done', 'ST-9', '--slice', 'auto'], r.svc);
  expect(res.out + res.err).toContain('slice 2 of 2:');
  expect(res.out).not.toContain('slice 1 of 2:');
}, 120_000);
