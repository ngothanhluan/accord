# Ledger

## Tasks
- task 1 done 31187911dcc6
- task 2 done 4fd0c4fc6a3b
- task 3 done 4a0e93d72972
- task 4 done ba0d5da8347d

## Rulings
- Ruling: approach: approved detection is a loose key match and dropped detection a stricter `status` match, and every unsettled read counts as approved — a check that cannot tell should run the gate, not skip it — a ticket with odd frontmatter is gated, the original symptom, never a bypass
- Ruling: approach: the code check uses `--no-renames` and no deletion filter — a deleted or moved code file is still code (@ac-3) — a pull request that only moves a file out of `accord/` is gated
- Ruling: approach: no `gate done --base` flag — it would change `gate done`, which Intent puts out of scope — none
- Ruling: plan: the base version is read at `$BASE` (the pull request's base sha), not the merge-base — it is the commit the ticket calls "the base commit", and a key added on main after the fork still gates — one extra gate on a branch behind main
- Ruling: plan: `dropped` matches only a `status:` line at column 0 of the HEAD frontmatter — a nested `status:` must not open the skip — an indented top-level `status:` is gated and fails, closed
- Ruling: plan: `sandbox()` gets an optional `seed` callback for tickets in the base commit — the base needs draft and approved fixtures — none outside the test file
- Ruling: build task 1: the script also skips a dropped ticket (is_dropped) in task 1, though the dropped case is task 2's test — the brief listed the whole rule and task 2 would otherwise rewrite the same lines — task 2's dropped case is the only check of that branch
- Ruling: build task 2: a nested-status case was added to the dropped test beyond the brief's five — task 1 already held the dropped skip, so only the nested case could fail first; it caught an unanchored regex that let an indented status: dropped skip the gate — one assertion block, easy to remove
- Ruling: build task 3: the new tests use the brief's exact titles, and their failing-first proof is one coarse mutation (always skip) that failed 8 of 15 cases, since tasks 1 and 2 already held the rule — keeps ids stable for the baseline — a sub-case that no single mutation fails is not shown to bite
- Ruling: build task 4: the @ac-4 comparison also replays the nested-status case beside the two dropped cases, and reads the task 3 cases from the module-level array — more coverage of the same fixtures — none

- Ruling: review round 1: a ticket renamed in the pull request is read at its old path in the base commit, and deleting a ticket file outright stays ungated (A-09), filed as BUG-LN-4 — owner: "Vá đổi tên, xóa file để ticket riêng (Recommended)" — a deleted approved ticket in a docs-only pull request is not gated until BUG-LN-4
- Ruling: review round 1 fix: rename lines are parsed with awk's default whitespace split — the no-backslash rule rules out a tab separator — a ticket path with a space would read as unapproved; ticket ids have none

- Ruling: review round 2: in a pull request that changes nothing outside accord/, deleting or renaming away a ticket file approved in the base commit gates every ticket the pull request touches, whether or not git detects the rename; a delete-only pull request touching no other ticket stays BUG-LN-4 — owner: "Close it in BUG-LN-3 (Recommended)" — a docs-only rename of an approved ticket is gated, which it should be anyway
- Ruling: review round 2 fix: the round 1 rename lookup (renames, awk base_file) is removed, since the deletion rule covers every rename, so the round 1 awk-split Ruling no longer applies — deletion beats addition — none
- Ruling: final review fix: the script's fence tracking for the Dropped section is approximate (fence length ignored), and a reading it cannot settle answers not dropped — lint's scanner is stricter and still fails the job on a reason it rejects — one edge ticket wrongly gated, or a reason lint rejects accepted while lint fails the job
- Ruling: review past the cap: one more fix round and one re-review after round 5 — owner: "One more fix round (Recommended)" — none
- Ruling: allowlist fix: the parsing cases use the odd spelling in both the base and the pull request version with a body-only edit, since a base read as approved already gates — a pull-request-only rewrite is not a separate case, and that path is gated by the base read — none
- Ruling: allowlist fix: a fourth parsing case, a whole mapping indented — the brief named it as missed — one extra sandbox

## Deferred
- plan round 1.5: rule line 14 cites a test "finds no denied name in the config, the workflow, or the pointer block" that does not exist in the tree.
- plan round 1.6: Task 4 does not say whether Task 3's `risk:parsing` cases join the shared @ac-4 case array.
- plan round 1.7: `risk:parsing` case 3 (approved, 2 MB) passes even with the forbidden `git show | awk` pipeline; a large unapproved draft expecting "not gated" would catch it.
- review round 1 Nice 3: the script exists twice, in workflow.ts and .github/workflows/accord.yml, kept in step only by the @ac-4 replay test.
- review round 2 Nice 3: the comment in the @ac-4 test sits after its last statement, before the timeout argument; it belongs above the `it(` line.
- review round 3 Nice 1: no test covers the fail-closed branch of the deletion check (a deleted ticket whose base frontmatter cannot be read, beside an added draft).
- review round 3 Nice 2: the round 2 owner decision on deletes and renames is a ledger Ruling, not a Decision or an Approach note in the ticket.
- final review: GitHub runs `shell: bash` with -eo pipefail while the script says it avoids -e, and the tests run plain bash; filed as BUG-LN-5.
