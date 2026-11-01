// ST-LN-57 Task 6: `accord round` and `accord gate done` read the round facts from real git.
import { expect, it } from 'vitest';
import { RECORD_V2_FROM } from '@accord-dev/accord-core';
import { cleanup, commitMsg, gitRun, makeEmptyRepo, run, writeFiles } from './helpers/repo.js';
import { CONFIG, LANE_S_BODY, laneTicket } from '../../../test/helpers/lane.js';

const pinned = (v: string): string => CONFIG.replace('accord: "0.3.0"', `accord: "${v}"`);
const V1 = 'Round record: 1\n\n## Round 1\n\nNo findings\n\nverdict: converged\n';
const REVIEW = 'accord/tickets/T-1/review.md';

interface Found { rule: string; level: string; reason?: string }
async function findings(repo: string, id: string): Promise<Found[]> {
  const r = await run(['gate', 'done', id, '--json'], repo);
  return JSON.parse(r.out).findings as Found[];
}
const scope = (all: Found[]): Found[] => all.filter((f) => f.rule === 'gate.review-scope');

it('risk:complex-branching a version 1 record is refused when the pin at its first round is at the cut-over', async () => {
  const repo = makeEmptyRepo();
  try {
    writeFiles(repo, { 'accord/config.yml': pinned('0.3.0'), 'accord/tickets/T-1.md': laneTicket('T-1'), 'accord/tickets/T-2.md': laneTicket('T-2') });
    commitMsg(repo, 'base');
    gitRun(repo, 'branch', '-M', 'main');
    gitRun(repo, 'switch', '-q', '-c', 't/T-1');
    writeFiles(repo, { 'src/a.ts': 'export const a = 1;\n' });
    commitMsg(repo, 'code');
    writeFiles(repo, { 'accord/tickets/T-2/review.md': V1 });
    commitMsg(repo, 'T-2 round 1');
    writeFiles(repo, { 'accord/config.yml': pinned(RECORD_V2_FROM), [REVIEW]: V1 });
    commitMsg(repo, 'T-1 round 1');
    writeFiles(repo, { 'accord/config.yml': CONFIG, 'src/b.ts': 'export const b = 1;\n' });
    commitMsg(repo, 'code again');

    const one = scope(await findings(repo, 'T-1'));
    expect(one).toHaveLength(1);
    expect(one[0].reason).toContain('Round record: 2');
    expect(one[0].reason).toContain(RECORD_V2_FROM);
    expect(scope(await findings(repo, 'T-2'))).toEqual([]);

    const round = await run(['round', 'T-1'], repo);
    expect(round.code).toBe(1);
    expect(round.out).toContain('refused:');
    expect(round.out).toContain('Round record: 2');
  } finally {
    cleanup(repo);
  }
});

it('risk:complex-branching gate done names an unreadable head and a head typed past the last code commit of its round', async () => {
  const repo = makeEmptyRepo();
  try {
    writeFiles(repo, { 'accord/config.yml': CONFIG, 'accord/tickets/T-1.md': laneTicket('T-1') });
    commitMsg(repo, 'base');
    gitRun(repo, 'branch', '-M', 'main');
    gitRun(repo, 'switch', '-q', '-c', 't/T-1');
    writeFiles(repo, { 'src/c1.ts': 'export const c1 = 1;\n' });
    const c1 = commitMsg(repo, 'code one');
    writeFiles(repo, { [REVIEW]: 'Round record: 2\n\n## Round 1 head deadbeef\n\nNo findings\n' });
    commitMsg(repo, 'round 1');
    writeFiles(repo, { 'src/f.ts': 'export const f = 1;\n' });
    const f = commitMsg(repo, 'code F');

    const unreadable = scope(await findings(repo, 'T-1')).map((x) => x.reason).join('\n');
    expect(unreadable).toContain('names no commit in this repository');
    expect(unreadable).toContain('retype');

    writeFiles(repo, { [REVIEW]: `Round record: 2\n\n## Round 1 head ${f}\n\nNo findings\n` });
    commitMsg(repo, 'retype the head');
    const past = scope(await findings(repo, 'T-1')).map((x) => x.reason).join('\n');
    expect(past).toContain('is not between');
    expect(past).toContain(c1.slice(0, 12));
  } finally {
    cleanup(repo);
  }
});

it('risk:complex-branching gate done skips the review scope checks with a notice when HEAD is on the default branch', async () => {
  const repo = makeEmptyRepo();
  try {
    writeFiles(repo, { 'accord/config.yml': CONFIG, 'accord/tickets/T-1.md': laneTicket('T-1') });
    commitMsg(repo, 'base');
    gitRun(repo, 'branch', '-M', 'main');
    gitRun(repo, 'switch', '-q', '-c', 't/T-1');
    writeFiles(repo, { 'src/c1.ts': 'export const c1 = 1;\n', [REVIEW]: 'Round record: 2\n\n## Round 1 head deadbeef\n\nNo findings\n' });
    commitMsg(repo, 'code and round 1');
    gitRun(repo, 'switch', '-q', 'main');
    gitRun(repo, 'merge', '--ff-only', 't/T-1');

    const on = await findings(repo, 'T-1');
    expect(on.filter((f) => f.rule === 'gate.review-scope-skipped').map((f) => f.level)).toEqual(['warning']);
    expect(scope(on)).toEqual([]);

    // the ticket done on the default branch, re-gated on another ticket's branch whose walk is not empty
    writeFiles(repo, { 'accord/tickets/S-1.md': laneTicket('S-1', { lane: 'S', body: LANE_S_BODY }) });
    commitMsg(repo, 'S-1 ticket');
    expect((await run(['gate', 'ready', 'S-1'], repo)).code).toBe(0);
    writeFiles(repo, { 'accord/tickets/S-1/review.md': 'Round record: 2\n\n## Round 1 head deadbeef\n\nNo findings\n\nverdict: converged\n' });
    commitMsg(repo, 'S-1 ready and reviewed');
    gitRun(repo, 'switch', '-q', '-c', 't/T-2');
    writeFiles(repo, { 'src/t2.ts': 'export const t2 = 1;\n' });
    commitMsg(repo, 'T-2 code');

    const there = await findings(repo, 'S-1');
    expect(there.filter((f) => f.rule === 'gate.review-scope-skipped').map((f) => f.level)).toEqual(['warning']);
    for (const rule of ['gate.review-scope', 'gate.fix-file-unexplained', 'gate.finding-evidence', 'gate.finding-grounds']) {
      expect(there.filter((f) => f.rule === rule)).toEqual([]);
    }
  } finally {
    cleanup(repo);
  }
});
