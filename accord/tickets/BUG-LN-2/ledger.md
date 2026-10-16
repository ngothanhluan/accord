# Ledger

## Tasks

## Rulings
- Ruling: on the claim branch itself the working tree is read, not the branch tip — the claimant must see uncommitted work, and the spec reads the active ticket from the current branch — cost if wrong: the claimant's own dashboard lags its last commit.
- Ruling: when a ticket has both a local and a pushed claim branch, its state is read from the ref that already wins the claim (pushed over local, then the newest tip, `packages/cli/src/load/fs.ts:118-120`) — one rule for who holds it and where it stands, the one teammates see — cost if wrong: a claimant's unpushed commits are not reflected on another branch's dashboard.
- Ruling: with no plan-commit fact from the host, the stage is derived as today — hosts and core fixtures that supply none keep their goldens — cost if wrong: a host that forgets the fact shows `build` early.
- Ruling: the ready commit decides only plan versus build, never review, verify or done — done tickets from before the `plan: <id> ready` convention neither fall back to plan nor block their dependents — cost if wrong: a re-plan after the last task is not shown as plan.
- Ruling: a claim branch with no ticket file keeps the current branch copy — the ticket must not vanish — cost if wrong: a ticket deleted on its branch still shows.
- Ruling: lint, gates, approve, task-done, next, anchor and the session hook keep reading the checkout only — D-01 names the dashboard and status, and CI gates must check the tree they run on — cost if wrong: the session-start "in progress" count lags the dashboard.
- Ruling: a claim ref whose tip is an ancestor of HEAD is not overlaid — its records are already in the checkout, which may hold newer edits such as an archive — cost if wrong: a ticket re-opened under a merged branch name shows the checkout copy.
- Ruling: plan facts are spawned only by commands that derive a stage (status, dashboard, anchor, next, the hook), with `git --no-optional-locks status`, and the claim overlay only by status and dashboard — the panel runs `dashboard --json` on every turn and must not take the index lock while an agent commits; lint and the gates in CI pay nothing — cost if wrong: a stage-deriving command added later forgets the facts and shows `build` early.
- Ruling: the `/accord` skill accepts `continue <id>` and `pick-up <id>` for an id that `accord status --json` lists with a `branch`, not only an id in `accord/tickets/` — the dashboard now offers Continue on tickets whose file lives only on their branch — cost if wrong: `/accord continue <id>` on main becomes a New request and may scaffold a duplicate.

## Deferred
