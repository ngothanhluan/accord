# Ledger

## Rulings
Ruling: lifted from lane S; the plan baseline is the fork point 85b3158334ccd32ed9e48e4a7ce560041b86467b — the review then reads the lane S code too — cost if wrong: that code goes unreviewed
Ruling: with no remote, the default branch D-01 compares with is the local default branch — adapter none and a clone without origin must still work — cost if wrong: a repository without a remote treats a ticket as merged at a different moment than the owner expects
Ruling: approach option "dashboard and gate ready only" ruled out — the critic's Must showed `next` and `show` would still count an unmerged prerequisite as done, against D-01 — cost if wrong: a heavier change than needed
Ruling: the default-ref snapshot is a new field beside `plain`, not a replacement — `show --approval` and `accord approve` must read the checkout the owner approves — cost if wrong: approval bound to text the owner never saw
Ruling: the fallback to local main or master applies only when the clone has no `origin`, the test `worktree clean` uses — matches the ledger's no-remote Ruling — cost if wrong: a clone with only another remote reads the checkout
Ruling: when no default ref resolves, every reader keeps today's checkout reading — a repository without such a branch still works — cost if wrong: such a repository counts a ticket done before it merges
Ruling: a ticket without a lane counts as done on the default ref when its ticks are bound there, `isDone`'s existing rule — D-04 speaks only of stage — cost if wrong: its dependants unblock on a different test from clean's
Ruling: the new Ready rule skips a prerequisite that lint already reports (dropped or unknown) — lint's "re-plan without it" is the right instruction there — cost if wrong: two contradicting reasons in one output
Ruling: no new dashboard output names the ref read or asks for a fetch — no criterion asks for it and `/accord` fetches through `worktree clean` first — cost if wrong: a stale dashboard after a GitHub merge until the next fetch
Ruling: the session-start hook line keeps counting from the checkout — the hook must stay light and no criterion covers it — cost if wrong: its in-progress count can differ from the dashboard's
Ruling: `defaultRef` is a host-attached `RepoSnapshot` field set after load, not a `SnapshotInput` field — it is the precedent of `commits`, `reviewFacts` and `branchFacts`, and keeps every golden unchanged — cost if wrong: a later host has to attach it itself
Ruling: the field is attached after the pin check, only under the claims preflight and in `gate ready` — a pin refusal spends no git spawn — cost if wrong: none beyond ordering
Ruling: an unclaimed row that is done only off the default ref is listed in UP NEXT and counted with the backlog, but is never the Pick up suggestion — the summary's buckets are fixed — cost if wrong: the backlog count is off by such rows
Ruling: the rule id is `gate.depends-unmerged`; its reason names the ref without the `refs/remotes/` or `refs/heads/` prefix, and when no ref was read it says "in this checkout" — with no ref read the rule reads the checkout, which is why the ST-LN-2 test changes — cost if wrong: wording only
Ruling: a prerequisite in a `depends_on` cycle gets both the lint cycle reason and the wait-for-merge reason — the skip covers only dropped and unknown — cost if wrong: two reasons on a broken graph
Ruling: test fixtures fake origin's default branch by writing the `refs/remotes/origin/main` ref directly, as existing tests fake origin refs — cost if wrong: the case of a real fetched remote is not run
Ruling: a prerequisite dropped on the default ref but still open in the checkout gets a re-plan reason under `gate.depends-unmerged`, not a skip — lint reads the checkout and says nothing about it, so a skip would let `gate ready` pass on a prerequisite that never merges — cost if wrong: the refusal comes under a gate rule id instead of a lint id
Ruling: a prerequisite dropped in the checkout is still left to lint, even if the ref has it open — keeps the approach's "left to lint's reason" and avoids two reasons on one entry — cost if wrong: none beyond wording
Ruling: skill sentence S is tied to the words "not done" in the gate's reason, so it never covers the dropped reason — otherwise "never remove that entry" would contradict "re-plan without it" — cost if wrong: wording only

## Deferred
- plan round 1.2 (Nice): Task 1 adds test imports first used in Task 3; `npm run lint` reports unused vars after Tasks 1 and 2
- plan round 1.3 (Nice): Task 5's Consumes line leaves out Task 3, on which its step 2 depends
- plan round 1.4 (Nice): Task 6 quotes its two anchor sentences as single lines; the sources wrap them

## Tasks
- task 1 done a46e5943fd4b
