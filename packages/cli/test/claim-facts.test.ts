// ST-LN-91 D-15 on real git: which commit gitClaimFacts reads a ticket's claim pin at, and what it does when git fails.
import { chmodSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { claimPinBefore, DISCUSS_FROM, gateReady, loadSnapshot } from '@accord-dev/accord-core';
import type { RepoSnapshot } from '@accord-dev/accord-core';
import { gitClaimFacts, withClaimPins } from '../src/load/claim-facts.js';
import { whyGit } from '../src/load/round-facts.js';
import { cleanup, commitAll, commitMsg, gitRun, makeEmptyRepo, makeLaneRepo, mergeMsg, run, writeFiles } from './helpers/repo.js';
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

it('risk:regression a ticket added on a branch under 0.4.0 and never claimed gets the new rules (ST-LN-91 RR-CR-02)', () => {
  const repo = onMain('0.4.0', false);
  try {
    gitRun(repo, 'switch', '-q', '-c', 't/T-1');
    writeFiles(repo, { 'accord/tickets/T-1.md': TICKET });
    commitAll(repo, 'add T-1');
    writeFiles(repo, { 'accord/config.yml': pinned('0.4.1'), 'src/work.ts': 'export const w = 1;\n' });
    commitAll(repo, 'work after the upgrade');
    // No `claim: T-1` commit: the commit that added the ticket is no evidence of when work began, whatever branch it is on.
    expect(gitClaimFacts(repo, 'T-1')).toBeUndefined();
    const got = withClaimPins(repo, snapshotAt('0.4.1'), 'T-1');
    expect(got.claimPins).toBeUndefined();
    expect(claimPinBefore(got, 'T-1', DISCUSS_FROM)).toBe(false);
    expect(missing(got)).toHaveLength(1);
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
    commitAll(repo, 'add T-1');
    // `claim: T-10` is another ticket's claim; the body line `claim: T-1` is not a subject: T-1 has no claim commit at all.
    writeFiles(repo, { 'accord/config.yml': pinned('0.4.1') });
    commitMsg(repo, 'claim: T-10\n\nclaim: T-1');
    expect(gitClaimFacts(repo, 'T-1')).toBeUndefined();
    // The other way round: T-10 reads its own claim commit.
    expect(gitClaimFacts(repo, 'T-10')).toMatchObject({ pin: '0.4.1' });
  } finally {
    cleanup(repo);
  }
});

/** Remove one loose object, so git can no longer read it: a blob a blobless clone never fetched, or a commit lost from the history. */
const dropObject = (repo: string, sha: string): void => {
  const file = join(repo, '.git', 'objects', sha.slice(0, 2), sha.slice(2));
  chmodSync(file, 0o666);
  rmSync(file, { force: true });
};

it('risk:regression a git failure inside a real repository is an error fact on one line and fails closed with the git text shown (ST-LN-91 IN-05, WR-01, RR-WR-02)', async () => {
  const repo = onMain('0.4.0', true);
  try {
    const base = gitRun(repo, 'rev-parse', 'HEAD').trim();
    writeFiles(repo, { 'notes.txt': 'a draft\n' });
    commitMsg(repo, 'claim: T-1');
    // The claim commit's parent is gone: `git log` cannot walk to it, every other part of the repository still reads.
    dropObject(repo, base);
    const facts = gitClaimFacts(repo, 'T-1');
    expect(facts).toHaveProperty('error');
    const error = (facts as { error: string }).error;
    expect(error).toContain('git failed reading the claim pin of T-1: ');
    expect(error).toContain(base);
    expect(error).not.toContain('\n');
    const got = withClaimPins(repo, snapshotAt('0.4.0'), 'T-1');
    expect(got.claimPins).toEqual({ 'T-1': { error } });
    // Fail closed: the new rules apply although the working tree is still at 0.4.0, and the finding says why.
    expect(claimPinBefore(got, 'T-1', DISCUSS_FROM)).toBe(false);
    const f = missing(got);
    expect(f).toHaveLength(1);
    expect(f[0].reason).toContain(error);
    // The CLI takes the same path: it gets to the claim read, and says the same.
    const cli = await run(['gate', 'ready', 'T-1', '--json'], repo);
    expect(cli.code).toBe(1);
    expect((JSON.parse(cli.out).findings as { rule: string; reason: string }[]).filter((x) => x.rule === 'gate.discuss-missing')[0].reason).toContain(error);
  } finally {
    cleanup(repo);
  }
}, 120_000);

it('risk:regression a config blob missing at the claim commit is an error fact that names the claim commit (ST-LN-91 RR-WR-02)', () => {
  const repo = onMain('0.4.0', true);
  try {
    // A config of its own at the claim commit, so its blob is the claim's alone; a blobless clone holds the trees and not this blob.
    writeFiles(repo, { 'accord/config.yml': pinned('0.4.0') + '# claimed\n' });
    const claim = commitMsg(repo, 'claim: T-1');
    const blob = gitRun(repo, 'rev-parse', claim + ':accord/config.yml').trim();
    writeFiles(repo, { 'accord/config.yml': pinned('0.4.0'), 'notes.txt': 'work after the claim\n' });
    commitAll(repo, 'work');
    dropObject(repo, blob);
    const facts = gitClaimFacts(repo, 'T-1');
    expect(facts).toEqual({ error: `git failed reading the claim pin of T-1: accord/config.yml cannot be read at claim commit ${claim}` });
    const got = withClaimPins(repo, snapshotAt('0.4.0'), 'T-1');
    expect(claimPinBefore(got, 'T-1', DISCUSS_FROM)).toBe(false);
    expect(missing(got)[0].reason).toContain('cannot be read at claim commit ' + claim);
  } finally {
    cleanup(repo);
  }
});

it('risk:regression after the re-claim branch merges, the newest claim is still the claim (ST-LN-91 RR-IN-01)', () => {
  const repo = onMain('0.4.0', true);
  try {
    writeFiles(repo, { 'notes.txt': 'a draft\n' });
    commitMsg(repo, 'claim: T-1'); // under 0.4.0, on main
    gitRun(repo, 'switch', '-q', '-c', 't/T-1');
    writeFiles(repo, { 'accord/config.yml': pinned('0.4.1') });
    const reclaim = commitMsg(repo, 'claim: T-1');
    expect(gitClaimFacts(repo, 'T-1')).toMatchObject({ sha: reclaim, pin: '0.4.1' });
    gitRun(repo, 'switch', '-q', 'main');
    mergeMsg(repo, 't/T-1', 'Merge t/T-1');
    // From main every claim is reachable from the default ref; the facts do not flip back to the older claim.
    expect(gitClaimFacts(repo, 'T-1')).toMatchObject({ sha: reclaim, pin: '0.4.1' });
  } finally {
    cleanup(repo);
  }
});

it('risk:parsing the git text of a failure is one line, also when the error carries its own stderr (ST-LN-91 RR-WR-02)', () => {
  // catBatch throws `git cat-file failed reading <what>` and then git's stderr on the following lines.
  const two = new Error('git cat-file failed reading the claim pin\nfatal: unable to read sha1 file of 0a1b2c\n');
  expect(whyGit(two)).toBe('git cat-file failed reading the claim pin: fatal: unable to read sha1 file of 0a1b2c');
  // git's own stderr keeps its first non-blank line.
  expect(whyGit(Object.assign(new Error('Command failed'), { stderr: '\nfatal: bad object HEAD\nsecond line\n' }))).toBe('bad object HEAD');
});

// ST-LN-91 IN-02: the newest claim off the default ref is the claim; a test fails when step 1 of claimCommit takes the oldest again.
it('risk:regression with two claim commits on the working branch the newer one is the claim, whatever the commit dates say (ST-LN-91 IN-02)', () => {
  const repo = onMain('0.4.0', true);
  try {
    gitRun(repo, 'switch', '-q', '-c', 't/T-1');
    writeFiles(repo, { 'notes.txt': 'first claim\n' });
    const first = commitMsg(repo, 'claim: T-1'); // under 0.4.0
    writeFiles(repo, { 'accord/config.yml': pinned('0.4.1') });
    const second = commitMsg(repo, 'claim: T-1'); // the re-claim after the upgrade
    expect(second).not.toBe(first);
    expect(gitClaimFacts(repo, 'T-1')).toEqual({ sha: second, pin: '0.4.1', basePin: '0.4.0' });
    expect(missing(withClaimPins(repo, snapshotAt('0.4.1'), 'T-1'))).toHaveLength(1);

    // The same history with the re-claim dated before the first claim: ancestry, not the clock, says which is newer.
    const dated = onMain('0.4.0', true);
    try {
      gitRun(dated, 'switch', '-q', '-c', 't/T-1');
      writeFiles(dated, { 'notes.txt': 'first claim\n' });
      commitMsg(dated, 'claim: T-1');
      writeFiles(dated, { 'accord/config.yml': pinned('0.4.1') });
      const saved = { c: process.env.GIT_COMMITTER_DATE, a: process.env.GIT_AUTHOR_DATE };
      process.env.GIT_COMMITTER_DATE = process.env.GIT_AUTHOR_DATE = '2001-01-01T00:00:00Z';
      let later: string;
      try {
        later = commitMsg(dated, 'claim: T-1');
      } finally {
        if (saved.c === undefined) delete process.env.GIT_COMMITTER_DATE; else process.env.GIT_COMMITTER_DATE = saved.c;
        if (saved.a === undefined) delete process.env.GIT_AUTHOR_DATE; else process.env.GIT_AUTHOR_DATE = saved.a;
      }
      expect(gitClaimFacts(dated, 'T-1')).toEqual({ sha: later, pin: '0.4.1', basePin: '0.4.0' });
    } finally {
      cleanup(dated);
    }
  } finally {
    cleanup(repo);
  }
});
