// Phase 08.9.3 D-08, D-11, D-14: one function, `sliceHome`, says where a slice of a ticket lives, and every read-only slice reader asks it: the claim branch holds the first slice of this repository,
// a slice of another repository is `slice/<id>/<n>` in that repository's clone, and the slice order is the deploy order. Pure cases over core, then real git in two sibling clones (helpers/repos.ts).
import { existsSync, mkdtempSync, readFileSync, renameSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, expect, it } from 'vitest';
import { firstMainSlice, loadSnapshot, REPOS_FROM, setFrontmatterKey, sliceBranchName, sliceHome, sliceInWork } from '@accord-dev/accord-core';
import { claimedUnder, cleanup, commitAll, run, writeFiles } from './helpers/repo.js';
import { defaultRefOf, loadFromFs } from '../src/load/fs.js';
import { gitSliceSize, sliceRange, sliceStart } from '../src/load/slice-size.js';
import { dropSlices, readSlices, recordSlice, sliceBranch, sliceOfBranch } from '../src/load/slices.js';
import { reposCopy, useRepoSandboxes, type Repos } from './helpers/repos.js';

useRepoSandboxes();

const away: string[] = [];
afterEach(() => {
  for (const d of away.splice(0)) cleanup(d);
});

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
async function planned(r: Repos, o: { third?: boolean } = {}): Promise<{ base: string; toolsSha: string }> {
  r.git(r.svc, 'switch', '-q', '-c', CLAIM);
  claimedUnder(r.svc, REPOS_FROM, 'ST-9');
  expect((await run(['approve', 'ST-9'], r.svc)).code).toBe(0);
  writeFiles(r.svc, { 'src/svc.ts': 'export const svc = 1;\n' });
  const base = commitAll(r.svc);
  const toolsSha = r.git(r.tools, 'rev-parse', 'refs/remotes/origin/main').trim();
  const text = ['---', `baseline: ${base}`, `baseline_tools: ${toolsSha}`, '---', '', '# Plan', '', task(1, 'tools:src/Tools.cs'), task(2, 'src/svc.ts'), ...(o.third === true ? [task(3, 'src/svc.ts')] : []), slice(1, '1', 'tools'), slice(2, '2'), ...(o.third === true ? [slice(3, '3')] : [])].join('\n');
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

const snapshotOf = (r: Repos) => loadSnapshot(loadFromFs(r.svc));

it('risk:parsing slice/<id>/1 names a slice, sliceBranch builds it, and a name that could not be a slice branch throws (D-14)', () => {
  expect(sliceOfBranch('slice/ST-9/1')).toEqual({ id: 'ST-9', n: 1 });
  expect(sliceOfBranch('slice/ST-9/99')).toEqual({ id: 'ST-9', n: 99 });
  for (const name of ['slice/ST-9/0', 'slice/ST-9/100', 'slice/ST-9/01', 'slice/ST-9', 't/ST-9']) expect(sliceOfBranch(name)).toBeUndefined();
  expect(sliceBranch('ST-9', 1)).toBe('slice/ST-9/1');
  expect(() => sliceBranch('-x', 2)).toThrow();
  expect(() => sliceBranch('ST-9', 100)).toThrow();
  expect(() => sliceBranch('ST-9', 0)).toThrow();
});

it('risk:regression the slice record takes an optional repository column, reads a Phase 15 line as before, and keeps a line it did not drop (D-14)', () => {
  const r = reposCopy();
  const sha = r.git(r.svc, 'rev-parse', 'HEAD').trim();
  const file = join(r.svc, '.git', 'accord', 'slices');
  recordSlice(r.svc, 'ST-9', 1, sha, 'tools');
  recordSlice(r.svc, 'ST-9', 3, sha);
  expect(readFileSync(file, 'utf8')).toBe(`ST-9 1 ${sha} tools\nST-9 3 ${sha}\n`);
  expect(readSlices(r.svc)).toEqual([{ id: 'ST-9', n: 1, start: sha, repo: 'tools' }, { id: 'ST-9', n: 3, start: sha }]);
  // the same id and number is not written twice
  recordSlice(r.svc, 'ST-9', 1, sha, 'tools');
  expect(readFileSync(file, 'utf8').split('\n').filter((l) => l !== '')).toHaveLength(2);
  // a name that is no repository is refused, and nothing is written for it
  expect(() => recordSlice(r.svc, 'ST-9', 2, sha, 'Tools')).toThrow();
  dropSlices(r.svc, 'ST-9', 1);
  expect(readFileSync(file, 'utf8')).toBe(`ST-9 3 ${sha}\n`);
});

/** The tools clone with slice/ST-9/1 cut at its baseline and two commits on it: 3 lines of code, then 2 lines of test. Returns the baseline. */
function toolsSlice(r: Repos): string {
  const baseline = r.git(r.tools, 'rev-parse', 'refs/remotes/origin/main').trim();
  r.git(r.tools, 'switch', '-q', '-c', 'slice/ST-9/1');
  writeFiles(r.tools, { 'src/Added.cs': 'a\nb\nc\n' });
  commitAll(r.tools, 'slice one, first');
  writeFiles(r.tools, { 'tests/AddedTests.cs': 'x\ny\n' });
  commitAll(r.tools, 'slice one, second');
  return baseline;
}

it('risk:complex-branching the start, range and size of a slice of tools are read in the tools clone against its baseline (D-14, D-11)', async () => {
  const r = reposCopy();
  const { toolsSha } = await planned(r);
  expect(toolsSlice(r)).toBe(toolsSha);
  const snap = snapshotOf(r);
  expect(sliceStart(r.svc, snap, 'ST-9', 1)).toBe(toolsSha);
  expect(sliceRange(r.svc, snap, 'ST-9', 1)).toEqual({ base: defaultRefOf(r.tools), tip: 'refs/heads/slice/ST-9/1' });
  // the two commits' lines, counted in tools; nothing of the svc clone enters
  expect(gitSliceSize(r.svc, snap, 'ST-9', 1, () => [])).toEqual({ n: 1, code: 3, test: 2, docs: 0, total: 5 });
}, 120_000);

it('risk:complex-branching a later slice of this repository starts at the merge base with the claim branch, and the first one at the plan baseline (D-14)', async () => {
  const r = reposCopy();
  const { base } = await planned(r, { third: true });
  const claimTip = r.git(r.svc, 'rev-parse', 'HEAD').trim();
  const snap = snapshotOf(r);
  expect(sliceStart(r.svc, snap, 'ST-9', 2)).toBe(base);
  r.git(r.svc, 'switch', '-q', '-c', 'slice/ST-9/3');
  writeFiles(r.svc, { 'src/three.ts': 'export const three = 3;\n' });
  commitAll(r.svc, 'slice three');
  expect(sliceStart(r.svc, snap, 'ST-9', 3)).toBe(claimTip);
  // slice 3 is measured on its own branch over the claim branch, in this repository
  expect(sliceRange(r.svc, snap, 'ST-9', 3)).toEqual({ base: 'refs/heads/t/ST-9', tip: 'refs/heads/slice/ST-9/3' });
  expect(gitSliceSize(r.svc, snap, 'ST-9', 3, () => [])).toEqual({ n: 3, code: 1, test: 0, docs: 0, total: 1 });
}, 120_000);

it('risk:complex-branching with no tools clone on this machine, the start and the size of a tools slice are undefined, not guessed (D-02, D-14)', async () => {
  const r = reposCopy();
  await planned(r);
  const elsewhere = mkdtempSync(join(tmpdir(), 'accord-repos-gone-'));
  away.push(elsewhere);
  renameSync(r.tools, join(elsewhere, 'tools'));
  expect(existsSync(r.tools)).toBe(false);
  const snap = snapshotOf(r);
  expect(sliceStart(r.svc, snap, 'ST-9', 1)).toBeUndefined();
  expect(sliceRange(r.svc, snap, 'ST-9', 1)).toBeUndefined();
  expect(gitSliceSize(r.svc, snap, 'ST-9', 1, () => [])).toBeUndefined();
  // the anchor still says which slice, with no start
  const res = await run(['anchor'], r.svc);
  expect(res.code, res.out + res.err).toBe(0);
  expect(sliceLine(res.out)).toBe('Slice: 1 of 2 in repository tools');
}, 120_000);

it('risk:regression a plan with no repo: line has the Phase 15 start for slices 1, 2 and 3: the baseline, then merge bases with the branch before (D-14)', async () => {
  const r = reposCopy();
  r.git(r.svc, 'switch', '-q', '-c', CLAIM);
  claimedUnder(r.svc, REPOS_FROM, 'ST-9');
  expect((await run(['approve', 'ST-9'], r.svc)).code).toBe(0);
  writeFiles(r.svc, { 'src/svc.ts': 'export const svc = 1;\n' });
  const base = commitAll(r.svc);
  const plain = ['---', `baseline: ${base}`, '---', '', '# Plan', '', task(1, 'src/svc.ts'), task(2, 'src/svc.ts'), task(3, 'src/svc.ts'), slice(1, '1'), slice(2, '2'), slice(3, '3')].join('\n');
  writeFiles(r.svc, { 'accord/tickets/ST-9/plan.md': plain });
  const claimTip = commitAll(r.svc);
  r.git(r.svc, 'switch', '-q', '-c', 'slice/ST-9/2');
  writeFiles(r.svc, { 'src/two.ts': 'two\n' });
  const twoTip = commitAll(r.svc, 'two');
  r.git(r.svc, 'switch', '-q', '-c', 'slice/ST-9/3');
  writeFiles(r.svc, { 'src/three.ts': 'three\n' });
  commitAll(r.svc, 'three');
  const snap = snapshotOf(r);
  expect(sliceStart(r.svc, snap, 'ST-9', 1)).toBe(base);
  expect(sliceStart(r.svc, snap, 'ST-9', 2)).toBe(claimTip);
  expect(sliceStart(r.svc, snap, 'ST-9', 3)).toBe(twoTip);
}, 120_000);

/** ST-9 on t/ST-9 of the svc clone with tasks 1 and 3 here and task 2 in tools: slice 1 here, slice 2 in tools, slice 3 here. The claim branch holds slice 1; the checkout is left on it. */
async function plannedMid(r: Repos): Promise<void> {
  r.git(r.svc, 'switch', '-q', '-c', CLAIM);
  claimedUnder(r.svc, REPOS_FROM, 'ST-9');
  expect((await run(['approve', 'ST-9'], r.svc)).code).toBe(0);
  writeFiles(r.svc, { 'src/svc.ts': 'export const svc = 1;\n' });
  const base = commitAll(r.svc);
  const toolsSha = r.git(r.tools, 'rev-parse', 'refs/remotes/origin/main').trim();
  const text = ['---', `baseline: ${base}`, `baseline_tools: ${toolsSha}`, '---', '', '# Plan', '', task(1, 'src/svc.ts'), task(2, 'tools:src/Tools.cs'), task(3, 'src/svc.ts'), slice(1, '1'), slice(2, '2', 'tools'), slice(3, '3')].join('\n');
  writeFiles(r.svc, { 'accord/tickets/ST-9/plan.md': text });
  commitAll(r.svc);
}

const ledger = (...tasks: number[]): string => ['## Tasks', ...tasks.map((t) => `- task ${t} done abc1234`), ''].join('\n');
const judged = (out: string): string | undefined => out.split('\n').find((l) => l.startsWith('slice 1 of 3:'));

it('risk:complex-branching worktree sync on a later slice of this repository merges the previous slice of this repository, never a slice of tools (D-14)', async () => {
  const r = reposCopy();
  await plannedMid(r);
  // slice 3 is cut at the claim branch's tip; a review fix then lands on the claim branch (slice 1)
  r.git(r.svc, 'switch', '-q', '-c', 'slice/ST-9/3');
  writeFiles(r.svc, { 'src/three.ts': 'three\n' });
  commitAll(r.svc, 'slice three');
  r.git(r.svc, 'switch', '-q', CLAIM);
  writeFiles(r.svc, { 'src/fix.ts': 'fix\n' });
  const fix = commitAll(r.svc, 'review fix on slice one');
  r.git(r.svc, 'switch', '-q', 'slice/ST-9/3');
  const res = await run(['worktree', 'sync', 'ST-9'], r.svc);
  expect(res.code, res.out + res.err).toBe(0);
  expect(res.out).toContain(`merged: 1 commit of ${CLAIM} into slice/ST-9/3`);
  expect(res.out).not.toContain('tools');
  r.git(r.svc, 'merge-base', '--is-ancestor', fix, 'HEAD');
}, 120_000);

it('risk:complex-branching a slice below the last is judged alone while the ledger holds tasks of a later slice of tools; only a later slice of this repository widens it (D-14, Ruling R10)', async () => {
  const r = reposCopy();
  await plannedMid(r);
  // task 2 is slice 2's, built in tools: its ledger line is written on this branch while its code lives in the tools clone
  writeFiles(r.svc, { 'accord/tickets/ST-9/ledger.md': ledger(1, 2) });
  const alone = await run(['gate', 'done', 'ST-9', '--slice', '1'], r.svc);
  expect(judged(alone.out)).toBe('slice 1 of 3: 1 criteria judged');
  expect(alone.out).not.toContain('whole ticket');
  // task 3 is slice 3's, built here: this branch carries later work of this repository, so the whole ticket is judged
  writeFiles(r.svc, { 'accord/tickets/ST-9/ledger.md': ledger(1, 2, 3) });
  const widened = await run(['gate', 'done', 'ST-9', '--slice', '1'], r.svc);
  expect(judged(widened.out)).toMatch(/^slice 1 of 3: \d+ criteria judged \(the ledger records a task of a later slice, so the whole ticket is judged\)$/);
}, 120_000);

it('risk:regression a plan with no repo: line syncs from the slice before it and is widened by any later slice, as in Phase 15 (D-14, Ruling R10)', async () => {
  const r = reposCopy();
  r.git(r.svc, 'switch', '-q', '-c', CLAIM);
  claimedUnder(r.svc, REPOS_FROM, 'ST-9');
  expect((await run(['approve', 'ST-9'], r.svc)).code).toBe(0);
  writeFiles(r.svc, { 'src/svc.ts': 'export const svc = 1;\n' });
  const base = commitAll(r.svc);
  const plain = ['---', `baseline: ${base}`, '---', '', '# Plan', '', task(1, 'src/svc.ts'), task(2, 'src/svc.ts'), task(3, 'src/svc.ts'), slice(1, '1'), slice(2, '2'), slice(3, '3')].join('\n');
  writeFiles(r.svc, { 'accord/tickets/ST-9/plan.md': plain });
  commitAll(r.svc);
  r.git(r.svc, 'switch', '-q', '-c', 'slice/ST-9/2');
  writeFiles(r.svc, { 'src/two.ts': 'two\n' });
  commitAll(r.svc, 'slice two');
  r.git(r.svc, 'switch', '-q', '-c', 'slice/ST-9/3');
  writeFiles(r.svc, { 'src/three.ts': 'three\n' });
  commitAll(r.svc, 'slice three');
  r.git(r.svc, 'switch', '-q', 'slice/ST-9/2');
  writeFiles(r.svc, { 'src/fix2.ts': 'fix\n' });
  commitAll(r.svc, 'review fix on slice two');
  r.git(r.svc, 'switch', '-q', 'slice/ST-9/3');
  const res = await run(['worktree', 'sync', 'ST-9'], r.svc);
  expect(res.code, res.out + res.err).toBe(0);
  expect(res.out).toContain('merged: 1 commit of slice/ST-9/2 into slice/ST-9/3');
  // a ledger line of slice 2 widens slice 1, which is no slice of another repository
  r.git(r.svc, 'switch', '-q', CLAIM);
  writeFiles(r.svc, { 'accord/tickets/ST-9/ledger.md': ledger(1, 2) });
  const widened = await run(['gate', 'done', 'ST-9', '--slice', '1'], r.svc);
  expect(judged(widened.out)).toContain('the whole ticket is judged');
}, 120_000);
