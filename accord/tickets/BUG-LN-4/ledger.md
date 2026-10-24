# Ledger

## Rulings
- Ruling: intent: "approved or done" in @ac-1 is what the script already reads as approved at the base (approved_hash, or ac_hash on lane S, an unsettled read counting as approved), and "dropped" is what is_dropped reads — the same rule BUG-LN-3 set, so the two checks never disagree — an odd-frontmatter ticket's deletion fails, closed
- Ruling: intent: the -e fix mechanism (shell line or set +e) is left to the approach — it does not change what the owner sees — none
- Ruling: audit: @ac-1 "approved" names the key, not a matching hash — a stale hash is still an approval record worth keeping, and BUG-LN-3 reads it the same way — a deletion of a ticket edited after approval fails until it is dropped
- Ruling: audit: @ac-3 keeps ac-1's failure and also requires gate done to run on the new ticket — with D-01 the swap always fails, so the test shows both failures reported on one push — none
- Ruling: audit: @ac-4 moves every existing script test to the CI flags, not only new ones — the owner's "tests run with those flags" — slower to diagnose if a flag breaks many tests at once
- Ruling: approach: chosen deletion check plus `set +e` (architect option 2) — holds whatever shell line a user writes — one line to keep
- Ruling: approach: a deleted ticket dropped at the base still sets has_code — keeps BUG-LN-3's rename rule unchanged — a dropped ticket deleted beside a new draft gates that draft
- Ruling: approach: the verify skill's local check gets the same deletion rule (critic finding 8) — verify stands in for the CI check — one more rendered skill file
- Ruling: approach: .github/workflows/ci.yml's own "not -e" comment stays out — a different step, not the accord check — that job can stop early on its first failure
- Ruling: plan: renaming an approved ticket fails like a deletion, since the script sees a rename as delete plus add — a consequence of D-01, confirmed by the owner, who chose option (a): "A" — an id change goes through drop and a new ticket
- Ruling: task 1: a base status of dropped with an unreadable ## Dropped reason gets its own fix-the-reason line, not the accord drop advice, as the Approach says — accord drop would refuse an already dropped ticket — only the message text differs
- Ruling: task 1: `set +e` landed in task 1 instead of task 3 to keep the script hunk coherent — task 3 still owns its probe and the CI-flag runner — task 3's probe must still be written
- Ruling: task 1: the A-09 line left accord/tests-baseline.txt, its test now being @ac-2's — the Approach lists it as affected — none

## Deferred
- plan round 1.6: probe this repository's copy for `set +e` too
- plan round 1.7: an unsettled base frontmatter with status dropped gets the drop advice that command refuses
- plan round 1.8: verify text: unreadable frontmatter counts as approved and not dropped
- plan round 1.9: verify's "no default branch" case should stop, not push
- plan round 1.10: shared rule vs Task 1 on the per-ticket loop call
- plan round 1.11: Task 1 says three GATED rename cases; there are two
- plan round 1.12: Task 3's flags probe needs a named sandbox
- plan round 1.13: plan.md:14 cites a check that does not exist
- plan round 1.14: is_dropped return code wording in Task 1
- Ruling: re-audit: verified ticks protect a ticket on any lane, not only without a lane — the Intent says "approved or done", and a tick is the done record — a lane M ticket with ticks but no approval must be dropped first
- Ruling: re-audit: "base commit" stays the pull request's base sha, as BUG-LN-3 set; GitHub refreshes it on each push, so the merge-and-push in the fix message reaches the drop — a stale base needs one more push
- Ruling: re-audit: @ac-2's "dropped" is what is_dropped reads (status dropped and a readable reason), matching the approved Approach's separate unreadable-reason line — a dropped ticket with an unreadable reason fails until the reason is fixed
- Ruling: plan round 1: D-04's wider protection lives in a new protected_at used only by the deletion check, approved_at unchanged — keeps the per-ticket gating and BUG-LN-3's rule as they are — a second function to keep in step
- Ruling: plan round 1: any verified: value other than [] counts as ticked — the script cannot read YAML, so it leans toward protection — a bare verified: line must be dropped before deletion
- plan round 2.2: the fix line should say to keep the deletion on a modify/delete merge conflict

## Tasks
- task 1 done 383a78a0b99c
