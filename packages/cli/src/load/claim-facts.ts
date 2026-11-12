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

/**
 * The oldest commit reachable from HEAD whose subject is exactly `claim: <id>` (no `--first-parent`: a merged pull request holds it on the
 * second-parent side); with none, the oldest commit that added `accord/tickets/<id>.md`; undefined with neither. `--grep` only narrows the
 * log (it also matches `claim: <id>0` and a body line), so the subject is compared exactly.
 */
function claimCommit(root: string, id: string): string | undefined {
  const claim = 'claim: ' + id;
  const log = execFileSync(
    'git',
    ['-c', 'log.showSignature=false', 'log', '--no-show-signature', '--fixed-strings', '--grep=' + claim, '--reverse', '--format=%H %s', 'HEAD'],
    { cwd: root, ...GIT },
  );
  for (const line of log.split('\n')) {
    const space = line.indexOf(' ');
    if (space > 0 && line.slice(space + 1) === claim) return line.slice(0, space).toLowerCase();
  }
  const added = execFileSync(
    'git',
    [
      '-c', 'core.quotePath=false', '-c', 'log.showSignature=false', 'log', '--no-show-signature', '--diff-filter=A', '--reverse',
      '--format=%H', 'HEAD', '--', `:(literal)accord/tickets/${id}.md`,
    ],
    { cwd: root, ...GIT },
  );
  return added.split('\n').find((l) => l.trim() !== '')?.trim().toLowerCase();
}

/**
 * ST-LN-91 D-15: the claim pin of `id`: the `accord:` pin of accord/config.yml at the claim commit, and at that commit's merge base with the
 * default ref (`basePin`, so a branch that lowers the pin and claims on it is still caught). Undefined when the ticket has no claim commit and
 * no commit that added it (or HEAD has no history to read); `{ error }` on any git failure. The working-tree pin is never read here.
 */
export function gitClaimFacts(root: string, id: string): ClaimPin | undefined {
  try {
    const sha = claimCommit(root, id);
    if (sha === undefined) return undefined;
    const ref = defaultRefOf(root);
    let base: string | undefined;
    if (ref !== undefined) {
      try {
        base = execFileSync('git', ['merge-base', sha, ref], { cwd: root, ...GIT }).trim().toLowerCase();
      } catch (e) {
        if ((e as { status?: number }).status !== 1) throw e; // exit 1 is no common commit
      }
    }
    const texts = catBatch(root, [sha + ':accord/config.yml', ...(base === undefined || base === '' ? [] : [base + ':accord/config.yml'])], 'the claim pin');
    const pin = texts[0] === undefined ? undefined : pinOf(texts[0]);
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
