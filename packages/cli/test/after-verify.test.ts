// ST-LN-26 @ac-3: the CLI reads the commits after verify from git for the ticket on its branch and for claimed tickets.
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { setFrontmatterKey } from '@accord-dev/accord-core';
import { afterAll, beforeAll, expect, it } from 'vitest';
import type { Files } from '../../../test/helpers/lane.js';
import { approve, CONFIG, gateReadyIn, laneTicket, P, PLAN } from '../../../test/helpers/lane.js';
import { loadFromFs } from '../src/load/fs.js';
import { commitAllAt, commitMsg, gitRun, run, writeFiles } from './helpers/repo.js';
import type { Clone } from './helpers/worktree.js';
import { copyClone, makeTemplate } from './helpers/worktree.js';

const TICKET = 'accord/tickets/ST-9.md';

function commit(dir: string, msg: string): string {
  return commitMsg(dir, msg);
}

function setKey(dir: string, key: string, value: string | string[]): void {
  const file = join(dir, ...TICKET.split('/'));
  writeFileSync(file, setFrontmatterKey(readFileSync(file, 'utf8'), key, value));
}

const VERIFICATION = (sha: string) =>
  ['---', 'ticket: "ST-9"', `commit: "${sha}"`, 'reviewed_on: "2026-10-12"', '---', '', '## @ac-1 x', '', 'Result: pass', '', 'Evidence: x', ''].join('\n');

/** The ticket on its branch with a work commit and the tick that records it. */
function tip(c: Clone): { C: string; T: string } {
  c.git('switch', '-c', 't/ST-9');
  writeFiles(c.root, { 'src/a.ts': 'a\n' });
  const C = commit(c.root, 'work');
  setKey(c.root, 'verified_commit', C);
  const T = commit(c.root, 'tick');
  return { C, T };
}

function fix(c: Clone): string {
  writeFiles(c.root, { 'src/fix.ts': 'f\n' });
  commitAllAt(c.root, new Date('2001-01-01T00:00:00Z'), 'fix');
  return c.git('rev-parse', 'HEAD').trim();
}

/** A commit on main made in the other clone, then fetched and merged into the ticket branch. */
function mergeMain(c: Clone, o: string): { Mn: string; M: string } {
  writeFiles(o, { 'src/main.ts': 'm\n' });
  const Mn = commit(o, 'main work');
  gitRun(o, 'push', '-q', 'origin', 'main');
  c.git('fetch', '-q', 'origin');
  c.git('merge', '-q', '--no-edit', 'origin/main');
  return { Mn, M: c.git('rev-parse', 'HEAD').trim() };
}

/** The core form of `accord approve` and `accord gate ready` on the clone's ticket: writes both hashes. */
function readied(root: string): string {
  const f: Files = { 'accord/config.yml': CONFIG, [P('ST-9')]: laneTicket('ST-9') };
  approve(f, 'ST-9');
  const verdict = gateReadyIn(f, 'ST-9');
  writeFiles(root, { [P('ST-9')]: f[P('ST-9')] });
  return verdict;
}

const rowOf = (c: Clone) => async () => {
  const rows = JSON.parse((await run(['status', '--json'], c.root)).out) as { id: string; stage: string }[];
  return rows.find((r) => r.id === 'ST-9')?.stage;
};

let tpl: Clone;
let other: string;
let doneTpl: Clone;
let verdict: string;
let doneT: string;

beforeAll(() => {
  tpl = makeTemplate();
  other = tpl.otherClone();
  gitRun(other, 'config', 'gc.auto', '0');

  // The pushed done state of the claimed ticket (#20): hashes from core, then the plan, ledger, review, work and tick commits.
  doneTpl = makeTemplate();
  doneTpl.git('switch', '-c', 't/ST-9');
  verdict = readied(doneTpl.root);
  writeFiles(doneTpl.root, {
    'accord/tickets/ST-9/plan.md': PLAN,
    'accord/tickets/ST-9/ledger.md': '## Tasks\n- task 1 done abc1234\n- task 2 done abc1234\n',
    'accord/tickets/ST-9/review.md': '## Round 1\nverdict: converged\n',
    'src/a.ts': 'a\n',
  });
  const C = commit(doneTpl.root, 'work');
  const hash = /^ac_hash: "(.+)"$/m.exec(readFileSync(join(doneTpl.root, ...TICKET.split('/')), 'utf8'))?.[1] as string;
  setKey(doneTpl.root, 'verified', ['ac-1', 'ac-2']);
  setKey(doneTpl.root, 'verified_hash', hash);
  setKey(doneTpl.root, 'verified_commit', C);
  doneT = commit(doneTpl.root, 'tick');
  doneTpl.git('push', '-q', '-u', 'origin', 't/ST-9');
}, 60_000);

afterAll(() => {
  tpl.cleanupAll();
  doneTpl.cleanupAll();
});

it('risk:complex-branching the commits after verify come from the ticket tip in graph order', () => {
  const c = copyClone(tpl);
  try {
    const { C, T } = tip(c);
    let state = loadFromFs(c.root).afterVerify?.['ST-9'];
    const fact = () => state;
    expect(fact()).toEqual([{ sha: T, parents: [C], files: ['accord/tickets/ST-9.md'] }]);

    const F = fix(c);
    state = loadFromFs(c.root).afterVerify?.['ST-9'];
    expect(fact()?.map((x) => x.sha)).toEqual([T, F]);
    expect(fact()?.at(-1)?.files).toEqual(['src/fix.ts']);
  } finally {
    c.cleanupAll();
  }
}, 120_000);

it('risk:complex-branching a merge from origin main after verify is a commit after verify with no files', () => {
  const c = copyClone(tpl, [other]);
  try {
    const { T } = tip(c);
    const F = fix(c);
    const { Mn, M } = mergeMain(c, c.others[0]);
    const state = loadFromFs(c.root).afterVerify?.['ST-9'];
    const fact = () => state;
    expect(fact()?.map((x) => x.sha)).toEqual([T, F, M]);
    expect(fact()?.at(-1)).toEqual({ sha: M, parents: [F, Mn], files: [] });
  } finally {
    c.cleanupAll();
  }
}, 120_000);

it('risk:complex-branching a side branch merged after verify comes before its merge', () => {
  const c = copyClone(tpl, [other]);
  try {
    const { C, T } = tip(c);
    const F = fix(c);
    const { M } = mergeMain(c, c.others[0]);
    c.git('switch', '-c', 'side', C);
    writeFiles(c.root, { 'src/side.ts': 's\n' });
    const S = commit(c.root, 'side');
    c.git('switch', 't/ST-9');
    c.git('merge', '-q', '--no-edit', 'side');
    const M2 = c.git('rev-parse', 'HEAD').trim();
    const state = loadFromFs(c.root).afterVerify?.['ST-9'];
    const fact = () => state;
    const shas = fact()?.map((x) => x.sha) ?? [];
    expect(new Set(shas)).toEqual(new Set([T, F, M, S, M2]));
    expect(shas.indexOf(S)).toBeLessThan(shas.indexOf(M2));
  } finally {
    c.cleanupAll();
  }
}, 120_000);

it('risk:complex-branching a ticket tip on the default branch has no commits after verify', () => {
  const c = copyClone(tpl);
  try {
    tip(c);
    c.git('push', '-q', 'origin', 't/ST-9:main');
    c.git('fetch', '-q', 'origin');
    expect(loadFromFs(c.root).afterVerify).toBeUndefined();
  } finally {
    c.cleanupAll();
  }
}, 120_000);

it('risk:complex-branching an unknown verified commit gives no commits after verify', () => {
  const d = copyClone(tpl);
  try {
    d.git('switch', '-c', 't/ST-9');
    setKey(d.root, 'verified_commit', 'deadbee' + '0'.repeat(33));
    commit(d.root, 'tick');
    expect(loadFromFs(d.root).afterVerify?.['ST-9']).toBeUndefined();
  } finally {
    d.cleanupAll();
  }
}, 120_000);

it('risk:complex-branching with no origin the local main is the default branch and a renamed main is not', () => {
  const e = copyClone(tpl);
  try {
    e.git('remote', 'remove', 'origin');
    e.git('switch', '-c', 't/ST-9');
    writeFiles(e.root, { 'src/a.ts': 'a\n' });
    const C = commit(e.root, 'work');
    setKey(e.root, 'verified_commit', C);
    const T = commit(e.root, 'tick');
    e.git('switch', 'main');
    writeFiles(e.root, { 'src/m.ts': 'm\n' });
    const Mn = commit(e.root, 'main work');
    e.git('switch', 't/ST-9');
    e.git('merge', '-q', '--no-edit', 'main');
    const M = e.git('rev-parse', 'HEAD').trim();
    let state = loadFromFs(e.root).afterVerify?.['ST-9'];
    const fact = () => state;
    expect(fact()?.map((x) => x.sha)).toEqual([T, M]);
    expect(fact()?.at(-1)?.files).toEqual([]);
    e.git('branch', '-m', 'main', 'trunk');
    state = loadFromFs(e.root).afterVerify?.['ST-9'];
    expect(fact()?.map((x) => x.sha)).toContain(Mn);
    expect(fact()?.find((x) => x.sha === M)).not.toHaveProperty('files');
  } finally {
    e.cleanupAll();
  }
}, 120_000);

it('risk:complex-branching a verification.md commit is the start when the ticket has no verified commit', () => {
  const f = copyClone(tpl);
  try {
    f.git('switch', '-c', 't/ST-9');
    writeFiles(f.root, { 'src/a.ts': 'a\n' });
    const C = commit(f.root, 'work');
    writeFiles(f.root, { 'accord/tickets/ST-9/verification.md': VERIFICATION(C) });
    writeFiles(f.root, { 'src/fix.ts': 'f\n' });
    gitRun(f.root, 'add', 'src/fix.ts');
    gitRun(f.root, 'commit', '-q', '-m', 'fix');
    const F = gitRun(f.root, 'rev-parse', 'HEAD').trim();
    expect(loadFromFs(f.root).afterVerify?.['ST-9']).toEqual([{ sha: F, parents: [C], files: ['src/fix.ts'] }]);
  } finally {
    f.cleanupAll();
  }
}, 120_000);

it('risk:complex-branching status shows a claimed ticket done, then review once its branch holds a fix', async () => {
  const c = copyClone(doneTpl);
  try {
    expect(verdict).toBe('pass');
    expect(readFileSync(join(c.root, ...TICKET.split('/')), 'utf8')).toMatch(/\napproved_hash: "fnv1a64:[0-9a-f]{16}"\n/);
    const row = rowOf(c);
    c.git('switch', 'main');
    expect(await row()).toBe('done');

    c.git('switch', 't/ST-9');
    writeFiles(c.root, { 'src/fix.ts': 'f\n' });
    commit(c.root, 'fix');
    c.git('switch', 'main');
    expect(await row()).toBe('review');
  } finally {
    c.cleanupAll();
  }
}, 120_000);

it('risk:complex-branching anchor on the branch shows review with the review base after a pushed fix, and status agrees', async () => {
  const c = copyClone(doneTpl);
  try {
    const T = doneT;
    const row = rowOf(c);
    writeFiles(c.root, { 'src/fix.ts': 'f\n' });
    commit(c.root, 'fix');
    c.git('push', '-q');
    const anchor = await run(['anchor'], c.root);
    expect(anchor.out).toContain('Stage: review');
    expect(anchor.out).toContain(`Review base: ${T}`);
    c.git('switch', 'main');
    expect(await row()).toBe('review');
  } finally {
    c.cleanupAll();
  }
}, 120_000);

it('risk:complex-branching anchor named from main shows review after the tick is merged', async () => {
  const c = copyClone(doneTpl);
  try {
    const T = doneT;
    writeFiles(c.root, { 'src/fix.ts': 'f\n' });
    commit(c.root, 'fix');
    c.git('push', '-q');
    c.git('switch', 'main');
    c.git('merge', '-q', '--ff-only', T);
    const named = await run(['anchor', 'ST-9'], c.root);
    expect(named.code).toBe(0);
    expect(named.out).toContain('Stage: review');
    expect(named.out).toContain(`Review base: ${T}`);
  } finally {
    c.cleanupAll();
  }
}, 120_000);

it('risk:complex-branching a new review round after the fix takes the ticket to verify', async () => {
  const c = copyClone(doneTpl);
  try {
    const row = rowOf(c);
    writeFiles(c.root, { 'src/fix.ts': 'f\n' });
    commit(c.root, 'fix');
    writeFiles(c.root, { 'accord/tickets/ST-9/review.md': '## Round 1\nverdict: converged\n\n## Round 2\n\nNo findings\n\nverdict: converged\n' });
    commit(c.root, 'review');
    c.git('push', '-q');
    c.git('switch', 'main');
    expect(await row()).toBe('verify');
  } finally {
    c.cleanupAll();
  }
}, 120_000);

it('risk:complex-branching review-package leaves out what a merge from the default branch brought in', async () => {
  const c = copyClone(tpl, [other]);
  try {
    const B0 = c.git('rev-parse', 'HEAD').trim();
    c.git('switch', '-c', 't/ST-9');
    writeFiles(c.root, { 'src/a.ts': 'a\n' });
    commit(c.root, 'fix one');
    const before = await run(['review-package', 'ST-9', '--base', B0], c.root);
    expect(before.code).toBe(0);
    expect(before.out.startsWith(`# Review package: ST-9 (${B0}...HEAD)`)).toBe(true);

    const o = c.others[0];
    writeFiles(o, { 'src/main.ts': 'm\n' });
    commit(o, 'main work');
    gitRun(o, 'push', '-q', 'origin', 'main');
    c.git('fetch', '-q', 'origin');
    c.git('merge', '-q', '--no-edit', 'origin/main');
    writeFiles(c.root, { 'src/b.ts': 'b\n' });
    commit(c.root, 'fix two');
    const after = await run(['review-package', 'ST-9', '--base', B0], c.root);
    expect(after.code).toBe(0);
    expect(after.out).toContain('without origin/main');
    expect(after.out).toContain('fix one');
    expect(after.out).toContain('fix two');
    expect(after.out).not.toContain('main work');
    const diff = after.out.slice(after.out.indexOf('## Diff'));
    expect(diff).toContain('src/a.ts');
    expect(diff).toContain('src/b.ts');
    expect(diff).not.toContain('src/main.ts');
    const stat = after.out.slice(after.out.indexOf('## Stat'), after.out.indexOf('## Undeclared files'));
    expect(stat).not.toContain('src/main.ts');
  } finally {
    c.cleanupAll();
  }
}, 120_000);

it('risk:regression of a real bug: a fix made at verify, before any verification.md, gets a review round', async () => {
  const c = copyClone(tpl);
  try {
    c.git('switch', '-c', 't/ST-9');
    expect(readied(c.root)).toBe('pass');
    writeFiles(c.root, {
      'accord/tickets/ST-9/plan.md': PLAN,
      'accord/tickets/ST-9/ledger.md': '## Tasks\n- task 1 done abc1234\n- task 2 done abc1234\n',
      'accord/tickets/ST-9/review.md': '## Round 1\nverdict: converged\n',
      'src/a.ts': 'a\n',
    });
    const R = commit(c.root, 'work and review');
    const quiet = await run(['anchor'], c.root);
    expect(quiet.out).toContain('Stage: verify');
    expect(quiet.out).not.toContain('Review base:');

    writeFiles(c.root, { 'src/fix.ts': 'f\n' });
    commit(c.root, 'fix');
    const fixed = await run(['anchor'], c.root);
    expect(fixed.out).toContain('Stage: review');
    expect(fixed.out).toContain(`Review base: ${R}`);
  } finally {
    c.cleanupAll();
  }
}, 120_000);
