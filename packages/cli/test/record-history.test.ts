// ST-LN-57 task 3: which commit recorded each round, the pin at the first round, the base pin and the debug episodes.
import { rmSync } from 'node:fs';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { readHistory } from '../src/load/record-history.js';
import { readWalk } from '../src/load/walk.js';
import { cleanup, commitMsg, gitRun, makeEmptyRepo, mergeMsg, writeFiles } from './helpers/repo.js';
import { CONFIG, laneTicket } from '../../../test/helpers/lane.js';

const pinned = (v: string): string => CONFIG.replace(/^accord: .*$/m, `accord: "${v}"`);
const DEF = { def: 'refs/heads/main' };
const REVIEW = 'accord/tickets/T-1/review.md';
const DEBUG = 'accord/tickets/T-1/debug.md';

const v1 = (rounds: number): string =>
  'Round record: 1\n\n' + Array.from({ length: rounds }, (_, i) => `## Round ${i + 1}\n\nNo findings\n`).join('\n');
const v2 = (heads: string[]): string =>
  'Round record: 2\n\n' + heads.map((h, i) => `## Round ${i + 1} head ${h}\n\nNo findings\n`).join('\n');

function start(config: string): string {
  const repo = makeEmptyRepo();
  gitRun(repo, 'config', 'user.email', 'an@example.com');
  gitRun(repo, 'config', 'user.name', 'an');
  gitRun(repo, 'config', 'commit.gpgsign', 'false');
  writeFiles(repo, { 'accord/config.yml': config, 'accord/tickets/T-1.md': laneTicket('T-1') });
  commitMsg(repo, 'base');
  gitRun(repo, 'branch', '-M', 'main');
  return repo;
}

it('risk:complex-branching the round commits and the pin are read along first parents through a merge of main that changes config.yml', () => {
  const repo = start(pinned('0.3.0'));
  try {
    const base = gitRun(repo, 'rev-parse', 'HEAD').trim();
    gitRun(repo, 'switch', '-q', '-c', 't/T-1');
    writeFiles(repo, { 'src/a.ts': 'export const a = 1;\n' });
    commitMsg(repo, 'code');
    writeFiles(repo, { [REVIEW]: v1(1) });
    const b1 = commitMsg(repo, 'round 1');
    gitRun(repo, 'switch', '-q', 'main');
    writeFiles(repo, { 'accord/config.yml': pinned('0.4.0'), [REVIEW]: v1(3) });
    commitMsg(repo, 'main moves');
    gitRun(repo, 'switch', '-q', 't/T-1');
    try {
      gitRun(repo, 'merge', '--no-ff', 'main');
    } catch {
      // review.md was added on both sides: the branch's own text is kept below
    }
    gitRun(repo, 'checkout', '--ours', '--', REVIEW);
    commitMsg(repo, 'merge main');

    const h = readHistory(repo, 'T-1', undefined, '0.4.0', DEF);
    expect(h).toMatchObject({ rounds: [b1], pin: '0.3.0', pinAt: b1, basePin: '0.3.0', baseAt: base });
  } finally {
    cleanup(repo);
  }
});

it('risk:complex-branching a debug episode left open ends at the first review round recorded after it opened', () => {
  const repo = start(pinned('0.3.0'));
  try {
    gitRun(repo, 'switch', '-q', '-c', 't/T-1');
    writeFiles(repo, { 'src/a.ts': 'export const a = 1;\n' });
    const c1 = commitMsg(repo, 'code');
    writeFiles(repo, { [REVIEW]: v2([c1]) });
    const r1 = commitMsg(repo, 'round 1');
    writeFiles(repo, { [DEBUG]: '## Episode 1\n' });
    const o = commitMsg(repo, 'debug opens');
    writeFiles(repo, { 'src/e.ts': 'export const e = 1;\n' });
    const e1 = commitMsg(repo, 'episode fix');
    writeFiles(repo, { [REVIEW]: v2([c1, e1]) });
    const r2 = commitMsg(repo, 'round 2');
    writeFiles(repo, { 'src/f.ts': 'export const f = 1;\n' });
    const f = commitMsg(repo, 'later fix while still open');

    let walk = readWalk(repo, { laneS: false, def: 'refs/heads/main', baseline: undefined });
    if ('error' in walk) throw new Error(walk.error);
    let h = readHistory(repo, 'T-1', walk, undefined, DEF);
    if ('error' in h) throw new Error(h.error);
    expect(h.rounds).toEqual([r1, r2]);
    expect(h.episodes).toHaveLength(1);
    expect(h.episodes[0].open).toBe(o);
    expect(h.episodes[0].end).toBe(r2);
    expect(h.episodes[0].commits.has(e1)).toBe(true);
    for (const x of [o, r2, f]) expect(h.episodes[0].commits.has(x)).toBe(false);

    writeFiles(repo, { [DEBUG]: '## Episode 1\n\n## Resolved\n' });
    commitMsg(repo, 'resolved');
    writeFiles(repo, { [DEBUG]: '## Episode 1\n\n## Resolved\n\n## Episode 2\n' });
    const o2 = commitMsg(repo, 'second episode opens');
    writeFiles(repo, { 'src/g.ts': 'export const g = 1;\n' });
    const e2 = commitMsg(repo, 'second episode fix');
    writeFiles(repo, { [DEBUG]: '## Episode 1\n\n## Resolved\n\n## Episode 2\n\n## Resolved\n' });
    const z2 = commitMsg(repo, 'second resolved');

    walk = readWalk(repo, { laneS: false, def: 'refs/heads/main', baseline: undefined });
    if ('error' in walk) throw new Error(walk.error);
    h = readHistory(repo, 'T-1', walk, undefined, DEF);
    if ('error' in h) throw new Error(h.error);
    expect(h.episodes).toHaveLength(2);
    expect(h.episodes[0].end).toBe(r2);
    expect(h.episodes[1].open).toBe(o2);
    expect(h.episodes[1].end).toBe(z2);
    expect(h.episodes[1].commits.has(e2)).toBe(true);
    expect(h.episodes[1].commits.has(z2)).toBe(true);
    expect(h.episodes[1].commits.has(o2)).toBe(false);
  } finally {
    cleanup(repo);
  }
});

it('risk:complex-branching a ticket branch merged into the default branch is read on its merged-in side', () => {
  const repo = start(pinned('0.3.0'));
  try {
    gitRun(repo, 'switch', '-q', '-c', 't/T-1');
    writeFiles(repo, { 'src/a.ts': 'export const a = 1;\n' });
    commitMsg(repo, 'code');
    writeFiles(repo, { [REVIEW]: v1(1) });
    const b1 = commitMsg(repo, 'round 1');
    writeFiles(repo, { [REVIEW]: v1(2) });
    const b2 = commitMsg(repo, 'round 2');
    gitRun(repo, 'switch', '-q', 'main');
    writeFiles(repo, { 'accord/config.yml': pinned('0.3.1') });
    commitMsg(repo, 'release moves the pin');
    mergeMsg(repo, 't/T-1', 'merge T-1');

    const h = readHistory(repo, 'T-1', undefined, '0.3.1', DEF);
    expect(h).toMatchObject({ rounds: [b1, b2], pin: '0.3.0', pinAt: b1 });
  } finally {
    cleanup(repo);
  }
});

it('risk:security a record merged in from a branch off the default branch is read at the merge', () => {
  const repo = start(pinned('0.3.0'));
  try {
    const o = gitRun(repo, 'rev-parse', 'HEAD').trim();
    writeFiles(repo, { 'accord/config.yml': pinned('0.3.1') });
    commitMsg(repo, 'release moves the pin');
    gitRun(repo, 'switch', '-q', '-c', 't/T-1');
    writeFiles(repo, { 'src/a.ts': 'export const a = 1;\n' });
    commitMsg(repo, 'code');
    gitRun(repo, 'switch', '-q', '-c', 'side', o);
    writeFiles(repo, { [REVIEW]: v1(1) });
    commitMsg(repo, 'old record');
    gitRun(repo, 'switch', '-q', 't/T-1');
    const m = mergeMsg(repo, 'side', 'merge side');

    const h = readHistory(repo, 'T-1', undefined, '0.3.1', DEF);
    expect(h).toMatchObject({ rounds: [m], pin: '0.3.1', pinAt: m });
  } finally {
    cleanup(repo);
  }
});

it('risk:security a record blob git cannot read fails closed, not as an absent review.md', () => {
  const repo = start(pinned('0.3.0'));
  try {
    gitRun(repo, 'switch', '-q', '-c', 't/T-1');
    writeFiles(repo, { 'src/a.ts': 'export const a = 1;\n' });
    commitMsg(repo, 'code');
    writeFiles(repo, { [REVIEW]: v1(1) });
    const r1 = commitMsg(repo, 'round 1');
    writeFiles(repo, { [REVIEW]: v1(2) });
    commitMsg(repo, 'round 2');
    expect(readHistory(repo, 'T-1', undefined, '0.3.0', DEF)).toMatchObject({ rounds: [r1, expect.any(String)] });

    // the blob of round 1's record is gone, as in a blobless clone
    const blob = gitRun(repo, 'rev-parse', `${r1}:${REVIEW}`).trim();
    rmSync(join(repo, '.git', 'objects', blob.slice(0, 2), blob.slice(2)), { force: true });

    const h = readHistory(repo, 'T-1', undefined, '0.3.0', DEF);
    expect(h).toHaveProperty('error');
    expect((h as { error: string }).error).toContain(r1.slice(0, 12));
    expect((h as { error: string }).error).toContain(REVIEW);
  } finally {
    cleanup(repo);
  }
});
