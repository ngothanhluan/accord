// ST-LN-57 task 1: the review package of a version 2 record starts at the last round's head.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { parseRounds } from '@accord-dev/accord-core';
import { cleanup, commitMsg, gitRun, makeEmptyRepo, run, writeFiles } from './helpers/repo.js';
import { CONFIG, LANE_S_BODY, laneTicket, PLAN } from '../../../test/helpers/lane.js';

it('ac-1 the next review package holds only the ticket branch commits after the last round head', async () => {
  const repo = makeEmptyRepo();
  try {
    gitRun(repo, 'config', 'user.email', 'an@example.com');
    gitRun(repo, 'config', 'user.name', 'an');
    gitRun(repo, 'config', 'commit.gpgsign', 'false');
    writeFiles(repo, {
      'accord/config.yml': CONFIG,
      'accord/tickets/T-1.md': laneTicket('T-1'),
      'accord/tickets/S-1.md': laneTicket('S-1', { lane: 'S', body: LANE_S_BODY }),
      'accord/tickets/S-1/review.md': 'Round record: 2\n\n## Round 1 head abc1234\n\nNo findings\n',
      'src/shared.ts': 'base\n',
    });
    const base = commitMsg(repo, 'base');
    gitRun(repo, 'branch', '-M', 'main');
    gitRun(repo, 'switch', '-q', '-c', 't/T-1');
    writeFiles(repo, {
      'accord/tickets/T-1/plan.md': PLAN.replace('abc1234', base),
      'src/a.ts': 'export const a = 1;\n',
    });
    const a = commitMsg(repo, 'plan and first code');
    const reviewFile = 'accord/tickets/T-1/review.md';
    writeFiles(repo, {
      [reviewFile]: `Round record: 2\n\n## Round 1 head ${a}\n\nMust 1 [patch]: the writer drops the header — src/a.ts:1 — open\n`,
    });
    commitMsg(repo, 'round 1');
    writeFiles(repo, { 'accord/tickets/T-1/debug.md': '## Episode 1\n' });
    commitMsg(repo, 'debug episode');
    writeFiles(repo, { 'src/d.ts': 'export const d = 1;\n' });
    commitMsg(repo, 'debug fix');
    gitRun(repo, 'switch', '-q', 'main');
    writeFiles(repo, { 'src/m.ts': 'export const main = 1;\n', 'src/shared.ts': 'main\n' });
    commitMsg(repo, 'main change');
    gitRun(repo, 'switch', '-q', 't/T-1');
    writeFiles(repo, { 'src/shared.ts': 'branch\n' });
    commitMsg(repo, 'branch change');
    try {
      gitRun(repo, 'merge', '--no-ff', 'main');
    } catch {
      // the conflict on src/shared.ts is the point: the resolution below is the merge's own change
    }
    writeFiles(repo, { 'src/shared.ts': 'resolved\n' });
    const merge = commitMsg(repo, 'merge main');

    const r = await run(['review-package', 'T-1'], repo);
    expect(r.err).toBe('');
    expect(r.code).toBe(0);
    expect(r.out).toContain(`Head: ${merge}`);
    expect(r.out).toContain('debug fix');
    expect(r.out).toContain('+export const d = 1;');
    expect(r.out).toContain('+resolved');
    expect(r.out).not.toContain('+export const main = 1;');
    expect(r.out).not.toContain('+export const a = 1;');

    const rec = parseRounds(reviewFile, readFileSync(join(repo, ...reviewFile.split('/')), 'utf8'), 'review');
    expect(rec.version).toBe(2);
    expect(rec.cycles[0].rounds[0].head).toBe(a);

    const loop = await run(['review-package', 'T-1', '--base', a], repo);
    expect(loop.code).toBe(2);
    expect(loop.err).toContain('--base is accepted only for the final review');
    const final = await run(['review-package', 'T-1', '--base', base], repo);
    expect(final.code).toBe(0);
    expect(final.out).toContain('+export const a = 1;');
    const laneS = await run(['review-package', 'S-1', '--base', 'main'], repo);
    expect(laneS.code).toBe(2);
    expect(laneS.err).toContain('lane S takes no --base');
  } finally {
    cleanup(repo);
  }
});
