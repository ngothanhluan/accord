// ST-LN-91 D-15: the pin at a ticket's claim commit, the one host fact every Phase 3 rule reads through claimPinBefore (core).
// Every git error fails closed: `{ error }` makes the new rules apply.
import { execFileSync } from 'node:child_process';
import { pinOf } from '@accord-dev/accord-core';
import type { ClaimPin, RepoSnapshot } from '@accord-dev/accord-core';
import { catBatch, defaultRefOf } from './fs.js';
import { whyGit } from './round-facts.js';

const GIT = {
  encoding: 'utf8' as const,
  stdio: ['ignore', 'pipe', 'pipe'] as ['ignore', 'pipe', 'pipe'],
  maxBuffer: 64 * 1024 * 1024,
  env: { ...process.env, GIT_NO_LAZY_FETCH: '1' },
};

/** The commits reachable from HEAD (and not from the `notIn` refs) whose subject is exactly `claim: <id>`, oldest first (topological: a claim is never listed before its ancestor, whatever the commit dates). */
function claimsOf(root: string, id: string, notIn: string[]): string[] {
  const claim = 'claim: ' + id;
  // `--grep` only narrows the log (it also matches `claim: <id>0` and a body line), so the subject is compared exactly.
  const log = execFileSync(
    'git',
    ['-c', 'log.showSignature=false', 'log', '--no-show-signature', '--fixed-strings', '--grep=' + claim, '--topo-order', '--reverse', '--format=%H %s', 'HEAD', ...notIn],
    { cwd: root, ...GIT },
  );
  const hits: string[] = [];
  for (const line of log.split('\n')) {
    const space = line.indexOf(' ');
    if (space > 0 && line.slice(space + 1) === claim) hits.push(line.slice(0, space).toLowerCase());
  }
  return hits;
}

/**
 * The commit a ticket's claim pin is read at (ST-LN-91 D-15, WR-02, RR-CR-02, RR-IN-01): its `claim: <id>` commit, and only that. A ticket with no
 * such commit has no claim fact, so the working-tree pin decides and a ticket added under an older accord gets the new rules after the upgrade.
 * 1. The newest `claim: <id>` commit reachable from HEAD and not from the default ref `ref` (no `--first-parent`: a merged pull request holds
 *    it on the second-parent side), so a claim commit that reached the default branch never outranks the re-claim on the working branch.
 * 2. Else the newest `claim: <id>` commit overall (the branch was merged: the re-claim is still the claim, as it was on the branch).
 * Undefined with none of them.
 */
function claimCommit(root: string, id: string, ref: string | undefined): string | undefined {
  const off = claimsOf(root, id, ref === undefined ? [] : ['--not', ref]);
  if (off.length > 0) return off[off.length - 1];
  const any = ref === undefined ? [] : claimsOf(root, id, []);
  return any.length > 0 ? any[any.length - 1] : undefined;
}

/**
 * ST-LN-91 D-15: the claim pin of `id`: the `accord:` pin of accord/config.yml at the claim commit, and at that commit's merge base with the
 * default ref (`basePin`, so a branch that lowers the pin and claims on it is still caught). Undefined when the ticket has no `claim: <id>` commit; `{ error }` on any
 * git failure, and when accord/config.yml cannot be read at the claim commit (a blob a blobless clone never fetched). The working-tree pin is never read here.
 */
export function gitClaimFacts(root: string, id: string): ClaimPin | undefined {
  try {
    const ref = defaultRefOf(root);
    const sha = claimCommit(root, id, ref);
    if (sha === undefined) return undefined;
    let base: string | undefined;
    if (ref !== undefined) {
      try {
        base = execFileSync('git', ['merge-base', sha, ref], { cwd: root, ...GIT }).trim().toLowerCase();
      } catch (e) {
        if ((e as { status?: number }).status !== 1) throw e; // exit 1 is no common commit
      }
    }
    const texts = catBatch(root, [sha + ':accord/config.yml', ...(base === undefined || base === '' ? [] : [base + ':accord/config.yml'])], 'the claim pin');
    if (texts[0] === undefined) throw new Error(`accord/config.yml cannot be read at claim commit ${sha}`);
    const pin = pinOf(texts[0]);
    const basePin = texts[1] === undefined ? undefined : pinOf(texts[1]);
    return { sha, ...(pin === undefined ? {} : { pin }), ...(basePin === undefined ? {} : { basePin }) };
  } catch (e) {
    return { error: `git failed reading the claim pin of ${id}: ${whyGit(e)}` };
  }
}

/**
 * `snapshot` with claimPins[id] set, for the discuss rule of `accord gate ready`; `snapshot` itself for a ticket that is unknown, has no lane
 * or is lane S (the rule never asks it), when the snapshot has no HEAD, or when the ticket has no claim fact.
 */
export function withClaimPins(root: string, snapshot: RepoSnapshot, id: string): RepoSnapshot {
  const lane = Object.hasOwn(snapshot.tickets, id) ? snapshot.tickets[id].frontmatter?.lane : undefined;
  if (lane === undefined || lane === 'S' || snapshot.git === undefined) return snapshot;
  const fact = gitClaimFacts(root, id);
  return fact === undefined ? snapshot : { ...snapshot, claimPins: { ...snapshot.claimPins, [id]: fact } };
}
