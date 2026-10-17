# Ledger

## Tasks
- task 1 done 55db9415d184
- task 2 done af39d748516d
- task 3 done 1902080bad33

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
- Ruling: the plan edits `packages/core/src/status/dashboard.ts` and `packages/cli/src/render/dashboard.ts`, the real modules, where the Approach names `load/snapshot.ts` in the CLI and `render/dashboard.ts` in core, which do not exist at the baseline — cost if wrong: none in behaviour, a naming mismatch with the Approach.
- Ruling: a host that supplies plan facts with no entry for a ticket's plan means not ready; only a missing facts key keeps today's stage — a never-committed plan.md must read plan — cost if wrong: a host that drops one entry shows `plan` early.
- Ruling: the dashboard stage cell reads `intent, next: <text>` before the idle suffix, the wording `anchor` uses — cost if wrong: the cell layout changes again.
- Ruling: a claim whose ticket blob is not readable locally (blobless clone) is skipped whole, so the checkout copy stays — the overlay reads nothing there — cost if wrong: such a ticket stays missing from the dashboard until its blobs are fetched.
- Ruling: the claim-ref ancestor check is a new `git merge-base --is-ancestor` spawn with `GIT_NO_LAZY_FETCH` set, rather than reusing `gitAncestors`, which sets no env — every new git call sets it — cost if wrong: none.
- Ruling: preflight sets `plain` to the snapshot itself when the checkout and the claim view are the same object — no second load when nothing is overlaid — cost if wrong: none.
- Ruling: the `plain` parameters on the internal `effectivePriorities` and `epicsSection` are required, and `dashboard()` fills them from `plain ?? snapshot` — neither is exported from core — cost if wrong: none.

## Deferred
- plan round 1.3: Task 4's AC-3 test checks `anchor` only for the round, ready, unstaged and claim-ref cases, not for staged and untracked plan.md.
- plan round 1.4: the plan does not say whether an overlaid row's lint counts come from the claim branch or the checkout; the Approach's Risks say the checkout.
- plan round 1.5: Task 1 does not say what the overlay does when `currentBranch(root)` returns undefined.
- plan round 1.6: Task 4's AC-3 test runs about 13 CLI commands with no explicit timeout over the 30 s default; Windows CI may time out.
- plan skill step 8 can make a `plan: <id> ready` commit that does not touch plan.md when the last round left it unchanged; AC-3 then keeps that ticket at `plan` (build critic, outside this plan).
- plan round 2.1: Task 1's no-fetch check accepts any non-zero exit from `git --no-lazy-fetch cat-file -e`, so on git older than 2.44 a usage error (129) passes it; assert status 1.
