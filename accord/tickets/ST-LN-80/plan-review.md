Round record: 1

## Round 1 (whole)

1. Must — Task 2's critic line 11 still says read the whole ticket in every mode and only adds "read `## Approach` at the changed lines"; it never says to read `## Approach` only at those lines, never in full, so D-02 "reads only the amended text" and ac-3 do not hold, and the ac-3 test does not check it; fix: write "read `## Approach` only at the changed lines, never in full" and add it as an R line of the ac-3 test (lens criteria) — fixed
2. Should — Task 4's scope exemption waives any deletion of `.claude/agents/accord-architect.md`, also a copy the owner edited, which sync deliberately keeps; a lane S branch running the orphan `rm -rf` passes every gate; fix: the host adds the deleted retired path to `synced` only when its text at the merge base has an intact marker (filesAt at fs.ts:1398/1416), never in core without that content check (lens security) — fixed
3. Should — a failing `rmSync` in `removeRetired` throws after `writeSkillFiles` wrote, so sync exits 2 without its report and loses the `overwrote local edits` line D-112 must never lose (read-only `.claude/agents` on POSIX, EBUSY/EPERM on Windows); fix: catch around `rmSync`, keep the file so the orphan scan reports it, still print the report (lens security) — fixed
4. Should — Task 2's critic.md line 14 edit cuts at "the first comma after `fixed:`", which falls inside the code span `fixed: <round>.<n>, <round>.<n>` and garbles the line while every tested phrase survives; fix: cut "up to and including `that the plan now fixes,`" (lens build) — fixed
5. Should — Task 3 lists `packages/core/test/approach-fold.test.ts (new)` although Task 2 creates it with the ac-5 test; an executor holding only Task 3 rewrites it and deletes ac-5's test; fix: drop "(new)" and say add two top-level `it`s to the file Task 2 created (lens build) — fixed
6. Should — the preamble "No existing test is renamed or removed" contradicts Task 2 dropping the `architect` row of AGENT_REQUIRED (agents.test.ts:17-25, baseline id at tests-baseline.txt:285); fix: name that removal as the one exception (untracedTests reads only ids in the report) (lens build) — fixed
7. Should — scripts/round.mjs:14, scripts/benchmark-samples.json and `agentSettings` (scripts/benchmark.mjs:412, called by benchmark-round.test.ts:191) read `.claude/agents/accord-architect.md`; once this repository's renders follow a pin with this ticket, `accord upgrade` removes it and that test throws ENOENT on the upgrade branch's CI (lens build, unnumbered) — fixed
8. Nice — Task 5's "Must not change … the orphan report for every other path" contradicts its rewording of skills.ts:236 for every orphan (lens security) — deferred
9. Nice — `accord upgrade` removes the retired file but says so nowhere in its output or commit subject (lens security) — deferred
10. Nice — docs/specs/2026-10-12-workflow-layer-design.md:592 still says "architect in lane P" and Task 4 does not touch it (lens build) — deferred

## Round 2 (whole)

fixed: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7
1. Should — the planner is dispatched in `direction` mode more than once (resume, Fix step) and returns a fresh ladder and `Recommended`, while nothing on disk fixes which option is under critique or which are ruled out, and `## Closed` does not name the option it closed; a resume can bring back a ruled-out option or approve against `- Rejected:` lines from a different ladder; fix: write the ladder at step 2 into approach-review.md or a ledger Ruling, have each Ruled-out `## Closed` name its option, and on resume or revision keep the option named in `## Approach`, the planner revising it without picking again — fixed
2. Nice — in `direction` mode the planner's last instruction still says reply with the path of plan.md and the task count, against the direction bullet's "writes no file"; say "reply with the draft and, for each label, `fixed` or `unverified: <reason>`" — deferred
3. Nice — the approach row of stage-skills.test.ts:25 matches each phrase with a plain includes on the unflattened SKILL.md, so each phrase must sit on one line; Task 3 does not say so — deferred

## Round 3 (diff)

fixed: 2.1
1. Should — the ladder Ruling's per-option `<what it does>` text is a `Ruling:` line, and fixFileUnexplained (grounds.ts:116,127 via mentionsPath) and the reviewer's Undeclared-files rule treat any Ruling naming a path as that path's justification, so a ladder option mentioning `packages/core/src/round/next.ts:30` silently exempts later unexplained fix commits to that file; fix: keep paths out of the ladder entries, keep only option names, or record the ladder outside a `Ruling:` line (e.g. prose above the first heading of approach-review.md, which parseRounds ignores) — fixed
2. Should — a ruled-out switch in a new session dispatches the planner with only the next option's name; the planner gets no ledger path and `## Approach` still holds the ruled-out option, so it rebuilds the option from its name and the critic reviews a different option from the ladder's; fix: pass that option's ladder entry or the ledger path with its name, or have the main session write the draft from the ladder Ruling plus the impact list with no planner dispatch — fixed
3. Nice — rule H counts only `: ruled out by` headings, so an option the owner turned down at step 5 is still "not yet ruled out" and can come back for a full new cycle before the owner is asked again — deferred

## Round 4 (diff)

fixed: 3.1, 3.2
No findings

## Closed
