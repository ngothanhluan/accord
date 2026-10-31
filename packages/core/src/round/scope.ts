// ST-LN-57: the review record held against git: the version, each round's head, the added-code and final-review marks,
// and the D-10 skip. Pure: the host supplies the round facts it read from git. No code runs at load but constants.
import { laneTicket, workOf } from '../gate/work.js';
import { ownRecordsOnly } from '../gate/done.js';
import { isDone } from '../status/stage.js';
import type { GateDraft, GateRule } from '../gate/rules.js';
import type { RangeCommit, RecordedRound, RepoSnapshot, RoundFacts, RoundRecord } from '../model/snapshot.js';
import { allowancesOf } from './next.js';
import { RECORD_V2_FROM, pinAllowsV1 } from './pin.js';

/** One recorded round in record order (across cycles); `j` is its record index and `cycle` its cycle, both 1-based; `p` its position in the cycle. */
export interface Placed { round: RecordedRound; j: number; cycle: number; p: number }

export function placedRounds(rec: RoundRecord): Placed[] {
  const out: Placed[] = [];
  rec.cycles.forEach((c, i) => c.rounds.forEach((round, k) => out.push({ round, j: out.length + 1, cycle: i + 1, p: k + 1 })));
  return out;
}

/** The commits of a range that add code: a debug episode's or a merge's that change a path outside the ticket's own records. */
export function addedCode(id: string, commits: RangeCommit[]): RangeCommit[] {
  return commits.filter((c) => c.kind !== 'commit' && !ownRecordsOnly(id, c.files));
}

/** The commits of a range a round's fix made: plain commits that change more than the ticket's own records. */
export function fixCommits(id: string, commits: RangeCommit[]): RangeCommit[] {
  return commits.filter((c) => c.kind === 'commit' && !ownRecordsOnly(id, c.files));
}

/**
 * The commits round `j` (1-based record index, not a final review) reviews as new: the ranges from the latest round
 * of its cycle before it that is not a final review, through the range just before it; that range alone when its
 * cycle has no such round; nothing for j = 1.
 */
export function spanOf(placed: Placed[], ranges: RangeCommit[][], j: number): RangeCommit[] {
  if (j <= 1) return [];
  const me = placed[j - 1];
  let from = j - 1;
  for (let i = j - 2; i >= 0 && placed[i].cycle === me.cycle; i--) {
    if (!placed[i].round.final) {
      from = i + 1;
      break;
    }
  }
  return ranges.slice(from - 1, j - 1).flat();
}

export function factsOf(snapshot: RepoSnapshot, id: string): RoundFacts | undefined {
  return snapshot.roundFacts !== undefined && Object.hasOwn(snapshot.roundFacts, id) ? snapshot.roundFacts[id] : undefined;
}

/** D-10: the host found HEAD on the default branch, or the ticket is done in the records of the default ref it read. */
export function skipped(snapshot: RepoSnapshot, id: string): boolean {
  const f = factsOf(snapshot, id);
  if (f !== undefined && 'skip' in f && f.skip !== undefined) return true;
  return snapshot.defaultRef !== undefined && isDone(snapshot.defaultRef.snapshot, id);
}

type Ready = Extract<RoundFacts, { heads: unknown }>;
const short = (sha: string | undefined): string => (sha ?? '').slice(0, 12);

/** The record and its facts when this ticket's scope is checked at all: a lane ticket whose review.md holds a round and whose facts the host supplied. */
function subject(snapshot: RepoSnapshot, id: string): { rec: RoundRecord; facts: RoundFacts; laneS: boolean } | undefined {
  const ticket = laneTicket(snapshot, id);
  const rec = workOf(snapshot, id)?.rounds;
  const facts = factsOf(snapshot, id);
  if (ticket === undefined || rec === undefined || facts === undefined || rec.cycles.every((c) => c.rounds.length === 0)) return undefined;
  return { rec, facts, laneS: ticket.frontmatter?.lane === 'S' };
}

const toldAt = (p: Placed): string => `round ${p.p} of cycle ${p.cycle}`;

/** The cycle's stretches: ends of each stretch, as positions (1-based) within the cycle. */
function stretchEnds(cutAfter: number[], rounds: number): number[] {
  return [...new Set([...cutAfter.filter((r) => r >= 1 && r < rounds), rounds])].sort((a, b) => a - b);
}

function versionProblems(facts: Ready, placed: Placed[]): { line?: number; reason: string }[] {
  if (pinAllowsV1(facts.pin, facts.basePin)) return [];
  const below = pinAllowsV1(facts.pin) ? ` below ${facts.basePin} at ${short(facts.baseAt)}, the commit this branch started from` : '';
  const highs = placed.map((p) => `${toldAt(p)}: ${short(facts.heads[p.j - 1]?.high)}`).join('; ');
  return [
    {
      line: 1,
      reason:
        `review.md is a version 1 record, but accord/config.yml pins ${facts.pin ?? 'no release'} at ${facts.pinAt === undefined ? 'HEAD' : short(facts.pinAt)}${below}, ` +
        `and from accord ${RECORD_V2_FROM} a record is version 2: set its first line to Round record: 2, head each round ## Round <n> head <sha> ` +
        `with a commit above the previous round's head and at or below the one listed (${highs}), give each finding one location, ` +
        'then add the marks or Rulings accord gate done asks',
    },
  ];
}

/** Every way the record of a lane ticket disagrees with git; empty without a lane ticket, a round or facts. */
export function scopeProblems(snapshot: RepoSnapshot, id: string): { line?: number; reason: string }[] {
  const s = subject(snapshot, id);
  if (s === undefined) return [];
  const { rec, facts, laneS } = s;
  const placed = placedRounds(rec);
  if (rec.version !== 2) {
    if ('error' in facts) return [{ reason: `the review scope cannot be checked: ${facts.error}` }];
    return skipped(snapshot, id) ? [] : versionProblems(facts, placed);
  }
  if ('error' in facts) return [{ reason: `the review scope cannot be checked: ${facts.error}` }];
  if (skipped(snapshot, id)) return [];

  const out: { line?: number; reason: string }[] = [];
  const add = (line: number, reason: string) => out.push({ line, reason });

  // Heads: each typed head is bound to git.
  for (const p of placed) {
    const h = facts.heads[p.j - 1];
    if (h === undefined) continue;
    const head = p.round.head ?? '';
    if (h.bound === 'unknown') {
      add(p.round.line, `${toldAt(p)}: head ${head} names no commit in this repository; after a rebase, retype each round's head to the commit that now holds the same change, at or below ${short(h.high)}`);
    } else if (h.bound === false) {
      add(
        p.round.line,
        `${toldAt(p)}: head ${head} is not between ${h.low === undefined ? 'the branch start' : short(h.low)} and ${short(h.high)} in HEAD's history; type the Head: line accord review-package printed for this round`,
      );
    }
  }

  // Marks: (added code round 1) stands where a debug episode or a merge added code, and nowhere else.
  for (const p of placed) {
    if (p.round.final) continue;
    const span = spanOf(placed, facts.ranges, p.j);
    const firstOfCycle = !placed.some((q) => q.cycle === p.cycle && q.j < p.j && !q.round.final);
    if (p.round.added) {
      if (!span.some((c) => c.kind !== 'commit')) {
        add(p.round.line, `${toldAt(p)} is headed (added code round 1), but no debug episode or merge comes since the round before it; remove the mark`);
      }
    } else if (!firstOfCycle) {
      const added = addedCode(id, span);
      if (added.length > 0) {
        add(p.round.line, `${toldAt(p)} reviews code a debug episode or a merge added (${added.map((c) => short(c.sha)).join(', ')}) and its heading needs (added code round 1)`);
      }
    }
  }

  // The final review: lane M only, once per stretch, as the last round of the stretch or the one before it.
  const finals = placed.filter((p) => p.round.final);
  if (laneS) {
    for (const p of finals) add(p.round.line, `${toldAt(p)} is headed (final review), but lane S has no final review`);
  } else if (finals.length > 0) {
    const allowances = allowancesOf(snapshot, id, 'review');
    for (const p of finals) {
      const count = rec.cycles[p.cycle - 1].rounds.length;
      const cuts = allowances.filter((a) => a.cycle === p.cycle).map((a) => a.after);
      const ends = stretchEnds(cuts, count);
      const end = ends.find((e) => e >= p.p) ?? count;
      const start = (ends.filter((e) => e < p.p).pop() ?? 0) + 1;
      const earlier = finals.some((q) => q.cycle === p.cycle && q.p >= start && q.p < p.p);
      if (earlier || p.p < end - 1) {
        add(
          p.round.line,
          `${toldAt(p)} is headed (final review), but a final review is the last round of its stretch or the one before it, once per stretch; a stretch ends at the cycle's last round or at a round an owner allowance names`,
        );
      }
    }
  }
  return out.sort((a, b) => (a.line ?? 0) - (b.line ?? 0));
}

/** The ranges from the latest round of the last cycle not headed (final review) through the last range hold added code. */
export function pendingAddedCode(snapshot: RepoSnapshot, id: string): boolean {
  const s = subject(snapshot, id);
  if (s === undefined || s.rec.version !== 2 || 'error' in s.facts || skipped(snapshot, id)) return false;
  return pendingOf(s.rec, s.facts, id).length > 0;
}

function pendingOf(rec: RoundRecord, facts: Ready, id: string): RangeCommit[] {
  const placed = placedRounds(rec);
  if (placed.length === 0) return [];
  const last = rec.cycles.length;
  const mine = placed.filter((p) => p.cycle === last && !p.round.final);
  const from = mine.length > 0 ? mine[mine.length - 1].j : placed.length;
  return addedCode(id, facts.ranges.slice(from - 1).flat());
}

/** The record against git: heads, marks, the final review, and added code no round has reviewed. */
export const reviewScope: GateRule['check'] = (snapshot, id) => {
  const s = subject(snapshot, id);
  if (s === undefined) return [];
  const out: GateDraft[] = scopeProblems(snapshot, id).map((p) => ({ file: s.rec.file, ...(p.line === undefined ? {} : { line: p.line }), reason: p.reason }));
  if (s.rec.version === 2 && !('error' in s.facts) && !skipped(snapshot, id)) {
    const placed = placedRounds(s.rec);
    const lastRange = addedCode(id, s.facts.ranges[placed.length - 1] ?? []);
    const tail = placed[placed.length - 1];
    if (tail !== undefined && lastRange.length > 0) {
      out.push({
        file: s.rec.file,
        reason: `the commits after ${toldAt(tail)}'s head add code by a debug episode or a merge (${lastRange.map((c) => short(c.sha)).join(', ')}) that no round has reviewed; run a review round headed (added code round 1)`,
      });
    }
  }
  return out;
};

/** D-10: HEAD is already on the default branch, or the ticket is done there; the pull request's gate ran the checks on the branch. */
export const reviewScopeSkipped: GateRule['check'] = (snapshot, id) => {
  const ticket = laneTicket(snapshot, id);
  const rec = workOf(snapshot, id)?.rounds;
  if (ticket === undefined || rec === undefined || rec.cycles.every((c) => c.rounds.length === 0) || !skipped(snapshot, id)) return [];
  const facts = factsOf(snapshot, id);
  const v2 = rec.version === 2 || (facts !== undefined && !('error' in facts) && !pinAllowsV1(facts.pin, facts.basePin));
  if (!v2) return [];
  return [
    {
      file: rec.file,
      reason: "HEAD is already on the default branch, or the ticket is done there, so the review scope checks are skipped; the pull request's gate ran them on the ticket branch",
    },
  ];
};
