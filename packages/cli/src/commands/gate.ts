// CLI-05 `accord gate ready|plan|done <id>`: the verdict comes off the pure core gate and from nothing else
// — the CLI adds no rule, no filter, and no level change (D-87). A passing Ready then performs the one
// write accord makes to a file a human owns: `ac_hash` into the ticket (D-86, D-96). The result reaches
// stdout before the write is attempted, so a write failure is reported after the true verdict rather
// than instead of it (D-97). Under `--json` stdout carries the GateResult verbatim and every notice
// goes to stderr, so `jq '.findings[]'` works with no unwrapping (D-98).
import { gateDone, gatePlan, gateReady, renderText, workOf } from '@accord-dev/accord-core';
import { gitAfterReview, gitBranchCommits, gitReviewFact, UsageError, withDefaultRef, withReturnFacts } from '../load/fs.js';
import { colourFindings } from '../render/color.js';
import { branchFactFor } from './branch-fact.js';
import type { CommandContext } from '../run.js';
import { writeKey } from '../write/key.js';

export function gate(
  ctx: CommandContext,
  which: 'ready' | 'plan' | 'done',
  id: string,
  options: { json?: boolean },
): number {
  // ST-LN-8 D-02: under commits.trailers forbid the host loads the whole branch's commits; an unborn HEAD spawns no git log.
  const withCommits =
    which === 'done' && ctx.snapshot.config?.commits?.trailers === 'forbid' && ctx.snapshot.git !== undefined
      ? { ...ctx.snapshot, commits: gitBranchCommits(ctx.root) }
      : ctx.snapshot;
  // ST-LN-31: a lane S ticket's Done reads review.md's commit and the commits after it, loaded here from HEAD.
  const isS = which === 'done' && Object.hasOwn(ctx.snapshot.tickets, id) && ctx.snapshot.tickets[id].frontmatter?.lane === 'S';
  const forDone = !isS
    ? withCommits
    : (() => {
        const after = Object.fromEntries(Object.entries(ctx.snapshot.afterVerify ?? {}).filter(([k]) => k !== id));
        const found = gitAfterReview(ctx.root, id);
        if (found !== undefined) after[id] = found;
        return { ...withCommits, reviewFacts: { [id]: gitReviewFact(ctx.root, id) }, afterVerify: after };
      })();
  // ST-LN-62: Done reads the branch diff of every ticket with `lane:`, loaded here from the merge base with the default branch.
  const forScope =
    which === 'done' && Object.hasOwn(ctx.snapshot.tickets, id) && ctx.snapshot.tickets[id].frontmatter?.lane !== undefined
      ? { ...forDone, branchFacts: { [id]: branchFactFor(ctx, id) } }
      : forDone;
  // ST-LN-17: Done confirms each ## Return from verify marker with git; an unversioned round record of a ticket
  // not done on the default branch needs that branch's snapshot.
  const forRounds = which === 'done' ? withReturnFacts(ctx.root, forScope, id) : ctx.snapshot;
  const roundRecord = which === 'done' ? workOf(forRounds, id)?.rounds : which === 'plan' ? workOf(forRounds, id)?.planRounds : undefined;
  const forGate =
    roundRecord !== undefined && !roundRecord.versioned && roundRecord.cycles.some((c) => c.rounds.length > 0)
      ? withDefaultRef(ctx.root, forRounds)
      : forRounds;
  const result =
    which === 'ready' ? gateReady(withDefaultRef(ctx.root, ctx.snapshot), id) : which === 'plan' ? gatePlan(forGate, id) : gateDone(forGate, id);
  ctx.stdout.write(
    options.json ? JSON.stringify(result, null, 2) + '\n' : colourFindings(renderText(result), ctx.stdout),
  );

  // D-96: no flag, option, or environment variable enables or suppresses this. `acHash` is absent when
  // the ticket is unknown or carries no `@ac-n` scenario, and there is then nothing to record.
  if (which === 'ready' && result.verdict === 'pass' && result.acHash !== undefined) {
    // T-05-07: the path is the loader's own record for a ticket that exists, joined to the resolved
    // root — the raw `<id>` argument is a key lookup that misses, never a path segment.
    const rel = ctx.snapshot.tickets[id].file;
    try {
      // T-05-08, D-96: writeKey writes only on a difference, so a second consecutive `gate ready` leaves
      // the bytes and the mtime alone, CRLF and BOM files included.
      if (writeKey(ctx.root, rel, 'ac_hash', result.acHash)) {
        // T-05-09, D-98: stderr, so a `--json` consumer's stdout stays one clean document.
        // Replacing a differing hash is a distinct event from recording an absent one: the
        // acceptance criteria moved, which also staled `verified_hash` and will fail the next
        // `gate done`. One line, so that is not silent.
        const prev = ctx.snapshot.tickets[id].frontmatter?.ac_hash;
        ctx.stderr.write(
          prev === undefined
            ? 'wrote ac_hash ' + result.acHash + ' to ' + rel + '\n'
            : 'updated ac_hash ' + prev + ' -> ' + result.acHash + ' in ' + rel + '\n',
        );
      }
    } catch (err) {
      // D-97: an environment failure, not a verdict. The result is already on stdout, so the caller
      // sees the true verdict and the real failure; exit 2 keeps CI from going green with no hash.
      throw new UsageError(
        'cannot write ac_hash to ' + rel + ': ' + (err instanceof Error ? err.message : String(err)),
      );
    }
  }
  // Same write path and failure mode as ac_hash: the hash of the plan text the passing verdict was read from.
  if (which === 'plan' && result.verdict === 'pass' && result.planHash !== undefined) {
    const rel = ctx.snapshot.work?.[id]?.plan?.file;
    if (rel !== undefined) {
      try {
        if (writeKey(ctx.root, rel, 'plan_hash', result.planHash)) ctx.stderr.write('wrote plan_hash ' + result.planHash + ' to ' + rel + '\n');
      } catch (err) {
        throw new UsageError('cannot write plan_hash to ' + rel + ': ' + (err instanceof Error ? err.message : String(err)));
      }
    }
  }
  return result.verdict === 'fail' ? 1 : 0;
}
