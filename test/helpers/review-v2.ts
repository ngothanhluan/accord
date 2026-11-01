// ST-LN-57: version 2 review records and the round facts the host reads from git, for the core tests of the review scope
// rules. Strings and plain objects only; both test trees import DOWNWARDS from here.

import { loadSnapshot } from '../../packages/core/src/index.js';
import type { BranchFact, HeadFact, RangeCommit, RepoSnapshot, RoundFacts } from '../../packages/core/src/index.js';
import { CONFIG, LANE_S_BODY, P, done, laneTicket } from './lane.js';

type Files = Record<string, string>;

/** A 40-character lower-case hex string, unique per n. */
export const H = (n: number): string => n.toString(16).padStart(40, '0');

let counter = 0;
/** A commit of a round's range; `n` picks its sha, else the next unused one. */
export function commit(files: string[], kind: RangeCommit['kind'] = 'commit', n?: number): RangeCommit {
  return { sha: H(1000 + (n ?? ++counter)), kind, files };
}

export interface RoundSpec { head?: string; mark?: 'added' | 'final'; lines: string[] }

/** A version 2 review.md: per cycle its rounds, a cycle after the first opened by a Return from verify line and every cycle but the last closed by a verdict. */
export function v2Review(cycles: RoundSpec[][], tail = ''): string {
  const out = ['Round record: 2', ''];
  let j = 0;
  cycles.forEach((rounds, c) => {
    if (c > 0) out.push(`## Return from verify abc1234def${c + 1}`, '');
    rounds.forEach((r, i) => {
      j++;
      const mark = r.mark === 'added' ? ' (added code round 1)' : r.mark === 'final' ? ' (final review)' : '';
      out.push(`## Round ${i + 1} head ${r.head ?? H(j)}${mark}`, '', ...(r.lines.length === 0 ? ['No findings'] : r.lines), '');
    });
    if (c < cycles.length - 1) out.push('verdict: converged', '');
  });
  return out.join('\n') + tail;
}

/** Round facts: `ranges[j - 1]` is round j's range; heads default to `{ high: H(j), bound: true }`. */
export function facts(
  ranges: RangeCommit[][],
  o: { heads?: HeadFact[]; pin?: string; basePin?: string; skip?: 'on-default' } = {},
): RoundFacts {
  return {
    ...(o.pin === undefined ? {} : { pin: o.pin }),
    ...(o.basePin === undefined ? {} : { basePin: o.basePin }),
    ...(o.skip === undefined ? {} : { skip: o.skip }),
    heads: o.heads ?? ranges.map((_, i) => ({ high: H(i + 1), bound: true })),
    ranges,
  };
}

/** A snapshot of one ticket with a review.md; lane M ticket through `done`, lane S through `laneTicket`. */
export function scopeSnapshot(o: {
  id?: string;
  lane?: 'M' | 'S';
  review: string;
  ledger?: string;
  facts?: RoundFacts;
  branch?: BranchFact;
  doneOnDefault?: true;
}): RepoSnapshot {
  const id = o.id ?? 'T-1';
  const files: Files = { 'accord/config.yml': CONFIG };
  if (o.lane === 'S') files[P(id)] = laneTicket(id, { lane: 'S', body: LANE_S_BODY });
  else done(files, id);
  files['accord/tickets/' + id + '/ledger.md'] = '## Rulings\n- task 1 done abc1234\n- task 2 done abc1234\n' + (o.ledger ?? '');
  files['accord/tickets/' + id + '/review.md'] = o.review;
  const returns: Record<string, boolean> = {};
  for (const m of o.review.matchAll(/^## Return from verify (\S+)/gm)) returns[m[1]] = true;
  const snap = loadSnapshot({
    files,
    tree: Object.keys(files),
    returnFacts: { [id]: returns },
    ...(o.facts === undefined ? {} : { roundFacts: { [id]: o.facts } }),
    ...(o.branch === undefined ? {} : { branchFacts: { [id]: o.branch } }),
  });
  return o.doneOnDefault === true ? { ...snap, defaultRef: { ref: 'refs/heads/main', snapshot: snap } } : snap;
}
