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
 * `onRef` is the set of commits of the default ref (undefined with no default ref): a claim in it is its own merge base with the ref. `graph` maps every commit of HEAD to its parents, oldest first (the order of this log), for rulesetCommitsMany.
 */
function claimsFromLog(
  root: string,
  ids: readonly string[],
  ref: string | undefined,
  config: Pick<AccordConfig, 'commits'> | undefined,
): { chosen: Map<string, Chosen>; onRef: Set<string> | undefined; graph: Map<string, string[]> } {
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
  const graph = new Map<string, string[]>(rows.map((r): [string, string[]] => [r[0].toLowerCase(), r[1].split(' ').filter((p) => p !== '').map((p) => p.toLowerCase())]));
  const descendsFromAll = (last: Hit, others: Hit[]): boolean => {
    const missing = new Set(others.map((h) => h.sha));
    const seen = new Set<string>([last.sha]);
    const stack = [...last.parents];
    while (missing.size > 0 && stack.length > 0) {
      const next = stack.pop()!;
      if (seen.has(next)) continue;
      seen.add(next);
      missing.delete(next);
      stack.push(...(graph.get(next) ?? []));
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
  return { chosen, onRef, graph };
}

/** What gitClaimFactsMany keeps per ticket between its merge base and the batched ruleset log: its claim and merge base. */
interface Claimed {
  id: string;
  sha: string;
  time: number;
  base: string | undefined;
  rel: string;
}

/** What gitClaimFactsMany keeps per ticket between the batched ruleset log and the one cat-file batch: the claim and the blobs it asked for, in order. */
interface Pending {
  id: string;
  sha: string;
  time: number;
  hasBase: boolean;
  wrote: string[];
  specs: string[];
}

/**
 * Phase 08.9 D-02, D-03, D-04: gitClaimFacts for many ids at once, for `accord audit`'s deferred-marks report. For every id the value is exactly what gitClaimFacts(root, id, config) returns, `{ error }`
 * and undefined (no claim commit) included, and gitClaimFacts, commitsWritingRuleset, claimsOf and claimCommitOf stay untouched as its oracle. The claim commits of all ids come from one log (claimsFromLog;
 * the order rule is its doc comment's). A claim in the default ref's ancestor set is its own merge base with the ref (exact only for an ancestor, RESEARCH Pitfall 5); any other claim keeps
 * `git merge-base`, exit 1 read as no base, never reused across tickets. Every ticket's blobs (config and ticket file at the claim, config at the base, the commits that wrote a `ruleset:` line) ride one
 * `cat-file --batch`, sliced back per ticket; the ruleset backfill of every ticket with a claim comes from one rulesetCommitsMany call (one log per `chunk` ticket paths, 08.9-05). A ticket whose own read fails gets `{ error }` with gitClaimFacts's text and no other ticket changes (RESEARCH Pitfall 6).
 * When a step all ids share fails (the log, rev-list, the cat-file batch), every id gets gitClaimFacts's own answer, never a partial or different one. Every git value lives in locals of this call: nothing is kept between calls or runs.
 */
export function gitClaimFactsMany(root: string, ids: readonly string[], config?: Pick<AccordConfig, 'commits'>, chunk = RULESET_PATHS_PER_LOG): Map<string, ClaimFacts | undefined> {
  const facts = new Map<string, ClaimFacts | undefined>();
  if (ids.length === 0) return facts;
  const eachOnItsOwn = (): Map<string, ClaimFacts | undefined> => new Map(ids.map((id) => [id, gitClaimFacts(root, id, config)]));
  const failed = (id: string, e: unknown): ClaimFacts => ({ error: `git failed reading the claim pin of ${id}: ${whyGit(e)}` });
  let ref: string | undefined;
  let found: ReturnType<typeof claimsFromLog>;
  try {
    ref = defaultRefOf(root);
    found = claimsFromLog(root, ids, ref, config);
  } catch {
    return eachOnItsOwn();
  }
  const claimed: Claimed[] = [];
  for (const id of ids) {
    try {
      const picked = found.chosen.get(id)!;
      const claim = picked === 'read' ? claimCommit(root, id, ref, config) : picked;
      if (claim === undefined) {
        facts.set(id, undefined);
        continue;
      }
      const { sha, time } = claim;
      let base: string | undefined;
      if (ref !== undefined) {
        if (found.onRef!.has(sha)) base = sha;
        else {
          try {
            base = execFileSync('git', ['merge-base', sha, ref], { cwd: root, ...GIT }).trim().toLowerCase();
          } catch (e) {
            if ((e as { status?: number }).status !== 1) throw e; // exit 1 is no common commit
          }
        }
      }
      claimed.push({ id, sha, time, base, rel: 'accord/tickets/' + id + '.md' });
    } catch (e) {
      facts.set(id, failed(id, e));
    }
  }
  // Phase 08.9 D-02: the commits since each claim that wrote a `ruleset:` line come from one batched read for every ticket with a claim; a failure of it is a failure of a shared step
  let wroteBy: Map<string, string[]>;
  try {
    wroteBy = rulesetCommitsMany(root, found.graph, [...new Map(claimed.map((c) => [c.rel, { rel: c.rel, claim: c.sha }])).values()], chunk);
  } catch {
    return eachOnItsOwn();
  }
  const pending: Pending[] = claimed.map(({ id, sha, time, base, rel }) => {
    const wrote = wroteBy.get(rel)!;
    const hasBase = base !== undefined && base !== '';
    return { id, sha, time, hasBase, wrote, specs: [sha + ':accord/config.yml', sha + ':' + rel, ...(hasBase ? [base + ':accord/config.yml'] : []), ...wrote.map((w) => w + ':' + rel)] };
  });
  let texts: (string | undefined)[];
  try {
    texts = pending.length === 0 ? [] : catBatch(root, pending.flatMap((p) => p.specs), 'the claim pin');
  } catch {
    return eachOnItsOwn();
  }
  let at = 0;
  for (const p of pending) {
    const mine = Array.from({ length: p.specs.length }, (_, i) => texts[at + i]);
    at += p.specs.length;
    try {
      facts.set(p.id, claimFactsFrom(p, mine));
    } catch (e) {
      facts.set(p.id, failed(p.id, e));
    }
  }
  return new Map(ids.map((id) => [id, facts.get(id)]));
}

/** Phase 08.9 D-02 (T-08.9-14): ticket paths per ruleset log, so the pathspec list stays far below Windows' command line cap of about 32 K characters. */
export const RULESET_PATHS_PER_LOG = 200;

const SHA_RE = /^[0-9a-f]{40,64}$/;
/** A ticket path rulesetCommitsMany accepts: the characters git prints unquoted, so a name in `--name-only` output is compared by exact equality. Anything else is handed back to the per-ticket log. */
const SAFE_REL_RE = /^[A-Za-z0-9._/-]+$/;

/**
 * Phase 08.9 D-02, D-03: what the one-path log of commitsWritingRuleset lists for one ticket file, replayed over the parent graph with no git process; the pure half of rulesetCommitsMany, kept apart so the
 * draft creators of 08.9-06 can reuse it. `graph` maps every commit reachable from HEAD to its parents, oldest first as `git log --topo-order --reverse` gives them (that order breaks ties between commits
 * that are not ancestor-related); `head` is HEAD's commit, `claim` the range's bottom, `ancestors` the claim and everything reachable from it, `wrote` the commits whose diff for this one file adds or removes a
 * `ruleset:` line (a merge is never in it: `-G` lists no merge), and `changed(merge, parent)` tells whether the file differs between that merge and that parent.
 * git's default history simplification for one path, as the one-path log walks it from HEAD inside `claim..HEAD`: a merge that is the same for the file as one of its parents is followed through the first such
 * parent only, so the other side's commits are not listed even when they wrote the line (a many-path walk would list them); the claim, the bottom of the range, counts as such a parent. The result is the walked
 * commits of `wrote`, oldest first. It is undefined when git's answer cannot be told from the graph: a merge the same as a parent that lies before the claim (strictly older than it), where git's walk follows that
 * parent alone or not depending on how far its marking of the excluded side has got, which varies with its traversal order. The caller reads that ticket with the one-path log.
 */
export function onePathCommits(
  graph: ReadonlyMap<string, readonly string[]>,
  head: string,
  claim: string,
  ancestors: ReadonlySet<string>,
  wrote: ReadonlySet<string>,
  changed: (merge: string, parent: string) => boolean,
): string[] | undefined {
  const listed = new Set<string>();
  const seen = new Set<string>();
  const stack = [head];
  while (stack.length > 0) {
    const sha = stack.pop()!;
    if (seen.has(sha) || ancestors.has(sha)) continue;
    seen.add(sha);
    if (wrote.has(sha)) listed.add(sha);
    const parents = graph.get(sha) ?? [];
    let followed = parents;
    if (parents.length > 1) {
      for (const parent of parents) {
        if (changed(sha, parent)) continue;
        if (parent !== claim && ancestors.has(parent)) return undefined;
        followed = [parent];
        break;
      }
    }
    stack.push(...followed);
  }
  return listed.size < 2 ? [...listed] : [...graph.keys()].filter((sha) => listed.has(sha));
}

/**
 * Phase 08.9 D-02, D-03, D-04: for every ticket `{ rel, claim }`, exactly the list commitsWritingRuleset(root, claim, rel) returns (the commits after the claim that add or remove a `ruleset:` line of the ticket file, oldest
 * first), from one `git log -G^ruleset: --full-history` per `chunk` ticket paths and one `git diff-tree` for the merges, with the one-path log's history simplification replayed in JS (onePathCommits). The log lists
 * the candidate commits of all paths in the chunk and the file each one wrote a line into; the diff-tree says, for each merge and parent, which of those files differ between them, which is what git's per-file
 * simplification reads. A ticket onePathCommits cannot decide, and a ticket path with a character git would quote, are read with the one-path log itself (one process for that ticket alone). `graph` is the parent
 * graph of every commit reachable from HEAD, oldest first (see onePathCommits). Throws when a step fails or prints an unexpected line; the caller answers every ticket with gitClaimFacts. Every value lives in locals of this call.
 */
export function rulesetCommitsMany(
  root: string,
  graph: ReadonlyMap<string, readonly string[]>,
  claims: readonly { rel: string; claim: string }[],
  chunk = RULESET_PATHS_PER_LOG,
): Map<string, string[]> {
  const answers = new Map<string, string[]>();
  if (claims.length === 0) return answers;
  if (!Number.isInteger(chunk) || chunk < 1) throw new Error(`rulesetCommitsMany: a chunk of ${chunk} paths`);
  const named = new Set<string>();
  for (const { rel, claim } of claims) {
    if (!SHA_RE.test(claim) || !graph.has(claim)) throw new Error(`rulesetCommitsMany: claim ${claim} is not in the history of HEAD`);
    if (named.has(rel)) throw new Error(`rulesetCommitsMany: ${rel} is asked twice`);
    named.add(rel);
  }
  const isParent = new Set<string>();
  for (const parents of graph.values()) for (const parent of parents) isParent.add(parent);
  const tips = [...graph.keys()].filter((sha) => !isParent.has(sha));
  if (tips.length !== 1) throw new Error(`rulesetCommitsMany: ${tips.length} tips in the parent graph`);
  const head = tips[0];
  const ancestorsOf = new Map<string, Set<string>>();
  for (const { claim } of claims) {
    if (ancestorsOf.has(claim)) continue;
    const seen = new Set<string>();
    const stack = [claim];
    while (stack.length > 0) {
      const sha = stack.pop()!;
      if (seen.has(sha)) continue;
      seen.add(sha);
      stack.push(...(graph.get(sha) ?? []));
    }
    ancestorsOf.set(claim, seen);
  }
  // a merge every claim already has behind it is outside every ticket's range and is never asked about
  const merges = [...graph].filter(([sha, parents]) => parents.length > 1 && claims.some(({ claim }) => !ancestorsOf.get(claim)!.has(sha))).map(([sha]) => sha);
  const quoted = (rel: string): boolean => !SAFE_REL_RE.test(rel);
  for (let at = 0; at < claims.length; at += chunk) {
    const part = claims.slice(at, at + chunk);
    const direct = part.filter(({ rel }) => !quoted(rel));
    const specs = direct.map(({ rel }) => ':(literal)' + rel);
    const wroteBy = new Map<string, Set<string>>(direct.map(({ rel }) => [rel, new Set<string>()]));
    const changedBy = new Map<string, Set<string>>(direct.map(({ rel }) => [rel, new Set<string>()]));
    if (direct.length > 0) {
      const log = execFileSync(
        'git',
        ['-c', 'log.showSignature=false', 'log', '--no-show-signature', '--no-renames', '--full-history', '--format=%x01%H', '-G^ruleset:', '--name-only', 'HEAD', '--', ...specs],
        { cwd: root, ...GIT },
      );
      for (const record of log.split('\x01')) {
        const lines = record.split('\n').map((l) => l.replace(/\r$/, ''));
        const sha = lines[0].trim().toLowerCase();
        if (sha === '') continue;
        if (!SHA_RE.test(sha)) throw new Error(`rulesetCommitsMany: unexpected log line ${JSON.stringify(lines[0])}`);
        for (const name of lines.slice(1)) {
          if (name === '') continue;
          const into = wroteBy.get(name);
          if (into === undefined) throw new Error(`rulesetCommitsMany: the log names a file nobody asked about: ${JSON.stringify(name)}`);
          into.add(sha);
        }
      }
      if (merges.length > 0) {
        const out = execFileSync('git', ['diff-tree', '--stdin', '-m', '-r', '--name-only', '--no-renames', '--pretty=oneline', '--', ...specs], {
          cwd: root,
          encoding: 'utf8',
          stdio: ['pipe', 'pipe', 'pipe'],
          maxBuffer: 64 * 1024 * 1024,
          env: { ...process.env, GIT_NO_LAZY_FETCH: '1' },
          input: merges.map((m) => m + '\n').join(''),
        });
        let pair: string | undefined;
        for (const raw of out.split('\n')) {
          const line = raw.replace(/\r$/, '');
          if (line === '') continue;
          const into = changedBy.get(line);
          if (into !== undefined) {
            if (pair === undefined) throw new Error('rulesetCommitsMany: a file name before any merge');
            into.add(pair);
            continue;
          }
          const header = /^([0-9a-f]{40,64}) \(from ([0-9a-f]{40,64})\)(?: |$)/.exec(line);
          if (header === null) throw new Error(`rulesetCommitsMany: unexpected diff-tree line ${JSON.stringify(line)}`);
          pair = header[1] + ' ' + header[2];
        }
      }
    }
    for (const { rel, claim } of part) {
      const replayed = quoted(rel)
        ? undefined
        : onePathCommits(graph, head, claim, ancestorsOf.get(claim)!, wroteBy.get(rel)!, (merge, parent) => changedBy.get(rel)!.has(merge + ' ' + parent));
      answers.set(rel, replayed ?? commitsWritingRuleset(root, claim, rel));
    }
  }
  return answers;
}

/** One ticket's ClaimFacts from its slice of the batch's blobs, assembled as gitClaimFacts assembles them; throws where gitClaimFacts throws (the config unreadable at the claim). */
function claimFactsFrom(p: Pending, texts: (string | undefined)[]): ClaimFacts {
  if (texts[0] === undefined) throw new Error(`accord/config.yml cannot be read at claim commit ${p.sha}`);
  const first = p.hasBase ? 3 : 2;
  const pin = pinOf(texts[0]);
  const basePin = !p.hasBase || texts[2] === undefined ? undefined : pinOf(texts[2]);
  let ruleset = texts[1] === undefined ? undefined : rulesetOfTicket(texts[1]);
  let rulesetCommit = ruleset === undefined ? undefined : p.sha;
  for (let i = 0; ruleset === undefined && i < p.wrote.length; i++) {
    const text = texts[first + i];
    ruleset = text === undefined ? undefined : rulesetOfTicket(text);
    if (ruleset !== undefined) rulesetCommit = p.wrote[i];
  }
  return {
    sha: p.sha,
    time: p.time,
    ...(pin === undefined ? {} : { pin }),
    ...(basePin === undefined ? {} : { basePin }),
    ...(ruleset === undefined ? {} : { ruleset, rulesetCommit: rulesetCommit! }),
  };
}
