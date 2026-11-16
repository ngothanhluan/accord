// ST-LN-56 56-ac-1 (D-08, D-16): `accord gate done` refuses a review fix recorded without the places it checked, read from the claim pin on real git. The CLI runs as 0.6.0 so
// the repository's pin can be 0.6.0 while a ticket was claimed under 0.5.1 (cutoff-pin.test.ts's reason).
import { expect, it, vi } from 'vitest';
import { cleanup, commitMsg, gitRun, makeEmptyRepo, run, writeFiles } from './helpers/repo.js';
import { laneTicket, pinned } from '../../../test/helpers/lane.js';

vi.mock('../package.json', async (orig) => {
  const m = await orig<{ default: Record<string, unknown> }>();
  return { default: { ...m.default, version: '0.6.0' } };
});

const REVIEW = 'accord/tickets/T-1/review.md';
const RULE = 'gate.fix-places-missing';
interface Found { rule: string; level: string; reason?: string }
async function places(repo: string): Promise<Found[]> {
  const r = await run(['gate', 'done', 'T-1', '--json'], repo);
  return (JSON.parse(r.out).findings as Found[]).filter((f) => f.rule === RULE);
}

/** A ticket claimed under `claimPin`, one code commit and a fix commit; returns the repo and a writer of review.md round 1 whose finding 1.1 is `fixed in <the fix commit>`. */
function fixed(claimPin: string): { repo: string; write: (marks: string) => void } {
  const repo = makeEmptyRepo();
  writeFiles(repo, { 'accord/config.yml': pinned(claimPin), 'accord/tickets/T-1.md': laneTicket('T-1') });
  commitMsg(repo, 'base');
  gitRun(repo, 'branch', '-M', 'main');
  gitRun(repo, 'switch', '-q', '-c', 't/T-1');
  commitMsg(repo, 'claim: T-1', undefined, true);
  writeFiles(repo, { 'accord/config.yml': pinned('0.6.0'), 'src/a.ts': 'export const a = 1;\n' });
  const code = commitMsg(repo, 'code');
  writeFiles(repo, { 'src/a.ts': 'export const a = 2;\n' });
  const fix = commitMsg(repo, 'the fix');
  return {
    repo,
    write: (marks: string): void => {
      writeFiles(repo, { [REVIEW]: `Round record: 2\n\n## Round 1 head ${code}\n\nMust 1 [patch]: the export drops a row — src/a.ts:1 — fixed in ${fix}${marks}\n` });
      commitMsg(repo, 'T-1 round 1');
    },
  };
}

it('ac-1 gate done refuses a lane M fix with no places-checked line on real git (ST-LN-56 56-ac-1)', async () => {
  const { repo, write } = fixed('0.6.0');
  try {
    write('');
    const refused = await places(repo);
    expect(refused).toHaveLength(1);
    expect(refused[0].level).toBe('error');
    expect(refused[0].reason).toContain('round 1');
    expect(refused[0].reason).toContain('finding 1');
    expect(refused[0].reason).toContain('checked:');

    write(' — checked: src/a.ts:1, src/b.ts');
    expect(await places(repo)).toEqual([]);
  } finally {
    cleanup(repo);
  }
}, 120_000);

it('risk:regression a ticket claimed under 0.5.1 answers as before while HEAD is pinned 0.6.0 (ST-LN-56 56-ac-1)', async () => {
  const { repo, write } = fixed('0.5.1');
  try {
    write('');
    expect(await places(repo)).toEqual([]);
  } finally {
    cleanup(repo);
  }
}, 120_000);
