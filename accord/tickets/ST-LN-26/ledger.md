# Ledger

## Rulings

- Ruling: the stage treats "a review round of the changes after C is recorded" as a commit touching review.md after the last hand-made commit, with a valid verdict as the file's last line — the stage sees commits, not round contents — cost if wrong: a round that does not cover the fix lets the ticket reach verify, where only the verifier would catch it.
- Ruling: "from the main branch" means commits reachable from origin's default ref, else the local default branch; with neither, every merge counts as a change — errs toward an extra review — cost if wrong: an extra review round after a merge from an untracked main.
- Ruling: the git fact is computed only while the verified commit is not reachable from the default ref, so a merged ticket stays done on main — post-merge failures are a new ticket by the intent — cost if wrong: a squash-merged branch keeps today's behaviour.
- Ruling: on git older than 2.36 the fact is read without --remerge-diff and merges count as changes, and no git error makes status, anchor or dashboard exit 2 — those commands must keep working — cost if wrong: an extra review round on old git.
- Ruling: a failure only CI's operating system shows keeps one debug episode open across verifies: red evidence is the CI log, green is CI at the next verify, and the failed-fix count carries over — the executor cannot see red on a skipped test locally — cost if wrong: the episode ends only when CI is green, so Continue keeps returning to debug until then.
- Ruling: the fix review after verify gets its own cap of five rounds, counted from the first round after verify — D-03 applies review's rules to the fix as a new review — cost if wrong: a ticket that used five rounds before verify gets five more.
- Ruling: a New request whose text reports a failure in a ticket at verify or done, and `/accord continue <id> <text>`, route to that ticket's debug, not to lane S — otherwise the ST-LN-20 path (main session fixes) survives — cost if wrong: a genuine new small request that mentions such a ticket is offered debug first.
- Ruling: the approach critic's two rounds are settled in the Approach, each finding fixed in the option or kept as a named risk there — cost if wrong: a finding resurfaces at plan review.
