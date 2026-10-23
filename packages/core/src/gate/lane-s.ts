// ST-LN-31 D-04, D-12: the Done rules of a lane S ticket. It has no plan, tasks or acceptance criteria, so its
// Done reads the Ready record over Understood and Done when, the committed and unchanged review.md, and the commits
// after the review. Each check is silent unless the ticket exists with `lane: S`.
import type { RepoSnapshot } from '../model/snapshot.js';
import { handMade, ownRecordsOnly } from './done.js';
import { laneSHash } from './hash.js';
import type { GateRule } from './rules.js';
import { workOf } from './work.js';

const ticketFile = (id: string) => 'accord/tickets/' + id + '.md';

const laneS = (snapshot: RepoSnapshot, id: string) => {
  const t = Object.hasOwn(snapshot.tickets, id) ? snapshot.tickets[id] : undefined;
  return t?.frontmatter?.lane === 'S' ? t : undefined;
};

export const readyMissing: GateRule['check'] = (snapshot, id) => {
  const t = laneS(snapshot, id);
  if (t === undefined || t.frontmatter?.ac_hash !== undefined) return [];
  return [
    {
      file: ticketFile(id),
      pointer: '/ac_hash',
      reason: `gate ready has recorded no ac_hash for this lane S ticket; run accord gate ready ${id}`,
    },
  ];
};

export const sectionsChanged: GateRule['check'] = (snapshot, id) => {
  const t = laneS(snapshot, id);
  const recorded = t?.frontmatter?.ac_hash;
  if (t === undefined || recorded === undefined) return [];
  const now = laneSHash(t);
  if (recorded === now) return [];
  return [
    {
      file: ticketFile(id),
      pointer: '/ac_hash',
      reason: `## Understood or ## Done when changed since gate ready: ac_hash records ${recorded}, they hash to ${now} now; run accord gate ready ${id} and review again`,
    },
  ];
};

const reviewOf = (snapshot: RepoSnapshot, id: string) => (laneS(snapshot, id) === undefined ? undefined : workOf(snapshot, id)?.review);

export const reviewTrailing: GateRule['check'] = (snapshot, id) => {
  const review = reviewOf(snapshot, id);
  if (review?.trailing !== true) return [];
  return [{ file: review.file, reason: 'a line follows the verdict in review.md; the verdict is its last line' }];
};

const factOf = (snapshot: RepoSnapshot, id: string) =>
  snapshot.reviewFacts !== undefined && Object.hasOwn(snapshot.reviewFacts, id) ? snapshot.reviewFacts[id] : undefined;

export const reviewUncommitted: GateRule['check'] = (snapshot, id) => {
  const review = reviewOf(snapshot, id);
  if (review === undefined) return [];
  const f = factOf(snapshot, id);
  if (f === undefined) return [{ file: review.file, reason: 'the host loaded no commit facts for review.md, so its commit cannot be checked' }];
  if (f.clean) return [];
  return [
    {
      file: review.file,
      reason: 'review.md is not committed, no commit of it records a ## Round line, or it has uncommitted changes; commit it alone',
    },
  ];
};

export const reviewCommitCode: GateRule['check'] = (snapshot, id) => {
  const review = reviewOf(snapshot, id);
  const files = factOf(snapshot, id)?.files;
  if (review === undefined || files === undefined || ownRecordsOnly(id, files)) return [];
  const out = files.filter((p) => !ownRecordsOnly(id, [p])).slice(0, 5);
  return [
    {
      file: review.file,
      reason: `the commit that records the last review round also changes ${out.join(' ')}; commit the change before its review`,
    },
  ];
};

export const commitAfterReview: GateRule['check'] = (snapshot, id) => {
  const review = reviewOf(snapshot, id);
  if (review === undefined) return [];
  const after = snapshot.afterVerify !== undefined && Object.hasOwn(snapshot.afterVerify, id) ? snapshot.afterVerify[id] : undefined;
  if (after === undefined) {
    return [{ file: review.file, reason: 'the host could not list the commits after review.md, so a change after review cannot be ruled out' }];
  }
  return after
    .filter((c) => handMade(id, c))
    .map((c) => ({
      file: review.file,
      reason: `commit ${c.sha} after the review changes ${
        c.files === undefined ? 'what git could not show' : c.files.filter((p) => !ownRecordsOnly(id, [p])).join(' ')
      }; a change after review needs another round and a new review.md`,
    }));
};
