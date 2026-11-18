// ST-LN-12 7-ac-7 (D-12): `accord deferred <id>` prints the ledger's Must and Should deferred items for the owner at verify,
// and nothing gates on them. Real files in a tmp sandbox; nothing here reaches the real origin.
import { expect, it } from 'vitest';
import { cleanup, commitMsg, gitRun, makeEmptyRepo, run, writeFiles } from './helpers/repo.js';
import { CONFIG, gateReadyIn, junit, LANE_S_BODY, laneTicket, P, REPORT } from '../../../test/helpers/lane.js';

const RP = 'accord/tickets/S-1/review.md';
const LEDGER = 'accord/tickets/S-1/ledger.md';
const DEFERRED_LEDGER = [
  '## Deferred',
  '- review 1.1: the retry stays at three (Nice)',
  '- review 1.2: the export drops a trailing comma (Should)',
  '- review 1.3: the lock is not released on a crash (Must)',
  '',
].join('\n');

/** A lane S ticket in its reviewed state: base, ready, one change, and a converged review; the state `gate done` passes in. */
function reviewedRepo(): string {
  const files: Record<string, string> = {
    'accord/config.yml': CONFIG,
    [P('S-1')]: laneTicket('S-1', { lane: 'S', body: LANE_S_BODY + '\n## Scope\nsrc/a.ts\n' }),
    'src/a.ts': 'a\n',
    [REPORT]: junit({ 'a#b': 'passed' }),
  };
  const repo = makeEmptyRepo();
  gitRun(repo, 'config', 'user.email', 'an@example.com');
  gitRun(repo, 'config', 'user.name', 'an');
  gitRun(repo, 'config', 'commit.gpgsign', 'false');
  writeFiles(repo, files);
  commitMsg(repo, 'base');
  gitRun(repo, 'switch', '-q', '-c', 't/S-1');
  const readied = { ...files };
  gateReadyIn(readied, 'S-1');
  writeFiles(repo, { [P('S-1')]: readied[P('S-1')] });
  commitMsg(repo, 'ready: S-1');
  writeFiles(repo, { 'src/a.ts': 'b\n' });
  commitMsg(repo, 'change');
  const head = gitRun(repo, 'rev-parse', 'HEAD').trim();
  writeFiles(repo, { [RP]: `Round record: 2\n\n## Round 1 head ${head}\n\nNo findings\n\nSecurity: no pattern matched\n\nverdict: converged\n` });
  commitMsg(repo, 'review: S-1');
  return repo;
}

it('ac-7 accord deferred prints the items and gate done passes with them undecided (ST-LN-12 7-ac-7)', async () => {
  const repo = reviewedRepo();
  try {
    // the baseline: the ticket passes gate done, and with no ledger the lister prints the one line
    expect((await run(['gate', 'done', 'S-1'], repo)).code).toBe(0);
    const none = await run(['deferred', 'S-1'], repo);
    expect(none.code, none.err).toBe(0);
    expect(none.out).toBe('no Must or Should deferred items\n');

    // a ledger holding a Nice, a Should and a Must item: the Must comes first, the Nice is never shown
    writeFiles(repo, { [LEDGER]: DEFERRED_LEDGER });
    commitMsg(repo, 'ledger');
    const shown = await run(['deferred', 'S-1'], repo);
    expect(shown.code, shown.err).toBe(0);
    expect(shown.out).toBe(['Must: review 1.3: the lock is not released on a crash (Must)', 'Should: review 1.2: the export drops a trailing comma (Should)', ''].join('\n'));
    expect(shown.out).not.toContain('Nice');

    // undecided Must and Should items do not stop the ticket (D-12): no gate reads them as a decision
    const gate = await run(['gate', 'done', 'S-1'], repo);
    expect(gate.code, gate.out + gate.err).toBe(0);

    // a ledger whose Deferred section holds only a Nice item prints the one line
    writeFiles(repo, { [LEDGER]: '## Deferred\n- review 1.1: a small thing (Nice)\n' });
    expect((await run(['deferred', 'S-1'], repo)).out).toBe('no Must or Should deferred items\n');
  } finally {
    cleanup(repo);
  }
}, 120_000);

it('ac-7 accord deferred refuses an id that is no ticket or no id (ST-LN-12 7-ac-7)', async () => {
  const repo = reviewedRepo();
  try {
    for (const bad of ['../S-1', '..', '.hidden', 'a/b', 'a\\b', '']) {
      const r = await run(['deferred', bad], repo);
      expect(r.code, 'id ' + JSON.stringify(bad)).toBe(2);
      expect(r.out).toBe('');
    }
    const missing = await run(['deferred', 'S-9'], repo);
    expect(missing.code).toBe(2);
    expect(missing.err).toContain('S-9');
  } finally {
    cleanup(repo);
  }
}, 120_000);
