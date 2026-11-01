// ST-LN-57 task 4: the round facts git gives the gate: each head bound or not, each round's range with commit kinds.
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { expect, it, vi } from 'vitest';
import { loadSnapshot } from '@accord-dev/accord-core';
import type { RoundFacts } from '@accord-dev/accord-core';
import { loadFromFs } from '../src/load/fs.js';
import { roundFactsFor } from '../src/load/round-facts.js';
import { nearestCode, readWalk } from '../src/load/walk.js';
import { cleanup, commitMsg, gitRun, makeEmptyRepo, mergeMsg, writeFiles } from './helpers/repo.js';
import { spawnLog } from './helpers/git-spawns.js';
import { CONFIG, laneTicket } from '../../../test/helpers/lane.js';

vi.mock('node:child_process', async (orig) => (await import('./helpers/git-spawns.js')).wrapChildProcess(await orig()));

const REVIEW = 'accord/tickets/T-1/review.md';
const DEBUG = 'accord/tickets/T-1/debug.md';
const config = CONFIG.replace(/^accord: .*$/m, 'accord: "0.3.0"');

const v2 = (heads: string[]): string =>
  'Round record: 2\n\n' + heads.map((h, i) => `## Round ${i + 1} head ${h}\n\nNo findings\n`).join('\n');

function start(): string {
  const repo = makeEmptyRepo();
  gitRun(repo, 'config', 'user.email', 'an@example.com');
  gitRun(repo, 'config', 'user.name', 'an');
  gitRun(repo, 'config', 'commit.gpgsign', 'false');
  writeFiles(repo, { 'accord/config.yml': config, 'accord/tickets/T-1.md': laneTicket('T-1') });
  commitMsg(repo, 'base');
  gitRun(repo, 'branch', '-M', 'main');
  return repo;
}

/** The facts of T-1, with git counting and failing on only while the facts are read. */
function factsOf(repo: string, fail?: (args: string[]) => boolean): RoundFacts | undefined {
  const snapshot = loadSnapshot(loadFromFs(repo));
  spawnLog.calls = [];
  spawnLog.fail = fail;
  spawnLog.on = fail !== undefined;
  try {
    return roundFactsFor(repo, snapshot, 'T-1');
  } finally {
    spawnLog.on = false;
    spawnLog.fail = undefined;
  }
}

function ok(facts: RoundFacts | undefined): Exclude<RoundFacts, { error: string }> {
  if (facts === undefined || 'error' in facts) throw new Error('facts: ' + JSON.stringify(facts));
  return facts;
}

it('risk:complex-branching each round range runs from its head to the next and tells merges and episode commits from fixes', () => {
  const repo = start();
  try {
    gitRun(repo, 'switch', '-q', '-c', 't/T-1');
    writeFiles(repo, { 'src/a.ts': 'export const a = 1;\n' });
    const c1 = commitMsg(repo, 'code');
    writeFiles(repo, { [REVIEW]: v2([c1.slice(0, 12)]) });
    const r1 = commitMsg(repo, 'round 1');
    writeFiles(repo, { 'src/a.ts': 'export const a = 2;\n' });
    const f1 = commitMsg(repo, 'fix');
    writeFiles(repo, { [DEBUG]: '## Episode 1\n' });
    const o = commitMsg(repo, 'debug opens');
    writeFiles(repo, { 'src/e.ts': 'export const e = 1;\n' });
    const e1 = commitMsg(repo, 'episode fix');
    gitRun(repo, 'switch', '-q', 'main');
    writeFiles(repo, { 'src/m.ts': 'export const m = 1;\n' });
    const main = commitMsg(repo, 'main moves');
    gitRun(repo, 'switch', '-q', 't/T-1');
    const mg = mergeMsg(repo, 'main', 'merge main');
    writeFiles(repo, { [REVIEW]: v2([c1.slice(0, 12), e1]) });
    const r2 = commitMsg(repo, 'round 2');

    const facts = ok(factsOf(repo));
    expect(facts.skip).toBeUndefined();
    expect(facts.heads).toHaveLength(2);
    expect(facts.heads[0]).toEqual({ high: c1, bound: true });
    expect(facts.heads[1].low).toBe(c1);
    expect(facts.heads[1].bound).toBe(true);
    expect([e1, mg]).toContain(facts.heads[1].high);
    const brief = (r: { sha: string; kind: string; files: string[] }[]) => r.map((c) => [c.sha, c.kind, c.files]);
    expect(brief(facts.ranges[0])).toEqual([
      [r1, 'commit', [REVIEW]],
      [f1, 'commit', ['src/a.ts']],
      [o, 'commit', [DEBUG]],
      [e1, 'episode', ['src/e.ts']],
    ]);
    expect(facts.ranges).toHaveLength(2);
    expect(facts.ranges[1].map((c) => [c.sha, c.kind])).toEqual([
      [mg, 'merge'],
      [r2, 'commit'],
    ]);
    const all = facts.ranges.flat().map((c) => c.sha);
    expect(all).not.toContain(main);
  } finally {
    cleanup(repo);
  }
});

it('risk:complex-branching the nearest code commit is not past a clean merge that brought in ticket commits on its second parent', () => {
  const repo = start();
  try {
    gitRun(repo, 'switch', '-q', '-c', 't/T-1');
    writeFiles(repo, { 'src/a.ts': 'export const a = 1;\n' });
    commitMsg(repo, 'code');
    gitRun(repo, 'switch', '-q', '-c', 'side', 'main');
    writeFiles(repo, { 'src/s.ts': 'export const s = 1;\n' });
    commitMsg(repo, 'side code, not on main');
    gitRun(repo, 'switch', '-q', 't/T-1');
    const mg = mergeMsg(repo, 'side', 'merge side');
    writeFiles(repo, { [REVIEW]: v2([mg]) });
    const rec = commitMsg(repo, 'round 1');

    const walk = readWalk(repo, { laneS: false, def: 'refs/heads/main', baseline: undefined });
    if ('error' in walk) throw new Error(walk.error);
    expect(nearestCode(walk, rec, 'T-1')).toBe(mg);

    // a merge of main alone, whose second parent lies outside the walk, is still skipped
    gitRun(repo, 'switch', '-q', 'main');
    writeFiles(repo, { 'src/m.ts': 'export const m = 1;\n' });
    commitMsg(repo, 'main moves');
    gitRun(repo, 'switch', '-q', 't/T-1');
    const mg2 = mergeMsg(repo, 'main', 'merge main');
    const walk2 = readWalk(repo, { laneS: false, def: 'refs/heads/main', baseline: undefined });
    if ('error' in walk2) throw new Error(walk2.error);
    expect(nearestCode(walk2, mg2, 'T-1')).toBe(mg);
  } finally {
    cleanup(repo);
  }
});

it('risk:complex-branching a failed remerge read fails closed only when the range holds a merge', () => {
  const repo = start();
  try {
    gitRun(repo, 'switch', '-q', '-c', 't/T-1');
    writeFiles(repo, { 'src/a.ts': 'export const a = 1;\n' });
    const c1 = commitMsg(repo, 'code');
    writeFiles(repo, { [REVIEW]: v2([c1]) });
    commitMsg(repo, 'round 1');
    const failRemerge = (a: string[]) => a.includes('--remerge-diff');

    const before = factsOf(repo, failRemerge);
    expect(before).not.toHaveProperty('error');
    expect(spawnLog.calls.some((a) => a.includes('--remerge-diff'))).toBe(true);

    gitRun(repo, 'switch', '-q', 'main');
    writeFiles(repo, { 'src/m.ts': 'export const m = 1;\n' });
    commitMsg(repo, 'main moves');
    gitRun(repo, 'switch', '-q', 't/T-1');
    mergeMsg(repo, 'main', 'merge main');

    const after = factsOf(repo, failRemerge);
    expect(after).toHaveProperty('error');
    expect((after as { error: string }).error).toContain('git 2.36');
    expect(factsOf(repo)).not.toHaveProperty('error');
  } finally {
    cleanup(repo);
  }
});

it('risk:complex-branching a shallow clone fails closed and names the unshallow fetch', () => {
  const repo = start();
  const parent = mkdtempSync(join(tmpdir(), 'accord-shallow-'));
  try {
    gitRun(repo, 'switch', '-q', '-c', 't/T-1');
    writeFiles(repo, { 'src/a.ts': 'export const a = 1;\n' });
    const c1 = commitMsg(repo, 'code');
    writeFiles(repo, { [REVIEW]: v2([c1]) });
    commitMsg(repo, 'round 1');
    gitRun(parent, 'clone', '-q', '--depth', '1', pathToFileURL(repo).href, 'shallow');

    const facts = roundFactsFor(join(parent, 'shallow'), loadSnapshot(loadFromFs(join(parent, 'shallow'))), 'T-1');
    expect(facts).toHaveProperty('error');
    expect((facts as { error: string }).error).toContain('git fetch --unshallow');
  } finally {
    cleanup(parent);
    cleanup(repo);
  }
});

it('risk:complex-branching an ancestry check git cannot answer fails closed', () => {
  const repo = start();
  try {
    const base = gitRun(repo, 'rev-parse', 'HEAD').trim();
    gitRun(repo, 'switch', '-q', '-c', 't/T-1');
    writeFiles(repo, { 'src/a.ts': 'export const a = 1;\n' });
    const c1 = commitMsg(repo, 'code');
    writeFiles(repo, { [REVIEW]: v2([base]) });
    commitMsg(repo, 'round 1');

    const facts = ok(factsOf(repo));
    expect(facts.heads[0]).toEqual({ high: c1, bound: true });

    const broken = factsOf(repo, (a) => a.includes('--is-ancestor'));
    expect(broken).toHaveProperty('error');
    expect((broken as { error: string }).error).toContain('merge-base --is-ancestor');
  } finally {
    cleanup(repo);
  }
});
