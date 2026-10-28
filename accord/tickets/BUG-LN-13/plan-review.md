# Plan review: BUG-LN-13

## Round 1 (whole)
1. Should — the new Ready rule tells the person to wait for a merge that never comes when the prerequisite is dropped on the default ref but still open in the checkout: `dependsUnmerged` reads "dropped" from the checkout and lint stays silent, so `gate ready B` says to wait and never edit depends_on; skip or reword when the default ref's copy is dropped, with a case in Task 4's core test — fixed
2. Nice — Task 1 adds imports (`readFileSync`, `setFrontmatterKey`, `AC`) to done-on-default.test.ts that are first used in Task 3, so `npm run lint` fails on unused vars after Tasks 1 and 2 — deferred
3. Nice — Task 5's Consumes line leaves out Task 3, on which its step 2 (`blockedBy` on `t/T-1`) depends — deferred
4. Nice — Task 6 quotes its two anchor sentences as single lines, but lane-s.md:32-33 and approach/SKILL.md:60-61 wrap them — deferred

## Round 2 (diff)
No findings

## Closed
Converged at round 2: 0 Must open, 0 Should open, 3 Nice deferred.

## Round 3 (whole)
1. Should — Task 7 gates only Continue step 4; in the same session approach step 5 runs `gate ready`, and on a `gate.depends-unmerged` refusal sentence S tells the owner the ticket waits but never says to stop, so the paragraph goes on to commit, push and step 6 "Next: accord-plan", whose step 1 and step 4 never run Ready; B is planned while A is unmerged (approach/SKILL.md:60-65, :74; plan/SKILL.md:14, :48) — fixed
2. Nice — Task 7 changes a third skill and spec §6 beyond the Approach's Affected list, covered only by ledger Rulings, not a Decision — deferred

## Round 4 (diff)
1. Nice — sentence H says step 5's commit "carries `approved_hash:` alone", false when the ticket already holds an `ac_hash` from an earlier pass — deferred
2. Nice — sentence S read in order puts the commit after the merge while H commits while the gate fails; an agent may hold the approval uncommitted — deferred

## Closed
Converged at round 4: 0 Must open, 0 Should open, 3.1 fixed, 3 Nice deferred.
