// ST-LN-56 56-ac-1 (D-08, D-16): `accord gate done` refuses a review fix recorded without the places it checked, read from the claim pin on real git. The CLI runs as 0.6.0 so
// the repository's pin can be 0.6.0 while a ticket was claimed under 0.5.1 (cutoff-pin.test.ts's reason).
import { expect, it, vi } from 'vitest';
import { cleanup, commitMsg, gitRun, makeEmptyRepo, run, writeFiles } from './helpers/repo.js';
import { LANE_S_BODY, laneTicket, pinned } from '../../../test/helpers/lane.js';

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

interface Fixed {
  repo: string;
  /** Round 1 alone, its finding 1.1 `fixed in <the fix commit>` followed by `marks`. */
  write: (marks: string) => void;
  /** Round 1 as above and a round 2 (head: the fix commit) holding `second`. */
  rounds: (marks: string, second: string) => void;
}

/**
 * A ticket claimed under `claimPin`, one code commit and a fix commit. `o.lane` 'S' makes it a lane S ticket (its finding lines carry no class);
 * `o.runtimes` replaces the config's `runtimes: [claude]` line (D-18).
 */
function fixed(claimPin: string, o: { lane?: 'S'; runtimes?: string } = {}): Fixed {
  const cfg = (pin: string): string => (o.runtimes === undefined ? pinned(pin) : pinned(pin).replace('runtimes: [claude]', o.runtimes));
  const ticket = o.lane === 'S' ? laneTicket('T-1', { lane: 'S', body: LANE_S_BODY + '\n## Scope\nsrc/a.ts\n' }) : laneTicket('T-1');
  const klass = o.lane === 'S' ? '' : ' [patch]';
  const repo = makeEmptyRepo();
  writeFiles(repo, { 'accord/config.yml': cfg(claimPin), 'accord/tickets/T-1.md': ticket });
  commitMsg(repo, 'base');
  gitRun(repo, 'branch', '-M', 'main');
  gitRun(repo, 'switch', '-q', '-c', 't/T-1');
  commitMsg(repo, 'claim: T-1', undefined, true);
  writeFiles(repo, { 'accord/config.yml': cfg('0.6.0'), 'src/a.ts': 'export const a = 1;\n' });
  const code = commitMsg(repo, 'code');
  writeFiles(repo, { 'src/a.ts': 'export const a = 2;\n' });
  const fix = commitMsg(repo, 'the fix');
  const first = (marks: string): string => `Round record: 2\n\n## Round 1 head ${code}\n\nMust 1${klass}: the export drops a row — src/a.ts:1 — fixed in ${fix}${marks}\n`;
  return {
    repo,
    write: (marks: string): void => {
      writeFiles(repo, { [REVIEW]: first(marks) });
      commitMsg(repo, 'T-1 round 1');
    },
    rounds: (marks: string, second: string): void => {
      writeFiles(repo, { [REVIEW]: first(marks) + `\n## Round 2 head ${fix}\n\n${second}\n` });
      commitMsg(repo, 'T-1 rounds 1 and 2');
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

it('ac-1 accord round refuses a lane M fix with no places-checked line on real git, reading the claim pin (ST-LN-56 56-ac-1)', async () => {
  const { repo, write } = fixed('0.6.0');
  try {
    write('');
    const refused = await run(['round', 'T-1'], repo);
    expect(refused.code).toBe(1);
    expect(refused.out).toContain('refused:');
    expect(refused.out).toContain('round 1');
    expect(refused.out).toContain('finding 1');
    expect(refused.out).toContain('checked:');

    write(' — checked: src/a.ts:1, src/b.ts');
    const next = await run(['round', 'T-1'], repo);
    expect(next.out).toContain('Round: 2 of 5');
    expect(next.code).toBe(0);
  } finally {
    cleanup(repo);
  }

  // the claim pin decides, not the working tree: claimed under 0.5.1 while HEAD is pinned 0.6.0
  const older = fixed('0.5.1');
  try {
    older.write('');
    const r = await run(['round', 'T-1'], older.repo);
    expect(r.out).toContain('Round: 2 of 5');
    expect(r.code).toBe(0);
  } finally {
    cleanup(older.repo);
  }
}, 120_000);

const FIX_RULES = ['gate.fix-places-missing', 'gate.fix-not-addressed'];
const PLACES = ' — checked: src/a.ts:1, src/b.ts';
const ADDRESSED = ' — addressed: src/a.ts:1';
async function fixRules(repo: string): Promise<string[]> {
  const r = await run(['gate', 'done', 'T-1', '--json'], repo);
  return [...new Set((JSON.parse(r.out).findings as Found[]).map((f) => f.rule).filter((id) => FIX_RULES.includes(id)))].sort();
}

it('ac-1 lane S refuses a fix with no places-checked line and a fix with no re-review answer (ST-LN-56 56-ac-1)', async () => {
  const s = fixed('0.6.0', { lane: 'S' });
  try {
    // round 1 alone: the fix has no places mark (and, as the record's last round, no re-review yet)
    s.write('');
    const noPlaces = await run(['round', 'T-1'], s.repo);
    expect(noPlaces.code).toBe(1);
    expect(noPlaces.out).toContain('refused:');
    expect(noPlaces.out).toContain('round 1');
    expect(noPlaces.out).toContain('finding 1');
    expect(noPlaces.out).toContain('checked:');
    expect(await fixRules(s.repo)).toEqual(['gate.fix-not-addressed', 'gate.fix-places-missing']);

    // places, and round 2 reviewed it, but the fix has no answer: the next round is refused naming the finding
    s.rounds(PLACES, 'No findings');
    const noAnswer = await run(['round', 'T-1'], s.repo);
    expect(noAnswer.code).toBe(1);
    expect(noAnswer.out).toContain('refused:');
    expect(noAnswer.out).toContain('finding 1');
    expect(noAnswer.out).toContain('addressed:');
    expect(await fixRules(s.repo)).toEqual(['gate.fix-not-addressed']);

    // the re-review's answer closes it
    s.rounds(PLACES + ADDRESSED, 'No findings');
    const answered = await run(['round', 'T-1'], s.repo);
    expect(answered.out).toContain('Round: 3 of 5');
    expect(answered.code).toBe(0);
    expect(await fixRules(s.repo)).toEqual([]);
  } finally {
    cleanup(s.repo);
  }

  // a ticket claimed at 0.5.1 is answered as before, whatever its working-tree pin
  const older = fixed('0.5.1', { lane: 'S' });
  try {
    older.rounds('', 'No findings');
    const r = await run(['round', 'T-1'], older.repo);
    expect(r.out).toContain('Round: 3 of 5');
    expect(r.code).toBe(0);
    expect(await fixRules(older.repo)).toEqual([]);
  } finally {
    cleanup(older.repo);
  }
}, 240_000);

it('risk:regression the fix-record rules hold in a repository whose runtimes install no accord agent (ST-LN-56 56-ac-1)', async () => {
  for (const runtimes of ['runtimes: [claude]', 'runtimes: [codex, cursor, copilot]']) {
    const { repo, write } = fixed('0.6.0', { runtimes });
    try {
      write('');
      const refused = await run(['round', 'T-1'], repo);
      expect(refused.code, runtimes).toBe(1);
      expect(refused.out, runtimes).toContain('refused:');
      expect(refused.out, runtimes).toContain('finding 1');
      expect(refused.out, runtimes).toContain('checked:');
    } finally {
      cleanup(repo);
    }
  }
}, 240_000);

// ST-LN-56 56-ac-2, the outside-diff half (plan 04-09): a re-review finding outside the fix diff goes to Deferred and starts no round; `accord round` refuses it left open.
const LEDGER = 'accord/tickets/T-1/ledger.md';
const DEFERRED_LINE = '## Deferred\n- review 2.1: a cell is wrong — failing case: the export of a two-row table drops the second row\n';
const outsideLine = (state: string, klass: string, marks = ''): string => `Should 1${klass}: a cell is wrong — src/z.ts:1 — ${state}${marks}`;

it('ac-2 accord round refuses an open outside-diff re-review finding on real git (ST-LN-56 56-ac-2)', async () => {
  const { repo, rounds } = fixed('0.6.0');
  try {
    rounds(PLACES + ADDRESSED, outsideLine('open', ' [patch]', ' — test: export#writes-csv'));
    const refused = await run(['round', 'T-1'], repo);
    expect(refused.code).toBe(1);
    expect(refused.out).toContain('refused:');
    expect(refused.out).toContain('round 2');
    expect(refused.out).toContain('finding 1');
    expect(refused.out).toContain('src/z.ts');

    // written deferred with its ledger line, the round command goes on
    rounds(PLACES + ADDRESSED, outsideLine('deferred', ' [patch]'));
    writeFiles(repo, { [LEDGER]: DEFERRED_LINE });
    commitMsg(repo, 'T-1 ledger');
    const next = await run(['round', 'T-1'], repo);
    expect(next.out).toContain('Round: 3 of 5');
    expect(next.code).toBe(0);
  } finally {
    cleanup(repo);
  }
}, 240_000);

it('ac-2 lane S defers an outside-diff re-review finding the same way (ST-LN-56 56-ac-2)', async () => {
  const { repo, rounds } = fixed('0.6.0', { lane: 'S' });
  const open = async (): Promise<string[]> => {
    const r = await run(['gate', 'done', 'T-1', '--json'], repo);
    return (JSON.parse(r.out).findings as Found[]).filter((f) => f.rule === 'gate.fix-outside-open').map((f) => f.reason ?? '');
  };
  try {
    rounds(PLACES + ADDRESSED, outsideLine('open', '', ' — test: export#writes-csv'));
    const refused = await run(['round', 'T-1'], repo);
    expect(refused.code).toBe(1);
    expect(refused.out).toContain('refused:');
    expect(refused.out).toContain('round 2');
    expect(refused.out).toContain('finding 1');
    const listed = await open();
    expect(listed).toHaveLength(1);
    expect(listed[0]).toContain('src/z.ts');

    rounds(PLACES + ADDRESSED, outsideLine('deferred', ''));
    writeFiles(repo, { [LEDGER]: DEFERRED_LINE });
    commitMsg(repo, 'T-1 ledger');
    expect(await open()).toEqual([]);
    const next = await run(['round', 'T-1'], repo);
    expect(next.out).toContain('Round: 3 of 5');
    expect(next.code).toBe(0);
  } finally {
    cleanup(repo);
  }
}, 240_000);
