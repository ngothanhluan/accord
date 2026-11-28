// CLI-05 `accord gate ready|plan|done <id>`: the verdict comes off the pure core gate and from nothing else
// — the CLI adds no rule, no filter, and no level change (D-87). A passing Ready then performs the one
// write accord makes to a file a human owns: `ac_hash` into the ticket (D-86, D-96). The result reaches
// stdout before the write is attempted, so a write failure is reported after the true verdict rather
// than instead of it (D-97). Under `--json` stdout carries the GateResult verbatim and every notice
// goes to stderr, so `jq '.findings[]'` works with no unwrapping (D-98).
import { capRulesOf, claimPinBefore, firstMainSlice, gateDone, gatePlan, gateReady, renderText, REPOS_FROM, sliceScope, stageOff, workOf } from '@accord-dev/accord-core';
import type { SliceScope } from '@accord-dev/accord-core';
import { gitAfterReview, gitBranchCommits, gitContentSince, gitPlanHistory, gitRecordsSinceFor, gitRepoFacts, gitRepoHeads, gitReviewCommit, gitReviewFact, UsageError, withDefaultRef, withReturnFacts } from '../load/fs.js';
import { gitBaseRecords } from '../load/base-records.js';
import { doneOnDefaultBranch, doneRefusal } from '../load/done-on-default.js';
import { withClaimPins } from '../load/claim-facts.js';
import { withLensFacts } from '../load/lens-facts.js';
import { withRecordPins, withRoundFacts } from '../load/round-facts.js';
import { withSecurityFacts } from '../load/security-facts.js';
import { withSliceRounds } from '../load/slice-rounds.js';
import { gitSliceSize } from '../load/slice-size.js';
import { withSlopFacts } from '../load/slop-facts.js';
import { appendGateRun, GATE_LOG } from '../load/ticket-log.js';
import { colourFindings } from '../render/color.js';
import { currentSlice } from './anchor.js';
import { branchFactFor, renderedFilesOf } from './branch-fact.js';
import type { CommandContext } from '../run.js';
import { writeKey } from '../write/key.js';

/** Phase 10 D-06: the slice whose review rounds the budget counts: the one `--slice` names, else the slice of this checkout (`currentSlice`); none for a slice of another repository. */
function sliceInWorkOf(ctx: CommandContext, id: string, scope: SliceScope | undefined): number | undefined {
  if (scope !== undefined) return scope.n;
  const slice = currentSlice(ctx, id);
  return slice?.repo === undefined ? slice?.n : undefined;
}

/**
 * Phase 15 D-31: the scope of `--slice <value>` for ticket `id`, or undefined when the ticket is unknown (the gate then says so as it always does). A value that is not a whole number, a plan with no
 * `## Slice` section and a number outside the plan's slices are usage errors (exit 2), never a verdict.
 */
function sliceOf(ctx: CommandContext, id: string, value: string): SliceScope | undefined {
  // Review C-WR-07: `auto` is how a pull request head that is no slice branch asks for its slice, so the CI script counts no heading itself: the parsed plan is the one definition of a slice section.
  // Two or more slices make it the first slice of this repository (the claim branch's, Phase 08.9.3 D-14; slice 1 when no slice has a `repo:` line); fewer judge the whole ticket, as no flag does.
  const auto = value === 'auto';
  if (!auto && !/^[0-9]{1,3}$/.test(value)) throw new UsageError(`--slice needs a whole number from 1 to the plan's last slice, or auto, got "${value.slice(0, 40)}"`);
  if (!Object.hasOwn(ctx.snapshot.tickets, id)) return undefined;
  const slices = workOf(ctx.snapshot, id)?.plan?.slices;
  if (auto && (slices === undefined || slices.length < 2)) return undefined;
  if (slices === undefined || slices.length === 0) throw new UsageError(`${id} has no "## Slice" section in its plan, so --slice does not apply`);
  const n = auto ? (firstMainSlice(slices) ?? 1) : Number(value);
  const scope = sliceScope(ctx.snapshot, id, n);
  if (scope === undefined) throw new UsageError(`--slice ${value} is not one of the plan's slices (1 to ${Math.max(...slices.map((x) => x.n))})`);
  // Review C-WR-08: a slice below the last that names no `@ac-<n>` on its covers: line would judge no criterion and pass; it is refused instead. The last slice (and a widened one) judges them all.
  if (!scope.last && scope.tags?.length === 0) throw new UsageError(`slice ${n} of ${id} names no criterion on its covers: line (covers: @ac-1), so --slice ${n} would judge nothing; fix plan.md and run accord gate plan ${id}`);
  return scope;
}

export function gate(
  ctx: CommandContext,
  which: 'ready' | 'plan' | 'done',
  id: string,
  options: { json?: boolean; slice?: string },
): number {
  // Phase 15 D-31: `gate done --slice <n>`, checked before anything is loaded or written; a refusal here is exit 2.
  const scope = options.slice === undefined ? undefined : sliceOf(ctx, id, options.slice);
  // Phase 08.8.1 IN-04: with `CI` set (anything but empty, `0` or `false`) no log is written: nothing in CI reads the file and a read-only workspace printed a stderr line on every run.
  // Phase 08.9.3 Pitfall 9: nor does `gate done` start a git process in another repository's clone.
  const inCi = ctx.env.CI !== undefined && !['', '0', 'false'].includes(ctx.env.CI);
  // ST-LN-8 D-02: under commits.trailers forbid the host loads the whole branch's commits; an unborn HEAD spawns no git log.
  // Phase 8.1 D-07: so it does when commits.message is set, whose gate.commit-message reads the same commits.
  const withCommits =
    which === 'done' && (ctx.snapshot.config?.commits?.trailers === 'forbid' || ctx.snapshot.config?.commits?.message !== undefined) && ctx.snapshot.git !== undefined
      ? { ...ctx.snapshot, commits: gitBranchCommits(ctx.root) }
      : ctx.snapshot;
  // ST-LN-31: a lane S ticket's Done reads review.md's commit and the commits after it, loaded here from HEAD.
  const isS = which === 'done' && Object.hasOwn(ctx.snapshot.tickets, id) && ctx.snapshot.tickets[id].frontmatter?.lane === 'S';
  const forDone = !isS
    ? withCommits
    : (() => {
        const after = Object.fromEntries(Object.entries(ctx.snapshot.afterVerify ?? {}).filter(([k]) => k !== id));
        // ST-LN-63: the review commit is read once and both facts are taken from it.
        const commit = gitReviewCommit(ctx.root, id);
        const found = gitAfterReview(ctx.root, id, commit);
        if (found !== undefined) after[id] = found;
        return { ...withCommits, reviewFacts: { [id]: gitReviewFact(ctx.root, id, commit) }, afterVerify: after };
      })();
  // ST-LN-62: Done reads the branch diff of every ticket with `lane:`, loaded here from the merge base with the default branch.
  const forScope =
    which === 'done' && Object.hasOwn(ctx.snapshot.tickets, id) && ctx.snapshot.tickets[id].frontmatter?.lane !== undefined
      ? { ...forDone, branchFacts: { [id]: branchFactFor(ctx, id) } }
      : forDone;
  // ST-LN-63: the history Plan and Done read is loaded here for the gated ticket alone, never at load for every ticket.
  const pinnedPlan = which === 'plan' ? withClaimPins(ctx.root, { ...ctx.snapshot, ...gitPlanHistory(ctx.root, ctx.snapshot, id) }, id) : undefined;
  // Phase 08.9.3 D-04, D-05: only `gate plan` asks another repository's clone for its baseline facts, and only for a ticket claimed at REPOS_FROM or after; no other command and no CI run starts a git process there.
  const claimPinned = pinnedPlan !== undefined && !claimPinBefore(pinnedPlan, id, REPOS_FROM) ? { ...pinnedPlan, ...gitRepoFacts(ctx.root, pinnedPlan, id) } : pinnedPlan;
  const gated =
    claimPinned !== undefined
      ? // ST-LN-91 D-12: a deferral leaves the stop at gate plan as it does at accord round, so the record's pin is read when a stop is possible: from round 2
        // under the plan cap of three (its count stop can fall there), from round 3 otherwise. The pin read itself is Phase 2's and unchanged.
        // ST-LN-91 D-15: the plan format rules and the plan cap read the ticket's claim pin, never the plan baseline's.
        withRecordPins(ctx.root, claimPinned, id, 'plan', capRulesOf(claimPinned, id, 'plan').fall ? 2 : 3)
      : which === 'done'
        ? // Phase 15 D-23, D-25: Done also holds the ticket's records at the merge base with the default branch, for gate.done-ticket-edited.
          // ST-LN-96 D-02: Done holds the claim fact too, for gate.ruleset-changed and gate.ruleset-missing, in every lane.
          withClaimPins(ctx.root, { ...forScope, ...gitRecordsSinceFor(ctx.root, ctx.snapshot, id), ...gitContentSince(ctx.root, ctx.snapshot, id), ...gitBaseRecords(ctx.root, ctx.snapshot, id, { env: ctx.env, warn: (line) => ctx.stderr.write(line + '\n') }) }, id)
        : ctx.snapshot;
  // ST-LN-17: Done confirms each ## Return from verify marker with git; an unversioned round record of a ticket
  // not done on the default branch needs that branch's snapshot.
  // ST-LN-57: Done also reads the round facts from git, and the default ref's snapshot for every record with a round,
  // whatever its version, so a ticket done there skips the review scope checks (D-10).
  // Phase 10 D-06 (per slice): Done reads the same counts as `accord round`: the slice in work is the one `--slice` names, else the one this checkout works.
  const forRounds = which === 'done' ? withSliceRounds(ctx.root, withRoundFacts(ctx.root, withReturnFacts(ctx.root, gated, id), id), id, sliceInWorkOf(ctx, id, scope)) : gated;
  const roundRecord = which === 'done' ? workOf(forRounds, id)?.rounds : which === 'plan' ? workOf(forRounds, id)?.planRounds : undefined;
  const hasRounds = roundRecord !== undefined && roundRecord.cycles.some((c) => c.rounds.length > 0);
  // Phase 08.8 review CR-02: a lane ticket whose review stage is off has no rounds, and Done reads the default ref for it too, so its security rule skips it once it is done there (D-03).
  const reviewOff = which === 'done' && Object.hasOwn(forRounds.tickets, id) && forRounds.tickets[id].frontmatter?.lane !== undefined && stageOff(forRounds, id, 'review');
  const withRefs = (hasRounds && (which === 'done' || !roundRecord.versioned)) || reviewOff ? withDefaultRef(ctx.root, forRounds, undefined, undefined, undefined, ctx.ids) : forRounds;
  // ST-LN-36 D-05 (5): Done holds each recorded review round against the security triggers of its own package; read after the default ref, whose snapshot says a ticket done there is skipped.
  // BUG-LN-25 D-16: the copies `accord skills sync` writes come from renderedFilesOf, so a changed copy equal to its render is the one thing the scan leaves out.
  const config = ctx.snapshot.config;
  // Phase 8.1 D-17: Done also holds the slop hits of the ticket's cumulative diff against the last review round's justification lines; the same rendered copies are left out.
  const render = renderedFilesOf(config);
  let list: ReturnType<typeof render> | undefined;
  const rendered = (): ReturnType<typeof render> => (list ??= render()); // at most one render per command, for the two readers
  // Phase 11 D-05 (11-ac-6): Done also holds each recorded review round against the team lenses its own package printed, recomputed from git and the default branch's lens files, as `accord round` does.
  const withFacts = which === 'done' ? withSlopFacts(ctx.root, withLensFacts(ctx.root, withSecurityFacts(ctx.root, withRefs, id, rendered), id), id, rendered) : withRefs;
  // Phase 15 D-06: a `--slice` run also holds the measured size of that slice, for gate.slice-diff-large; no flag reads nothing, and a size git could not measure is no fact.
  const measured = which === 'done' && scope !== undefined && scope.widened !== true ? gitSliceSize(ctx.root, ctx.snapshot, id, scope.n, rendered) : undefined;
  const sized = measured === undefined ? withFacts : { ...withFacts, sliceSize: { ...withFacts.sliceSize, [id]: measured } };
  // Phase 08.9.3 Pitfall 9, D-07, Decision 9: `gate done` on a machine whose stored clone of the other repository verifies also reads the tip of each of its slice branches, for gate.repo-head-moved. With `CI` set no git process
  // starts there (CI trusts the record), a ticket claimed before REPOS_FROM is not asked, and the parent folder is never searched: a repository with no stored clone is one stderr note and no fact.
  const forGate = which === 'done' && !inCi && !claimPinBefore(sized, id, REPOS_FROM) ? { ...sized, ...gitRepoHeads(ctx.root, sized, id, (line) => ctx.stderr.write(line + '\n')) } : sized;
  const result =
    which === 'ready' ? gateReady(withDefaultRef(ctx.root, withClaimPins(ctx.root, ctx.snapshot, id), undefined, undefined, undefined, ctx.ids), id) : which === 'plan' ? gatePlan(forGate, id) : gateDone(forGate, id, scope === undefined ? {} : { slice: scope.n });
  // D-31: a slice run says which slice it judged; under --json that line goes to stderr so stdout stays the GateResult alone.
  if (scope !== undefined) (options.json ? ctx.stderr : ctx.stdout).write(`slice ${scope.n} of ${scope.of}: ${scope.criteria} criteria judged${scope.widened === true ? ' (the ledger records a task of a later slice, so the whole ticket is judged)' : ''}\n`);
  ctx.stdout.write(
    options.json ? JSON.stringify(result, null, 2) + '\n' : colourFindings(renderText(result), ctx.stdout),
  );
  // Phase 08.7 D-04, A-03: the run is recorded as one line of the git-ignored `.accord-reports/<id>/gate.log` for the pane's log only; no gate, lint rule or round command reads it. The folder is
  // the snapshot's own key (an unknown id writes nothing), and a failed append names itself once on stderr and changes neither the verdict nor the exit code.
  // D-31: a run for a slice below the last is not the ticket's Done, so the pane's log of gate runs does not record it as one. A widened run judges the whole ticket, so it is recorded.
  if (Object.hasOwn(ctx.snapshot.tickets, id) && !inCi && (scope === undefined || scope.last)) {
    try {
      appendGateRun(ctx.root, id, result, Math.floor(Date.now() / 1000));
    } catch (err) {
      ctx.stderr.write(`could not record the gate run in .accord-reports/${id}/${GATE_LOG}: ${err instanceof Error ? err.message : String(err)}\n`);
    }
  }

  // D-96: no flag, option, or environment variable enables or suppresses this. `acHash` is absent when
  // the ticket is unknown or carries no `@ac-n` scenario, and there is then nothing to record.
  if (which === 'ready' && result.verdict === 'pass' && result.acHash !== undefined) {
    // T-05-07: the path is the loader's own record for a ticket that exists, joined to the resolved
    // root — the raw `<id>` argument is a key lookup that misses, never a path segment.
    const rel = ctx.snapshot.tickets[id].file;
    // Phase 15 D-23: a ticket done on the default branch is not edited; the verdict above stands and nothing is written.
    if (ctx.snapshot.tickets[id].frontmatter?.ac_hash !== result.acHash && doneOnDefaultBranch(ctx.root, id)) {
      ctx.stderr.write('not written: ' + doneRefusal(id) + '\n');
      return 0;
    }
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
    if (rel !== undefined && ctx.snapshot.work?.[id]?.plan?.planHash !== result.planHash && doneOnDefaultBranch(ctx.root, id)) {
      ctx.stderr.write('not written: ' + doneRefusal(id) + '\n');
    } else if (rel !== undefined) {
      try {
        if (writeKey(ctx.root, rel, 'plan_hash', result.planHash)) ctx.stderr.write('wrote plan_hash ' + result.planHash + ' to ' + rel + '\n');
      } catch (err) {
        throw new UsageError('cannot write plan_hash to ' + rel + ': ' + (err instanceof Error ? err.message : String(err)));
      }
    }
  }
  return result.verdict === 'fail' ? 1 : 0;
}
