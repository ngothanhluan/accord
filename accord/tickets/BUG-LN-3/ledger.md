# Ledger

## Tasks

## Rulings
- Ruling: approach: approved detection is a loose key match and dropped detection a stricter `status` match, and every unsettled read counts as approved — a check that cannot tell should run the gate, not skip it — a ticket with odd frontmatter is gated, the original symptom, never a bypass
- Ruling: approach: the code check uses `--no-renames` and no deletion filter — a deleted or moved code file is still code (@ac-3) — a pull request that only moves a file out of `accord/` is gated
- Ruling: approach: no `gate done --base` flag — it would change `gate done`, which Intent puts out of scope — none
- Ruling: plan: the base version is read at `$BASE` (the pull request's base sha), not the merge-base — it is the commit the ticket calls "the base commit", and a key added on main after the fork still gates — one extra gate on a branch behind main
- Ruling: plan: `dropped` matches only a `status:` line at column 0 of the HEAD frontmatter — a nested `status:` must not open the skip — an indented top-level `status:` is gated and fails, closed
- Ruling: plan: `sandbox()` gets an optional `seed` callback for tickets in the base commit — the base needs draft and approved fixtures — none outside the test file

## Deferred
- plan round 1.5: rule line 14 cites a test "finds no denied name in the config, the workflow, or the pointer block" that does not exist in the tree.
- plan round 1.6: Task 4 does not say whether Task 3's `risk:parsing` cases join the shared @ac-4 case array.
- plan round 1.7: `risk:parsing` case 3 (approved, 2 MB) passes even with the forbidden `git show | awk` pipeline; a large unapproved draft expecting "not gated" would catch it.
