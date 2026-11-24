// ST-LN-91 D-15: the pin at a ticket's claim commit, the one host fact every Phase 3 rule reads through claimPinBefore (core).
// Every git error fails closed: `{ error }` makes the new rules apply.
import { execFileSync } from 'node:child_process';
import { pinOf, rulesetOfTicket, subjectsFor } from '@accord-dev/accord-core';
import type { AccordConfig, RepoSnapshot } from '@accord-dev/accord-core';
import { catBatch, defaultRefOf } from './fs.js';
import { claimCommitOf } from './research-facts.js';
import type { Claim } from './research-facts.js';
import { whyGit } from './round-facts.js';

/** The claim fact: the ClaimPin core reads, plus the claim commit's author time (seconds, kept by a rebase) the host reads for accord budget. */
export type ClaimFacts = { sha: string; time: number; pin?: string; basePin?: string; ruleset?: string; rulesetCommit?: string } | { error: string };

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
 * from the default ref, else the newest one overall. Undefined with none of them. ST-LN-50 D-06: `claim` is the team's template (`commits.subjects.claim`) and every legacy one.
 */
const claimCommit = (root: string, id: string, ref: string | undefined, config: Pick<AccordConfig, 'commits'> | undefined): Claim | undefined => claimCommitOf(root, id, ref, 'HEAD', config)?.claim;

/**
 * ST-LN-96 D-02: the commits after `claim` (up to HEAD) that add or remove a `ruleset:` line of the ticket file `rel`, oldest first: one git process. The caller reads each one's blob and takes the
 * first that holds a `ruleset`. Literal pathspec, no shell, no signature output.
 */
function commitsWritingRuleset(root: string, claim: string, rel: string): string[] {
  const log = execFileSync(
    'git',
    ['-c', 'log.showSignature=false', 'log', '--no-show-signature', '--no-renames', '--topo-order', '--reverse', '--format=%H', '-G^ruleset:', claim + '..HEAD', '--', ':(literal)' + rel],
    { cwd: root, ...GIT },
  );
  return log.split(/\r?\n/).map((l) => l.trim().toLowerCase()).filter((l) => /^[0-9a-f]{40,64}$/.test(l));
}

/**
 * ST-LN-91 D-15: the claim pin of `id`: the `accord:` pin of accord/config.yml at the claim commit, and at that commit's merge base with the
 * default ref (`basePin`, so a branch that lowers the pin and claims on it is still caught). Undefined when the ticket has no `claim: <id>` commit; `{ error }` on any
 * git failure, and when accord/config.yml cannot be read at the claim commit (a blob a blobless clone never fetched). The working-tree pin is never read here.
 * ST-LN-96 D-02: `ruleset` is the string `ruleset` the ticket file FIRST held on this branch (a rebase replays that commit's content, so it survives where the config pin moves): the one at the
 * claim commit, else (a claim made before RULESET_FROM wrote none) the one in the first commit since the claim that wrote it, the sync-time backfill; `rulesetCommit` is that commit. Absent when no commit wrote one.
 * ST-LN-94 D-11: `time` is the claim commit's author time in seconds (REVIEW2 WR-03: a rebase keeps it), read in the same log call; accord budget clocks a research ticket from it.
 * ST-LN-50 D-06: `config` is the checkout's config, whose `commits.subjects.claim` and `commits.legacy_subjects.claim` name the claim subjects to look for; undefined looks for today's.
 */
export function gitClaimFacts(root: string, id: string, config?: Pick<AccordConfig, 'commits'>): ClaimFacts | undefined {
  try {
    const ref = defaultRefOf(root);
    const claim = claimCommit(root, id, ref, config);
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
    // ST-LN-96 D-02: the ticket file at the claim commit rides in the same cat-file batch (one more blob, no more git processes); a missing one reads undefined. The commits since
    // the claim that changed a `ruleset:` line come from one log call, oldest first, and their blobs ride in the same batch: the first that holds a `ruleset` is the backfill.
    const rel = 'accord/tickets/' + id + '.md';
    const wrote = commitsWritingRuleset(root, sha, rel);
    const specs = [sha + ':accord/config.yml', sha + ':' + rel, ...(base === undefined || base === '' ? [] : [base + ':accord/config.yml'])];
    const first = specs.length;
    const texts = catBatch(root, [...specs, ...wrote.map((w) => w + ':' + rel)], 'the claim pin');
    if (texts[0] === undefined) throw new Error(`accord/config.yml cannot be read at claim commit ${sha}`);
    const pin = pinOf(texts[0]);
    const basePin = base === undefined || base === '' || texts[2] === undefined ? undefined : pinOf(texts[2]);
    let ruleset = texts[1] === undefined ? undefined : rulesetOfTicket(texts[1]);
    let rulesetCommit = ruleset === undefined ? undefined : sha;
    for (let i = 0; ruleset === undefined && i < wrote.length; i++) {
      const text = texts[first + i];
      ruleset = text === undefined ? undefined : rulesetOfTicket(text);
      if (ruleset !== undefined) rulesetCommit = wrote[i];
    }
    return {
      sha,
      time,
      ...(pin === undefined ? {} : { pin }),
      ...(basePin === undefined ? {} : { basePin }),
      ...(ruleset === undefined ? {} : { ruleset, rulesetCommit: rulesetCommit! }),
    };
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
  const fact = gitClaimFacts(root, id, snapshot.config);
  return fact === undefined ? snapshot : { ...snapshot, claimPins: { ...snapshot.claimPins, [id]: fact } };
}

/** One commit of the whole-history log gitClaimFactsMany reads: its sha, author time and parents (a root commit has none). */
interface Hit {
  sha: string;
  time: number;
  parents: string[];
}

/** The answer gitClaimFactsMany keeps per id before it reads the rest: a claim, no claim, or `read` (claimCommitOf must choose, see claimsFromLog). */
type Chosen = Claim | undefined | 'read';

/**
 * Phase 08.9 D-02, D-03: which claim commit each id has, from one log of the whole history of HEAD and (with a default ref) one `rev-list` of that ref: two git processes for any number of ids.
 * claimCommitOf's answer is the last `claim: <id>` commit of HEAD outside the default ref, else the last one overall; both are the last hit of a topological log. A filtered log and the whole-history
 * one order two commits that are not ancestor-related differently (RESEARCH Pitfall 2), so the last hit counts only when it descends from every other hit of the same set (a descendant comes
 * after its ancestors in every topological order); otherwise that id is `read` alone by claimCommitOf. No `--grep` here: a subject counts by exact equality with subjectsFor, as claimsOf compares it.
 */
function claimsFromLog(root: string, ids: readonly string[], ref: string | undefined, config: Pick<AccordConfig, 'commits'> | undefined): Map<string, Chosen> {
  const byId = new Map<string, Hit[]>(ids.map((id) => [id, []]));
  const bySubject = new Map<string, string[]>();
  for (const id of ids) {
    for (const subject of subjectsFor(config, 'claim', id)) bySubject.set(subject, [...(bySubject.get(subject) ?? []), id]);
  }
  const log = execFileSync(
    'git',
    ['-c', 'log.showSignature=false', 'log', '--no-show-signature', '--topo-order', '--reverse', '--format=%H%x00%P%x00%at%x00%s', 'HEAD'],
    { cwd: root, ...GIT },
  );
  const rows: string[][] = [];
  for (const line of log.split('\n')) {
    const fields = line.split('\0');
    if (fields.length !== 4) continue;
    rows.push(fields);
    const named = bySubject.get(fields[3]);
    if (named === undefined) continue;
    const hit: Hit = { sha: fields[0].toLowerCase(), time: Number(fields[2]), parents: fields[1].split(' ').filter((p) => p !== '').map((p) => p.toLowerCase()) };
    for (const id of named) byId.get(id)!.push(hit);
  }
  const onRef = ref === undefined ? undefined : new Set(execFileSync('git', ['rev-list', ref], { cwd: root, ...GIT }).split('\n').map((l) => l.trim().toLowerCase()).filter((l) => l !== ''));
  let parentsOf: Map<string, string[]> | undefined;
  const descendsFromAll = (last: Hit, others: Hit[]): boolean => {
    parentsOf ??= new Map(rows.map((r) => [r[0].toLowerCase(), r[1].split(' ').filter((p) => p !== '').map((p) => p.toLowerCase())]));
    const missing = new Set(others.map((h) => h.sha));
    const seen = new Set<string>([last.sha]);
    const stack = [...last.parents];
    while (missing.size > 0 && stack.length > 0) {
      const next = stack.pop()!;
      if (seen.has(next)) continue;
      seen.add(next);
      missing.delete(next);
      stack.push(...(parentsOf.get(next) ?? []));
    }
    return missing.size === 0;
  };
  const chosen = new Map<string, Chosen>();
  for (const id of ids) {
    const all = byId.get(id)!;
    const off = onRef === undefined ? all : all.filter((h) => !onRef.has(h.sha));
    const set = off.length > 0 ? off : all;
    if (set.length === 0) {
      chosen.set(id, undefined);
      continue;
    }
    const last = set[set.length - 1];
    chosen.set(id, set.length === 1 || descendsFromAll(last, set.slice(0, -1)) ? { sha: last.sha, time: last.time } : 'read');
  }
  return chosen;
}

/**
 * Phase 08.9 D-02, D-03, D-04: gitClaimFacts for many ids at once, for `accord audit`'s deferred-marks report. For every id the value is exactly what gitClaimFacts(root, id, config) returns, `{ error }`
 * and undefined (no claim commit) included, and gitClaimFacts, commitsWritingRuleset, claimsOf and claimCommitOf stay untouched as its oracle. The claim commits of all ids come from one log (claimsFromLog;
 * the order rule is its doc comment's); the rest of each ticket's read is today's, with its own try/catch, so one unreadable ticket never changes another's answer (RESEARCH Pitfall 6). When a step all ids share
 * fails, every id gets gitClaimFacts's own answer, never a partial or different one. Every git value lives in locals of this call: nothing is kept between calls or runs.
 */
export function gitClaimFactsMany(root: string, ids: readonly string[], config?: Pick<AccordConfig, 'commits'>): Map<string, ClaimFacts | undefined> {
  const facts = new Map<string, ClaimFacts | undefined>();
  if (ids.length === 0) return facts;
  let ref: string | undefined;
  let chosen: Map<string, Chosen>;
  try {
    ref = defaultRefOf(root);
    chosen = claimsFromLog(root, ids, ref, config);
  } catch {
    for (const id of ids) facts.set(id, gitClaimFacts(root, id, config));
    return facts;
  }
  for (const id of ids) {
    try {
      const picked = chosen.get(id)!;
      const claim = picked === 'read' ? claimCommit(root, id, ref, config) : picked;
      facts.set(id, claim === undefined ? undefined : claimFactsAt(root, id, ref, claim));
    } catch (e) {
      facts.set(id, { error: `git failed reading the claim pin of ${id}: ${whyGit(e)}` });
    }
  }
  return facts;
}

/** The rest of gitClaimFacts's read for one ticket whose claim commit is known (claim-facts.ts, the body of gitClaimFacts from its merge base on); throws where it throws, and the caller turns that into `{ error }`. */
function claimFactsAt(root: string, id: string, ref: string | undefined, claim: Claim): ClaimFacts {
  const { sha, time } = claim;
  let base: string | undefined;
  if (ref !== undefined) {
    try {
      base = execFileSync('git', ['merge-base', sha, ref], { cwd: root, ...GIT }).trim().toLowerCase();
    } catch (e) {
      if ((e as { status?: number }).status !== 1) throw e; // exit 1 is no common commit
    }
  }
  const rel = 'accord/tickets/' + id + '.md';
  const wrote = commitsWritingRuleset(root, sha, rel);
  const specs = [sha + ':accord/config.yml', sha + ':' + rel, ...(base === undefined || base === '' ? [] : [base + ':accord/config.yml'])];
  const first = specs.length;
  const texts = catBatch(root, [...specs, ...wrote.map((w) => w + ':' + rel)], 'the claim pin');
  if (texts[0] === undefined) throw new Error(`accord/config.yml cannot be read at claim commit ${sha}`);
  const pin = pinOf(texts[0]);
  const basePin = base === undefined || base === '' || texts[2] === undefined ? undefined : pinOf(texts[2]);
  let ruleset = texts[1] === undefined ? undefined : rulesetOfTicket(texts[1]);
  let rulesetCommit = ruleset === undefined ? undefined : sha;
  for (let i = 0; ruleset === undefined && i < wrote.length; i++) {
    const text = texts[first + i];
    ruleset = text === undefined ? undefined : rulesetOfTicket(text);
    if (ruleset !== undefined) rulesetCommit = wrote[i];
  }
  return {
    sha,
    time,
    ...(pin === undefined ? {} : { pin }),
    ...(basePin === undefined ? {} : { basePin }),
    ...(ruleset === undefined ? {} : { ruleset, rulesetCommit: rulesetCommit! }),
  };
}
