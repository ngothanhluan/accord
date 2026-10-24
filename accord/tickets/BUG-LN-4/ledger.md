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
