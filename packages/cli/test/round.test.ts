import { appendFileSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { cleanup, commitMsg, makeLaneRepo, run, writeFiles } from './helpers/repo.js';
import { LANE_S_BODY, laneTicket } from '../../../test/helpers/lane.js';

const REVIEW =
  'Round record: 1\n\n## Round 1\n\nMust 1 [patch]: the writer drops the header — src/export.ts:3 — fixed in abc1234\n\n' +
  '## Round 2\n\nShould 1 [patch]: a comma is not quoted — src/export.ts:9 — fixed in abc1235\n\n' +
  '## Round 3\n\nNice 1 [patch]: rename w — src/export.ts:1 — deferred\n';

it('risk:complex-branching accord round exits 0 with the round and model and 1 when git cannot confirm a return from verify', async () => {
  const repo = makeLaneRepo({
    'accord/tickets/S-1.md': laneTicket('S-1', { lane: 'S', body: LANE_S_BODY }),
    'accord/tickets/T-1/ledger.md': '## Rulings\n- task 1 done abc1234\n- task 2 done abc1234\n',
    'accord/tickets/T-1/review.md': REVIEW,
  });
  try {
    const sha1 = commitMsg(repo, 'fixture');
    expect(await run(['round', 'T-1'], repo)).toEqual({ code: 0, out: 'Round: 4 of 5\nCycle: 1\nFix executor model: opus\n', err: '' });

    const review = join(repo, 'accord', 'tickets', 'T-1', 'review.md');
    appendFileSync(review, '\n## Round 4\n\nNice 1 [patch]: a comment typo — src/export.ts:2 — deferred\n\nverdict: converged\n');
    const sha2 = commitMsg(repo, 'review: T-1 converged');
    writeFiles(repo, { 'src/export.ts': 'export const write = 2;\n' });
    commitMsg(repo, 'fix: T-1 after review');
    const verification = join(repo, 'accord', 'tickets', 'T-1', 'verification.md');
    writeFileSync(verification, '---\nticket: "T-1"\ncommit: "' + sha2 + '"\nreviewed_on: "2026-10-30"\n---\n');
    appendFileSync(review, '\n## Return from verify ' + sha2 + '\n');
    const second = { code: 0, out: 'Round: 1 of 5\nCycle: 2\nFix executor model: opus\n', err: '' };
    expect(await run(['round', 'T-1'], repo)).toEqual(second);
    rmSync(verification);
    expect(await run(['round', 'T-1'], repo)).toEqual(second);

    const base = readFileSync(review, 'utf8');
    for (const bad of [sha1, 'deadbeefdeadbeef']) {
      writeFileSync(review, base.replace('## Return from verify ' + sha2, '## Return from verify ' + bad));
      const r = await run(['round', 'T-1'], repo);
      expect(r.code).toBe(1);
      expect(r.out.startsWith('refused: ')).toBe(true);
      expect(r.out).toContain('cannot confirm');
    }

    expect(await run(['round', 'T-1', '--plan'], repo)).toEqual({ code: 0, out: 'Round: 1 of 5\nCycle: 1\n', err: '' });
    const s = await run(['round', 'S-1', '--plan'], repo);
    expect(s.code).toBe(2);
    expect(s.err).toContain('lane S has no plan critique');
    expect((await run(['round', 'NOPE-1'], repo)).code).toBe(2);
  } finally {
    cleanup(repo);
  }
}, 120_000);
