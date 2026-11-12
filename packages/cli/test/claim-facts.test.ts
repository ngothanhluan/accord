// ST-LN-91 D-15 on real git: which commit gitClaimFacts reads a ticket's claim pin at, and what it does when git fails.
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { claimPinBefore, DISCUSS_FROM, gateReady, loadSnapshot } from '@accord-dev/accord-core';
import type { RepoSnapshot } from '@accord-dev/accord-core';
import { gitClaimFacts, withClaimPins } from '../src/load/claim-facts.js';
import { cleanup, commitAll, commitMsg, gitRun, makeEmptyRepo, makeLaneRepo, writeFiles } from './helpers/repo.js';
import { CONFIG, laneTicket } from '../../../test/helpers/lane.js';

const pinned = (v: string): string => CONFIG.replace(/accord: "[^"]*"/, `accord: "${v}"`);
const TICKET = laneTicket('T-1');

/** The snapshot a CLI running at `pin` would load for the repository: its config pin, the ticket, and a HEAD fact so withClaimPins reads git. */
const snapshotAt = (pin: string): RepoSnapshot => {
  const files = { 'accord/config.yml': pinned(pin), 'accord/tickets/T-1.md': TICKET };
  return { ...loadSnapshot({ files, tree: Object.keys(files) }), git: { commit: 'HEAD', authors: {} } };
};
const missing = (s: RepoSnapshot) => gateReady(s, 'T-1').findings.filter((f) => f.rule === 'gate.discuss-missing');

/** A repository whose main holds the config at `pin`, with the ticket queued on it when `queued`. */
function onMain(pin: string, queued: boolean): string {
  const repo = queued ? makeLaneRepo() : makeEmptyRepo();
  writeFiles(repo, { 'accord/config.yml': pinned(pin) });
  commitAll(repo, queued ? 'backlog: queue T-1' : 'base');
  gitRun(repo, 'branch', '-M', 'main');
  return repo;
}

it('risk:regression a ticket queued on main under 0.4.0 and worked after the upgrade with no claim commit gets the new rules (ST-LN-91 WR-02)', () => {
  const repo = onMain('0.4.0', true);
  try {
    gitRun(repo, 'switch', '-q', '-c', 't/T-1'); // a plain branch, not accord pickup: no `claim:` commit
    writeFiles(repo, { 'accord/config.yml': pinned('0.4.1'), 'src/work.ts': 'export const w = 1;\n' });
    commitAll(repo, 'work after the upgrade');
    // The add commit sits on main, so it is no evidence of when the ticket was started: no claim fact.
    expect(gitClaimFacts(repo, 'T-1')).toBeUndefined();
    // The CLI at 0.4.1 then reads the working-tree pin, and the discuss rule applies.
    const got = withClaimPins(repo, snapshotAt('0.4.1'), 'T-1');
    expect(got.claimPins).toBeUndefined();
    expect(claimPinBefore(got, 'T-1', DISCUSS_FROM)).toBe(false);
    expect(missing(got)).toHaveLength(1);
  } finally {
    cleanup(repo);
  }
});

it('risk:regression a ticket added on a branch under 0.4.0 keeps the old rules until it is claimed (ST-LN-91 WR-02)', () => {
  const repo = onMain('0.4.0', false);
  try {
    gitRun(repo, 'switch', '-q', '-c', 't/T-1');
    writeFiles(repo, { 'accord/tickets/T-1.md': TICKET });
    const added = commitAll(repo, 'add T-1');
    writeFiles(repo, { 'accord/config.yml': pinned('0.4.1'), 'src/work.ts': 'export const w = 1;\n' });
    commitAll(repo, 'work after the upgrade');
    // Not reachable from main: its commit is the evidence, so the pin at it (0.4.0) decides.
    expect(gitClaimFacts(repo, 'T-1')).toEqual({ sha: added, pin: '0.4.0', basePin: '0.4.0' });
    expect(missing(withClaimPins(repo, snapshotAt('0.4.1'), 'T-1'))).toEqual([]);
  } finally {
    cleanup(repo);
  }
});

it('risk:regression the claim commit off the default branch outranks an older one that reached it (ST-LN-91 WR-02)', () => {
  const repo = onMain('0.4.0', true);
  try {
    // A 0.4.0 claim commit that reached main, then the ticket re-claimed on a working branch after the upgrade.
    writeFiles(repo, { 'notes.txt': 'a draft\n' });
    commitMsg(repo, 'claim: T-1');
    gitRun(repo, 'switch', '-q', '-c', 't/T-1');
    writeFiles(repo, { 'accord/config.yml': pinned('0.4.1') });
    const claim = commitMsg(repo, 'claim: T-1');
    writeFiles(repo, { 'src/work.ts': 'export const w = 1;\n' });
    commitAll(repo, 'work');
    expect(gitClaimFacts(repo, 'T-1')).toEqual({ sha: claim, pin: '0.4.1', basePin: '0.4.0' });
    expect(missing(withClaimPins(repo, snapshotAt('0.4.1'), 'T-1'))).toHaveLength(1);
  } finally {
    cleanup(repo);
  }
});

it('risk:regression a claim commit merged into main is still the claim after the ticket is done (ST-LN-91 WR-02)', () => {
  const repo = onMain('0.4.0', true);
  try {
    writeFiles(repo, { 'notes.txt': 'a draft\n' });
    const claim = commitMsg(repo, 'claim: T-1');
    writeFiles(repo, { 'accord/config.yml': pinned('0.4.1') });
    commitAll(repo, 'upgrade');
    expect(gitClaimFacts(repo, 'T-1')).toMatchObject({ sha: claim, pin: '0.4.0' });
    expect(missing(withClaimPins(repo, snapshotAt('0.4.1'), 'T-1'))).toEqual([]);
  } finally {
    cleanup(repo);
  }
});

it('risk:parsing a near-miss claim subject or a claim line in a body is not the claim (ST-LN-91 IN-05)', () => {
  const repo = onMain('0.4.0', false);
  try {
    gitRun(repo, 'switch', '-q', '-c', 't/T-1');
    writeFiles(repo, { 'accord/tickets/T-1.md': TICKET });
    const added = commitAll(repo, 'add T-1');
    // `claim: T-10` is another ticket's claim; the body line `claim: T-1` is not a subject. Both commits hold the cut-off pin.
    writeFiles(repo, { 'accord/config.yml': pinned('0.4.1') });
    commitMsg(repo, 'claim: T-10\n\nclaim: T-1');
    expect(gitClaimFacts(repo, 'T-1')).toEqual({ sha: added, pin: '0.4.0', basePin: '0.4.0' });
    // The other way round: T-10 reads its own claim commit.
    expect(gitClaimFacts(repo, 'T-10')).toMatchObject({ pin: '0.4.1' });
  } finally {
    cleanup(repo);
  }
});

it('risk:regression a git failure reading the claim pin is an error fact and fails closed with the git text shown (ST-LN-91 IN-05, WR-01)', () => {
  // Not a repository: every git call fails.
  const nowhere = mkdtempSync(join(tmpdir(), 'accord-nogit-'));
  try {
    const facts = gitClaimFacts(nowhere, 'T-1');
    expect(facts).toBeDefined();
    expect(facts).toHaveProperty('error');
    const error = (facts as { error: string }).error;
    expect(error).toContain('git failed reading the claim pin of T-1');
    const got = withClaimPins(nowhere, snapshotAt('0.4.0'), 'T-1');
    expect(got.claimPins).toEqual({ 'T-1': { error } });
    // Fail closed: the new rules apply although the working tree is still at 0.4.0, and the finding says why.
    expect(claimPinBefore(got, 'T-1', DISCUSS_FROM)).toBe(false);
    const f = missing(got);
    expect(f).toHaveLength(1);
    expect(f[0].reason).toContain(error);
  } finally {
    cleanup(nowhere);
  }
});
