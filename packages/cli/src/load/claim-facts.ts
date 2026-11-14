// ST-LN-91 D-15: the pin at a ticket's claim commit, the one host fact every Phase 3 rule reads through claimPinBefore (core).
// Every git error fails closed: `{ error }` makes the new rules apply.
import { execFileSync } from 'node:child_process';
import { pinOf, rulesetOfTicket } from '@accord-dev/accord-core';
import type { RepoSnapshot } from '@accord-dev/accord-core';
import { catBatch, defaultRefOf } from './fs.js';
import { claimCommitOf } from './research-facts.js';
import type { Claim } from './research-facts.js';
import { whyGit } from './round-facts.js';

/** The claim fact: the ClaimPin core reads, plus the claim commit's author time (seconds, kept by a rebase) the host reads for accord budget. */
export type ClaimFacts = { sha: string; time: number; pin?: string; basePin?: string; ruleset?: string } | { error: string };

const GIT = {
  encoding: 'utf8' as const,
  stdio: ['ignore', 'pipe', 'pipe'] as ['ignore', 'pipe', 'pipe'],
  maxBuffer: 64 * 1024 * 1024,
  env: { ...process.env, GIT_NO_LAZY_FETCH: '1' },
};

/**
 * The commit a ticket's claim pin is read at (ST-LN-91 D-15, WR-02, RR-CR-02, RR-IN-01): its `claim: <id>` commit, and only that. A ticket with no
 * such commit has no claim fact, so the working-tree pin decides and a ticket added under an older accord gets the new rules after the upgrade.
 * claimCommitOf (research-facts.ts, shared with the lane R research fact) picks it: the newest `claim: <id>` commit reachable from HEAD and not
 * from the default ref, else the newest one overall. Undefined with none of them.
 */
const claimCommit = (root: string, id: string, ref: string | undefined): Claim | undefined => claimCommitOf(root, id, ref)?.claim;

/**
 * ST-LN-91 D-15: the claim pin of `id`: the `accord:` pin of accord/config.yml at the claim commit, and at that commit's merge base with the
 * default ref (`basePin`, so a branch that lowers the pin and claims on it is still caught). Undefined when the ticket has no `claim: <id>` commit; `{ error }` on any
 * git failure, and when accord/config.yml cannot be read at the claim commit (a blob a blobless clone never fetched). The working-tree pin is never read here.
 * ST-LN-96 D-02: `ruleset` is the string `ruleset` the ticket file holds at the claim commit (a rebase replays the claim's content, so it survives where the config pin moves); absent when the file has none there.
 * ST-LN-94 D-11: `time` is the claim commit's author time in seconds (REVIEW2 WR-03: a rebase keeps it), read in the same log call; accord budget clocks a research ticket from it.
 */
export function gitClaimFacts(root: string, id: string): ClaimFacts | undefined {
  try {
    const ref = defaultRefOf(root);
    const claim = claimCommit(root, id, ref);
    if (claim === undefined) return undefined;
    const { sha, time } = claim;
    let base: string | undefined;
    if (ref !== undefined) {
      try {
        base = execFileSync('git', ['merge-base', sha, ref], { cwd: root, ...GIT }).trim().toLowerCase();
      } catch (e) {
        if ((e as { status?: number }).status !== 1) throw e; // exit 1 is no common commit
      }
    }
    // ST-LN-96 D-02: the ticket file at the claim commit rides in the same cat-file batch (one more blob, no more git processes); a missing one reads undefined.
    const texts = catBatch(root, [sha + ':accord/config.yml', sha + ':accord/tickets/' + id + '.md', ...(base === undefined || base === '' ? [] : [base + ':accord/config.yml'])], 'the claim pin');
    if (texts[0] === undefined) throw new Error(`accord/config.yml cannot be read at claim commit ${sha}`);
    const pin = pinOf(texts[0]);
    const ruleset = texts[1] === undefined ? undefined : rulesetOfTicket(texts[1]);
    const basePin = texts[2] === undefined ? undefined : pinOf(texts[2]);
    return { sha, time, ...(pin === undefined ? {} : { pin }), ...(basePin === undefined ? {} : { basePin }), ...(ruleset === undefined ? {} : { ruleset }) };
  } catch (e) {
    return { error: `git failed reading the claim pin of ${id}: ${whyGit(e)}` };
  }
}

/**
 * `snapshot` with claimPins[id] set, for the rules that read the claim pin; `snapshot` itself for a ticket that is unknown or has no lane, when the
 * snapshot has no HEAD, or when the ticket has no claim fact. ST-LN-96 D-02: lane S and lane R are served too, and `accord gate done` calls it, because
 * gate.ruleset-changed and gate.ruleset-missing read the claim fact in every gate and lane (a hand edit can happen at any stage).
 */
export function withClaimPins(root: string, snapshot: RepoSnapshot, id: string): RepoSnapshot {
  const lane = Object.hasOwn(snapshot.tickets, id) ? snapshot.tickets[id].frontmatter?.lane : undefined;
  if (lane === undefined || snapshot.git === undefined) return snapshot;
  const fact = gitClaimFacts(root, id);
  return fact === undefined ? snapshot : { ...snapshot, claimPins: { ...snapshot.claimPins, [id]: fact } };
}
