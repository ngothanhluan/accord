Round record: 1

## Round 1

Should 1 [patch]: a missing blob in a blobless clone is read as an absent review.md or debug.md, so the record history counts no rounds and a head typed at the newest code passes; fail closed naming the commit and path — packages/cli/src/load/record-history.ts:149 — fixed in 34197fab
Should 2 [patch]: nearestCode skips a clean merge along first parents only, so ticket commits brought in on a second parent that is not on the default branch fall outside the printed head and the round's range; skip a merge only when every other parent lies outside the walk — packages/cli/src/load/walk.ts:78 — fixed in 34197fab
Should 3 [patch]: scopeProblems reports a facts error before it checks the D-10 skip, so a ticket done on the default branch fails gate.review-scope while gate.review-scope-skipped says its checks are skipped; test skipped() first in both branches — packages/core/src/round/scope.ts:101 — fixed in 34197fab
Should 4 [patch]: fixFileUnexplained calls isExempt without the ticket's added research records and ignores Wording-only lines, so a fix that adds a listed research record or touches a Wording-only file needs a duplicate Ruling, unlike outsideScope and undeclaredFiles — packages/core/src/round/grounds.ts:121 — fixed in 34197fab
Should 5 [patch]: record.md and lane-s.md never say the marks, evidence, grounds, Deferred-line and fix-file rules bind version 2 records only, so a version 1 ticket writes a round-3 Should as a Nice and no gate stops it — packages/core/skills/review/record.md:27 — fixed in 34197fab
Should 6 [patch]: `deferred` is "for a Nice finding" in one bullet and allowed for a Must or Should in another, and neither the review skill nor the spec says a finding deferred under D-08 with its Deferred line does not block `verdict: converged` — packages/core/skills/review/record.md:28 — fixed in 34197fab
Should 7 [patch]: the from-round-3 sentence reads two ways: "the final review not counted" (exempt findings vs not a round), the added-code restart (per finding file vs whole ticket), and whether the Should rule uses the same count — packages/core/skills/review/record.md:34 — fixed in 34197fab
Should 8 [patch]: the verdict text says exit 0 of `accord round` lets the verdict be written, but `accord round` exits 0 while printing `Added code:`, so a session writes the verdict and gate done fails on gate.review-scope; review that round first — packages/core/skills/review/record.md:59 — fixed in 34197fab
Should 9 [patch]: the reviewer's `rests on:` template lists only ac, D, Veto and Intent forms, so a lane S reviewer writes `Intent "…"`, which lane S never accepts; add the Understood and Done when forms — packages/core/agents/reviewer.md:44 — fixed in 34197fab
Should 10 [patch]: the reviewer is told every Should names what it rests on with no outlet for a quality Should that rests on no ticket line, so it invents a quote; say it gives a test or command, or says it rests on nothing so the session grades it a Nice from round 3 — packages/core/agents/reviewer.md:44 — fixed in 34197fab
Should 11 [patch]: the debug sentence "A commit after the next review round is that round's fix" is ambiguous and omits that such a commit's files need a finding of that round or a Ruling and that the episode's earlier commits get an `(added code round 1)` round — packages/core/skills/debug/SKILL.md:22 — fixed in 34197fab
Nice 12 [patch]: firstParent returns the record sha itself on any rev-parse failure, failing open — packages/cli/src/load/round-facts.ts:67 — deferred
Nice 13 [patch]: a failing `git rev-list --count` silently falls back to the whole base...HEAD diff with main's code in a version 2 package — packages/cli/src/commands/review-package.ts:104 — deferred
Nice 14 [patch]: a finding location is compared to git paths unnormalised, so `./src/a.ts` or a backslash path misses the fix-file set — packages/core/src/round/record.ts:17 — deferred
Nice 15 [patch]: a location written `` `src/a.ts:12` `` keeps `:12` in the file — packages/core/src/round/record.ts:17 — deferred
Nice 16 [patch]: a lone quote in a finding's text pairs with the opening quote of a later mark and makes the line unreadable — packages/core/src/round/record.ts:34 — deferred
Nice 17 [patch]: needsEvidence is exported and used nowhere — packages/core/src/round/evidence.ts:55 — deferred
Nice 18 [patch]: the ac-2 message tells a Should deferred passes, but ac-4 still fails it without grounds — packages/core/src/round/evidence.ts:101 — deferred
Nice 19 [patch]: no lane S test for ac-2 and ac-5 — packages/core/test/finding-evidence.test.ts:1 — deferred
Nice 20 [patch]: `--base` and the plan's baseline reach git rev-parse before the REF check — packages/cli/src/commands/review-package.ts:43 — deferred
Nice 21 [patch]: ranges are listed in date order reversed, not topological order — packages/cli/src/load/walk.ts:38 — deferred
Nice 22 [patch]: review-scope-package.test.ts re-parses its own fixture, and round-facts.test.ts accepts either of two heads — packages/cli/test/round-facts.test.ts:82 — deferred
Nice 23 [patch]: no test for isAncestor or mergeBase exit other than 1 in record-history.ts — packages/cli/src/load/record-history.ts:73 — deferred
Nice 24 [patch]: whyGit is written four times and the GIT options object twice — packages/cli/src/load/walk.ts:15 — deferred
Nice 25 [patch]: no text says what to do when the package prints `Head: (cannot tell: …)` — packages/core/skills/review/SKILL.md:20 — deferred
Nice 26 [patch]: no text says each mark kind appears at most once on a finding line — packages/core/skills/review/record.md:30 — deferred
Nice 27 [patch]: text says merges of the default branch are not fix commits, but the code excludes every merge — packages/core/skills/review/record.md:40 — deferred
Nice 28 [patch]: the final-review placement phrase does not say a stretch ends at a round an owner allowance names — packages/core/skills/review/record.md:24 — deferred
Nice 29 [patch]: the review skill does not point to the fix-file exemptions or the version 1 package forms, and drops the whole-ticket and merge-resolution sentences — packages/core/skills/review/SKILL.md:27 — deferred
Nice 30 [patch]: failure.md still describes the `Review base:` round, and a stage-skills test title says the package reads after the review base — packages/core/skills/shared/failure.md:47 — deferred
Nice 31 [patch]: `<r>` in the Deferred line is not defined as the round's place in its cycle — packages/core/skills/review/record.md:37 — deferred
Nice 32 [patch]: the `--base` help text still says the default is the plan's baseline — packages/cli/src/run.ts:173 — deferred

## Round 2

Should 1 [patch]: after a final review that already covered a merge, `accord round` still prints `Added code:` because pendingOf reads the span from the last round not headed `(final review)`, and record.md tells the session to run that round before the verdict; gate.review-scope never asks it, and if that round reports a Must its re-review leaves the final review two rounds from the end, so gate done fails — packages/core/src/round/scope.ts:170 — fixed in 90808284
Nice 2 [patch]: a version 2 record's unknown-heading error names the version 1 heading forms — packages/core/src/round/record.ts:149 — deferred

verdict: converged
