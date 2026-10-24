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
- Ruling: task 2: the failing-listing line ends "- the check fails rather than let an approved ticket go unchecked", as the plan says, replacing task 1's "fix the git error and push again" — the plan's wording — no test asserts the tail
- Ruling: task 2: is_dropped returns 2 for status dropped with an unreadable reason, and the deletion loop branches on 2 (reason line) versus other non-zero (accord drop line), replacing task 1's status re-check — one read decides both messages — a caller treating 2 as dropped would skip the fix line
- Ruling: task 2: the swap and failing-listing tests passed before the change because task 1's script already held that behaviour; the unreadable-reason test was red first — the plan ordered the script ahead of these tests — none
- Ruling: task 3: neither new test could fail first because task 1 already held `set +e`; the `false` probe's variant without `set +e` exits non-zero with no gate call, which shows the line is what keeps the run going — the red step moved into the probe — none
- Ruling: task 3: the stub prints `npx stub failed: <args>` when it fails, beside task 2's `npx stub: <args>` — the both-fail assertions need to tell a failed gate from a passed one — only the stub's text
- Ruling: task 4: the verify skill's rule reads "each such line is a failure: stop, nothing is pushed." in lowercase after "Then:", the phrase the test asserts — the plan's wording — cosmetic only
- Ruling: re-audit: verified ticks protect a ticket on any lane, not only without a lane — the Intent says "approved or done", and a tick is the done record — a lane M ticket with ticks but no approval must be dropped first
- Ruling: re-audit: "base commit" stays the pull request's base sha, as BUG-LN-3 set; GitHub refreshes it on each push, so the merge-and-push in the fix message reaches the drop — a stale base needs one more push
- Ruling: re-audit: @ac-2's "dropped" is what is_dropped reads (status dropped and a readable reason), matching the approved Approach's separate unreadable-reason line — a dropped ticket with an unreadable reason fails until the reason is fixed
- Ruling: plan round 1: D-04's wider protection lives in a new protected_at used only by the deletion check, approved_at unchanged — keeps the per-ticket gating and BUG-LN-3's rule as they are — a second function to keep in step
- Ruling: plan round 1: any verified: value other than [] counts as ticked — the script cannot read YAML, so it leans toward protection — a bare verified: line must be dropped before deletion
- Ruling: debug fix 1: the 60 s describe bound stays, as D-05 cut cases and asked for no timeout change — the owner chose cutting cases — GATED (10 cases) can still time out on a heavily loaded machine; the replay keeps its own 600 s

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
- plan round 2.2: the fix line should say to keep the deletion on a modify/delete merge conflict
- review round 1 Nice (security): a deleted ticket path git quotes (", \ or a control character) misses the ^accord/tickets/ match, so its deletion is not checked; only a maintainer can put such a file at the base; reading the listing with -z would close it
- review round 1 Nice (security): the older lane-drop echo prints a HEAD file name a fork controls, so a name starting with :: could emit a workflow command; predates this ticket

## Tasks
- task 1 done 383a78a0b99c
- task 2 done 56d7517168fd
- task 3 done fa896d97cf6a
- task 4 done bc6cf3f00abe
