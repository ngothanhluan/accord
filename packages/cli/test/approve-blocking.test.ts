// ST-LN-91 D-22: `accord approve` refuses while an approach finding marked risk: data-loss or risk: security is open, on real git.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { APPROACH_CAP_FROM } from '@accord-dev/accord-core';
import { cleanup, commitAll, commitMsg, makeLaneRepo, run, writeFiles } from './helpers/repo.js';
import { CONFIG } from '../../../test/helpers/lane.js';

const APPROACH = join('accord', 'tickets', 'T-1', 'approach-review.md');
const TICKET = join('accord', 'tickets', 'T-1.md');
const pinned = (v: string): string => CONFIG.replace(/accord: "[^"]*"/, `accord: "${v}"`);
const rec = (...rounds: string[]): string => 'Round record: 1\n\n' + rounds.join('');
const r = (n: number, mode: string, ...lines: string[]): string => '## Round ' + n + ' (' + mode + ')\n\n' + lines.join('\n') + '\n\n';
const LOSS = '1. Must — the export overwrites the old file — open — risk: data-loss';
const SEC = '2. Must — tokens reach the log — unverified — risk: security';
const OPEN = '1. Should — the cache can go stale — open';

/** A ticket claimed under `claimPin`, its approach rounds committed after the claim, HEAD back on the running version's pin. */
function claimed(claimPin: string, record: string): string {
  const repo = makeLaneRepo();
  writeFiles(repo, { 'accord/config.yml': pinned(claimPin) });
  commitMsg(repo, 'claim: T-1');
  writeFiles(repo, { 'accord/config.yml': CONFIG, [APPROACH]: record, 'notes.txt': 'work after the claim\n' });
  commitAll(repo, 'T-1 approach rounds');
  return repo;
}

it('risk:security accord approve refuses while a data-loss or security approach finding is open, and names it (ST-LN-91 D-22)', async () => {
  const repo = claimed(APPROACH_CAP_FROM, rec(r(1, 'whole', LOSS, SEC), r(2, 'diff', OPEN)));
  try {
    const before = readFileSync(join(repo, TICKET));
    const refused = await run(['approve', 'T-1'], repo);
    expect(refused.code).toBe(1);
    expect(refused.err).toBe('');
    expect(refused.out.startsWith('refused:')).toBe(true);
    expect(refused.out).toContain('T-1');
    expect(refused.out).toContain('blocks the approval');
    expect(refused.out).toContain('Round 1:\n' + LOSS + '\n' + SEC + '\n');
    expect(refused.out).not.toContain(OPEN);
    expect(readFileSync(join(repo, TICKET)).equals(before)).toBe(true);
    expect(readFileSync(join(repo, TICKET), 'utf8')).not.toContain('approved_hash');

    // A round 1 alone blocks as well: the owner is not asked for a yes over it.
    writeFiles(repo, { [APPROACH]: rec(r(1, 'whole', LOSS)) });
    expect((await run(['approve', 'T-1'], repo)).code).toBe(1);

    // Fixed, the finding no longer blocks.
    writeFiles(repo, { [APPROACH]: rec(r(1, 'whole', LOSS.replace(' open ', ' fixed '), SEC.replace('unverified', 'withdrawn')), r(2, 'diff', OPEN)) });
    const approved = await run(['approve', 'T-1'], repo);
    expect(approved.code).toBe(0);
    expect(approved.out).toMatch(/^approved accord\/tickets\/T-1\.md at /);
  } finally {
    cleanup(repo);
  }
}, 120_000);

it("risk:security the owner's no closes a blocked approach cycle and the next approval is not refused (ST-LN-91 D-22)", async () => {
  const closed = "## Closed option B: the owner's no\n\n";
  const repo = claimed(APPROACH_CAP_FROM, rec(r(1, 'whole', LOSS), r(2, 'diff', OPEN)) + closed);
  try {
    expect((await run(['approve', 'T-1'], repo)).code).toBe(0);
  } finally {
    cleanup(repo);
  }
}, 120_000);

// A ticket claimed under 0.4.0 keeps its old rules: packages/cli/test/cutoff-pin.test.ts runs the CLI as 0.4.1, the only way that case can fail when the claim pin is not read.
