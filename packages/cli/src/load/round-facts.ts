// ST-LN-57: the facts the review gate reads from git: each round's head bound or not, its range with the commit kinds,
// the pin at the first round. Every git error fails closed (ledger Rulings 18, 23, 25).
import { execFileSync } from 'node:child_process';
import { pinAllowsV1 } from '@accord-dev/accord-core';
import type { HeadFact, RangeCommit, RepoSnapshot, RoundFacts } from '@accord-dev/accord-core';
import { defaultRefOf } from './fs.js';
import { readHistory } from './record-history.js';
import type { RecordHistory } from './record-history.js';
import { nearestCode, readWalk, reach } from './walk.js';
import type { Walk } from './walk.js';

const GIT = {
  encoding: 'utf8' as const,
  stdio: ['pipe', 'pipe', 'pipe'] as ['pipe', 'pipe', 'pipe'],
  maxBuffer: 64 * 1024 * 1024,
  env: { ...process.env, GIT_NO_LAZY_FETCH: '1' },
};

/** git's first non-blank stderr line without "fatal: ", else the error's own message. */
function whyGit(e: unknown): string {
  const stderr = String((e as { stderr?: string }).stderr ?? '').split('\n').find((l) => l.trim() !== '');
  return (stderr ?? (e as Error).message ?? 'git failed').replace(/^fatal: /, '').trim();
}

/** A git failure that turns into the facts' error. */
class FactError extends Error {}

/** The typed heads resolved to full commit shas in one `git cat-file --batch-check`; undefined for one that names no commit. */
function resolveHeads(root: string, heads: (string | undefined)[]): (string | undefined)[] {
  const asked = heads.flatMap((h, i) => (h === undefined ? [] : [{ h, i }]));
  const out: (string | undefined)[] = heads.map(() => undefined);
  if (asked.length === 0) return out;
  let raw: string;
  try {
    raw = execFileSync('git', ['cat-file', '--batch-check'], { cwd: root, ...GIT, input: asked.map(({ h }) => `${h}^{commit}\n`).join('') });
  } catch (e) {
    throw new FactError('git cat-file --batch-check failed: ' + whyGit(e));
  }
  const lines = raw.split('\n');
  asked.forEach(({ i }, k) => {
    const m = /^([0-9a-f]{40,64}) commit \d+$/.exec(lines[k] ?? '');
    if (m !== null) out[i] = m[1];
  });
  return out;
}

/** True when `x` is `y` or an ancestor of it; only `git merge-base --is-ancestor` exit 1 means no, any other failure is an error. */
function isAncestorOrSelf(root: string, walk: Walk, x: string, y: string, reached: (sha: string) => Set<string>): boolean {
  if (x === y) return true;
  const xIn = walk.commits.has(x);
  if (xIn && walk.commits.has(y)) return reached(y).has(x);
  if (xIn) return false;
  try {
    execFileSync('git', ['merge-base', '--is-ancestor', x, y], { cwd: root, ...GIT });
    return true;
  } catch (e) {
    if ((e as { status?: number }).status === 1) return false;
    throw new FactError(`git merge-base --is-ancestor ${x} ${y} failed: ${whyGit(e)}`);
  }
}

/** The first parent of a commit; the commit itself when it has none. */
function firstParent(root: string, walk: Walk, sha: string): string {
  const inWalk = walk.commits.get(sha);
  if (inWalk !== undefined) return inWalk.parents[0] ?? sha;
  try {
    return execFileSync('git', ['rev-parse', '--verify', '--quiet', sha + '^'], { cwd: root, ...GIT }).trim().toLowerCase();
  } catch {
    return sha;
  }
}

function pinsOf(h: RecordHistory): Pick<Extract<RoundFacts, { heads: unknown }>, 'pin' | 'pinAt' | 'basePin' | 'baseAt'> {
  return {
    ...(h.pin === undefined ? {} : { pin: h.pin }),
    ...(h.pinAt === undefined ? {} : { pinAt: h.pinAt }),
    ...(h.basePin === undefined ? {} : { basePin: h.basePin }),
    ...(h.baseAt === undefined ? {} : { baseAt: h.baseAt }),
  };
}

function read(root: string, snapshot: RepoSnapshot, id: string): RoundFacts | undefined {
  const lane = snapshot.tickets[id]?.frontmatter?.lane;
  const rec = snapshot.work?.[id]?.rounds;
  if (lane === undefined || rec === undefined || snapshot.git === undefined) return undefined;
  const typed = rec.cycles.flatMap((c) => c.rounds.map((r) => r.head?.toLowerCase()));
  if (typed.length === 0) return undefined;
  const def = defaultRefOf(root);
  const baseline = snapshot.work?.[id]?.plan?.baseline;
  const where = { ...(def === undefined ? {} : { def }), ...(baseline === undefined ? {} : { baseline }) };
  const laneS = lane === 'S';

  // The high of round j: the nearest code commit from the first parent of its record commit, or from HEAD while it is not committed.
  const highs = (walk: Walk, history: RecordHistory): string[] => {
    const head = snapshot.git!.commit.toLowerCase();
    return typed.map((_, j) => {
      const record = history.rounds[j];
      return nearestCode(walk, record === undefined ? head : firstParent(root, walk, record), id);
    });
  };

  if (rec.version !== 2) {
    const history = readHistory(root, id, undefined, snapshot.config?.accord, where);
    if ('error' in history) return { error: history.error };
    if (pinAllowsV1(history.pin, history.basePin)) return { ...pinsOf(history), heads: [], ranges: [] };
    const walk = readWalk(root, { laneS, def, baseline });
    if ('error' in walk) return { error: walk.error };
    if (def !== undefined && walk.order.length === 0) return { ...pinsOf(history), skip: 'on-default', heads: [], ranges: [] };
    return { ...pinsOf(history), heads: highs(walk, history).map((high) => ({ high })), ranges: [] };
  }

  const walk = readWalk(root, { laneS, def, baseline });
  if ('error' in walk) return { error: walk.error };
  if (def !== undefined && walk.order.length === 0) return { skip: 'on-default', heads: [], ranges: [] };
  const history = readHistory(root, id, walk, snapshot.config?.accord, where);
  if ('error' in history) return { error: history.error };
  const resolved = resolveHeads(root, typed);
  const high = highs(walk, history);
  const pins = pinsOf(history);

  const memo = new Map<string, Set<string>>();
  const reached = (sha: string): Set<string> => {
    let set = memo.get(sha);
    if (set === undefined) memo.set(sha, (set = reach(walk, sha)));
    return set;
  };
  // A head that names no commit cannot be placed: its bound, and the bound of the head after it, is unknown.
  const heads: HeadFact[] = high.map((top, j) => {
    const h = resolved[j];
    const low = j === 0 ? undefined : resolved[j - 1];
    const known = h !== undefined && (j === 0 || low !== undefined);
    const bound = !known ? 'unknown' : (low === undefined || isAncestorOrSelf(root, walk, low, h, reached)) && isAncestorOrSelf(root, walk, h, top, reached);
    return { high: top, ...(low === undefined ? {} : { low }), bound };
  });
  if (resolved.some((h) => h === undefined)) return { ...pins, heads, ranges: typed.map(() => []) };

  // Range j: the walk commits reachable from the next head (from HEAD for the last round) and not from this one, oldest first.
  const episodic = new Set(history.episodes.flatMap((e) => [...e.commits]));
  const tip = snapshot.git.commit.toLowerCase();
  const ranges: RangeCommit[][] = (resolved as string[]).map((h, j) => {
    const upTo = reached(j + 1 < resolved.length ? (resolved[j + 1] as string) : tip);
    const below = reached(h);
    return walk.order
      .filter((sha) => upTo.has(sha) && !below.has(sha))
      .reverse()
      .map((sha) => {
        const c = walk.commits.get(sha)!;
        return { sha, kind: c.parents.length > 1 ? 'merge' : episodic.has(sha) ? 'episode' : 'commit', files: c.files } as RangeCommit;
      });
  });
  return { ...pins, heads, ranges };
}

/**
 * The round facts of one ticket, or undefined when it has no lane, no round in review.md, or the snapshot has no HEAD.
 * A version 1 record whose pin allows it needs no walk; any git error is `{ error }`.
 */
export function roundFactsFor(root: string, snapshot: RepoSnapshot, id: string): RoundFacts | undefined {
  try {
    return read(root, snapshot, id);
  } catch (e) {
    if (e instanceof FactError) return { error: e.message };
    return { error: 'git failed reading the review rounds: ' + whyGit(e) };
  }
}

/** `snapshot` with roundFacts[id] set; `snapshot` itself when the ticket has none. */
export function withRoundFacts(root: string, snapshot: RepoSnapshot, id: string): RepoSnapshot {
  const facts = roundFactsFor(root, snapshot, id);
  return facts === undefined ? snapshot : { ...snapshot, roundFacts: { ...snapshot.roundFacts, [id]: facts } };
}
