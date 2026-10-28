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
