// ST-LN-94 94-ac-4, D-11: `accord budget <id>` on real git. The clock runs from the committer time of the ticket's `claim: <id>` commit;
// tokens are `not measured` until plan 03-21 adds the transcript reader. CLAUDE_CONFIG_DIR points at an empty folder, so no test reads the
// real ~/.claude.
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { cleanup, commitMsg, gitRun, makeEmptyRepo, run, writeFiles } from './helpers/repo.js';
import { CONFIG, laneTicket, P } from '../../../test/helpers/lane.js';

const DECISION = '- D-01 Timebox 1 hours, token budget 800k weighted tokens — "one hour and 800k is enough"';
const R_BODY = [
  '## Question', 'Does the critic need a second round?', '',
  '## Timebox', '1 hours', '',
  '## Token budget', '800k weighted tokens', '',
  '## Decisions', DECISION, '',
].join('\n');

/** A repository on main whose base commit holds the config and the R ticket, and whose `claim: R-1` commit is dated `minutesAgo` back. */
function claimed(minutesAgo: number): string {
  const repo = makeEmptyRepo();
  writeFiles(repo, { 'accord/config.yml': CONFIG, [P('R-1')]: laneTicket('R-1', { lane: 'R', body: R_BODY }) });
  const at = new Date(Date.now() - minutesAgo * 60_000);
  commitMsg(repo, 'base', new Date(at.getTime() - 60_000));
  gitRun(repo, 'branch', '-M', 'main');
  writeFiles(repo, { 'notes.txt': 'claimed\n' });
  commitMsg(repo, 'claim: R-1', at);
  return repo;
}

async function budget(repo: string, id = 'R-1') {
  const claude = mkdtempSync(join(tmpdir(), 'accord-claude-'));
  try {
    return await run(['budget', id], repo, { CLAUDE_CONFIG_DIR: claude });
  } finally {
    cleanup(claude);
  }
}

it('risk:complex-branching accord budget answers from the claim commit\'s time (ST-LN-94 94-ac-4)', async () => {
  const fresh = claimed(10);
  const late = claimed(120);
  try {
    const within = await budget(fresh);
    expect(within.err).toBe('');
    expect(within.code).toBe(0);
    const lines = within.out.trimEnd().split('\n');
    expect(lines[0]).toBe('within budget');
    expect(lines.some((l) => l.includes('not measured'))).toBe(true);
    expect(lines.some((l) => /^Spent: 0h 1[01]m of 1 hours; not measured of 800k weighted tokens$/.test(l))).toBe(true);
    expect(within.out).not.toContain('Owner: write now');

    const stop = await budget(late);
    expect(stop.code).toBe(1);
    const said = stop.out.trimEnd().split('\n');
    expect(said[0]).toBe('stop: ask owner');
    expect(said.some((l) => /^Spent: 2h [01]m of 1 hours; not measured of 800k weighted tokens$/.test(l))).toBe(true);
    expect(said.some((l) => l.includes('write the record from what the research has') && l.includes('extend ## Timebox or ## Token budget'))).toBe(true);
    expect(said.some((l) => l.includes('Owner: write now') && l.includes('## Decisions') && l.includes('accord gate ready R-1'))).toBe(true);
  } finally {
    cleanup(fresh);
    cleanup(late);
  }
}, 120_000);

it('risk:complex-branching accord budget refuses a ticket it cannot clock (ST-LN-94 94-ac-4)', async () => {
  const lane = makeEmptyRepo();
  const never = makeEmptyRepo();
  const unclaimed = makeEmptyRepo();
  try {
    writeFiles(lane, { 'accord/config.yml': CONFIG, [P('M-1')]: laneTicket('M-1') });
    commitMsg(lane, 'claim: M-1');
    const m = await budget(lane, 'M-1');
    expect(m.code).toBe(2);
    expect(m.out).toBe('');
    expect(m.err).toContain('lane M');

    const files = { 'accord/config.yml': CONFIG, [P('R-1')]: laneTicket('R-1', { lane: 'R', body: R_BODY }) };
    writeFiles(never, files);
    const none = await budget(never);
    expect(none.code).toBe(2);
    expect(none.err).toContain('no claim commit for R-1');

    writeFiles(unclaimed, files);
    commitMsg(unclaimed, 'add R-1');
    const bare = await budget(unclaimed);
    expect(bare.code).toBe(2);
    expect(bare.err).toContain('no claim commit for R-1');
    expect(bare.out).toBe('');
  } finally {
    cleanup(lane);
    cleanup(never);
    cleanup(unclaimed);
  }
}, 120_000);
