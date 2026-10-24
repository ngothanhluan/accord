# Plan review

## Round 1 (whole)
1. Must — a done ticket with no `lane` key (0.1.0 contract: `ac_hash` and `verified` ticks, never an `approved_hash`, e.g. accord/tickets/README-1.md) is read as unapproved, so a pull request that only deletes it passes; breaks the Intent's "approved or done" — fixed
2. Should — the fix message is wrong as written: `accord drop` only pushes a `drop/<id>` branch whose pull request must merge first, and on the ticket's own branch it refuses because the file is gone there; word it as restore-if-own-branch, drop, merge the drop pull request, merge the default branch, push, and assert the merge step — fixed
3. Should — Task 4's verify text says to show the deletion lines but never that each is a failure that stops verify with nothing pushed; the test checks only phrases, so verify can push and mark ready a branch CI fails — fixed
4. Should — @ac-4's BOTH_FAIL has one ticket, so no gate runs after a failed gate and "every gate still runs" is never observed; add a second ticket gated after the failing one — fixed
5. Should — `approved_at` reads a block-scalar `lane: >-` / `  S` as not lane S, so a lane S ticket with `ac_hash` can be deleted; treat a `lane:` value not on its key line as unsettled, hence approved, and add a DELETED_APPROVED case — fixed
6. Nice — only the emitted script is probed for `set +e`; this repository's copy could miss it — deferred
7. Nice — an unsettled base frontmatter with status dropped gets the `accord drop` advice that command refuses — deferred
8. Nice — Task 4 should say an unreadable frontmatter counts as approved and not dropped — deferred
9. Nice — Task 4's "no default branch resolves" lets verify push anyway — deferred
10. Nice — shared rule "per-ticket loop kept unchanged" contradicts Task 1's `is_dropped HEAD "$file"` call — deferred
11. Nice — Task 1 says three GATED rename cases; there are two — deferred
12. Nice — Task 3's flags probe names no sandbox, and an empty change fails the fixture's second commit — deferred
13. Nice — plan.md:14 cites a tool-name check in scaffold.test.ts that does not exist — deferred
14. Nice — Task 1 says is_dropped returns 1 otherwise, but its awk returns 3 — deferred

## Round 2 (whole)
1. Should — protected_at checks the lane-not-on-key-line case before the ac_hash check, so a block-scalar lane alone protects an unapproved ticket, breaking D-02 and @ac-2 and disagreeing with Task 4's verify text; move it after the ac_hash check — open
2. Nice — the fix line does not say to keep the deletion when merging the default branch hits a modify/delete conflict — deferred
